import { Response } from 'express';
import crypto from 'crypto';
import { dbStore, IFriendRequest, IConversation, IMessage, INotification } from '../config/db.js';
import { AuthRequest } from '../middleware/auth.js';
import { getSocketIO, isUserSocketOnline } from '../socket/socketHandler.js';
import { canViewOnline, canViewLastSeen } from '../utils/privacy.js';

export async function sendFriendRequest(req: AuthRequest, res: Response) {
  try {
    const senderId = req.user?.id;
    if (!senderId) return res.status(401).json({ message: 'Unauthorized' });

    const { receiverId, introMessage } = req.body;
    if (!receiverId) return res.status(400).json({ message: 'Receiver ID is required' });

    if (senderId === receiverId) {
      return res.status(400).json({ message: 'You cannot send a contact request to yourself' });
    }

    const sender = dbStore.users.get(senderId);
    const receiver = dbStore.users.get(receiverId);

    if (!receiver) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if already contacts
    if (sender?.contacts?.includes(receiverId)) {
      return res.status(400).json({ message: 'You are already contacts with this user' });
    }

    // Check if pending request exists
    for (const r of dbStore.friendRequests.values()) {
      if (r.status === 'pending') {
        if (r.sender === senderId && r.receiver === receiverId) {
          return res.status(400).json({ message: 'A pending request has already been sent to this user' });
        }
        if (r.sender === receiverId && r.receiver === senderId) {
          return res.status(400).json({ message: 'This user has already sent you a request! Check your Message Requests.' });
        }
      }
    }

    const cleanIntro = introMessage ? String(introMessage).trim().slice(0, 500) : '';

    const newRequest: IFriendRequest = {
      _id: 'req_' + crypto.randomUUID(),
      sender: senderId,
      receiver: receiverId,
      introMessage: cleanIntro,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    dbStore.friendRequests.set(newRequest._id, newRequest);

    // Create Notification
    const notif: INotification = {
      _id: 'notif_' + crypto.randomUUID(),
      recipientId: receiverId,
      senderId: senderId,
      senderName: sender?.displayName || sender?.username || 'Someone',
      senderAvatar: sender?.avatar || '',
      type: 'message_request',
      content: cleanIntro
        ? `${sender?.displayName || sender?.username} sent you a contact request with message: "${cleanIntro.slice(0, 60)}..."`
        : `${sender?.displayName || sender?.username} sent you a contact request`,
      linkId: newRequest._id,
      read: false,
      createdAt: new Date(),
    };
    dbStore.notifications.set(notif._id, notif);

    // Emit real-time socket event
    const io = getSocketIO();
    if (io) {
      io.to(`user:${receiverId}`).emit('notification:new', notif);
      io.to(`user:${receiverId}`).emit('request:incoming', {
        request: newRequest,
        sender: {
          _id: sender?._id,
          username: sender?.username,
          displayName: sender?.displayName,
          avatar: sender?.avatar,
          bio: sender?.bio,
        },
      });
    }

    return res.status(201).json({
      message: 'Contact request sent successfully',
      request: newRequest,
    });
  } catch (error) {
    console.error('sendFriendRequest error:', error);
    return res.status(500).json({ message: 'Failed to send contact request' });
  }
}

export async function getMessageRequests(req: AuthRequest, res: Response) {
  try {
    const currentUserId = req.user?.id;
    if (!currentUserId) return res.status(401).json({ message: 'Unauthorized' });

    const requests = [];
    for (const r of dbStore.friendRequests.values()) {
      if (r.receiver === currentUserId && r.status === 'pending') {
        const sender = dbStore.users.get(r.sender);
        requests.push({
          ...r,
          sender: sender
            ? {
                _id: sender._id,
                username: sender.username,
                displayName: sender.displayName,
                avatar: sender.avatar,
                bio: sender.bio,
                isOnline: sender.isOnline,
                lastSeen: sender.lastSeen,
              }
            : null,
        });
      }
    }

    // Sort by newest
    requests.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return res.json({ requests });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch message requests' });
  }
}

export async function getSentRequests(req: AuthRequest, res: Response) {
  try {
    const currentUserId = req.user?.id;
    if (!currentUserId) return res.status(401).json({ message: 'Unauthorized' });

    const requests = [];
    for (const r of dbStore.friendRequests.values()) {
      if (r.sender === currentUserId && r.status === 'pending') {
        const receiver = dbStore.users.get(r.receiver);
        requests.push({
          ...r,
          receiver: receiver
            ? {
                _id: receiver._id,
                username: receiver.username,
                displayName: receiver.displayName,
                avatar: receiver.avatar,
              }
            : null,
        });
      }
    }

    return res.json({ requests });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch sent requests' });
  }
}

export async function acceptFriendRequest(req: AuthRequest, res: Response) {
  try {
    const currentUserId = req.user?.id;
    const { requestId } = req.params;

    if (!currentUserId) return res.status(401).json({ message: 'Unauthorized' });

    const request = dbStore.friendRequests.get(requestId);
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    if (request.receiver !== currentUserId) {
      return res.status(403).json({ message: 'You are not authorized to accept this request' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ message: `Request is already ${request.status}` });
    }

    request.status = 'accepted';
    request.updatedAt = new Date();
    dbStore.friendRequests.set(request._id, request);

    // Add both users to each other's contacts
    const receiver = dbStore.users.get(currentUserId);
    const sender = dbStore.users.get(request.sender);

    if (receiver && !receiver.contacts.includes(request.sender)) {
      receiver.contacts.push(request.sender);
      dbStore.users.set(receiver._id, receiver);
    }

    if (sender && !sender.contacts.includes(currentUserId)) {
      sender.contacts.push(currentUserId);
      dbStore.users.set(sender._id, sender);
    }

    // Find or create conversation between them
    let conversation: IConversation | undefined;
    for (const c of dbStore.conversations.values()) {
      if (
        c.participants.includes(currentUserId) &&
        c.participants.includes(request.sender) &&
        c.participants.length === 2
      ) {
        conversation = c;
        break;
      }
    }

    if (!conversation) {
      const convId = 'conv_' + crypto.randomUUID();
      conversation = {
        _id: convId,
        participants: [currentUserId, request.sender],
        unreadCounts: { [currentUserId]: 0, [request.sender]: 0 },
        customBackground: 'default',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      dbStore.conversations.set(convId, conversation);
    }

    // If an intro message was sent, convert it into the first conversation message if not yet present
    if (request.introMessage) {
      const introMsg: IMessage = {
        _id: 'msg_' + crypto.randomUUID(),
        conversationId: conversation._id,
        sender: request.sender,
        receiver: currentUserId,
        text: request.introMessage,
        reactions: [],
        status: 'read',
        isEdited: false,
        isForwarded: false,
        deletedFor: [],
        isDeletedForEveryone: false,
        createdAt: request.createdAt,
        updatedAt: request.createdAt,
      };
      dbStore.messages.set(introMsg._id, introMsg);
      conversation.lastMessage = introMsg._id;
      dbStore.conversations.set(conversation._id, conversation);
    }

    // Create Notification for the sender
    const notif: INotification = {
      _id: 'notif_' + crypto.randomUUID(),
      recipientId: request.sender,
      senderId: currentUserId,
      senderName: receiver?.displayName || receiver?.username || 'User',
      senderAvatar: receiver?.avatar || '',
      type: 'request_accepted',
      content: `${receiver?.displayName || receiver?.username} accepted your contact request! Unlimited messaging and calls are now enabled.`,
      linkId: conversation._id,
      read: false,
      createdAt: new Date(),
    };
    dbStore.notifications.set(notif._id, notif);

    // Notify via Socket
    const io = getSocketIO();
    if (io) {
      io.to(`user:${request.sender}`).emit('notification:new', notif);
      io.to(`user:${request.sender}`).emit('contact:accepted', {
        contact: {
          _id: receiver?._id,
          username: receiver?.username,
          displayName: receiver?.displayName,
          avatar: receiver?.avatar,
          bio: receiver?.bio,
          isOnline: receiver?.isOnline,
          lastSeen: receiver?.lastSeen,
        },
        conversationId: conversation._id,
      });
      io.to(`user:${currentUserId}`).emit('contact:accepted', {
        contact: {
          _id: sender?._id,
          username: sender?.username,
          displayName: sender?.displayName,
          avatar: sender?.avatar,
          bio: sender?.bio,
          isOnline: sender?.isOnline,
          lastSeen: sender?.lastSeen,
        },
        conversationId: conversation._id,
      });
    }

    return res.json({
      message: 'Contact request accepted',
      conversationId: conversation._id,
      request,
    });
  } catch (error) {
    console.error('acceptFriendRequest error:', error);
    return res.status(500).json({ message: 'Failed to accept contact request' });
  }
}

export async function rejectFriendRequest(req: AuthRequest, res: Response) {
  try {
    const currentUserId = req.user?.id;
    const { requestId } = req.params;

    if (!currentUserId) return res.status(401).json({ message: 'Unauthorized' });

    const request = dbStore.friendRequests.get(requestId);
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    if (request.receiver !== currentUserId) {
      return res.status(403).json({ message: 'You are not authorized to reject this request' });
    }

    request.status = 'rejected';
    request.updatedAt = new Date();
    dbStore.friendRequests.set(request._id, request);

    // Notify via Socket
    const io = getSocketIO();
    if (io) {
      io.to(`user:${request.sender}`).emit('contact:rejected', {
        requestId: request._id,
      });
    }

    return res.json({ message: 'Contact request rejected', request });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to reject contact request' });
  }
}

export async function getContacts(req: AuthRequest, res: Response) {
  try {
    const currentUserId = req.user?.id;
    if (!currentUserId) return res.status(401).json({ message: 'Unauthorized' });

    const user = dbStore.users.get(currentUserId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const contactsList = [];
    for (const contactId of user.contacts) {
      const contactUser = dbStore.users.get(contactId);
      if (contactUser) {
        // Find existing conversation if any
        let conversationId: string | null = null;
        for (const c of dbStore.conversations.values()) {
          if (
            c.participants.includes(currentUserId) &&
            c.participants.includes(contactId) &&
            c.participants.length === 2
          ) {
            conversationId = c._id;
            break;
          }
        }

        const isOnlineAllowed = canViewOnline(contactUser, currentUserId);
        const isLastSeenAllowed = canViewLastSeen(contactUser, currentUserId);
        const isActuallyOnline = isUserSocketOnline(contactId);

        const { password: _, ...safeContact } = contactUser;
        contactsList.push({
          ...safeContact,
          isOnline: isOnlineAllowed ? isActuallyOnline : false,
          lastSeen: isLastSeenAllowed ? contactUser.lastSeen : null,
          conversationId,
        });
      }
    }

    return res.json({ contacts: contactsList });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch contacts' });
  }
}

export async function removeContact(req: AuthRequest, res: Response) {
  try {
    const currentUserId = req.user?.id;
    const { contactId } = req.params;

    if (!currentUserId) return res.status(401).json({ message: 'Unauthorized' });

    const user = dbStore.users.get(currentUserId);
    const otherUser = dbStore.users.get(contactId);

    if (user) {
      user.contacts = user.contacts.filter(id => id !== contactId);
      dbStore.users.set(user._id, user);
    }
    if (otherUser) {
      otherUser.contacts = otherUser.contacts.filter(id => id !== currentUserId);
      dbStore.users.set(otherUser._id, otherUser);
    }

    return res.json({ message: 'Contact removed successfully' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to remove contact' });
  }
}
