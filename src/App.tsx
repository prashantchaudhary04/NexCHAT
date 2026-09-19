import React, { useState, useEffect } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider, useSocket } from './context/SocketContext';
import { Navigation } from './components/Navigation';
import { ChatList } from './components/ChatList';
import { ChatArea } from './components/ChatArea';
import { MessageRequests } from './components/MessageRequests';
import { ContactsView } from './components/ContactsView';
import { StoriesView } from './components/StoriesView';
import { CallsView } from './components/CallsView';
import { UserSearchModal } from './components/UserSearchModal';
import { ProfileModal } from './components/ProfileModal';
import { SettingsModal } from './components/SettingsModal';
import { CallModal } from './components/CallModal';
import { CreateGroupModal } from './components/CreateGroupModal';
import { AuthScreen } from './components/AuthScreen';
import { Conversation, TabType } from './types';
import { api } from './services/api';
import { MessageSquare, Shield, UserPlus, Sparkles, X, Users, Bookmark } from 'lucide-react';

function MainApp() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { socket, notifications, dismissNotification } = useSocket();

  const [activeTab, setActiveTab] = useState<TabType>('chats');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [pendingRequestsCount, setPendingRequestsCount] = useState<number>(0);
  const [missedCallsCount, setMissedCallsCount] = useState<number>(0);

  // Modals state
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [createGroupModalOpen, setCreateGroupModalOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);

  // Load conversations, pending requests, and missed calls
  const loadInitialData = async () => {
    try {
      const [convData, reqData, callsData] = await Promise.all([
        api.chat.getConversations(),
        api.contacts.getRequests(),
        api.calls.getHistory().catch(() => ({ calls: [] })),
      ]);
      setConversations(convData.conversations);
      setPendingRequestsCount(reqData.requests.length);
      if (callsData?.calls && user) {
        const missed = callsData.calls.filter((c: any) => {
          const caller = typeof c.caller === 'object' ? c.caller : null;
          const callerId = caller?._id || c.callerId || (typeof c.caller === 'string' ? c.caller : '');
          const isCaller = c.isCaller !== undefined ? c.isCaller : callerId === user._id;
          return !isCaller && (c.status === 'not_accepted' || c.status === 'missed');
        }).length;
        setMissedCallsCount(missed);
      }
    } catch (err) {
      console.error('Failed to load initial chat data:', err);
    }
  };

  const handleOpenSelfChat = async () => {
    try {
      const data = await api.chat.getSelfConversation();
      if (data && data.conversation) {
        setConversations(prev => {
          if (!prev.some(c => c._id === data.conversation._id)) {
            return [data.conversation, ...prev];
          }
          return prev;
        });
        setActiveConversationId(data.conversation._id);
        setActiveTab('chats');
      }
    } catch (err) {
      console.error('Failed to open self chat:', err);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      setActiveConversationId(null);
      loadInitialData();
    } else {
      setActiveConversationId(null);
    }
  }, [isAuthenticated]);

  // Real-time socket updates for conversations list
  useEffect(() => {
    if (!socket) return;

    const handleMessageReceived = (msg: any) => {
      setConversations(prev => {
        const index = prev.findIndex(c => c._id === msg.conversationId);
        if (index !== -1) {
          const updated = [...prev];
          const conv = { ...updated[index] };
          conv.lastMessage = msg;
          conv.updatedAt = new Date().toISOString();
          if (activeConversationId !== conv._id) {
            conv.unreadCount = (conv.unreadCount || 0) + 1;
          }
          // Move conversation to top
          updated.splice(index, 1);
          return [conv, ...updated];
        } else {
          // If a new conversation was created
          loadInitialData();
          return prev;
        }
      });
    };

    const handleRequestReceived = () => {
      setPendingRequestsCount(prev => prev + 1);
    };

    const handleRequestAccepted = () => {
      loadInitialData();
    };

    socket.on('message:received', handleMessageReceived);
    socket.on('contact:request-received', handleRequestReceived);
    socket.on('contact:request-accepted', handleRequestAccepted);

    return () => {
      socket.off('message:received', handleMessageReceived);
      socket.off('contact:request-received', handleRequestReceived);
      socket.off('contact:request-accepted', handleRequestAccepted);
    };
  }, [socket, activeConversationId]);

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-neutral-900 text-white select-none">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-semibold tracking-wide">Loading NexusChat...</p>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <AuthScreen />;
  }

  const unreadChatsCount = conversations.reduce(
    (acc, curr) => acc + (curr._id !== activeConversationId ? curr.unreadCount || 0 : 0),
    0
  );

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 antialiased">
      {/* 1. Left Vertical Dock Navigation (Desktop) & Bottom Navigation (Mobile) */}
      <Navigation
        activeTab={activeTab}
        setActiveTab={tab => {
          setActiveTab(tab);
          if (tab === 'calls') {
            setMissedCallsCount(0);
          }
        }}
        currentUser={user}
        unreadChatsCount={unreadChatsCount}
        pendingRequestsCount={pendingRequestsCount}
        missedCallsCount={missedCallsCount}
        hasUnviewedStories={false}
        onOpenSearchModal={() => setSearchModalOpen(true)}
        onOpenProfileModal={() => setProfileModalOpen(true)}
        onOpenSettingsModal={() => setSettingsModalOpen(true)}
        isChatActiveOnMobile={Boolean(activeConversationId && activeTab === 'chats')}
      />

      {/* 2. Main Content Area */}
      <main className="flex-1 flex h-full overflow-hidden relative">
        {/* Tab: CHATS */}
        {activeTab === 'chats' && (
          <div className="flex-1 flex h-full w-full overflow-hidden">
            {/* Conversations List - Hidden on mobile if active conversation is selected */}
            <div
              className={`h-full w-full md:w-auto ${
                activeConversationId ? 'hidden md:flex' : 'flex'
              }`}
            >
              <ChatList
                conversations={conversations}
                activeConversationId={activeConversationId}
                currentUserId={user._id}
                currentUser={user}
                onSelectConversation={id => {
                  setActiveConversationId(id);
                  // Mark as read in local conversation list
                  setConversations(prev =>
                    prev.map(c => (c._id === id ? { ...c, unreadCount: 0 } : c))
                  );
                }}
                onOpenSearchModal={() => setSearchModalOpen(true)}
                onOpenCreateGroupModal={() => setCreateGroupModalOpen(true)}
                onOpenSelfChat={handleOpenSelfChat}
                onOpenProfileModal={() => setProfileModalOpen(true)}
                onOpenSettingsModal={() => setSettingsModalOpen(true)}
              />
            </div>

            {/* Conversation Active Window */}
            {activeConversationId ? (
              <div
                className={`flex-1 h-full ${
                  activeConversationId ? 'flex' : 'hidden md:flex'
                }`}
              >
                <ChatArea
                  conversationId={activeConversationId}
                  currentUser={user}
                  onBackMobile={() => setActiveConversationId(null)}
                  onOpenSearchModal={() => setSearchModalOpen(true)}
                  onGroupLeft={() => {
                    setActiveConversationId(null);
                    loadInitialData();
                  }}
                />
              </div>
            ) : (
              /* No Active Chat Selected Placeholder */
              <div className="hidden md:flex flex-1 flex-col items-center justify-center p-8 bg-neutral-50/50 dark:bg-neutral-900/50 text-center select-none">
                <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-950/60 rounded-3xl flex items-center justify-center mx-auto mb-4 text-indigo-600 dark:text-indigo-400 shadow-sm">
                  <MessageSquare className="w-8 h-8" />
                </div>
                <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
                  Select a Conversation
                </h2>
                <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 max-w-sm mt-1.5 mb-6">
                  Pick a contact or group from your chat list, start a new group with up to 100 members, message yourself to save notes, or connect with friends.
                </p>

                <div className="flex items-center flex-wrap justify-center gap-3">
                  <button
                    onClick={handleOpenSelfChat}
                    className="px-4 py-2 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Bookmark className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    Message Yourself
                  </button>
                  <button
                    onClick={() => setCreateGroupModalOpen(true)}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
                  >
                    <Users className="w-4 h-4" />
                    New Group (Max 100)
                  </button>
                  <button
                    onClick={() => setSearchModalOpen(true)}
                    className="px-4 py-2 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <UserPlus className="w-4 h-4" />
                    Find People
                  </button>
                  <button
                    onClick={() => setActiveTab('requests')}
                    className="px-4 py-2 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Shield className="w-4 h-4 text-amber-500" />
                    Message Requests ({pendingRequestsCount})
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab: MESSAGE REQUESTS */}
        {activeTab === 'requests' && (
          <MessageRequests
            onOpenConversation={conversationId => {
              setActiveTab('chats');
              setActiveConversationId(conversationId);
              loadInitialData();
            }}
            onRequestHandled={() => {
              loadInitialData();
            }}
          />
        )}

        {/* Tab: CONTACTS */}
        {activeTab === 'contacts' && (
          <ContactsView
            onOpenConversation={conversationId => {
              setActiveTab('chats');
              setActiveConversationId(conversationId);
            }}
            onOpenSearchModal={() => setSearchModalOpen(true)}
          />
        )}

        {/* Tab: STORIES / STATUS */}
        {activeTab === 'stories' && <StoriesView currentUser={user} />}

        {/* Tab: CALL HISTORY */}
        {activeTab === 'calls' && <CallsView currentUser={user} />}
      </main>

      {/* Real-time Toasts & In-App Alerts */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
        {notifications.map(notif => (
          <div
            key={notif._id}
            className="pointer-events-auto bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 shadow-xl rounded-2xl p-3 flex items-start gap-3 animate-bounce-in"
          >
            <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center text-indigo-600 shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <h5 className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                {notif.title}
              </h5>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
                {notif.body}
              </p>
            </div>
            <button
              onClick={() => dismissNotification(notif._id)}
              className="p-1 text-neutral-400 hover:text-neutral-600 rounded-full"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Global Modals */}
      <UserSearchModal
        isOpen={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
        onOpenSelfChat={handleOpenSelfChat}
        onSelectUserToChat={userId => {
          // Open or load chat for this user
          loadInitialData().then(() => {
            setActiveTab('chats');
          });
        }}
      />

      {/* Create Group Modal (Limit 100 members) */}
      <CreateGroupModal
        isOpen={createGroupModalOpen}
        onClose={() => setCreateGroupModalOpen(false)}
        currentUser={user}
        onGroupCreated={newGroup => {
          setConversations(prev => [newGroup, ...prev.filter(c => c._id !== newGroup._id)]);
          setActiveConversationId(newGroup._id);
          setActiveTab('chats');
        }}
      />

      <ProfileModal
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
      />

      <SettingsModal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
      />

      {/* WebRTC Video / Voice Call Modal Screen */}
      <CallModal />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SocketProvider>
          <MainApp />
        </SocketProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
