-- Importacao atomica de resultados ENEM por ano.
-- Rode esta migration antes de usar `scripts/update_enem_year.py --apply`.

ALTER TABLE public.enem_results
    ADD COLUMN IF NOT EXISTS localizacao VARCHAR(20),
    ADD COLUMN IF NOT EXISTS porte INTEGER,
    ADD COLUMN IF NOT EXISTS porte_label TEXT,
    ADD COLUMN IF NOT EXISTS nota_tri_media DECIMAL(6,2),
    ADD COLUMN IF NOT EXISTS desempenho_habilidades DECIMAL(6,2),
    ADD COLUMN IF NOT EXISTS competencia_redacao_media DECIMAL(6,2),
    ADD COLUMN IF NOT EXISTS inep_nome TEXT,
    ADD COLUMN IF NOT EXISTS anos_participacao INTEGER;

CREATE TABLE IF NOT EXISTS public.enem_results_import_staging (
    import_job_id UUID NOT NULL,
    row_number INTEGER NOT NULL,
    codigo_inep VARCHAR(8) NOT NULL,
    ano INTEGER NOT NULL CHECK (ano >= 2018 AND ano <= 2030),
    nome_escola VARCHAR(255),
    uf CHAR(2),
    municipio VARCHAR(100),
    dependencia VARCHAR(20),
    media_cn DECIMAL(6,2),
    media_ch DECIMAL(6,2),
    media_lc DECIMAL(6,2),
    media_mt DECIMAL(6,2),
    media_redacao DECIMAL(6,2),
    media_geral DECIMAL(6,2),
    num_participantes INTEGER,
    taxa_participacao DECIMAL(5,2),
    ranking_nacional INTEGER,
    ranking_uf INTEGER,
    ranking_municipio INTEGER,
    localizacao VARCHAR(20),
    porte INTEGER,
    porte_label TEXT,
    nota_tri_media DECIMAL(6,2),
    desempenho_habilidades DECIMAL(6,2),
    competencia_redacao_media DECIMAL(6,2),
    inep_nome TEXT,
    anos_participacao INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (import_job_id, codigo_inep, ano)
);

CREATE INDEX IF NOT EXISTS idx_enem_results_import_staging_job
    ON public.enem_results_import_staging(import_job_id);

ALTER TABLE public.enem_results_import_staging ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.enem_results_import_staging FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.enem_results_import_staging TO service_role;

CREATE OR REPLACE FUNCTION public.promote_enem_year_import(
    p_import_job_id UUID,
    p_year INTEGER,
    p_expected_count INTEGER,
    p_allow_existing_year BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_staging_count INTEGER;
    v_duplicate_count INTEGER;
    v_existing_count INTEGER;
    v_inserted_count INTEGER;
BEGIN
    IF p_year < 2018 OR p_year > 2030 THEN
        RAISE EXCEPTION 'Ano fora do range permitido: %', p_year;
    END IF;

    IF p_expected_count < 1 THEN
        RAISE EXCEPTION 'p_expected_count deve ser maior que zero';
    END IF;

    SELECT COUNT(*)
      INTO v_staging_count
      FROM public.enem_results_import_staging
     WHERE import_job_id = p_import_job_id
       AND ano = p_year;

    IF v_staging_count <> p_expected_count THEN
        RAISE EXCEPTION 'Staging incompleto: esperado %, encontrado %',
            p_expected_count, v_staging_count;
    END IF;

    SELECT COUNT(*) - COUNT(DISTINCT codigo_inep)
      INTO v_duplicate_count
      FROM public.enem_results_import_staging
     WHERE import_job_id = p_import_job_id
       AND ano = p_year;

    IF v_duplicate_count > 0 THEN
        RAISE EXCEPTION 'Staging contem % codigo_inep duplicado(s)', v_duplicate_count;
    END IF;

    SELECT COUNT(*)
      INTO v_existing_count
      FROM public.enem_results
     WHERE ano = p_year;

    IF v_existing_count > 0 AND NOT p_allow_existing_year THEN
        RAISE EXCEPTION 'Ja existem % registros em enem_results para %',
            v_existing_count, p_year;
    END IF;

    IF p_allow_existing_year THEN
        DELETE FROM public.enem_results WHERE ano = p_year;
    END IF;

    INSERT INTO public.enem_results (
        codigo_inep,
        ano,
        nome_escola,
        uf,
        municipio,
        dependencia,
        media_cn,
        media_ch,
        media_lc,
        media_mt,
        media_redacao,
        media_geral,
        num_participantes,
        taxa_participacao,
        ranking_nacional,
        ranking_uf,
        ranking_municipio,
        localizacao,
        porte,
        porte_label,
        nota_tri_media,
        desempenho_habilidades,
        competencia_redacao_media,
        inep_nome,
        anos_participacao
    )
    SELECT
        codigo_inep,
        ano,
        nome_escola,
        uf,
        municipio,
        dependencia,
        media_cn,
        media_ch,
        media_lc,
        media_mt,
        media_redacao,
        media_geral,
        num_participantes,
        taxa_participacao,
        ranking_nacional,
        ranking_uf,
        ranking_municipio,
        localizacao,
        porte,
        porte_label,
        nota_tri_media,
        desempenho_habilidades,
        competencia_redacao_media,
        inep_nome,
        anos_participacao
      FROM public.enem_results_import_staging
     WHERE import_job_id = p_import_job_id
       AND ano = p_year
     ORDER BY ranking_nacional NULLS LAST, codigo_inep;

    GET DIAGNOSTICS v_inserted_count = ROW_COUNT;

    IF v_inserted_count <> p_expected_count THEN
        RAISE EXCEPTION 'Insercao incompleta: esperado %, inserido %',
            p_expected_count, v_inserted_count;
    END IF;

    DELETE FROM public.enem_results_import_staging
     WHERE import_job_id = p_import_job_id;

    IF to_regprocedure('public.refresh_materialized_views()') IS NOT NULL THEN
        PERFORM public.refresh_materialized_views();
    END IF;

    RETURN jsonb_build_object(
        'status', 'ok',
        'year', p_year,
        'inserted', v_inserted_count,
        'replaced_existing', p_allow_existing_year,
        'previous_count', v_existing_count
    );
END;
$$;

REVOKE ALL ON FUNCTION public.promote_enem_year_import(UUID, INTEGER, INTEGER, BOOLEAN)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.promote_enem_year_import(UUID, INTEGER, INTEGER, BOOLEAN)
    TO service_role;
