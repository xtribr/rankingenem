-- =============================================================
-- MIGRATION 002: Fix Profiles RLS Infinite Recursion
-- Run this in Supabase SQL Editor
-- Date: 2025-01-04
-- =============================================================

-- The problem: profiles_select_policy checks profiles.is_admin
-- which triggers the same policy, causing infinite recursion.

-- Solution: Create a SECURITY DEFINER function that bypasses RLS
-- to check admin status, then use it in the policy.

-- =====================================
-- STEP 1: Create helper function (bypasses RLS)
-- =====================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_admin = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon;

-- =====================================
-- STEP 2: Drop old problematic policies
-- =====================================

DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_policy" ON public.profiles;

-- =====================================
-- STEP 3: Create new policies using the helper function
-- =====================================

-- SELECT: Users see own profile, admins see all
CREATE POLICY "profiles_select_policy" ON public.profiles
FOR SELECT USING (
    auth.uid() = id  -- Users always see their own profile
    OR
    public.is_admin()  -- Admins see all (no recursion!)
);

-- UPDATE: Users update own, admins update all
CREATE POLICY "profiles_update_policy" ON public.profiles
FOR UPDATE USING (
    auth.uid() = id
    OR
    public.is_admin()
);

-- INSERT: Only admins
CREATE POLICY "profiles_insert_policy" ON public.profiles
FOR INSERT WITH CHECK (
    public.is_admin()
);

-- DELETE: Only admins
CREATE POLICY "profiles_delete_policy" ON public.profiles
FOR DELETE USING (
    public.is_admin()
);

-- =====================================
-- STEP 4: Verify the fix
-- =====================================

-- Test query (should not error)
-- SELECT * FROM public.profiles WHERE id = auth.uid();

-- List policies
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY policyname;

-- =============================================================
-- END OF MIGRATION 002
-- =============================================================
