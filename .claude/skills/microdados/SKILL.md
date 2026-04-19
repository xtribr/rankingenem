---
name: microdados
description: INEP ENEM microdata ingestion playbook for this repo. Use whenever the user says "microdados", "microdata", "INEP release", "novo ano de dados", "ingestão 2025" (or any year), "ETL ENEM", "MICRODADOS_ENEM_*", "ITENS_PROVA", or when a new microdata CSV appears under microdados-*/. Explains the file format, verified aggregation math, the jump from per-student (~4.3M rows) to per-school (~23k rows), how desempenho_habilidades is computed, and the exact DuckDB queries to run.
---

# INEP ENEM microdados → app schema

The `enem_results` table in production is **per-school, per-year** (~120k rows). INEP publishes **per-student, per-year** microdata (~4.3M rows per year). This skill documents the exact, verified transformation from one to the other.

The file `enem_2018_2024_completo.csv` in this repo was built by concatenating and aggregating INEP microdados for years 2018-2024. The SAS / Observatório ENEM PowerBI scraper (in `extract_enem_data.py`, `enem_extractor_completo.py`) is **deprecated** — no longer used from 2025 onward.

## Data location convention

```
<repo>/microdados-YYYY/
    MICRODADOS_ENEM_YYYY.csv      ← REQUIRED: student-level raw (~1.6 GB)
    ITENS_PROVA_YYYY.csv          ← REQUIRED for habilidades (ships in INEP zip)
    DICIONARIO_YYYY.xlsx          ← optional reference
    LEIA-ME.pdf                   ← optional reference
```

Drop the full extracted INEP zip into `microdados-YYYY/` — don't just keep the main CSV.

## Verified file format (2024)

| Attribute | Value |
|---|---|
| Filename | `MICRODADOS_ENEM_2024.csv` |
| Size | 1,683,449,589 bytes (~1.6 GB) |
| Rows | **4,332,944** students |
| Columns | **42** |
| Encoding | `ISO-8859-1` (latin-1) — **NOT** UTF-8 |
| Delimiter | `;` (semicolon) |
| Decimal | `.` (dot) |

### Columns worth knowing

| Column | Meaning | Notes |
|---|---|---|
| `NU_SEQUENCIAL` | Opaque student identifier | Not stable across years |
| `NU_ANO` | Year | e.g. `2024` |
| `CO_ESCOLA` | INEP school code | **`NULL` for treineiros** (2.77M of 4.33M rows in 2024) |
| `CO_MUNICIPIO_ESC` / `NO_MUNICIPIO_ESC` | School municipality | Also NULL for treineiros |
| `SG_UF_ESC` / `CO_UF_ESC` | State | Char(2) / int |
| `TP_DEPENDENCIA_ADM_ESC` | School network | **1=Federal, 2=Estadual, 3=Municipal, 4=Privada** |
| `TP_LOCALIZACAO_ESC` | Setting | **1=Urbana, 2=Rural** |
| `TP_SIT_FUNC_ESC` | Operational status | 1=Em atividade, 2=Paralisada, 3=Extinta, 4=Início de funcionamento |
| `CO_MUNICIPIO_PROVA` / `SG_UF_PROVA` | Exam location | Populated for every student |
| `TP_PRESENCA_CN/CH/LC/MT` | Presence flag | **0=Faltou, 1=Presente, 2=Eliminado** |
| `CO_PROVA_CN/CH/LC/MT` | Test version code | e.g. 1420 — keys `ITENS_PROVA` |
| `NU_NOTA_CN/CH/LC/MT` | **Already TRI scale** (~0-1000) | Use as-is, no TRI estimation needed |
| `TX_RESPOSTAS_*` | Student's answer sheet | 45 chars, `.` or `*` = canceled item |
| `TX_GABARITO_*` | Answer key | 45 chars for CN/CH/MT, **50 chars for LC** (45 common + 5 language) |
| `TP_LINGUA` | LC language pick | **0=Espanhol, 1=Inglês** — determines which 5 LC items to score |
| `TP_STATUS_REDACAO` | Essay status | 1=Sem problemas, 2=Anulada, 3=Cópia, 4=Em branco, 6=Fuga, 7=Não atendimento, 8=Texto insuficiente, 9=Parte desconectada |
| `NU_NOTA_COMP1-5` | Redação competências 1-5 | Each 0-200 |
| `NU_NOTA_REDACAO` | Total essay score | 0-1000 (sum of COMP1-5) |

## Verified aggregation math

Aggregates from microdata were confirmed to match production's pre-aggregated `enem_results` table **exactly** for FARIAS BRITO (codigo_inep `23246847`, 2024):

| Metric | Microdata query | DB value |
|---|---|---|
| `num_participantes` | `COUNT(*) WHERE CO_ESCOLA=? AND TP_PRESENCA_CN=1` | 30 ✅ |
| `media_cn` | `AVG(NU_NOTA_CN)` | 724.53 ✅ |
| `media_ch` | `AVG(NU_NOTA_CH)` | 736.56 ✅ |
| `media_lc` | `AVG(NU_NOTA_LC)` | 671.02 ✅ |
| `media_mt` | `AVG(NU_NOTA_MT)` | 889.52 ✅ |
| `media_redacao` | `AVG(NU_NOTA_REDACAO)` | 928.00 ✅ |

### Ranking threshold

To reach production's 22,720 ranked schools (2024), filter:

```sql
WHERE CO_ESCOLA IS NOT NULL
  AND TP_PRESENCA_CN = 1
  AND TP_PRESENCA_CH = 1
  AND TP_PRESENCA_LC = 1
  AND TP_PRESENCA_MT = 1
GROUP BY CO_ESCOLA
HAVING COUNT(*) >= 10     -- standard INEP cutoff for "ranked"
```

Participant buckets in 2024: 28,901 schools have ≥1 present student. 23,023 have ≥10. 19,852 have ≥15. 17,069 have ≥20. 12,817 have ≥30.

### Ranking formulas

```sql
ranking_nacional   = ROW_NUMBER() OVER (PARTITION BY ano ORDER BY media_geral DESC NULLS LAST)
ranking_uf         = ROW_NUMBER() OVER (PARTITION BY ano, uf ORDER BY media_geral DESC NULLS LAST)
ranking_municipio  = ROW_NUMBER() OVER (PARTITION BY ano, codigo_municipio ORDER BY media_geral DESC NULLS LAST)
media_geral        = (NU_NOTA_CN + NU_NOTA_CH + NU_NOTA_LC + NU_NOTA_MT + NU_NOTA_REDACAO) / 5  -- per student, then AVG
```

### String-code transforms

```sql
tipo_escola = CASE TP_DEPENDENCIA_ADM_ESC
                WHEN 4 THEN 'Privada'
                WHEN 1 THEN 'Pública'  -- Federal
                WHEN 2 THEN 'Pública'  -- Estadual
                WHEN 3 THEN 'Pública'  -- Municipal
              END

localizacao = CASE TP_LOCALIZACAO_ESC WHEN 1 THEN 'Urbana' WHEN 2 THEN 'Rural' END
```

## `desempenho_habilidades` requires ITENS_PROVA

**Without ITENS_PROVA we cannot reproduce the DB value exactly.** Naive "% correct across CN+CH+MT ignoring LC" gave 0.862 for FARIAS BRITO; the DB value is 0.875 (delta ~1.5%). The gap comes from:

1. **LC language slicing**: TX_GABARITO_LC has 50 chars (45 common + 5 language). For TP_LINGUA=0 (Espanhol) the correct 5 are positions 1-5, for TP_LINGUA=1 (Inglês) the correct 5 are positions 46-50. TX_RESPOSTAS_LC is always 45 chars.
2. **Canceled items**: any question where gabarito char is `X` or `*` must be dropped from the denominator.
3. **Habilidade weighting**: the final metric is often computed per-habilidade, then averaged, not raw per-item.

**The authoritative mapping is in `ITENS_PROVA_YYYY.csv`** (ships in INEP's microdados ZIP, inside `DADOS/`). Its columns:

```
CO_POSICAO, CO_PROVA, CO_HABILIDADE, TX_GABARITO, SG_AREA, TP_LINGUA,
NU_PARAM_A, NU_PARAM_B, NU_PARAM_C  -- TRI item parameters
```

Join on `CO_PROVA + CO_POSICAO` for each student/area to get the habilidade code per item.

### Correct algorithm (per student, per area)

```python
for area in ['CN', 'CH', 'LC', 'MT']:
    resp = row[f'TX_RESPOSTAS_{area}']
    gab  = row[f'TX_GABARITO_{area}']
    prova = row[f'CO_PROVA_{area}']
    # LC: slice to the right language half
    if area == 'LC':
        if row['TP_LINGUA'] == 0: gab = gab[:5] + gab[5:50][5:50]  # see real impl
        # ... see ITENS_PROVA for per-item language flag
    for pos in range(len(resp)):
        item_habilidade = itens_prova.lookup(prova, pos+1).CO_HABILIDADE
        correct = resp[pos] == gab[pos] and gab[pos] not in '.*X'
        # accumulate per habilidade
```

## Canonical ETL (what to run when 2025 arrives)

A one-shot DuckDB-based script. Target: `scripts/ingest_microdados.py` (not yet written — scaffold when asked).

```python
import duckdb
YEAR = 2025
CSV  = f"microdados-{YEAR}/MICRODADOS_ENEM_{YEAR}.csv"
ITEMS = f"microdados-{YEAR}/ITENS_PROVA_{YEAR}.csv"
OUT  = f"enem-analytics/backend/data/enem_{YEAR}_escolas.parquet"

duckdb.sql(f"""
COPY (
  WITH valid AS (
    SELECT *,
           (NU_NOTA_CN + NU_NOTA_CH + NU_NOTA_LC + NU_NOTA_MT + NU_NOTA_REDACAO)/5.0 AS nota_aluno
    FROM read_csv_auto('{CSV}', delim=';', encoding='latin-1', sample_size=10000)
    WHERE CO_ESCOLA IS NOT NULL
      AND TP_PRESENCA_CN=1 AND TP_PRESENCA_CH=1
      AND TP_PRESENCA_LC=1 AND TP_PRESENCA_MT=1
  ),
  school AS (
    SELECT
      CO_ESCOLA                                   AS codigo_inep,
      NU_ANO                                       AS ano,
      ANY_VALUE(SG_UF_ESC)                         AS uf,
      ANY_VALUE(NO_MUNICIPIO_ESC)                  AS municipio,
      CASE ANY_VALUE(TP_DEPENDENCIA_ADM_ESC)
          WHEN 4 THEN 'Privada' ELSE 'Pública' END AS tipo_escola,
      CASE ANY_VALUE(TP_LOCALIZACAO_ESC)
          WHEN 1 THEN 'Urbana'  WHEN 2 THEN 'Rural'  END AS localizacao,
      COUNT(*)                                     AS num_participantes,
      ROUND(AVG(NU_NOTA_CN), 2)                    AS media_cn,
      ROUND(AVG(NU_NOTA_CH), 2)                    AS media_ch,
      ROUND(AVG(NU_NOTA_LC), 2)                    AS media_lc,
      ROUND(AVG(NU_NOTA_MT), 2)                    AS media_mt,
      ROUND(AVG(NU_NOTA_REDACAO), 2)               AS media_redacao,
      ROUND(AVG(nota_aluno), 2)                    AS media_geral
    FROM valid
    GROUP BY CO_ESCOLA, NU_ANO
    HAVING num_participantes >= 10
  )
  SELECT
    *,
    ROW_NUMBER() OVER (ORDER BY media_geral DESC)                   AS ranking_nacional,
    ROW_NUMBER() OVER (PARTITION BY uf ORDER BY media_geral DESC)   AS ranking_uf
  FROM school
) TO '{OUT}' (FORMAT PARQUET);
""")
```

Then upsert to Supabase via existing `scripts/import_enem_year.py`. That script was hardened in this repo — it tracks failed records, raises if ≥10% of batches fail, and has a proper Supabase upsert loop.

### Habilidades pipeline (second pass)

Separate script once we have `ITENS_PROVA_2025.csv`:

1. Join each student row to `ITENS_PROVA_YYYY` on `CO_PROVA` + position index.
2. Compute per-student per-item correctness (handling TP_LINGUA for LC and skipping `X`/`*`).
3. Aggregate to `{codigo_inep, area, skill_num, performance}`.
4. Upsert into `public.school_skills` (production already has this table with 305k rows for 2024).

## Size / performance notes

- **Do NOT load the full CSV into pandas memory**. 4.3M rows × 42 cols = ~6-8 GB RAM.
- **Use DuckDB**. `read_csv_auto` with `sample_size=10000` streams the file; aggregation queries finish in ~30-60 s on a laptop.
- **Don't write 4.3M rows to Supabase**. Aggregate first → ~23k rows → batch upsert.
- **Treineiros (school-less students)**: 2.77M of 4.33M rows in 2024. Exclude via `WHERE CO_ESCOLA IS NOT NULL` as the first filter.
- **Cross-year CO_PROVA**: each year has new prova codes. Habilidades join is per-year, not shared.

## Checklist: when May arrives

1. **Extract full INEP zip** to `microdados-2025/` (not just the main CSV — also need `ITENS_PROVA_2025.csv`).
2. **Verify file integrity**: `wc -l microdados-2025/MICRODADOS_ENEM_2025.csv` — expect 4-5M rows. Header has 42 columns.
3. **Run scaffolded ETL** (see Canonical ETL above). Outputs `enem-analytics/backend/data/enem_2025_escolas.parquet` — or directly appends to `enem_2018_2024_completo.csv` producing `enem_2018_2025_completo.csv`.
4. **Upload to Supabase** via `scripts/import_enem_year.py --year 2025`.
5. **Recompute `anos_participacao` / `ranking_uf`** via the same SQL from `.claude/skills/hostinger/supabase-migrations.sql` but re-run (idempotent).
6. **Retrain prediction models**: `scripts/retrain_prediction_models.py` — gets `model_version`, `trained_at`, `bias` populated.
7. **Commit data files** (or use Supabase Storage for large artifacts; pre-aggregated file is ~25 MB, fits in git).
8. **Push → Coolify auto-deploys**. The frontend's `year_resolver.py` + `get_enem_stats()` RPC already discover the new year — no code change needed on read paths.

## Gotchas to watch for

- **Encoding**: latin-1, not UTF-8. `pd.read_csv(..., encoding='latin-1')` or DuckDB `encoding='latin-1'`. Missing this produces mojibake in `NO_MUNICIPIO_ESC` (e.g. `São Paulo` → `SÃ£o Paulo`).
- **Delimiter**: `;`, not `,`. Brazilian CSV convention.
- **Decimal separator in numerics**: `.` in this file (INEP is English-format), even though most Brazilian CSVs use `,`. Verify with a sample before trusting.
- **INEP column naming drifts**: 2018-2020 sometimes used different column names. Pin the expected schema per year. If a 2025 schema change breaks the ETL, update the mapping.
- **Essay status 2, 3, 4, 6-9**: `NU_NOTA_REDACAO=0` for these — include them in `AVG` if you want "fail = 0" behavior, exclude for "pool of valid essays only". Historically the app has been including them.
- **Ranking ties**: multiple schools can share the same media_geral. `ROW_NUMBER()` produces deterministic but arbitrary order. Use `RANK()` if ties must be preserved.
- **`CO_ESCOLA` as string vs int**: microdata gives it as integer; production table stores `VARCHAR(16)`. Cast to string in the ETL: `CAST(CO_ESCOLA AS VARCHAR)`.

## Minimal inspection one-liner

```bash
.venv/bin/python -c "
import duckdb
print(duckdb.sql('''
  SELECT COUNT(*) students, COUNT(DISTINCT CO_ESCOLA) schools,
         MIN(NU_NOTA_MT) min_mt, MAX(NU_NOTA_MT) max_mt
  FROM read_csv_auto('microdados-YYYY/MICRODADOS_ENEM_YYYY.csv',
                     delim=';', encoding='latin-1', sample_size=1000)
''').fetchone())
"
```

Expected output for 2024 (reference point):
```
(4332944, 29400, 0.0, 961.9)
```

## When invoked

When the user says "/microdados" or asks anything about microdata ingestion:

1. Check if a new `microdados-YYYY/` folder exists.
2. If the main CSV is there but `ITENS_PROVA_YYYY.csv` is missing, tell the user to extract the full zip — habilidades needs it.
3. Run the inspection one-liner to sanity-check row count and scale.
4. Scaffold `scripts/ingest_microdados.py` if not already present.
5. Do NOT re-derive aggregation formulas from scratch — they are verified here.
6. Do NOT load the CSV with pandas. Always DuckDB.
7. Before bulk upserting, validate with FARIAS BRITO (`CO_ESCOLA=23246847`) or another known school whose aggregates already exist in `enem_results` — the new year's data should match the old code's behavior except for the new year.
