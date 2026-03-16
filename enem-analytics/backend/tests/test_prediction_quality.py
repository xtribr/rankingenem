import unittest
from pathlib import Path
import sys

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

from ml.prediction_quality import apply_prediction_guardrails


class PredictionQualityTests(unittest.TestCase):
    def test_elite_consistent_school_uses_range_when_drop_is_extreme(self):
        snapshot = {
            "current_score": 889.5,
            "n_years_history": 7,
            "historical_mean": 876.4,
            "historical_min": 854.0,
            "historical_max": 889.5,
            "std": 12.0,
            "cv": 0.013,
            "percentile_rank": 99.5,
            "consecutive_above_mean": 7,
            "historical_anchor": 882.0,
            "historical_corridor": {"low": 842.0, "high": 901.5},
            "elite_consistent": True,
        }

        result = apply_prediction_guardrails(
            area_key="mt",
            raw_score=790.5,
            raw_confidence_interval={"low": 733.5, "high": 847.5},
            snapshot=snapshot,
            model_rmse=21.0,
        )

        self.assertEqual(result["display_mode"], "range")
        self.assertIn(result["risk_level"], {"conservative", "outlier"})
        self.assertGreater(result["display_score"], result["raw_score"])
        self.assertGreaterEqual(result["confidence_interval"]["high"], result["confidence_interval"]["low"])

    def test_volatile_school_keeps_delta_when_prediction_is_plausible(self):
        snapshot = {
            "current_score": 620.0,
            "n_years_history": 6,
            "historical_mean": 612.0,
            "historical_min": 552.0,
            "historical_max": 670.0,
            "std": 34.0,
            "cv": 0.11,
            "percentile_rank": 58.0,
            "consecutive_above_mean": 1,
            "historical_anchor": 618.0,
            "historical_corridor": {"low": 518.0, "high": 704.0},
            "elite_consistent": False,
        }

        result = apply_prediction_guardrails(
            area_key="cn",
            raw_score=633.0,
            raw_confidence_interval={"low": 607.0, "high": 659.0},
            snapshot=snapshot,
            model_rmse=19.0,
        )

        self.assertEqual(result["display_mode"], "delta")
        self.assertEqual(result["risk_level"], "normal")
        self.assertAlmostEqual(result["display_score"], result["raw_score"], places=6)


if __name__ == "__main__":
    unittest.main()
