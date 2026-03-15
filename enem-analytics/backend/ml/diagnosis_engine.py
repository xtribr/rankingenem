"""
Diagnosis engine for ENEM school skill analysis
Identifies gaps and prioritizes improvements based on TRI scores
"""

import pandas as pd
import numpy as np
from pathlib import Path
from typing import Dict, List, Optional


class DiagnosisEngine:
    """Engine for diagnosing school performance gaps and priorities"""

    # Area descriptions
    AREA_DESCRIPTIONS = {
        'CN': 'Ciências da Natureza',
        'CH': 'Ciências Humanas',
        'LC': 'Linguagens e Códigos',
        'MT': 'Matemática',
        'redacao': 'Redação'
    }

    # TRI column mapping
    AREA_TO_TRI = {
        'CN': 'nota_cn',
        'CH': 'nota_ch',
        'LC': 'nota_lc',
        'MT': 'nota_mt',
        'redacao': 'nota_redacao'
    }

    def __init__(self, data_dir: str = None):
        if data_dir is None:
            data_dir = Path(__file__).parent.parent / "data"
        self.data_dir = Path(data_dir)

        # Load skill averages (national)
        self.skill_averages = self._load_skill_averages()

        # Load school data
        self.df = self._load_school_data()

        # Compute area statistics
        self.area_stats = self._compute_area_stats()

    def _load_skill_averages(self) -> Dict[str, float]:
        """Load national skill averages from habilidades_2024.csv"""
        path = self.data_dir / "habilidades_2024.csv"
        if not path.exists():
            return {}

        df = pd.read_csv(path)

        averages = {}
        for _, row in df.iterrows():
            skill_code = f"{row['area']}_H{int(row['skill_num'])}"
            # Convert from 0-1 to 0-100 percentage
            averages[skill_code] = row['performance'] * 100

        return averages

    def _load_school_data(self) -> pd.DataFrame:
        """Load ENEM school data"""
        path = self.data_dir / "enem_2018_2024_completo.csv"
        if not path.exists():
            return pd.DataFrame()

        df = pd.read_csv(path)
        df['codigo_inep'] = df['codigo_inep'].astype(str)
        return df

    def _compute_area_stats(self) -> Dict[str, Dict]:
        """Compute statistics for each area"""
        if len(self.df) == 0:
            return {}

        df_2024 = self.df[self.df['ano'] == 2024]

        stats = {}
        for area, col in self.AREA_TO_TRI.items():
            if col in df_2024.columns:
                values = df_2024[col].dropna()
                stats[area] = {
                    'mean': values.mean(),
                    'std': values.std(),
                    'median': values.median(),
                    'p25': values.quantile(0.25),
                    'p75': values.quantile(0.75),
                    'p90': values.quantile(0.90)
                }

        return stats

    def get_school_info(self, codigo_inep: str) -> Optional[Dict]:
        """Get school information"""
        school_data = self.df[self.df['codigo_inep'] == codigo_inep]
        if len(school_data) == 0:
            return None

        latest = school_data.sort_values('ano').iloc[-1]
        return {
            'codigo_inep': codigo_inep,
            'nome_escola': latest.get('nome_escola', 'Unknown'),
            'porte': latest.get('porte'),
            'tipo_escola': latest.get('tipo_escola'),
            'localizacao': latest.get('localizacao'),
            'ano': int(latest['ano'])
        }

    def get_peer_stats(self, codigo_inep: str) -> Dict[str, Dict]:
        """Get statistics for peer schools (same porte)"""
        school_info = self.get_school_info(codigo_inep)
        if not school_info:
            return self.area_stats

        porte = school_info.get('porte')
        if not porte:
            return self.area_stats

        df_2024 = self.df[self.df['ano'] == 2024]
        peers = df_2024[df_2024['porte'] == porte]

        if len(peers) < 30:
            return self.area_stats

        stats = {}
        for area, col in self.AREA_TO_TRI.items():
            if col in peers.columns:
                values = peers[col].dropna()
                stats[area] = {
                    'mean': values.mean(),
                    'std': values.std(),
                    'median': values.median(),
                    'p25': values.quantile(0.25),
                    'p75': values.quantile(0.75),
                    'p90': values.quantile(0.90),
                    'count': len(values)
                }

        return stats

    def diagnose(self, codigo_inep: str) -> Dict:
        """
        Generate comprehensive diagnosis for a school

        Returns:
            Dictionary with diagnosis results including:
            - Overall health assessment
            - Area-by-area analysis
            - Peer comparison
            - Priorities for improvement
        """
        school_info = self.get_school_info(codigo_inep)
        if not school_info:
            return {'error': 'School not found', 'codigo_inep': codigo_inep}

        # Get school's TRI scores
        school_data = self.df[
            (self.df['codigo_inep'] == codigo_inep) &
            (self.df['ano'] == school_info['ano'])
        ].iloc[0]

        # Get peer and national stats
        peer_stats = self.get_peer_stats(codigo_inep)
        national_stats = self.area_stats

        # Analyze each area
        area_analysis = []
        for area, col in self.AREA_TO_TRI.items():
            if col not in school_data or pd.isna(school_data[col]):
                continue

            school_score = school_data[col]
            national = national_stats.get(area, {})
            peer = peer_stats.get(area, {})

            national_mean = national.get('mean', 500)
            peer_mean = peer.get('mean', 500)
            peer_std = peer.get('std', 50)

            # Calculate gaps
            gap_to_national = school_score - national_mean
            gap_to_peer = school_score - peer_mean

            # Calculate percentile position
            if peer_std > 0:
                z_score = (school_score - peer_mean) / peer_std
            else:
                z_score = 0

            # Determine status
            if z_score >= 1:
                status = 'excellent'
            elif z_score >= 0:
                status = 'good'
            elif z_score >= -1:
                status = 'needs_attention'
            else:
                status = 'critical'

            # Priority score (higher = needs more attention)
            priority = -z_score  # Negative z-scores become positive priorities

            area_analysis.append({
                'area': area,
                'area_name': self.AREA_DESCRIPTIONS.get(area, area),
                'school_score': round(school_score, 1),
                'national_avg': round(national_mean, 1),
                'peer_avg': round(peer_mean, 1),
                'gap_to_national': round(gap_to_national, 1),
                'gap_to_peer': round(gap_to_peer, 1),
                'z_score': round(z_score, 2),
                'status': status,
                'priority_score': round(priority, 2)
            })

        # Sort by priority
        area_analysis.sort(key=lambda x: x['priority_score'], reverse=True)

        # Overall assessment
        if not area_analysis:
            return {
                'codigo_inep': codigo_inep,
                'error': 'Dados insuficientes para diagnóstico. A escola não possui notas registradas.',
                'overall_health': 'insufficient_data',
                'area_analysis': [],
                'skill_gaps': [],
            }

        avg_z = np.mean([a['z_score'] for a in area_analysis])
        critical_count = len([a for a in area_analysis if a['status'] == 'critical'])
        excellent_count = len([a for a in area_analysis if a['status'] == 'excellent'])

        if avg_z >= 1 and critical_count == 0:
            overall_health = 'excellent'
        elif avg_z >= 0 and critical_count == 0:
            overall_health = 'good'
        elif critical_count <= 1:
            overall_health = 'needs_attention'
        else:
            overall_health = 'critical'

        # Get skill-level data if available
        skill_gaps = self._get_skill_gaps(area_analysis)

        return {
            'codigo_inep': codigo_inep,
            'school_info': school_info,
            'overall_health': overall_health,
            'health_summary': {
                'avg_z_score': round(avg_z, 2),
                'critical_areas': critical_count,
                'excellent_areas': excellent_count,
                'total_areas': len(area_analysis)
            },
            'area_analysis': area_analysis,
            'priority_areas': [a for a in area_analysis if a['priority_score'] > 0],
            'strengths': [a for a in area_analysis if a['z_score'] > 0.5],
            'skill_gaps': skill_gaps,
            'peer_comparison': {
                'comparison_group': school_info.get('porte', 'all'),
                'peer_count': peer_stats.get('CN', {}).get('count', 0)
            }
        }

    def _get_skill_gaps(self, area_analysis: List[Dict]) -> List[Dict]:
        """Get skill-level gaps based on national averages"""
        if not self.skill_averages:
            return []

        gaps = []
        for area_info in area_analysis:
            area = area_info['area']
            if area == 'redacao':
                continue  # Redação doesn't have skills

            # Use area z-score to estimate skill performance
            z_score = area_info['z_score']

            for skill_code, national_avg in self.skill_averages.items():
                if skill_code.startswith(area + '_H'):
                    try:
                        skill_num = int(skill_code.split('_H')[1])
                    except (ValueError, IndexError):
                        continue

                    # Estimate school skill from area performance
                    # Adjust by area z-score (simplified model)
                    estimated = national_avg + (z_score * 10)  # ±10% adjustment per z-score

                    gap = estimated - national_avg

                    # Skills that are below national average for weak areas
                    # are the highest priority
                    if national_avg < 50 and z_score < 0:
                        priority = abs(gap) * (50 - national_avg) / 50
                    else:
                        priority = 0

                    gaps.append({
                        'skill_code': skill_code,
                        'area': area,
                        'skill_number': skill_num,
                        'national_avg': round(national_avg, 1),
                        'estimated_school': round(estimated, 1),
                        'gap': round(gap, 1),
                        'priority_score': round(priority, 2)
                    })

        # Sort by priority
        gaps.sort(key=lambda x: x['priority_score'], reverse=True)
        return gaps[:30]  # Top 30 priority skills

    def get_improvement_potential(self, codigo_inep: str) -> Dict:
        """
        Calculate potential improvement if weak areas reach peer average

        Returns:
            Potential score improvements by area
        """
        diagnosis = self.diagnose(codigo_inep)
        if 'error' in diagnosis:
            return diagnosis

        improvements = []
        for area in diagnosis['area_analysis']:
            if area['gap_to_peer'] < 0:
                improvements.append({
                    'area': area['area'],
                    'area_name': area['area_name'],
                    'current_score': area['school_score'],
                    'peer_avg': area['peer_avg'],
                    'potential_gain': abs(area['gap_to_peer']),
                    'effort_level': 'high' if area['gap_to_peer'] < -30 else 'medium'
                })

        # Calculate overall improvement
        total_potential = sum(i['potential_gain'] for i in improvements)

        return {
            'codigo_inep': codigo_inep,
            'improvements': improvements,
            'total_potential_gain': round(total_potential / len(improvements) if improvements else 0, 1),
            'priority_area': improvements[0]['area'] if improvements else None
        }

    def compare_schools(self, codigo_inep_1: str, codigo_inep_2: str) -> Dict:
        """Compare two schools"""
        diag1 = self.diagnose(codigo_inep_1)
        diag2 = self.diagnose(codigo_inep_2)

        if 'error' in diag1:
            return diag1
        if 'error' in diag2:
            return diag2

        comparison = []
        for area1 in diag1['area_analysis']:
            area2 = next((a for a in diag2['area_analysis'] if a['area'] == area1['area']), None)
            if area2:
                comparison.append({
                    'area': area1['area'],
                    'area_name': area1['area_name'],
                    'school_1_score': area1['school_score'],
                    'school_2_score': area2['school_score'],
                    'difference': round(area1['school_score'] - area2['school_score'], 1),
                    'school_1_status': area1['status'],
                    'school_2_status': area2['status']
                })

        return {
            'school_1': {
                'codigo_inep': codigo_inep_1,
                'info': diag1['school_info'],
                'overall_health': diag1['overall_health']
            },
            'school_2': {
                'codigo_inep': codigo_inep_2,
                'info': diag2['school_info'],
                'overall_health': diag2['overall_health']
            },
            'area_comparison': comparison,
            'winner_by_area': {
                c['area']: codigo_inep_1 if c['difference'] > 0 else codigo_inep_2
                for c in comparison if c['difference'] != 0
            }
        }


if __name__ == "__main__":
    # Test the diagnosis engine
    engine = DiagnosisEngine()

    print(f"Loaded {len(engine.skill_averages)} skill averages")
    print(f"Loaded {len(engine.df)} school records")
    print(f"Area stats: {list(engine.area_stats.keys())}")

    # Test diagnosis
    test_school = "21009902"
    diagnosis = engine.diagnose(test_school)

    print(f"\nDiagnosis for {test_school}:")
    print(f"  Overall health: {diagnosis.get('overall_health')}")
    print(f"  Areas analyzed: {len(diagnosis.get('area_analysis', []))}")

    for area in diagnosis.get('area_analysis', []):
        print(f"  {area['area']}: {area['school_score']:.0f} (z={area['z_score']:.2f}, {area['status']})")
