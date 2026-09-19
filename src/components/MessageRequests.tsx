import React, { useEffect, useState } from 'react';
import { Check, X, Clock, MessageSquareQuote, ShieldAlert, Sparkles, UserCheck } from 'lucide-react';
import { api } from '../services/api';
import { FriendRequest } from '../types';

interface MessageRequestsProps {
  onOpenConversation: (conversationId: string) => void;
  onRequestHandled?: () => void;
}

export const MessageRequests: React.FC<MessageRequestsProps> = ({ onOpenConversation, onRequestHandled }) => {
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [bannerNotice, setBannerNotice] = useState<string | null>(null);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const data = await api.contacts.getRequests();
      setRequests(data.requests);
    } catch (err) {
      console.error('Failed to load message requests:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleAccept = async (requestId: string) => {
    setActionInProgress(requestId);
    try {
      const res = await api.contacts.acceptRequest(requestId);
      setRequests(prev => prev.filter(r => r._id !== requestId));
      setBannerNotice('Contact request accepted! Unlimited messaging and calls are now enabled.');
      onRequestHandled?.();
      setTimeout(() => setBannerNotice(null), 4000);
      if (res.conversationId) {
        onOpenConversation(res.conversationId);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to accept request');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleReject = async (requestId: string) => {
    setActionInProgress(requestId);
    try {
      await api.contacts.rejectRequest(requestId);
      setRequests(prev => prev.filter(r => r._id !== requestId));
      setBannerNotice('Contact request rejected. Conversation will remain blocked.');
      onRequestHandled?.();
      setTimeout(() => setBannerNotice(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to reject request');
    } finally {
      setActionInProgress(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-neutral-50/50 dark:bg-neutral-900/50 overflow-y-auto p-4 sm:p-6 pb-24 md:pb-6">
      {/* Top Banner Notice */}
      <div className="max-w-3xl mx-auto w-full mb-6">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2.5">
              <span>Message Requests</span>
              {requests.length > 0 && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-600 text-white">
                  {requests.length}
                </span>
              )}
            </h1>
            <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-1">
              People who want to connect with you. Review their introductory message before granting contact access.
            </p>
          </div>
          <button
            onClick={fetchRequests}
            className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
          >
            Refresh
          </button>
        </div>

        {/* Security Rule Pill */}
        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300">
          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <span>
            <strong>Safety Rule:</strong> Senders cannot message you further or make voice/video calls until you accept their contact request.
          </span>
        </div>

        {bannerNotice && (
          <div className="mt-3 p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 rounded-xl text-xs flex items-center gap-2">
            <Sparkles className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{bannerNotice}</span>
          </div>
        )}
      </div>

      {/* List */}
      <div className="max-w-3xl mx-auto w-full space-y-4">
        {loading && (
          <div className="space-y-3">
            {[1, 2].map(n => (
              <div key={n} className="h-32 bg-neutral-200 dark:bg-neutral-800 rounded-2xl animate-pulse" />
            ))}
          </div>
        )}

        {!loading && requests.length === 0 && (
          <div className="text-center py-16 bg-white dark:bg-neutral-800/40 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-8 shadow-xs">
            <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-950/60 rounded-full flex items-center justify-center mx-auto mb-4 text-indigo-600 dark:text-indigo-400">
              <UserCheck className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-neutral-800 dark:text-neutral-200">No pending message requests</h3>
            <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 max-w-md mx-auto mt-1">
              When new people search your username and want to connect, their requests and introductory messages will appear here.
            </p>
          </div>
        )}

        {requests.map(req => {
          const sender = typeof req.sender === 'object' ? req.sender : null;
          return (
            <div
              key={req._id}
              className="bg-white dark:bg-neutral-800/80 rounded-2xl p-5 border border-neutral-200/80 dark:border-neutral-700/80 shadow-xs hover:shadow-md transition flex flex-col gap-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="relative">
                    <img
                      src={sender?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${sender?.username || 'user'}`}
                      alt={sender?.username || 'Sender'}
                      className="w-12 h-12 rounded-full object-cover border border-neutral-200 dark:border-neutral-700 shadow-xs"
                    />
                    {sender?.isOnline && (
                      <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-white dark:border-neutral-800 rounded-full" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                      {sender?.displayName || sender?.username}
                    </h3>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">@{sender?.username}</p>
                    {sender?.bio && (
                      <p className="text-xs text-neutral-600 dark:text-neutral-300 mt-1 line-clamp-1">
                        {sender.bio}
                      </p>
                    )}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-[11px] text-neutral-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(req.createdAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>

              {/* Introductory message */}
              {req.introMessage ? (
                <div className="p-3.5 bg-neutral-50 dark:bg-neutral-900/60 rounded-xl border border-neutral-200/60 dark:border-neutral-700/60 flex items-start gap-3">
                  <MessageSquareQuote className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wide block mb-0.5">
                      Introductory Message
                    </span>
                    <p className="text-xs sm:text-sm text-neutral-800 dark:text-neutral-200 italic leading-relaxed">
                      &quot;{req.introMessage}&quot;
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-neutral-500 italic bg-neutral-50 dark:bg-neutral-900/40 p-2.5 rounded-lg border border-dashed border-neutral-200 dark:border-neutral-800">
                  No introductory message attached.
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                <button
                  disabled={actionInProgress === req._id}
                  onClick={() => handleReject(req._id)}
                  className="flex-1 sm:flex-initial px-4 py-2 border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition disabled:opacity-50"
                >
                  <X className="w-3.5 h-3.5 text-rose-500" />
                  Decline
                </button>
                <button
                  disabled={actionInProgress === req._id}
                  onClick={() => handleAccept(req._id)}
                  className="flex-1 sm:flex-initial px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5" />
                  {actionInProgress === req._id ? 'Accepting...' : 'Accept Request'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
