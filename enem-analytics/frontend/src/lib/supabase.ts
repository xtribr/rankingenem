/**
 * Supabase Client Configuration
 *
 * This module provides the Supabase client and auth utilities.
 * It replaces the custom JWT-based auth system.
 */

import { createClient, Session } from '@supabase/supabase-js';

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

/**
 * Fetch profile with retry logic for Supabase cold start
 */
async function fetchProfileWithRetry(userId: string, maxRetries = 2): Promise<UserProfile | null> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const timeout = attempt === 1 ? 8000 : 5000; // Longer timeout for first attempt (cold start)
      const profilePromise = supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), timeout)
      );

      const { data, error } = await Promise.race([profilePromise, timeoutPromise]) as Awaited<typeof profilePromise>;

      if (error) {
        console.warn(`[fetchProfile] Attempt ${attempt} error:`, error.message);
        if (attempt < maxRetries) continue;
        return null;
      }

      console.log(`[fetchProfile] Success on attempt ${attempt}:`, data?.codigo_inep);
      return data;
    } catch (e) {
      console.warn(`[fetchProfile] Attempt ${attempt} timed out`);
      if (attempt < maxRetries) {
        console.log('[fetchProfile] Retrying...');
        continue;
      }
      return null;
    }
  }
  return null;
}

/**
 * Get user from session - fetches profile from database for accurate is_admin status
 */
export async function getUserFromSession(session: Session): Promise<User | null> {
  try {
    console.log('[getUserFromSession] Fetching profile for:', session.user.email);

    // Fetch profile from database - this is the source of truth for is_admin
    const profile = await fetchProfileWithRetry(session.user.id);

    if (profile) {
      console.log('[getUserFromSession] Profile found, is_admin:', profile.is_admin);
      return {
        id: session.user.id,
        email: session.user.email || '',
        codigo_inep: profile.codigo_inep || '',
        nome_escola: profile.nome_escola || '',
        is_admin: profile.is_admin || false,
        is_active: profile.is_active ?? true,
        created_at: session.user.created_at,
      };
    }

    // Fallback to user_metadata if profile not found
    console.warn('[getUserFromSession] Profile not found, falling back to user_metadata');
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
    console.error('[getUserFromSession] Unexpected error:', error);
    return null;
  }
}

/**
 * Get current user with profile data
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    console.log('[getCurrentUser] Getting session...');

    // Add timeout to getSession to prevent hanging
    const sessionPromise = supabase.auth.getSession();
    const sessionTimeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Session fetch timeout')), 5000)
    );

    let session = null;
    try {
      const result = await Promise.race([sessionPromise, sessionTimeout]);
      session = result.data?.session;
      if (result.error) {
        console.error('[getCurrentUser] Session error:', result.error);
        return null;
      }
    } catch {
      console.warn('[getCurrentUser] Session fetch timed out');
      return null;
    }

    if (!session?.user) {
      console.log('[getCurrentUser] No session');
      return null;
    }

    return getUserFromSession(session);
  } catch (error) {
    console.error('[getCurrentUser] Unexpected error:', error);
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
