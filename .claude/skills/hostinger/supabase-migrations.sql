-- =====================================================================
-- Production Supabase migrations needed for this repo's current features
-- Run in Supabase Studio → SQL Editor against the PROD project.
-- Safe to re-run (every statement is idempotent).
-- Generated from the local dev state on 2026-04-19.
-- =====================================================================


-- 1. profiles.is_active column --------------------------------------------
-- Powers the /api/admin/stats endpoint and the "is_active" flag used by
-- get_current_user dependency (blocks disabled users).
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

UPDATE public.profiles SET is_active = TRUE WHERE is_active IS NULL;


-- 2. enem_results extended columns ---------------------------------------
-- These columns land in the CSV exports but historically were not modeled
-- in the DB. The backend now SELECTs them directly.
ALTER TABLE public.enem_results
    ADD COLUMN IF NOT EXISTS nota_tri_media DECIMAL(7,2),
    ADD COLUMN IF NOT EXISTS desempenho_habilidades DECIMAL(5,4),
    ADD COLUMN IF NOT EXISTS competencia_redacao_media DECIMAL(8,2),
    ADD COLUMN IF NOT EXISTS inep_nome TEXT,
    ADD COLUMN IF NOT EXISTS localizacao VARCHAR(20),
    ADD COLUMN IF NOT EXISTS porte INTEGER,
    ADD COLUMN IF NOT EXISTS porte_label VARCHAR(64),
    ADD COLUMN IF NOT EXISTS anos_participacao INTEGER,
    ADD COLUMN IF NOT EXISTS ranking_uf INTEGER;


-- 3. anos_participacao backfill -------------------------------------------
-- Count distinct ENEM years each school has participated in.
WITH counts AS (
    SELECT codigo_inep, COUNT(DISTINCT ano) AS n_years
    FROM public.enem_results
    GROUP BY codigo_inep
)
UPDATE public.enem_results e
SET anos_participacao = c.n_years
FROM counts c
WHERE e.codigo_inep = c.codigo_inep
  AND (e.anos_participacao IS DISTINCT FROM c.n_years);


-- 4. ranking_uf backfill --------------------------------------------------
-- Per-(ano, uf) rank ordered by media_geral desc.
WITH ranked AS (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY ano, uf
               ORDER BY media_geral DESC NULLS LAST
           ) AS rk
    FROM public.enem_results
    WHERE uf IS NOT NULL
      AND media_geral IS NOT NULL
)
UPDATE public.enem_results e
SET ranking_uf = r.rk
FROM ranked r
WHERE e.id = r.id
  AND (e.ranking_uf IS DISTINCT FROM r.rk);


-- 5. school_skills table --------------------------------------------------
-- Skeleton table so the /api/schools/{id}/skills endpoint returns a clean
-- 404 instead of 500. Populate via scripts/import_school_skills_csv.py.
CREATE TABLE IF NOT EXISTS public.school_skills (
    id           SERIAL PRIMARY KEY,
    codigo_inep  VARCHAR(16) NOT NULL,
    area         VARCHAR(4)  NOT NULL,
    skill_num    INTEGER     NOT NULL,
    performance  DECIMAL(6,4),
    descricao    TEXT,
    ano          INTEGER     NOT NULL,
    UNIQUE (codigo_inep, area, skill_num, ano)
);
CREATE INDEX IF NOT EXISTS idx_school_skills_inep     ON public.school_skills(codigo_inep);
CREATE INDEX IF NOT EXISTS idx_school_skills_inep_ano ON public.school_skills(codigo_inep, ano);

GRANT SELECT ON public.school_skills TO anon, authenticated;
GRANT ALL    ON public.school_skills TO service_role;
GRANT USAGE, SELECT ON SEQUENCE school_skills_id_seq TO anon, authenticated, service_role;


-- 6. get_enem_stats RPC ---------------------------------------------------
-- Powers /api/stats → the dashboard totals, Médias Nacionais cards, and
-- the coverage / years-of-data indicators.
CREATE OR REPLACE FUNCTION public.get_enem_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
    result jsonb;
BEGIN
    SELECT jsonb_build_object(
        'total_records', (SELECT COUNT(*) FROM public.enem_results),
        'total_schools', (SELECT COUNT(DISTINCT codigo_inep) FROM public.enem_results),
        'years', (
            SELECT COALESCE(jsonb_agg(ano ORDER BY ano), '[]'::jsonb)
            FROM (SELECT DISTINCT ano FROM public.enem_results) a
        ),
        'states', (
            SELECT COALESCE(jsonb_agg(uf ORDER BY uf), '[]'::jsonb)
            FROM (SELECT DISTINCT uf FROM public.enem_results WHERE uf IS NOT NULL) s
        ),
        'avg_scores', jsonb_build_object(
            'nota_cn',      (SELECT ROUND(AVG(media_cn)::numeric, 2)      FROM public.enem_results WHERE media_cn      IS NOT NULL),
            'nota_ch',      (SELECT ROUND(AVG(media_ch)::numeric, 2)      FROM public.enem_results WHERE media_ch      IS NOT NULL),
            'nota_lc',      (SELECT ROUND(AVG(media_lc)::numeric, 2)      FROM public.enem_results WHERE media_lc      IS NOT NULL),
            'nota_mt',      (SELECT ROUND(AVG(media_mt)::numeric, 2)      FROM public.enem_results WHERE media_mt      IS NOT NULL),
            'nota_redacao', (SELECT ROUND(AVG(media_redacao)::numeric, 2) FROM public.enem_results WHERE media_redacao IS NOT NULL),
            'nota_media',   (SELECT ROUND(AVG(media_geral)::numeric, 2)   FROM public.enem_results WHERE media_geral   IS NOT NULL)
        ),
        'avg_scores_by_year', (
            SELECT COALESCE(jsonb_object_agg(ano::text, avg_media), '{}'::jsonb)
            FROM (
                SELECT ano, ROUND(AVG(media_geral)::numeric, 2) AS avg_media
                FROM public.enem_results WHERE media_geral IS NOT NULL
                GROUP BY ano ORDER BY ano
            ) s
        ),
        'latest_year', (SELECT MAX(ano) FROM public.enem_results)
    ) INTO result;
    RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_enem_stats() TO anon, authenticated, service_role;


-- 7. Reload PostgREST schema cache ---------------------------------------
-- Makes the new function + columns visible to the API immediately.
NOTIFY pgrst, 'reload schema';


-- =====================================================================
-- VERIFICATION
-- =====================================================================
-- Run this after the above to confirm everything is in place:
--
--   SELECT jsonb_pretty(public.get_enem_stats());
--   SELECT column_name FROM information_schema.columns
--    WHERE table_schema = 'public' AND table_name = 'enem_results'
--      AND column_name IN ('desempenho_habilidades', 'competencia_redacao_media',
--                          'anos_participacao', 'ranking_uf', 'nota_tri_media');
--   SELECT COUNT(*) FROM public.school_skills;
--
-- Expect: 5 columns listed, stats JSON populated, school_skills = 0.
