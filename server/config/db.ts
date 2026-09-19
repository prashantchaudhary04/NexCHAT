import mongoose from 'mongoose';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

export interface IUser {
  _id: string;
  username: string;
  email: string;
  password?: string;
  displayName: string;
  avatar: string;
  bio: string;
  age?: number;
  gender?: string;
  isOnline: boolean;
  lastSeen: Date;
  theme: string;
  chatBackground: string;
  contacts: string[]; // user IDs
  lastSeenPrivacy?: 'all' | 'contacts' | 'selected' | 'nobody';
  lastSeenSelectedContacts?: string[];
  onlinePrivacy?: 'all' | 'contacts' | 'selected' | 'nobody';
  onlineSelectedContacts?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IFriendRequest {
  _id: string;
  sender: string; // user ID
  receiver: string; // user ID
  introMessage?: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: Date;
  updatedAt: Date;
}

export interface IConversation {
  _id: string;
  isSelf?: boolean;
  isGroup?: boolean;
  name?: string;
  avatar?: string;
  description?: string;
  adminIds?: string[];
  participants: string[]; // user IDs (max 100)
  lastMessage?: string; // message ID
  unreadCounts: Record<string, number>; // userId -> count
  customBackground?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IReaction {
  userId: string;
  emoji: string;
}

export interface ICallInfo {
  callId?: string;
  conversationId?: string;
  isGroup?: boolean;
  groupName?: string;
  callType: 'audio' | 'video';
  status: 'accepted' | 'rejected' | 'not_accepted';
  duration?: number;
  callerId: string;
  receiverId?: string;
  callerName?: string;
  participants?: string[];
}

export interface IMessage {
  _id: string;
  conversationId: string;
  sender: string; // user ID
  senderName?: string;
  senderAvatar?: string;
  receiver?: string; // user ID (for direct messages)
  text: string;
  callInfo?: ICallInfo;
  fileType?: 'image' | 'video' | 'audio' | 'document' | 'other';
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  replyTo?: {
    messageId: string;
    text: string;
    senderName: string;
  };
  reactions: IReaction[];
  status: 'sent' | 'delivered' | 'read';
  isEdited: boolean;
  isForwarded: boolean;
  deletedFor: string[]; // user IDs who deleted this message for themselves
  isDeletedForEveryone: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IStoryView {
  userId: string;
  username: string;
  avatar: string;
  viewedAt: Date;
}

export interface IStory {
  _id: string;
  userId: string;
  mediaType: 'image' | 'video' | 'text';
  mediaUrl?: string;
  textContent?: string;
  backgroundGradient?: string;
  textColor?: string;
  visibility: 'contacts' | 'public';
  views: IStoryView[];
  expiresAt: Date;
  createdAt: Date;
}

export interface ICallHistory {
  _id: string;
  callerId: string;
  receiverId?: string;
  conversationId?: string;
  isGroup?: boolean;
  groupName?: string;
  participants?: string[];
  callType: 'audio' | 'video';
  status: 'completed' | 'accepted' | 'missed' | 'rejected' | 'busy' | 'not_accepted';
  duration: number; // in seconds
  createdAt: Date;
}

export interface INotification {
  _id: string;
  recipientId: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  type: 'friend_request' | 'request_accepted' | 'message_request' | 'new_message' | 'story_view' | 'missed_call';
  content: string;
  title?: string;
  body?: string;
  linkId?: string; // e.g. conversationId or requestId
  read: boolean;
  createdAt: Date;
}

/**
 * Universal Data Layer:
 * Supports real MongoDB if MONGO_URI is set.
 * In sandboxed or local dev environments without active MongoDB daemon,
 * seamlessly uses a persistent, high-performance in-memory data store with seeded demo contacts.
 */
class PersistentMap<K, V> extends Map<K, V> {
  private onChange?: () => void;

  constructor(onChange?: () => void) {
    super();
    this.onChange = onChange;
  }

  setOnChange(onChange: () => void) {
    this.onChange = onChange;
  }

  override set(key: K, value: V): this {
    super.set(key, value);
    if (this.onChange) this.onChange();
    return this;
  }

  override delete(key: K): boolean {
    const result = super.delete(key);
    if (result && this.onChange) this.onChange();
    return result;
  }

  override clear(): void {
    super.clear();
    if (this.onChange) this.onChange();
  }
}

class MemoryDataStore {
  users: PersistentMap<string, IUser>;
  friendRequests: PersistentMap<string, IFriendRequest>;
  conversations: PersistentMap<string, IConversation>;
  messages: PersistentMap<string, IMessage>;
  stories: PersistentMap<string, IStory>;
  callHistories: PersistentMap<string, ICallHistory>;
  notifications: PersistentMap<string, INotification>;

  private dataDir = path.join(process.cwd(), 'data');
  private dataFilePath = path.join(process.cwd(), 'data', 'nexus_store.json');
  private isDirty = false;
  private saveTimer: NodeJS.Timeout | null = null;

  constructor() {
    const triggerPersist = () => this.persist();
    this.users = new PersistentMap<string, IUser>(triggerPersist);
    this.friendRequests = new PersistentMap<string, IFriendRequest>(triggerPersist);
    this.conversations = new PersistentMap<string, IConversation>(triggerPersist);
    this.messages = new PersistentMap<string, IMessage>(triggerPersist);
    this.stories = new PersistentMap<string, IStory>(triggerPersist);
    this.callHistories = new PersistentMap<string, ICallHistory>(triggerPersist);
    this.notifications = new PersistentMap<string, INotification>(triggerPersist);

    this.initStore();

    // Periodic flush timer for disk synchronization
    setInterval(() => {
      if (this.isDirty) {
        this.persistNow();
      }
    }, 1500).unref();

    // Process termination hooks to ensure safe shutdown and zero data loss
    const flushOnExit = () => {
      if (this.isDirty) {
        this.persistNow();
      }
    };
    process.on('SIGINT', () => { flushOnExit(); process.exit(0); });
    process.on('SIGTERM', () => { flushOnExit(); process.exit(0); });
  }

  private initStore() {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }

      if (fs.existsSync(this.dataFilePath)) {
        const raw = fs.readFileSync(this.dataFilePath, 'utf-8');
        const data = JSON.parse(raw);
        if (data && Array.isArray(data.users) && data.users.length > 0) {
          this.hydrate(data);
          console.log(`📦 [DataStore] Restored persistent account data from disk (${this.users.size} users, ${this.conversations.size} conversations, ${this.messages.size} messages)`);
          return;
        }
      }
    } catch (err) {
      console.warn('⚠️ [DataStore] Could not hydrate from disk, initializing fresh seed:', err);
    }

    this.seedInitialData();
    this.persistNow();
  }

  private hydrate(data: any) {
    if (Array.isArray(data.users)) {
      for (const u of data.users) {
        this.users.set(u._id, {
          ...u,
          isOnline: false, // Live presence: only true when live socket is connected
          lastSeenPrivacy: u.lastSeenPrivacy || 'all',
          lastSeenSelectedContacts: Array.isArray(u.lastSeenSelectedContacts) ? u.lastSeenSelectedContacts : [],
          onlinePrivacy: u.onlinePrivacy || 'all',
          onlineSelectedContacts: Array.isArray(u.onlineSelectedContacts) ? u.onlineSelectedContacts : [],
          lastSeen: u.lastSeen ? new Date(u.lastSeen) : new Date(),
          createdAt: u.createdAt ? new Date(u.createdAt) : new Date(),
          updatedAt: u.updatedAt ? new Date(u.updatedAt) : new Date(),
        });
      }
    }

    if (Array.isArray(data.friendRequests)) {
      for (const r of data.friendRequests) {
        this.friendRequests.set(r._id, {
          ...r,
          createdAt: r.createdAt ? new Date(r.createdAt) : new Date(),
          updatedAt: r.updatedAt ? new Date(r.updatedAt) : new Date(),
        });
      }
    }

    if (Array.isArray(data.conversations)) {
      for (const c of data.conversations) {
        this.conversations.set(c._id, {
          ...c,
          createdAt: c.createdAt ? new Date(c.createdAt) : new Date(),
          updatedAt: c.updatedAt ? new Date(c.updatedAt) : new Date(),
        });
      }
    }

    if (Array.isArray(data.messages)) {
      for (const m of data.messages) {
        this.messages.set(m._id, {
          ...m,
          createdAt: m.createdAt ? new Date(m.createdAt) : new Date(),
          updatedAt: m.updatedAt ? new Date(m.updatedAt) : new Date(),
        });
      }
    }

    if (Array.isArray(data.stories)) {
      for (const s of data.stories) {
        this.stories.set(s._id, {
          ...s,
          views: Array.isArray(s.views)
            ? s.views.map((v: any) => ({ ...v, viewedAt: new Date(v.viewedAt) }))
            : [],
          expiresAt: s.expiresAt ? new Date(s.expiresAt) : new Date(Date.now() + 86400000),
          createdAt: s.createdAt ? new Date(s.createdAt) : new Date(),
        });
      }
    }

    if (Array.isArray(data.callHistories)) {
      for (const c of data.callHistories) {
        this.callHistories.set(c._id, {
          ...c,
          createdAt: c.createdAt ? new Date(c.createdAt) : new Date(),
        });
      }
    }

    if (Array.isArray(data.notifications)) {
      for (const n of data.notifications) {
        this.notifications.set(n._id, {
          ...n,
          createdAt: n.createdAt ? new Date(n.createdAt) : new Date(),
        });
      }
    }
  }

  private serialize() {
    return {
      version: 1,
      savedAt: new Date().toISOString(),
      users: Array.from(this.users.values()),
      friendRequests: Array.from(this.friendRequests.values()),
      conversations: Array.from(this.conversations.values()),
      messages: Array.from(this.messages.values()),
      stories: Array.from(this.stories.values()),
      callHistories: Array.from(this.callHistories.values()),
      notifications: Array.from(this.notifications.values()),
    };
  }

  public persist() {
    this.isDirty = true;
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.persistNow();
    }, 250);
  }

  public persistNow() {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
      const data = JSON.stringify(this.serialize(), null, 2);
      const tempPath = path.join(this.dataDir, `.nexus_store.tmp.${Date.now()}`);
      fs.writeFileSync(tempPath, data, 'utf-8');
      fs.renameSync(tempPath, this.dataFilePath);
      this.isDirty = false;
    } catch (err) {
      console.error('❌ [DataStore] Error saving store to disk:', err);
    }
  }

  private seedInitialData() {
    const demoPasswordHash = bcrypt.hashSync('password123', 10);

    // Seed standard demo users for immediate testing
    const demoUsers: Partial<IUser>[] = [
      {
        _id: 'user_alex_1',
        username: 'alex_dev',
        displayName: 'Alex Rivers',
        email: 'alex@example.com',
        password: demoPasswordHash,
        bio: 'Full-stack builder & open source enthusiast 💻',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        isOnline: false,
        lastSeen: new Date(Date.now() - 1000 * 60 * 8), // 8 mins ago
        lastSeenPrivacy: 'all',
        lastSeenSelectedContacts: [],
        onlinePrivacy: 'all',
        onlineSelectedContacts: [],
        theme: 'midnight',
        chatBackground: 'default',
        contacts: ['user_sarah_2'],
        createdAt: new Date(Date.now() - 3600 * 24 * 10 * 1000),
        updatedAt: new Date(),
      },
      {
        _id: 'user_sarah_2',
        username: 'sarah_art',
        displayName: 'Sarah Chen',
        email: 'sarah@example.com',
        password: demoPasswordHash,
        bio: 'Digital artist, designer & UI enthusiast ✨🎨',
        avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
        isOnline: false,
        lastSeen: new Date(Date.now() - 1000 * 60 * 2), // 2 mins ago
        lastSeenPrivacy: 'all',
        lastSeenSelectedContacts: [],
        onlinePrivacy: 'all',
        onlineSelectedContacts: [],
        theme: 'ocean',
        chatBackground: 'doodle',
        contacts: ['user_alex_1'],
        createdAt: new Date(Date.now() - 3600 * 24 * 8 * 1000),
        updatedAt: new Date(),
      },
      {
        _id: 'user_marcus_3',
        username: 'marcus_tech',
        displayName: 'Marcus Brody',
        email: 'marcus@example.com',
        password: demoPasswordHash,
        bio: 'Distributed systems & WebRTC explorer 🚀',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
        isOnline: false,
        lastSeen: new Date(Date.now() - 1000 * 60 * 45), // 45 mins ago
        lastSeenPrivacy: 'all',
        lastSeenSelectedContacts: [],
        onlinePrivacy: 'all',
        onlineSelectedContacts: [],
        theme: 'forest',
        chatBackground: 'gradient',
        contacts: [],
        createdAt: new Date(Date.now() - 3600 * 24 * 5 * 1000),
        updatedAt: new Date(),
      },
      {
        _id: 'user_elena_4',
        username: 'elena_v',
        displayName: 'Elena Vasquez',
        email: 'elena@example.com',
        password: demoPasswordHash,
        bio: 'Architect, coffee lover & traveler ☕✈️',
        avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
        isOnline: false,
        lastSeen: new Date(Date.now() - 1000 * 60 * 95), // ~1.5 hours ago
        lastSeenPrivacy: 'all',
        lastSeenSelectedContacts: [],
        onlinePrivacy: 'all',
        onlineSelectedContacts: [],
        theme: 'sunset',
        chatBackground: 'default',
        contacts: [],
        createdAt: new Date(Date.now() - 3600 * 24 * 2 * 1000),
        updatedAt: new Date(),
      }
    ];

    demoUsers.forEach(u => {
      this.users.set(u._id!, u as IUser);
    });

    // Seed conversation between Alex and Sarah (accepted contacts)
    const convId = 'conv_alex_sarah';
    this.conversations.set(convId, {
      _id: convId,
      participants: ['user_alex_1', 'user_sarah_2'],
      unreadCounts: { user_alex_1: 0, user_sarah_2: 0 },
      customBackground: 'default',
      createdAt: new Date(Date.now() - 3600 * 24 * 2 * 1000),
      updatedAt: new Date(Date.now() - 1000 * 60 * 12),
    });

    const m1: IMessage = {
      _id: 'msg_1',
      conversationId: convId,
      sender: 'user_sarah_2',
      receiver: 'user_alex_1',
      text: 'Hey Alex! Have you tested the WebRTC video calling pipeline?',
      reactions: [{ userId: 'user_alex_1', emoji: '🔥' }],
      status: 'read',
      isEdited: false,
      isForwarded: false,
      deletedFor: [],
      isDeletedForEveryone: false,
      createdAt: new Date(Date.now() - 1000 * 60 * 30),
      updatedAt: new Date(Date.now() - 1000 * 60 * 30),
    };

    const m2: IMessage = {
      _id: 'msg_2',
      conversationId: convId,
      sender: 'user_alex_1',
      receiver: 'user_sarah_2',
      text: 'Yes! Socket.io signaling and STUN servers are working seamlessly with audio/video toggle.',
      reactions: [{ userId: 'user_sarah_2', emoji: '❤️' }],
      status: 'read',
      isEdited: false,
      isForwarded: false,
      deletedFor: [],
      isDeletedForEveryone: false,
      createdAt: new Date(Date.now() - 1000 * 60 * 15),
      updatedAt: new Date(Date.now() - 1000 * 60 * 15),
    };

    this.messages.set(m1._id, m1);
    this.messages.set(m2._id, m2);

    // Seed call history events between Alex and Sarah
    const call1Id = 'call_seed_1';
    const c1: ICallHistory = {
      _id: call1Id,
      callerId: 'user_alex_1',
      receiverId: 'user_sarah_2',
      callType: 'video',
      status: 'accepted',
      duration: 184, // 3m 4s
      createdAt: new Date(Date.now() - 1000 * 60 * 10),
    };
    this.callHistories.set(call1Id, c1);

    const callMsg1: IMessage = {
      _id: 'callmsg_1',
      conversationId: convId,
      sender: 'user_alex_1',
      receiver: 'user_sarah_2',
      text: 'Video call • Accepted (3m 04s)',
      callInfo: {
        callId: call1Id,
        callType: 'video',
        status: 'accepted',
        duration: 184,
        callerId: 'user_alex_1',
        receiverId: 'user_sarah_2',
      },
      reactions: [],
      status: 'read',
      isEdited: false,
      isForwarded: false,
      deletedFor: [],
      isDeletedForEveryone: false,
      createdAt: new Date(Date.now() - 1000 * 60 * 10),
      updatedAt: new Date(Date.now() - 1000 * 60 * 10),
    };
    this.messages.set(callMsg1._id, callMsg1);

    const call2Id = 'call_seed_2';
    const c2: ICallHistory = {
      _id: call2Id,
      callerId: 'user_sarah_2',
      receiverId: 'user_alex_1',
      callType: 'audio',
      status: 'rejected',
      duration: 0,
      createdAt: new Date(Date.now() - 1000 * 60 * 7),
    };
    this.callHistories.set(call2Id, c2);

    const callMsg2: IMessage = {
      _id: 'callmsg_2',
      conversationId: convId,
      sender: 'user_sarah_2',
      receiver: 'user_alex_1',
      text: 'Voice call • Rejected',
      callInfo: {
        callId: call2Id,
        callType: 'audio',
        status: 'rejected',
        duration: 0,
        callerId: 'user_sarah_2',
        receiverId: 'user_alex_1',
      },
      reactions: [],
      status: 'read',
      isEdited: false,
      isForwarded: false,
      deletedFor: [],
      isDeletedForEveryone: false,
      createdAt: new Date(Date.now() - 1000 * 60 * 7),
      updatedAt: new Date(Date.now() - 1000 * 60 * 7),
    };
    this.messages.set(callMsg2._id, callMsg2);

    const call3Id = 'call_seed_3';
    const c3: ICallHistory = {
      _id: call3Id,
      callerId: 'user_sarah_2',
      receiverId: 'user_alex_1',
      callType: 'video',
      status: 'not_accepted',
      duration: 0,
      createdAt: new Date(Date.now() - 1000 * 60 * 2),
    };
    this.callHistories.set(call3Id, c3);

    const callMsg3: IMessage = {
      _id: 'callmsg_3',
      conversationId: convId,
      sender: 'user_sarah_2',
      receiver: 'user_alex_1',
      text: 'Video call • Not accepted (Missed)',
      callInfo: {
        callId: call3Id,
        callType: 'video',
        status: 'not_accepted',
        duration: 0,
        callerId: 'user_sarah_2',
        receiverId: 'user_alex_1',
      },
      reactions: [],
      status: 'read',
      isEdited: false,
      isForwarded: false,
      deletedFor: [],
      isDeletedForEveryone: false,
      createdAt: new Date(Date.now() - 1000 * 60 * 2),
      updatedAt: new Date(Date.now() - 1000 * 60 * 2),
    };
    this.messages.set(callMsg3._id, callMsg3);

    const conv = this.conversations.get(convId);
    if (conv) {
      conv.lastMessage = callMsg3._id;
      conv.updatedAt = new Date(Date.now() - 1000 * 60 * 2);
    }

    // Seed self conversation for Alex Rivers ("Message yourself")
    const selfConvId = 'conv_self_user_alex_1';
    this.conversations.set(selfConvId, {
      _id: selfConvId,
      isSelf: true,
      name: 'Message yourself',
      participants: ['user_alex_1'],
      unreadCounts: { user_alex_1: 0 },
      customBackground: 'default',
      createdAt: new Date(Date.now() - 3600 * 24 * 5 * 1000),
      updatedAt: new Date(Date.now() - 1000 * 60 * 60),
    });

    const selfMsg1: IMessage = {
      _id: 'msg_self_1',
      conversationId: selfConvId,
      sender: 'user_alex_1',
      receiver: 'user_alex_1',
      text: '📌 Project Roadmap: Finish WebRTC video calls, group chats with 100 members limit, and self chat notes.',
      reactions: [{ userId: 'user_alex_1', emoji: '🚀' }],
      status: 'read',
      isEdited: false,
      isForwarded: false,
      deletedFor: [],
      isDeletedForEveryone: false,
      createdAt: new Date(Date.now() - 1000 * 60 * 60),
      updatedAt: new Date(Date.now() - 1000 * 60 * 60),
    };
    this.messages.set(selfMsg1._id, selfMsg1);
    const selfConv = this.conversations.get(selfConvId);
    if (selfConv) selfConv.lastMessage = selfMsg1._id;

    // Seed a Group conversation: "Nexus Engineering Core (Max 100 Members)"
    const groupId = 'group_nexus_core';
    this.conversations.set(groupId, {
      _id: groupId,
      isGroup: true,
      name: 'Nexus Engineering Core',
      description: 'Official collaboration channel for core developers. Limit 100 members.',
      avatar: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=150&auto=format&fit=crop&q=80',
      adminIds: ['user_alex_1'],
      participants: ['user_alex_1', 'user_sarah_2', 'user_elena_4'],
      unreadCounts: { user_alex_1: 0, user_sarah_2: 0, user_elena_4: 1 },
      customBackground: 'default',
      createdAt: new Date(Date.now() - 3600 * 24 * 3 * 1000),
      updatedAt: new Date(Date.now() - 1000 * 60 * 5),
    });

    const gm1: IMessage = {
      _id: 'msg_group_1',
      conversationId: groupId,
      sender: 'user_alex_1',
      text: 'Welcome everyone to the Nexus Engineering Core group! Group chats support up to 100 members.',
      reactions: [{ userId: 'user_sarah_2', emoji: '🎉' }, { userId: 'user_elena_4', emoji: '🚀' }],
      status: 'read',
      isEdited: false,
      isForwarded: false,
      deletedFor: [],
      isDeletedForEveryone: false,
      createdAt: new Date(Date.now() - 1000 * 60 * 60),
      updatedAt: new Date(Date.now() - 1000 * 60 * 60),
    };

    const gm2: IMessage = {
      _id: 'msg_group_2',
      conversationId: groupId,
      sender: 'user_sarah_2',
      text: 'Awesome! Glad to be here. Group messaging and live broadcasts are super smooth.',
      reactions: [{ userId: 'user_alex_1', emoji: '🙌' }],
      status: 'read',
      isEdited: false,
      isForwarded: false,
      deletedFor: [],
      isDeletedForEveryone: false,
      createdAt: new Date(Date.now() - 1000 * 60 * 5),
      updatedAt: new Date(Date.now() - 1000 * 60 * 5),
    };

    this.messages.set(gm1._id, gm1);
    this.messages.set(gm2._id, gm2);
    const groupConv = this.conversations.get(groupId);
    if (groupConv) groupConv.lastMessage = gm2._id;

    // Seed a pending Message Request from Marcus to Alex with an introductory message!
    const req1: IFriendRequest = {
      _id: 'req_marcus_alex',
      sender: 'user_marcus_3',
      receiver: 'user_alex_1',
      introMessage: 'Hi Alex! I came across your MERN real-time projects and would love to collaborate.',
      status: 'pending',
      createdAt: new Date(Date.now() - 1000 * 60 * 120),
      updatedAt: new Date(Date.now() - 1000 * 60 * 120),
    };
    this.friendRequests.set(req1._id, req1);

    // Seed 24h stories
    const s1: IStory = {
      _id: 'story_sarah_1',
      userId: 'user_sarah_2',
      mediaType: 'image',
      mediaUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80',
      textContent: 'New generative art drop tonight! 🎨✨',
      visibility: 'contacts',
      views: [
        {
          userId: 'user_alex_1',
          username: 'alex_dev',
          avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
          viewedAt: new Date(Date.now() - 1000 * 60 * 45),
        }
      ],
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 20), // expires in 20 hours
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 4),
    };

    const s2: IStory = {
      _id: 'story_marcus_1',
      userId: 'user_marcus_3',
      mediaType: 'text',
      textContent: '🚀 Building scalable WebRTC infrastructure with Socket.io! What an exciting journey.',
      backgroundGradient: 'from-blue-600 via-indigo-600 to-purple-700',
      textColor: '#ffffff',
      visibility: 'contacts',
      views: [],
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 18),
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6),
    };

    this.stories.set(s1._id, s1);
    this.stories.set(s2._id, s2);
  }
}

export const dbStore = new MemoryDataStore();

export async function connectDB() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.log('⚡ [DB] No MONGO_URI provided in environment. Running in ultra-fast embedded MERN store mode.');
    return;
  }

  try {
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log('✅ [MongoDB] Connected successfully to remote MongoDB cluster.');
  } catch (err) {
    console.warn('⚠️ [MongoDB] Could not connect to remote MongoDB URI, falling back to embedded store:', err);
  }
}
