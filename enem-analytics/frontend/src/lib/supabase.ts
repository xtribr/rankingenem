/**
 * Supabase client and auth utilities for the ranking ENEM frontend.
 */

import { createClient, Session } from '@supabase/supabase-js';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Environment variables
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Validate environment
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('Supabase environment variables not set. Auth will not work.');
}

// Create Supabase client
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// User profile type (matches Supabase profiles table)
export interface UserProfile {
  id: string;
  codigo_inep: string;
  nome_escola: string;
  is_admin: boolean;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

// Extended user type with email from auth
export interface User {
  id: string;
  email: string;
  codigo_inep: string;
  nome_escola: string;
  is_admin: boolean;
  is_active: boolean;
  created_at: string;
}

interface AuthMeResponse {
  id: string;
  email: string;
  codigo_inep: string;
  nome_escola: string;
  is_admin: boolean;
  is_active: boolean;
}

/**
 * Sign in with email and password
 */
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

/**
 * Sign out the current user
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Get current session
 */
export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw new Error(error.message);
  }
  return data.session;
}

async function fetchUserFromBackend(accessToken: string, maxRetries = 2): Promise<AuthMeResponse | null> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const timeout = attempt === 1 ? 5000 : 3000;
      const request = fetch(`${API_BASE}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), timeout)
      );

      const response = await Promise.race([request, timeoutPromise]) as Response;
      if (response.ok) {
        return response.json();
      }

      if (response.status === 401) {
        return null;
      }
    } catch {
      if (attempt < maxRetries) {
        continue;
      }
    }
  }

  return null;
}

/**
 * Get user from session using the backend as the source of truth.
 */
export async function getUserFromSession(session: Session): Promise<User | null> {
  try {
    const profile = await fetchUserFromBackend(session.access_token);
    if (profile) {
      return {
        id: profile.id,
        email: profile.email || session.user.email || '',
        codigo_inep: profile.codigo_inep || '',
        nome_escola: profile.nome_escola || '',
        is_admin: profile.is_admin || false,
        is_active: profile.is_active ?? true,
        created_at: session.user.created_at,
      };
    }

    return {
      id: session.user.id,
      email: session.user.email || '',
      codigo_inep: session.user.user_metadata?.codigo_inep || '',
      nome_escola: session.user.user_metadata?.nome_escola || '',
      is_admin: session.user.user_metadata?.is_admin || false,
      is_active: true,
      created_at: session.user.created_at,
    };
  } catch (error) {
    console.error('Erro ao obter usuário a partir da sessão:', error);
    return null;
  }
}

/**
 * Get current user with profile data
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    const sessionPromise = supabase.auth.getSession();
    const sessionTimeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Session fetch timeout')), 5000)
    );

    let session = null;
    try {
      const result = await Promise.race([sessionPromise, sessionTimeout]);
      session = result.data?.session;
      if (result.error) {
        console.error('Erro ao buscar sessão:', result.error);
        return null;
      }
    } catch {
      console.warn('Tempo esgotado ao buscar sessão');
      return null;
    }

    if (!session?.user) {
      return null;
    }

    return getUserFromSession(session);
  } catch (error) {
    console.error('Erro inesperado ao buscar usuário atual:', error);
    return null;
  }
}

/**
 * Get access token for API calls
 */
export async function getAccessToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
}

/**
 * Request password reset email
 */
export async function resetPassword(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Update password (after reset)
 */
export async function updatePassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Subscribe to auth state changes
 */
export function onAuthStateChange(
  callback: (event: string, session: unknown) => void
) {
  return supabase.auth.onAuthStateChange(callback);
}
