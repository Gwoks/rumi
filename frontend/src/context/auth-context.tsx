'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, User, Child } from '@/lib/api';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  childrenList: Child[];
  selectedChild: Child | null;
  setSelectedChild: (child: Child | null) => void;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  switchDemoUser: (role: 'parent' | 'admin') => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [childrenList, setChildrenList] = useState<Child[]>([]);
  const [selectedChild, setSelectedChild] = useState<Child | null>(null);

  const fetchChildren = useCallback(async () => {
    try {
      const res = await api.children.list();
      setChildrenList(res.children);
      if (res.children.length > 0) {
        setSelectedChild((prev) => prev ? (res.children.find(c => c.id === prev.id) || res.children[0]) : res.children[0]);
      }
    } catch (err) {
      console.error('Failed to fetch children list:', err);
    }
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      const { user: currentUser } = await api.auth.me();
      setUser(currentUser);
      await fetchChildren();
    } catch {
      setUser(null);
      setChildrenList([]);
      setSelectedChild(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('rumi_token');
      }
    } finally {
      setLoading(false);
    }
  }, [fetchChildren]);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const login = async (email: string, password: string): Promise<User> => {
    setLoading(true);
    try {
      const res = await api.auth.login({ email, password });
      if (typeof window !== 'undefined') {
        localStorage.setItem('rumi_token', res.token);
      }
      setUser(res.user);
      await fetchChildren();
      return res.user;
    } finally {
      setLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await api.auth.logout();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('rumi_token');
      }
      setUser(null);
      setChildrenList([]);
      setSelectedChild(null);
    }
  };

  const switchDemoUser = async (role: 'parent' | 'admin'): Promise<void> => {
    if (role === 'parent') {
      await login('nadia@example.com', 'parent123');
    } else {
      await login('admin@rumi.id', 'admin123');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        childrenList,
        selectedChild,
        setSelectedChild,
        login,
        logout,
        refreshSession,
        switchDemoUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
