"""Utilities for resolving year-based ENEM data files and time windows."""

from __future__ import annotations

import re
from pathlib import Path
from typing import Iterable, Optional

import pandas as pd

YEAR_PATTERN = re.compile(r"(?<!\d)(20\d{2})(?!\d)")


def extract_years_from_name(name: str) -> list[int]:
    """Return all ENEM-like years found in a file name."""
    return [int(match) for match in YEAR_PATTERN.findall(name)]


def get_file_year(path: Path | str) -> Optional[int]:
    """Return the maximum year present in a file path, if any."""
    years = extract_years_from_name(Path(path).name)
    return max(years) if years else None


def find_latest_yeared_file(
    data_dir: Path | str,
    pattern: str,
    *,
    ignore_suffixes: Iterable[str] = (),
) -> Optional[Path]:
    """Resolve the newest file matching a glob pattern by year in its name."""
    base_path = Path(data_dir)
    candidates: list[tuple[int, Path]] = []

    for candidate in base_path.glob(pattern):
        if not candidate.is_file():
            continue
        if any(candidate.name.endswith(suffix) for suffix in ignore_suffixes):
            continue

        year = get_file_year(candidate)
        if year is None:
            continue

        candidates.append((year, candidate))

    if not candidates:
        return None

    candidates.sort(key=lambda item: (item[0], item[1].name))
    return candidates[-1][1]


def find_latest_enem_results_file(data_dir: Path | str) -> Optional[Path]:
    """Resolve the latest consolidated ENEM results CSV."""
    return find_latest_yeared_file(data_dir, "enem_*_completo.csv")


def find_latest_skills_file(data_dir: Path | str) -> Optional[Path]:
    """Resolve the latest national skills CSV."""
    return find_latest_yeared_file(data_dir, "habilidades_*.csv")


def find_latest_school_skills_file(data_dir: Path | str) -> Optional[Path]:
    """Resolve the latest school-level skills CSV."""
    return find_latest_yeared_file(data_dir, "desempenho_habilidades_*.csv")


def find_latest_oracle_predictions_file(data_dir: Path | str) -> Optional[Path]:
    """Resolve the latest base oracle predictions JSON."""
    return find_latest_yeared_file(data_dir, "predictions_*.json", ignore_suffixes=("_enriched.json",))


def get_latest_year_from_df(df: Optional[pd.DataFrame]) -> Optional[int]:
    """Return the latest ENEM year present in a dataframe."""
    if df is None or df.empty or "ano" not in df.columns:
        return None

    years = pd.to_numeric(df["ano"], errors="coerce").dropna()
    if years.empty:
        return None

    return int(years.max())


def get_previous_year_from_df(df: Optional[pd.DataFrame], latest_year: Optional[int] = None) -> Optional[int]:
    """Return the previous available ENEM year before the latest one."""
    if df is None or df.empty or "ano" not in df.columns:
        return None

    years = sorted({int(year) for year in pd.to_numeric(df["ano"], errors="coerce").dropna()})
    if not years:
        return None

    latest = latest_year if latest_year is not None else years[-1]
    previous_years = [year for year in years if year < latest]
    return previous_years[-1] if previous_years else None
