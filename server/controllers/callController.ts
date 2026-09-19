import { Response } from 'express';
import crypto from 'crypto';
import { dbStore, ICallHistory, IConversation, IMessage, INotification } from '../config/db.js';
import { AuthRequest } from '../middleware/auth.js';
import { getSocketIO } from '../socket/socketHandler.js';

export function formatCallText(
  callType: 'audio' | 'video',
  status: 'accepted' | 'rejected' | 'not_accepted',
  duration = 0,
  isGroup = false
) {
  const typeLabel = callType === 'video' ? 'Video' : 'Voice';
  const mins = Math.floor(duration / 60);
  const secs = duration % 60;
  const durStr = mins > 0 ? `${mins}m ${secs.toString().padStart(2, '0')}s` : `${secs}s`;

  if (isGroup) {
    if (status === 'accepted') {
      return `Group ${typeLabel} call • Ended (${durStr})`;
    } else if (status === 'rejected') {
      return `Group ${typeLabel} call • Cancelled`;
    } else {
      return `Group ${typeLabel} call • Missed`;
    }
  }

  if (status === 'accepted') {
    return `${typeLabel} call • Accepted (${durStr})`;
  } else if (status === 'rejected') {
    return `${typeLabel} call • Rejected`;
  } else {
    return `${typeLabel} call • Not accepted (Missed)`;
  }
}

export function recordCallHistoryAndMessage(params: {
  callerId: string;
  receiverId?: string;
  conversationId?: string;
  isGroup?: boolean;
  groupName?: string;
  participants?: string[];
  callType: 'audio' | 'video';
  status: string;
  duration?: number;
}) {
  const {
    callerId,
    receiverId,
    conversationId,
    isGroup = false,
    groupName,
    callType,
    status,
    duration = 0,
  } = params;

  // Normalize status
  let normalizedStatus: 'accepted' | 'rejected' | 'not_accepted' = 'not_accepted';
  if (status === 'accepted' || status === 'completed') {
    normalizedStatus = 'accepted';
  } else if (status === 'rejected' || status === 'declined' || status === 'busy') {
    normalizedStatus = 'rejected';
  } else {
    normalizedStatus = 'not_accepted';
  }

  const caller = dbStore.users.get(callerId);
  const receiver = receiverId ? dbStore.users.get(receiverId) : undefined;

  // Find or create conversation
  let conv: IConversation | undefined;
  if (conversationId) {
    conv = dbStore.conversations.get(conversationId);
  }

  if (!conv && receiverId) {
    for (const c of dbStore.conversations.values()) {
      if (
        !c.isGroup &&
        !c.isSelf &&
        c.participants.includes(callerId) &&
        c.participants.includes(receiverId) &&
        c.participants.length === 2
      ) {
        conv = c;
        break;
      }
    }
  }

  if (!conv && receiverId) {
    const convId = 'conv_' + crypto.randomUUID();
    const newConv: IConversation = {
      _id: convId,
      participants: [callerId, receiverId],
      unreadCounts: { [callerId]: 0, [receiverId]: 0 },
      customBackground: 'default',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    dbStore.conversations.set(convId, newConv);
    conv = newConv;
  }

  // Deduplication check: verify if a recent call was logged in the last 10 seconds for this call session
  const now = Date.now();
  for (const existingCall of dbStore.callHistories.values()) {
    const isSameConv = conv && existingCall.conversationId === conv._id;
    const isSamePair =
      !existingCall.isGroup &&
      receiverId &&
      ((existingCall.callerId === callerId && existingCall.receiverId === receiverId) ||
        (existingCall.callerId === receiverId && existingCall.receiverId === callerId));
    const timeDiff = Math.abs(now - new Date(existingCall.createdAt).getTime());

    if ((isSameConv || isSamePair) && timeDiff < 10000) {
      // Recent call log already exists - update it instead of creating a duplicate
      if (duration > (existingCall.duration || 0)) {
        existingCall.duration = duration;
      }
      if (normalizedStatus === 'accepted') {
        existingCall.status = 'accepted';
      }

      const statusToUse: 'accepted' | 'rejected' | 'not_accepted' =
        existingCall.status === 'accepted' || existingCall.status === 'completed'
          ? 'accepted'
          : existingCall.status === 'rejected' || existingCall.status === 'busy'
          ? 'rejected'
          : 'not_accepted';

      const existingMsg = Array.from(dbStore.messages.values()).find(
        m => m.callInfo?.callId === existingCall._id || m._id === `callmsg_${existingCall._id}`
      );
      if (existingMsg && existingMsg.callInfo) {
        existingMsg.callInfo.duration = existingCall.duration;
        existingMsg.callInfo.status = statusToUse;
        existingMsg.text = formatCallText(
          existingCall.callType,
          statusToUse,
          existingCall.duration,
          !!existingCall.isGroup
        );
      }
      return { call: existingCall, message: existingMsg || null, conversationId: conv?._id || null };
    }
  }

  const callId = 'call_' + crypto.randomUUID();
  const newCall: ICallHistory = {
    _id: callId,
    callerId,
    receiverId: receiverId || (conv?.isGroup ? undefined : conv?.participants.find(p => p !== callerId)),
    conversationId: conv?._id,
    isGroup: conv ? !!conv.isGroup : isGroup,
    groupName: conv?.name || groupName,
    participants: conv?.participants,
    callType: callType === 'video' ? 'video' : 'audio',
    status: normalizedStatus,
    duration,
    createdAt: new Date(),
  };

  dbStore.callHistories.set(newCall._id, newCall);

  if (!conv) {
    return { call: newCall, message: null, conversationId: null };
  }

  // Create Call Message inside the chat conversation with deterministic ID
  const callMsg: IMessage = {
    _id: 'callmsg_' + callId,
    conversationId: conv._id,
    sender: callerId,
    receiver: receiverId,
    text: formatCallText(callType, normalizedStatus, duration, !!conv.isGroup),
    callInfo: {
      callId: newCall._id,
      conversationId: conv._id,
      isGroup: !!conv.isGroup,
      groupName: conv.name,
      callType: callType === 'video' ? 'video' : 'audio',
      status: normalizedStatus,
      duration,
      callerId,
      receiverId,
      callerName: caller?.displayName || caller?.username || 'User',
      participants: conv.participants,
    },
    reactions: [],
    status: 'read',
    isEdited: false,
    isForwarded: false,
    deletedFor: [],
    isDeletedForEveryone: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  dbStore.messages.set(callMsg._id, callMsg);
  conv.lastMessage = callMsg._id;
  conv.updatedAt = new Date();
  dbStore.conversations.set(conv._id, conv);

  const io = getSocketIO();
  if (io) {
    // Broadcast the call event message once to the conversation room
    io.to(`conv:${conv._id}`).emit('message:received', callMsg);

    // Update conversation snippet in participants' sidebar
    conv.participants.forEach(pid => {
      io.to(`user:${pid}`).emit('conversation:updated', {
        conversationId: conv!._id,
        lastMessage: callMsg,
      });
    });
  }

  // Missed call notification for direct calls
  if (normalizedStatus === 'not_accepted' && receiverId && !conv.isGroup) {
    const callerName = caller?.displayName || caller?.username || 'User';
    const notif: INotification = {
      _id: 'notif_' + crypto.randomUUID(),
      recipientId: receiverId,
      senderId: callerId,
      senderName: callerName,
      senderAvatar: caller?.avatar || '',
      type: 'missed_call',
      title: `Missed ${callType === 'video' ? 'video' : 'voice'} call`,
      body: `from ${callerName}`,
      content: `Missed ${callType} call from ${callerName}`,
      linkId: conv._id,
      read: false,
      createdAt: new Date(),
    };
    dbStore.notifications.set(notif._id, notif);

    if (io) {
      io.to(`user:${receiverId}`).emit('notification:new', notif);
      io.to(`user:${receiverId}`).emit('call:missed', {
        callId: newCall._id,
        conversationId: conv._id,
        callType,
        caller: {
          _id: caller?._id || callerId,
          username: caller?.username,
          displayName: callerName,
          avatar: caller?.avatar,
        },
        timestamp: Date.now(),
      });
    }
  }

  return { call: newCall, message: callMsg, conversationId: conv._id };
}

export async function logCall(req: AuthRequest, res: Response) {
  try {
    const currentUserId = req.user?.id;
    if (!currentUserId) return res.status(401).json({ message: 'Unauthorized' });

    const { receiverId, conversationId, callType, status, duration, isGroup } = req.body;
    if (!callType) {
      return res.status(400).json({ message: 'callType is required' });
    }

    if (!receiverId && !conversationId) {
      return res.status(400).json({ message: 'receiverId or conversationId is required' });
    }

    const caller = dbStore.users.get(currentUserId);
    // Enforce contacts rule ONLY for 1-on-1 calls outside of groups
    if (!isGroup && receiverId) {
      if (!caller?.contacts?.includes(receiverId)) {
        return res.status(403).json({ message: 'Permission Denied: Calls are only allowed between accepted contacts' });
      }
    }

    const result = recordCallHistoryAndMessage({
      callerId: currentUserId,
      receiverId,
      conversationId,
      isGroup: !!isGroup,
      callType: callType === 'video' ? 'video' : 'audio',
      status: status || 'accepted',
      duration: duration || 0,
    });

    return res.status(201).json(result);
  } catch (error) {
    console.error('logCall error:', error);
    return res.status(500).json({ message: 'Failed to log call' });
  }
}

export async function getCallHistory(req: AuthRequest, res: Response) {
  try {
    const currentUserId = req.user?.id;
    if (!currentUserId) return res.status(401).json({ message: 'Unauthorized' });

    const calls = [];
    for (const c of dbStore.callHistories.values()) {
      const isCaller = c.callerId === currentUserId;
      const isDirectReceiver = c.receiverId === currentUserId;
      const isGroupMember = !!(c.isGroup && c.participants && c.participants.includes(currentUserId));

      if (isCaller || isDirectReceiver || isGroupMember) {
        let otherUser = null;
        if (!c.isGroup) {
          const otherUserId = isCaller ? c.receiverId : c.callerId;
          if (otherUserId) {
            const u = dbStore.users.get(otherUserId);
            if (u) {
              otherUser = {
                _id: u._id,
                username: u.username,
                displayName: u.displayName,
                avatar: u.avatar,
                isOnline: u.isOnline,
              };
            }
          }
        }

        const callerUser = dbStore.users.get(c.callerId);
        const receiverUser = c.receiverId ? dbStore.users.get(c.receiverId) : undefined;

        calls.push({
          ...c,
          isCaller,
          caller: callerUser
            ? {
                _id: callerUser._id,
                username: callerUser.username,
                displayName: callerUser.displayName,
                avatar: callerUser.avatar,
              }
            : c.callerId,
          receiver: receiverUser
            ? {
                _id: receiverUser._id,
                username: receiverUser.username,
                displayName: receiverUser.displayName,
                avatar: receiverUser.avatar,
              }
            : c.receiverId,
          otherUser,
        });
      }
    }

    calls.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return res.json({ calls: calls.slice(0, 50) });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch call history' });
  }
}
