import React, { useEffect, useState } from 'react';
import { X, Share2, Search, Check } from 'lucide-react';
import { api } from '../services/api';
import { User, Message } from '../types';

interface ForwardModalProps {
  isOpen: boolean;
  onClose: () => void;
  messageToForward: Message | null;
  onForwardSuccess?: () => void;
}

export const ForwardModal: React.FC<ForwardModalProps> = ({
  isOpen,
  onClose,
  messageToForward,
  onForwardSuccess,
}) => {
  const [contacts, setContacts] = useState<User[]>([]);
  const [filterText, setFilterText] = useState('');
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [forwarding, setForwarding] = useState(false);

  useEffect(() => {
    if (isOpen) {
      api.contacts.getContacts().then(res => setContacts(res.contacts)).catch(console.error);
    }
  }, [isOpen]);

  if (!isOpen || !messageToForward) return null;

  const handleForward = async () => {
    if (!selectedTarget) return;
    setForwarding(true);
    try {
      // Find or create conversation for the selected contact
      const convRes = await api.chat.getConversations();
      let conv = convRes.conversations.find(c => c.participants.includes(selectedTarget));
      let conversationId = conv?._id;

      if (!conversationId) {
        alert('Could not locate conversation for this contact');
        return;
      }

      await api.chat.forwardMessage(messageToForward._id, conversationId);
      onForwardSuccess?.();
      onClose();
    } catch (err: any) {
      alert(err.message || 'Failed to forward message');
    } finally {
      setForwarding(false);
    }
  };

  const filtered = contacts.filter(c =>
    c.displayName.toLowerCase().includes(filterText.toLowerCase()) ||
    c.username.toLowerCase().includes(filterText.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-neutral-900 w-full max-w-sm rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden flex flex-col max-h-[80vh]">
        <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Share2 className="w-4 h-4 text-indigo-500" />
            <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">Forward Message</h3>
          </div>
          <button onClick={onClose} className="p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Message preview snippet */}
        <div className="p-3 bg-neutral-50 dark:bg-neutral-800/60 border-b border-neutral-200 dark:border-neutral-800 text-xs text-neutral-600 dark:text-neutral-300 italic line-clamp-2">
          &quot;{messageToForward.text || messageToForward.fileName || 'Attachment'}&quot;
        </div>

        {/* Search */}
        <div className="p-3 border-b border-neutral-100 dark:border-neutral-800">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-neutral-400" />
            <input
              type="text"
              value={filterText}
              onChange={e => setFilterText(e.target.value)}
              placeholder="Search contact..."
              className="w-full pl-9 pr-3 py-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-lg text-xs outline-none text-neutral-900 dark:text-neutral-100"
            />
          </div>
        </div>

        {/* Contact list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filtered.length === 0 ? (
            <div className="text-center py-8 text-neutral-400 text-xs">No contacts found</div>
          ) : (
            filtered.map(contact => (
              <div
                key={contact._id}
                onClick={() => setSelectedTarget(contact._id)}
                className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition ${
                  selectedTarget === contact._id
                    ? 'bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-300 dark:border-indigo-800'
                    : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <img
                    src={contact.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${contact.username}`}
                    alt={contact.displayName}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                  <div>
                    <p className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                      {contact.displayName}
                    </p>
                    <p className="text-[10px] text-neutral-500">@{contact.username}</p>
                  </div>
                </div>
                {selectedTarget === contact._id && (
                  <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                )}
              </div>
            ))
          )}
        </div>

        <div className="p-3 border-t border-neutral-200 dark:border-neutral-800 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-neutral-600 dark:text-neutral-400 hover:text-neutral-900"
          >
            Cancel
          </button>
          <button
            disabled={!selectedTarget || forwarding}
            onClick={handleForward}
            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold disabled:opacity-50 transition"
          >
            {forwarding ? 'Sending...' : 'Forward'}
          </button>
        </div>
      </div>
    </div>
  );
};
