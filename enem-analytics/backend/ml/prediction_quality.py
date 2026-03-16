"""Prediction quality and presentation guardrails for school forecasts."""

from __future__ import annotations

from typing import Any, Dict, Optional

import numpy as np
import pandas as pd

SCORE_BOUNDS = {
    "nota_cn": {"min": 300, "max": 750},
    "nota_ch": {"min": 280, "max": 750},
    "nota_lc": {"min": 280, "max": 700},
    "nota_mt": {"min": 300, "max": 900},
    "nota_redacao": {"min": 0, "max": 960},
    "nota_media": {"min": 300, "max": 800},
}

AREA_SCORE_COLUMNS = {
    "cn": "nota_cn",
    "ch": "nota_ch",
    "lc": "nota_lc",
    "mt": "nota_mt",
    "redacao": "nota_redacao",
    "media": "nota_media",
}

RISK_BADGES = {
    "stability": "Estabilidade histórica",
    "conservative": "Projeção conservadora",
    "outlier": "Fora da faixa histórica",
    "sparse": "Histórico insuficiente",
}


def _safe_float(value: Any) -> Optional[float]:
    if value is None:
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if np.isnan(number):
        return None
    return number


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def _compute_trend_projection(years: list[int], values: list[float]) -> float:
    if len(values) < 2:
        return values[-1]
    slope, intercept = np.polyfit(years, values, 1)
    return float(intercept + slope * (years[-1] + 1))


def _compute_consecutive_above_mean(values: list[float], national_mean: float) -> int:
    consecutive = 0
    for value in reversed(values):
        if value > national_mean:
            consecutive += 1
        else:
            break
    return consecutive


def classify_prediction_regime(snapshot: Dict[str, Any]) -> str:
    n_years = int(snapshot.get("n_years_history", 0) or 0)
    percentile_rank = float(snapshot.get("percentile_rank", 50.0) or 50.0)
    cv = float(snapshot.get("cv", 1.0) or 1.0)
    consecutive = int(snapshot.get("consecutive_above_mean", 0) or 0)

    if n_years <= 2:
        return "sparse"

    if (
        n_years >= 5
        and percentile_rank >= 95.0
        and cv <= 0.08
        and consecutive >= 4
    ):
        return "elite_consistent"

    return "regular"


def _default_snapshot(area_key: str, raw_score: float) -> Dict[str, Any]:
    bounds = SCORE_BOUNDS[f"nota_{area_key}"]
    return {
        "area_key": area_key,
        "current_year": None,
        "current_score": raw_score,
        "n_years_history": 0,
        "historical_mean": raw_score,
        "historical_min": raw_score,
        "historical_max": raw_score,
        "std": 0.0,
        "cv": 1.0,
        "percentile_rank": 50.0,
        "consecutive_above_mean": 0,
        "trend_projection": raw_score,
        "historical_anchor": raw_score,
        "historical_corridor": {
            "low": float(bounds["min"]),
            "high": float(bounds["max"]),
        },
        "elite_consistent": False,
    }


def build_snapshot_from_school_history(preprocessor, school_df: pd.DataFrame, area_key: str) -> Dict[str, Any]:
    """Build historical stats for a school/area from raw historical rows."""
    score_col = AREA_SCORE_COLUMNS[area_key]
    valid_rows = school_df[school_df[score_col].notna()].sort_values("ano")

    if valid_rows.empty:
        return _default_snapshot(area_key, float(SCORE_BOUNDS[f"nota_{area_key}"]["min"]))

    values = valid_rows[score_col].astype(float).tolist()
    years = valid_rows["ano"].astype(int).tolist()
    current_score = values[-1]
    current_year = years[-1]
    historical_mean = float(np.mean(values))
    std = float(np.std(values)) if len(values) > 1 else 0.0
    historical_min = float(np.min(values))
    historical_max = float(np.max(values))
    cv = std / max(historical_mean, 1.0)
    trend_projection = _compute_trend_projection(years, values)
    historical_anchor = 0.60 * current_score + 0.25 * historical_mean + 0.15 * trend_projection

    year_scores = preprocessor.df[
        (preprocessor.df["ano"] == current_year) & (preprocessor.df[score_col].notna())
    ][score_col].astype(float)
    percentile_rank = float((year_scores < current_score).mean() * 100) if len(year_scores) else 50.0

    national_mean = float(preprocessor.df[score_col].dropna().astype(float).mean()) if preprocessor.df[score_col].notna().any() else historical_mean
    consecutive_above_mean = _compute_consecutive_above_mean(values, national_mean)

    corridor_low = historical_min - std
    corridor_high = historical_max + std

    return {
        "area_key": area_key,
        "current_year": current_year,
        "current_score": current_score,
        "n_years_history": len(values),
        "historical_mean": historical_mean,
        "historical_min": historical_min,
        "historical_max": historical_max,
        "std": std,
        "cv": cv,
        "percentile_rank": percentile_rank,
        "consecutive_above_mean": consecutive_above_mean,
        "trend_projection": trend_projection,
        "historical_anchor": historical_anchor,
        "historical_corridor": {
            "low": corridor_low,
            "high": corridor_high,
        },
        "elite_consistent": (
            len(values) >= 5
            and percentile_rank >= 95
            and cv <= 0.08
            and consecutive_above_mean >= 4
        ),
    }


def build_snapshot_from_feature_row(row: pd.Series, area_key: str) -> Dict[str, Any]:
    """Build historical stats for audit/calibration from a feature row."""
    lag_key = f"{AREA_SCORE_COLUMNS[area_key]}_lag1"
    current_score = _safe_float(row.get(lag_key))
    historical_mean = _safe_float(row.get(f"historical_mean_{area_key}")) or current_score
    historical_min = _safe_float(row.get(f"historical_min_{area_key}")) or current_score
    historical_max = _safe_float(row.get(f"historical_max_{area_key}")) or current_score
    cv = _safe_float(row.get(f"cv_{area_key}"))
    trend = _safe_float(row.get(f"trend_{area_key}")) or 0.0
    percentile_rank = _safe_float(row.get(f"percentile_rank_{area_key}")) or 50.0
    consecutive_above_mean = int(_safe_float(row.get(f"consecutive_above_mean_{area_key}")) or 0)
    n_years_history = int(_safe_float(row.get("n_years_history")) or _safe_float(row.get("years_of_data")) or 0)

    if current_score is None:
        return _default_snapshot(area_key, float(SCORE_BOUNDS[f"nota_{area_key}"]["min"]))

    if cv is None:
        volatility = _safe_float(row.get(f"volatility_{area_key}")) or 0.0
        cv = volatility / max(historical_mean or current_score, 1.0)
    std = float(cv * max(historical_mean or current_score, 1.0))
    trend_projection = float(current_score + trend)
    historical_anchor = 0.60 * current_score + 0.25 * (historical_mean or current_score) + 0.15 * trend_projection
    corridor_low = (historical_min or current_score) - std
    corridor_high = (historical_max or current_score) + std

    return {
        "area_key": area_key,
        "current_year": None,
        "current_score": current_score,
        "n_years_history": n_years_history,
        "historical_mean": historical_mean or current_score,
        "historical_min": historical_min or current_score,
        "historical_max": historical_max or current_score,
        "std": std,
        "cv": cv,
        "percentile_rank": percentile_rank,
        "consecutive_above_mean": consecutive_above_mean,
        "trend_projection": trend_projection,
        "historical_anchor": historical_anchor,
        "historical_corridor": {
            "low": corridor_low,
            "high": corridor_high,
        },
        "elite_consistent": (
            n_years_history >= 5
            and percentile_rank >= 95
            and cv <= 0.08
            and consecutive_above_mean >= 4
        ),
    }


def apply_prediction_guardrails(
    area_key: str,
    raw_score: float,
    raw_confidence_interval: Optional[Dict[str, float]],
    snapshot: Dict[str, Any],
    model_rmse: float,
) -> Dict[str, Any]:
    """Calibrate risky predictions and decide how they should be presented."""
    bounds = SCORE_BOUNDS[f"nota_{area_key}"]
    current_score = snapshot.get("current_score")
    current_score = raw_score if current_score is None else float(current_score)
    std = max(float(snapshot.get("std", 0.0) or 0.0), 0.0)
    historical_min = float(snapshot.get("historical_min", current_score))
    historical_max = float(snapshot.get("historical_max", current_score))
    corridor = snapshot.get("historical_corridor", {}) or {}
    corridor_low = float(corridor.get("low", historical_min))
    corridor_high = float(corridor.get("high", historical_max))
    corridor_low, corridor_high = sorted((corridor_low, corridor_high))
    regime = classify_prediction_regime(snapshot)

    raw_change = raw_score - current_score
    anchor = float(snapshot.get("historical_anchor", current_score))
    elite_consistent = bool(snapshot.get("elite_consistent", False))

    below_history = raw_score < historical_min - (0.5 * std)
    outside_corridor = raw_score < corridor_low or raw_score > corridor_high
    elite_drop = elite_consistent and raw_change < -max(1.5 * std, 25.0)
    large_drop = raw_change < -max(2.0 * std, 35.0)

    raw_ci = raw_confidence_interval or {"low": raw_score, "high": raw_score}
    raw_half_width = max((float(raw_ci["high"]) - float(raw_ci["low"])) / 2.0, 0.0)
    risk_level = "normal"
    risk_reason = None
    calibrated_score = raw_score
    display_mode = "delta"
    badge_text = None

    if regime == "sparse":
        calibrated_score = current_score
        risk_level = "conservative"
        risk_reason = "Histórico curto; a previsão oficial adota persistência até haver evidência suficiente."
        display_mode = "range"
        badge_text = RISK_BADGES["sparse"]
        half_width = max(float(model_rmse or 0.0) * 0.75, 12.0 if area_key != "redacao" else 25.0)
        confidence_interval = {
            "low": _clamp(calibrated_score - half_width, float(bounds["min"]), float(bounds["max"])),
            "high": _clamp(calibrated_score + half_width, float(bounds["min"]), float(bounds["max"])),
        }
    elif regime == "elite_consistent":
        stability_score = (
            0.70 * current_score
            + 0.20 * float(snapshot.get("trend_projection", current_score))
            + 0.10 * float(snapshot.get("historical_mean", current_score))
        )
        elite_low = historical_min - (0.5 * std)
        elite_high = historical_max + (0.5 * std)
        calibrated_score = _clamp(float(stability_score), float(bounds["min"]), float(bounds["max"]))
        calibrated_score = _clamp(calibrated_score, elite_low, elite_high)
        risk_level = "conservative"
        risk_reason = "Escola de elite e consistente; a previsão oficial prioriza estabilidade histórica em vez de regressão à média."
        display_mode = "range"
        badge_text = RISK_BADGES["stability"]
        half_width = max(std, 0.5 * float(model_rmse or 0.0), 8.0 if area_key != "redacao" else 18.0)
        confidence_interval = {
            "low": _clamp(calibrated_score - half_width, float(bounds["min"]), float(bounds["max"])),
            "high": _clamp(calibrated_score + half_width, float(bounds["min"]), float(bounds["max"])),
        }
    else:
        if elite_drop or below_history:
            calibrated_score = 0.35 * raw_score + 0.65 * anchor
            risk_level = "outlier" if below_history else "conservative"
            if below_history:
                risk_reason = "Predição bruta abaixo da faixa histórica recente da escola."
            else:
                risk_reason = "Queda prevista maior que a volatilidade histórica de uma escola de elite consistente."
        elif outside_corridor or large_drop:
            calibrated_score = 0.55 * raw_score + 0.45 * anchor
            risk_level = "outlier" if outside_corridor else "conservative"
            if outside_corridor:
                risk_reason = "Predição bruta fora do corredor histórico da escola."
            else:
                risk_reason = "Queda prevista acima da volatilidade histórica observada."

        calibrated_score = _clamp(float(calibrated_score), float(bounds["min"]), float(bounds["max"]))
        calibrated_score = _clamp(calibrated_score, corridor_low, corridor_high)

        half_width = max(raw_half_width, 1.25 * std, float(model_rmse or 0.0))
        confidence_interval = {
            "low": _clamp(calibrated_score - half_width, float(bounds["min"]), float(bounds["max"])),
            "high": _clamp(calibrated_score + half_width, float(bounds["min"]), float(bounds["max"])),
        }
        display_mode = "range" if risk_level != "normal" else "delta"
        badge_text = RISK_BADGES.get(risk_level)

    return {
        "regime": regime,
        "current_score": current_score,
        "raw_score": float(raw_score),
        "display_score": float(calibrated_score),
        "confidence_interval": confidence_interval,
        "display_mode": display_mode,
        "risk_level": risk_level,
        "risk_reason": risk_reason,
        "badge_text": badge_text,
        "historical_corridor": {
            "low": corridor_low,
            "high": corridor_high,
        },
        "raw_expected_change": float(raw_change),
        "display_expected_change": float(calibrated_score - current_score),
        "snapshot": snapshot,
    }
