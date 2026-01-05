-- =============================================================
-- MIGRATION 001: Schema Optimization & ENEM 2025 Preparation
-- Run this in Supabase SQL Editor
-- Date: 2025-01-04
-- =============================================================

-- =====================================
-- PART 1: FIX RLS POLICIES (Performance Warnings)
-- =====================================

-- Drop existing problematic policies on profiles
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;
DROP POLICY IF EXISTS "Service role has full access" ON public.profiles;

-- Create optimized consolidated policies
-- Using auth.uid() directly instead of current_setting()

-- Single SELECT policy with OR conditions (more efficient than multiple permissive policies)
CREATE POLICY "profiles_select_policy" ON public.profiles
FOR SELECT USING (
    auth.uid() = id  -- Users see own profile
    OR
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.is_admin = TRUE
    )  -- Admins see all
);

-- UPDATE policy: users update own, admins update all
CREATE POLICY "profiles_update_policy" ON public.profiles
FOR UPDATE USING (
    auth.uid() = id
    OR
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.is_admin = TRUE
    )
);

-- INSERT policy: only admins
CREATE POLICY "profiles_insert_policy" ON public.profiles
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.is_admin = TRUE
    )
);

-- DELETE policy: only admins
CREATE POLICY "profiles_delete_policy" ON public.profiles
FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.is_admin = TRUE
    )
);

-- =====================================
-- PART 2: FIX school_skills RLS
-- =====================================

DROP POLICY IF EXISTS "Public read access for school_skills" ON public.school_skills;
DROP POLICY IF EXISTS "Service role full access for school_skills" ON public.school_skills;

-- Consolidated school_skills policies
CREATE POLICY "school_skills_select" ON public.school_skills
FOR SELECT USING (true);  -- Public read (escola data is public)

CREATE POLICY "school_skills_admin_modify" ON public.school_skills
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.is_admin = TRUE
    )
);

-- =====================================
-- PART 3: NEW TABLE - enem_results (Multi-Year Support)
-- =====================================

-- Main table for yearly ENEM results per school
CREATE TABLE IF NOT EXISTS public.enem_results (
    id SERIAL PRIMARY KEY,
    codigo_inep VARCHAR(8) NOT NULL,
    ano INTEGER NOT NULL CHECK (ano >= 2018 AND ano <= 2030),

    -- School metadata (denormalized for performance)
    nome_escola VARCHAR(255),
    uf CHAR(2),
    municipio VARCHAR(100),
    dependencia VARCHAR(20),  -- Federal, Estadual, Municipal, Privada

    -- Aggregate scores
    media_cn DECIMAL(6,2),  -- Ciências da Natureza
    media_ch DECIMAL(6,2),  -- Ciências Humanas
    media_lc DECIMAL(6,2),  -- Linguagens e Códigos
    media_mt DECIMAL(6,2),  -- Matemática
    media_redacao DECIMAL(6,2),
    media_geral DECIMAL(6,2),

    -- Participation metrics
    num_participantes INTEGER,
    taxa_participacao DECIMAL(5,2),

    -- Ranking (calculated)
    ranking_nacional INTEGER,
    ranking_uf INTEGER,
    ranking_municipio INTEGER,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    UNIQUE(codigo_inep, ano)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_enem_results_inep ON public.enem_results(codigo_inep);
CREATE INDEX IF NOT EXISTS idx_enem_results_ano ON public.enem_results(ano);
CREATE INDEX IF NOT EXISTS idx_enem_results_inep_ano ON public.enem_results(codigo_inep, ano);
CREATE INDEX IF NOT EXISTS idx_enem_results_uf ON public.enem_results(uf);
CREATE INDEX IF NOT EXISTS idx_enem_results_ranking ON public.enem_results(ano, ranking_nacional);
CREATE INDEX IF NOT EXISTS idx_enem_results_media ON public.enem_results(ano, media_geral DESC);

-- RLS for enem_results
ALTER TABLE public.enem_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "enem_results_public_read" ON public.enem_results
FOR SELECT USING (true);

CREATE POLICY "enem_results_admin_modify" ON public.enem_results
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.is_admin = TRUE
    )
);

-- Grant permissions
GRANT SELECT ON public.enem_results TO anon, authenticated;
GRANT ALL ON public.enem_results TO service_role;
GRANT USAGE, SELECT ON SEQUENCE enem_results_id_seq TO anon, authenticated, service_role;

-- =====================================
-- PART 4: NEW TABLE - schools (Master Data)
-- =====================================

CREATE TABLE IF NOT EXISTS public.schools (
    codigo_inep VARCHAR(8) PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    uf CHAR(2) NOT NULL,
    municipio VARCHAR(100) NOT NULL,
    dependencia VARCHAR(20),
    localizacao VARCHAR(20),  -- Urbana, Rural
    porte VARCHAR(20),  -- Pequeno, Médio, Grande

    -- Contact (optional)
    endereco TEXT,
    cep VARCHAR(10),
    telefone VARCHAR(20),
    email VARCHAR(100),

    -- Flags
    is_active BOOLEAN DEFAULT TRUE,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_schools_uf ON public.schools(uf);
CREATE INDEX IF NOT EXISTS idx_schools_municipio ON public.schools(uf, municipio);
CREATE INDEX IF NOT EXISTS idx_schools_nome ON public.schools USING gin(to_tsvector('portuguese', nome));

ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "schools_public_read" ON public.schools
FOR SELECT USING (true);

CREATE POLICY "schools_admin_modify" ON public.schools
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.is_admin = TRUE
    )
);

GRANT SELECT ON public.schools TO anon, authenticated;
GRANT ALL ON public.schools TO service_role;

-- =====================================
-- PART 5: MATERIALIZED VIEWS (Dashboard Performance)
-- =====================================

-- Ranking nacional por ano (atualizar após carga de dados)
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_ranking_nacional AS
SELECT
    codigo_inep,
    nome_escola,
    uf,
    ano,
    media_geral,
    media_cn,
    media_ch,
    media_lc,
    media_mt,
    media_redacao,
    num_participantes,
    RANK() OVER (PARTITION BY ano ORDER BY media_geral DESC NULLS LAST) as ranking
FROM public.enem_results
WHERE media_geral IS NOT NULL
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_ranking_inep_ano ON public.mv_ranking_nacional(codigo_inep, ano);
CREATE INDEX IF NOT EXISTS idx_mv_ranking_ranking ON public.mv_ranking_nacional(ano, ranking);

-- Evolução por escola (histórico)
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_school_evolution AS
SELECT
    codigo_inep,
    nome_escola,
    array_agg(ano ORDER BY ano) as anos,
    array_agg(media_geral ORDER BY ano) as medias,
    MAX(media_geral) - MIN(media_geral) as variacao_total,
    AVG(media_geral) as media_historica
FROM public.enem_results
WHERE media_geral IS NOT NULL
GROUP BY codigo_inep, nome_escola
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_evolution_inep ON public.mv_school_evolution(codigo_inep);

-- Refresh function
CREATE OR REPLACE FUNCTION refresh_materialized_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_ranking_nacional;
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_school_evolution;
END;
$$ LANGUAGE plpgsql;

-- =====================================
-- PART 6: UPDATE TRIGGERS
-- =====================================

-- Generic updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to new tables
DROP TRIGGER IF EXISTS update_enem_results_updated_at ON public.enem_results;
CREATE TRIGGER update_enem_results_updated_at
    BEFORE UPDATE ON public.enem_results
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_schools_updated_at ON public.schools;
CREATE TRIGGER update_schools_updated_at
    BEFORE UPDATE ON public.schools
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================
-- PART 7: HELPER FUNCTIONS
-- =====================================

-- Calculate TRI score from theta
CREATE OR REPLACE FUNCTION calculate_tri_score(
    theta DECIMAL,
    mean DECIMAL DEFAULT 500,
    sd DECIMAL DEFAULT 100
) RETURNS DECIMAL AS $$
BEGIN
    RETURN ROUND(mean + (sd * theta), 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Get school ranking for a specific year
CREATE OR REPLACE FUNCTION get_school_ranking(
    p_codigo_inep VARCHAR(8),
    p_ano INTEGER DEFAULT 2024
) RETURNS TABLE (
    ranking_nacional INTEGER,
    ranking_uf INTEGER,
    total_escolas_nacional INTEGER,
    total_escolas_uf INTEGER,
    percentil DECIMAL
) AS $$
DECLARE
    v_uf CHAR(2);
    v_media DECIMAL;
BEGIN
    -- Get school's UF and media
    SELECT uf, media_geral INTO v_uf, v_media
    FROM public.enem_results
    WHERE codigo_inep = p_codigo_inep AND ano = p_ano;

    IF v_media IS NULL THEN
        RETURN;
    END IF;

    -- Calculate rankings
    RETURN QUERY
    WITH rankings AS (
        SELECT
            e.codigo_inep,
            RANK() OVER (ORDER BY e.media_geral DESC) as rn,
            RANK() OVER (PARTITION BY e.uf ORDER BY e.media_geral DESC) as ru,
            COUNT(*) OVER () as total_n,
            COUNT(*) OVER (PARTITION BY e.uf) as total_u
        FROM public.enem_results e
        WHERE e.ano = p_ano AND e.media_geral IS NOT NULL
    )
    SELECT
        r.rn::INTEGER,
        r.ru::INTEGER,
        r.total_n::INTEGER,
        r.total_u::INTEGER,
        ROUND((1 - (r.rn::DECIMAL / r.total_n)) * 100, 1)
    FROM rankings r
    WHERE r.codigo_inep = p_codigo_inep;
END;
$$ LANGUAGE plpgsql;

-- =====================================
-- PART 8: DATA VALIDATION
-- =====================================

-- Verify profiles
SELECT 'profiles' as table_name, COUNT(*) as count FROM public.profiles;

-- Verify school_skills
SELECT 'school_skills' as table_name, COUNT(*) as count FROM public.school_skills;

-- List all policies
SELECT schemaname, tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- =====================================
-- NOTES FOR ENEM 2025 DATA IMPORT
-- =====================================

/*
When ENEM 2025 data arrives (July 2025):

1. Import to enem_results table:
   INSERT INTO public.enem_results (codigo_inep, ano, nome_escola, uf, ...)
   SELECT ... FROM imported_data WHERE ano = 2025;

2. Update school_skills with 2025 data:
   INSERT INTO public.school_skills (codigo_inep, nome_escola, area, skill_num, performance, ano)
   SELECT ..., 2025 FROM imported_skills;

3. Refresh materialized views:
   SELECT refresh_materialized_views();

4. Verify data integrity:
   SELECT ano, COUNT(*) FROM public.enem_results GROUP BY ano ORDER BY ano;
   SELECT ano, COUNT(*) FROM public.school_skills GROUP BY ano ORDER BY ano;
*/

-- =============================================================
-- END OF MIGRATION 001
-- =============================================================
