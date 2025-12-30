"""
Supabase Data Loader - Centralized data access layer.

Loads CSV data from Supabase Storage with caching and filtering.
Replaces the multiple pd.read_csv() calls across ML modules.
"""

import os
import pandas as pd
from io import BytesIO
from typing import Optional
from functools import lru_cache
import logging

logger = logging.getLogger(__name__)

# Supabase configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

# Storage bucket name
STORAGE_BUCKET = "enem"

# File paths in Supabase Storage
STORAGE_FILES = {
    "enem_data": "enem_2018_2024.csv",
    "tri_content": "tri_content.csv",
    "skills": "skills.csv",
    "skill_performance": "skill_performance.csv",
    "gliner_cache": "gliner_cache.json"
}


class DataLayer:
    """
    Singleton class for centralized data access.

    Features:
    - Lazy loading: Data only loaded when first requested
    - Caching: Loaded data is cached in memory
    - Filtering: Optional filters applied at load time
    - Fallback: Uses local files if Supabase unavailable
    """

    _instance = None
    _cache = {}
    _supabase = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    @classmethod
    def get_instance(cls) -> "DataLayer":
        """Get singleton instance."""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    @property
    def supabase(self):
        """Lazy-load Supabase client."""
        if self._supabase is None and SUPABASE_URL and SUPABASE_SERVICE_KEY:
            try:
                from supabase import create_client
                self._supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
                logger.info("Supabase client initialized")
            except Exception as e:
                logger.warning(f"Failed to initialize Supabase: {e}")
        return self._supabase

    def _download_from_storage(self, file_name: str) -> bytes:
        """Download file from Supabase Storage."""
        if not self.supabase:
            raise RuntimeError("Supabase client not available")

        response = self.supabase.storage.from_(STORAGE_BUCKET).download(file_name)
        return response

    def _load_local_fallback(self, file_key: str) -> pd.DataFrame:
        """Load from local file as fallback."""
        from pathlib import Path

        local_path = Path(__file__).parent / STORAGE_FILES[file_key]
        if not local_path.exists():
            # Try parent data directory
            local_path = Path(__file__).parent.parent / "data" / STORAGE_FILES[file_key].replace(".csv", "_completo.csv")

        if local_path.exists():
            logger.info(f"Loading from local fallback: {local_path}")
            return pd.read_csv(local_path)

        raise FileNotFoundError(f"No local fallback for {file_key}")

    def get_enem_data(
        self,
        codigo_inep: Optional[str] = None,
        ano: Optional[int] = None,
        force_reload: bool = False
    ) -> pd.DataFrame:
        """
        Get ENEM school performance data.

        Args:
            codigo_inep: Filter by school INEP code
            ano: Filter by year
            force_reload: Force reload from storage (bypass cache)

        Returns:
            DataFrame with ENEM data
        """
        cache_key = "enem_data_full"

        # Load full dataset if not cached
        if cache_key not in self._cache or force_reload:
            try:
                data = self._download_from_storage(STORAGE_FILES["enem_data"])
                df = pd.read_csv(BytesIO(data))
                logger.info(f"Loaded ENEM data from Supabase: {len(df)} rows")
            except Exception as e:
                logger.warning(f"Supabase load failed, using local: {e}")
                df = self._load_local_fallback("enem_data")

            # Preprocess
            df["codigo_inep"] = df["codigo_inep"].astype(str)
            df["ano"] = df["ano"].astype(int)
            self._cache[cache_key] = df

        # Apply filters
        df = self._cache[cache_key].copy()

        if codigo_inep:
            df = df[df["codigo_inep"] == str(codigo_inep)]
        if ano:
            df = df[df["ano"] == int(ano)]

        return df

    def get_tri_content(
        self,
        area: Optional[str] = None,
        tri_min: Optional[float] = None,
        tri_max: Optional[float] = None,
        force_reload: bool = False
    ) -> pd.DataFrame:
        """
        Get TRI content with GLiNER-extracted entities.

        Args:
            area: Filter by ENEM area (CN, CH, LC, MT)
            tri_min: Minimum TRI score
            tri_max: Maximum TRI score
            force_reload: Force reload from storage

        Returns:
            DataFrame with TRI content
        """
        cache_key = "tri_content_full"

        if cache_key not in self._cache or force_reload:
            try:
                data = self._download_from_storage(STORAGE_FILES["tri_content"])
                df = pd.read_csv(BytesIO(data))
                logger.info(f"Loaded TRI content from Supabase: {len(df)} rows")
            except Exception as e:
                logger.warning(f"Supabase load failed, using local: {e}")
                # Try local file
                from pathlib import Path
                local_path = Path(__file__).parent / "conteudos_tri_gliner.csv"
                if local_path.exists():
                    df = pd.read_csv(local_path)
                else:
                    raise

            self._cache[cache_key] = df

        df = self._cache[cache_key].copy()

        if area:
            df = df[df["area"] == area]
        if tri_min is not None:
            df = df[df["tri"] >= tri_min]
        if tri_max is not None:
            df = df[df["tri"] <= tri_max]

        return df

    def get_skills(self, force_reload: bool = False) -> pd.DataFrame:
        """Get ENEM skills/habilidades data."""
        cache_key = "skills"

        if cache_key not in self._cache or force_reload:
            try:
                data = self._download_from_storage(STORAGE_FILES["skills"])
                df = pd.read_csv(BytesIO(data))
            except Exception as e:
                logger.warning(f"Using local skills data: {e}")
                from pathlib import Path
                local_path = Path(__file__).parent / "habilidades_2024.csv"
                df = pd.read_csv(local_path)

            self._cache[cache_key] = df

        return self._cache[cache_key].copy()

    def get_skill_performance(
        self,
        codigo_inep: Optional[str] = None,
        force_reload: bool = False
    ) -> pd.DataFrame:
        """Get school skill performance data."""
        cache_key = "skill_performance"

        if cache_key not in self._cache or force_reload:
            try:
                data = self._download_from_storage(STORAGE_FILES["skill_performance"])
                df = pd.read_csv(BytesIO(data))
            except Exception as e:
                logger.warning(f"Using local skill performance: {e}")
                from pathlib import Path
                local_path = Path(__file__).parent / "desempenho_habilidades_2024.csv"
                df = pd.read_csv(local_path)

            self._cache[cache_key] = df

        df = self._cache[cache_key].copy()

        if codigo_inep:
            df = df[df["codigo_inep"] == str(codigo_inep)]

        return df

    def clear_cache(self):
        """Clear all cached data."""
        self._cache.clear()
        logger.info("DataLayer cache cleared")

    def cache_stats(self) -> dict:
        """Get cache statistics."""
        stats = {}
        for key, df in self._cache.items():
            if isinstance(df, pd.DataFrame):
                stats[key] = {
                    "rows": len(df),
                    "memory_mb": df.memory_usage(deep=True).sum() / 1024 / 1024
                }
        return stats


# Convenience function
def get_data_layer() -> DataLayer:
    """Get DataLayer singleton instance."""
    return DataLayer.get_instance()
