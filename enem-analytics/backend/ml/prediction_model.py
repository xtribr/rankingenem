"""Prediction model for ENEM TRI school scores."""

from __future__ import annotations

from datetime import datetime, timezone
import json
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split

try:
    from xgboost import XGBRegressor

    HAS_XGBOOST = True
except (ImportError, Exception) as exc:
    HAS_XGBOOST = False
    print(f"XGBoost not available ({exc}), using HistGradientBoostingRegressor")

from .prediction_quality import (
    SCORE_BOUNDS,
    apply_prediction_guardrails,
    build_snapshot_from_feature_row,
    build_snapshot_from_school_history,
)
from .preprocessor import ENEMPreprocessor

TARGETS = [
    "nota_cn",
    "nota_ch",
    "nota_lc",
    "nota_mt",
    "nota_redacao",
    "nota_media",
]
DEFAULT_TARGET_YEAR = 2025
MODEL_VERSION = "soft-cal-v1"
AUDIT_REPORT_NAME = "prediction_audit_report.json"
BACKTEST_TRAIN_SAMPLE_CAP = 10000


class ENEMPredictionModel:
    """Prediction model for ENEM school scores."""

    def __init__(self, model_dir: str | Path | None = None):
        self.model_dir = Path(model_dir or Path(__file__).parent.parent / "models")
        self.model_dir.mkdir(exist_ok=True)

        self.models: Dict[str, Any] = {}
        self.model_artifacts: Dict[str, Dict[str, Any]] = {}
        self.feature_names_by_target: Dict[str, List[str]] = {}
        self.preprocessor: Optional[ENEMPreprocessor] = None

    @staticmethod
    def _target_short(target: str) -> str:
        return target.replace("nota_", "")

    def _artifact_path(self, target: str) -> Path:
        return self.model_dir / f"prediction_{self._target_short(target)}.joblib"

    def _get_model(self):
        preferred_model = os.getenv("ENEM_PREDICTION_ALGO", "hist").lower()
        if preferred_model == "xgboost" and HAS_XGBOOST:
            return XGBRegressor(
                n_estimators=60,
                max_depth=4,
                learning_rate=0.05,
                subsample=0.9,
                colsample_bytree=0.9,
                random_state=42,
                n_jobs=-1,
            )
        return HistGradientBoostingRegressor(
            max_iter=50,
            max_depth=4,
            learning_rate=0.05,
            random_state=42,
        )

    def _ensure_preprocessor(self, preprocessor: Optional[ENEMPreprocessor] = None) -> ENEMPreprocessor:
        if preprocessor is not None:
            self.preprocessor = preprocessor
        if self.preprocessor is None:
            self.preprocessor = ENEMPreprocessor()
        return self.preprocessor

    @staticmethod
    def _safe_r2(actual: pd.Series, predicted: np.ndarray) -> Optional[float]:
        if len(actual) < 2:
            return None
        return float(r2_score(actual, predicted))

    @staticmethod
    def _metric_bundle(actual: pd.Series, predicted: pd.Series) -> Dict[str, Optional[float]]:
        if len(actual) == 0:
            return {}

        error = predicted - actual
        return {
            "count": int(len(actual)),
            "rmse": float(np.sqrt(mean_squared_error(actual, predicted))),
            "mae": float(mean_absolute_error(actual, predicted)),
            "r2": float(r2_score(actual, predicted)) if len(actual) > 1 else None,
            "bias": float(error.mean()),
        }

    def _segment_report(self, frame: pd.DataFrame) -> Dict[str, Any]:
        if frame.empty:
            return {}

        return {
            "count": int(len(frame)),
            "raw": self._metric_bundle(frame["actual"], frame["raw_score"]),
            "calibrated": self._metric_bundle(frame["actual"], frame["display_score"]),
            "raw_negative_share": float((frame["raw_expected_change"] < 0).mean()),
            "calibrated_negative_share": float((frame["display_expected_change"] < 0).mean()),
        }

    def _build_public_metrics(
        self,
        backtest_summary: Dict[str, Any],
        random_split_metrics: Dict[str, float],
    ) -> Dict[str, Optional[float]]:
        calibrated = backtest_summary.get("summary", {}).get("calibrated", {})
        if calibrated:
            return {
                "rmse": calibrated.get("rmse"),
                "mae": calibrated.get("mae"),
                "r2": calibrated.get("r2"),
                "bias": calibrated.get("bias"),
            }
        return {
            "rmse": random_split_metrics.get("test_rmse"),
            "mae": random_split_metrics.get("test_mae"),
            "r2": random_split_metrics.get("test_r2"),
            "bias": None,
        }

    def _legacy_metadata(self, target: str, artifact: Dict[str, Any]) -> Dict[str, Any]:
        metrics = artifact.get("metrics", {}) or {}
        return {
            "algorithm": artifact.get("model").__class__.__name__ if artifact.get("model") else "unknown",
            "model_version": "legacy-v0",
            "trained_at": None,
            "training_pairs": [],
            "evaluation_strategy": "random-split",
            "public_metrics": {
                "rmse": metrics.get("test_rmse"),
                "mae": metrics.get("test_mae"),
                "r2": metrics.get("test_r2"),
                "bias": None,
            },
            "backtest": {},
            "current_cycle_audit": {},
            "promotion_gates": {},
        }

    def _get_target_model_info(self, target: str) -> Dict[str, Any]:
        artifact = self.model_artifacts.get(target)
        if artifact is None and not self.load_model(target):
            return {}

        artifact = self.model_artifacts[target]
        metrics = artifact.get("metrics", {}) or {}
        metadata = artifact.get("metadata") or self._legacy_metadata(target, artifact)
        public_metrics = metadata.get("public_metrics", {}) or {}
        rmse = public_metrics.get("rmse", metrics.get("test_rmse"))
        mae = public_metrics.get("mae", metrics.get("test_mae"))
        r2 = public_metrics.get("r2", metrics.get("test_r2"))
        bias = public_metrics.get("bias")

        return {
            "algorithm": metadata.get("algorithm") or artifact["model"].__class__.__name__,
            "training_samples": int(metrics.get("training_samples") or (metrics.get("train_samples", 0) + metrics.get("test_samples", 0))),
            "train_samples": int(metrics.get("train_samples", 0)),
            "test_samples": int(metrics.get("test_samples", 0)),
            "rmse": float(rmse) if rmse is not None else None,
            "mae": float(mae) if mae is not None else None,
            "r2": float(r2) if r2 is not None else None,
            "bias": float(bias) if bias is not None else None,
            "trained_at": metadata.get("trained_at"),
            "training_pairs": metadata.get("training_pairs", []),
            "model_version": metadata.get("model_version", MODEL_VERSION),
            "evaluation_strategy": metadata.get("evaluation_strategy", "random-split"),
            "promotion_gates": metadata.get("promotion_gates", {}),
        }

    def _summarize_model_info(self) -> Dict[str, Any]:
        per_area = {
            self._target_short(target): self._get_target_model_info(target)
            for target in TARGETS
            if target in self.model_artifacts or self.load_model(target)
        }
        summary = per_area.get("media") or next(iter(per_area.values()), {})
        return {
            **summary,
            "per_area": per_area,
        }

    def _get_model_rmse(self, target: str) -> float:
        info = self._get_target_model_info(target)
        rmse = info.get("rmse")
        return float(rmse) if rmse is not None else 30.0

    def _compute_promotion_gates(
        self,
        backtest_summary: Dict[str, Any],
        current_cycle_audit: Dict[str, Any],
    ) -> Dict[str, Any]:
        top10 = backtest_summary.get("segments", {}).get("top_10_pct", {})
        raw_bias = abs((top10.get("raw") or {}).get("bias") or 0.0)
        calibrated_bias = abs((top10.get("calibrated") or {}).get("bias") or 0.0)

        signed_error_improvement = None
        if raw_bias > 0:
            signed_error_improvement = (raw_bias - calibrated_bias) / raw_bias

        global_raw_rmse = (backtest_summary.get("summary", {}).get("raw") or {}).get("rmse")
        global_calibrated_rmse = (backtest_summary.get("summary", {}).get("calibrated") or {}).get("rmse")
        rmse_degradation = None
        if global_raw_rmse:
            rmse_degradation = (global_calibrated_rmse - global_raw_rmse) / global_raw_rmse

        top20_negative_share = current_cycle_audit.get("top_n_display_negative_share")

        return {
            "top10_signed_error_improvement": signed_error_improvement,
            "top20_negative_share": top20_negative_share,
            "rmse_degradation": rmse_degradation,
            "pass_top10_signed_error_gate": signed_error_improvement is not None and signed_error_improvement >= 0.30,
            "pass_top20_negative_share_gate": top20_negative_share is not None and top20_negative_share < 0.50,
            "pass_rmse_gate": rmse_degradation is not None and rmse_degradation <= 0.05,
        }

    def run_temporal_backtest(
        self,
        target: str,
        preprocessor: Optional[ENEMPreprocessor] = None,
        dataset: Optional[pd.DataFrame] = None,
    ) -> Dict[str, Any]:
        preprocessor = self._ensure_preprocessor(preprocessor)
        dataset = dataset if dataset is not None else preprocessor.prepare_training_dataset(target_col=target, min_years=3)

        if dataset.empty:
            return {}

        area_key = self._target_short(target)
        meta_cols = ["codigo_inep", "_target_year", "_target_value", "_ranking_brasil", "_rank_percent"]
        feature_cols = [col for col in dataset.columns if col not in meta_cols]
        bounds = SCORE_BOUNDS[target]

        folds: List[Dict[str, Any]] = []
        records: List[Dict[str, Any]] = []

        for target_year in sorted(dataset["_target_year"].unique()):
            train_df = dataset[dataset["_target_year"] < target_year]
            test_df = dataset[dataset["_target_year"] == target_year]

            if train_df.empty or test_df.empty:
                continue

            if len(train_df) > BACKTEST_TRAIN_SAMPLE_CAP:
                train_df = train_df.sample(BACKTEST_TRAIN_SAMPLE_CAP, random_state=42)

            fold_model = self._get_model()
            X_train = train_df[feature_cols]
            y_train = train_df["_target_value"]
            X_test = test_df[feature_cols]
            y_test = test_df["_target_value"]

            fold_model.fit(X_train, y_train)
            raw_predictions = pd.Series(fold_model.predict(X_test), index=test_df.index, dtype=float)
            raw_rmse = float(np.sqrt(mean_squared_error(y_test, raw_predictions)))

            fold_records: List[Dict[str, Any]] = []
            for row_index, row in test_df.iterrows():
                raw_score = float(np.clip(raw_predictions.loc[row_index], bounds["min"], bounds["max"]))
                raw_ci = {
                    "low": float(np.clip(raw_score - 1.96 * raw_rmse, bounds["min"], bounds["max"])),
                    "high": float(np.clip(raw_score + 1.96 * raw_rmse, bounds["min"], bounds["max"])),
                }
                snapshot = build_snapshot_from_feature_row(row, area_key)
                presentation = apply_prediction_guardrails(area_key, raw_score, raw_ci, snapshot, raw_rmse)

                record = {
                    "codigo_inep": row["codigo_inep"],
                    "target_year": int(row["_target_year"]),
                    "actual": float(row["_target_value"]),
                    "current_score": float(presentation["current_score"]),
                    "raw_score": float(presentation["raw_score"]),
                    "display_score": float(presentation["display_score"]),
                    "raw_expected_change": float(presentation["raw_expected_change"]),
                    "display_expected_change": float(presentation["display_expected_change"]),
                    "display_mode": presentation["display_mode"],
                    "risk_level": presentation["risk_level"],
                    "risk_reason": presentation["risk_reason"],
                    "rank_percent": float(row["_rank_percent"]) if pd.notna(row["_rank_percent"]) else np.nan,
                    "ranking_brasil": float(row["_ranking_brasil"]) if pd.notna(row["_ranking_brasil"]) else np.nan,
                    "cv": float(snapshot.get("cv", 1.0) or 1.0),
                }
                records.append(record)
                fold_records.append(record)

            fold_frame = pd.DataFrame(fold_records)
            folds.append(
                {
                    "target_year": int(target_year),
                    "train_samples": int(len(train_df)),
                    "test_samples": int(len(test_df)),
                    "raw": self._metric_bundle(y_test.reset_index(drop=True), raw_predictions.reset_index(drop=True)),
                    "calibrated": self._metric_bundle(fold_frame["actual"], fold_frame["display_score"]),
                    "top_10_pct": self._segment_report(fold_frame[fold_frame["rank_percent"] <= 0.10]),
                }
            )

        if not records:
            return {}

        backtest_df = pd.DataFrame(records)
        deciles: Dict[str, Any] = {}
        if backtest_df["rank_percent"].notna().any():
            ranked = backtest_df[backtest_df["rank_percent"].notna()].copy()
            ranked["ranking_decil"] = np.ceil(ranked["rank_percent"] * 10).clip(1, 10).astype(int)
            for decile in range(1, 11):
                deciles[str(decile)] = self._segment_report(ranked[ranked["ranking_decil"] == decile])

        summary = {
            "raw": self._metric_bundle(backtest_df["actual"], backtest_df["raw_score"]),
            "calibrated": self._metric_bundle(backtest_df["actual"], backtest_df["display_score"]),
        }
        segments = {
            "top_1_pct": self._segment_report(backtest_df[backtest_df["rank_percent"] <= 0.01]),
            "top_5_pct": self._segment_report(backtest_df[backtest_df["rank_percent"] <= 0.05]),
            "top_10_pct": self._segment_report(backtest_df[backtest_df["rank_percent"] <= 0.10]),
            "consistent": self._segment_report(backtest_df[backtest_df["cv"] <= 0.08]),
            "volatile": self._segment_report(backtest_df[backtest_df["cv"] > 0.08]),
            "deciles": deciles,
        }

        return {
            "folds": folds,
            "summary": summary,
            "segments": segments,
        }

    def run_current_cycle_audit(
        self,
        target: str,
        preprocessor: Optional[ENEMPreprocessor] = None,
        top_n: int = 20,
        sample_n: int = 60,
    ) -> Dict[str, Any]:
        preprocessor = self._ensure_preprocessor(preprocessor)
        latest_year = int(preprocessor.df["ano"].max())
        current_df = preprocessor.df[preprocessor.df["ano"] == latest_year].copy()
        current_df = current_df[current_df[target].notna()]
        current_df = current_df.sort_values(["ranking_brasil", target], na_position="last").head(sample_n)

        if current_df.empty:
            return {}

        area_key = self._target_short(target)
        rows: List[Dict[str, Any]] = []
        for _, row in current_df.iterrows():
            try:
                prediction = self.predict(str(row["codigo_inep"]), target)
            except Exception:
                continue

            rows.append(
                {
                    "codigo_inep": str(row["codigo_inep"]),
                    "nome_escola": row.get("nome_escola"),
                    "ranking_brasil": int(row["ranking_brasil"]) if pd.notna(row.get("ranking_brasil")) else None,
                    "current_score": float(row[target]),
                    "raw_score": float(prediction["raw_score"]),
                    "display_score": float(prediction["display_score"]),
                    "raw_expected_change": float(prediction["raw_expected_change"]),
                    "display_expected_change": float(prediction["expected_change"]),
                    "display_mode": prediction["display_mode"],
                    "risk_level": prediction["risk_level"],
                    "area": area_key,
                }
            )

        audit_df = pd.DataFrame(rows)
        if audit_df.empty:
            return {}

        top_focus = audit_df.head(top_n)
        return {
            "latest_year": latest_year,
            "sample_size": int(len(audit_df)),
            "top_n": int(top_n),
            "raw_negative_share": float((audit_df["raw_expected_change"] < 0).mean()),
            "display_negative_share": float((audit_df["display_expected_change"] < 0).mean()),
            "top_n_raw_negative_share": float((top_focus["raw_expected_change"] < 0).mean()),
            "top_n_display_negative_share": float((top_focus["display_expected_change"] < 0).mean()),
            "raw_mean_delta": float(audit_df["raw_expected_change"].mean()),
            "display_mean_delta": float(audit_df["display_expected_change"].mean()),
            "top_sample": top_focus.to_dict("records"),
        }

    def _write_audit_report(self, metrics_by_target: Dict[str, Dict[str, Any]]) -> Path:
        report_path = self.model_dir / AUDIT_REPORT_NAME
        report = {
            "generated_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
            "model_version": MODEL_VERSION,
            "targets": {},
        }

        for target, metrics in metrics_by_target.items():
            target_short = self._target_short(target)
            artifact = self.model_artifacts.get(target, {})
            metadata = artifact.get("metadata", {})
            report["targets"][target_short] = {
                "metrics": {
                    "training_samples": metrics.get("training_samples"),
                    "train_samples": metrics.get("train_samples"),
                    "test_samples": metrics.get("test_samples"),
                    "train_rmse": metrics.get("train_rmse"),
                    "test_rmse": metrics.get("test_rmse"),
                    "test_r2": metrics.get("test_r2"),
                },
                "public_metrics": metrics.get("public_metrics", {}),
                "backtest": metadata.get("backtest", {}),
                "current_cycle_audit": metadata.get("current_cycle_audit", {}),
                "promotion_gates": metadata.get("promotion_gates", {}),
            }

        with report_path.open("w", encoding="utf-8") as handle:
            json.dump(report, handle, ensure_ascii=False, indent=2)

        return report_path

    def train(
        self,
        target: str = "nota_media",
        preprocessor: Optional[ENEMPreprocessor] = None,
    ) -> Dict[str, Any]:
        preprocessor = self._ensure_preprocessor(preprocessor)
        dataset = preprocessor.prepare_training_dataset(target_col=target, min_years=3, verbose=True)
        if dataset.empty:
            raise ValueError(f"No training samples available for {target}")

        meta_cols = ["codigo_inep", "_target_year", "_target_value", "_ranking_brasil", "_rank_percent"]
        feature_cols = [col for col in dataset.columns if col not in meta_cols]
        X = dataset[feature_cols]
        y = dataset["_target_value"]

        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

        model = self._get_model()
        model.fit(X_train, y_train)

        y_pred_train = model.predict(X_train)
        y_pred_test = model.predict(X_test)

        random_split_metrics: Dict[str, Any] = {
            "target": target,
            "training_samples": int(len(dataset)),
            "train_samples": int(len(X_train)),
            "test_samples": int(len(X_test)),
            "train_rmse": float(np.sqrt(mean_squared_error(y_train, y_pred_train))),
            "test_rmse": float(np.sqrt(mean_squared_error(y_test, y_pred_test))),
            "train_mae": float(mean_absolute_error(y_train, y_pred_train)),
            "test_mae": float(mean_absolute_error(y_test, y_pred_test)),
            "train_r2": self._safe_r2(y_train, y_pred_train),
            "test_r2": self._safe_r2(y_test, y_pred_test),
        }

        if hasattr(model, "feature_importances_"):
            importance = pd.DataFrame(
                {"feature": feature_cols, "importance": model.feature_importances_}
            ).sort_values("importance", ascending=False)
            random_split_metrics["feature_importance"] = importance.head(15).to_dict("records")

        self.models[target] = model
        self.feature_names_by_target[target] = feature_cols

        backtest_summary = self.run_temporal_backtest(target, preprocessor=preprocessor, dataset=dataset)
        public_metrics = self._build_public_metrics(backtest_summary, random_split_metrics)

        metadata: Dict[str, Any] = {
            "algorithm": model.__class__.__name__,
            "model_version": MODEL_VERSION,
            "trained_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
            "training_pairs": [f"<={year - 1}->{year}" for year in sorted(dataset["_target_year"].unique())],
            "evaluation_strategy": "rolling-origin-backtest",
            "public_metrics": public_metrics,
            "backtest": backtest_summary,
        }

        artifact = {
            "model": model,
            "feature_names": feature_cols,
            "metrics": random_split_metrics,
            "metadata": metadata,
        }
        self.model_artifacts[target] = artifact

        current_cycle_audit = self.run_current_cycle_audit(target, preprocessor=preprocessor)
        metadata["current_cycle_audit"] = current_cycle_audit
        metadata["promotion_gates"] = self._compute_promotion_gates(backtest_summary, current_cycle_audit)

        artifact_path = self._artifact_path(target)
        joblib.dump(artifact, artifact_path)
        print(f"Model saved to {artifact_path}")

        return {
            **random_split_metrics,
            "public_metrics": public_metrics,
            "metadata": metadata,
        }

    def train_all(self) -> Dict[str, Dict[str, Any]]:
        preprocessor = self._ensure_preprocessor()
        all_metrics: Dict[str, Dict[str, Any]] = {}

        for target in TARGETS:
            print(f"\n{'=' * 60}")
            print(f"Training model for {target}")
            print("=" * 60)
            metrics = self.train(target, preprocessor=preprocessor)
            all_metrics[target] = metrics

            print(f"  Train RMSE: {metrics['train_rmse']:.2f}")
            print(f"  Test RMSE: {metrics['test_rmse']:.2f}")
            if metrics["test_r2"] is not None:
                print(f"  Test R2: {metrics['test_r2']:.3f}")

        report_path = self._write_audit_report(all_metrics)
        print(f"Audit report written to {report_path}")
        return all_metrics

    def load_model(self, target: str) -> bool:
        artifact_path = self._artifact_path(target)
        if not artifact_path.exists():
            print(f"Model not found: {artifact_path}")
            return False

        artifact = joblib.load(artifact_path)
        self.models[target] = artifact["model"]
        self.feature_names_by_target[target] = artifact.get("feature_names", [])
        if "metadata" not in artifact:
            artifact["metadata"] = self._legacy_metadata(target, artifact)
        self.model_artifacts[target] = artifact
        return True

    def load_all_models(self) -> int:
        loaded = 0
        for target in TARGETS:
            if self.load_model(target):
                loaded += 1
        return loaded

    def predict(self, codigo_inep: str, target: str = "nota_media") -> Dict[str, Any]:
        if target not in self.models and not self.load_model(target):
            raise ValueError(f"Model for {target} not available")

        preprocessor = self._ensure_preprocessor()
        features = preprocessor.prepare_features_for_school(codigo_inep)
        if features is None:
            raise ValueError(f"School {codigo_inep} not found")

        feature_names = self.feature_names_by_target.get(target) or []
        if not feature_names:
            raise ValueError(f"Feature names for {target} are not available")

        X = pd.DataFrame([{name: features.get(name, np.nan) for name in feature_names}])
        raw_model_prediction = float(self.models[target].predict(X)[0])

        bounds = SCORE_BOUNDS[target]
        raw_score = float(np.clip(raw_model_prediction, bounds["min"], bounds["max"]))
        rmse = self._get_model_rmse(target)
        raw_confidence_interval = {
            "low": float(np.clip(raw_score - 1.96 * rmse, bounds["min"], bounds["max"])),
            "high": float(np.clip(raw_score + 1.96 * rmse, bounds["min"], bounds["max"])),
        }

        area_key = self._target_short(target)
        school_df = preprocessor.df[preprocessor.df["codigo_inep"] == codigo_inep].copy()
        snapshot = build_snapshot_from_school_history(preprocessor, school_df, area_key)
        presentation = apply_prediction_guardrails(
            area_key=area_key,
            raw_score=raw_score,
            raw_confidence_interval=raw_confidence_interval,
            snapshot=snapshot,
            model_rmse=rmse,
        )

        return {
            "codigo_inep": codigo_inep,
            "target": target,
            "prediction": float(presentation["display_score"]),
            "raw_prediction": float(raw_model_prediction),
            "raw_score": float(presentation["raw_score"]),
            "display_score": float(presentation["display_score"]),
            "current_score": float(presentation["current_score"]),
            "confidence_interval": presentation["confidence_interval"],
            "raw_confidence_interval": raw_confidence_interval,
            "uncertainty": float(rmse),
            "display_mode": presentation["display_mode"],
            "regime": presentation["regime"],
            "risk_level": presentation["risk_level"],
            "risk_reason": presentation["risk_reason"],
            "badge_text": presentation["badge_text"],
            "historical_corridor": presentation["historical_corridor"],
            "raw_expected_change": float(presentation["raw_expected_change"]),
            "expected_change": float(presentation["display_expected_change"]),
            "snapshot": presentation["snapshot"],
            "model_info": self._get_target_model_info(target),
        }

    def predict_all_scores(self, codigo_inep: str) -> Dict[str, Any]:
        predictions: Dict[str, Any] = {
            "codigo_inep": codigo_inep,
            "target_year": DEFAULT_TARGET_YEAR,
            "scores": {},
            "raw_scores": {},
            "display_scores": {},
            "current_scores": {},
            "confidence_intervals": {},
            "raw_confidence_intervals": {},
            "expected_change": {},
            "raw_expected_change": {},
            "display_modes": {},
            "risk_levels": {},
            "risk_reasons": {},
            "badge_texts": {},
            "historical_corridors": {},
            "areas": {},
            "disclaimer": (
                "Predição oficial calibrada por histórico e apresentada com faixa conservadora "
                "quando a projeção excede a volatilidade observada da escola."
            ),
        }

        for target in TARGETS:
            area_key = self._target_short(target)
            try:
                result = self.predict(codigo_inep, target)
            except Exception as exc:
                print(f"Error predicting {target} for {codigo_inep}: {exc}")
                continue

            predictions["scores"][area_key] = result["display_score"]
            predictions["raw_scores"][area_key] = result["raw_score"]
            predictions["display_scores"][area_key] = result["display_score"]
            predictions["current_scores"][area_key] = result["current_score"]
            predictions["confidence_intervals"][area_key] = result["confidence_interval"]
            predictions["raw_confidence_intervals"][area_key] = result["raw_confidence_interval"]
            predictions["expected_change"][area_key] = result["expected_change"]
            predictions["raw_expected_change"][area_key] = result["raw_expected_change"]
            predictions["display_modes"][area_key] = result["display_mode"]
            predictions["risk_levels"][area_key] = result["risk_level"]
            predictions["risk_reasons"][area_key] = result["risk_reason"]
            predictions["badge_texts"][area_key] = result["badge_text"]
            predictions["historical_corridors"][area_key] = result["historical_corridor"]
            predictions["areas"][area_key] = {
                "current_score": result["current_score"],
                "raw_score": result["raw_score"],
                "display_score": result["display_score"],
                "confidence_interval": result["confidence_interval"],
                "raw_confidence_interval": result["raw_confidence_interval"],
                "display_mode": result["display_mode"],
                "regime": result["regime"],
                "risk_level": result["risk_level"],
                "risk_reason": result["risk_reason"],
                "badge_text": result["badge_text"],
                "historical_corridor": result["historical_corridor"],
                "raw_expected_change": result["raw_expected_change"],
                "display_expected_change": result["expected_change"],
                "model_info": result["model_info"],
            }

        if not predictions["scores"]:
            predictions["error"] = (
                "Dados insuficientes para gerar uma predição confiável para esta escola. "
                "Verifique se há histórico suficiente do ENEM."
            )
            return predictions

        predictions["model_info"] = self._summarize_model_info()
        return predictions

    def get_feature_importance(self, target: str = "nota_media") -> List[Dict[str, Any]]:
        if target not in self.model_artifacts and not self.load_model(target):
            return []
        return (self.model_artifacts[target].get("metrics") or {}).get("feature_importance", [])


if __name__ == "__main__":
    model = ENEMPredictionModel()
    metrics = model.train_all()

    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    for target, info in metrics.items():
        print(f"{target}: RMSE={info['test_rmse']:.2f}, R2={info['test_r2']}")
