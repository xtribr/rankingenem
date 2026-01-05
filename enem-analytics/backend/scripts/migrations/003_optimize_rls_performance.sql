-- =============================================================
-- MIGRATION 003: Optimize RLS Performance
-- Fixes all Performance Advisor warnings
-- Date: 2025-01-04
-- =============================================================

-- =====================================
-- PART 1: Optimize is_admin() function
-- Use (select auth.uid()) instead of auth.uid()
-- =====================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (select auth.uid()) AND is_admin = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =====================================
-- PART 2: Fix profiles table policies
-- Remove duplicate "Service role full access" policy
-- Optimize auth.uid() calls
-- =====================================

-- Drop all existing policies
DROP POLICY IF EXISTS "Service role full access" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_policy" ON public.profiles;

-- Recreate optimized policies with (select auth.uid())
CREATE POLICY "profiles_select_policy" ON public.profiles
FOR SELECT USING (
    (select auth.uid()) = id
    OR
    public.is_admin()
);

CREATE POLICY "profiles_update_policy" ON public.profiles
FOR UPDATE USING (
    (select auth.uid()) = id
    OR
    public.is_admin()
);

CREATE POLICY "profiles_insert_policy" ON public.profiles
FOR INSERT WITH CHECK (
    public.is_admin()
);

CREATE POLICY "profiles_delete_policy" ON public.profiles
FOR DELETE USING (
    public.is_admin()
);

-- =====================================
-- PART 3: Fix school_skills table policies
-- Split admin_modify into separate actions (no SELECT overlap)
-- =====================================

DROP POLICY IF EXISTS "school_skills_select" ON public.school_skills;
DROP POLICY IF EXISTS "school_skills_admin_modify" ON public.school_skills;
DROP POLICY IF EXISTS "Public read access for school_skills" ON public.school_skills;
DROP POLICY IF EXISTS "Service role full access for school_skills" ON public.school_skills;

-- Public read (no admin check needed for SELECT)
CREATE POLICY "school_skills_select" ON public.school_skills
FOR SELECT USING (true);

-- Admin can INSERT (separate from SELECT)
CREATE POLICY "school_skills_insert" ON public.school_skills
FOR INSERT WITH CHECK (
    public.is_admin()
);

-- Admin can UPDATE
CREATE POLICY "school_skills_update" ON public.school_skills
FOR UPDATE USING (
    public.is_admin()
);

-- Admin can DELETE
CREATE POLICY "school_skills_delete" ON public.school_skills
FOR DELETE USING (
    public.is_admin()
);

-- =====================================
-- PART 4: Fix enem_results table policies
-- Split admin_modify into separate actions (no SELECT overlap)
-- =====================================

DROP POLICY IF EXISTS "enem_results_public_read" ON public.enem_results;
DROP POLICY IF EXISTS "enem_results_admin_modify" ON public.enem_results;

-- Public read
CREATE POLICY "enem_results_select" ON public.enem_results
FOR SELECT USING (true);

-- Admin can INSERT
CREATE POLICY "enem_results_insert" ON public.enem_results
FOR INSERT WITH CHECK (
    public.is_admin()
);

-- Admin can UPDATE
CREATE POLICY "enem_results_update" ON public.enem_results
FOR UPDATE USING (
    public.is_admin()
);

-- Admin can DELETE
CREATE POLICY "enem_results_delete" ON public.enem_results
FOR DELETE USING (
    public.is_admin()
);

-- =====================================
-- PART 5: Fix schools table policies
-- Split admin_modify into separate actions (no SELECT overlap)
-- =====================================

DROP POLICY IF EXISTS "schools_public_read" ON public.schools;
DROP POLICY IF EXISTS "schools_admin_modify" ON public.schools;

-- Public read
CREATE POLICY "schools_select" ON public.schools
FOR SELECT USING (true);

-- Admin can INSERT
CREATE POLICY "schools_insert" ON public.schools
FOR INSERT WITH CHECK (
    public.is_admin()
);

-- Admin can UPDATE
CREATE POLICY "schools_update" ON public.schools
FOR UPDATE USING (
    public.is_admin()
);

-- Admin can DELETE
CREATE POLICY "schools_delete" ON public.schools
FOR DELETE USING (
    public.is_admin()
);

-- =====================================
-- PART 6: Verify policies
-- =====================================

SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'school_skills', 'enem_results', 'schools')
ORDER BY tablename, cmd, policyname;

-- =============================================================
-- END OF MIGRATION 003
-- =============================================================
