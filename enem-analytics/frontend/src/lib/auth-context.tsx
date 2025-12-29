'use client';

/**
 * Auth Context - Supabase Version
 *
 * Provides authentication state and methods using Supabase Auth.
 */

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { supabase, User, getCurrentUser, signIn, signOut } from './supabase';
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

  const refreshUser = useCallback(async () => {
    console.log('[AuthContext] refreshUser called');
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

    // Get initial session
    console.log('[AuthContext] Initializing...');
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      console.log('[AuthContext] Initial session:', session ? 'exists' : 'none');
      setSession(session);
      if (session) {
        refreshUser().finally(() => {
          if (mounted) {
            console.log('[AuthContext] Initial load complete');
            setIsLoading(false);
          }
        });
      } else {
        console.log('[AuthContext] No session, loading complete');
        setIsLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        console.log('[AuthContext] Auth state changed:', event);
        setSession(session);

        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          console.log('[AuthContext] Refreshing user after', event);
          await refreshUser();
          console.log('[AuthContext] User refreshed, setting isLoading=false');
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
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
  }, [refreshUser]);

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
