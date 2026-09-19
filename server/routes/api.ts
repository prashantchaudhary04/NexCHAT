import express from 'express';
import multer from 'multer';
import { verifyToken, AuthRequest } from '../middleware/auth.js';
import * as authCtrl from '../controllers/authController.js';
import * as contactCtrl from '../controllers/contactController.js';
import * as chatCtrl from '../controllers/chatController.js';
import * as storyCtrl from '../controllers/storyController.js';
import * as callCtrl from '../controllers/callController.js';
import * as uploadCtrl from '../controllers/uploadController.js';
import { dbStore } from '../config/db.js';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max file size
});

// Health check
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date(),
    usersCount: dbStore.users.size,
    conversationsCount: dbStore.conversations.size,
  });
});

// Authentication Routes
router.get('/auth/check-username', authCtrl.checkUsername);
router.post('/auth/register', authCtrl.register);
router.post('/auth/login', authCtrl.login);
router.get('/auth/me', verifyToken, authCtrl.getMe);
router.put('/auth/profile', verifyToken, authCtrl.updateProfile);
router.put('/auth/privacy', verifyToken, authCtrl.updatePrivacy);
router.get('/auth/search', verifyToken, authCtrl.searchUsers);

// Contacts & Request Routes
router.post('/contacts/request', verifyToken, contactCtrl.sendFriendRequest);
router.get('/contacts/requests', verifyToken, contactCtrl.getMessageRequests);
router.get('/contacts/sent-requests', verifyToken, contactCtrl.getSentRequests);
router.post('/contacts/requests/:requestId/accept', verifyToken, contactCtrl.acceptFriendRequest);
router.post('/contacts/requests/:requestId/reject', verifyToken, contactCtrl.rejectFriendRequest);
router.get('/contacts', verifyToken, contactCtrl.getContacts);
router.delete('/contacts/:contactId', verifyToken, contactCtrl.removeContact);

// Chat & Messaging Routes
router.get('/chat/conversations', verifyToken, chatCtrl.getConversations);
router.get('/chat/self', verifyToken, chatCtrl.getOrCreateSelfConversation);
router.get('/chat/conversations/:conversationId/messages', verifyToken, chatCtrl.getMessages);
router.post('/chat/conversations/:conversationId/messages', verifyToken, chatCtrl.sendMessage);
router.put('/chat/messages/:messageId', verifyToken, chatCtrl.editMessage);
router.delete('/chat/messages/:messageId', verifyToken, chatCtrl.deleteMessage);
router.post('/chat/messages/:messageId/react', verifyToken, chatCtrl.reactMessage);
router.post('/chat/messages/forward', verifyToken, chatCtrl.forwardMessage);
router.put('/chat/conversations/:conversationId/background', verifyToken, chatCtrl.setChatBackground);

// Group Chat Routes (Max 100 members limit)
router.post('/chat/groups', verifyToken, chatCtrl.createGroup);
router.put('/chat/groups/:groupId', verifyToken, chatCtrl.updateGroup);
router.post('/chat/groups/:groupId/members', verifyToken, chatCtrl.addGroupMembers);
router.post('/chat/groups/:groupId/leave', verifyToken, chatCtrl.leaveGroup);

// Stories / Status Routes
router.post('/stories', verifyToken, storyCtrl.createStory);
router.get('/stories', verifyToken, storyCtrl.getStories);
router.post('/stories/:storyId/view', verifyToken, storyCtrl.viewStory);
router.delete('/stories/:storyId', verifyToken, storyCtrl.deleteStory);

// Calling Routes
router.post('/calls/log', verifyToken, callCtrl.logCall);
router.get('/calls/history', verifyToken, callCtrl.getCallHistory);

// File & Media Upload
router.post('/upload', verifyToken, upload.single('file'), uploadCtrl.uploadMedia);

// Notification Routes
router.get('/notifications', verifyToken, (req: AuthRequest, res) => {
  const currentUserId = req.user?.id;
  if (!currentUserId) return res.status(401).json({ message: 'Unauthorized' });

  const notifs = [];
  for (const n of dbStore.notifications.values()) {
    if (n.recipientId === currentUserId) {
      notifs.push(n);
    }
  }
  notifs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json({ notifications: notifs.slice(0, 30) });
});

router.put('/notifications/:id/read', verifyToken, (req: AuthRequest, res) => {
  const { id } = req.params;
  const notif = dbStore.notifications.get(id);
  if (notif) {
    notif.read = true;
    dbStore.notifications.set(notif._id, notif);
  }
  res.json({ success: true });
});

router.put('/notifications/mark-all-read', verifyToken, (req: AuthRequest, res) => {
  const currentUserId = req.user?.id;
  for (const n of dbStore.notifications.values()) {
    if (n.recipientId === currentUserId) {
      n.read = true;
      dbStore.notifications.set(n._id, n);
    }
  }
  res.json({ success: true });
});

export default router;
