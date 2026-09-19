import React, { useState, useEffect } from 'react';
import {
  X,
  Users,
  Search,
  Check,
  Sparkles,
  AlertCircle,
  ShieldCheck,
  UserCheck,
  Loader2
} from 'lucide-react';
import { User, Conversation } from '../types';
import { api } from '../services/api';

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  onGroupCreated: (newGroup: Conversation) => void;
}

const MAX_MEMBERS = 100;

export const CreateGroupModal: React.FC<CreateGroupModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onGroupCreated,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [avatarSeed, setAvatarSeed] = useState('');
  const [customAvatar, setCustomAvatar] = useState('');
  const [contacts, setContacts] = useState<User[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingContacts, setFetchingContacts] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setName('');
      setDescription('');
      setError(null);
      setSelectedMemberIds([]);
      setAvatarSeed(`group-${Math.random().toString(36).substring(2, 8)}`);
      setCustomAvatar('');
      loadContacts();
    }
  }, [isOpen]);

  const loadContacts = async () => {
    try {
      setFetchingContacts(true);
      const res = await api.contacts.getContacts();
      setContacts(res.contacts || []);
    } catch (err: any) {
      console.error('Failed to load contacts for group creation:', err);
    } finally {
      setFetchingContacts(false);
    }
  };

  if (!isOpen) return null;

  // Total members includes the creator (currentUser) + selected contacts
  const totalMembersCount = 1 + selectedMemberIds.length;
  const isAtLimit = totalMembersCount >= MAX_MEMBERS;

  const currentAvatarUrl =
    customAvatar.trim() ||
    `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(avatarSeed || name || 'group')}`;

  const toggleMember = (userId: string) => {
    setError(null);
    if (selectedMemberIds.includes(userId)) {
      setSelectedMemberIds(prev => prev.filter(id => id !== userId));
    } else {
      if (totalMembersCount >= MAX_MEMBERS) {
        setError(`Group member limit reached! Maximum capacity is ${MAX_MEMBERS} members.`);
        return;
      }
      setSelectedMemberIds(prev => [...prev, userId]);
    }
  };

  const handleSelectAll = () => {
    setError(null);
    // Can only select up to MAX_MEMBERS - 1 (since creator takes 1 spot)
    const maxAdditional = MAX_MEMBERS - 1;
    const allIds = contacts.map(c => c._id);
    const capped = allIds.slice(0, maxAdditional);
    setSelectedMemberIds(capped);
    if (allIds.length > maxAdditional) {
      setError(`Capped selection to first ${maxAdditional} contacts to respect the ${MAX_MEMBERS} member limit.`);
    }
  };

  const handleClearSelection = () => {
    setSelectedMemberIds([]);
    setError(null);
  };

  const handleShuffleAvatar = () => {
    setCustomAvatar('');
    setAvatarSeed(`group-${Math.random().toString(36).substring(2, 8)}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter a group name');
      return;
    }

    if (totalMembersCount > MAX_MEMBERS) {
      setError(`Cannot create group with more than ${MAX_MEMBERS} members.`);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const res = await api.chat.createGroup({
        name: name.trim(),
        description: description.trim() || undefined,
        avatar: currentAvatarUrl,
        memberIds: selectedMemberIds,
      });

      onGroupCreated(res.group);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create group');
    } finally {
      setLoading(false);
    }
  };

  const filteredContacts = contacts.filter(
    c =>
      c.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-neutral-900 w-full max-w-lg rounded-2xl sm:rounded-3xl shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
                Create New Group
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Collaborate with up to 100 members
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Member Limit Capacity Banner */}
          <div className="p-3.5 bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700/60 rounded-2xl space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-indigo-500" />
                Group Capacity
              </span>
              <span
                className={`font-mono font-bold px-2 py-0.5 rounded-full text-[11px] ${
                  isAtLimit
                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400'
                    : totalMembersCount > 80
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
                    : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-400'
                }`}
              >
                {totalMembersCount} / {MAX_MEMBERS} members
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 rounded-full ${
                  isAtLimit
                    ? 'bg-rose-500'
                    : totalMembersCount > 80
                    ? 'bg-amber-500'
                    : 'bg-indigo-600'
                }`}
                style={{ width: `${Math.min(100, (totalMembersCount / MAX_MEMBERS) * 100)}%` }}
              />
            </div>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
              You (Admin) + {selectedMemberIds.length} contact{selectedMemberIds.length === 1 ? '' : 's'} selected. Limit: 100 members max.
            </p>
          </div>

          {error && (
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-2xl flex items-center gap-2.5 text-rose-700 dark:text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Group Identity Section */}
          <div className="flex gap-4 items-center">
            <div className="relative group shrink-0">
              <img
                src={currentAvatarUrl}
                alt="Group Preview"
                className="w-16 h-16 rounded-2xl object-cover border-2 border-indigo-500/30 bg-neutral-100 dark:bg-neutral-800 shadow-xs"
              />
              <button
                type="button"
                onClick={handleShuffleAvatar}
                title="Generate Random Avatar"
                className="absolute -bottom-1 -right-1 p-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md transition transform hover:scale-105"
              >
                <Sparkles className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex-1 space-y-2">
              <div>
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                  Group Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={60}
                  placeholder="e.g. Design & Tech Guild"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Description Field */}
          <div>
            <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
              Group Description (Optional)
            </label>
            <textarea
              rows={2}
              maxLength={200}
              placeholder="What is this group about? (Guidelines, topics, etc.)"
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full px-3.5 py-2 bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-500 dark:text-white resize-none"
            />
          </div>

          {/* Add Members Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                Select Members from Contacts
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  disabled={contacts.length === 0 || isAtLimit}
                  className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-40"
                >
                  Select All ({Math.min(contacts.length, MAX_MEMBERS - 1)})
                </button>
                {selectedMemberIds.length > 0 && (
                  <>
                    <span className="text-neutral-300 dark:text-neutral-700">•</span>
                    <button
                      type="button"
                      onClick={handleClearSelection}
                      className="text-[11px] font-semibold text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                    >
                      Clear
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Search Filter */}
            <div className="relative">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search contacts by name or @username..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2 bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-500 dark:text-white"
              />
            </div>

            {/* Selected Members Chips */}
            {selectedMemberIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5 p-2 bg-neutral-50 dark:bg-neutral-800/40 rounded-xl max-h-20 overflow-y-auto border border-neutral-200/60 dark:border-neutral-800">
                {selectedMemberIds.map(id => {
                  const u = contacts.find(c => c._id === id);
                  if (!u) return null;
                  return (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-white dark:bg-neutral-700 rounded-lg text-[11px] font-medium text-neutral-800 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-600 shadow-2xs"
                    >
                      <span>{u.displayName}</span>
                      <button
                        type="button"
                        onClick={() => toggleMember(id)}
                        className="text-neutral-400 hover:text-rose-500 transition"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}

            {/* Contacts List */}
            <div className="border border-neutral-200 dark:border-neutral-800 rounded-2xl max-h-48 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800/80">
              {fetchingContacts ? (
                <div className="p-6 text-center text-xs text-neutral-400 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Loading your contacts...</span>
                </div>
              ) : filteredContacts.length === 0 ? (
                <div className="p-6 text-center text-xs text-neutral-400">
                  {contacts.length === 0
                    ? 'You have no accepted contacts yet. You can still create the group now and invite members later!'
                    : 'No matching contacts found.'}
                </div>
              ) : (
                filteredContacts.map(c => {
                  const isSelected = selectedMemberIds.includes(c._id);
                  const canSelect = isSelected || !isAtLimit;

                  return (
                    <div
                      key={c._id}
                      onClick={() => canSelect && toggleMember(c._id)}
                      className={`flex items-center justify-between p-3 transition cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-50/60 dark:bg-indigo-950/30'
                          : canSelect
                          ? 'hover:bg-neutral-50 dark:hover:bg-neutral-800/50'
                          : 'opacity-50 cursor-not-allowed bg-neutral-50/40 dark:bg-neutral-800/20'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={c.avatar}
                          alt={c.displayName}
                          className="w-8 h-8 rounded-full object-cover border border-neutral-200 dark:border-neutral-700"
                        />
                        <div className="truncate">
                          <p className="text-xs font-bold text-neutral-900 dark:text-neutral-100 truncate">
                            {c.displayName}
                          </p>
                          <p className="text-[11px] text-neutral-400 dark:text-neutral-500">
                            @{c.username}
                          </p>
                        </div>
                      </div>

                      <div
                        className={`w-5 h-5 rounded-lg border flex items-center justify-center transition ${
                          isSelected
                            ? 'bg-indigo-600 border-indigo-600 text-white'
                            : 'border-neutral-300 dark:border-neutral-600'
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5" />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-neutral-100 dark:border-neutral-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md transition disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Creating Group...</span>
                </>
              ) : (
                <>
                  <UserCheck className="w-4 h-4" />
                  <span>Create Group ({totalMembersCount} / {MAX_MEMBERS})</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
