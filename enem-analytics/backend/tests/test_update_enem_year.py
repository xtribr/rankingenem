import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest.mock import patch

import pandas as pd

from scripts.update_enem_year import (
    SCORE_COLUMNS,
    build_validation_report,
    coalesce_mapped_columns,
    enrich_with_censo,
    load_csv_flexible,
    load_environment,
    parse_args,
    parse_integer,
    prepare_staging_dataframe,
    main,
    to_consolidated_schema,
    transform_to_enem_results,
    validate_batch_size,
    validate_year,
)


DATA_FILE = Path(__file__).resolve().parents[1] / "data" / "enem_2018_2024_completo.csv"
CENSO_FILE = Path(__file__).resolve().parents[1] / "data" / "censo_escolas_2024.csv"


def real_2024_sample(rows: int = 5) -> pd.DataFrame:
    """Usa linhas reais da base 2024; nao cria dados educacionais ficticios."""
    columns = [
        "ano",
        "codigo_inep",
        "nome_escola",
        "inep_nome",
        "nota_tri_media",
        "ranking_brasil",
        "nota_cn",
        "nota_ch",
        "nota_lc",
        "nota_mt",
        "nota_redacao",
        "nota_media",
        "tipo_escola",
        "desempenho_habilidades",
        "competencia_redacao_media",
        "localizacao",
        "qt_matriculas",
        "porte",
        "porte_label",
    ]
    df = pd.read_csv(DATA_FILE, dtype={"codigo_inep": str}, usecols=columns)
    score_cols = ["nota_cn", "nota_ch", "nota_lc", "nota_mt", "nota_redacao", "nota_media"]
    df = df[(df["ano"] == 2024) & df[score_cols].notna().all(axis=1)]
    return df.head(rows).copy()


def real_uf_for_codes(codigo_inep: pd.Series) -> pd.Series:
    """Busca UF real no Censo 2024 para montar formato oficial derivado."""
    censo = pd.read_csv(CENSO_FILE, dtype={"codigo_inep": str}, usecols=["codigo_inep", "uf"])
    uf_by_code = censo.drop_duplicates("codigo_inep").set_index("codigo_inep")["uf"]
    return codigo_inep.map(uf_by_code)


class UpdateEnemYearTest(unittest.TestCase):
    def test_transforms_xtri_consolidated_rows_from_real_2024_source(self):
        raw = real_2024_sample()

        transformed, detection = transform_to_enem_results(raw, 2025)

        self.assertEqual(detection.name, "xtri_consolidado")
        self.assertEqual(len(transformed), len(raw))
        self.assertTrue(set(SCORE_COLUMNS).issubset(transformed.columns))
        computed = transformed[SCORE_COLUMNS].mean(axis=1).round(2)
        pd.testing.assert_series_equal(
            transformed["media_geral"].reset_index(drop=True).round(2),
            computed.reset_index(drop=True),
            check_names=False,
        )
        self.assertEqual(transformed["ano"].unique().tolist(), [2025])
        self.assertEqual(int(transformed["ranking_nacional"].notna().sum()), len(raw))

    def test_transforms_official_format_derived_from_real_2024_source(self):
        raw = real_2024_sample()
        official = pd.DataFrame(
            {
                "CO_ENTIDADE": raw["codigo_inep"],
                "NO_ENTIDADE": raw["nome_escola"],
                "SG_UF": real_uf_for_codes(raw["codigo_inep"]),
                "TP_DEPENDENCIA_ADM": raw["tipo_escola"].map({"Privada": 4, "Pública": 2}),
                "NU_MEDIA_CN": raw["nota_cn"],
                "NU_MEDIA_CH": raw["nota_ch"],
                "NU_MEDIA_LC": raw["nota_lc"],
                "NU_MEDIA_MT": raw["nota_mt"],
                "NU_MEDIA_RED": raw["nota_redacao"],
                "NU_PARTICIPANTES": raw["qt_matriculas"],
            }
        )

        transformed, detection = transform_to_enem_results(official, 2025)

        self.assertEqual(detection.name, "inep_oficial")
        self.assertEqual(set(transformed["dependencia"].dropna().unique()), {"Privada", "Pública"})
        computed = transformed[SCORE_COLUMNS].mean(axis=1).round(2)
        pd.testing.assert_series_equal(
            transformed["media_geral"].reset_index(drop=True).round(2),
            computed.reset_index(drop=True),
            check_names=False,
        )

    def test_coalesces_duplicate_source_aliases_without_duplicate_columns(self):
        raw = real_2024_sample(3)
        # Teste estrutural: usa os mesmos valores reais em dois aliases de entrada.
        source = pd.DataFrame(
            {
                "codigo_inep": raw["codigo_inep"],
                "tipo_escola": raw["tipo_escola"],
                "dependencia": pd.NA,
            }
        )

        mapped = coalesce_mapped_columns(
            source,
            {
                "codigo_inep": "codigo_inep",
                "tipo_escola": "dependencia",
                "dependencia": "dependencia",
            },
        )

        self.assertEqual(list(mapped.columns), ["codigo_inep", "dependencia"])
        self.assertEqual(mapped["dependencia"].tolist(), raw["tipo_escola"].tolist())

    def test_validation_blocks_duplicate_school_year(self):
        raw = real_2024_sample(1)
        duplicated = pd.concat([raw, raw], ignore_index=True)
        transformed, detection = transform_to_enem_results(duplicated, 2025)
        loaded = type(
            "Loaded",
            (),
            {
                "source_member": None,
                "sha256": "real-2024-derived",
                "byte_size": 0,
                "encoding": "memory",
                "separator": "memory",
            },
        )()

        report = build_validation_report(
            input_path=DATA_FILE,
            loaded=loaded,
            detection=detection,
            raw_df=duplicated,
            transformed=transformed,
            year=2025,
        )

        self.assertEqual(report["status"], "blocked")
        self.assertTrue(any("Duplicidades" in error for error in report["errors"]))

    def test_validation_blocks_when_score_columns_are_missing(self):
        raw = real_2024_sample()
        malformed = raw.drop(columns=["nota_cn", "nota_ch", "nota_lc", "nota_mt", "nota_redacao"])
        transformed, detection = transform_to_enem_results(malformed, 2025)
        loaded = type(
            "Loaded",
            (),
            {
                "source_member": None,
                "sha256": "real-2024-derived",
                "byte_size": 0,
                "encoding": "memory",
                "separator": "memory",
            },
        )()

        report = build_validation_report(
            input_path=DATA_FILE,
            loaded=loaded,
            detection=detection,
            raw_df=malformed,
            transformed=transformed,
            year=2025,
        )

        self.assertEqual(report["status"], "blocked")
        self.assertTrue(any("Coluna de nota sem valores reais" in error for error in report["errors"]))

    def test_censo_enrichment_fills_real_uf_for_consolidated_rows(self):
        raw = real_2024_sample()
        transformed, _ = transform_to_enem_results(raw, 2025)

        enriched = enrich_with_censo(transformed, CENSO_FILE)

        self.assertEqual(int(enriched["uf"].notna().sum()), len(enriched))
        self.assertEqual(int(enriched["ranking_uf"].notna().sum()), len(enriched))

    def test_flexible_loader_detects_comma_csv_from_real_rows(self):
        raw = real_2024_sample(3)
        with tempfile.TemporaryDirectory() as tmp_dir:
            csv_path = Path(tmp_dir) / "amostra_real_2024.csv"
            raw.to_csv(csv_path, index=False)

            loaded = load_csv_flexible(csv_path)

        self.assertEqual(len(loaded.dataframe), 3)
        self.assertIn("codigo_inep", loaded.dataframe.columns)

    def test_zip_loader_requires_member_when_multiple_csvs_exist(self):
        raw = real_2024_sample(1)
        with tempfile.TemporaryDirectory() as tmp_dir:
            zip_path = Path(tmp_dir) / "microdados.zip"
            first = raw.to_csv(index=False)
            second = raw.head(0).to_csv(index=False)
            with zipfile.ZipFile(zip_path, "w") as archive:
                archive.writestr("primeiro.csv", first)
                archive.writestr("segundo.csv", second)

            with self.assertRaisesRegex(ValueError, "--zip-member"):
                load_csv_flexible(zip_path)

            loaded = load_csv_flexible(zip_path, member="primeiro.csv")

        self.assertEqual(len(loaded.dataframe), 1)
        self.assertEqual(loaded.source_member, "primeiro.csv")

    def test_consolidated_output_keeps_current_model_columns(self):
        raw = real_2024_sample()
        transformed, _ = transform_to_enem_results(raw, 2025)

        consolidated = to_consolidated_schema(transformed)

        self.assertEqual(list(consolidated.columns), list(raw.columns))
        self.assertEqual(consolidated["ano"].unique().tolist(), [2025])
        pd.testing.assert_series_equal(
            consolidated["nota_media"].reset_index(drop=True).round(2),
            transformed["media_geral"].reset_index(drop=True).round(2),
            check_names=False,
        )

    def test_prepare_staging_dataframe_adds_job_metadata_without_losing_rows(self):
        raw = real_2024_sample(4)
        transformed, _ = transform_to_enem_results(raw, 2025)

        staged = prepare_staging_dataframe(transformed, "00000000-0000-0000-0000-000000000001")

        self.assertEqual(len(staged), len(transformed))
        self.assertEqual(staged["row_number"].tolist(), [1, 2, 3, 4])
        self.assertEqual(staged["import_job_id"].nunique(), 1)
        self.assertIn("ranking_municipio", staged.columns)

    def test_parse_integer_handles_ptbr_thousand_separator(self):
        parsed = parse_integer(pd.Series(["1.234", "3.0", ""]))

        self.assertEqual(parsed.iloc[0], 1234)
        self.assertEqual(parsed.iloc[1], 3)
        self.assertTrue(pd.isna(parsed.iloc[2]))

    def test_cli_rejects_ambiguous_apply_and_dry_run(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            csv_path = Path(tmp_dir) / "amostra.csv"
            real_2024_sample(1).to_csv(csv_path, index=False)

            with self.assertRaises(SystemExit):
                parse_args(["--year", "2025", "--input", str(csv_path), "--apply", "--dry-run"])

    def test_validation_helpers_reject_invalid_year_and_batch(self):
        with self.assertRaisesRegex(ValueError, "2018 a 2030"):
            validate_year(2031)
        with self.assertRaisesRegex(ValueError, "batch-size"):
            validate_batch_size(0)

    def test_cli_reports_invalid_year_without_traceback(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            csv_path = Path(tmp_dir) / "amostra.csv"
            real_2024_sample(1).to_csv(csv_path, index=False)

            with self.assertRaises(SystemExit):
                parse_args(["--year", "2031", "--input", str(csv_path), "--dry-run"])

    def test_dry_run_environment_does_not_require_supabase_credentials(self):
        with patch("scripts.update_enem_year.load_dotenv", return_value=True):
            with patch.dict("os.environ", {}, clear=True):
                load_environment("local", None, require_supabase=False)

    def test_apply_exception_is_written_as_blocked_report(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            csv_path = Path(tmp_dir) / "amostra_real_2024.csv"
            report_dir = Path(tmp_dir) / "reports"
            real_2024_sample(3).to_csv(csv_path, index=False)

            with patch("scripts.update_enem_year.load_environment", return_value=None):
                with patch("scripts.update_enem_year.apply_to_supabase", side_effect=RuntimeError("ano existente")):
                    exit_code = main(
                        [
                            "--year",
                            "2025",
                            "--input",
                            str(csv_path),
                            "--apply",
                            "--report-dir",
                            str(report_dir),
                            "--censo-file",
                            str(CENSO_FILE),
                        ]
                    )

            reports = list(report_dir.glob("*.json"))
            report_text = reports[0].read_text(encoding="utf-8") if reports else ""

        self.assertEqual(exit_code, 2)
        self.assertEqual(len(reports), 1)
        self.assertIn("ano existente", report_text)


if __name__ == "__main__":
    unittest.main()
