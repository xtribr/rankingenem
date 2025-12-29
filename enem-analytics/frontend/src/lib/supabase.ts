/**
 * Supabase Client Configuration
 *
 * This module provides the Supabase client and auth utilities.
 * It replaces the custom JWT-based auth system.
 */

import { createClient } from '@supabase/supabase-js';

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
 * Get current user with profile data
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    console.log('[getCurrentUser] Getting session...');
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
      console.error('[getCurrentUser] Session error:', sessionError);
      return null;
    }

    if (!session?.user) {
      console.log('[getCurrentUser] No session');
      return null;
    }

    console.log('[getCurrentUser] Session found, fetching profile for:', session.user.id);

    // Fetch profile data with timeout
    const profilePromise = supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    // Add timeout to prevent hanging
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Profile fetch timeout')), 5000)
    );

    let profile = null;
    try {
      const { data, error } = await Promise.race([profilePromise, timeoutPromise]) as Awaited<typeof profilePromise>;
      if (error) {
        console.warn('[getCurrentUser] Profile fetch error:', error.message);
      } else {
        profile = data;
        console.log('[getCurrentUser] Profile fetched:', profile?.codigo_inep);
      }
    } catch (timeoutError) {
      console.warn('[getCurrentUser] Profile fetch timed out, using fallback');
    }

    if (!profile) {
      // Return basic user from auth metadata
      console.log('[getCurrentUser] Using auth metadata fallback');
      return {
        id: session.user.id,
        email: session.user.email || '',
        codigo_inep: session.user.user_metadata?.codigo_inep || '',
        nome_escola: session.user.user_metadata?.nome_escola || '',
        is_admin: session.user.user_metadata?.is_admin || false,
        is_active: true,
        created_at: session.user.created_at,
      };
    }

    return {
      id: session.user.id,
      email: session.user.email || '',
      codigo_inep: profile.codigo_inep,
      nome_escola: profile.nome_escola,
      is_admin: profile.is_admin || false,
      is_active: profile.is_active !== false,
      created_at: profile.created_at,
    };
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
