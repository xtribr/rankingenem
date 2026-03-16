import tempfile
import unittest
from pathlib import Path

import pandas as pd

from data.year_resolver import (
    find_latest_enem_results_file,
    find_latest_oracle_predictions_file,
    find_latest_school_skills_file,
    find_latest_skills_file,
    get_latest_year_from_df,
    get_previous_year_from_df,
)


class YearResolverTest(unittest.TestCase):
    def test_resolves_latest_files_by_year(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            data_dir = Path(tmp_dir)
            (data_dir / "enem_2018_2024_completo.csv").write_text("x\n", encoding="utf-8")
            (data_dir / "enem_2018_2025_completo.csv").write_text("x\n", encoding="utf-8")
            (data_dir / "habilidades_2024.csv").write_text("x\n", encoding="utf-8")
            (data_dir / "habilidades_2025.csv").write_text("x\n", encoding="utf-8")
            (data_dir / "desempenho_habilidades_2024.csv").write_text("x\n", encoding="utf-8")
            (data_dir / "desempenho_habilidades_2025.csv").write_text("x\n", encoding="utf-8")
            (data_dir / "predictions_2026.json").write_text("{}", encoding="utf-8")
            (data_dir / "predictions_2026_enriched.json").write_text("{}", encoding="utf-8")
            (data_dir / "predictions_2027.json").write_text("{}", encoding="utf-8")

            self.assertEqual(
                find_latest_enem_results_file(data_dir).name,
                "enem_2018_2025_completo.csv",
            )
            self.assertEqual(find_latest_skills_file(data_dir).name, "habilidades_2025.csv")
            self.assertEqual(
                find_latest_school_skills_file(data_dir).name,
                "desempenho_habilidades_2025.csv",
            )
            self.assertEqual(
                find_latest_oracle_predictions_file(data_dir).name,
                "predictions_2027.json",
            )

    def test_resolves_latest_and_previous_year_from_dataframe(self):
        df = pd.DataFrame({"ano": [2019, 2021, 2021, 2024, 2023]})

        self.assertEqual(get_latest_year_from_df(df), 2024)
        self.assertEqual(get_previous_year_from_df(df), 2023)
        self.assertEqual(get_previous_year_from_df(df, 2023), 2021)


if __name__ == "__main__":
    unittest.main()
