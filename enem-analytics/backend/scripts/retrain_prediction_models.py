#!/usr/bin/env python3
"""Retrain school prediction models and regenerate the audit report."""

from pathlib import Path
import sys

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

from ml.prediction_model import ENEMPredictionModel


def main() -> int:
    model = ENEMPredictionModel()
    metrics = model.train_all()

    print("\nRetraining complete.")
    for target, info in metrics.items():
        public_metrics = info.get("public_metrics", {})
        print(
            f"- {target}: "
            f"rmse_public={public_metrics.get('rmse')}, "
            f"r2_public={public_metrics.get('r2')}, "
            f"version={info.get('metadata', {}).get('model_version')}"
        )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
