import React, { useState, useEffect } from 'react';
import {
  X,
  Users,
  UserPlus,
  LogOut,
  ShieldCheck,
  Search,
  Check,
  Loader2,
  AlertCircle,
  Clock,
  Circle
} from 'lucide-react';
import { Conversation, User } from '../types';
import { api } from '../services/api';

interface GroupInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversation: Conversation;
  currentUser: User;
  onGroupUpdated: (updatedGroup: Conversation) => void;
  onLeaveGroup: () => void;
}

const MAX_MEMBERS = 100;

export const GroupInfoModal: React.FC<GroupInfoModalProps> = ({
  isOpen,
  onClose,
  conversation,
  currentUser,
  onGroupUpdated,
  onLeaveGroup,
}) => {
  const [activeTab, setActiveTab] = useState<'members' | 'add'>('members');
  const [memberSearch, setMemberSearch] = useState('');
  const [contacts, setContacts] = useState<User[]>([]);
  const [selectedToAdd, setSelectedToAdd] = useState<string[]>([]);
  const [loadingAdd, setLoadingAdd] = useState(false);
  const [loadingLeave, setLoadingLeave] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = conversation.adminIds?.includes(currentUser._id);
  const currentMembersCount = conversation.participants?.length || 0;
  const remainingCapacity = Math.max(0, MAX_MEMBERS - currentMembersCount);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSelectedToAdd([]);
      setActiveTab('members');
      loadContacts();
    }
  }, [isOpen]);

  const loadContacts = async () => {
    try {
      const res = await api.contacts.getContacts();
      setContacts(res.contacts || []);
    } catch (err) {
      console.error('Failed to load contacts:', err);
    }
  };

  if (!isOpen) return null;

  // Contacts that are NOT yet members of the group
  const availableContactsToAdd = contacts.filter(
    c => !conversation.participants.includes(c._id)
  );

  const toggleAddCandidate = (userId: string) => {
    setError(null);
    if (selectedToAdd.includes(userId)) {
      setSelectedToAdd(prev => prev.filter(id => id !== userId));
    } else {
      if (currentMembersCount + selectedToAdd.length >= MAX_MEMBERS) {
        setError(`Group capacity limit reached (${MAX_MEMBERS} members max).`);
        return;
      }
      setSelectedToAdd(prev => [...prev, userId]);
    }
  };

  const handleAddMembersSubmit = async () => {
    if (selectedToAdd.length === 0) return;
    try {
      setLoadingAdd(true);
      setError(null);
      const res = await api.chat.addGroupMembers(conversation._id, selectedToAdd);
      onGroupUpdated(res.group);
      setSelectedToAdd([]);
      setActiveTab('members');
    } catch (err: any) {
      setError(err.message || 'Failed to add members');
    } finally {
      setLoadingAdd(false);
    }
  };

  const handleLeaveGroup = async () => {
    if (!window.confirm(`Are you sure you want to leave "${conversation.name}"?`)) return;
    try {
      setLoadingLeave(true);
      await api.chat.leaveGroup(conversation._id);
      onLeaveGroup();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to leave group');
    } finally {
      setLoadingLeave(false);
    }
  };

  const membersList = (conversation.participantDetails || []).filter(
    m =>
      m.displayName.toLowerCase().includes(memberSearch.toLowerCase()) ||
      m.username.toLowerCase().includes(memberSearch.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-neutral-900 w-full max-w-md rounded-3xl shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src={conversation.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(conversation.name || 'group')}`}
              alt={conversation.name}
              className="w-12 h-12 rounded-2xl object-cover border border-neutral-200 dark:border-neutral-700 bg-neutral-100"
            />
            <div className="min-w-0">
              <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100 truncate">
                {conversation.name}
              </h2>
              <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium flex items-center gap-1">
                <Users className="w-3.5 h-3.5" />
                {currentMembersCount} / {MAX_MEMBERS} Members
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

        {/* Description Banner if exists */}
        {conversation.description && (
          <div className="px-5 py-2.5 bg-neutral-50 dark:bg-neutral-800/40 border-b border-neutral-200/60 dark:border-neutral-800 text-xs text-neutral-600 dark:text-neutral-300">
            {conversation.description}
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex border-b border-neutral-200 dark:border-neutral-800">
          <button
            onClick={() => setActiveTab('members')}
            className={`flex-1 py-3 text-xs font-bold transition flex items-center justify-center gap-1.5 border-b-2 ${
              activeTab === 'members'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Members ({currentMembersCount})
          </button>
          <button
            onClick={() => setActiveTab('add')}
            disabled={currentMembersCount >= MAX_MEMBERS}
            className={`flex-1 py-3 text-xs font-bold transition flex items-center justify-center gap-1.5 border-b-2 disabled:opacity-40 disabled:cursor-not-allowed ${
              activeTab === 'add'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            Add Members ({remainingCapacity} left)
          </button>
        </div>

        {error && (
          <div className="m-4 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl flex items-center gap-2 text-rose-700 dark:text-rose-300 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'members' ? (
            <div className="space-y-3">
              {/* Member Search */}
              <div className="relative">
                <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Filter members..."
                  value={memberSearch}
                  onChange={e => setMemberSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-500 dark:text-white"
                />
              </div>

              {/* Members List */}
              <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {membersList.map(member => {
                  const memberIsAdmin = conversation.adminIds?.includes(member._id);
                  const isYou = member._id === currentUser._id;

                  return (
                    <div
                      key={member._id}
                      className="py-2.5 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="relative shrink-0">
                          <img
                            src={member.avatar}
                            alt={member.displayName}
                            className="w-9 h-9 rounded-full object-cover border border-neutral-200 dark:border-neutral-700"
                          />
                          {member.isOnline ? (
                            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white dark:border-neutral-900 rounded-full" />
                          ) : (
                            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-neutral-400 border-2 border-white dark:border-neutral-900 rounded-full" />
                          )}
                        </div>
                        <div className="truncate">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100 truncate">
                              {member.displayName}
                            </span>
                            {isYou && (
                              <span className="text-[10px] px-1.5 py-0.2 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 rounded-md font-medium">
                                You
                              </span>
                            )}
                            {memberIsAdmin && (
                              <span className="text-[10px] px-1.5 py-0.2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-md font-semibold border border-indigo-200 dark:border-indigo-800 flex items-center gap-0.5">
                                <ShieldCheck className="w-2.5 h-2.5" />
                                Admin
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-neutral-400 truncate">
                            @{member.username} {member.isOnline ? '• Online' : ''}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Add Members Tab */
            <div className="space-y-4">
              <div className="p-3 bg-neutral-50 dark:bg-neutral-800/60 rounded-xl border border-neutral-200 dark:border-neutral-700/60 text-xs">
                <p className="font-semibold text-neutral-800 dark:text-neutral-200">
                  Select Contacts to Add
                </p>
                <p className="text-neutral-500 mt-0.5">
                  You can add up to {remainingCapacity} more member{remainingCapacity === 1 ? '' : 's'} (Limit: {MAX_MEMBERS}).
                </p>
              </div>

              {availableContactsToAdd.length === 0 ? (
                <div className="p-8 text-center text-xs text-neutral-400">
                  All your accepted contacts are already members of this group!
                </div>
              ) : (
                <div className="border border-neutral-200 dark:border-neutral-800 rounded-2xl max-h-56 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800">
                  {availableContactsToAdd.map(c => {
                    const isSelected = selectedToAdd.includes(c._id);
                    const canSelect = isSelected || (currentMembersCount + selectedToAdd.length < MAX_MEMBERS);

                    return (
                      <div
                        key={c._id}
                        onClick={() => canSelect && toggleAddCandidate(c._id)}
                        className={`flex items-center justify-between p-2.5 transition cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-50 dark:bg-indigo-950/40'
                            : canSelect
                            ? 'hover:bg-neutral-50 dark:hover:bg-neutral-800/60'
                            : 'opacity-40 cursor-not-allowed'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <img
                            src={c.avatar}
                            alt={c.displayName}
                            className="w-8 h-8 rounded-full object-cover"
                          />
                          <div>
                            <p className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                              {c.displayName}
                            </p>
                            <p className="text-[10px] text-neutral-400">@{c.username}</p>
                          </div>
                        </div>

                        <div
                          className={`w-5 h-5 rounded-lg border flex items-center justify-center ${
                            isSelected
                              ? 'bg-indigo-600 border-indigo-600 text-white'
                              : 'border-neutral-300 dark:border-neutral-600'
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {selectedToAdd.length > 0 && (
                <button
                  onClick={handleAddMembersSubmit}
                  disabled={loadingAdd}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center justify-center gap-2"
                >
                  {loadingAdd ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      <span>
                        Add {selectedToAdd.length} Member{selectedToAdd.length === 1 ? '' : 's'}
                      </span>
                    </>
                  )}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 flex items-center justify-between">
          <button
            onClick={handleLeaveGroup}
            disabled={loadingLeave}
            className="px-3 py-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
          >
            {loadingLeave ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <LogOut className="w-4 h-4" />
            )}
            Leave Group
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 rounded-xl text-xs font-semibold hover:bg-neutral-300 dark:hover:bg-neutral-700 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
