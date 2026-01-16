'use client';

/**
 * Auth Context - Supabase Version
 *
 * Provides authentication state and methods using Supabase Auth.
 */

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { supabase, User, getCurrentUser, getUserFromSession, signIn, signOut } from './supabase';
import type { Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Refresh user using existing session to avoid re-fetching
  const refreshUserFromSession = useCallback(async (currentSession: Session | null) => {
    console.log('[AuthContext] refreshUserFromSession called');
    if (!currentSession) {
      console.log('[AuthContext] No session provided');
      setUser(null);
      return;
    }
    try {
      const currentUser = await getUserFromSession(currentSession);
      console.log('[AuthContext] getUserFromSession returned:', currentUser?.email || 'null');
      setUser(currentUser);
    } catch (error) {
      console.error('[AuthContext] Failed to refresh user:', error);
      setUser(null);
    }
  }, []);

  // Legacy refresh - fetches session first (for manual refresh)
  const refreshUser = useCallback(async () => {
    console.log('[AuthContext] refreshUser called (legacy)');
    try {
      const currentUser = await getCurrentUser();
      console.log('[AuthContext] getCurrentUser returned:', currentUser?.email || 'null');
      setUser(currentUser);
    } catch (error) {
      console.error('[AuthContext] Failed to refresh user:', error);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    let initialLoadDone = false;

    console.log('[AuthContext] Initializing...');

    // Listen for auth changes - handles BOTH initial load and subsequent changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!mounted) return;
        console.log('[AuthContext] Auth state changed:', event);
        setSession(newSession);

        // Handle initial session or sign in
        if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          // Prevent duplicate fetches - only skip if we already loaded a valid user
          if (event === 'SIGNED_IN' && initialLoadDone && newSession) {
            console.log('[AuthContext] Skipping duplicate SIGNED_IN');
            return;
          }

          console.log('[AuthContext] Loading user for', event);
          await refreshUserFromSession(newSession);
          console.log('[AuthContext] User loaded');

          // Only mark as done if we actually had a session
          if (newSession) {
            initialLoadDone = true;
          }
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          initialLoadDone = false;
        }

        if (mounted) {
          setIsLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [refreshUserFromSession]);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        throw new Error(error.message === 'Invalid login credentials'
          ? 'Email ou senha incorretos'
          : error.message);
      }
      // User will be set by onAuthStateChange
    } catch (error) {
      setIsLoading(false);
      throw error;
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await signOut();
      setUser(null);
      setSession(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        isAuthenticated: !!session && !!user,
        isAdmin: user?.is_admin ?? false,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
