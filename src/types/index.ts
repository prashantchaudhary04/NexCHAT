export type PrivacyOption = 'all' | 'contacts' | 'selected' | 'nobody';

export interface User {
  _id: string;
  username: string;
  email: string;
  displayName: string;
  avatar: string;
  bio: string;
  age?: number;
  gender?: string;
  isOnline: boolean;
  lastSeen: string;
  theme: string;
  chatBackground: string;
  contacts?: string[];
  lastSeenPrivacy?: PrivacyOption;
  lastSeenSelectedContacts?: string[];
  onlinePrivacy?: PrivacyOption;
  onlineSelectedContacts?: string[];
  relationship?: 'contact' | 'request_sent' | 'request_received' | 'none';
  conversationId?: string | null;
}

export interface FriendRequest {
  _id: string;
  sender: User | string;
  receiver: User | string;
  introMessage?: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
  updatedAt: string;
}

export interface Reaction {
  userId: string;
  emoji: string;
}

export interface CallInfo {
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

export interface Message {
  _id: string;
  conversationId: string;
  sender: string;
  senderName?: string;
  senderAvatar?: string;
  receiver?: string;
  text: string;
  callInfo?: CallInfo;
  fileType?: 'image' | 'video' | 'audio' | 'document' | 'other';
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  replyTo?: {
    messageId: string;
    text: string;
    senderName: string;
  };
  reactions: Reaction[];
  status: 'sent' | 'delivered' | 'read';
  isEdited: boolean;
  isForwarded: boolean;
  deletedFor: string[];
  isDeletedForEveryone: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Conversation {
  _id: string;
  isSelf?: boolean;
  isGroup?: boolean;
  name?: string;
  avatar?: string;
  description?: string;
  adminIds?: string[];
  participants: string[];
  participantDetails?: User[];
  isContact: boolean;
  customBackground?: string;
  backgroundTheme?: string;
  unreadCount: number;
  updatedAt: string;
  otherUser?: User | null;
  lastMessage?: {
    _id: string;
    text: string;
    sender: string;
    senderName?: string;
    fileType?: string;
    fileName?: string;
    callInfo?: CallInfo;
    status: 'sent' | 'delivered' | 'read';
    createdAt: string;
  } | null;
}

export interface StoryView {
  userId: string;
  username: string;
  avatar: string;
  viewedAt: string;
}

export interface Story {
  _id: string;
  userId: string;
  mediaType: 'image' | 'video' | 'text';
  mediaUrl?: string;
  textContent?: string;
  backgroundGradient?: string;
  textColor?: string;
  visibility: 'contacts' | 'public';
  views: StoryView[];
  expiresAt: string;
  createdAt: string;
}

export interface StoryGroup {
  user: User;
  stories: Story[];
  allViewed: boolean;
  latestStoryTime: string;
}

export interface CallHistory {
  _id: string;
  caller?: User | string;
  receiver?: User | string;
  callerId: string;
  receiverId?: string;
  conversationId?: string;
  isGroup?: boolean;
  groupName?: string;
  participants?: string[];
  callType: 'audio' | 'video';
  status: 'completed' | 'accepted' | 'missed' | 'rejected' | 'busy' | 'not_accepted';
  duration: number;
  createdAt: string;
  isCaller?: boolean;
  otherUser?: User | null;
}

export type CallLog = CallHistory;

export interface AppNotification {
  _id: string;
  recipientId: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  type: 'friend_request' | 'request_accepted' | 'message_request' | 'new_message' | 'story_view' | 'missed_call';
  content: string;
  title?: string;
  body?: string;
  linkId?: string;
  read: boolean;
  createdAt: string;
}

export type TabType = 'chats' | 'requests' | 'contacts' | 'stories' | 'calls';

export type AppTheme = 'light' | 'dark' | 'midnight' | 'ocean' | 'sunset' | 'forest' | 'lavender';
export type ChatBackground = 'default' | 'doodle' | 'dots' | 'gradient' | 'dark_stars' | 'minimal_grid';
