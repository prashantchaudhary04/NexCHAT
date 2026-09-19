import mongoose, { Schema } from 'mongoose';

// User Schema
const userSchema = new Schema(
  {
    username: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
    email: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    displayName: { type: String, required: true, trim: true },
    avatar: { type: String, default: '' },
    bio: { type: String, default: 'Hey there! I am using MERN Chat.' },
    isOnline: { type: Boolean, default: false, index: true },
    lastSeen: { type: Date, default: Date.now },
    theme: { type: String, default: 'light' },
    chatBackground: { type: String, default: 'default' },
    contacts: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

// Indexes
userSchema.index({ username: 'text', displayName: 'text' });

// Contact / Friend Request Schema
const friendRequestSchema = new Schema(
  {
    sender: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    receiver: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    introMessage: { type: String, default: '', maxLength: 500 },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'],
      default: 'pending',
      index: true,
    },
  },
  { timestamps: true }
);

// Unique compound index so a user cannot send duplicate pending requests to the same person
friendRequestSchema.index({ sender: 1, receiver: 1, status: 1 });

// Conversation Schema
const conversationSchema = new Schema(
  {
    participants: [{ type: Schema.Types.ObjectId, ref: 'User', index: true }],
    lastMessage: { type: Schema.Types.ObjectId, ref: 'Message' },
    unreadCounts: { type: Map, of: Number, default: {} },
    customBackground: { type: String, default: 'default' },
  },
  { timestamps: true }
);

// Message Schema
const messageSchema = new Schema(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
    sender: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    receiver: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    text: { type: String, default: '' },
    fileType: {
      type: String,
      enum: ['image', 'video', 'audio', 'document', 'other'],
    },
    fileUrl: { type: String },
    fileName: { type: String },
    fileSize: { type: Number },
    replyTo: {
      messageId: { type: Schema.Types.ObjectId, ref: 'Message' },
      text: { type: String },
      senderName: { type: String },
    },
    reactions: [
      {
        userId: { type: Schema.Types.ObjectId, ref: 'User' },
        emoji: { type: String },
      },
    ],
    status: {
      type: String,
      enum: ['sent', 'delivered', 'read'],
      default: 'sent',
      index: true,
    },
    isEdited: { type: Boolean, default: false },
    isForwarded: { type: Boolean, default: false },
    deletedFor: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    isDeletedForEveryone: { type: Boolean, default: false },
  },
  { timestamps: true }
);

messageSchema.index({ conversationId: 1, createdAt: -1 });

// Story / Status Schema
const storyViewSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  username: { type: String, required: true },
  avatar: { type: String },
  viewedAt: { type: Date, default: Date.now },
});

const storySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    mediaType: {
      type: String,
      enum: ['image', 'video', 'text'],
      required: true,
    },
    mediaUrl: { type: String },
    textContent: { type: String, maxLength: 500 },
    backgroundGradient: { type: String, default: 'from-blue-600 via-indigo-600 to-purple-700' },
    textColor: { type: String, default: '#ffffff' },
    visibility: {
      type: String,
      enum: ['contacts', 'public'],
      default: 'contacts',
    },
    views: [storyViewSchema],
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // TTL index for automatic 24-hour expiration in MongoDB
    },
  },
  { timestamps: true }
);

storySchema.index({ userId: 1, createdAt: -1 });

// Call History Schema
const callHistorySchema = new Schema(
  {
    callerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    receiverId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    callType: { type: String, enum: ['audio', 'video'], required: true },
    status: {
      type: String,
      enum: ['completed', 'missed', 'rejected', 'busy'],
      default: 'completed',
    },
    duration: { type: Number, default: 0 }, // in seconds
  },
  { timestamps: true }
);

callHistorySchema.index({ callerId: 1, createdAt: -1 });
callHistorySchema.index({ receiverId: 1, createdAt: -1 });

// Notification Schema
const notificationSchema = new Schema(
  {
    recipientId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    senderName: { type: String, required: true },
    senderAvatar: { type: String, default: '' },
    type: {
      type: String,
      enum: ['friend_request', 'request_accepted', 'message_request', 'new_message', 'story_view', 'missed_call'],
      required: true,
    },
    content: { type: String, required: true },
    linkId: { type: String },
    read: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

export const UserModel = mongoose.models.User || mongoose.model('User', userSchema);
export const FriendRequestModel = mongoose.models.FriendRequest || mongoose.model('FriendRequest', friendRequestSchema);
export const ConversationModel = mongoose.models.Conversation || mongoose.model('Conversation', conversationSchema);
export const MessageModel = mongoose.models.Message || mongoose.model('Message', messageSchema);
export const StoryModel = mongoose.models.Story || mongoose.model('Story', storySchema);
export const CallHistoryModel = mongoose.models.CallHistory || mongoose.model('CallHistory', callHistorySchema);
export const NotificationModel = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);
