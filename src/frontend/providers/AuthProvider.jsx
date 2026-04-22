import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext(null);
const API_BASE = '/api'; // Adjusted for Vercel

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  // Helper to fetch custom API
  const apiCall = async (path, body) => {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  };

  const loadSessionFromStorage = useCallback(() => {
    try {
      const storedToken = localStorage.getItem('nexus_access_token');
      const storedUser = localStorage.getItem('nexus_user');
      
      if (storedToken && storedUser) {
        const parsedUser = JSON.parse(storedUser);
        setSession({ access_token: storedToken });
        setUser(parsedUser);
        setProfile(parsedUser);
      }
    } catch (e) {
      console.warn('[Auth] Failed to load session from storage', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    console.log('[Auth] Initializing Custom AuthProvider...');
    loadSessionFromStorage();
  }, [loadSessionFromStorage]);

  const signInWithEmail = async (email, password) => {
    setLoading(true);
    try {
      const data = await apiCall('/auth?action=login', { email, password });
      
      localStorage.setItem('nexus_access_token', data.session.access_token);
      localStorage.setItem('nexus_user', JSON.stringify(data.user));
      
      setSession(data.session);
      setUser(data.user);
      setProfile(data.user);
      return data;
    } finally {
      setLoading(false);
    }
  };

  const signUpWithEmail = async (email, password, fullName) => {
    setLoading(true);
    try {
      const data = await apiCall('/auth?action=register', { email, password, full_name: fullName });
      
      localStorage.setItem('nexus_access_token', data.session.access_token);
      localStorage.setItem('nexus_user', JSON.stringify(data.user));
      
      setSession(data.session);
      setUser(data.user);
      setProfile(data.user);
      return data;
    } finally {
      setLoading(false);
    }
  };

  const signInWithOAuth = async (provider) => {
    throw new Error('OAuth login não é suportado pelo sistema de banco local ainda.');
  };

  const signOut = async () => {
    localStorage.removeItem('nexus_access_token');
    localStorage.removeItem('nexus_user');
    setUser(null);
    setProfile(null);
    setSession(null);
  };

  const resetPassword = async (email) => {
    throw new Error('Recuperação de senha desabilitada no modo autônomo.');
  };

  const getAuthHeaders = async () => {
    const token = localStorage.getItem('nexus_access_token');
    if (!token) throw new Error('No active session');
    return {
      'Authorization': `Bearer ${token}`
    };
  };

  const value = {
    user,
    profile,
    session,
    loading,
    isAuthenticated: !!user,
    isAdmin: profile?.role === 'admin' || profile?.role === 'superadmin',
    plan: profile?.plan || 'free',
    signInWithEmail,
    signUpWithEmail,
    signInWithOAuth,
    signOut,
    resetPassword,
    getAuthHeaders,
    refreshProfile: () => { /* No-op unless we build a /api/auth?action=me endpoint */ },
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
