-- =============================================================
-- SUPABASE SETUP SQL
-- Run this in Supabase SQL Editor (supabase.com > SQL Editor)
-- =============================================================

-- 1. Create profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  codigo_inep VARCHAR(8) UNIQUE NOT NULL,
  nome_escola VARCHAR(255) NOT NULL,
  is_admin BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies

-- Users can read their own profile
CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile (limited fields)
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Admins can read all profiles
CREATE POLICY "Admins can read all profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

-- Admins can insert new profiles
CREATE POLICY "Admins can insert profiles"
  ON public.profiles FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

-- Admins can update all profiles
CREATE POLICY "Admins can update all profiles"
  ON public.profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

-- Admins can delete profiles
CREATE POLICY "Admins can delete profiles"
  ON public.profiles FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

-- Service role has full access (for backend scripts)
CREATE POLICY "Service role has full access"
  ON public.profiles FOR ALL
  USING (auth.role() = 'service_role');

-- 4. Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 5. Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_codigo_inep ON public.profiles(codigo_inep);

-- =============================================================
-- STORAGE BUCKET SETUP
-- Run these commands in Storage settings or SQL Editor
-- =============================================================

-- Create storage bucket for ENEM data files
INSERT INTO storage.buckets (id, name, public)
VALUES ('enem', 'enem', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies

-- Allow authenticated users to read files
CREATE POLICY "Authenticated users can read enem files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'enem'
  AND auth.role() = 'authenticated'
);

-- Allow service role to upload files
CREATE POLICY "Service role can upload enem files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'enem'
  AND auth.role() = 'service_role'
);

-- Allow service role to update files
CREATE POLICY "Service role can update enem files"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'enem'
  AND auth.role() = 'service_role'
);

-- =============================================================
-- VERIFICATION QUERIES
-- Run these to verify setup
-- =============================================================

-- Check profiles table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name = 'profiles'
) AS profiles_table_exists;

-- Check RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'profiles';

-- Count policies
SELECT COUNT(*) AS policy_count
FROM pg_policies
WHERE tablename = 'profiles';

-- List storage buckets
SELECT * FROM storage.buckets WHERE id = 'enem';
