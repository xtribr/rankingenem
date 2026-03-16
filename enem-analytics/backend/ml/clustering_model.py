"""
Clustering model for ENEM school personas
Groups schools by their TRI score profiles
"""

import pandas as pd
import numpy as np
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import joblib
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import silhouette_score

from data.year_resolver import (
    find_latest_enem_results_file,
    get_latest_year_from_df,
    get_previous_year_from_df,
)


class SchoolClusteringModel:
    """K-Means clustering for school personas based on TRI scores"""

    # Persona descriptions
    PERSONA_DESCRIPTIONS = {
        0: {
            'name': 'Excelência Geral',
            'description': 'Alto desempenho em todas as áreas',
            'color': '#10B981'  # Green
        },
        1: {
            'name': 'Foco em Humanas',
            'description': 'Forte em Ciências Humanas e Linguagens',
            'color': '#8B5CF6'  # Purple
        },
        2: {
            'name': 'Foco em Exatas',
            'description': 'Forte em Matemática e Ciências da Natureza',
            'color': '#3B82F6'  # Blue
        },
        3: {
            'name': 'Desempenho Médio',
            'description': 'Notas próximas à média em todas as áreas',
            'color': '#F59E0B'  # Amber
        },
        4: {
            'name': 'Em Desenvolvimento',
            'description': 'Abaixo da média, com potencial de melhoria',
            'color': '#EF4444'  # Red
        },
        5: {
            'name': 'Excelência em Redação',
            'description': 'Destaque em Redação com outras áreas medianas',
            'color': '#EC4899'  # Pink
        },
        6: {
            'name': 'Balanceado Superior',
            'description': 'Acima da média de forma equilibrada',
            'color': '#06B6D4'  # Cyan
        },
        7: {
            'name': 'Potencial Técnico',
            'description': 'Bom em exatas, precisa melhorar em linguagens',
            'color': '#6366F1'  # Indigo
        }
    }

    def __init__(self, n_clusters: int = 8, model_dir: str = None):
        if model_dir is None:
            model_dir = Path(__file__).parent.parent / "models"
        self.model_dir = Path(model_dir)
        self.model_dir.mkdir(exist_ok=True)

        self.n_clusters = n_clusters
        self.model = None
        self.scaler = None
        self.cluster_centers = None
        self.df = None

        # Feature columns for clustering
        self.feature_cols = ['nota_cn', 'nota_ch', 'nota_lc', 'nota_mt', 'nota_redacao']

    def _load_data(self) -> pd.DataFrame:
        """Load ENEM data"""
        data_path = find_latest_enem_results_file(self.model_dir.parent / "data")
        if data_path is None or not data_path.exists():
            return pd.DataFrame()

        df = pd.read_csv(data_path)
        df['codigo_inep'] = df['codigo_inep'].astype(str)
        return df

    def train(self, year: Optional[int] = None) -> Dict:
        """
        Train K-Means clustering model

        Args:
            year: Year to use for training. Defaults to the latest available cycle.

        Returns:
            Training metrics
        """
        self.df = self._load_data()
        if len(self.df) == 0:
            return {'error': 'No data available'}

        training_year = year or get_latest_year_from_df(self.df)
        if training_year is None:
            return {'error': 'No valid ENEM year found in dataset'}

        # Filter to specified year
        df_year = self.df[self.df['ano'] == training_year].copy()

        # Get feature matrix
        X = df_year[self.feature_cols].dropna()
        school_ids = df_year.loc[X.index, 'codigo_inep'].values

        if len(X) < 100:
            return {'error': 'Not enough data points'}

        # Scale features
        self.scaler = StandardScaler()
        X_scaled = self.scaler.fit_transform(X)

        # Train K-Means
        self.model = KMeans(
            n_clusters=self.n_clusters,
            random_state=42,
            n_init=10
        )
        clusters = self.model.fit_predict(X_scaled)

        # Store cluster centers (unscaled)
        self.cluster_centers = self.scaler.inverse_transform(self.model.cluster_centers_)

        # Calculate metrics
        silhouette = silhouette_score(X_scaled, clusters)

        # Assign personas based on cluster characteristics
        self._assign_personas()

        # Create cluster summary
        cluster_summary = []
        for i in range(self.n_clusters):
            mask = clusters == i
            cluster_data = X.iloc[mask]

            cluster_summary.append({
                'cluster': i,
                'size': int(mask.sum()),
                'mean_scores': {
                    col: round(cluster_data[col].mean(), 1)
                    for col in self.feature_cols
                },
                'persona': self.PERSONA_DESCRIPTIONS.get(i, {})
            })

        # Save model
        model_path = self.model_dir / "clustering_model.joblib"
        joblib.dump({
            'model': self.model,
            'scaler': self.scaler,
            'cluster_centers': self.cluster_centers,
            'n_clusters': self.n_clusters,
            'feature_cols': self.feature_cols,
            'personas': self.PERSONA_DESCRIPTIONS
        }, model_path)

        return {
            'year': training_year,
            'n_clusters': self.n_clusters,
            'n_samples': len(X),
            'silhouette_score': round(silhouette, 3),
            'cluster_summary': cluster_summary
        }

    def _assign_personas(self):
        """Assign persona descriptions based on cluster characteristics"""
        if self.cluster_centers is None:
            return

        # Analyze each cluster's strengths
        for i, center in enumerate(self.cluster_centers):
            # Find dominant area
            max_idx = np.argmax(center)
            min_idx = np.argmin(center)

            avg_score = np.mean(center)

            # Update persona based on characteristics
            if avg_score > 650:  # High performers
                if center[4] > 800:  # High redação
                    self.PERSONA_DESCRIPTIONS[i] = {
                        'name': 'Excelência em Redação',
                        'description': f'Destaque em Redação ({center[4]:.0f}) com excelente desempenho geral',
                        'color': '#EC4899'
                    }
                elif center[3] > 700:  # High MT
                    self.PERSONA_DESCRIPTIONS[i] = {
                        'name': 'Excelência em Exatas',
                        'description': f'Destaque em Matemática ({center[3]:.0f}) e Ciências',
                        'color': '#3B82F6'
                    }
                else:
                    self.PERSONA_DESCRIPTIONS[i] = {
                        'name': 'Excelência Geral',
                        'description': 'Alto desempenho equilibrado em todas as áreas',
                        'color': '#10B981'
                    }
            elif avg_score > 550:  # Above average
                self.PERSONA_DESCRIPTIONS[i] = {
                    'name': 'Desempenho Superior',
                    'description': 'Acima da média nacional de forma consistente',
                    'color': '#06B6D4'
                }
            elif avg_score > 480:  # Average
                self.PERSONA_DESCRIPTIONS[i] = {
                    'name': 'Desempenho Médio',
                    'description': 'Próximo à média nacional',
                    'color': '#F59E0B'
                }
            else:  # Below average
                self.PERSONA_DESCRIPTIONS[i] = {
                    'name': 'Em Desenvolvimento',
                    'description': 'Abaixo da média, com oportunidades de melhoria',
                    'color': '#EF4444'
                }

    def load_model(self) -> bool:
        """Load trained model from disk"""
        model_path = self.model_dir / "clustering_model.joblib"
        if not model_path.exists():
            return False

        data = joblib.load(model_path)
        self.model = data['model']
        self.scaler = data['scaler']
        self.cluster_centers = data['cluster_centers']
        self.n_clusters = data['n_clusters']
        self.feature_cols = data['feature_cols']

        if 'personas' in data:
            self.PERSONA_DESCRIPTIONS = data['personas']

        return True

    def predict_cluster(self, codigo_inep: str) -> Optional[Dict]:
        """
        Predict cluster for a school

        Args:
            codigo_inep: School INEP code

        Returns:
            Cluster information or None
        """
        if self.model is None:
            if not self.load_model():
                return None

        if self.df is None:
            self.df = self._load_data()

        # Get school data
        school_data = self.df[self.df['codigo_inep'] == codigo_inep]
        if len(school_data) == 0:
            return None

        latest = school_data.sort_values('ano').iloc[-1]

        # Check if we have all features
        if any(pd.isna(latest[col]) for col in self.feature_cols):
            return None

        # Get features
        X = np.array([[latest[col] for col in self.feature_cols]])
        X_scaled = self.scaler.transform(X)

        # Predict cluster
        cluster = self.model.predict(X_scaled)[0]

        # Get persona info
        persona = self.PERSONA_DESCRIPTIONS.get(cluster, {})

        # Calculate distance to cluster center
        center = self.cluster_centers[cluster]
        distance = np.sqrt(np.sum((X[0] - center) ** 2))

        return {
            'codigo_inep': codigo_inep,
            'cluster': int(cluster),
            'persona': persona,
            'scores': {
                col: round(float(latest[col]), 1)
                for col in self.feature_cols
            },
            'cluster_center': {
                col: round(float(center[i]), 1)
                for i, col in enumerate(self.feature_cols)
            },
            'distance_to_center': round(float(distance), 1)
        }

    def get_similar_schools(
        self,
        codigo_inep: str,
        limit: int = 10,
        same_cluster: bool = True
    ) -> List[Dict]:
        """
        Find schools similar to the given school

        Args:
            codigo_inep: School INEP code
            limit: Maximum number of similar schools
            same_cluster: Only include schools from same cluster

        Returns:
            List of similar schools
        """
        cluster_info = self.predict_cluster(codigo_inep)
        if cluster_info is None:
            return []

        if self.df is None:
            self.df = self._load_data()

        latest_year = get_latest_year_from_df(self.df)
        if latest_year is None:
            return []

        df_latest = self.df[self.df['ano'] == latest_year].copy()

        # Get school features
        school_scores = np.array([cluster_info['scores'][col] for col in self.feature_cols])

        # Calculate distances to all schools
        distances = []
        for _, row in df_latest.iterrows():
            if row['codigo_inep'] == codigo_inep:
                continue

            if any(pd.isna(row[col]) for col in self.feature_cols):
                continue

            other_scores = np.array([row[col] for col in self.feature_cols])
            dist = np.sqrt(np.sum((school_scores - other_scores) ** 2))

            # If same_cluster, predict cluster
            if same_cluster:
                X_scaled = self.scaler.transform([other_scores])
                other_cluster = self.model.predict(X_scaled)[0]
                if other_cluster != cluster_info['cluster']:
                    continue

            distances.append({
                'codigo_inep': row['codigo_inep'],
                'nome_escola': row.get('nome_escola', 'Unknown'),
                'distance': dist,
                'scores': {col: round(float(row[col]), 1) for col in self.feature_cols},
                'porte': row.get('porte'),
                'tipo_escola': row.get('tipo_escola')
            })

        # Sort by distance
        distances.sort(key=lambda x: x['distance'])

        return distances[:limit]

    def get_improved_similar_schools(
        self,
        codigo_inep: str,
        limit: int = 10,
        min_improvement: float = 10.0
    ) -> List[Dict]:
        """
        Find similar schools that improved significantly

        Args:
            codigo_inep: School INEP code
            limit: Maximum number of schools
            min_improvement: Minimum improvement in nota_media

        Returns:
            List of similar schools that improved
        """
        cluster_info = self.predict_cluster(codigo_inep)
        if cluster_info is None:
            return []

        if self.df is None:
            self.df = self._load_data()

        # Get school features
        school_scores = np.array([cluster_info['scores'][col] for col in self.feature_cols])

        latest_year = get_latest_year_from_df(self.df)
        previous_year = get_previous_year_from_df(self.df, latest_year)
        if latest_year is None or previous_year is None:
            return []

        # Find schools with improvement
        improved_schools = []

        # Group by school
        for inep, group in self.df.groupby('codigo_inep'):
            if inep == codigo_inep:
                continue

            if len(group) < 2:
                continue

            group = group.sort_values('ano')

            # Need both the latest available year and the previous year.
            if latest_year not in group['ano'].values or previous_year not in group['ano'].values:
                continue

            data_previous = group[group['ano'] == previous_year].iloc[0]
            data_latest = group[group['ano'] == latest_year].iloc[0]

            if pd.isna(data_previous['nota_media']) or pd.isna(data_latest['nota_media']):
                continue

            improvement = data_latest['nota_media'] - data_previous['nota_media']

            if improvement < min_improvement:
                continue

            # Check similarity (using 2023 scores for comparison)
            if any(pd.isna(data_previous[col]) for col in self.feature_cols):
                continue

            other_scores_previous = np.array([data_previous[col] for col in self.feature_cols])
            dist = np.sqrt(np.sum((school_scores - other_scores_previous) ** 2))

            # Only include reasonably similar schools
            if dist > 150:  # Max distance threshold
                continue

            improved_schools.append({
                'codigo_inep': inep,
                'nome_escola': data_latest.get('nome_escola', 'Unknown'),
                'similarity_distance': round(float(dist), 1),
                'improvement': round(float(improvement), 1),
                'comparison_years': {
                    'previous': previous_year,
                    'current': latest_year,
                },
                'scores_previous': {col: round(float(data_previous[col]), 1) for col in self.feature_cols},
                'scores_current': {col: round(float(data_latest[col]), 1) for col in self.feature_cols},
                'tipo_escola': data_latest.get('tipo_escola'),
                'porte': data_latest.get('porte')
            })

        # Sort by improvement
        improved_schools.sort(key=lambda x: x['improvement'], reverse=True)

        return improved_schools[:limit]

    def get_cluster_summary(self) -> List[Dict]:
        """Get summary of all clusters"""
        if self.model is None:
            if not self.load_model():
                return []

        if self.df is None:
            self.df = self._load_data()

        latest_year = get_latest_year_from_df(self.df)
        if latest_year is None:
            return []

        df_latest = self.df[self.df['ano'] == latest_year]

        summaries = []
        for i in range(self.n_clusters):
            center = self.cluster_centers[i]
            persona = self.PERSONA_DESCRIPTIONS.get(i, {})

            summaries.append({
                'cluster': i,
                'persona': persona,
                'center_scores': {
                    col: round(float(center[j]), 1)
                    for j, col in enumerate(self.feature_cols)
                },
                'avg_media': round(float(np.mean(center[:4])), 1)  # Exclude redação for avg
            })

        return summaries


if __name__ == "__main__":
    # Train clustering model
    model = SchoolClusteringModel(n_clusters=8)
    result = model.train()

    print("\nClustering Training Results:")
    print(f"  Samples: {result.get('n_samples')}")
    print(f"  Silhouette Score: {result.get('silhouette_score')}")

    print("\nCluster Summary:")
    for cluster in result.get('cluster_summary', []):
        persona = cluster.get('persona', {})
        print(f"  Cluster {cluster['cluster']}: {persona.get('name', 'Unknown')}")
        print(f"    Size: {cluster['size']}")
        print(f"    Mean scores: {cluster['mean_scores']}")

    # Test prediction
    print("\n" + "=" * 60)
    test_school = "21009902"
    prediction = model.predict_cluster(test_school)
    if prediction:
        print(f"School {test_school}:")
        print(f"  Cluster: {prediction['cluster']}")
        print(f"  Persona: {prediction['persona'].get('name')}")
