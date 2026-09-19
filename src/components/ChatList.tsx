import React, { useState } from 'react';
import {
  Search,
  Plus,
  Check,
  CheckCheck,
  Image,
  FileText,
  Mic,
  Video,
  Users,
  ShieldCheck,
  Bookmark,
  Phone,
  PhoneCall,
  PhoneMissed,
  PhoneOutgoing,
  PhoneOff,
  Moon,
  Sun,
  Settings,
} from 'lucide-react';
import { Conversation, User } from '../types';
import { useSocket } from '../context/SocketContext';
import { useTheme } from '../context/ThemeContext';
import { formatConversationListDate, formatMessageFullDateTime } from '../utils/date';

interface ChatListProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  currentUserId: string;
  onSelectConversation: (id: string) => void;
  onOpenSearchModal: () => void;
  onOpenCreateGroupModal?: () => void;
  onOpenSelfChat?: () => void;
  currentUser?: User;
  onOpenProfileModal?: () => void;
  onOpenSettingsModal?: () => void;
}

export const ChatList: React.FC<ChatListProps> = ({
  conversations,
  activeConversationId,
  currentUserId,
  onSelectConversation,
  onOpenSearchModal,
  onOpenCreateGroupModal,
  onOpenSelfChat,
  currentUser,
  onOpenProfileModal,
  onOpenSettingsModal,
}) => {
  const [filterText, setFilterText] = useState('');
  const [tabFilter, setTabFilter] = useState<'all' | 'direct' | 'groups'>('all');
  const { onlineUsers, typingUsers } = useSocket();
  const { theme, toggleTheme, isDark } = useTheme();

  const filtered = conversations.filter(conv => {
    // Tab filter
    if (tabFilter === 'direct' && conv.isGroup) return false;
    if (tabFilter === 'groups' && !conv.isGroup) return false;

    const query = filterText.toLowerCase().trim();
    if (!query) return true;

    const isSelf = !!conv.isSelf || (conv.participants?.length === 1 && conv.participants[0] === currentUserId);
    if (isSelf) {
      return (
        'message yourself'.includes(query) ||
        'self'.includes(query) ||
        'you'.includes(query) ||
        'notes'.includes(query) ||
        'saved'.includes(query)
      );
    }

    if (conv.isGroup) {
      const groupName = (conv.name || '').toLowerCase();
      const groupDesc = (conv.description || '').toLowerCase();
      return groupName.includes(query) || groupDesc.includes(query);
    }

    const partner = conv.otherUser;
    if (!partner) return false;
    const name = partner.displayName.toLowerCase();
    const username = partner.username.toLowerCase();
    return name.includes(query) || username.includes(query);
  });

  const totalGroups = conversations.filter(c => c.isGroup).length;
  const totalDirect = conversations.filter(c => !c.isGroup).length;

  return (
    <div className="w-full md:w-72 lg:w-80 xl:w-96 border-r border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex flex-col h-full shrink-0">
      {/* Top Header */}
      <div className="p-3 sm:p-4 border-b border-neutral-200/80 dark:border-neutral-800 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Mobile Profile Avatar Trigger */}
          {currentUser && onOpenProfileModal && (
            <button
              onClick={onOpenProfileModal}
              className="md:hidden relative shrink-0 p-0.5 rounded-xl hover:ring-2 hover:ring-indigo-500/50 transition cursor-pointer"
              title="View profile & account"
            >
              <img
                src={
                  currentUser.avatar ||
                  `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser.username}`
                }
                alt={currentUser.displayName}
                className="w-9 h-9 rounded-xl object-cover ring-1 ring-neutral-300 dark:ring-neutral-700"
              />
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white dark:border-neutral-900 rounded-full" />
            </button>
          )}

          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-neutral-900 dark:text-neutral-100 truncate">
              Chats
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* Mobile Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="md:hidden p-1.5 sm:p-2 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-200 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition cursor-pointer"
            title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Mobile Settings */}
          {onOpenSettingsModal && (
            <button
              onClick={onOpenSettingsModal}
              className="md:hidden p-1.5 sm:p-2 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-200 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition cursor-pointer"
              title="Settings & themes"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}

          {/* Plus (+) Button to Create Group */}
          {onOpenCreateGroupModal && (
            <button
              onClick={onOpenCreateGroupModal}
              className="p-1.5 sm:px-2.5 sm:py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition flex items-center gap-1 text-xs font-semibold shadow-xs cursor-pointer"
              title="Create New Group"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">New Group</span>
            </button>
          )}
        </div>
      </div>

      {/* Search Input */}
      <div className="p-3 border-b border-neutral-100 dark:border-neutral-800 space-y-2">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-neutral-400" />
          <input
            type="text"
            value={filterText}
            onChange={e => setFilterText(e.target.value)}
            placeholder="Search chats or groups..."
            className="w-full pl-10 pr-3 py-2 bg-neutral-100 dark:bg-neutral-800/80 rounded-xl text-xs sm:text-sm text-neutral-900 dark:text-neutral-100 outline-none focus:ring-1 focus:ring-indigo-500 transition"
          />
        </div>

        {/* Quick Filter Tabs */}
        <div className="flex items-center gap-1 pt-1">
          <button
            onClick={() => setTabFilter('all')}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
              tabFilter === 'all'
                ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                : 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
          >
            All ({conversations.length})
          </button>
          <button
            onClick={() => setTabFilter('direct')}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
              tabFilter === 'direct'
                ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                : 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
          >
            Direct ({totalDirect})
          </button>
          <button
            onClick={() => setTabFilter('groups')}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition flex items-center gap-1 ${
              tabFilter === 'groups'
                ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                : 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
          >
            <Users className="w-3 h-3" />
            Groups ({totalGroups})
          </button>
        </div>
      </div>

      {/* Conversations Stream */}
      <div className="flex-1 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800/50 pb-20 md:pb-2">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-neutral-400 space-y-3">
            <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
              No conversations found
            </p>
            <p className="text-xs text-neutral-500">
              {tabFilter === 'groups'
                ? 'Create a group to start collaborating with up to 100 members!'
                : 'Search users by username to send a contact request and start chatting.'}
            </p>
            <div className="flex items-center justify-center gap-2 pt-2">
              {onOpenCreateGroupModal && (
                <button
                  onClick={onOpenCreateGroupModal}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition"
                >
                  <Users className="w-3.5 h-3.5" />
                  Create Group
                </button>
              )}
              <button
                onClick={onOpenSearchModal}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                Find People
              </button>
            </div>
          </div>
        ) : (
          filtered.map(conv => {
            const isGroup = !!conv.isGroup;
            const isSelf = !!conv.isSelf || (conv.participants?.length === 1 && conv.participants[0] === currentUserId);
            const partner = conv.otherUser;

            // For self, group or 1-on-1
            const displayName = isSelf
              ? 'Message yourself'
              : isGroup
              ? (conv.name || 'Group Chat')
              : (partner?.displayName || 'Chat');

            const avatarUrl = isSelf
              ? (conv.participantDetails?.find(p => p._id === currentUserId)?.avatar || partner?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=user`)
              : isGroup
              ? (conv.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(conv.name || 'group')}`)
              : (partner?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${partner?.username || 'user'}`);

            const isOnline = !isGroup && !isSelf && partner ? (onlineUsers[partner._id]?.isOnline ?? partner.isOnline) : false;
            const isTyping = typingUsers[conv._id] !== undefined;
            const isSelected = activeConversationId === conv._id;
            const lastMsg = conv.lastMessage;
            const isLastMsgMine = lastMsg?.sender === currentUserId;

            return (
              <div
                key={conv._id}
                onClick={() => onSelectConversation(conv._id)}
                className={`flex items-center gap-3 p-3.5 cursor-pointer transition select-none ${
                  isSelected
                    ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-l-4 border-indigo-600'
                    : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/50'
                }`}
              >
                {/* Avatar with group badge, self bookmark, or online indicator */}
                <div className="relative shrink-0">
                  <img
                    src={avatarUrl}
                    alt={displayName}
                    className={`w-12 h-12 object-cover border border-neutral-200 dark:border-neutral-700 ${
                      isGroup ? 'rounded-2xl' : 'rounded-full'
                    }`}
                  />
                  {isGroup ? (
                    <span
                      title="Group Chat (Limit 100 members)"
                      className="absolute -bottom-1 -right-1 w-5 h-5 bg-indigo-600 border-2 border-white dark:border-neutral-900 rounded-full flex items-center justify-center text-white"
                    >
                      <Users className="w-2.5 h-2.5" />
                    </span>
                  ) : isSelf ? (
                    <span
                      title="Message yourself"
                      className="absolute -bottom-1 -right-1 w-5 h-5 bg-indigo-600 border-2 border-white dark:border-neutral-900 rounded-full flex items-center justify-center text-white"
                    >
                      <Bookmark className="w-2.5 h-2.5" />
                    </span>
                  ) : isOnline ? (
                    <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-white dark:border-neutral-900 rounded-full" />
                  ) : null}
                </div>

                {/* Info & Last message snippet */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <h3 className="text-xs sm:text-sm font-bold text-neutral-900 dark:text-neutral-100 truncate">
                        {displayName}
                      </h3>
                      {isGroup ? (
                        <span className="text-[10px] px-1.5 py-0.2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-sm font-semibold border border-indigo-200 dark:border-indigo-800 shrink-0">
                          {conv.participants?.length || 0}/100
                        </span>
                      ) : isSelf ? (
                        <span className="text-[10px] px-1.5 py-0.2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-sm font-semibold border border-indigo-200 dark:border-indigo-800 shrink-0">
                          You
                        </span>
                      ) : null}
                    </div>
                    {lastMsg && (
                      <span
                        className={`text-[10px] shrink-0 ml-2 ${
                          conv.unreadCount > 0
                            ? 'text-rose-600 dark:text-rose-400 font-bold'
                            : 'text-neutral-400 dark:text-neutral-500 font-medium'
                        }`}
                        title={formatMessageFullDateTime(lastMsg.createdAt)}
                      >
                        {formatConversationListDate(lastMsg.createdAt)}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-1">
                    {isTyping ? (
                      <p className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold animate-pulse">
                        typing...
                      </p>
                    ) : lastMsg ? (
                      <div className={`flex items-center gap-1 text-xs truncate ${
                        conv.unreadCount > 0
                          ? 'text-neutral-900 dark:text-neutral-100 font-medium'
                          : 'text-neutral-500 dark:text-neutral-400'
                      }`}>
                        {lastMsg.callInfo ? (
                          (() => {
                            const isCallCaller = lastMsg.callInfo.callerId === currentUserId;
                            const isAccepted = lastMsg.callInfo.status === 'accepted';
                            const isRejected = lastMsg.callInfo.status === 'rejected';

                            let icon = lastMsg.callInfo.callType === 'video' ? (
                              <Video className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                            ) : (
                              <Phone className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            );
                            let statusText = 'Accepted';
                            let statusClass = 'text-emerald-600 dark:text-emerald-400 font-semibold';

                            if (isAccepted) {
                              statusText = 'Accepted';
                              statusClass = 'text-emerald-600 dark:text-emerald-400 font-semibold';
                            } else if (isRejected) {
                              statusText = isCallCaller ? 'Declined' : 'Declined';
                              statusClass = 'text-amber-600 dark:text-amber-400 font-semibold';
                            } else {
                              // not accepted / missed
                              if (isCallCaller) {
                                icon = <PhoneOutgoing className="w-3.5 h-3.5 text-neutral-400 shrink-0" />;
                                statusText = 'Outgoing unanswered';
                                statusClass = 'text-neutral-500 dark:text-neutral-400 font-medium';
                              } else {
                                icon = <PhoneMissed className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />;
                                statusText = 'Missed call';
                                statusClass = 'text-rose-600 dark:text-rose-400 font-bold';
                              }
                            }

                            return (
                              <span className="flex items-center gap-1 font-medium truncate">
                                {icon}
                                <span className={statusClass}>
                                  {lastMsg.callInfo.callType === 'video' ? 'Video Call' : 'Voice Call'} ({statusText})
                                </span>
                              </span>
                            );
                          })()
                        ) : lastMsg.text && (lastMsg.text.startsWith('Voice Call') || lastMsg.text.startsWith('Video Call')) ? (
                          (() => {
                            const isCallCaller = isLastMsgMine;
                            const isAccepted = lastMsg.text.includes('Accepted') || lastMsg.text.includes('Ended');
                            const isRejected = lastMsg.text.includes('Declined') || lastMsg.text.includes('Rejected') || lastMsg.text.includes('Cancelled');

                            let statusClass = 'text-emerald-600 dark:text-emerald-400 font-semibold';
                            let icon = lastMsg.text.includes('Video') ? (
                              <Video className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                            ) : (
                              <Phone className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            );

                            if (isAccepted) {
                              statusClass = 'text-emerald-600 dark:text-emerald-400 font-semibold';
                            } else if (isRejected) {
                              statusClass = 'text-amber-600 dark:text-amber-400 font-semibold';
                            } else {
                              if (isCallCaller) {
                                icon = <PhoneOutgoing className="w-3.5 h-3.5 text-neutral-400 shrink-0" />;
                                statusClass = 'text-neutral-500 dark:text-neutral-400 font-medium';
                              } else {
                                icon = <PhoneMissed className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />;
                                statusClass = 'text-rose-600 dark:text-rose-400 font-bold';
                              }
                            }

                            return (
                              <span className="flex items-center gap-1 font-medium truncate">
                                {icon}
                                <span className={statusClass}>
                                  {lastMsg.text}
                                </span>
                              </span>
                            );
                          })()
                        ) : (
                          <>
                            {isLastMsgMine ? (
                              <span className="shrink-0">
                                {lastMsg.status === 'read' ? (
                                  <CheckCheck className="w-3 h-3 text-cyan-500" />
                                ) : lastMsg.status === 'delivered' ? (
                                  <CheckCheck className="w-3 h-3 text-neutral-400" />
                                ) : (
                                  <Check className="w-3 h-3 text-neutral-400" />
                                )}
                              </span>
                            ) : isGroup && lastMsg.senderName ? (
                              <span className="font-semibold text-neutral-700 dark:text-neutral-300 shrink-0">
                                {lastMsg.senderName.split(' ')[0]}:
                              </span>
                            ) : null}

                            {lastMsg.fileType === 'image' && (
                              <span className="flex items-center gap-1 text-neutral-600 dark:text-neutral-300">
                                <Image className="w-3.5 h-3.5 text-emerald-500" /> Photo
                              </span>
                            )}
                            {lastMsg.fileType === 'video' && (
                              <span className="flex items-center gap-1 text-neutral-600 dark:text-neutral-300">
                                <Video className="w-3.5 h-3.5 text-indigo-500" /> Video
                              </span>
                            )}
                            {lastMsg.fileType === 'audio' && (
                              <span className="flex items-center gap-1 text-neutral-600 dark:text-neutral-300">
                                <Mic className="w-3.5 h-3.5 text-amber-500" /> Voice note
                              </span>
                            )}
                            {lastMsg.fileType === 'document' && (
                              <span className="flex items-center gap-1 text-neutral-600 dark:text-neutral-300">
                                <FileText className="w-3.5 h-3.5 text-indigo-500" /> Document
                              </span>
                            )}

                            {(!lastMsg.fileType || lastMsg.text) && (
                              <span className="truncate">{lastMsg.text}</span>
                            )}
                          </>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-neutral-400 italic">
                        {isSelf ? 'Save personal notes & media' : 'No messages yet'}
                      </p>
                    )}

                    {/* Unread badge */}
                    {conv.unreadCount > 0 && (
                      <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-600 text-white shadow-xs animate-pulse">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
