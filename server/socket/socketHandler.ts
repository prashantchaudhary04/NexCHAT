import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { dbStore } from '../config/db.js';
import { decodeSocketToken } from '../middleware/auth.js';
import { recordCallHistoryAndMessage } from '../controllers/callController.js';
import { canViewOnline, canViewLastSeen } from '../utils/privacy.js';

let io: Server | null = null;

// Map userId to set of active socketIds
const userSockets = new Map<string, Set<string>>();
// Map socketId to userId
const socketUser = new Map<string, string>();

/**
 * Check if a user currently has at least one active socket open (live real-time presence)
 */
export function isUserSocketOnline(userId: string): boolean {
  const set = userSockets.get(userId);
  return Boolean(set && set.size > 0);
}

/**
 * Broadcasts a user's presence (isOnline and lastSeen) to all connected users,
 * strictly filtered by the target user's privacy settings.
 */
export function broadcastUserPresence(userId: string) {
  const dbUser = dbStore.users.get(userId);
  if (!dbUser || !io) return;

  const isActuallyOnline = isUserSocketOnline(userId);

  for (const [viewerId] of userSockets.entries()) {
    const isOnlineAllowed = canViewOnline(dbUser, viewerId);
    const isLastSeenAllowed = canViewLastSeen(dbUser, viewerId);

    io.to(`user:${viewerId}`).emit('user:status', {
      userId,
      isOnline: isOnlineAllowed ? isActuallyOnline : false,
      lastSeen: isLastSeenAllowed ? dbUser.lastSeen : null,
    });
  }
}
// Map call pair key to active call details
const activeCalls = new Map<
  string,
  {
    callerId: string;
    receiverId: string;
    conversationId?: string;
    callType: 'audio' | 'video';
    accepted: boolean;
    startTime?: number;
  }
>();

// Map conversationId to active group call details
const activeGroupCalls = new Map<
  string,
  {
    conversationId: string;
    groupName?: string;
    callerId: string;
    callType: 'audio' | 'video';
    participants: Set<string>;
    startTime: number;
  }
>();

export function initSocketIO(server: HttpServer): Server {
  io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token || typeof token !== 'string') {
      return next(new Error('Authentication token required'));
    }

    const decoded = decodeSocketToken(token);
    if (!decoded) {
      return next(new Error('Invalid token'));
    }

    (socket as any).user = decoded;
    next();
  });

  io.on('connection', (socket: Socket) => {
    const user = (socket as any).user;
    if (!user) return;

    const userId = user.id;

    // Register socket
    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    userSockets.get(userId)?.add(socket.id);
    socketUser.set(socket.id, userId);

    // Join personal user room for private notifications and calls
    socket.join(`user:${userId}`);

    // Update user online status
    const dbUser = dbStore.users.get(userId);
    if (dbUser) {
      dbUser.isOnline = true;
      dbStore.users.set(userId, dbUser);
      dbStore.persistNow();

      // Broadcast online status to all connected users filtered by privacy
      broadcastUserPresence(userId);
    }

    // Send initial status map of all users to the connecting client
    const initialStatusMap: Record<string, { isOnline: boolean; lastSeen: string | null }> = {};
    for (const otherUser of dbStore.users.values()) {
      if (otherUser._id === userId) continue;
      const isOnlineAllowed = canViewOnline(otherUser, userId);
      const isLastSeenAllowed = canViewLastSeen(otherUser, userId);
      const actualOnline = isUserSocketOnline(otherUser._id);

      initialStatusMap[otherUser._id] = {
        isOnline: isOnlineAllowed ? actualOnline : false,
        lastSeen: isLastSeenAllowed
          ? otherUser.lastSeen
            ? new Date(otherUser.lastSeen).toISOString()
            : null
          : null,
      };
    }
    socket.emit('users:initial_status', initialStatusMap);

    // Join conversation rooms
    socket.on('conversation:join', (data: any) => {
      const convId = typeof data === 'string' ? data : data?.conversationId;
      if (convId) {
        socket.join(`conv:${convId}`);
      }
    });

    socket.on('conversation:leave', (data: any) => {
      const convId = typeof data === 'string' ? data : data?.conversationId;
      if (convId) {
        socket.leave(`conv:${convId}`);
      }
    });

    // Typing indicators
    socket.on('typing:start', ({ conversationId, username }) => {
      socket.to(`conv:${conversationId}`).emit('typing:status', {
        conversationId,
        userId,
        username,
        isTyping: true,
      });
    });

    socket.on('typing:stop', ({ conversationId }) => {
      socket.to(`conv:${conversationId}`).emit('typing:status', {
        conversationId,
        userId,
        isTyping: false,
      });
    });

    // -------------------------------------------------------------
    // WebRTC Signaling & Call Management (1-on-1 & Group)
    // -------------------------------------------------------------
    socket.on('call:initiate', ({ targetUserId, conversationId, callType }) => {
      const caller = dbStore.users.get(userId);
      const receiver = dbStore.users.get(targetUserId);

      // Contact rule check: allow if contact OR in same conversation
      let isPermitted = caller?.contacts?.includes(targetUserId);
      if (!isPermitted && conversationId) {
        const conv = dbStore.conversations.get(conversationId);
        if (conv?.participants.includes(userId) && conv?.participants.includes(targetUserId)) {
          isPermitted = true;
        }
      }

      if (!isPermitted) {
        socket.emit('call:error', {
          message: 'Permission denied: Calls can only be made to accepted contacts.',
        });
        return;
      }

      // Track active call session
      const pairKey = [userId, targetUserId].sort().join(':');
      activeCalls.set(pairKey, {
        callerId: userId,
        receiverId: targetUserId,
        conversationId,
        callType: callType === 'video' ? 'video' : 'audio',
        accepted: false,
      });

      const targetSockets = userSockets.get(targetUserId);
      if (!targetSockets || targetSockets.size === 0) {
        // Target is offline: inform caller so they can ring or wait, and record not_accepted if cancelled
        socket.emit('call:ringing', { isOffline: true });
        return;
      }

      // Relay incoming call invitation to target
      io?.to(`user:${targetUserId}`).emit('call:incoming', {
        caller: {
          _id: caller?._id,
          username: caller?.username,
          displayName: caller?.displayName,
          avatar: caller?.avatar,
        },
        conversationId,
        callType,
        timestamp: Date.now(),
      });
    });

    // Accept 1-on-1 call
    socket.on('call:accept', ({ callerId, conversationId, callType }) => {
      const pairKey = [callerId, userId].sort().join(':');
      const session = activeCalls.get(pairKey);
      if (session) {
        session.accepted = true;
        session.startTime = Date.now();
        if (conversationId) session.conversationId = conversationId;
      }

      io?.to(`user:${callerId}`).emit('call:accepted', {
        receiverId: userId,
        conversationId,
        callType,
      });
    });

    // Reject 1-on-1 call
    socket.on('call:reject', ({ callerId, conversationId, reason }) => {
      const pairKey = [callerId, userId].sort().join(':');
      const session = activeCalls.get(pairKey);
      const convId = session?.conversationId || conversationId;
      if (session) {
        activeCalls.delete(pairKey);
        recordCallHistoryAndMessage({
          callerId: session.callerId,
          receiverId: session.receiverId,
          conversationId: convId,
          callType: session.callType,
          status: 'rejected',
          duration: 0,
        });
      } else {
        recordCallHistoryAndMessage({
          callerId,
          receiverId: userId,
          conversationId: convId,
          callType: 'audio',
          status: 'rejected',
          duration: 0,
        });
      }

      io?.to(`user:${callerId}`).emit('call:rejected', {
        receiverId: userId,
        reason: reason || 'User is busy or declined the call',
      });
    });

    // End 1-on-1 call
    socket.on('call:end', ({ targetUserId, conversationId, duration }) => {
      const pairKey = [userId, targetUserId].sort().join(':');
      const session = activeCalls.get(pairKey);
      const convId = session?.conversationId || conversationId;
      if (session) {
        activeCalls.delete(pairKey);
        const dur = duration || (session.startTime ? Math.round((Date.now() - session.startTime) / 1000) : 0);
        recordCallHistoryAndMessage({
          callerId: session.callerId,
          receiverId: session.receiverId,
          conversationId: convId,
          callType: session.callType,
          status: session.accepted ? 'accepted' : 'not_accepted',
          duration: session.accepted ? dur : 0,
        });
      } else if (targetUserId) {
        recordCallHistoryAndMessage({
          callerId: userId,
          receiverId: targetUserId,
          conversationId: convId,
          callType: 'audio',
          status: 'not_accepted',
          duration: 0,
        });
      }

      io?.to(`user:${targetUserId}`).emit('call:ended', {
        senderId: userId,
        duration: duration || 0,
      });
    });

    // -------------------------------------------------------------
    // Group Calling
    // -------------------------------------------------------------
    socket.on('call:group:initiate', ({ conversationId, callType }) => {
      const conv = dbStore.conversations.get(conversationId);
      if (!conv || !conv.isGroup || !conv.participants.includes(userId)) {
        socket.emit('call:error', { message: 'Invalid group conversation or access denied' });
        return;
      }

      const caller = dbStore.users.get(userId);
      activeGroupCalls.set(conversationId, {
        conversationId,
        groupName: conv.name,
        callerId: userId,
        callType: callType === 'video' ? 'video' : 'audio',
        participants: new Set([userId]),
        startTime: Date.now(),
      });

      // Broadcast invitation to all group participants
      conv.participants.forEach(pid => {
        if (pid !== userId) {
          io?.to(`user:${pid}`).emit('call:group:incoming', {
            conversationId,
            groupName: conv.name,
            caller: {
              _id: caller?._id,
              username: caller?.username,
              displayName: caller?.displayName,
              avatar: caller?.avatar,
            },
            callType: callType === 'video' ? 'video' : 'audio',
            timestamp: Date.now(),
          });
        }
      });

      socket.emit('call:group:started', {
        conversationId,
        groupName: conv.name,
        callType,
      });
    });

    socket.on('call:group:join', ({ conversationId }) => {
      const session = activeGroupCalls.get(conversationId);
      if (session) {
        session.participants.add(userId);
        const joiner = dbStore.users.get(userId);

        io?.to(`conv:${conversationId}`).emit('call:group:user-joined', {
          conversationId,
          user: {
            _id: joiner?._id,
            username: joiner?.username,
            displayName: joiner?.displayName,
            avatar: joiner?.avatar,
          },
          participantsCount: session.participants.size,
        });
      }
    });

    socket.on('call:group:leave', ({ conversationId, duration }) => {
      const session = activeGroupCalls.get(conversationId);
      if (session) {
        session.participants.delete(userId);
        io?.to(`conv:${conversationId}`).emit('call:group:user-left', {
          conversationId,
          userId,
          participantsCount: session.participants.size,
        });

        // If no more participants or caller ends it
        if (session.participants.size === 0 || session.callerId === userId) {
          activeGroupCalls.delete(conversationId);
          const dur = duration || (session.startTime ? Math.round((Date.now() - session.startTime) / 1000) : 0);
          recordCallHistoryAndMessage({
            callerId: session.callerId,
            conversationId,
            isGroup: true,
            groupName: session.groupName,
            callType: session.callType,
            status: dur > 0 ? 'accepted' : 'not_accepted',
            duration: dur,
          });

          io?.to(`conv:${conversationId}`).emit('call:group:ended', {
            conversationId,
            duration: dur,
          });
        }
      }
    });

    // WebRTC SDP Offer / Answer relay
    socket.on('call:signal', ({ targetUserId, signal }) => {
      io?.to(`user:${targetUserId}`).emit('call:signal', {
        senderId: userId,
        signal,
      });
    });

    // WebRTC ICE Candidate relay
    socket.on('call:ice-candidate', ({ targetUserId, candidate }) => {
      io?.to(`user:${targetUserId}`).emit('call:ice-candidate', {
        senderId: userId,
        candidate,
      });
    });

    // Media status toggle (mute/camera off)
    socket.on('call:media-toggle', ({ targetUserId, isAudioMuted, isVideoOff }) => {
      io?.to(`user:${targetUserId}`).emit('call:media-toggle', {
        senderId: userId,
        isAudioMuted,
        isVideoOff,
      });
    });

    // Disconnect and app closing handling
    const handleUserOffline = () => {
      // Clean up any ongoing calls for this user
      for (const [key, session] of activeCalls.entries()) {
        if (session.callerId === userId || session.receiverId === userId) {
          activeCalls.delete(key);
          const dur = session.startTime ? Math.round((Date.now() - session.startTime) / 1000) : 0;
          recordCallHistoryAndMessage({
            callerId: session.callerId,
            receiverId: session.receiverId,
            callType: session.callType,
            status: session.accepted ? 'accepted' : 'not_accepted',
            duration: session.accepted ? dur : 0,
          });
        }
      }

      const currentSockets = userSockets.get(userId);
      if (currentSockets) {
        currentSockets.delete(socket.id);
        if (currentSockets.size === 0) {
          userSockets.delete(userId);

          // Mark user offline and record exact lastSeen timestamp immediately
          const now = new Date();
          const dbUser = dbStore.users.get(userId);
          if (dbUser) {
            dbUser.isOnline = false;
            dbUser.lastSeen = now;
            dbStore.users.set(userId, dbUser);
            dbStore.persistNow();

            // Broadcast real-time offline status with timing to permitted users
            broadcastUserPresence(userId);
          }
        }
      }
      socketUser.delete(socket.id);
    };

    // Client emitted explicit closing app event (pagehide / beforeunload)
    socket.on('user:closing_app', () => {
      handleUserOffline();
    });

    socket.on('disconnect', () => {
      handleUserOffline();
    });
  });

  return io;
}

export function getSocketIO(): Server | null {
  return io;
}
