import React, { useState } from 'react';
import {
  Check,
  CheckCheck,
  Smile,
  Reply,
  Share2,
  Edit2,
  Trash2,
  FileText,
  Download,
  MoreVertical,
  CornerUpLeft,
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  PhoneOff,
  Video,
} from 'lucide-react';
import { Message, User } from '../types';
import { formatMessageTime, formatMessageFullDateTime } from '../utils/date';

interface MessageItemProps {
  message: Message;
  currentUserId: string;
  senderUser?: User | null;
  isGroup?: boolean;
  onReply: (message: Message) => void;
  onForward: (message: Message) => void;
  onEdit: (messageId: string, text: string) => void;
  onDelete: (messageId: string, forEveryone: boolean) => void;
  onReact: (messageId: string, emoji: string) => void;
  onCallBack?: (callType: 'audio' | 'video') => void;
}

const COMMON_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

export const MessageItem: React.FC<MessageItemProps> = ({
  message,
  currentUserId,
  senderUser,
  isGroup,
  onReply,
  onForward,
  onEdit,
  onDelete,
  onReact,
  onCallBack,
}) => {
  const isMe = message.sender === currentUserId;
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message.text);

  // If this message represents a Voice / Video Call event
  if (message.callInfo) {
    const { callType, status, duration = 0, callerId, isGroup, groupName } = message.callInfo;
    const isCaller = callerId === currentUserId;
    const isVideo = callType === 'video';

    const formatDuration = (secs: number) => {
      if (!secs) return '0s';
      const mins = Math.floor(secs / 60);
      const rem = secs % 60;
      if (mins === 0) return `${rem}s`;
      return `${mins}m ${rem}s`;
    };

    let statusBadge = {
      label: isCaller ? 'Outgoing (Unanswered)' : 'Missed Call',
      bg: isCaller
        ? 'bg-neutral-100 dark:bg-neutral-800/80 border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300'
        : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300',
      icon: isCaller ? (
        <PhoneOutgoing className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400" />
      ) : (
        <PhoneMissed className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
      ),
      detail: isGroup
        ? (isCaller ? 'Group call • No answers' : 'Missed group call')
        : (isCaller ? 'Outgoing • Unanswered' : 'Incoming • Missed call'),
    };

    if (status === 'accepted') {
      statusBadge = {
        label: isCaller ? 'Outgoing' : 'Incoming',
        bg: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300',
        icon: isCaller ? (
          <PhoneOutgoing className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
        ) : (
          <PhoneIncoming className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
        ),
        detail: isGroup
          ? `${isCaller ? 'Started by you' : `${senderUser?.displayName || 'Member'} started`} • ${formatDuration(duration)}`
          : `${isCaller ? 'Outgoing answered' : 'Incoming answered'} • ${formatDuration(duration)}`,
      };
    } else if (status === 'rejected') {
      statusBadge = {
        label: isCaller ? 'Outgoing (Declined)' : 'Incoming (Declined)',
        bg: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300',
        icon: isCaller ? (
          <PhoneOutgoing className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
        ) : (
          <PhoneOff className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
        ),
        detail: isCaller ? 'Outgoing • Declined by recipient' : 'Incoming • Declined',
      };
    }

    const isMissed = !isCaller && status === 'not_accepted';

    return (
      <div className={`flex flex-col my-3.5 ${isMe ? 'items-end' : 'items-start'}`}>
        <div
          className={`w-full max-w-[320px] sm:max-w-[340px] rounded-2xl p-3.5 border shadow-xs transition-all ${
            isMissed
              ? 'bg-rose-50/60 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800'
              : isMe
              ? 'bg-gradient-to-br from-indigo-50/90 to-indigo-100/60 dark:from-indigo-950/40 dark:to-neutral-900 border-indigo-200 dark:border-indigo-800/60'
              : 'bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center border shadow-xs shrink-0 ${
                  status === 'accepted'
                    ? 'bg-emerald-100 dark:bg-emerald-950/80 border-emerald-200 dark:border-emerald-800'
                    : status === 'rejected'
                    ? 'bg-amber-100 dark:bg-amber-950/80 border-amber-200 dark:border-amber-800'
                    : isCaller
                    ? 'bg-neutral-100 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700'
                    : 'bg-rose-100 dark:bg-rose-950/80 border-rose-200 dark:border-rose-800'
                }`}
              >
                {isVideo ? (
                  <Video
                    className={`w-5 h-5 ${
                      status === 'accepted'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : status === 'rejected'
                        ? 'text-amber-600 dark:text-amber-400'
                        : isCaller
                        ? 'text-neutral-600 dark:text-neutral-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  />
                ) : (
                  <Phone
                    className={`w-5 h-5 ${
                      status === 'accepted'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : status === 'rejected'
                        ? 'text-amber-600 dark:text-amber-400'
                        : isCaller
                        ? 'text-neutral-600 dark:text-neutral-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  />
                )}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className={`text-xs sm:text-sm font-bold ${
                    isMissed
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-neutral-900 dark:text-neutral-100'
                  }`}>
                    {isGroup ? (isVideo ? 'Group Video Call' : 'Group Voice Call') : (isVideo ? 'Video Call' : 'Voice Call')}
                  </span>
                </div>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 flex items-center gap-1">
                  {statusBadge.icon}
                  <span>{statusBadge.detail}</span>
                </p>
              </div>
            </div>

            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border shrink-0 ${statusBadge.bg}`}
            >
              {statusBadge.label}
            </span>
          </div>

          <div className="mt-3 pt-2.5 border-t border-neutral-200/60 dark:border-neutral-700/60 flex items-center justify-between">
            <span
              className="text-[10px] text-neutral-500 dark:text-neutral-400 font-medium"
              title={formatMessageFullDateTime(message.createdAt)}
            >
              {formatMessageTime(message.createdAt)}
            </span>

            {onCallBack && (
              <button
                onClick={() => onCallBack(callType)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-lg transition cursor-pointer ${
                  isMissed
                    ? 'text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-950/60'
                    : 'text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50'
                }`}
              >
                {isVideo ? <Video className="w-3.5 h-3.5" /> : <Phone className="w-3.5 h-3.5" />}
                <span>{isGroup ? 'Start group call' : 'Call back'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editText.trim()) return;
    onEdit(message._id, editText.trim());
    setIsEditing(false);
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  return (
    <div
      className={`group relative flex flex-col mb-3 ${
        isMe ? 'items-end' : 'items-start'
      }`}
    >
      <div className={`relative flex items-end gap-2 max-w-[88%] sm:max-w-[78%] md:max-w-[70%]`}>
        {/* Action Toolbar on Hover or Touch */}
        <div
          className={`absolute top-0 -translate-y-1/2 ${
            showMenu || showEmojiPicker ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          } transition-opacity z-10 flex items-center gap-1 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 shadow-md rounded-full px-2 py-1 ${
            isMe ? 'right-2' : 'left-2'
          }`}
        >
          {/* Reaction Picker Button */}
          <div className="relative">
            <button
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="p-1 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-full text-neutral-500"
              title="React"
            >
              <Smile className="w-3.5 h-3.5" />
            </button>

            {showEmojiPicker && (
              <div className="absolute bottom-full mb-1 left-0 z-20 flex gap-1 bg-white dark:bg-neutral-800 p-1.5 rounded-full shadow-lg border border-neutral-200 dark:border-neutral-700">
                {COMMON_EMOJIS.map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => {
                      onReact(message._id, emoji);
                      setShowEmojiPicker(false);
                    }}
                    className="hover:scale-125 transition-transform px-1 text-sm"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Reply */}
          <button
            onClick={() => onReply(message)}
            className="p-1 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-full text-neutral-500"
            title="Reply"
          >
            <Reply className="w-3.5 h-3.5" />
          </button>

          {/* Forward */}
          <button
            onClick={() => onForward(message)}
            className="p-1 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-full text-neutral-500"
            title="Forward"
          >
            <Share2 className="w-3.5 h-3.5" />
          </button>

          {/* More options menu */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-full text-neutral-500"
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </button>

            {showMenu && (
              <div
                className={`absolute top-full mt-1 ${
                  isMe ? 'right-0' : 'left-0'
                } z-20 w-36 bg-white dark:bg-neutral-800 rounded-xl shadow-xl border border-neutral-200 dark:border-neutral-700 py-1 text-xs`}
              >
                {isMe && !message.isDeletedForEveryone && (
                  <button
                    onClick={() => {
                      setIsEditing(true);
                      setShowMenu(false);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center gap-2 text-neutral-700 dark:text-neutral-200"
                  >
                    <Edit2 className="w-3 h-3" />
                    Edit
                  </button>
                )}
                {isMe && !message.isDeletedForEveryone && (
                  <button
                    onClick={() => {
                      onDelete(message._id, true);
                      setShowMenu(false);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-2 text-rose-600 dark:text-rose-400"
                  >
                    <Trash2 className="w-3 h-3" />
                    Delete for everyone
                  </button>
                )}
                <button
                  onClick={() => {
                    onDelete(message._id, false);
                    setShowMenu(false);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center gap-2 text-neutral-700 dark:text-neutral-200"
                >
                  <Trash2 className="w-3 h-3" />
                  Delete for me
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Bubble */}
        <div
          className={`relative rounded-2xl px-4 py-2.5 shadow-xs ${
            isMe
              ? 'bg-indigo-600 text-white rounded-br-xs'
              : 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 border border-neutral-200/80 dark:border-neutral-700/80 rounded-bl-xs'
          }`}
        >
          {/* Group Sender Name */}
          {!isMe && isGroup && (
            <div className="flex items-center gap-1.5 mb-1">
              {(senderUser?.avatar || message.senderAvatar) && (
                <img
                  src={senderUser?.avatar || message.senderAvatar}
                  alt=""
                  className="w-3.5 h-3.5 rounded-full object-cover"
                />
              )}
              <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                {senderUser?.displayName || message.senderName || 'Member'}
              </span>
            </div>
          )}

          {/* Forwarded Header */}
          {message.isForwarded && (
            <div className={`flex items-center gap-1 text-[10px] mb-1 italic ${isMe ? 'text-indigo-200' : 'text-neutral-400'}`}>
              <CornerUpLeft className="w-3 h-3" />
              <span>Forwarded</span>
            </div>
          )}

          {/* Replied Message Quote banner */}
          {message.replyTo && (
            <div
              className={`mb-2 p-2 rounded-lg text-xs border-l-3 ${
                isMe
                  ? 'bg-indigo-700/60 border-indigo-300 text-indigo-100'
                  : 'bg-neutral-100 dark:bg-neutral-900/60 border-indigo-500 text-neutral-600 dark:text-neutral-300'
              }`}
            >
              <p className="font-bold text-[11px] leading-tight mb-0.5 opacity-90">
                {message.replyTo.senderName}
              </p>
              <p className="line-clamp-1 italic text-[11px] opacity-80">
                {message.replyTo.text}
              </p>
            </div>
          )}

          {/* Media Attachments */}
          {message.fileUrl && (
            <div className="mb-2">
              {message.fileType === 'image' && (
                <div className="rounded-xl overflow-hidden max-w-sm max-h-72 bg-black/10">
                  <img
                    src={message.fileUrl}
                    alt={message.fileName || 'Attachment'}
                    className="w-full h-full object-cover cursor-pointer hover:opacity-95 transition"
                    onClick={() => window.open(message.fileUrl, '_blank')}
                  />
                </div>
              )}

              {message.fileType === 'video' && (
                <div className="rounded-xl overflow-hidden max-w-sm max-h-72 bg-black">
                  <video
                    src={message.fileUrl}
                    controls
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              {message.fileType === 'audio' && (
                <div className="p-2 rounded-xl bg-black/10 dark:bg-white/5 flex items-center gap-3 min-w-[240px]">
                  <audio src={message.fileUrl} controls className="w-full h-8" />
                </div>
              )}

              {(message.fileType === 'document' || message.fileType === 'other') && (
                <a
                  href={message.fileUrl}
                  download={message.fileName || 'file'}
                  target="_blank"
                  rel="noreferrer"
                  className={`flex items-center gap-3 p-3 rounded-xl transition ${
                    isMe
                      ? 'bg-indigo-700/60 hover:bg-indigo-700 text-white'
                      : 'bg-neutral-100 dark:bg-neutral-700/50 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-900 dark:text-white'
                  }`}
                >
                  <div className="p-2 bg-indigo-500/20 rounded-lg shrink-0">
                    <FileText className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate">{message.fileName || 'Document'}</p>
                    <p className="text-[10px] opacity-75">{formatFileSize(message.fileSize)}</p>
                  </div>
                  <Download className="w-4 h-4 shrink-0 opacity-80" />
                </a>
              )}
            </div>
          )}

          {/* Text Message */}
          {isEditing ? (
            <form onSubmit={handleSaveEdit} className="flex flex-col gap-2 mt-1">
              <input
                type="text"
                value={editText}
                onChange={e => setEditText(e.target.value)}
                className="p-1.5 text-xs text-neutral-900 bg-white rounded-lg outline-none"
                autoFocus
              />
              <div className="flex justify-end gap-1.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-2 py-0.5 text-neutral-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-2.5 py-0.5 bg-white text-indigo-700 font-semibold rounded-md shadow-xs"
                >
                  Save
                </button>
              </div>
            </form>
          ) : (
            <p className={`text-xs sm:text-sm leading-relaxed whitespace-pre-wrap break-words ${
              message.isDeletedForEveryone ? 'italic opacity-60' : ''
            }`}>
              {message.text}
            </p>
          )}

          {/* Footer: Timestamp, Edited badge, Read ticks */}
          <div
            className={`flex items-center justify-end gap-1.5 mt-1 text-[10px] ${
              isMe ? 'text-indigo-200' : 'text-neutral-500 dark:text-neutral-400 font-medium'
            }`}
          >
            {message.isEdited && <span>(edited)</span>}
            <span title={formatMessageFullDateTime(message.createdAt)}>
              {formatMessageTime(message.createdAt)}
            </span>

            {isMe && (
              <span>
                {message.status === 'sent' && <Check className="w-3 h-3 text-indigo-300" />}
                {message.status === 'delivered' && (
                  <CheckCheck className="w-3.5 h-3.5 text-indigo-300" />
                )}
                {message.status === 'read' && (
                  <CheckCheck className="w-3.5 h-3.5 text-cyan-300 font-bold" />
                )}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Emoji Reactions Pill Bar */}
      {message.reactions && message.reactions.length > 0 && (
        <div
          className={`flex flex-wrap gap-1 mt-1 z-0 ${
            isMe ? 'justify-end pr-2' : 'justify-start pl-2'
          }`}
        >
          {Array.from(new Set(message.reactions.map(r => r.emoji))).map(emoji => {
            const count = message.reactions.filter(r => r.emoji === emoji).length;
            const reactedByMe = message.reactions.some(
              r => r.emoji === emoji && r.userId === currentUserId
            );
            return (
              <button
                key={emoji}
                onClick={() => onReact(message._id, emoji)}
                className={`text-[11px] px-2 py-0.5 rounded-full border flex items-center gap-1 shadow-xs transition ${
                  reactedByMe
                    ? 'bg-indigo-50 dark:bg-indigo-950 border-indigo-400 text-indigo-600 dark:text-indigo-300 font-bold'
                    : 'bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300'
                }`}
              >
                <span>{emoji}</span>
                {count > 1 && <span>{count}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
