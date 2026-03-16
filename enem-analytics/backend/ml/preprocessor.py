"""
Feature engineering and data preprocessing for ENEM ML models
"""

import pandas as pd
import numpy as np
from typing import Dict, List, Tuple, Optional
from pathlib import Path

from data.year_resolver import (
    find_latest_enem_results_file,
    find_latest_school_skills_file,
    find_latest_skills_file,
    get_latest_year_from_df,
)

class ENEMPreprocessor:
    """Preprocessor for ENEM school data - creates features for ML models"""

    def __init__(self, data_path: str = None):
        if data_path is None:
            data_path = Path(__file__).parent.parent / "data"
        self.data_path = Path(data_path)

        # Load main datasets
        self.df = None
        self.skills_df = None
        self.school_skills_df = None
        self.tri_content_df = None  # TRI content with GLiNER entities
        self.skill_tri_map = None   # Mapping of skills to TRI difficulty
        self._load_data()
        self._compute_tri_mappings()

    def _load_data(self):
        """Load all required datasets"""
        # Main ENEM data
        enem_file = find_latest_enem_results_file(self.data_path)
        if enem_file is None:
            raise FileNotFoundError("No consolidated ENEM dataset found in backend/data")
        self.df = pd.read_csv(enem_file, dtype={'codigo_inep': str})
        print(f"Loaded {len(self.df)} ENEM records")

        # National skills data
        skills_file = find_latest_skills_file(self.data_path)
        if skills_file and skills_file.exists():
            self.skills_df = pd.read_csv(skills_file)
            print(f"Loaded {len(self.skills_df)} skill records")

        # School-level skills data
        school_skills_file = find_latest_school_skills_file(self.data_path)
        if school_skills_file and school_skills_file.exists():
            self.school_skills_df = pd.read_csv(school_skills_file)
            print(f"Loaded {len(self.school_skills_df)} school skill records")

        # TRI content data with GLiNER entities
        tri_content_file = self.data_path / "conteudos_tri_gliner.csv"
        if tri_content_file.exists():
            # Use quoting=1 (QUOTE_ALL) to properly handle fields with commas
            self.tri_content_df = pd.read_csv(tri_content_file, quoting=1)
            print(f"Loaded {len(self.tri_content_df)} TRI content records")

    def _compute_tri_mappings(self):
        """Compute TRI difficulty mappings per skill and area"""
        if self.tri_content_df is None:
            self.skill_tri_map = {}
            self.area_tri_stats = {}
            return

        # Compute average TRI score per skill (habilidade)
        skill_stats = self.tri_content_df.groupby(['area_code', 'habilidade']).agg({
            'tri_score': ['mean', 'std', 'min', 'max', 'count']
        }).reset_index()
        skill_stats.columns = ['area_code', 'habilidade', 'tri_mean', 'tri_std', 'tri_min', 'tri_max', 'tri_count']

        self.skill_tri_map = {}
        for _, row in skill_stats.iterrows():
            key = f"{row['area_code']}_{row['habilidade']}"
            self.skill_tri_map[key] = {
                'mean': row['tri_mean'],
                'std': row['tri_std'] if not pd.isna(row['tri_std']) else 50,
                'min': row['tri_min'],
                'max': row['tri_max'],
                'count': row['tri_count']
            }

        # Compute area-level TRI statistics
        self.area_tri_stats = {}
        for area in ['CN', 'CH', 'LC', 'MT']:
            area_data = self.tri_content_df[self.tri_content_df['area_code'] == area]
            if len(area_data) > 0:
                self.area_tri_stats[area] = {
                    'mean': area_data['tri_score'].mean(),
                    'std': area_data['tri_score'].std(),
                    'p25': area_data['tri_score'].quantile(0.25),
                    'p50': area_data['tri_score'].quantile(0.50),
                    'p75': area_data['tri_score'].quantile(0.75),
                    'count': len(area_data)
                }

        print(f"Computed TRI mappings for {len(self.skill_tri_map)} skills")

    def create_lagged_features(self, school_df: pd.DataFrame, n_lags: int = 3) -> Dict[str, float]:
        """
        Create lagged score features for a school

        Args:
            school_df: DataFrame with school's historical data (sorted by year)
            n_lags: Number of lag years to create

        Returns:
            Dictionary of lagged features
        """
        features = {}
        score_cols = ['nota_cn', 'nota_ch', 'nota_lc', 'nota_mt', 'nota_redacao', 'nota_media', 'ranking_brasil']

        # Sort by year descending (most recent first)
        school_df = school_df.sort_values('ano', ascending=False)

        for col in score_cols:
            for lag in range(1, n_lags + 1):
                if len(school_df) >= lag:
                    features[f'{col}_lag{lag}'] = school_df.iloc[lag - 1][col]
                else:
                    features[f'{col}_lag{lag}'] = np.nan

        return features

    def create_trend_features(self, school_df: pd.DataFrame) -> Dict[str, float]:
        """
        Create trend features (slope, volatility) for a school

        Args:
            school_df: DataFrame with school's historical data

        Returns:
            Dictionary of trend features
        """
        features = {}
        score_cols = ['nota_cn', 'nota_ch', 'nota_lc', 'nota_mt', 'nota_redacao']

        # Sort by year ascending for trend calculation
        school_df = school_df.sort_values('ano')

        for col in score_cols:
            values = school_df[col].dropna().values
            col_short = col.replace('nota_', '')

            if len(values) >= 2:
                # Linear trend (slope)
                x = np.arange(len(values))
                slope = np.polyfit(x, values, 1)[0]
                features[f'trend_{col_short}'] = slope

                # Volatility (std dev)
                features[f'volatility_{col_short}'] = np.std(values)

                # Year-over-year change (most recent)
                features[f'yoy_{col_short}'] = values[-1] - values[-2] if len(values) >= 2 else 0
            else:
                features[f'trend_{col_short}'] = 0
                features[f'volatility_{col_short}'] = 0
                features[f'yoy_{col_short}'] = 0

        return features

    def create_school_features(self, school_df: pd.DataFrame) -> Dict[str, float]:
        """
        Create school characteristic features

        Args:
            school_df: DataFrame with school's data

        Returns:
            Dictionary of school features
        """
        features = {}

        # Get most recent record
        latest = school_df.sort_values('ano').iloc[-1]

        # Porte (1-5)
        features['porte'] = latest.get('porte', 3) or 3

        # Localizacao (one-hot)
        loc = latest.get('localizacao', 'Urbana')
        features['localizacao_rural'] = 1 if loc == 'Rural' else 0

        # Tipo escola (one-hot)
        tipo = latest.get('tipo_escola', 'Pública')
        features['tipo_privada'] = 1 if tipo == 'Privada' else 0

        # Years of participation
        features['years_of_data'] = len(school_df)

        # Average historical ranking
        features['avg_historical_ranking'] = school_df['ranking_brasil'].mean()

        # Desempenho habilidades (if available)
        features['desempenho_habilidades'] = latest.get('desempenho_habilidades', np.nan)

        return features

    def create_skill_aggregate_features(self, codigo_inep: str) -> Dict[str, float]:
        """
        Create aggregated skill features for a school

        Args:
            codigo_inep: School INEP code

        Returns:
            Dictionary of skill aggregate features
        """
        features = {}

        # Default values if no skill data
        for area in ['cn', 'ch', 'lc', 'mt']:
            features[f'avg_skill_{area}'] = np.nan
            features[f'worst_skill_{area}'] = np.nan
            features[f'best_skill_{area}'] = np.nan
        features['skill_gap_count'] = np.nan

        # If we have school skills data, we could populate this
        # For now, use the overall desempenho_habilidades as proxy

        return features

    def create_tri_based_features(self, school_df: pd.DataFrame) -> Dict[str, float]:
        """
        Create TRI-based prediction features using content difficulty analysis.

        Maps school's score to expected TRI difficulty level they should master.

        Args:
            school_df: DataFrame with school's historical data

        Returns:
            Dictionary of TRI-based features
        """
        features = {}

        if self.tri_content_df is None or len(self.area_tri_stats) == 0:
            # Return default features if no TRI data
            for area in ['cn', 'ch', 'lc', 'mt']:
                features[f'tri_mastery_level_{area}'] = 0.5
                features[f'tri_gap_to_median_{area}'] = 0
                features[f'tri_potential_{area}'] = 0
            features['overall_tri_mastery'] = 0.5
            return features

        # Get most recent scores
        latest = school_df.sort_values('ano').iloc[-1]

        area_mapping = {
            'cn': ('nota_cn', 'CN'),
            'ch': ('nota_ch', 'CH'),
            'lc': ('nota_lc', 'LC'),
            'mt': ('nota_mt', 'MT')
        }

        mastery_levels = []

        for area_key, (score_col, area_code) in area_mapping.items():
            score = latest.get(score_col, 500)
            if pd.isna(score):
                score = 500

            if area_code in self.area_tri_stats:
                stats = self.area_tri_stats[area_code]

                # TRI Mastery Level: What percentage of TRI content can this school handle?
                # Score maps to TRI difficulty - higher score = can handle harder questions
                # Normalize to 0-1 range based on TRI distribution
                if stats['std'] > 0:
                    z_score = (score - stats['mean']) / stats['std']
                    # Convert z-score to percentile-like mastery (0-1)
                    mastery = 0.5 + 0.5 * np.tanh(z_score / 2)
                else:
                    mastery = 0.5
                features[f'tri_mastery_level_{area_key}'] = mastery
                mastery_levels.append(mastery)

                # Gap to median: How far is the school from median difficulty?
                gap_to_median = score - stats['p50']
                features[f'tri_gap_to_median_{area_key}'] = gap_to_median

                # TRI Potential: Room for improvement based on current position
                # Higher if currently below median, lower if already at top
                potential = max(0, (stats['p75'] - score) / (stats['p75'] - stats['p25'])) if stats['p75'] != stats['p25'] else 0
                features[f'tri_potential_{area_key}'] = potential

            else:
                features[f'tri_mastery_level_{area_key}'] = 0.5
                features[f'tri_gap_to_median_{area_key}'] = 0
                features[f'tri_potential_{area_key}'] = 0
                mastery_levels.append(0.5)

        # Overall TRI mastery (average across areas)
        features['overall_tri_mastery'] = np.mean(mastery_levels)

        return features

    def create_skill_gap_features(self, school_df: pd.DataFrame) -> Dict[str, float]:
        """
        Create features based on skill performance gaps vs national average.

        Args:
            school_df: DataFrame with school's historical data

        Returns:
            Dictionary of skill gap features
        """
        features = {}

        if self.skills_df is None:
            for area in ['cn', 'ch', 'lc', 'mt']:
                features[f'skill_gap_national_{area}'] = 0
                features[f'low_skill_count_{area}'] = 0
            features['total_weak_skills'] = 0
            return features

        # Get school's latest scores and estimate skill gaps
        latest = school_df.sort_values('ano').iloc[-1]

        area_mapping = {
            'cn': ('nota_cn', 'Ciências da Natureza'),
            'ch': ('nota_ch', 'Ciências Humanas'),
            'lc': ('nota_lc', 'Linguagens'),
            'mt': ('nota_mt', 'Matemática')
        }

        total_weak_skills = 0

        for area_key, (score_col, area_name) in area_mapping.items():
            score = latest.get(score_col, 500)
            if pd.isna(score):
                score = 500

            # Get national skill performance for this area
            area_skills = self.skills_df[self.skills_df['area'] == area_name]

            if len(area_skills) > 0:
                # National average skill performance (0-1)
                national_avg = area_skills['performance'].mean()

                # Estimate school's skill performance based on score
                # Score of 400 ~ 0.3 performance, 700 ~ 0.7 performance
                estimated_performance = (score - 350) / 500
                estimated_performance = max(0, min(1, estimated_performance))

                # Gap to national average
                gap = estimated_performance - national_avg
                features[f'skill_gap_national_{area_key}'] = gap

                # Count "weak" skills (below 40% threshold nationally)
                weak_skills = area_skills[area_skills['performance'] < 0.4]
                # If school is below national average, these weak skills are even weaker for them
                if gap < 0:
                    low_count = len(weak_skills) * (1 + abs(gap))
                else:
                    low_count = len(weak_skills) * (1 - gap * 0.5)
                features[f'low_skill_count_{area_key}'] = low_count
                total_weak_skills += low_count
            else:
                features[f'skill_gap_national_{area_key}'] = 0
                features[f'low_skill_count_{area_key}'] = 0

        features['total_weak_skills'] = total_weak_skills

        return features

    def estimate_tri_score_by_content(self, codigo_inep: str) -> Dict[str, float]:
        """
        Estimate what TRI score a school should achieve based on content mastery.

        This uses the GLiNER-extracted concepts to estimate skill coverage.

        Args:
            codigo_inep: School INEP code

        Returns:
            Dictionary with estimated TRI scores per area
        """
        estimates = {}

        if self.tri_content_df is None:
            return {'cn': 500, 'ch': 500, 'lc': 500, 'mt': 500}

        # Get school's historical performance
        school_df = self.df[self.df['codigo_inep'] == codigo_inep]
        if len(school_df) == 0:
            return {'cn': 500, 'ch': 500, 'lc': 500, 'mt': 500}

        latest = school_df.sort_values('ano').iloc[-1]

        area_mapping = {
            'cn': ('nota_cn', 'CN'),
            'ch': ('nota_ch', 'CH'),
            'lc': ('nota_lc', 'LC'),
            'mt': ('nota_mt', 'MT')
        }

        for area_key, (score_col, area_code) in area_mapping.items():
            current_score = latest.get(score_col, 500)
            if pd.isna(current_score):
                current_score = 500

            # Get TRI content for this area
            area_content = self.tri_content_df[self.tri_content_df['area_code'] == area_code]

            if len(area_content) > 0:
                # Find content items the school should be able to handle
                # (TRI score <= current score + margin)
                accessible = area_content[area_content['tri_score'] <= current_score + 50]

                # Estimate: if they master accessible content, they can reach slightly higher
                if len(accessible) > 0:
                    max_accessible = accessible['tri_score'].max()
                    # Potential score is weighted average of current and max accessible
                    potential = (current_score * 0.7 + max_accessible * 0.3)
                    estimates[area_key] = potential
                else:
                    estimates[area_key] = current_score
            else:
                estimates[area_key] = current_score

        return estimates

    def prepare_features_for_school(self, codigo_inep: str) -> Dict[str, float]:
        """
        Prepare all features for a single school

        Args:
            codigo_inep: School INEP code

        Returns:
            Dictionary with all features
        """
        school_df = self.df[self.df['codigo_inep'] == codigo_inep].copy()

        if len(school_df) == 0:
            return None

        features = {'codigo_inep': codigo_inep}

        # Add all feature types
        features.update(self.create_lagged_features(school_df))
        features.update(self.create_trend_features(school_df))
        features.update(self.create_school_features(school_df))
        features.update(self.create_skill_aggregate_features(codigo_inep))
        features.update(self.create_bayesian_consistency_features(school_df))
        features.update(self.create_tri_based_features(school_df))
        features.update(self.create_skill_gap_features(school_df))

        return features

    def create_bayesian_consistency_features(self, school_df: pd.DataFrame) -> Dict[str, float]:
        """
        Create Bayesian-inspired consistency features that capture the school's
        cognitive pattern — how stable and predictable the school's performance is.

        A school like Farias Brito that has been #1 for 7 years has a strong prior
        that should resist regression to the mean in predictions.

        Args:
            school_df: DataFrame with school's historical data (sorted by year)

        Returns:
            Dictionary of Bayesian consistency features
        """
        features = {}
        score_cols = ['nota_cn', 'nota_ch', 'nota_lc', 'nota_mt', 'nota_redacao', 'nota_media']
        school_df = school_df.sort_values('ano')

        n_years = len(school_df)
        features['n_years_history'] = n_years

        for col in score_cols:
            col_short = col.replace('nota_', '')
            values = school_df[col].dropna().values

            if len(values) >= 2:
                mean_score = np.mean(values)
                std_score = np.std(values)

                # Bayesian prior strength: more years + lower variance = stronger prior
                # High consistency = prediction should stay close to historical mean
                prior_strength = len(values) / (1 + std_score / max(mean_score, 1))
                features[f'bayesian_prior_strength_{col_short}'] = prior_strength

                # Coefficient of variation (lower = more consistent)
                features[f'cv_{col_short}'] = std_score / max(mean_score, 1)

                # Historical mean (strong predictor for consistent schools)
                features[f'historical_mean_{col_short}'] = mean_score

                # Historical min and max (defines the school's "range")
                features[f'historical_min_{col_short}'] = np.min(values)
                features[f'historical_max_{col_short}'] = np.max(values)

                # Percentile rank among all schools (latest year)
                # This captures the "tier" of the school
                latest_score = values[-1]
                all_latest = self.df[self.df['ano'] == school_df['ano'].max()][col].dropna()
                if len(all_latest) > 0:
                    percentile = (all_latest < latest_score).mean() * 100
                    features[f'percentile_rank_{col_short}'] = percentile
                else:
                    features[f'percentile_rank_{col_short}'] = 50

                # Consecutive years above national mean
                national_mean = self.df[col].mean()
                consecutive_above = 0
                for v in reversed(values):
                    if v > national_mean:
                        consecutive_above += 1
                    else:
                        break
                features[f'consecutive_above_mean_{col_short}'] = consecutive_above

            else:
                features[f'bayesian_prior_strength_{col_short}'] = 0
                features[f'cv_{col_short}'] = 1
                features[f'historical_mean_{col_short}'] = np.nan
                features[f'historical_min_{col_short}'] = np.nan
                features[f'historical_max_{col_short}'] = np.nan
                features[f'percentile_rank_{col_short}'] = 50
                features[f'consecutive_above_mean_{col_short}'] = 0

        return features

    def prepare_training_dataset(
        self,
        target_col: str = 'nota_media',
        min_years: int = 3,
        target_years: Optional[List[int]] = None,
        verbose: bool = False,
    ) -> pd.DataFrame:
        """Build the full temporal training dataset with metadata columns."""
        all_years = sorted(self.df['ano'].unique())
        if target_years is None:
            # Target years: every year from 2020 onwards (need at least 2 prior years)
            target_years = [y for y in all_years if y >= 2020]

        if verbose:
            print(f"Training with temporal pairs: {[(f'≤{y-1}', f'→{y}') for y in target_years]}")

        rows = []

        for target_year in target_years:
            # Get schools that have data for the target year
            target_year_df = self.df[self.df['ano'] == target_year]
            schools_with_target = target_year_df['codigo_inep'].unique()
            total_schools = max(len(schools_with_target), 1)

            for codigo_inep in schools_with_target:
                school_df = self.df[self.df['codigo_inep'] == codigo_inep]
                target_row = school_df[school_df['ano'] == target_year].iloc[0]

                # Get target value
                target_val = target_row[target_col]
                if pd.isna(target_val):
                    continue

                # Create features from data BEFORE target year
                train_df = school_df[school_df['ano'] < target_year]
                if len(train_df) < min_years - 1:
                    continue

                ranking_brasil = target_row.get('ranking_brasil')
                rank_percent = (
                    float(ranking_brasil) / total_schools
                    if pd.notna(ranking_brasil) and total_schools
                    else np.nan
                )

                features = {
                    'codigo_inep': codigo_inep,
                    '_target_year': target_year,
                    '_target_value': float(target_val),
                    '_ranking_brasil': float(ranking_brasil) if pd.notna(ranking_brasil) else np.nan,
                    '_rank_percent': rank_percent,
                }
                features.update(self.create_lagged_features(train_df))
                features.update(self.create_trend_features(train_df))
                features.update(self.create_school_features(train_df))
                features.update(self.create_bayesian_consistency_features(train_df))
                features.update(self.create_tri_based_features(train_df))
                features.update(self.create_skill_gap_features(train_df))

                rows.append(features)

        return pd.DataFrame(rows)

    def prepare_training_data(self, target_col: str = 'nota_media', min_years: int = 3) -> Tuple[pd.DataFrame, pd.Series]:
        """
        Prepare training data using ALL temporal pairs.

        Instead of only ≤2022→2023, uses every possible year pair:
          Uses every rolling train/target pair available in the loaded dataset

        This captures the full trajectory of each school and teaches the model
        that consistent top performers stay at the top.

        Args:
            target_col: Target column to predict
            min_years: Minimum years of data before target year

        Returns:
            X (features DataFrame), y (target Series), school_ids
        """
        dataset = self.prepare_training_dataset(
            target_col=target_col,
            min_years=min_years,
            verbose=True,
        )

        if dataset.empty:
            return pd.DataFrame(), pd.Series(name=target_col, dtype=float), pd.Series(dtype=object)

        # Drop non-feature columns
        meta_cols = ['codigo_inep', '_target_year', '_target_value', '_ranking_brasil', '_rank_percent']
        feature_cols = [c for c in dataset.columns if c not in meta_cols]
        X_features = dataset[feature_cols]
        y = dataset['_target_value']

        print(f"Training samples: {len(dataset)} (from {len(dataset['_target_year'].unique())} target years)")
        print(f"Features: {len(feature_cols)}")
        print(f"  Including Bayesian consistency features for school trajectory analysis")

        return X_features, y, dataset['codigo_inep']

    def compute_skill_tri_correlations(self) -> pd.DataFrame:
        """
        Compute correlation between each skill and TRI scores

        Returns:
            DataFrame with skill-TRI correlations
        """
        if self.skills_df is None:
            print("No skills data available")
            return None

        # For now, return skill performance as proxy for impact
        # In a full implementation, we'd join school skills with their TRI scores
        correlations = []

        for _, skill in self.skills_df.iterrows():
            # Higher performance = easier skill = lower impact on differentiation
            # So we invert: low performance = high impact
            impact = 1 - skill['performance']

            correlations.append({
                'area': skill['area'],
                'skill_num': skill['skill_num'],
                'performance': skill['performance'],
                'impact_score': impact,
                'descricao': skill.get('descricao', '')
            })

        return pd.DataFrame(correlations)

    def get_peer_schools(self, codigo_inep: str, year: Optional[int] = None) -> pd.DataFrame:
        """
        Get peer schools (same porte, tipo_escola) for comparison

        Args:
            codigo_inep: Target school INEP code
            year: Year for comparison. Defaults to the latest available year.

        Returns:
            DataFrame of peer schools
        """
        comparison_year = year or get_latest_year_from_df(self.df)
        if comparison_year is None:
            return pd.DataFrame()

        school_data = self.df[(self.df['codigo_inep'] == codigo_inep) & (self.df['ano'] == comparison_year)]

        if len(school_data) == 0:
            return pd.DataFrame()

        school = school_data.iloc[0]
        porte = school.get('porte')
        tipo = school.get('tipo_escola')

        # Find peers
        peers = self.df[
            (self.df['ano'] == comparison_year) &
            (self.df['porte'] == porte) &
            (self.df['tipo_escola'] == tipo) &
            (self.df['codigo_inep'] != codigo_inep)
        ]

        return peers

    def get_top_peers(self, codigo_inep: str, year: Optional[int] = None, percentile: float = 0.8) -> pd.DataFrame:
        """
        Get top performing peer schools as benchmark

        Args:
            codigo_inep: Target school INEP code
            year: Year for comparison. Defaults to the latest available year.
            percentile: Top percentile to consider (0.8 = top 20%)

        Returns:
            DataFrame of top peer schools
        """
        peers = self.get_peer_schools(codigo_inep, year)

        if len(peers) == 0:
            return pd.DataFrame()

        # Get top percentile
        threshold = peers['nota_media'].quantile(percentile)
        top_peers = peers[peers['nota_media'] >= threshold]

        return top_peers


if __name__ == "__main__":
    # Test the preprocessor
    preprocessor = ENEMPreprocessor()

    # Test feature creation for a school
    test_school = preprocessor.df['codigo_inep'].iloc[0]
    features = preprocessor.prepare_features_for_school(test_school)
    print(f"\nFeatures for {test_school}:")
    for k, v in features.items():
        print(f"  {k}: {v}")

    # Test training data preparation
    X, y, school_ids = preprocessor.prepare_training_data('nota_media')
    print(f"\nTraining data shape: X={X.shape}, y={y.shape}")

    # Test correlations
    corr = preprocessor.compute_skill_tri_correlations()
    if corr is not None:
        print(f"\nSkill correlations shape: {corr.shape}")
        print(corr.head())
