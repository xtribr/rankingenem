"""
Recommendation Engine for ENEM Analytics
Generates evidence-based recommendations with success stories and roadmaps
"""

import pandas as pd
import numpy as np
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass


@dataclass
class Recommendation:
    """A single recommendation with evidence"""
    area: str
    area_name: str
    priority: float
    current_score: float
    target_score: float
    expected_gain: float
    difficulty: str
    evidence: Dict
    action_items: List[str]


class RecommendationEngine:
    """
    Generates personalized recommendations for schools based on:
    1. Gap analysis (where they are vs where they should be)
    2. Success stories (what similar schools did to improve)
    3. Impact analysis (which improvements give best ROI)
    """

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

        # Load data
        self.df = self._load_school_data()
        self.skill_averages = self._load_skill_averages()

        # Precompute statistics
        self.area_stats = self._compute_area_stats()
        self.improvement_patterns = self._analyze_improvement_patterns()

    def _load_school_data(self) -> pd.DataFrame:
        """Load ENEM school data"""
        path = self.data_dir / "enem_2018_2024_completo.csv"
        if not path.exists():
            return pd.DataFrame()

        df = pd.read_csv(path)
        df['codigo_inep'] = df['codigo_inep'].astype(str)
        return df

    def _load_skill_averages(self) -> Dict[str, float]:
        """Load national skill averages"""
        path = self.data_dir / "habilidades_2024.csv"
        if not path.exists():
            return {}

        df = pd.read_csv(path)
        averages = {}
        for _, row in df.iterrows():
            skill_code = f"{row['area']}_H{int(row['skill_num'])}"
            averages[skill_code] = row['performance'] * 100
        return averages

    def _compute_area_stats(self) -> Dict[str, Dict]:
        """Compute statistics by area"""
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
                    'p50': values.quantile(0.50),
                    'p75': values.quantile(0.75),
                    'p90': values.quantile(0.90),
                    'p95': values.quantile(0.95)
                }
        return stats

    def _analyze_improvement_patterns(self) -> Dict:
        """Analyze how schools improved between years"""
        if len(self.df) == 0:
            return {}

        patterns = {
            'avg_improvements': {},
            'top_improvers': {},
            'improvement_correlations': {}
        }

        # Calculate improvements between 2023 and 2024
        schools_2023 = self.df[self.df['ano'] == 2023].set_index('codigo_inep')
        schools_2024 = self.df[self.df['ano'] == 2024].set_index('codigo_inep')

        common_schools = schools_2023.index.intersection(schools_2024.index)

        if len(common_schools) < 100:
            return patterns

        for area, col in self.AREA_TO_TRI.items():
            if col not in schools_2023.columns:
                continue

            improvements = []
            for school in common_schools:
                score_2023 = schools_2023.loc[school, col]
                score_2024 = schools_2024.loc[school, col]

                if pd.notna(score_2023) and pd.notna(score_2024):
                    improvements.append({
                        'school': school,
                        'score_2023': score_2023,
                        'score_2024': score_2024,
                        'improvement': score_2024 - score_2023
                    })

            if improvements:
                patterns['avg_improvements'][area] = np.mean([i['improvement'] for i in improvements])

                # Top improvers
                sorted_improvements = sorted(improvements, key=lambda x: x['improvement'], reverse=True)
                patterns['top_improvers'][area] = sorted_improvements[:100]

        return patterns

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

    def _find_similar_improved_schools(
        self,
        codigo_inep: str,
        min_improvement: float = 15.0,
        max_distance: float = 100.0
    ) -> List[Dict]:
        """Find schools that were similar and improved"""
        school_info = self.get_school_info(codigo_inep)
        if not school_info:
            return []

        # Get current school scores
        school_data = self.df[
            (self.df['codigo_inep'] == codigo_inep) &
            (self.df['ano'] == school_info['ano'])
        ]
        if len(school_data) == 0:
            return []

        school_row = school_data.iloc[0]
        school_scores = {
            area: school_row.get(col)
            for area, col in self.AREA_TO_TRI.items()
        }

        # Find similar schools that improved
        improved_schools = []

        schools_2023 = self.df[self.df['ano'] == 2023].set_index('codigo_inep')
        schools_2024 = self.df[self.df['ano'] == 2024].set_index('codigo_inep')

        for school_id in schools_2023.index.intersection(schools_2024.index):
            if school_id == codigo_inep:
                continue

            data_2023 = schools_2023.loc[school_id]
            data_2024 = schools_2024.loc[school_id]

            # Calculate improvement
            if pd.isna(data_2023.get('nota_media')) or pd.isna(data_2024.get('nota_media')):
                continue

            improvement = data_2024['nota_media'] - data_2023['nota_media']
            if improvement < min_improvement:
                continue

            # Calculate similarity (using 2023 scores compared to current school)
            distance = 0
            for area, col in self.AREA_TO_TRI.items():
                if pd.notna(school_scores.get(area)) and pd.notna(data_2023.get(col)):
                    distance += (school_scores[area] - data_2023[col]) ** 2
            distance = np.sqrt(distance)

            if distance > max_distance:
                continue

            # Calculate score changes by area
            area_changes = {}
            for area, col in self.AREA_TO_TRI.items():
                if pd.notna(data_2023.get(col)) and pd.notna(data_2024.get(col)):
                    area_changes[area] = {
                        'before': round(float(data_2023[col]), 1),
                        'after': round(float(data_2024[col]), 1),
                        'change': round(float(data_2024[col] - data_2023[col]), 1)
                    }

            # Normalize similarity: 100% = identical, 0% = very different
            # Using exponential decay: similarity = 100 * exp(-distance/scale)
            # Scale of 100 means distance of 100 gives ~37% similarity
            similarity = 100 * np.exp(-distance / 100)

            improved_schools.append({
                'codigo_inep': school_id,
                'nome_escola': data_2024.get('nome_escola', 'Unknown'),
                'similarity_score': round(float(similarity), 1),
                'improvement': round(float(improvement), 1),
                'area_changes': area_changes,
                'tipo_escola': data_2024.get('tipo_escola'),
                'porte': data_2024.get('porte')
            })

        # Sort by improvement
        improved_schools.sort(key=lambda x: x['improvement'], reverse=True)

        return improved_schools[:20]  # Top 20

    def generate_recommendations(self, codigo_inep: str) -> Dict:
        """
        Generate comprehensive recommendations for a school

        Returns:
            Dictionary with:
            - priority_recommendations: Top recommendations with evidence
            - quick_wins: Easy improvements with high ROI
            - long_term_priorities: Strategic improvements
            - success_stories: Similar schools that improved
        """
        school_info = self.get_school_info(codigo_inep)
        if not school_info:
            return {'error': 'School not found', 'codigo_inep': codigo_inep}

        # Get school's current scores
        school_data = self.df[
            (self.df['codigo_inep'] == codigo_inep) &
            (self.df['ano'] == school_info['ano'])
        ].iloc[0]

        # Find similar improved schools
        success_stories = self._find_similar_improved_schools(codigo_inep)

        # Analyze gaps and generate recommendations
        recommendations = []

        for area, col in self.AREA_TO_TRI.items():
            if pd.isna(school_data.get(col)):
                continue

            school_score = school_data[col]
            stats = self.area_stats.get(area, {})

            if not stats:
                continue

            # Calculate gap to targets
            gap_to_mean = school_score - stats['mean']
            gap_to_p75 = school_score - stats['p75']
            gap_to_p90 = school_score - stats['p90']

            # Determine priority based on gap and area importance
            if gap_to_mean < -30:
                priority = 1.0  # Critical
                difficulty = 'high'
                target = stats['p50']
            elif gap_to_mean < 0:
                priority = 0.7  # High
                difficulty = 'medium'
                target = stats['p75']
            elif gap_to_p75 < 0:
                priority = 0.4  # Medium
                difficulty = 'medium'
                target = stats['p75']
            else:
                priority = 0.2  # Low - already good
                difficulty = 'low'
                # For excellent schools, target should be higher than current
                target = max(stats['p90'], school_score + 10)

            # Find evidence from success stories
            evidence = self._find_evidence_for_area(area, success_stories)

            # Generate action items
            action_items = self._generate_action_items(area, gap_to_mean, priority)

            recommendations.append({
                'area': area,
                'area_name': self.AREA_DESCRIPTIONS.get(area, area),
                'priority': round(priority, 2),
                'current_score': round(float(school_score), 1),
                'target_score': round(float(target), 1),
                'expected_gain': round(float(target - school_score), 1),
                'difficulty': difficulty,
                'gap_to_mean': round(float(gap_to_mean), 1),
                'evidence': evidence,
                'action_items': action_items
            })

        # Sort by priority
        recommendations.sort(key=lambda x: x['priority'], reverse=True)

        # Check if we have any data to recommend on
        if not recommendations:
            return {
                'codigo_inep': codigo_inep,
                'school_info': school_info,
                'error': 'Dados insuficientes para gerar recomendações. A escola não possui notas registradas.',
                'all_recommendations': [],
                'high_priority_recommendations': [],
                'quick_wins': [],
                'long_term_priorities': [],
                'success_stories': [],
                'summary': {
                    'total_recommendations': 0,
                    'high_priority_count': 0,
                    'quick_wins_count': 0,
                    'success_stories_count': 0
                }
            }

        # Categorize recommendations
        quick_wins = [r for r in recommendations if r['difficulty'] == 'low' and r['expected_gain'] > 0]
        high_priority = [r for r in recommendations if r['priority'] >= 0.7]
        long_term = [r for r in recommendations if r['priority'] >= 0.4 and r['difficulty'] in ['medium', 'high']]

        return {
            'codigo_inep': codigo_inep,
            'school_info': school_info,
            'all_recommendations': recommendations,
            'high_priority_recommendations': high_priority,
            'quick_wins': quick_wins,
            'long_term_priorities': long_term,
            'success_stories': success_stories[:5],  # Top 5
            'summary': {
                'total_recommendations': len(recommendations),
                'high_priority_count': len(high_priority),
                'quick_wins_count': len(quick_wins),
                'success_stories_count': len(success_stories)
            }
        }

    def _find_evidence_for_area(self, area: str, success_stories: List[Dict]) -> Dict:
        """Find evidence from success stories for an area"""
        if not success_stories:
            return {'available': False}

        # Find schools that improved in this area
        area_improvements = []
        for story in success_stories:
            if area in story.get('area_changes', {}):
                change = story['area_changes'][area]
                if change['change'] > 10:  # Significant improvement
                    area_improvements.append({
                        'escola': story['nome_escola'],
                        'antes': change['before'],
                        'depois': change['after'],
                        'melhoria': change['change']
                    })

        if not area_improvements:
            return {'available': False}

        # Calculate average improvement
        avg_improvement = np.mean([i['melhoria'] for i in area_improvements])

        return {
            'available': True,
            'schools_improved': len(area_improvements),
            'avg_improvement': round(float(avg_improvement), 1),
            'examples': area_improvements[:3],  # Top 3 examples
            'insight': f'{len(area_improvements)} escolas similares melhoraram em média {avg_improvement:.0f} pontos em {self.AREA_DESCRIPTIONS.get(area, area)}'
        }

    def _generate_action_items(self, area: str, gap: float, priority: float) -> List[str]:
        """Generate specific action items for an area"""
        actions = []

        if area == 'MT':
            if gap < -30:
                actions = [
                    'Intensificar prática de resolução de problemas',
                    'Revisar conceitos básicos de álgebra e geometria',
                    'Implementar grupos de estudo focados em matemática',
                    'Usar simulados frequentes para prática'
                ]
            elif gap < 0:
                actions = [
                    'Focar em questões de maior dificuldade',
                    'Praticar interpretação de problemas contextualizados',
                    'Revisar tópicos com menor desempenho'
                ]
            else:
                actions = [
                    'Manter prática regular',
                    'Buscar questões de nível avançado'
                ]

        elif area == 'CN':
            if gap < -30:
                actions = [
                    'Reforçar conceitos fundamentais de física, química e biologia',
                    'Praticar interpretação de gráficos e experimentos',
                    'Integrar teoria com experimentos práticos',
                    'Realizar simulados específicos da área'
                ]
            elif gap < 0:
                actions = [
                    'Aprofundar em temas interdisciplinares',
                    'Praticar questões de análise de dados científicos'
                ]
            else:
                actions = [
                    'Manter desempenho com questões desafiadoras',
                    'Explorar temas atuais de ciência e tecnologia'
                ]

        elif area == 'CH':
            if gap < -30:
                actions = [
                    'Revisar conceitos básicos de história, geografia e filosofia',
                    'Praticar análise de textos e documentos históricos',
                    'Estudar atualidades e contextos geopolíticos',
                    'Desenvolver habilidade de argumentação'
                ]
            elif gap < 0:
                actions = [
                    'Aprofundar em análise crítica',
                    'Praticar questões de interpretação sociológica'
                ]
            else:
                actions = [
                    'Manter leitura regular de textos acadêmicos',
                    'Buscar questões de maior complexidade'
                ]

        elif area == 'LC':
            if gap < -30:
                actions = [
                    'Intensificar prática de interpretação de texto',
                    'Revisar gramática e regras de concordância',
                    'Ler textos variados (jornalísticos, literários, técnicos)',
                    'Praticar questões de língua estrangeira'
                ]
            elif gap < 0:
                actions = [
                    'Aprofundar em análise de gêneros textuais',
                    'Praticar questões de literatura'
                ]
            else:
                actions = [
                    'Manter hábito de leitura',
                    'Explorar textos de maior complexidade'
                ]

        elif area == 'redacao':
            if gap < -30:
                actions = [
                    'Praticar estruturação de dissertação argumentativa',
                    'Estudar repertório sociocultural',
                    'Revisar propostas de intervenção',
                    'Escrever redações semanais com correção',
                    'Analisar redações nota 1000'
                ]
            elif gap < 0:
                actions = [
                    'Aprimorar argumentação e uso de conectivos',
                    'Diversificar repertório sociocultural',
                    'Refinar propostas de intervenção'
                ]
            else:
                actions = [
                    'Manter prática regular de escrita',
                    'Buscar feedbacks de correções'
                ]

        return actions

    def generate_roadmap(self, codigo_inep: str) -> Dict:
        """
        Generate a phased improvement roadmap for a school

        Returns:
            Roadmap with:
            - Current position
            - Target position
            - Phases with specific goals
            - Expected timeline (phases, not dates)
        """
        recommendations = self.generate_recommendations(codigo_inep)

        if 'error' in recommendations:
            return recommendations

        school_info = recommendations['school_info']
        all_recs = recommendations['all_recommendations']

        # Calculate current ranking estimate
        current_media = np.mean([r['current_score'] for r in all_recs])
        target_media = np.mean([r['target_score'] for r in all_recs])

        # Build phases
        phases = []

        # Phase 1: Quick Wins (address easy improvements first)
        phase1_areas = [r for r in all_recs if r['difficulty'] == 'low' and r['expected_gain'] > 0]
        if not phase1_areas:
            phase1_areas = [r for r in all_recs if r['priority'] < 0.5][:2]

        if phase1_areas:
            phases.append({
                'phase': 1,
                'name': 'Quick Wins',
                'description': 'Melhorias rápidas para ganhos imediatos',
                'focus_areas': [a['area_name'] for a in phase1_areas],
                'expected_gain': round(sum(a['expected_gain'] for a in phase1_areas if a['expected_gain'] > 0) / max(len(phase1_areas), 1), 1),
                'action_items': [item for a in phase1_areas for item in a['action_items'][:2]]
            })

        # Phase 2: Core Improvements (medium priority)
        phase2_areas = [r for r in all_recs if 0.4 <= r['priority'] < 0.7 and r['difficulty'] == 'medium']
        if phase2_areas:
            phases.append({
                'phase': 2,
                'name': 'Consolidação',
                'description': 'Fortalecer áreas de desempenho médio',
                'focus_areas': [a['area_name'] for a in phase2_areas],
                'expected_gain': round(sum(a['expected_gain'] for a in phase2_areas if a['expected_gain'] > 0) / max(len(phase2_areas), 1), 1),
                'action_items': [item for a in phase2_areas for item in a['action_items'][:2]]
            })

        # Phase 3: High Priority (critical gaps)
        phase3_areas = [r for r in all_recs if r['priority'] >= 0.7]
        if phase3_areas:
            phases.append({
                'phase': 3,
                'name': 'Fechamento de Gaps',
                'description': 'Endereçar lacunas críticas de desempenho',
                'focus_areas': [a['area_name'] for a in phase3_areas],
                'expected_gain': round(sum(a['expected_gain'] for a in phase3_areas if a['expected_gain'] > 0) / max(len(phase3_areas), 1), 1),
                'action_items': [item for a in phase3_areas for item in a['action_items'][:2]]
            })

        # Phase 4: Excellence (push to top)
        phase4_areas = [r for r in all_recs if r['priority'] < 0.4 and r['expected_gain'] > 0]
        if phase4_areas:
            phases.append({
                'phase': 4,
                'name': 'Excelência',
                'description': 'Alcançar patamares de excelência',
                'focus_areas': [a['area_name'] for a in phase4_areas],
                'expected_gain': round(sum(a['expected_gain'] for a in phase4_areas if a['expected_gain'] > 0) / max(len(phase4_areas), 1), 1),
                'action_items': [item for a in phase4_areas for item in a['action_items'][:2]]
            })

        return {
            'codigo_inep': codigo_inep,
            'school_info': school_info,
            'current_position': {
                'nota_media_estimada': round(float(current_media), 1),
                'areas_criticas': len([r for r in all_recs if r['priority'] >= 0.7]),
                'areas_excelentes': len([r for r in all_recs if r['gap_to_mean'] > 30])
            },
            'target_position': {
                'nota_media_alvo': round(float(target_media), 1),
                'melhoria_esperada': round(float(target_media - current_media), 1)
            },
            'phases': phases,
            'total_phases': len(phases),
            'success_stories': recommendations['success_stories'][:3]
        }

    def get_success_stories(
        self,
        codigo_inep: str,
        limit: int = 10
    ) -> Dict:
        """
        Get detailed success stories for similar schools

        Returns:
            Schools that were similar and improved significantly
        """
        school_info = self.get_school_info(codigo_inep)
        if not school_info:
            return {'error': 'School not found'}

        stories = self._find_similar_improved_schools(codigo_inep)

        # Add more detail to each story
        detailed_stories = []
        for story in stories[:limit]:
            # Find the most improved area
            best_area = None
            best_improvement = 0
            for area, changes in story.get('area_changes', {}).items():
                if changes['change'] > best_improvement:
                    best_improvement = changes['change']
                    best_area = area

            detailed_stories.append({
                **story,
                'highlight_area': best_area,
                'highlight_area_name': self.AREA_DESCRIPTIONS.get(best_area, best_area) if best_area else None,
                'highlight_improvement': round(best_improvement, 1),
                'key_insight': f"Melhorou {best_improvement:.0f} pontos em {self.AREA_DESCRIPTIONS.get(best_area, best_area)}" if best_area else None
            })

        return {
            'codigo_inep': codigo_inep,
            'school_info': school_info,
            'success_stories': detailed_stories,
            'total_found': len(stories),
            'insight': f'Encontramos {len(stories)} escolas similares que melhoraram significativamente'
        }


if __name__ == "__main__":
    # Test the recommendation engine
    engine = RecommendationEngine()

    print(f"Loaded {len(engine.df)} school records")
    print(f"Loaded {len(engine.skill_averages)} skill averages")

    # Test recommendations
    test_school = "21009902"
    recs = engine.generate_recommendations(test_school)

    print(f"\nRecommendations for {test_school}:")
    print(f"  Total: {recs.get('summary', {}).get('total_recommendations', 0)}")
    print(f"  High priority: {recs.get('summary', {}).get('high_priority_count', 0)}")
    print(f"  Quick wins: {recs.get('summary', {}).get('quick_wins_count', 0)}")

    print("\nRoadmap:")
    roadmap = engine.generate_roadmap(test_school)
    for phase in roadmap.get('phases', []):
        print(f"  Phase {phase['phase']}: {phase['name']}")
        print(f"    Focus: {', '.join(phase['focus_areas'])}")
