import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  Phone,
  Video,
  MoreVertical,
  Paperclip,
  Smile,
  Send,
  Mic,
  MicOff,
  Image,
  FileText,
  X,
  Palette,
  ShieldAlert,
  UserPlus,
  ArrowLeft,
  Users,
  Info,
  Bookmark,
} from 'lucide-react';
import { Conversation, Message, User, ChatBackground } from '../types';
import { api } from '../services/api';
import { useSocket } from '../context/SocketContext';
import { useTheme } from '../context/ThemeContext';
import { MessageItem } from './MessageItem';
import { ForwardModal } from './ForwardModal';
import { GroupInfoModal } from './GroupInfoModal';
import { formatLastSeen, formatChatDateSeparator, isDifferentChatDay } from '../utils/date';

interface ChatAreaProps {
  conversationId: string;
  currentUser: User;
  onBackMobile?: () => void;
  onOpenSearchModal?: () => void;
  onGroupLeft?: () => void;
}

const WALLPAPERS: { id: ChatBackground; label: string }[] = [
  { id: 'default', label: 'Default Solid' },
  { id: 'doodle', label: 'Subtle Doodles' },
  { id: 'dots', label: 'Polka Dots' },
  { id: 'gradient', label: 'Aurora Gradient' },
  { id: 'dark_stars', label: 'Midnight Stars' },
  { id: 'minimal_grid', label: 'Technical Grid' },
];

export const ChatArea: React.FC<ChatAreaProps> = ({
  conversationId,
  currentUser,
  onBackMobile,
  onOpenSearchModal,
  onGroupLeft,
}) => {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [otherUser, setOtherUser] = useState<User | null>(null);
  const [isContact, setIsContact] = useState<boolean>(true);
  const [text, setText] = useState('');
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [messageToForward, setMessageToForward] = useState<Message | null>(null);
  const [forwardModalOpen, setForwardModalOpen] = useState(false);
  const [showWallpaperMenu, setShowWallpaperMenu] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);

  const { socket, onlineUsers, typingUsers, startCall, startGroupCall } = useSocket();
  const { getChatBgClass } = useTheme();

  const isGroup = !!conversation?.isGroup;
  const isSelf = !!conversation?.isSelf || (conversation?.participants?.length === 1 && conversation?.participants[0] === currentUser._id);
  const participantMap = useMemo(() => {
    const map: Record<string, User> = {};
    if (conversation?.participantDetails) {
      conversation.participantDetails.forEach(u => {
        map[u._id] = u;
      });
    }
    return map;
  }, [conversation?.participantDetails]);
  const groupMembersCount = conversation?.participants?.length || 0;
  const canSendMessages = isGroup || isSelf || isContact;

  // Deduplicate messages by ID and filter out any redundant call messages
  const displayMessages = useMemo(() => {
    const list: Message[] = [];
    const seenIds = new Set<string>();

    for (const msg of messages) {
      if (seenIds.has(msg._id)) continue;

      const callInfo = msg.callInfo;
      if (callInfo) {
        const isDuplicateCall = list.some(prev => {
          if (!prev.callInfo) return false;
          if (prev.callInfo.callId && callInfo.callId && prev.callInfo.callId === callInfo.callId) return true;
          const sameCaller = prev.sender === msg.sender;
          const sameType = prev.callInfo.callType === callInfo.callType;
          const timeDiff = Math.abs(new Date(prev.createdAt).getTime() - new Date(msg.createdAt).getTime());
          return sameCaller && sameType && timeDiff < 15000;
        });

        if (isDuplicateCall) continue;
      }

      seenIds.add(msg._id);
      list.push(msg);
    }
    return list;
  }, [messages]);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const typingTimeoutRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Fetch conversation messages & details
  const loadConversation = async () => {
    try {
      const data = await api.chat.getMessages(conversationId);
      setConversation(data.conversation);
      setMessages(data.messages);
      setOtherUser(data.otherUser);
      setIsContact(data.isContact);

      // Tell socket we opened conversation and read messages
      if (socket) {
        socket.emit('conversation:join', { conversationId });
      }
    } catch (err) {
      console.error('Failed to load conversation:', err);
    }
  };

  useEffect(() => {
    loadConversation();
  }, [conversationId]);

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [displayMessages.length]);

  // Socket event listeners for this conversation
  useEffect(() => {
    if (!socket) return;

    const handleMessageReceived = (msg: Message) => {
      if (msg.conversationId === conversationId) {
        setMessages(prev => {
          if (prev.some(m => m._id === msg._id)) return prev;

          // If this is a call event message, check if a message for this call or recent same-caller event is already in state
          const callInfo = msg.callInfo;
          if (callInfo) {
            const existingCallIdx = prev.findIndex(
              m =>
                m.callInfo &&
                ((m.callInfo.callId && callInfo.callId && m.callInfo.callId === callInfo.callId) ||
                  (m.sender === msg.sender &&
                    m.callInfo.callType === callInfo.callType &&
                    Math.abs(new Date(m.createdAt).getTime() - new Date(msg.createdAt).getTime()) < 15000))
            );

            if (existingCallIdx !== -1) {
              const updated = [...prev];
              updated[existingCallIdx] = { ...updated[existingCallIdx], ...msg };
              return updated;
            }
          }

          return [...prev, msg];
        });
        // Mark as read
        socket.emit('messages:read', { conversationId });
      }
    };

    const handleMessagesRead = (data: { conversationId: string; readByUserId: string }) => {
      if (data.conversationId === conversationId) {
        setMessages(prev =>
          prev.map(m => (m.sender === currentUser._id ? { ...m, status: 'read' } : m))
        );
      }
    };

    const handleReaction = (data: { messageId: string; reactions: any[] }) => {
      setMessages(prev =>
        prev.map(m => (m._id === data.messageId ? { ...m, reactions: data.reactions } : m))
      );
    };

    const handleEdited = (data: { messageId: string; text: string; isEdited: boolean }) => {
      setMessages(prev =>
        prev.map(m =>
          m._id === data.messageId
            ? { ...m, text: data.text, isEdited: data.isEdited }
            : m
        )
      );
    };

    const handleDeleted = (data: { messageId: string; isDeletedForEveryone: boolean }) => {
      setMessages(prev =>
        prev.map(m =>
          m._id === data.messageId
            ? { ...m, text: 'This message was deleted', isDeletedForEveryone: true }
            : m
        )
      );
    };

    socket.on('message:received', handleMessageReceived);
    socket.on('message:new', handleMessageReceived);
    socket.on('messages:read', handleMessagesRead);
    socket.on('message:reaction', handleReaction);
    socket.on('message:edited', handleEdited);
    socket.on('message:deleted', handleDeleted);

    return () => {
      socket.off('message:received', handleMessageReceived);
      socket.off('message:new', handleMessageReceived);
      socket.off('messages:read', handleMessagesRead);
      socket.off('message:reaction', handleReaction);
      socket.off('message:edited', handleEdited);
      socket.off('message:deleted', handleDeleted);
      if (socket) {
        socket.emit('conversation:leave', { conversationId });
      }
    };
  }, [socket, conversationId, currentUser._id]);

  // Handle Typing indicator emit
  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setText(e.target.value);

    if (socket) {
      socket.emit('typing:start', {
        conversationId,
        username: currentUser.displayName,
      });

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('typing:stop', {
          conversationId,
        });
      }, 2000);
    }
  };

  // Send text message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !canSendMessages) return;

    const partnerDisplayName = isGroup
      ? (replyingTo ? participantMap[replyingTo.sender]?.displayName || replyingTo.senderName || 'Member' : 'Member')
      : (otherUser?.displayName || 'Partner');

    const payload = {
      conversationId,
      text: text.trim(),
      replyTo: replyingTo
        ? {
            messageId: replyingTo._id,
            text: replyingTo.text || replyingTo.fileName || 'Attachment',
            senderName:
              replyingTo.sender === currentUser._id
                ? 'You'
                : partnerDisplayName,
          }
        : undefined,
    };

    setText('');
    setReplyingTo(null);

    try {
      const res = await api.chat.sendMessage(payload);
      if (res && res.message) {
        const newMsg: Message = {
          ...res.message,
          senderName: res.message.senderName || currentUser.displayName,
          senderAvatar: res.message.senderAvatar || currentUser.avatar,
        };
        setMessages(prev => (prev.some(m => m._id === newMsg._id) ? prev : [...prev, newMsg]));
      }
    } catch (err: any) {
      alert(err.message || 'Failed to send message');
    }
  };

  // Send Media attachment
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !canSendMessages) return;

    setUploadingMedia(true);
    setShowAttachMenu(false);
    try {
      const uploadRes = await api.upload.media(file);
      const res = await api.chat.sendMessage({
        conversationId,
        text: '',
        fileUrl: uploadRes.fileUrl,
        fileType: uploadRes.fileType as any,
        fileName: uploadRes.fileName,
        fileSize: uploadRes.fileSize,
      });
      if (res && res.message) {
        const newMsg: Message = {
          ...res.message,
          senderName: res.message.senderName || currentUser.displayName,
          senderAvatar: res.message.senderAvatar || currentUser.avatar,
        };
        setMessages(prev => (prev.some(m => m._id === newMsg._id) ? prev : [...prev, newMsg]));
      }
    } catch (err: any) {
      alert(err.message || 'Failed to upload media');
    } finally {
      setUploadingMedia(false);
    }
  };

  // Audio Voice Recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];

      recorder.ondataavailable = event => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioFile = new File([audioBlob], 'voice-message.webm', { type: 'audio/webm' });
        setUploadingMedia(true);
        try {
          const uploadRes = await api.upload.media(audioFile);
          const res = await api.chat.sendMessage({
            conversationId,
            text: '',
            fileUrl: uploadRes.fileUrl,
            fileType: 'audio',
            fileName: 'Voice note.webm',
          });
          if (res && res.message) {
            const newMsg: Message = {
              ...res.message,
              senderName: res.message.senderName || currentUser.displayName,
              senderAvatar: res.message.senderAvatar || currentUser.avatar,
            };
            setMessages(prev => (prev.some(m => m._id === newMsg._id) ? prev : [...prev, newMsg]));
          }
        } catch (e: any) {
          alert('Failed to send voice note');
        } finally {
          setUploadingMedia(false);
        }
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecordingAudio(true);
    } catch (err) {
      alert('Microphone access denied or unavailable.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
      setIsRecordingAudio(false);
    }
  };

  // Reactions, Edits, Deletions
  const handleReact = async (messageId: string, emoji: string) => {
    try {
      await api.chat.reactToMessage(messageId, emoji);
    } catch (err) {
      console.error(err);
    }
  };

  const handleEditMessage = async (messageId: string, newText: string) => {
    try {
      await api.chat.editMessage(messageId, newText);
    } catch (err: any) {
      alert(err.message || 'Failed to edit message');
    }
  };

  const handleDeleteMessage = async (messageId: string, forEveryone: boolean) => {
    try {
      await api.chat.deleteMessage(messageId, forEveryone);
    } catch (err: any) {
      alert(err.message || 'Failed to delete message');
    }
  };

  const handleSetWallpaper = async (bg: ChatBackground) => {
    try {
      await api.chat.updateBackground(conversationId, bg);
      setConversation(prev => (prev ? { ...prev, backgroundTheme: bg } : prev));
      setShowWallpaperMenu(false);
    } catch (err) {
      console.error(err);
    }
  };

  // Periodic tick so relative time "Last seen Xm ago" updates automatically in real-time
  const [, setTimeTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTimeTick(t => t + 1), 20000);
    return () => clearInterval(timer);
  }, []);

  const isOtherOnline = otherUser
    ? (onlineUsers[otherUser._id]?.isOnline ?? otherUser.isOnline)
    : false;
  const effectiveLastSeen = otherUser
    ? (onlineUsers[otherUser._id]?.lastSeen !== undefined
        ? onlineUsers[otherUser._id].lastSeen
        : otherUser.lastSeen)
    : null;
  const isOtherTyping = typingUsers[conversationId] === otherUser?.username;

  return (
    <div className="flex-1 flex flex-col h-full bg-white dark:bg-neutral-900 overflow-hidden relative">
      {/* 1. Chat Header */}
      <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-b border-neutral-200 dark:border-neutral-800 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md flex items-center justify-between gap-1.5 sm:gap-2 z-20 shadow-2xs shrink-0">
        <div
          onClick={() => isGroup && setShowGroupInfo(true)}
          className={`flex items-center gap-2 sm:gap-3 min-w-0 flex-1 ${isGroup ? 'cursor-pointer hover:opacity-90' : ''}`}
        >
          {onBackMobile && (
            <button
              onClick={e => {
                e.stopPropagation();
                onBackMobile();
              }}
              className="md:hidden p-1.5 -ml-1 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition cursor-pointer shrink-0"
              title="Back to conversations"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}

          <div className="relative shrink-0">
            {isGroup ? (
              <div className="relative">
                <img
                  src={
                    conversation?.avatar ||
                    `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(conversation?.name || 'group')}`
                  }
                  alt={conversation?.name}
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl object-cover border border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800"
                />
                <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-indigo-600 border border-white dark:border-neutral-900 rounded-full flex items-center justify-center text-white text-[9px]">
                  <Users className="w-2.5 h-2.5" />
                </span>
              </div>
            ) : isSelf ? (
              <div className="relative">
                <img
                  src={
                    currentUser?.avatar ||
                    `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser?.username || 'user'}`
                  }
                  alt="Message yourself"
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover border border-indigo-300 dark:border-indigo-700"
                />
                <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-indigo-600 border border-white dark:border-neutral-900 rounded-full flex items-center justify-center text-white text-[9px]">
                  <Bookmark className="w-2.5 h-2.5" />
                </span>
              </div>
            ) : (
              <div className="relative">
                <img
                  src={
                    otherUser?.avatar ||
                    `https://api.dicebear.com/7.x/avataaars/svg?seed=${otherUser?.username || 'user'}`
                  }
                  alt={otherUser?.displayName}
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover border border-neutral-200 dark:border-neutral-700"
                />
                {isOtherOnline && (
                  <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-neutral-900 rounded-full" />
                )}
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h2 className="text-xs sm:text-sm font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5 truncate">
              <span className="truncate">
                {isGroup
                  ? conversation?.name || 'Group Chat'
                  : isSelf
                  ? 'Message yourself'
                  : otherUser?.displayName || 'Chat'}
              </span>
              {isGroup ? (
                <span className="text-[10px] px-1.5 py-0.2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-sm font-semibold border border-indigo-200 dark:border-indigo-800 shrink-0">
                  {groupMembersCount}
                </span>
              ) : isSelf ? (
                <span className="text-[10px] px-1.5 py-0.2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-sm font-semibold border border-indigo-200 dark:border-indigo-800 shrink-0">
                  You
                </span>
              ) : !isContact ? (
                <span className="text-[10px] px-1.5 py-0.2 bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 rounded-sm font-medium border border-amber-300 dark:border-amber-800 shrink-0 hidden sm:inline">
                  Not in contacts
                </span>
              ) : null}
            </h2>
            <p className="text-[10px] sm:text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
              {isGroup ? (
                typingUsers[conversationId] ? (
                  <span className="text-indigo-600 dark:text-indigo-400 font-semibold animate-pulse">
                    {typingUsers[conversationId]} is typing...
                  </span>
                ) : (
                  <span>
                    {groupMembersCount} member{groupMembersCount === 1 ? '' : 's'} (Limit: 100)
                  </span>
                )
              ) : isSelf ? (
                'Saved messages, notes, files & links'
              ) : isOtherTyping ? (
                <span className="text-indigo-600 dark:text-indigo-400 font-semibold animate-pulse">
                  typing...
                </span>
              ) : isOtherOnline ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Online
                </span>
              ) : effectiveLastSeen && formatLastSeen(effectiveLastSeen) ? (
                <span>{formatLastSeen(effectiveLastSeen)}</span>
              ) : (
                'Offline'
              )}
            </p>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-0.5 sm:gap-1.5 shrink-0">
          {/* Group Info button for groups */}
          {isGroup && (
            <button
              onClick={() => setShowGroupInfo(true)}
              title="Group Members & Capacity (Max 100)"
              className="p-1.5 sm:p-2 text-neutral-600 dark:text-neutral-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition flex items-center gap-1 text-xs font-semibold shrink-0 cursor-pointer"
            >
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Info</span>
            </button>
          )}

          {/* Voice Call (Direct Chat or Group Chat, not self) */}
          {!isSelf && (
            <button
              disabled={!isGroup && (!isContact || !otherUser)}
              onClick={() => {
                if (isGroup && conversation) {
                  startGroupCall(
                    {
                      _id: conversation._id,
                      name: conversation.name,
                      participants: conversation.participants,
                    },
                    'audio'
                  );
                } else if (otherUser) {
                  startCall(otherUser, 'audio', conversationId);
                }
              }}
              title={
                isGroup
                  ? 'Start Group Voice Call'
                  : isContact
                  ? 'Start Voice Call'
                  : 'Calls disabled: Add to contacts first'
              }
              className="p-1.5 sm:p-2 text-neutral-600 dark:text-neutral-300 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition disabled:opacity-30 disabled:cursor-not-allowed shrink-0 cursor-pointer"
            >
              <Phone className="w-4 h-4" />
            </button>
          )}

          {/* Video Call (Direct Chat or Group Chat, not self) */}
          {!isSelf && (
            <button
              disabled={!isGroup && (!isContact || !otherUser)}
              onClick={() => {
                if (isGroup && conversation) {
                  startGroupCall(
                    {
                      _id: conversation._id,
                      name: conversation.name,
                      participants: conversation.participants,
                    },
                    'video'
                  );
                } else if (otherUser) {
                  startCall(otherUser, 'video', conversationId);
                }
              }}
              title={
                isGroup
                  ? 'Start Group Video Call'
                  : isContact
                  ? 'Start Video Call'
                  : 'Calls disabled: Add to contacts first'
              }
              className="p-1.5 sm:p-2 text-neutral-600 dark:text-neutral-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition disabled:opacity-30 disabled:cursor-not-allowed shrink-0 cursor-pointer"
            >
              <Video className="w-4 h-4" />
            </button>
          )}

          {/* Wallpaper picker toggle */}
          <div className="relative shrink-0">
            <button
              onClick={() => setShowWallpaperMenu(!showWallpaperMenu)}
              title="Change Chat Background"
              className="p-1.5 sm:p-2 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition cursor-pointer"
            >
              <Palette className="w-4 h-4" />
            </button>

            {showWallpaperMenu && (
              <div className="absolute right-0 top-full mt-2 w-44 bg-white dark:bg-neutral-800 rounded-2xl shadow-xl border border-neutral-200 dark:border-neutral-700 p-2 z-30">
                <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider px-2 py-1 block">
                  Chat Wallpaper
                </span>
                {WALLPAPERS.map(wp => (
                  <button
                    key={wp.id}
                    onClick={() => handleSetWallpaper(wp.id)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition flex items-center justify-between ${
                      conversation?.backgroundTheme === wp.id
                        ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold'
                        : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700'
                    }`}
                  >
                    <span>{wp.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. Chat Message Stream */}
      <div
        className={`flex-1 overflow-y-auto p-4 sm:p-6 transition-colors ${getChatBgClass(
          conversation?.backgroundTheme
        )}`}
      >
        {/* Contact System Safety Alert Banner if not contact (Only for direct non-self chats) */}
        {!isGroup && !isSelf && !isContact && otherUser && (
          <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-amber-900 dark:text-amber-200">
            <div className="flex items-center gap-3">
              <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
              <div className="text-xs">
                <p className="font-bold">Contact Request Required</p>
                <p className="opacity-90">
                  You and @{otherUser.username} are not in each other&apos;s contacts. Normal messaging and calls are blocked until connected.
                </p>
              </div>
            </div>
            <button
              onClick={onOpenSearchModal}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shrink-0 flex items-center gap-1.5 shadow-xs"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Send Contact Request
            </button>
          </div>
        )}

        {displayMessages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-neutral-400">
            <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-950/40 rounded-full flex items-center justify-center text-indigo-500 mb-3">
              {isSelf ? <Bookmark className="w-6 h-6" /> : <Smile className="w-6 h-6" />}
            </div>
            <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
              {isSelf ? 'Message yourself' : 'No messages yet'}
            </p>
            <p className="text-xs text-neutral-500 max-w-xs mt-1">
              {isSelf
                ? 'Save personal notes, URLs, images, or files here for easy access across sessions.'
                : 'Send a message to start this conversation. All messages are encrypted and real-time.'}
            </p>
          </div>
        )}

        {displayMessages.map((msg, index) => {
          const prevMsg = index > 0 ? displayMessages[index - 1] : null;
          const showDateSeparator = !prevMsg || isDifferentChatDay(prevMsg.createdAt, msg.createdAt);
          const sender =
            msg.sender === currentUser._id
              ? currentUser
              : isGroup
              ? participantMap[msg.sender] ||
                ({
                  _id: msg.sender,
                  displayName: msg.senderName || 'Member',
                  username: 'member',
                  avatar: msg.senderAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(msg.senderName || msg.sender)}`,
                } as User)
              : otherUser;

          return (
            <React.Fragment key={msg._id}>
              {showDateSeparator && (
                <div className="flex items-center justify-center my-3 select-none">
                  <span className="px-3 py-1 bg-neutral-200/90 dark:bg-neutral-800/90 text-neutral-600 dark:text-neutral-300 text-[11px] font-semibold rounded-full shadow-2xs border border-neutral-300/60 dark:border-neutral-700/60 backdrop-blur-xs">
                    {formatChatDateSeparator(msg.createdAt)}
                  </span>
                </div>
              )}
              <MessageItem
                message={msg}
                currentUserId={currentUser._id}
                senderUser={sender}
                isGroup={isGroup}
                onReply={m => setReplyingTo(m)}
                onForward={m => {
                  setMessageToForward(m);
                  setForwardModalOpen(true);
                }}
                onEdit={handleEditMessage}
                onDelete={handleDeleteMessage}
                onReact={handleReact}
                onCallBack={
                  isGroup && conversation
                    ? (callType) =>
                        startGroupCall(
                          {
                            _id: conversation._id,
                            name: conversation.name,
                            participants: conversation.participants,
                          },
                          callType
                        )
                    : !isSelf && otherUser
                    ? (callType) => startCall(otherUser, callType, conversationId)
                    : undefined
                }
              />
            </React.Fragment>
          );
        })}

        <div ref={messagesEndRef} />
      </div>

      {/* 3. Reply Preview Bar */}
      {replyingTo && (
        <div className="px-4 py-2 bg-neutral-100 dark:bg-neutral-800 border-t border-neutral-200 dark:border-neutral-700 flex items-center justify-between text-xs">
          <div className="border-l-3 border-indigo-500 pl-2">
            <span className="font-bold text-neutral-800 dark:text-neutral-200">
              Replying to{' '}
              {replyingTo.sender === currentUser._id
                ? 'You'
                : isGroup
                ? participantMap[replyingTo.sender]?.displayName || replyingTo.senderName || 'Member'
                : otherUser?.displayName}
            </span>
            <p className="text-neutral-500 truncate max-w-md">
              {replyingTo.text || replyingTo.fileName || 'Attachment'}
            </p>
          </div>
          <button
            onClick={() => setReplyingTo(null)}
            className="p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 4. Chat Input Box */}
      <div className="p-2.5 sm:p-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0.75rem))] bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md border-t border-neutral-200 dark:border-neutral-800 relative z-20">
        {!canSendMessages ? (
          <div className="p-3 bg-neutral-100 dark:bg-neutral-800/80 rounded-2xl text-center text-xs text-neutral-500 flex items-center justify-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-500" />
            <span>Messaging is disabled until contact request is accepted by both users.</span>
          </div>
        ) : (
          <form onSubmit={handleSendMessage} className="flex items-center gap-1.5 sm:gap-2">
            {/* Attachment dropdown button */}
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setShowAttachMenu(!showAttachMenu)}
                className="p-2 sm:p-2.5 text-neutral-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition cursor-pointer"
                title="Attach Media"
              >
                <Paperclip className="w-4 h-4" />
              </button>

              {showAttachMenu && (
                <div className="absolute bottom-full mb-2 left-0 w-44 bg-white dark:bg-neutral-800 rounded-2xl shadow-xl border border-neutral-200 dark:border-neutral-700 p-1.5 z-30">
                  <label className="flex items-center gap-2.5 px-3 py-2 text-xs text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-xl cursor-pointer">
                    <Image className="w-4 h-4 text-emerald-500" />
                    <span>Photo or Video</span>
                    <input
                      type="file"
                      accept="image/*,video/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                  <label className="flex items-center gap-2.5 px-3 py-2 text-xs text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-xl cursor-pointer">
                    <FileText className="w-4 h-4 text-indigo-500" />
                    <span>Document / File</span>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.zip,.txt"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              )}
            </div>

            {/* Quick emoji drawer toggle */}
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="p-2 sm:p-2.5 text-neutral-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition cursor-pointer"
              >
                <Smile className="w-4 h-4" />
              </button>

              {showEmojiPicker && (
                <div className="absolute bottom-full mb-2 left-0 flex gap-1 bg-white dark:bg-neutral-800 p-2 rounded-2xl shadow-xl border border-neutral-200 dark:border-neutral-700 z-30">
                  {['👍', '❤️', '🔥', '😊', '🎉', '👋', '✨', '🚀'].map(emoji => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => {
                        setText(prev => prev + emoji);
                        setShowEmojiPicker(false);
                      }}
                      className="text-base hover:scale-125 transition-transform p-1"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Text Input */}
            <input
              type="text"
              value={text}
              onChange={handleTextChange}
              placeholder={uploadingMedia ? 'Uploading media...' : 'Type a message...'}
              disabled={uploadingMedia}
              className="flex-1 min-w-0 py-2 sm:py-2.5 px-3 sm:px-4 bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-xl text-xs sm:text-sm outline-none focus:ring-1 focus:ring-indigo-500 transition"
            />

            {/* Voice record or Send button */}
            {text.trim() ? (
              <button
                type="submit"
                className="p-2 sm:p-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition shadow-xs shrink-0 cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={isRecordingAudio ? stopRecording : startRecording}
                className={`p-2 sm:p-2.5 rounded-xl transition shrink-0 cursor-pointer ${
                  isRecordingAudio
                    ? 'bg-rose-600 text-white animate-pulse'
                    : 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                }`}
                title={isRecordingAudio ? 'Stop recording & send' : 'Hold to record voice note'}
              >
                {isRecordingAudio ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
            )}
          </form>
        )}
      </div>

      {/* Forward Modal */}
      <ForwardModal
        isOpen={forwardModalOpen}
        onClose={() => setForwardModalOpen(false)}
        messageToForward={messageToForward}
      />

      {/* Group Info & Capacity Modal */}
      {isGroup && conversation && (
        <GroupInfoModal
          isOpen={showGroupInfo}
          onClose={() => setShowGroupInfo(false)}
          conversation={conversation}
          currentUser={currentUser}
          onGroupUpdated={updated => setConversation(updated)}
          onLeaveGroup={() => {
            setShowGroupInfo(false);
            onGroupLeft?.();
            onBackMobile?.();
          }}
        />
      )}
    </div>
  );
};
