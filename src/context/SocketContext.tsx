import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { AppNotification, Conversation, Message, User } from '../types';
import { api } from '../services/api';

export interface ActiveCall {
  isOpen: boolean;
  status: 'idle' | 'outgoing' | 'incoming' | 'connected';
  isGroup?: boolean;
  groupId?: string;
  groupName?: string;
  participantsCount?: number;
  peerUser: User | null;
  callerUser?: User | null;
  conversationId?: string;
  callType: 'audio' | 'video';
  duration: number;
  isAudioMuted: boolean;
  isVideoOff: boolean;
}

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  onlineUsers: Record<string, { isOnline: boolean; lastSeen: string }>;
  activeCall: ActiveCall;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  startCall: (targetUser: User, callType: 'audio' | 'video', conversationId?: string) => Promise<void>;
  startGroupCall: (conversation: { _id: string; name?: string; participants: string[] }, callType: 'audio' | 'video') => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: (reason?: string) => void;
  endCall: () => void;
  leaveGroupCall: () => void;
  toggleMute: () => void;
  toggleVideo: () => void;
  switchCallType: () => void;
  notifications: AppNotification[];
  dismissNotification: (id: string) => void;
  clearAllNotifications: () => void;
  typingUsers: Record<string, string>; // conversationId -> username
}

const SocketContext = createContext<SocketContextType | null>(null);

// Standard Google public STUN servers for WebRTC peer connection
const rtcConfig: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { user, token } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [onlineUsers, setOnlineUsers] = useState<Record<string, { isOnline: boolean; lastSeen: string }>>({});
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});

  // Calling & WebRTC State
  const [activeCall, setActiveCall] = useState<ActiveCall>({
    isOpen: false,
    status: 'idle',
    peerUser: null,
    callType: 'video',
    duration: 0,
    isAudioMuted: false,
    isVideoOff: false,
  });

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const callTimerRef = useRef<any>(null);

  // Initialize Socket connection
  useEffect(() => {
    if (!token || !user) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      return;
    }

    const newSocket = io({
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
    });

    newSocket.on('connect', () => {
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    // Initial bulk status of all other users
    newSocket.on('users:initial_status', (initialMap: Record<string, { isOnline: boolean; lastSeen: string | null }>) => {
      setOnlineUsers(prev => ({
        ...prev,
        ...initialMap as any,
      }));
    });

    // Real-time online/offline updates
    newSocket.on('user:status', (data: { userId: string; isOnline: boolean; lastSeen: string | null }) => {
      setOnlineUsers(prev => ({
        ...prev,
        [data.userId]: {
          isOnline: data.isOnline,
          lastSeen: data.lastSeen as any,
        },
      }));
    });

    // Real-time notifications
    newSocket.on('notification:new', (notif: AppNotification) => {
      setNotifications(prev => [notif, ...prev]);
    });

    // Typing updates
    newSocket.on('typing:status', (data: { conversationId: string; userId: string; username?: string; isTyping: boolean }) => {
      setTypingUsers(prev => {
        const next = { ...prev };
        if (data.isTyping && data.username) {
          next[data.conversationId] = data.username;
        } else {
          delete next[data.conversationId];
        }
        return next;
      });
    });

    // WebRTC Signaling listeners
    newSocket.on('call:incoming', (data: { caller: User; conversationId?: string; callType: 'audio' | 'video' }) => {
      setActiveCall({
        isOpen: true,
        status: 'incoming',
        isGroup: false,
        peerUser: data.caller,
        conversationId: data.conversationId,
        callType: data.callType,
        duration: 0,
        isAudioMuted: false,
        isVideoOff: false,
      });
    });

    // Group Call Signaling listeners
    newSocket.on('call:group:incoming', (data: {
      conversationId: string;
      groupName?: string;
      caller: User;
      callType: 'audio' | 'video';
      timestamp: number;
    }) => {
      setActiveCall({
        isOpen: true,
        status: 'incoming',
        isGroup: true,
        groupId: data.conversationId,
        groupName: data.groupName || 'Group Call',
        callerUser: data.caller,
        peerUser: data.caller,
        conversationId: data.conversationId,
        callType: data.callType,
        duration: 0,
        isAudioMuted: false,
        isVideoOff: false,
      });
    });

    newSocket.on('call:group:started', (data: {
      conversationId: string;
      groupName?: string;
      callType: 'audio' | 'video';
    }) => {
      setActiveCall(prev => ({
        ...prev,
        status: 'connected',
      }));
      startCallTimer();
    });

    newSocket.on('call:group:user-joined', (data: {
      conversationId: string;
      user: User;
      participantsCount: number;
    }) => {
      setActiveCall(prev => ({
        ...prev,
        participantsCount: data.participantsCount,
      }));
    });

    newSocket.on('call:group:user-left', (data: {
      conversationId: string;
      userId: string;
      participantsCount: number;
    }) => {
      setActiveCall(prev => ({
        ...prev,
        participantsCount: data.participantsCount,
      }));
    });

    newSocket.on('call:group:ended', () => {
      cleanupCall();
    });

    newSocket.on('call:ringing', () => {
      // Ringing feedback
    });

    newSocket.on('call:accepted', async (data: { receiverId: string; conversationId?: string; callType: 'audio' | 'video' }) => {
      setActiveCall(prev => ({
        ...prev,
        status: 'connected',
        conversationId: prev.conversationId || data.conversationId,
      }));
      startCallTimer();

      // Create WebRTC Offer
      if (peerConnectionRef.current) {
        try {
          const offer = await peerConnectionRef.current.createOffer();
          await peerConnectionRef.current.setLocalDescription(offer);
          newSocket.emit('call:signal', {
            targetUserId: data.receiverId,
            signal: offer,
          });
        } catch (e) {
          console.error('Error creating WebRTC offer:', e);
        }
      }
    });

    newSocket.on('call:rejected', (data: { reason: string }) => {
      alert(`Call declined: ${data.reason || 'User is unavailable'}`);
      cleanupCall();
    });

    newSocket.on('call:signal', async (data: { senderId: string; signal: RTCSessionDescriptionInit }) => {
      if (!peerConnectionRef.current) return;
      try {
        if (data.signal.type === 'offer') {
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.signal));
          const answer = await peerConnectionRef.current.createAnswer();
          await peerConnectionRef.current.setLocalDescription(answer);
          newSocket.emit('call:signal', {
            targetUserId: data.senderId,
            signal: answer,
          });
        } else if (data.signal.type === 'answer') {
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.signal));
        }
      } catch (err) {
        console.error('WebRTC signal processing error:', err);
      }
    });

    newSocket.on('call:ice-candidate', async (data: { candidate: RTCIceCandidateInit }) => {
      if (peerConnectionRef.current && data.candidate) {
        try {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (e) {
          console.error('Error adding ICE candidate:', e);
        }
      }
    });

    newSocket.on('call:media-toggle', (data: { isAudioMuted?: boolean; isVideoOff?: boolean }) => {
      // Remote peer toggled audio or video
    });

    newSocket.on('call:ended', () => {
      cleanupCall();
    });

    newSocket.on('call:error', (data: { message: string }) => {
      alert(data.message);
      cleanupCall();
    });

    setSocket(newSocket);

    // Promptly notify server when user closes app or tab so last seen is recorded with timing immediately
    const handleClosingApp = () => {
      try {
        if (newSocket.connected) {
          newSocket.emit('user:closing_app');
          newSocket.disconnect();
        }
      } catch (e) {
        // ignore
      }
    };

    window.addEventListener('beforeunload', handleClosingApp);
    window.addEventListener('pagehide', handleClosingApp);

    return () => {
      window.removeEventListener('beforeunload', handleClosingApp);
      window.removeEventListener('pagehide', handleClosingApp);
      handleClosingApp();
    };
  }, [token, user?._id]);

  // Setup WebRTC PeerConnection
  const setupPeerConnection = (targetUserId: string) => {
    try {
      const pc = new RTCPeerConnection(rtcConfig);

      pc.onicecandidate = event => {
        if (event.candidate && socket) {
          socket.emit('call:ice-candidate', {
            targetUserId,
            candidate: event.candidate,
          });
        }
      };

      pc.ontrack = event => {
        if (event.streams && event.streams[0]) {
          setRemoteStream(event.streams[0]);
        }
      };

      peerConnectionRef.current = pc;
      return pc;
    } catch (err) {
      console.warn('Failed to construct RTCPeerConnection:', err);
      return null;
    }
  };

  // Start 1-on-1 Call (Outgoing)
  const startCall = async (targetUser: User, callType: 'audio' | 'video', conversationId?: string) => {
    if (!socket || !user) return;

    setActiveCall({
      isOpen: true,
      status: 'outgoing',
      isGroup: false,
      peerUser: targetUser,
      conversationId,
      callType,
      duration: 0,
      isAudioMuted: false,
      isVideoOff: false,
    });

    try {
      // Request User Media
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callType === 'video',
      }).catch(err => {
        console.warn('Media devices error, creating fallback dummy media track:', err);
        return null;
      });

      if (stream) {
        localStreamRef.current = stream;
        setLocalStream(stream);

        const pc = setupPeerConnection(targetUser._id);
        if (pc) {
          stream.getTracks().forEach(track => {
            pc.addTrack(track, stream);
          });
        }
      }

      socket.emit('call:initiate', {
        targetUserId: targetUser._id,
        conversationId,
        callType,
      });
    } catch (e: any) {
      alert('Could not access microphone/camera: ' + (e.message || 'Permission denied'));
      cleanupCall();
    }
  };

  // Start Group Call
  const startGroupCall = async (
    conversation: { _id: string; name?: string; participants: string[] },
    callType: 'audio' | 'video'
  ) => {
    if (!socket || !user) return;

    setActiveCall({
      isOpen: true,
      status: 'connected',
      isGroup: true,
      groupId: conversation._id,
      groupName: conversation.name || 'Group Call',
      participantsCount: (conversation.participants?.length || 1),
      peerUser: null,
      conversationId: conversation._id,
      callType,
      duration: 0,
      isAudioMuted: false,
      isVideoOff: false,
    });

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callType === 'video',
      }).catch(err => {
        console.warn('Media devices error during group call:', err);
        return null;
      });

      if (stream) {
        localStreamRef.current = stream;
        setLocalStream(stream);
      }

      startCallTimer();

      socket.emit('call:group:initiate', {
        conversationId: conversation._id,
        callType,
      });
    } catch (e: any) {
      alert('Could not access microphone/camera: ' + (e.message || 'Permission denied'));
      cleanupCall();
    }
  };

  // Accept Call (Incoming 1-on-1 or Group)
  const acceptCall = async () => {
    if (!socket) return;

    // If incoming group call
    if (activeCall.isGroup && activeCall.groupId) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: activeCall.callType === 'video',
        }).catch(err => {
          console.warn('Media devices error during group accept:', err);
          return null;
        });

        if (stream) {
          localStreamRef.current = stream;
          setLocalStream(stream);
        }

        setActiveCall(prev => ({ ...prev, status: 'connected' }));
        startCallTimer();

        socket.emit('call:group:join', {
          conversationId: activeCall.groupId,
        });
      } catch (err) {
        cleanupCall();
      }
      return;
    }

    if (!activeCall.peerUser) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: activeCall.callType === 'video',
      }).catch(err => {
        console.warn('Media devices error during accept:', err);
        return null;
      });

      if (stream) {
        localStreamRef.current = stream;
        setLocalStream(stream);

        const pc = setupPeerConnection(activeCall.peerUser._id);
        if (pc) {
          stream.getTracks().forEach(track => {
            pc.addTrack(track, stream);
          });
        }
      }

      setActiveCall(prev => ({ ...prev, status: 'connected' }));
      startCallTimer();

      socket.emit('call:accept', {
        callerId: activeCall.peerUser._id,
        conversationId: activeCall.conversationId,
        callType: activeCall.callType,
      });
    } catch (err) {
      cleanupCall();
    }
  };

  const rejectCall = (reason = 'Declined') => {
    const callerId = activeCall.peerUser?._id;
    const convId = activeCall.conversationId || activeCall.groupId;
    const callType = activeCall.callType;

    if (socket && callerId) {
      socket.emit('call:reject', {
        callerId,
        conversationId: convId,
        reason,
      });
    } else if (callerId || convId) {
      // Fallback only if socket was not available
      api.calls.log({
        receiverId: callerId,
        conversationId: convId,
        isGroup: !!activeCall.isGroup,
        callType,
        status: 'rejected',
        duration: 0,
      }).catch(err => console.warn('Failed to log reject call:', err));
    }

    cleanupCall();
  };

  const leaveGroupCall = () => {
    endCall();
  };

  const endCall = () => {
    const isGrp = !!activeCall.isGroup;
    const dur = activeCall.duration;
    const isConn = activeCall.status === 'connected';
    const convId = activeCall.conversationId || activeCall.groupId;
    const recId = activeCall.peerUser?._id;
    const callType = activeCall.callType;

    if (isGrp) {
      if (socket && convId) {
        socket.emit('call:group:leave', {
          conversationId: convId,
          duration: dur,
        });
      } else if (convId) {
        // Fallback only if socket was not available
        api.calls.log({
          conversationId: convId,
          isGroup: true,
          callType,
          status: dur > 0 ? 'accepted' : 'not_accepted',
          duration: dur,
        }).catch(err => console.warn('Failed to log group call end:', err));
      }
    } else {
      if (socket && recId) {
        socket.emit('call:end', {
          targetUserId: recId,
          conversationId: convId,
          duration: dur,
        });
      } else if (recId || convId) {
        // Fallback only if socket was not available
        api.calls.log({
          receiverId: recId,
          conversationId: convId,
          isGroup: false,
          callType,
          status: isConn ? 'accepted' : 'not_accepted',
          duration: isConn ? dur : 0,
        }).catch(err => console.warn('Failed to log call end:', err));
      }
    }

    cleanupCall();
  };

  const startCallTimer = () => {
    if (callTimerRef.current) clearInterval(callTimerRef.current);
    callTimerRef.current = setInterval(() => {
      setActiveCall(prev => ({ ...prev, duration: prev.duration + 1 }));
    }, 1000);
  };

  const cleanupCall = () => {
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    setLocalStream(null);
    setRemoteStream(null);
    setActiveCall({
      isOpen: false,
      status: 'idle',
      peerUser: null,
      callType: 'video',
      duration: 0,
      isAudioMuted: false,
      isVideoOff: false,
    });
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        const isMuted = !audioTrack.enabled;
        setActiveCall(prev => ({ ...prev, isAudioMuted: isMuted }));
        if (socket && activeCall.peerUser) {
          socket.emit('call:media-toggle', {
            targetUserId: activeCall.peerUser._id,
            isAudioMuted: isMuted,
          });
        }
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        const isVideoOff = !videoTrack.enabled;
        setActiveCall(prev => ({ ...prev, isVideoOff }));
        if (socket && activeCall.peerUser) {
          socket.emit('call:media-toggle', {
            targetUserId: activeCall.peerUser._id,
            isVideoOff,
          });
        }
      }
    }
  };

  const switchCallType = () => {
    setActiveCall(prev => ({
      ...prev,
      callType: prev.callType === 'video' ? 'audio' : 'video',
    }));
  };

  const dismissNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n._id !== id));
  };

  const clearAllNotifications = () => {
    setNotifications([]);
  };

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        onlineUsers,
        activeCall,
        localStream,
        remoteStream,
        startCall,
        startGroupCall,
        acceptCall,
        rejectCall,
        endCall,
        leaveGroupCall,
        toggleMute,
        toggleVideo,
        switchCallType,
        notifications,
        dismissNotification,
        clearAllNotifications,
        typingUsers,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) throw new Error('useSocket must be used within SocketProvider');
  return context;
}
