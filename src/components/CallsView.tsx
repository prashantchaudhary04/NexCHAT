import React, { useEffect, useState } from 'react';
import { Phone, Video, PhoneIncoming, PhoneOutgoing, PhoneMissed, PhoneOff, PhoneCall, Clock, Users } from 'lucide-react';
import { api } from '../services/api';
import { CallLog, User } from '../types';
import { useSocket } from '../context/SocketContext';

interface CallsViewProps {
  currentUser: User;
}

export const CallsView: React.FC<CallsViewProps> = ({ currentUser }) => {
  const [calls, setCalls] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'missed'>('all');
  const { startCall, startGroupCall } = useSocket();

  useEffect(() => {
    async function fetchCalls() {
      try {
        setLoading(true);
        const data = await api.calls.getHistory();
        setCalls(data.calls);
      } catch (err) {
        console.error('Failed to load call history:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchCalls();
  }, []);

  const formatDuration = (secs?: number) => {
    if (!secs) return '0s';
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    if (mins === 0) return `${rem}s`;
    return `${mins}m ${rem}s`;
  };

  const missedCount = calls.filter(call => {
    const caller = typeof call.caller === 'object' ? call.caller : null;
    const callerId = caller?._id || call.callerId || (typeof call.caller === 'string' ? call.caller : '');
    const isCaller = call.isCaller !== undefined ? call.isCaller : callerId === currentUser._id;
    return !isCaller && (call.status === 'not_accepted' || call.status === 'missed');
  }).length;

  const filteredCalls = calls.filter(call => {
    if (filter === 'all') return true;
    const caller = typeof call.caller === 'object' ? call.caller : null;
    const callerId = caller?._id || call.callerId || (typeof call.caller === 'string' ? call.caller : '');
    const isCaller = call.isCaller !== undefined ? call.isCaller : callerId === currentUser._id;
    return !isCaller && (call.status === 'not_accepted' || call.status === 'missed');
  });

  return (
    <div className="flex-1 flex flex-col h-full bg-neutral-50/50 dark:bg-neutral-900/50 overflow-y-auto p-4 sm:p-6 pb-24 md:pb-6">
      <div className="max-w-3xl mx-auto w-full mb-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
              <span>Call History</span>
              <Phone className="w-5 h-5 text-indigo-500" />
            </h1>
            <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-1">
              Recent voice and video calls from 1-on-1 chats and group channels.
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 p-1 bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200/80 dark:border-neutral-700/80 shadow-xs">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                filter === 'all'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100'
              }`}
            >
              All Calls
            </button>
            <button
              type="button"
              onClick={() => setFilter('missed')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                filter === 'missed'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40'
              }`}
            >
              <PhoneMissed className="w-3.5 h-3.5" />
              <span>Missed</span>
              {missedCount > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  filter === 'missed' ? 'bg-white/20 text-white' : 'bg-rose-600 text-white'
                }`}>
                  {missedCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto w-full">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(n => (
              <div key={n} className="h-16 bg-neutral-200 dark:bg-neutral-800 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : filteredCalls.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-neutral-800/40 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-8">
            <Phone className="w-12 h-12 text-indigo-400 mx-auto mb-3 opacity-60" />
            <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
              {filter === 'missed' ? 'No missed calls' : 'No calls yet'}
            </h3>
            <p className="text-xs sm:text-sm text-neutral-500 mt-1">
              {filter === 'missed'
                ? 'You have answered all incoming calls or have no missed calls.'
                : 'Voice and video calls with your contacts and groups will be logged here.'}
            </p>
          </div>
        ) : (
          <div className="bg-white dark:bg-neutral-800/80 rounded-2xl border border-neutral-200/80 dark:border-neutral-700/80 divide-y divide-neutral-100 dark:divide-neutral-700/60 shadow-xs overflow-hidden">
            {filteredCalls.map(call => {
              const isGroup = !!call.isGroup;
              const caller = typeof call.caller === 'object' ? call.caller : null;
              const receiver = typeof call.receiver === 'object' ? call.receiver : null;
              const callerId =
                caller?._id ||
                call.callerId ||
                (typeof call.caller === 'string' ? call.caller : '');
              const isCaller =
                call.isCaller !== undefined ? call.isCaller : callerId === currentUser._id;
              const peer = isCaller ? receiver : caller;

              const isMissed = !isCaller && (call.status === 'not_accepted' || call.status === 'missed');

              const title = isGroup
                ? call.groupName || 'Group Call'
                : peer?.displayName || peer?.username || (isCaller ? 'Outgoing Call' : 'Incoming Call');

              const avatarSrc = isGroup
                ? `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(call.groupName || 'group')}`
                : peer?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${peer?.username || 'user'}`;

              return (
                <div
                  key={call._id}
                  className={`p-4 flex items-center justify-between gap-3 transition ${
                    isMissed
                      ? 'bg-rose-50/40 dark:bg-rose-950/20 border-l-4 border-l-rose-500'
                      : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/50'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative shrink-0">
                      <img
                        src={avatarSrc}
                        alt={title}
                        className={`w-11 h-11 rounded-full object-cover border bg-neutral-100 dark:bg-neutral-800 ${
                          isMissed
                            ? 'border-rose-300 dark:border-rose-800 ring-2 ring-rose-500/20'
                            : 'border-neutral-200 dark:border-neutral-700'
                        }`}
                      />
                      {/* Direction & Status badge overlay on avatar */}
                      <span
                        className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-white border-2 border-white dark:border-neutral-800 shadow-xs ${
                          isCaller
                            ? 'bg-blue-600'
                            : isMissed
                            ? 'bg-rose-600'
                            : 'bg-emerald-600'
                        }`}
                        title={
                          isCaller
                            ? 'Outgoing Call'
                            : isMissed
                            ? 'Missed Incoming Call'
                            : 'Incoming Call'
                        }
                      >
                        {isCaller ? (
                          <PhoneOutgoing className="w-2.5 h-2.5" />
                        ) : isMissed ? (
                          <PhoneMissed className="w-2.5 h-2.5" />
                        ) : (
                          <PhoneIncoming className="w-2.5 h-2.5" />
                        )}
                      </span>
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4
                          className={`text-sm font-bold truncate ${
                            isMissed
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-neutral-900 dark:text-neutral-100'
                          }`}
                        >
                          {title}
                        </h4>

                        {/* Call Direction Badge: Outgoing or Incoming or Missed */}
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                            isCaller
                              ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800/60 text-blue-700 dark:text-blue-300'
                              : isMissed
                              ? 'bg-rose-100 dark:bg-rose-950/60 border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300'
                              : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300'
                          }`}
                        >
                          {isCaller ? (
                            <>
                              <PhoneOutgoing className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                              <span>Outgoing</span>
                            </>
                          ) : isMissed ? (
                            <>
                              <PhoneMissed className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                              <span>Missed</span>
                            </>
                          ) : (
                            <>
                              <PhoneIncoming className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                              <span>Incoming</span>
                            </>
                          )}
                        </span>

                        <span className="text-[10px] px-2 py-0.5 rounded-md font-medium uppercase tracking-wider bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300">
                          {isGroup ? `Group ${call.callType}` : call.callType}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 mt-1 text-xs text-neutral-500 dark:text-neutral-400 flex-wrap">
                        {isCaller ? (
                          call.status === 'accepted' ? (
                            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                              <PhoneCall className="w-3.5 h-3.5" /> Outgoing answered
                            </span>
                          ) : call.status === 'rejected' ? (
                            <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                              <PhoneOff className="w-3.5 h-3.5" /> Outgoing declined
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-neutral-500 dark:text-neutral-400 font-medium">
                              <PhoneOutgoing className="w-3.5 h-3.5 text-neutral-400" /> Outgoing unanswered
                            </span>
                          )
                        ) : (
                          call.status === 'accepted' ? (
                            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                              <PhoneCall className="w-3.5 h-3.5" /> Incoming answered
                            </span>
                          ) : call.status === 'rejected' ? (
                            <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                              <PhoneOff className="w-3.5 h-3.5" /> Incoming declined
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400 font-bold">
                              <PhoneMissed className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" /> Missed call
                            </span>
                          )
                        )}

                        <span>•</span>
                        <span>{formatDuration(call.duration)}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(call.createdAt).toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        if (isGroup && call.conversationId) {
                          startGroupCall(
                            {
                              _id: call.conversationId,
                              name: call.groupName,
                              participants: call.participants || [],
                            },
                            'audio'
                          );
                        } else if (peer) {
                          startCall(peer, 'audio', call.conversationId);
                        }
                      }}
                      className="p-2 border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-xl text-emerald-600 dark:text-emerald-400 transition"
                      title={isGroup ? 'Start Group Voice Call' : 'Voice Call'}
                    >
                      <Phone className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (isGroup && call.conversationId) {
                          startGroupCall(
                            {
                              _id: call.conversationId,
                              name: call.groupName,
                              participants: call.participants || [],
                            },
                            'video'
                          );
                        } else if (peer) {
                          startCall(peer, 'video', call.conversationId);
                        }
                      }}
                      className="p-2 border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-xl text-indigo-600 dark:text-indigo-400 transition"
                      title={isGroup ? 'Start Group Video Call' : 'Video Call'}
                    >
                      <Video className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
