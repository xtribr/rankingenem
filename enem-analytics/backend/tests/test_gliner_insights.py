import asyncio
import sys
import tempfile
import types
import unittest
from pathlib import Path
from unittest.mock import patch

import pandas as pd
from fastapi import HTTPException

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

auth_package = types.ModuleType("api.auth")
authorization_module = types.ModuleType("api.auth.authorization")
dependencies_module = types.ModuleType("api.auth.supabase_dependencies")


class UserProfile:
    pass


def get_authorized_school_user():
    return None


def get_current_admin():
    return None


authorization_module.get_authorized_school_user = get_authorized_school_user
dependencies_module.UserProfile = UserProfile
dependencies_module.get_current_admin = get_current_admin
sys.modules.setdefault("api.auth", auth_package)
sys.modules.setdefault("api.auth.authorization", authorization_module)
sys.modules.setdefault("api.auth.supabase_dependencies", dependencies_module)

from api.routes import gliner_insights


REQUIRED_ROW = {
    "area_code": "CN",
    "tri_score": "not-a-number",
    "habilidade": "H1",
    "conceitos_cientificos": "",
    "campos_semanticos": "",
    "campos_lexicais": "",
    "processos_fenomenos": "",
    "contextos_historicos": "",
    "habilidades_compostas": "",
}


def write_gliner_csv(data_dir: Path, rows: list[dict]) -> None:
    pd.DataFrame(rows).to_csv(data_dir / "conteudos_tri_gliner.csv", index=False)


class GlinerInsightsTest(unittest.TestCase):
    def test_parse_list_field_ignores_empty_items(self):
        self.assertEqual(
            gliner_insights.parse_list_field(" fotossintese, , cadeia alimentar "),
            ["fotossintese", "cadeia alimentar"],
        )
        self.assertEqual(gliner_insights.parse_list_field(""), [])
        self.assertEqual(gliner_insights.parse_list_field(None), [])

    def test_parse_confidence_field_coerces_invalid_values_to_zero(self):
        self.assertEqual(
            gliner_insights.parse_confidence_field("0.91, bad, 0.42"),
            [0.91, 0.0, 0.42],
        )

    def test_get_gliner_data_blocks_missing_required_columns(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            data_dir = Path(tmp_dir)
            pd.DataFrame([{"area_code": "CN"}]).to_csv(
                data_dir / "conteudos_tri_gliner.csv",
                index=False,
            )

            with self.assertRaises(HTTPException) as exc:
                gliner_insights.get_gliner_data(data_dir=data_dir, use_cache=False)

        self.assertEqual(exc.exception.status_code, 500)
        self.assertIn("missing required columns", exc.exception.detail)

    def test_get_gliner_data_coerces_invalid_tri_score(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            data_dir = Path(tmp_dir)
            write_gliner_csv(data_dir, [REQUIRED_ROW])

            df = gliner_insights.get_gliner_data(data_dir=data_dir, use_cache=False)

        self.assertTrue(pd.isna(df.loc[0, "tri_score"]))

    def test_trending_concepts_returns_empty_response_without_concepts(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            data_dir = Path(tmp_dir)
            write_gliner_csv(data_dir, [REQUIRED_ROW])

            with patch.object(gliner_insights, "DADOS_DIR", data_dir), patch.object(
                gliner_insights, "_gliner_df", None
            ):
                result = asyncio.run(
                    gliner_insights.get_trending_concepts(area=None, limit=30, _=None)
                )

        self.assertEqual(result["trending_concepts"], [])
        self.assertEqual(result["total_unique_concepts"], 0)


if __name__ == "__main__":
    unittest.main()
