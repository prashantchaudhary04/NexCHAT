import { User, Conversation, Message, FriendRequest, Story, StoryGroup, CallHistory, AppNotification } from '../types';

const API_BASE = '/api';

function getHeaders() {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      ...getHeaders(),
      ...(options.headers || {}),
    },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Something went wrong');
  }
  return data;
}

export const api = {
  auth: {
    checkUsername: (username: string) => request<{ available: boolean; message: string }>(`/auth/check-username?username=${encodeURIComponent(username)}`),
    register: (payload: any) => request<{ message: string; user: User; token: string }>('/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
    login: (payload: { loginIdentifier: string; password?: string }) => request<{ message: string; user: User; token: string }>('/auth/login', { method: 'POST', body: JSON.stringify(payload) }),
    getMe: () => request<{ user: User }>('/auth/me'),
    updateProfile: (payload: Partial<User>) => request<{ message: string; user: User }>('/auth/profile', { method: 'PUT', body: JSON.stringify(payload) }),
    updatePrivacy: (payload: {
      lastSeenPrivacy?: 'all' | 'contacts' | 'selected' | 'nobody';
      lastSeenSelectedContacts?: string[];
      onlinePrivacy?: 'all' | 'contacts' | 'selected' | 'nobody';
      onlineSelectedContacts?: string[];
    }) => request<{ message: string; user: User }>('/auth/privacy', { method: 'PUT', body: JSON.stringify(payload) }),
    searchUsers: (query: string) => request<{ users: User[] }>(`/auth/search?q=${encodeURIComponent(query)}`),
  },
  contacts: {
    sendRequest: (receiverId: string, introMessage?: string) => request<{ message: string; request: FriendRequest }>('/contacts/request', { method: 'POST', body: JSON.stringify({ receiverId, introMessage }) }),
    getRequests: () => request<{ requests: FriendRequest[] }>('/contacts/requests'),
    getSentRequests: () => request<{ requests: FriendRequest[] }>('/contacts/sent-requests'),
    acceptRequest: (requestId: string) => request<{ message: string; conversationId: string; request: FriendRequest }>(`/contacts/requests/${requestId}/accept`, { method: 'POST' }),
    rejectRequest: (requestId: string) => request<{ message: string; request: FriendRequest }>(`/contacts/requests/${requestId}/reject`, { method: 'POST' }),
    getContacts: () => request<{ contacts: User[] }>('/contacts'),
    removeContact: (contactId: string) => request<{ message: string }>(`/contacts/${contactId}`, { method: 'DELETE' }),
  },
  chat: {
    getConversations: () => request<{ conversations: Conversation[] }>('/chat/conversations'),
    getSelfConversation: () => request<{ conversation: Conversation }>('/chat/self'),
    getMessages: (conversationId: string) => request<{ messages: Message[]; conversation: Conversation; otherUser: User | null; isContact: boolean }>(`/chat/conversations/${conversationId}/messages`),
    sendMessage: (payloadOrConvId: any, maybePayload?: any) => {
      const conversationId = typeof payloadOrConvId === 'string' ? payloadOrConvId : payloadOrConvId.conversationId;
      const payload = typeof payloadOrConvId === 'string' ? maybePayload : payloadOrConvId;
      return request<{ message: Message }>(`/chat/conversations/${conversationId}/messages`, { method: 'POST', body: JSON.stringify(payload) });
    },
    editMessage: (messageId: string, newText: string) => request<{ message: Message }>(`/chat/messages/${messageId}`, { method: 'PUT', body: JSON.stringify({ newText }) }),
    deleteMessage: (messageId: string, forEveryone: boolean) => request<{ message: string }>(`/chat/messages/${messageId}`, { method: 'DELETE', body: JSON.stringify({ forEveryone }) }),
    reactToMessage: (messageId: string, emoji: string) => request<{ reactions: any[] }>(`/chat/messages/${messageId}/react`, { method: 'POST', body: JSON.stringify({ emoji }) }),
    reactMessage: (messageId: string, emoji: string) => request<{ reactions: any[] }>(`/chat/messages/${messageId}/react`, { method: 'POST', body: JSON.stringify({ emoji }) }),
    forwardMessage: (messageId: string, targetConversationId: string) => request<{ message: Message }>('/chat/messages/forward', { method: 'POST', body: JSON.stringify({ messageId, targetConversationId }) }),
    updateBackground: (conversationId: string, background: string) => request<{ message: string; background: string }>(`/chat/conversations/${conversationId}/background`, { method: 'PUT', body: JSON.stringify({ background }) }),
    setBackground: (conversationId: string, background: string) => request<{ message: string; background: string }>(`/chat/conversations/${conversationId}/background`, { method: 'PUT', body: JSON.stringify({ background }) }),
    createGroup: (payload: { name: string; description?: string; avatar?: string; memberIds: string[] }) =>
      request<{ message: string; group: Conversation }>('/chat/groups', { method: 'POST', body: JSON.stringify(payload) }),
    addGroupMembers: (groupId: string, memberIds: string[]) =>
      request<{ message: string; participantsCount: number; group: Conversation }>(`/chat/groups/${groupId}/members`, { method: 'POST', body: JSON.stringify({ memberIds }) }),
    leaveGroup: (groupId: string) =>
      request<{ message: string }>(`/chat/groups/${groupId}/leave`, { method: 'POST' }),
    updateGroup: (groupId: string, payload: { name?: string; description?: string; avatar?: string }) =>
      request<{ message: string; group: Conversation }>(`/chat/groups/${groupId}`, { method: 'PUT', body: JSON.stringify(payload) }),
  },
  stories: {
    create: (payload: {
      mediaType: 'image' | 'video' | 'text';
      mediaUrl?: string;
      textContent?: string;
      backgroundGradient?: string;
      textColor?: string;
      visibility?: 'contacts' | 'public';
    }) => request<{ story: Story }>('/stories', { method: 'POST', body: JSON.stringify(payload) }),
    getAll: () => request<{
      myStatus: { user: User; stories: Story[] };
      recentUpdates: StoryGroup[];
      viewedUpdates: StoryGroup[];
    }>('/stories'),
    view: (storyId: string) => request<{ views: any[] }>(`/stories/${storyId}/view`, { method: 'POST' }),
    delete: (storyId: string) => request<{ message: string }>(`/stories/${storyId}`, { method: 'DELETE' }),
  },
  calls: {
    log: (payload: {
      receiverId?: string;
      conversationId?: string;
      isGroup?: boolean;
      callType: 'audio' | 'video';
      status?: string;
      duration?: number;
    }) =>
      request<{ call: CallHistory; message?: Message; conversationId?: string }>('/calls/log', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    getHistory: () => request<{ calls: CallHistory[] }>('/calls/history'),
  },
  upload: {
    media: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/upload`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'File upload failed');
      return data as { fileUrl: string; fileName: string; fileType: 'image' | 'video' | 'audio' | 'document' | 'other'; fileSize: number };
    },
  },
  notifications: {
    getAll: () => request<{ notifications: AppNotification[] }>('/notifications'),
    markRead: (id: string) => request<{ success: boolean }>(`/notifications/${id}/read`, { method: 'PUT' }),
    markAllRead: () => request<{ success: boolean }>('/notifications/mark-all-read', { method: 'PUT' }),
  },
};
