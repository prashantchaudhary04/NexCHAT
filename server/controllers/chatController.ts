import { Response } from 'express';
import crypto from 'crypto';
import { dbStore, IConversation, IMessage, INotification } from '../config/db.js';
import { AuthRequest } from '../middleware/auth.js';
import { getSocketIO, isUserSocketOnline } from '../socket/socketHandler.js';
import { formatCallText } from './callController.js';
import { canViewOnline, canViewLastSeen } from '../utils/privacy.js';

export async function getConversations(req: AuthRequest, res: Response) {
  try {
    const currentUserId = req.user?.id;
    if (!currentUserId) return res.status(401).json({ message: 'Unauthorized' });

    const currentUser = dbStore.users.get(currentUserId);
    const userContacts = new Set(currentUser?.contacts || []);

    // Ensure current user has a self conversation ("Message yourself")
    let hasSelfConv = false;
    for (const c of dbStore.conversations.values()) {
      if ((c.isSelf || c.participants.length === 1) && c.participants.includes(currentUserId)) {
        hasSelfConv = true;
        break;
      }
    }
    if (!hasSelfConv && currentUser) {
      const selfConvId = 'conv_self_' + currentUserId;
      const selfConv: IConversation = {
        _id: selfConvId,
        isSelf: true,
        name: 'Message yourself',
        participants: [currentUserId],
        unreadCounts: { [currentUserId]: 0 },
        customBackground: 'default',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      dbStore.conversations.set(selfConvId, selfConv);
    }

    const convList = [];
    for (const c of dbStore.conversations.values()) {
      if (c.participants.includes(currentUserId)) {
        if (c.isGroup) {
          // Group conversation
          const lastMsg = c.lastMessage ? dbStore.messages.get(c.lastMessage) : null;
          let senderName = '';
          if (lastMsg) {
            const senderUser = dbStore.users.get(lastMsg.sender);
            senderName = senderUser?.displayName || senderUser?.username || '';
          }

          convList.push({
            _id: c._id,
            isGroup: true,
            isSelf: false,
            name: c.name || 'Group Chat',
            avatar: c.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(c.name || 'group')}`,
            description: c.description || '',
            adminIds: c.adminIds || [],
            participants: c.participants,
            isContact: true,
            customBackground: c.customBackground || 'default',
            backgroundTheme: c.customBackground || 'default',
            unreadCount: c.unreadCounts[currentUserId] || 0,
            updatedAt: c.updatedAt,
            otherUser: null,
            lastMessage: lastMsg
              ? {
                  _id: lastMsg._id,
                  text: lastMsg.text,
                  sender: lastMsg.sender,
                  senderName,
                  fileType: lastMsg.fileType,
                  fileName: lastMsg.fileName,
                  status: lastMsg.status,
                  createdAt: lastMsg.createdAt,
                }
              : null,
          });
        } else {
          // 1-on-1 direct or self conversation
          const isSelf = !!c.isSelf || (c.participants.length === 1 && c.participants[0] === currentUserId);
          const otherParticipantId = c.participants.find(id => id !== currentUserId);
          const otherUser = isSelf
            ? currentUser
              ? {
                  _id: currentUser._id,
                  username: currentUser.username,
                  displayName: `${currentUser.displayName} (You)`,
                  avatar: currentUser.avatar,
                  bio: currentUser.bio,
                  isOnline: true,
                  lastSeen: new Date(),
                }
              : null
            : otherParticipantId
            ? dbStore.users.get(otherParticipantId)
            : null;

          // Verify contact status
          const isContact = isSelf ? true : otherParticipantId ? userContacts.has(otherParticipantId) : false;

          // Get last message details
          const lastMsg = c.lastMessage ? dbStore.messages.get(c.lastMessage) : null;

          convList.push({
            _id: c._id,
            isGroup: false,
            isSelf,
            name: isSelf ? 'Message yourself' : undefined,
            avatar: isSelf ? currentUser?.avatar : undefined,
            participants: c.participants,
            isContact,
            customBackground: c.customBackground || 'default',
            backgroundTheme: c.customBackground || 'default',
            unreadCount: isSelf ? 0 : (c.unreadCounts[currentUserId] || 0),
            updatedAt: c.updatedAt,
            otherUser: otherUser
              ? {
                  _id: otherUser._id,
                  username: otherUser.username,
                  displayName: otherUser.displayName,
                  avatar: otherUser.avatar,
                  bio: otherUser.bio,
                  isOnline: isSelf
                    ? true
                    : canViewOnline(otherUser as any, currentUserId)
                    ? isUserSocketOnline(otherUser._id)
                    : false,
                  lastSeen: isSelf
                    ? otherUser.lastSeen
                    : canViewLastSeen(otherUser as any, currentUserId)
                    ? otherUser.lastSeen
                    : null,
                }
              : null,
            lastMessage: lastMsg
              ? {
                  _id: lastMsg._id,
                  text: lastMsg.text,
                  sender: lastMsg.sender,
                  fileType: lastMsg.fileType,
                  fileName: lastMsg.fileName,
                  status: lastMsg.status,
                  createdAt: lastMsg.createdAt,
                }
              : null,
          });
        }
      }
    }

    // Sort by latest message/update
    convList.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    return res.json({ conversations: convList });
  } catch (error) {
    console.error('getConversations error:', error);
    return res.status(500).json({ message: 'Failed to fetch conversations' });
  }
}

export async function getMessages(req: AuthRequest, res: Response) {
  try {
    const currentUserId = req.user?.id;
    const { conversationId } = req.params;

    if (!currentUserId) return res.status(401).json({ message: 'Unauthorized' });

    const conv = dbStore.conversations.get(conversationId);
    if (!conv || !conv.participants.includes(currentUserId)) {
      return res.status(404).json({ message: 'Conversation not found or access denied' });
    }

    const messagesList: IMessage[] = [];
    for (const m of dbStore.messages.values()) {
      if (m.conversationId === conversationId) {
        // Skip if deleted for this user
        if (m.deletedFor?.includes(currentUserId)) continue;

        messagesList.push(m);
      }
    }

    // Sort chronologically
    messagesList.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    // Mark messages sent by others as read
    let markedCount = 0;
    messagesList.forEach(m => {
      if (m.sender !== currentUserId && m.status !== 'read') {
        m.status = 'read';
        markedCount++;
      }
    });

    if (markedCount > 0) {
      conv.unreadCounts[currentUserId] = 0;
      dbStore.conversations.set(conv._id, conv);

      const io = getSocketIO();
      if (io) {
        io.to(`conv:${conversationId}`).emit('messages:read', {
          conversationId,
          readBy: currentUserId,
        });
      }
    }

    const isGroup = !!conv.isGroup;
    const isSelf = !!conv.isSelf || (conv.participants.length === 1 && conv.participants[0] === currentUserId);
    let otherUser = null;
    let isContact = true;

    // Deduplicate any existing call messages in messagesList
    const deduplicatedList: IMessage[] = [];
    const seenMsgIds = new Set<string>();

    for (const msg of messagesList) {
      if (seenMsgIds.has(msg._id)) continue;

      const callInfo = msg.callInfo;
      if (callInfo) {
        const isDuplicateCall = deduplicatedList.some(prev => {
          if (!prev.callInfo) return false;
          if (prev.callInfo.callId && callInfo.callId && prev.callInfo.callId === callInfo.callId) return true;
          const sameCaller = prev.sender === msg.sender;
          const sameType = prev.callInfo.callType === callInfo.callType;
          const timeDiff = Math.abs(new Date(prev.createdAt).getTime() - new Date(msg.createdAt).getTime());
          return sameCaller && sameType && timeDiff < 15000;
        });

        if (isDuplicateCall) {
          // Permanently purge duplicate from in-memory store so it never returns
          dbStore.messages.delete(msg._id);
          continue;
        }
      }

      seenMsgIds.add(msg._id);
      deduplicatedList.push(msg);
    }

    deduplicatedList.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    const populatedMessages = deduplicatedList.map(msg => {
      if (!msg.senderName) {
        const u = dbStore.users.get(msg.sender);
        return {
          ...msg,
          senderName: u?.displayName || u?.username || 'Member',
          senderAvatar: u?.avatar || '',
        };
      }
      return msg;
    });

    const participantDetails = conv.participants.map(id => {
      const u = dbStore.users.get(id);
      if (!u) return null;
      const isOnlineAllowed = canViewOnline(u, currentUserId);
      const isLastSeenAllowed = canViewLastSeen(u, currentUserId);
      return {
        _id: u._id,
        username: u.username,
        displayName: u.displayName,
        avatar: u.avatar,
        bio: u.bio,
        isOnline: isOnlineAllowed ? isUserSocketOnline(u._id) : false,
        lastSeen: isLastSeenAllowed ? u.lastSeen : null,
      };
    }).filter(Boolean);

    const currentUser = dbStore.users.get(currentUserId);

    if (isSelf) {
      otherUser = currentUser
        ? {
            _id: currentUser._id,
            username: currentUser.username,
            displayName: `${currentUser.displayName} (You)`,
            avatar: currentUser.avatar,
            bio: currentUser.bio,
            isOnline: true,
            lastSeen: new Date(),
          }
        : null;
      isContact = true;
    } else if (!isGroup) {
      const otherParticipantId = conv.participants.find(id => id !== currentUserId);
      otherUser = otherParticipantId ? dbStore.users.get(otherParticipantId) : null;
      isContact = otherParticipantId ? (currentUser?.contacts || []).includes(otherParticipantId) : false;
    }

    return res.json({
      messages: populatedMessages,
      conversation: {
        _id: conv._id,
        isGroup: conv.isGroup || false,
        isSelf,
        name: isSelf ? 'Message yourself' : conv.name,
        avatar: isSelf ? currentUser?.avatar : conv.avatar,
        description: isSelf ? 'Saved messages, notes and media' : conv.description,
        adminIds: conv.adminIds || [],
        participants: conv.participants,
        participantDetails,
        customBackground: conv.customBackground,
        backgroundTheme: conv.customBackground || 'default',
        unreadCount: isSelf ? 0 : (conv.unreadCounts[currentUserId] || 0),
        updatedAt: conv.updatedAt,
      },
      otherUser: otherUser
        ? {
            _id: otherUser._id,
            username: otherUser.username,
            displayName: otherUser.displayName,
            avatar: otherUser.avatar,
            bio: otherUser.bio,
            isOnline: isSelf
              ? true
              : (canViewOnline(otherUser as any, currentUserId) ? isUserSocketOnline(otherUser._id) : false),
            lastSeen: isSelf
              ? new Date()
              : (canViewLastSeen(otherUser as any, currentUserId) ? otherUser.lastSeen : null),
          }
        : null,
      isContact,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch messages' });
  }
}

export async function sendMessage(req: AuthRequest, res: Response) {
  try {
    const senderId = req.user?.id;
    const { conversationId } = req.params;
    const { text, fileType, fileUrl, fileName, fileSize, replyTo } = req.body;

    if (!senderId) return res.status(401).json({ message: 'Unauthorized' });

    const conv = dbStore.conversations.get(conversationId);
    if (!conv || !conv.participants.includes(senderId)) {
      return res.status(404).json({ message: 'Conversation not found or access denied' });
    }

    const isGroup = !!conv.isGroup;
    const isSelf = !!conv.isSelf || (conv.participants.length === 1 && conv.participants[0] === senderId);

    if (!isGroup && !isSelf) {
      const otherParticipantId = conv.participants.find(id => id !== senderId);
      if (!otherParticipantId) {
        return res.status(400).json({ message: 'Invalid conversation participants' });
      }

      // BACKEND PERMISSION ENFORCEMENT for 1-on-1:
      // User can only send normal messages if they are accepted contacts!
      const sender = dbStore.users.get(senderId);
      if (!sender?.contacts?.includes(otherParticipantId)) {
        return res.status(403).json({
          message: 'Permission Denied: You must be accepted contacts to send messages. Send a contact request first!',
        });
      }
    }

    if (!text && !fileUrl) {
      return res.status(400).json({ message: 'Message content or file attachment is required' });
    }

    const otherParticipantId = !isGroup && !isSelf ? conv.participants.find(id => id !== senderId) : undefined;
    const otherUser = otherParticipantId ? dbStore.users.get(otherParticipantId) : null;
    const initialStatus = isSelf ? 'read' : isGroup ? 'sent' : (otherUser?.isOnline ? 'delivered' : 'sent');

    const sender = dbStore.users.get(senderId);
    const senderDisplayName = sender?.displayName || sender?.username || 'User';

    const newMessage: IMessage = {
      _id: 'msg_' + crypto.randomUUID(),
      conversationId,
      sender: senderId,
      senderName: senderDisplayName,
      senderAvatar: sender?.avatar || '',
      receiver: isSelf ? senderId : otherParticipantId,
      text: text ? String(text).trim() : '',
      fileType: fileType || undefined,
      fileUrl: fileUrl || undefined,
      fileName: fileName || undefined,
      fileSize: fileSize || undefined,
      replyTo: replyTo || undefined,
      reactions: [],
      status: initialStatus,
      isEdited: false,
      isForwarded: false,
      deletedFor: [],
      isDeletedForEveryone: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    dbStore.messages.set(newMessage._id, newMessage);

    // Update conversation
    conv.lastMessage = newMessage._id;
    conv.updatedAt = new Date();

    const io = getSocketIO();
    if (io) {
      // Emit to conversation room
      io.to(`conv:${conversationId}`).emit('message:new', newMessage);
      io.to(`conv:${conversationId}`).emit('message:received', newMessage);

      // Also ensure all participants receive real-time message event in their personal socket room
      conv.participants.forEach(pid => {
        io.to(`user:${pid}`).emit('message:new', newMessage);
        io.to(`user:${pid}`).emit('message:received', newMessage);
      });

      if (isSelf) {
        io.to(`user:${senderId}`).emit('conversation:updated', {
          conversationId,
          lastMessage: newMessage,
          unreadCount: 0,
        });
      }
    }

    // Update unread counts and dispatch notifications for all other members (not for self)
    if (!isSelf) {
      conv.participants.forEach(pid => {
        if (pid !== senderId) {
          conv.unreadCounts[pid] = (conv.unreadCounts[pid] || 0) + 1;

          const notif: INotification = {
            _id: 'notif_' + crypto.randomUUID(),
            recipientId: pid,
            senderId: senderId,
            senderName: isGroup ? `${senderDisplayName} (${conv.name || 'Group'})` : senderDisplayName,
            senderAvatar: sender?.avatar || '',
            type: 'new_message',
            content: newMessage.text ? newMessage.text.slice(0, 80) : `Sent an attachment (${newMessage.fileType || 'file'})`,
            linkId: conversationId,
            read: false,
            createdAt: new Date(),
          };
          dbStore.notifications.set(notif._id, notif);

          if (io) {
            io.to(`user:${pid}`).emit('notification:new', notif);
            io.to(`user:${pid}`).emit('conversation:updated', {
              conversationId,
              lastMessage: newMessage,
              unreadCount: conv.unreadCounts[pid],
            });
            // Also emit message:new directly to the participant's user room
            io.to(`user:${pid}`).emit('message:new', newMessage);
          }
        }
      });
    }

    dbStore.conversations.set(conv._id, conv);

    return res.status(201).json({ message: newMessage });
  } catch (error) {
    console.error('sendMessage error:', error);
    return res.status(500).json({ message: 'Failed to send message' });
  }
}

export async function editMessage(req: AuthRequest, res: Response) {
  try {
    const currentUserId = req.user?.id;
    const { messageId } = req.params;
    const { newText } = req.body;

    if (!currentUserId) return res.status(401).json({ message: 'Unauthorized' });
    if (!newText || !String(newText).trim()) {
      return res.status(400).json({ message: 'Message text cannot be empty' });
    }

    const message = dbStore.messages.get(messageId);
    if (!message) return res.status(404).json({ message: 'Message not found' });

    if (message.sender !== currentUserId) {
      return res.status(403).json({ message: 'You can only edit your own messages' });
    }

    message.text = String(newText).trim();
    message.isEdited = true;
    message.updatedAt = new Date();
    dbStore.messages.set(message._id, message);

    const io = getSocketIO();
    if (io) {
      io.to(`conv:${message.conversationId}`).emit('message:updated', message);
    }

    return res.json({ message });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to edit message' });
  }
}

export async function deleteMessage(req: AuthRequest, res: Response) {
  try {
    const currentUserId = req.user?.id;
    const { messageId } = req.params;
    const { forEveryone } = req.body;

    if (!currentUserId) return res.status(401).json({ message: 'Unauthorized' });

    const message = dbStore.messages.get(messageId);
    if (!message) return res.status(404).json({ message: 'Message not found' });

    if (forEveryone) {
      if (message.sender !== currentUserId) {
        return res.status(403).json({ message: 'Only sender can delete for everyone' });
      }
      message.isDeletedForEveryone = true;
      message.text = 'This message was deleted';
      message.fileUrl = undefined;
      message.fileType = undefined;
      message.updatedAt = new Date();
      dbStore.messages.set(message._id, message);

      const io = getSocketIO();
      if (io) {
        io.to(`conv:${message.conversationId}`).emit('message:deleted', {
          messageId,
          forEveryone: true,
          message,
        });
      }
    } else {
      // Delete for self
      if (!message.deletedFor.includes(currentUserId)) {
        message.deletedFor.push(currentUserId);
        dbStore.messages.set(message._id, message);
      }
    }

    return res.json({ message: 'Message deleted successfully' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete message' });
  }
}

export async function reactMessage(req: AuthRequest, res: Response) {
  try {
    const currentUserId = req.user?.id;
    const { messageId } = req.params;
    const { emoji } = req.body;

    if (!currentUserId) return res.status(401).json({ message: 'Unauthorized' });
    if (!emoji) return res.status(400).json({ message: 'Emoji is required' });

    const message = dbStore.messages.get(messageId);
    if (!message) return res.status(404).json({ message: 'Message not found' });

    // Toggle reaction or replace existing
    const existingIndex = message.reactions.findIndex(r => r.userId === currentUserId);
    if (existingIndex > -1) {
      if (message.reactions[existingIndex].emoji === emoji) {
        // Remove reaction
        message.reactions.splice(existingIndex, 1);
      } else {
        // Update reaction
        message.reactions[existingIndex].emoji = emoji;
      }
    } else {
      message.reactions.push({ userId: currentUserId, emoji });
    }

    message.updatedAt = new Date();
    dbStore.messages.set(message._id, message);

    const io = getSocketIO();
    if (io) {
      io.to(`conv:${message.conversationId}`).emit('message:reaction', {
        messageId,
        reactions: message.reactions,
      });
    }

    return res.json({ reactions: message.reactions });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to react to message' });
  }
}

export async function forwardMessage(req: AuthRequest, res: Response) {
  try {
    const currentUserId = req.user?.id;
    const { messageId, targetConversationId } = req.body;

    if (!currentUserId) return res.status(401).json({ message: 'Unauthorized' });

    const originalMessage = dbStore.messages.get(messageId);
    if (!originalMessage) return res.status(404).json({ message: 'Original message not found' });

    const targetConv = dbStore.conversations.get(targetConversationId);
    if (!targetConv || !targetConv.participants.includes(currentUserId)) {
      return res.status(404).json({ message: 'Target conversation not found or access denied' });
    }

    const otherParticipantId = targetConv.participants.find(id => id !== currentUserId);
    const currentUser = dbStore.users.get(currentUserId);
    if (otherParticipantId && !currentUser?.contacts?.includes(otherParticipantId)) {
      return res.status(403).json({ message: 'Can only forward to accepted contacts' });
    }

    const forwardedMsg: IMessage = {
      _id: 'msg_' + crypto.randomUUID(),
      conversationId: targetConversationId,
      sender: currentUserId,
      receiver: otherParticipantId,
      text: originalMessage.text,
      fileType: originalMessage.fileType,
      fileUrl: originalMessage.fileUrl,
      fileName: originalMessage.fileName,
      fileSize: originalMessage.fileSize,
      reactions: [],
      status: 'sent',
      isEdited: false,
      isForwarded: true,
      deletedFor: [],
      isDeletedForEveryone: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    dbStore.messages.set(forwardedMsg._id, forwardedMsg);

    targetConv.lastMessage = forwardedMsg._id;
    targetConv.updatedAt = new Date();
    if (otherParticipantId) {
      targetConv.unreadCounts[otherParticipantId] = (targetConv.unreadCounts[otherParticipantId] || 0) + 1;
    }
    dbStore.conversations.set(targetConv._id, targetConv);

    const io = getSocketIO();
    if (io) {
      io.to(`conv:${targetConversationId}`).emit('message:new', forwardedMsg);
      if (otherParticipantId) {
        io.to(`user:${otherParticipantId}`).emit('conversation:updated', {
          conversationId: targetConversationId,
          lastMessage: forwardedMsg,
          unreadCount: targetConv.unreadCounts[otherParticipantId],
        });
      }
    }

    return res.status(201).json({ message: forwardedMsg });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to forward message' });
  }
}

export async function setChatBackground(req: AuthRequest, res: Response) {
  try {
    const currentUserId = req.user?.id;
    const { conversationId } = req.params;
    const { background } = req.body;

    if (!currentUserId) return res.status(401).json({ message: 'Unauthorized' });

    const conv = dbStore.conversations.get(conversationId);
    if (!conv || !conv.participants.includes(currentUserId)) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    conv.customBackground = background || 'default';
    dbStore.conversations.set(conv._id, conv);

    return res.json({ message: 'Background updated', background: conv.customBackground });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update background' });
  }
}

/**
 * Create a new Group chat (with max 100 members limit)
 */
export async function createGroup(req: AuthRequest, res: Response) {
  try {
    const creatorId = req.user?.id;
    if (!creatorId) return res.status(401).json({ message: 'Unauthorized' });

    const { name, description, avatar, memberIds = [] } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: 'Group name is required' });
    }

    // Deduplicate and include the group creator
    const rawMembers = Array.isArray(memberIds) ? memberIds : [];
    const uniqueMembers = Array.from(new Set([creatorId, ...rawMembers.map(String)]));

    // STRICT USER REQUIREMENT: Groups limited to 100 members max!
    const MAX_GROUP_MEMBERS = 100;
    if (uniqueMembers.length > MAX_GROUP_MEMBERS) {
      return res.status(400).json({
        message: `Group limit reached. A group can have at most ${MAX_GROUP_MEMBERS} members (attempted: ${uniqueMembers.length}).`,
      });
    }

    const groupId = 'group_' + crypto.randomUUID();
    const groupName = String(name).trim();
    const groupAvatar =
      avatar && String(avatar).trim()
        ? String(avatar).trim()
        : `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(groupName)}`;

    const unreadCounts: Record<string, number> = {};
    uniqueMembers.forEach(id => {
      unreadCounts[id] = 0;
    });

    const newGroup: IConversation = {
      _id: groupId,
      isGroup: true,
      name: groupName,
      description: description ? String(description).trim() : '',
      avatar: groupAvatar,
      adminIds: [creatorId],
      participants: uniqueMembers,
      unreadCounts,
      customBackground: 'default',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    dbStore.conversations.set(groupId, newGroup);

    // Create system welcome message
    const creator = dbStore.users.get(creatorId);
    const creatorName = creator?.displayName || creator?.username || 'Admin';
    const welcomeMsg: IMessage = {
      _id: 'msg_' + crypto.randomUUID(),
      conversationId: groupId,
      sender: creatorId,
      text: `${creatorName} created group "${groupName}" with ${uniqueMembers.length} member${uniqueMembers.length === 1 ? '' : 's'}.`,
      reactions: [],
      status: 'read',
      isEdited: false,
      isForwarded: false,
      deletedFor: [],
      isDeletedForEveryone: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    dbStore.messages.set(welcomeMsg._id, welcomeMsg);
    newGroup.lastMessage = welcomeMsg._id;
    dbStore.conversations.set(groupId, newGroup);

    // Real-time broadcast to all participants
    const io = getSocketIO();
    if (io) {
      uniqueMembers.forEach(uid => {
        io.to(`user:${uid}`).emit('conversation:created', {
          conversation: newGroup,
          lastMessage: welcomeMsg,
        });
      });
    }

    return res.status(201).json({
      message: 'Group created successfully',
      group: newGroup,
    });
  } catch (error) {
    console.error('createGroup error:', error);
    return res.status(500).json({ message: 'Failed to create group' });
  }
}

/**
 * Add members to an existing group (strict 100 members limit)
 */
export async function addGroupMembers(req: AuthRequest, res: Response) {
  try {
    const currentUserId = req.user?.id;
    const { groupId } = req.params;
    const { memberIds = [] } = req.body;

    if (!currentUserId) return res.status(401).json({ message: 'Unauthorized' });

    const group = dbStore.conversations.get(groupId);
    if (!group || !group.isGroup) {
      return res.status(404).json({ message: 'Group not found' });
    }

    if (!group.participants.includes(currentUserId)) {
      return res.status(403).json({ message: 'Only current members can add people' });
    }

    const MAX_GROUP_MEMBERS = 100;
    const toAdd = (Array.isArray(memberIds) ? memberIds : []).filter(
      id => !group.participants.includes(id)
    );

    if (toAdd.length === 0) {
      return res.status(400).json({ message: 'No new members to add' });
    }

    if (group.participants.length + toAdd.length > MAX_GROUP_MEMBERS) {
      return res.status(400).json({
        message: `Adding ${toAdd.length} member(s) would exceed the group limit of ${MAX_GROUP_MEMBERS} (current: ${group.participants.length}).`,
      });
    }

    group.participants.push(...toAdd);
    toAdd.forEach(id => {
      group.unreadCounts[id] = 0;
    });
    group.updatedAt = new Date();

    const adder = dbStore.users.get(currentUserId);
    const adderName = adder?.displayName || adder?.username || 'A member';
    const systemMsg: IMessage = {
      _id: 'msg_' + crypto.randomUUID(),
      conversationId: groupId,
      sender: currentUserId,
      text: `${adderName} added ${toAdd.length} new member${toAdd.length === 1 ? '' : 's'}.`,
      reactions: [],
      status: 'read',
      isEdited: false,
      isForwarded: false,
      deletedFor: [],
      isDeletedForEveryone: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    dbStore.messages.set(systemMsg._id, systemMsg);
    group.lastMessage = systemMsg._id;
    dbStore.conversations.set(group._id, group);

    const io = getSocketIO();
    if (io) {
      io.to(`conv:${groupId}`).emit('message:new', systemMsg);
      group.participants.forEach(uid => {
        io.to(`user:${uid}`).emit('conversation:updated', {
          conversationId: groupId,
          lastMessage: systemMsg,
          unreadCount: group.unreadCounts[uid],
        });
      });
    }

    return res.json({
      message: 'Members added successfully',
      participantsCount: group.participants.length,
      group,
    });
  } catch (error) {
    console.error('addGroupMembers error:', error);
    return res.status(500).json({ message: 'Failed to add group members' });
  }
}

/**
 * Leave a group
 */
export async function leaveGroup(req: AuthRequest, res: Response) {
  try {
    const currentUserId = req.user?.id;
    const { groupId } = req.params;

    if (!currentUserId) return res.status(401).json({ message: 'Unauthorized' });

    const group = dbStore.conversations.get(groupId);
    if (!group || !group.isGroup) {
      return res.status(404).json({ message: 'Group not found' });
    }

    if (!group.participants.includes(currentUserId)) {
      return res.status(400).json({ message: 'You are not a member of this group' });
    }

    group.participants = group.participants.filter(id => id !== currentUserId);
    group.adminIds = (group.adminIds || []).filter(id => id !== currentUserId);
    delete group.unreadCounts[currentUserId];

    const leaver = dbStore.users.get(currentUserId);
    const leaverName = leaver?.displayName || leaver?.username || 'A member';

    if (group.participants.length === 0) {
      dbStore.conversations.delete(groupId);
    } else {
      // If no admins left, promote first participant
      if ((group.adminIds || []).length === 0 && group.participants.length > 0) {
        group.adminIds = [group.participants[0]];
      }

      const systemMsg: IMessage = {
        _id: 'msg_' + crypto.randomUUID(),
        conversationId: groupId,
        sender: currentUserId,
        text: `${leaverName} left the group.`,
        reactions: [],
        status: 'read',
        isEdited: false,
        isForwarded: false,
        deletedFor: [],
        isDeletedForEveryone: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      dbStore.messages.set(systemMsg._id, systemMsg);
      group.lastMessage = systemMsg._id;
      group.updatedAt = new Date();
      dbStore.conversations.set(group._id, group);

      const io = getSocketIO();
      if (io) {
        io.to(`conv:${groupId}`).emit('message:new', systemMsg);
      }
    }

    return res.json({ message: 'Left group successfully' });
  } catch (error) {
    console.error('leaveGroup error:', error);
    return res.status(500).json({ message: 'Failed to leave group' });
  }
}

/**
 * Update Group Name / Description / Avatar (Admin or member)
 */
export async function updateGroup(req: AuthRequest, res: Response) {
  try {
    const currentUserId = req.user?.id;
    const { groupId } = req.params;
    const { name, description, avatar } = req.body;

    if (!currentUserId) return res.status(401).json({ message: 'Unauthorized' });

    const group = dbStore.conversations.get(groupId);
    if (!group || !group.isGroup) {
      return res.status(404).json({ message: 'Group not found' });
    }

    if (!group.participants.includes(currentUserId)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (name && String(name).trim()) {
      group.name = String(name).trim();
    }
    if (description !== undefined) {
      group.description = String(description).trim();
    }
    if (avatar && String(avatar).trim()) {
      group.avatar = String(avatar).trim();
    }
    group.updatedAt = new Date();
    dbStore.conversations.set(group._id, group);

    const io = getSocketIO();
    if (io) {
      group.participants.forEach(uid => {
        io.to(`user:${uid}`).emit('conversation:updated', {
          conversationId: groupId,
          conversation: group,
        });
      });
    }

    return res.json({ message: 'Group updated successfully', group });
  } catch (error) {
    console.error('updateGroup error:', error);
    return res.status(500).json({ message: 'Failed to update group' });
  }
}

export async function getOrCreateSelfConversation(req: AuthRequest, res: Response) {
  try {
    const currentUserId = req.user?.id;
    if (!currentUserId) return res.status(401).json({ message: 'Unauthorized' });

    let selfConv: IConversation | undefined;
    for (const c of dbStore.conversations.values()) {
      if ((c.isSelf || c.participants.length === 1) && c.participants.includes(currentUserId)) {
        selfConv = c;
        break;
      }
    }

    const currentUser = dbStore.users.get(currentUserId);

    if (!selfConv) {
      const selfConvId = 'conv_self_' + currentUserId;
      selfConv = {
        _id: selfConvId,
        isSelf: true,
        name: 'Message yourself',
        participants: [currentUserId],
        unreadCounts: { [currentUserId]: 0 },
        customBackground: 'default',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      dbStore.conversations.set(selfConv._id, selfConv);
    }

    const lastMsg = selfConv.lastMessage ? dbStore.messages.get(selfConv.lastMessage) : null;

    const formatted = {
      _id: selfConv._id,
      isSelf: true,
      isGroup: false,
      name: 'Message yourself',
      avatar: currentUser?.avatar,
      participants: selfConv.participants,
      isContact: true,
      customBackground: selfConv.customBackground || 'default',
      backgroundTheme: selfConv.customBackground || 'default',
      unreadCount: 0,
      updatedAt: selfConv.updatedAt,
      otherUser: currentUser
        ? {
            _id: currentUser._id,
            username: currentUser.username,
            displayName: `${currentUser.displayName} (You)`,
            avatar: currentUser.avatar,
            bio: currentUser.bio,
            isOnline: true,
            lastSeen: new Date(),
          }
        : null,
      lastMessage: lastMsg
        ? {
            _id: lastMsg._id,
            text: lastMsg.text,
            sender: lastMsg.sender,
            fileType: lastMsg.fileType,
            fileName: lastMsg.fileName,
            status: lastMsg.status,
            createdAt: lastMsg.createdAt,
          }
        : null,
    };

    return res.json({ conversation: formatted });
  } catch (error) {
    console.error('getOrCreateSelfConversation error:', error);
    return res.status(500).json({ message: 'Failed to access self conversation' });
  }
}

