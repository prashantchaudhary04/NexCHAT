import React, { useEffect, useState } from 'react';
import { Search, MessageSquare, Phone, Video, Trash2, UserPlus, ShieldCheck } from 'lucide-react';
import { api } from '../services/api';
import { User } from '../types';
import { useSocket } from '../context/SocketContext';
import { formatLastSeen } from '../utils/date';

interface ContactsViewProps {
  onOpenConversation: (conversationId: string) => void;
  onOpenSearchModal: () => void;
}

export const ContactsView: React.FC<ContactsViewProps> = ({ onOpenConversation, onOpenSearchModal }) => {
  const [contacts, setContacts] = useState<User[]>([]);
  const [filterText, setFilterText] = useState('');
  const [loading, setLoading] = useState(true);
  const { startCall, onlineUsers } = useSocket();

  const fetchContacts = async () => {
    try {
      setLoading(true);
      const data = await api.contacts.getContacts();
      setContacts(data.contacts);
    } catch (err) {
      console.error('Failed to load contacts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, []);

  const handleStartChat = async (contact: User) => {
    if (contact.conversationId) {
      onOpenConversation(contact.conversationId);
      return;
    }
    // Refresh conversations
    const convData = await api.chat.getConversations();
    const existing = convData.conversations.find(c => c.participants.includes(contact._id));
    if (existing) {
      onOpenConversation(existing._id);
    }
  };

  const handleRemoveContact = async (contactId: string, name: string) => {
    if (!window.confirm(`Are you sure you want to remove ${name} from your contacts? You will not be able to message or call them until a new request is sent and accepted.`)) {
      return;
    }
    try {
      await api.contacts.removeContact(contactId);
      setContacts(prev => prev.filter(c => c._id !== contactId));
    } catch (err: any) {
      alert(err.message || 'Failed to remove contact');
    }
  };

  const filteredContacts = contacts.filter(
    c =>
      c.displayName.toLowerCase().includes(filterText.toLowerCase()) ||
      c.username.toLowerCase().includes(filterText.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col h-full bg-neutral-50/50 dark:bg-neutral-900/50 overflow-y-auto p-4 sm:p-6 pb-24 md:pb-6">
      <div className="max-w-4xl mx-auto w-full mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
              <span>Contacts</span>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                {contacts.length}
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-1">
              Accepted connections eligible for unlimited real-time chat, media sharing, and HD voice/video calls.
            </p>
          </div>
          <button
            onClick={onOpenSearchModal}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition shadow-sm"
          >
            <UserPlus className="w-4 h-4" />
            Add New Contact
          </button>
        </div>

        {/* Search filter */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-neutral-400" />
          <input
            type="text"
            value={filterText}
            onChange={e => setFilterText(e.target.value)}
            placeholder="Search saved contacts..."
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs sm:text-sm text-neutral-900 dark:text-neutral-100 outline-none focus:border-indigo-500 transition shadow-xs"
          />
        </div>
      </div>

      <div className="max-w-4xl mx-auto w-full">
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(n => (
              <div key={n} className="h-28 bg-neutral-200 dark:bg-neutral-800 rounded-2xl animate-pulse" />
            ))}
          </div>
        )}

        {!loading && filteredContacts.length === 0 && (
          <div className="text-center py-16 bg-white dark:bg-neutral-800/40 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-8 shadow-xs">
            <ShieldCheck className="w-12 h-12 mx-auto text-indigo-500 mb-3 opacity-80" />
            <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
              {contacts.length === 0 ? 'No contacts yet' : 'No matching contacts'}
            </h3>
            <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 max-w-sm mx-auto mt-1 mb-5">
              {contacts.length === 0
                ? 'Search for users by username to send contact requests with an introductory message.'
                : 'Try searching with a different username or display name.'}
            </p>
            {contacts.length === 0 && (
              <button
                onClick={onOpenSearchModal}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-2 transition"
              >
                <UserPlus className="w-4 h-4" />
                Find People
              </button>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {filteredContacts.map(contact => {
            const isOnline = onlineUsers[contact._id]?.isOnline ?? contact.isOnline;
            const effectiveLastSeen = onlineUsers[contact._id]?.lastSeen !== undefined
              ? onlineUsers[contact._id].lastSeen
              : contact.lastSeen;
            const lastSeenText = !isOnline && effectiveLastSeen ? formatLastSeen(effectiveLastSeen) : null;

            return (
              <div
                key={contact._id}
                className="bg-white dark:bg-neutral-800/80 rounded-2xl p-4 border border-neutral-200/80 dark:border-neutral-700/80 shadow-xs hover:shadow-md transition flex flex-col justify-between gap-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <img
                        src={contact.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${contact.username}`}
                        alt={contact.displayName}
                        className="w-12 h-12 rounded-full object-cover border border-neutral-200 dark:border-neutral-700"
                      />
                      {isOnline && (
                        <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-neutral-900 rounded-full" />
                      )}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                        {contact.displayName}
                      </h3>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">@{contact.username}</p>
                      <span
                        className={`text-[11px] font-medium ${
                          isOnline
                            ? 'text-emerald-600 dark:text-emerald-400 flex items-center gap-1'
                            : 'text-neutral-400 dark:text-neutral-500'
                        }`}
                      >
                        {isOnline ? (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Online
                          </>
                        ) : (
                          lastSeenText || 'Offline'
                        )}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleRemoveContact(contact._id, contact.displayName)}
                    title="Remove Contact"
                    className="p-1.5 text-neutral-400 hover:text-rose-600 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700/60 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {contact.bio && (
                  <p className="text-xs text-neutral-600 dark:text-neutral-300 line-clamp-1 italic">
                    &quot;{contact.bio}&quot;
                  </p>
                )}

                <div className="flex items-center gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-700/60">
                  <button
                    onClick={() => handleStartChat(contact)}
                    className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition shadow-xs"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    Chat
                  </button>
                  <button
                    onClick={() => startCall(contact, 'audio')}
                    title="Start Voice Call"
                    className="p-2 border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-lg text-xs transition"
                  >
                    <Phone className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  </button>
                  <button
                    onClick={() => startCall(contact, 'video')}
                    title="Start Video Call"
                    className="p-2 border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-lg text-xs transition"
                  >
                    <Video className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
