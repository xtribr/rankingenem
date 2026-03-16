'use client';

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

  const refreshUserFromSession = useCallback(async (currentSession: Session | null) => {
    if (!currentSession) {
      setUser(null);
      return;
    }
    try {
      const currentUser = await getUserFromSession(currentSession);
      setUser(currentUser);
    } catch (error) {
      console.error('Falha ao atualizar usuário da sessão:', error);
      setUser(null);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    } catch (error) {
      console.error('Falha ao recarregar usuário:', error);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    let initialLoadDone = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!mounted) return;
        setSession(newSession);

        if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          if (event === 'SIGNED_IN' && initialLoadDone && newSession) {
            return;
          }

          await refreshUserFromSession(newSession);
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
      await signIn(email, password);
    } catch (error) {
      setIsLoading(false);
      if (error instanceof Error && error.message === 'Invalid login credentials') {
        throw new Error('Email ou senha incorretos');
      }
      throw error instanceof Error ? error : new Error('Erro ao fazer login');
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
