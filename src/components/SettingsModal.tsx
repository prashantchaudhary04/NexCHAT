import React, { useState, useEffect } from 'react';
import {
  X,
  Palette,
  Shield,
  Check,
  Users,
  Eye,
  Clock,
  Search,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  LogOut,
  User,
  Settings,
  ArrowLeft,
  ChevronRight,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { AppTheme, ChatBackground, PrivacyOption, User as UserType } from '../types';
import { api } from '../services/api';

export type SettingsSection = 'menu' | 'theme' | 'privacy' | 'account';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'theme' | 'privacy' | 'account' | 'appearance' | 'menu';
}

const THEMES: { id: AppTheme; name: string; color: string; desc: string }[] = [
  { id: 'light', name: 'Light Pristine', color: '#f8fafc', desc: 'Clean, airy daylight aesthetic' },
  { id: 'dark', name: 'Dark Slate', color: '#0f172a', desc: 'Balanced contrast for reduced eye strain' },
  { id: 'midnight', name: 'Midnight Violet', color: '#090d16', desc: 'Deep AMOLED blacks with purple accents' },
  { id: 'ocean', name: 'Oceanic Blue', color: '#0a192f', desc: 'Deep maritime navy with cyan glows' },
  { id: 'sunset', name: 'Velvet Sunset', color: '#1c1018', desc: 'Warm dusk rose and terracotta tones' },
  { id: 'forest', name: 'Emerald Forest', color: '#061e14', desc: 'Deep evergreen calming botanical atmosphere' },
  { id: 'lavender', name: 'Pastel Lavender', color: '#faf5ff', desc: 'Soft lilac gentle daydream palette' },
];

const WALLPAPERS: { id: ChatBackground; label: string; previewClass: string }[] = [
  { id: 'default', label: 'Default Theme Wall', previewClass: 'bg-pattern-default' },
  { id: 'doodle', label: 'Chat Doodles', previewClass: 'bg-pattern-doodle' },
  { id: 'dots', label: 'Soft Polka Dots', previewClass: 'bg-pattern-dots' },
  { id: 'gradient', label: 'Aurora Gradient', previewClass: 'bg-pattern-gradient' },
  { id: 'dark_stars', label: 'Starry Sky', previewClass: 'bg-pattern-stars' },
  { id: 'minimal_grid', label: 'Graph Grid', previewClass: 'bg-pattern-grid' },
];

const PRIVACY_OPTIONS: { id: PrivacyOption; label: string; desc: string }[] = [
  { id: 'all', label: '1) Everyone (All)', desc: 'Visible to anyone using the app' },
  { id: 'contacts', label: '2) My Contacts', desc: 'Only users in your contacts list can see' },
  { id: 'selected', label: '3) Selected Contacts', desc: 'Only contacts you explicitly check below' },
  { id: 'nobody', label: '4) Nobody (No one)', desc: 'Completely hidden from everyone' },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  initialTab,
}) => {
  const { theme, setTheme, chatBackground, setChatBackground } = useTheme();
  const { user, updatePrivacy, logout } = useAuth();

  const resolveInitialSection = (): SettingsSection => {
    if (initialTab === 'appearance' || initialTab === 'theme') return 'theme';
    if (initialTab === 'privacy') return 'privacy';
    if (initialTab === 'account') return 'account';
    return 'menu';
  };

  const [activeSection, setActiveSection] = useState<SettingsSection>(resolveInitialSection);

  useEffect(() => {
    if (isOpen) {
      setActiveSection(resolveInitialSection());
    }
  }, [isOpen, initialTab]);

  // Privacy states
  const [lastSeenPrivacy, setLastSeenPrivacy] = useState<PrivacyOption>('all');
  const [lastSeenSelected, setLastSeenSelected] = useState<string[]>([]);
  const [onlinePrivacy, setOnlinePrivacy] = useState<PrivacyOption>('all');
  const [onlineSelected, setOnlineSelected] = useState<string[]>([]);

  // Contacts list for picking selected contacts
  const [contacts, setContacts] = useState<UserType[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [contactSearchLastSeen, setContactSearchLastSeen] = useState('');
  const [contactSearchOnline, setContactSearchOnline] = useState('');

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync state from user when modal opens or user updates
  useEffect(() => {
    if (user) {
      setLastSeenPrivacy(user.lastSeenPrivacy || 'all');
      setLastSeenSelected(user.lastSeenSelectedContacts || []);
      setOnlinePrivacy(user.onlinePrivacy || 'all');
      setOnlineSelected(user.onlineSelectedContacts || []);
    }
  }, [user, isOpen]);

  // Load contacts for selection lists
  useEffect(() => {
    if (isOpen) {
      let isMounted = true;
      setLoadingContacts(true);
      api.contacts
        .getContacts()
        .then(res => {
          if (isMounted) {
            setContacts(res.contacts || []);
          }
        })
        .catch(err => {
          console.error('Failed to load contacts for privacy picker:', err);
        })
        .finally(() => {
          if (isMounted) setLoadingContacts(false);
        });

      return () => {
        isMounted = false;
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSavePrivacy = async () => {
    setSaving(true);
    setErrorMessage(null);
    setSaveSuccess(false);

    try {
      await updatePrivacy({
        lastSeenPrivacy,
        lastSeenSelectedContacts: lastSeenSelected,
        onlinePrivacy,
        onlineSelectedContacts: onlineSelected,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      console.error('Failed to save privacy settings:', err);
      setErrorMessage(err.message || 'Failed to update privacy settings');
    } finally {
      setSaving(false);
    }
  };

  const toggleLastSeenContact = (contactId: string) => {
    setLastSeenSelected(prev =>
      prev.includes(contactId) ? prev.filter(id => id !== contactId) : [...prev, contactId]
    );
  };

  const toggleOnlineContact = (contactId: string) => {
    setOnlineSelected(prev =>
      prev.includes(contactId) ? prev.filter(id => id !== contactId) : [...prev, contactId]
    );
  };

  const selectAllLastSeen = () => {
    setLastSeenSelected(contacts.map(c => c._id));
  };

  const clearAllLastSeen = () => {
    setLastSeenSelected([]);
  };

  const selectAllOnline = () => {
    setOnlineSelected(contacts.map(c => c._id));
  };

  const clearAllOnline = () => {
    setOnlineSelected([]);
  };

  const filteredContactsForLastSeen = contacts.filter(
    c =>
      c.displayName.toLowerCase().includes(contactSearchLastSeen.toLowerCase()) ||
      c.username.toLowerCase().includes(contactSearchLastSeen.toLowerCase())
  );

  const filteredContactsForOnline = contacts.filter(
    c =>
      c.displayName.toLowerCase().includes(contactSearchOnline.toLowerCase()) ||
      c.username.toLowerCase().includes(contactSearchOnline.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4">
      <div className="bg-white dark:bg-neutral-900 w-full max-w-2xl rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            {activeSection === 'menu' ? (
              <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                <Settings className="w-5 h-5" />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setActiveSection('menu')}
                className="p-1.5 -ml-1 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition flex items-center gap-1.5 text-xs font-bold cursor-pointer"
                title="Back to Settings list"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Settings</span>
              </button>
            )}

            {activeSection !== 'menu' && (
              <div className="h-5 w-px bg-neutral-200 dark:bg-neutral-800 hidden sm:block" />
            )}

            {activeSection !== 'menu' && (
              <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                {activeSection === 'theme' ? (
                  <Palette className="w-5 h-5" />
                ) : activeSection === 'privacy' ? (
                  <Shield className="w-5 h-5" />
                ) : (
                  <User className="w-5 h-5" />
                )}
              </div>
            )}

            <div>
              <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                {activeSection === 'menu'
                  ? 'Settings'
                  : activeSection === 'theme'
                  ? 'Theme'
                  : activeSection === 'privacy'
                  ? 'Last Seen & Online Privacy'
                  : 'Account & Security'}
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {activeSection === 'menu'
                  ? 'Preferences, themes, privacy & account settings'
                  : activeSection === 'theme'
                  ? 'Customize app colors, dark mode and chat wallpapers'
                  : activeSection === 'privacy'
                  ? 'Manage visibility of your real-time online state and last seen timing'
                  : 'View your profile details and account security'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-6 flex-1">
          {activeSection === 'menu' ? (
            /* LIST VIEW OF SETTINGS OPTIONS */
            <div className="space-y-5">
              {/* Account Quick Profile Card */}
              <button
                type="button"
                onClick={() => setActiveSection('account')}
                className="w-full p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 hover:bg-neutral-100 dark:hover:bg-neutral-800 border border-neutral-200 dark:border-neutral-700/80 transition flex items-center justify-between text-left group cursor-pointer"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="relative shrink-0">
                    <img
                      src={
                        user?.avatar ||
                        `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.username || 'user'}`
                      }
                      alt={user?.displayName || 'User'}
                      className="w-12 h-12 rounded-2xl object-cover ring-2 ring-indigo-500/20"
                    />
                    <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-white dark:border-neutral-800 rounded-full" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
                      {user?.displayName || 'Your Profile'}
                    </h4>
                    <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium truncate">
                      @{user?.username || 'username'}
                    </p>
                    {user?.email && (
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
                        {user.email}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 hidden sm:inline">
                    View Account
                  </span>
                  <ChevronRight className="w-4 h-4 text-neutral-400 group-hover:text-neutral-700 dark:group-hover:text-neutral-200 group-hover:translate-x-0.5 transition" />
                </div>
              </button>

              {/* Settings Options List */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider px-1">
                  Preferences
                </label>
                <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-800/40 divide-y divide-neutral-100 dark:divide-neutral-800 overflow-hidden shadow-xs">
                  {/* 1. Theme Option */}
                  <button
                    type="button"
                    onClick={() => setActiveSection('theme')}
                    className="w-full p-4 flex items-center justify-between gap-3 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800/60 transition group cursor-pointer"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                        <Palette className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
                          Theme
                        </p>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                          Light/dark themes & chat wallpapers
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 capitalize">
                        {THEMES.find(t => t.id === theme)?.name || theme}
                      </span>
                      <ChevronRight className="w-4 h-4 text-neutral-400 group-hover:translate-x-0.5 transition" />
                    </div>
                  </button>

                  {/* 2. Privacy Option */}
                  <button
                    type="button"
                    onClick={() => setActiveSection('privacy')}
                    className="w-full p-4 flex items-center justify-between gap-3 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800/60 transition group cursor-pointer"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                        <Shield className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition">
                          Last Seen & Online Privacy
                        </p>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                          Control who sees your status & timestamps
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 capitalize">
                        {lastSeenPrivacy === 'all'
                          ? 'Everyone'
                          : lastSeenPrivacy === 'contacts'
                          ? 'My Contacts'
                          : lastSeenPrivacy === 'selected'
                          ? 'Selected'
                          : 'Nobody'}
                      </span>
                      <ChevronRight className="w-4 h-4 text-neutral-400 group-hover:translate-x-0.5 transition" />
                    </div>
                  </button>
                </div>
              </div>
            </div>
          ) : activeSection === 'privacy' ? (
            <div className="space-y-6">
              {/* Notice Banner */}
              <div className="p-3.5 rounded-xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/60 flex items-start gap-3 text-xs text-neutral-700 dark:text-neutral-300">
                <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                    Live Real-Time Status Behavior:
                  </span>{' '}
                  Online status is exclusively visible while you have the app open in real time. The moment you close or exit the app, your status immediately shifts to your exact last seen timing (e.g. &quot;Last seen just now&quot; or &quot;Last seen 2m ago&quot;) according to the rules below.
                </div>
              </div>

              {saveSuccess && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4" />
                  Privacy settings updated and synchronized across all devices successfully!
                </div>
              )}

              {errorMessage && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {errorMessage}
                </div>
              )}

              {/* 1. LAST SEEN PRIVACY */}
              <div className="border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 bg-white dark:bg-neutral-800/40 space-y-3.5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-indigo-500" />
                    <h4 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                      Who Can See My Last Seen Status
                    </h4>
                  </div>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 capitalize">
                    Active: {lastSeenPrivacy}
                  </span>
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Control who is allowed to view your last active timestamp when you close the app.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {PRIVACY_OPTIONS.map(opt => {
                    const isSelected = lastSeenPrivacy === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setLastSeenPrivacy(opt.id)}
                        className={`p-3 rounded-xl border text-left transition flex items-start justify-between cursor-pointer ${
                          isSelected
                            ? 'border-indigo-600 ring-2 ring-indigo-500/20 bg-indigo-50/50 dark:bg-indigo-950/30'
                            : 'border-neutral-200 dark:border-neutral-700/80 hover:bg-neutral-50 dark:hover:bg-neutral-800/70'
                        }`}
                      >
                        <div>
                          <p className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                            {opt.label}
                          </p>
                          <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                            {opt.desc}
                          </p>
                        </div>
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                            isSelected
                              ? 'border-indigo-600 bg-indigo-600 text-white'
                              : 'border-neutral-300 dark:border-neutral-600'
                          }`}
                        >
                          {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Sub-selector for Selected Contacts */}
                {lastSeenPrivacy === 'selected' && (
                  <div className="mt-3 p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-900/80 border border-neutral-200 dark:border-neutral-700/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <UserCheck className="w-4 h-4 text-indigo-500" />
                        <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
                          Select Contacts Allowed to See Last Seen ({lastSeenSelected.length} of{' '}
                          {contacts.length})
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={selectAllLastSeen}
                          className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
                        >
                          Select All
                        </button>
                        <span className="text-neutral-300 dark:text-neutral-700">•</span>
                        <button
                          type="button"
                          onClick={clearAllLastSeen}
                          className="text-[11px] text-neutral-500 hover:underline font-semibold"
                        >
                          Clear All
                        </button>
                      </div>
                    </div>

                    {/* Search filter for contacts */}
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-neutral-400" />
                      <input
                        type="text"
                        value={contactSearchLastSeen}
                        onChange={e => setContactSearchLastSeen(e.target.value)}
                        placeholder="Filter contacts..."
                        className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-xs text-neutral-900 dark:text-neutral-100 outline-none focus:border-indigo-500"
                      />
                    </div>

                    {/* Contacts Checklist */}
                    {loadingContacts ? (
                      <div className="py-4 flex items-center justify-center gap-2 text-xs text-neutral-500">
                        <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                        Loading contacts...
                      </div>
                    ) : contacts.length === 0 ? (
                      <p className="text-xs text-neutral-500 italic py-2 text-center">
                        You have no contacts added yet. Add contacts to select them here.
                      </p>
                    ) : filteredContactsForLastSeen.length === 0 ? (
                      <p className="text-xs text-neutral-500 italic py-2 text-center">
                        No contacts match &quot;{contactSearchLastSeen}&quot;
                      </p>
                    ) : (
                      <div className="max-h-40 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800">
                        {filteredContactsForLastSeen.map(c => {
                          const isChecked = lastSeenSelected.includes(c._id);
                          return (
                            <label
                              key={c._id}
                              className="px-3 py-2 flex items-center justify-between hover:bg-neutral-50 dark:hover:bg-neutral-750 cursor-pointer transition select-none"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <img
                                  src={
                                    c.avatar ||
                                    `https://api.dicebear.com/7.x/avataaars/svg?seed=${c.username}`
                                  }
                                  alt={c.displayName}
                                  className="w-7 h-7 rounded-full object-cover border border-neutral-200 dark:border-neutral-700 shrink-0"
                                />
                                <div className="truncate">
                                  <p className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                                    {c.displayName}
                                  </p>
                                  <p className="text-[10px] text-neutral-500 dark:text-neutral-400 truncate">
                                    @{c.username}
                                  </p>
                                </div>
                              </div>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleLastSeenContact(c._id)}
                                className="w-4 h-4 text-indigo-600 rounded border-neutral-300 focus:ring-indigo-500 shrink-0 cursor-pointer"
                              />
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 2. ONLINE STATUS PRIVACY */}
              <div className="border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 bg-white dark:bg-neutral-800/40 space-y-3.5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4 text-emerald-500" />
                    <h4 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                      Who Can See When I&apos;m Online
                    </h4>
                  </div>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 capitalize">
                    Active: {onlinePrivacy}
                  </span>
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Control who can see your real-time green online indicator while you are currently active in the app.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {PRIVACY_OPTIONS.map(opt => {
                    const isSelected = onlinePrivacy === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setOnlinePrivacy(opt.id)}
                        className={`p-3 rounded-xl border text-left transition flex items-start justify-between cursor-pointer ${
                          isSelected
                            ? 'border-emerald-600 ring-2 ring-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-950/30'
                            : 'border-neutral-200 dark:border-neutral-700/80 hover:bg-neutral-50 dark:hover:bg-neutral-800/70'
                        }`}
                      >
                        <div>
                          <p className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                            {opt.label}
                          </p>
                          <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                            {opt.desc}
                          </p>
                        </div>
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                            isSelected
                              ? 'border-emerald-600 bg-emerald-600 text-white'
                              : 'border-neutral-300 dark:border-neutral-600'
                          }`}
                        >
                          {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Sub-selector for Selected Contacts */}
                {onlinePrivacy === 'selected' && (
                  <div className="mt-3 p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-900/80 border border-neutral-200 dark:border-neutral-700/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <UserCheck className="w-4 h-4 text-emerald-500" />
                        <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
                          Select Contacts Allowed to See Online Status ({onlineSelected.length} of{' '}
                          {contacts.length})
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={selectAllOnline}
                          className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline font-semibold"
                        >
                          Select All
                        </button>
                        <span className="text-neutral-300 dark:text-neutral-700">•</span>
                        <button
                          type="button"
                          onClick={clearAllOnline}
                          className="text-[11px] text-neutral-500 hover:underline font-semibold"
                        >
                          Clear All
                        </button>
                      </div>
                    </div>

                    {/* Search filter for contacts */}
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-neutral-400" />
                      <input
                        type="text"
                        value={contactSearchOnline}
                        onChange={e => setContactSearchOnline(e.target.value)}
                        placeholder="Filter contacts..."
                        className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-xs text-neutral-900 dark:text-neutral-100 outline-none focus:border-emerald-500"
                      />
                    </div>

                    {/* Contacts Checklist */}
                    {loadingContacts ? (
                      <div className="py-4 flex items-center justify-center gap-2 text-xs text-neutral-500">
                        <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
                        Loading contacts...
                      </div>
                    ) : contacts.length === 0 ? (
                      <p className="text-xs text-neutral-500 italic py-2 text-center">
                        You have no contacts added yet. Add contacts to select them here.
                      </p>
                    ) : filteredContactsForOnline.length === 0 ? (
                      <p className="text-xs text-neutral-500 italic py-2 text-center">
                        No contacts match &quot;{contactSearchOnline}&quot;
                      </p>
                    ) : (
                      <div className="max-h-40 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800">
                        {filteredContactsForOnline.map(c => {
                          const isChecked = onlineSelected.includes(c._id);
                          return (
                            <label
                              key={c._id}
                              className="px-3 py-2 flex items-center justify-between hover:bg-neutral-50 dark:hover:bg-neutral-750 cursor-pointer transition select-none"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <img
                                  src={
                                    c.avatar ||
                                    `https://api.dicebear.com/7.x/avataaars/svg?seed=${c.username}`
                                  }
                                  alt={c.displayName}
                                  className="w-7 h-7 rounded-full object-cover border border-neutral-200 dark:border-neutral-700 shrink-0"
                                />
                                <div className="truncate">
                                  <p className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                                    {c.displayName}
                                  </p>
                                  <p className="text-[10px] text-neutral-500 dark:text-neutral-400 truncate">
                                    @{c.username}
                                  </p>
                                </div>
                              </div>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleOnlineContact(c._id)}
                                className="w-4 h-4 text-emerald-600 rounded border-neutral-300 focus:ring-emerald-500 shrink-0 cursor-pointer"
                              />
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : activeSection === 'theme' ? (
            /* THEME TAB (Renamed from Appearance) */
            <div className="space-y-6">
              {/* 1. App Theme Selection */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs font-bold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                    Application Theme ({THEMES.length})
                  </label>
                  <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 capitalize">
                    Current: {theme}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {THEMES.map(th => {
                    const isSelected = theme === th.id;
                    return (
                      <button
                        key={th.id}
                        onClick={() => setTheme(th.id)}
                        className={`p-3 rounded-xl border text-left flex items-center justify-between transition cursor-pointer ${
                          isSelected
                            ? 'border-indigo-600 ring-2 ring-indigo-500/20 bg-indigo-50/50 dark:bg-indigo-950/30'
                            : 'border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800/60'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-7 h-7 rounded-full shadow-inner border border-neutral-300 dark:border-neutral-600 flex items-center justify-center shrink-0"
                            style={{ backgroundColor: th.color }}
                          >
                            {isSelected && <Check className="w-4 h-4 text-indigo-500 drop-shadow-sm" />}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                              {th.name}
                            </p>
                            <p className="text-[10px] text-neutral-500 dark:text-neutral-400 line-clamp-1">
                              {th.desc}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Global Chat Wallpaper Preset */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs font-bold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                    Default Chat Wallpaper
                  </label>
                  <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 capitalize">
                    Current: {chatBackground}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {WALLPAPERS.map(wp => {
                    const isSelected = chatBackground === wp.id;
                    return (
                      <button
                        key={wp.id}
                        onClick={() => setChatBackground(wp.id)}
                        className={`h-24 rounded-xl border relative overflow-hidden transition text-left flex flex-col justify-end p-2.5 cursor-pointer ${
                          isSelected
                            ? 'border-indigo-600 ring-2 ring-indigo-500/30'
                            : 'border-neutral-200 dark:border-neutral-700'
                        } ${wp.previewClass}`}
                      >
                        <div className="bg-black/60 backdrop-blur-xs px-2 py-1 rounded-md flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-white truncate">
                            {wp.label}
                          </span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-indigo-300 shrink-0" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Account Information Card */}
              <div className="p-5 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700">
                <div className="flex items-center gap-4">
                  <div className="relative shrink-0">
                    <img
                      src={
                        user?.avatar ||
                        `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.username || 'user'}`
                      }
                      alt={user?.displayName || 'User'}
                      className="w-16 h-16 rounded-2xl object-cover ring-2 ring-indigo-500/30 dark:ring-indigo-400/30"
                    />
                    <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white dark:border-neutral-800 rounded-full" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100 truncate">
                      {user?.displayName || 'Your Profile'}
                    </h3>
                    <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium truncate mt-0.5">
                      @{user?.username || 'username'}
                    </p>
                    {user?.email && (
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
                        {user.email}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-neutral-200/80 dark:border-neutral-700/80 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200/60 dark:border-neutral-700/60">
                    <span className="text-neutral-500 dark:text-neutral-400">Account Status</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      Active & Connected
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200/60 dark:border-neutral-700/60">
                    <span className="text-neutral-500 dark:text-neutral-400">Encryption</span>
                    <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                      End-to-End Active
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/50 dark:bg-neutral-900/50 shrink-0 gap-2">
          <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
            {activeSection !== 'menu' && (
              <button
                type="button"
                onClick={() => setActiveSection('menu')}
                className="px-3 py-1.5 text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                onClose();
                logout();
              }}
              className="px-3 py-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
              title="Log out of your account"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Log Out</span>
            </button>

            {activeSection === 'privacy' && (
              <span className="hidden md:inline text-neutral-400">Changes take effect immediately</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {activeSection === 'privacy' && (
              <button
                type="button"
                onClick={handleSavePrivacy}
                disabled={saving}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Saving...
                  </>
                ) : saveSuccess ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Saved!
                  </>
                ) : (
                  <>
                    <Shield className="w-3.5 h-3.5" />
                    Save Privacy Settings
                  </>
                )}
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded-xl text-xs font-semibold transition cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
