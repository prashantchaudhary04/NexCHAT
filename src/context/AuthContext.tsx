import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, PrivacyOption } from '../types';
import { api } from '../services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (loginIdentifier: string, password?: string) => Promise<void>;
  register: (payload: any) => Promise<void>;
  logout: () => void;
  updateUser: (updatedData: Partial<User>) => Promise<void>;
  updatePrivacy: (payload: {
    lastSeenPrivacy?: PrivacyOption;
    lastSeenSelectedContacts?: string[];
    onlinePrivacy?: PrivacyOption;
    onlineSelectedContacts?: string[];
  }) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadUser() {
      if (!token) {
        setIsLoading(false);
        return;
      }
      try {
        const data = await api.auth.getMe();
        setUser(data.user);
      } catch (err) {
        console.warn('Failed to restore session:', err);
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }
    loadUser();
  }, [token]);

  const login = async (loginIdentifier: string, password = 'password123') => {
    setIsLoading(true);
    try {
      const res = await api.auth.login({ loginIdentifier, password });
      localStorage.setItem('token', res.token);
      if (res.user?.username) {
        localStorage.setItem('nexus_last_username', res.user.username);
      }
      setToken(res.token);
      setUser(res.user);
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (payload: any) => {
    setIsLoading(true);
    try {
      const res = await api.auth.register(payload);
      localStorage.setItem('token', res.token);
      if (res.user?.username) {
        localStorage.setItem('nexus_last_username', res.user.username);
      }
      setToken(res.token);
      setUser(res.user);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  const updateUser = async (updatedData: Partial<User>) => {
    const res = await api.auth.updateProfile(updatedData);
    setUser(res.user);
  };

  const updatePrivacy = async (payload: {
    lastSeenPrivacy?: PrivacyOption;
    lastSeenSelectedContacts?: string[];
    onlinePrivacy?: PrivacyOption;
    onlineSelectedContacts?: string[];
  }) => {
    const res = await api.auth.updatePrivacy(payload);
    setUser(res.user);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        updateUser,
        updatePrivacy,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
