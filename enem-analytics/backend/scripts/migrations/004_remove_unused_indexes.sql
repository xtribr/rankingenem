-- =============================================================
-- MIGRATION 004: Remove Unused Indexes
-- Cleans up indexes that have never been used
-- Date: 2026-01-05
-- =============================================================

-- These indexes were flagged by Supabase Performance Advisor as never used.
-- Removing them saves storage space and reduces write overhead.

-- =====================================
-- PART 1: Drop unused indexes on schools table
-- =====================================

DROP INDEX IF EXISTS idx_schools_uf;
DROP INDEX IF EXISTS idx_schools_municipio;

-- =====================================
-- PART 2: Drop unused indexes on school_skills table
-- =====================================

DROP INDEX IF EXISTS idx_school_skills_inep_area;

-- =====================================
-- PART 3: Drop unused indexes on enem_results table
-- =====================================

DROP INDEX IF EXISTS idx_enem_results_inep;
DROP INDEX IF EXISTS idx_enem_results_ano;
DROP INDEX IF EXISTS idx_enem_results_inep_ano;
DROP INDEX IF EXISTS idx_enem_results_uf;
DROP INDEX IF EXISTS idx_enem_results_ranking;

-- =====================================
-- PART 4: Verify indexes were removed
-- =====================================

SELECT
    schemaname,
    tablename,
    indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('schools', 'school_skills', 'enem_results')
ORDER BY tablename, indexname;

-- =============================================================
-- END OF MIGRATION 004
-- =============================================================
