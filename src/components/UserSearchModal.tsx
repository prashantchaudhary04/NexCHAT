import React, { useState } from 'react';
import { Search, UserPlus, Check, Clock, X, MessageSquare, AlertCircle, Bookmark } from 'lucide-react';
import { api } from '../services/api';
import { User } from '../types';

interface UserSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectUserToChat?: (userId: string) => void;
  onOpenSelfChat?: () => void;
}

export const UserSearchModal: React.FC<UserSearchModalProps> = ({
  isOpen,
  onClose,
  onSelectUserToChat,
  onOpenSelfChat,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedForRequest, setSelectedForRequest] = useState<string | null>(null);
  const [introMessage, setIntroMessage] = useState('');
  const [sendingRequest, setSendingRequest] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsSearching(true);
    setErrorMessage(null);
    try {
      const data = await api.auth.searchUsers(query.trim());
      setResults(data.users);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to search users');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSendRequest = async (receiverId: string) => {
    setSendingRequest(true);
    setErrorMessage(null);
    try {
      await api.contacts.sendRequest(receiverId, introMessage.trim() || undefined);
      setSuccessMessage('Contact request sent with introductory message!');
      setSelectedForRequest(null);
      setIntroMessage('');

      // Update result state to request_sent
      setResults(prev =>
        prev.map(u => (u._id === receiverId ? { ...u, relationship: 'request_sent' } : u))
      );
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to send request');
    } finally {
      setSendingRequest(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-neutral-900 w-full max-w-lg rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">Find & Connect</h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">Search users by unique username to send a contact request</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Input */}
        <div className="p-4 border-b border-neutral-100 dark:border-neutral-800">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-neutral-400" />
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search username (e.g. sarah_art, alex_dev)..."
                className="w-full pl-10 pr-4 py-2.5 bg-neutral-100 dark:bg-neutral-800 border border-transparent focus:border-indigo-500 focus:bg-white dark:focus:bg-neutral-900 rounded-xl text-sm text-neutral-900 dark:text-neutral-100 outline-none transition"
              />
            </div>
            <button
              type="submit"
              disabled={isSearching || !query.trim()}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition flex items-center gap-2"
            >
              {isSearching ? 'Searching...' : 'Search'}
            </button>
          </form>

          {successMessage && (
            <div className="mt-3 p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs flex items-center gap-2 border border-emerald-200 dark:border-emerald-800">
              <Check className="w-4 h-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="mt-3 p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 rounded-xl text-xs flex items-center gap-2 border border-rose-200 dark:border-rose-800">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {onOpenSelfChat && !query.trim() && (
            <button
              type="button"
              onClick={() => {
                onOpenSelfChat();
                onClose();
              }}
              className="w-full p-3.5 bg-indigo-50/60 dark:bg-indigo-950/40 hover:bg-indigo-100/70 dark:hover:bg-indigo-900/60 border border-indigo-200/80 dark:border-indigo-800/80 rounded-2xl flex items-center justify-between text-left transition group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
                  <Bookmark className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                    <span>Message yourself</span>
                    <span className="text-[10px] px-1.5 py-0.2 bg-indigo-100 dark:bg-indigo-900/80 text-indigo-700 dark:text-indigo-300 rounded-sm font-semibold">You</span>
                  </h4>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">Save notes, photos, links, or files</p>
                </div>
              </div>
              <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 group-hover:translate-x-0.5 transition-transform">
                Open &rarr;
              </span>
            </button>
          )}

          {results.length === 0 && !isSearching && query.trim() && (
            <div className="text-center py-10 text-neutral-400">
              <p className="text-sm">No users found matching &quot;{query}&quot;</p>
              <p className="text-xs text-neutral-500 mt-1">Try searching for &quot;sarah_art&quot;, &quot;marcus_tech&quot;, or &quot;alex_dev&quot;</p>
            </div>
          )}

          {results.length === 0 && !isSearching && !query.trim() && (
            <div className="text-center py-10 text-neutral-400">
              <Search className="w-8 h-8 mx-auto mb-2 opacity-40 text-indigo-500" />
              <p className="text-sm font-medium">Search for people to expand your network</p>
              <p className="text-xs text-neutral-500 mt-1">Enter a username to send a contact request with an optional introductory message.</p>
            </div>
          )}

          {results.map(user => (
            <div
              key={user._id}
              className="p-3.5 bg-neutral-50 dark:bg-neutral-800/60 rounded-xl border border-neutral-200/70 dark:border-neutral-700/60 flex flex-col gap-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <img
                      src={user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`}
                      alt={user.username}
                      className="w-11 h-11 rounded-full object-cover border border-neutral-200 dark:border-neutral-700"
                    />
                    {user.isOnline && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-neutral-900 rounded-full" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                      {user.displayName}
                    </h3>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">@{user.username}</p>
                    {user.bio && (
                      <p className="text-xs text-neutral-600 dark:text-neutral-300 mt-0.5 line-clamp-1">
                        {user.bio}
                      </p>
                    )}
                  </div>
                </div>

                {/* Relationship Action */}
                <div>
                  {user.relationship === 'contact' ? (
                    <button
                      onClick={() => {
                        onClose();
                        onSelectUserToChat?.(user._id);
                      }}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition shadow-xs"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      Chat
                    </button>
                  ) : user.relationship === 'request_sent' ? (
                    <span className="px-3 py-1.5 bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 rounded-lg text-xs font-medium flex items-center gap-1 border border-amber-300 dark:border-amber-800">
                      <Clock className="w-3.5 h-3.5" />
                      Pending
                    </span>
                  ) : user.relationship === 'request_received' ? (
                    <span className="px-3 py-1.5 bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 rounded-lg text-xs font-medium flex items-center gap-1 border border-blue-300 dark:border-blue-800">
                      In Requests
                    </span>
                  ) : (
                    <button
                      onClick={() => {
                        setSelectedForRequest(selectedForRequest === user._id ? null : user._id);
                        setIntroMessage('');
                      }}
                      className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-xs"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      Add Contact
                    </button>
                  )}
                </div>
              </div>

              {/* Introductory message input drawer */}
              {selectedForRequest === user._id && (
                <div className="pt-2 border-t border-neutral-200 dark:border-neutral-700 flex flex-col gap-2">
                  <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                    Optional Introductory Message:
                  </label>
                  <textarea
                    rows={2}
                    value={introMessage}
                    onChange={e => setIntroMessage(e.target.value)}
                    placeholder="Introduce yourself! (e.g. Hi, I'd like to connect regarding...)"
                    className="w-full p-2 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs text-neutral-900 dark:text-neutral-100 focus:border-indigo-500 outline-none resize-none"
                    maxLength={500}
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setSelectedForRequest(null)}
                      className="px-3 py-1.5 text-xs text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 transition"
                    >
                      Cancel
                    </button>
                    <button
                      disabled={sendingRequest}
                      onClick={() => handleSendRequest(user._id)}
                      className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50 transition flex items-center gap-1.5"
                    >
                      {sendingRequest ? 'Sending...' : 'Send Request'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
