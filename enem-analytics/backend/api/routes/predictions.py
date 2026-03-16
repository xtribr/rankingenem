"""
Prediction API endpoints for ENEM Analytics
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Path as PathParam
from pydantic import BaseModel
from typing import Dict, List, Optional, Any
import sys
from pathlib import Path

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from ml.prediction_model import ENEMPredictionModel
from api.auth.authorization import get_authorized_school_user
from api.auth.supabase_dependencies import UserProfile, get_current_admin

router = APIRouter(prefix="/api/predictions", tags=["predictions"])

# Initialize model (lazy loading)
_prediction_model = None


def get_prediction_model() -> ENEMPredictionModel:
    """Get or create prediction model instance"""
    global _prediction_model
    if _prediction_model is None:
        _prediction_model = ENEMPredictionModel()
        loaded = _prediction_model.load_all_models()
        print(f"Loaded {loaded} prediction models")
    return _prediction_model


# Pydantic models for responses
class ConfidenceInterval(BaseModel):
    low: float
    high: float


class PredictionResult(BaseModel):
    codigo_inep: str
    target_year: int
    scores: Dict[str, float]
    confidence_intervals: Dict[str, ConfidenceInterval]
    model_info: Dict[str, Any]


class SinglePrediction(BaseModel):
    codigo_inep: str
    target: str
    prediction: float
    confidence_interval: ConfidenceInterval
    uncertainty: float


class FeatureImportance(BaseModel):
    feature: str
    importance: float


class ScenarioInput(BaseModel):
    skill_improvements: Dict[str, float]  # {"MT_H15": 0.1, "CN_H8": 0.15}


class ScenarioResult(BaseModel):
    baseline_prediction: float
    improved_prediction: float
    delta: float
    impacted_skills: List[str]


# IMPORTANT: More specific routes must come BEFORE less specific ones

@router.get("/batch/top-improvers")
async def get_top_potential_improvers(
    limit: int = Query(20, ge=1, le=100),
    uf: Optional[str] = None,
    tipo_escola: Optional[str] = None,
    _: UserProfile = Depends(get_current_admin),
):
    """
    Get schools with highest predicted improvement potential

    Args:
        limit: Number of schools to return
        uf: Filter by state
        tipo_escola: Filter by school type (Privada/Pública)

    Returns:
        Schools ranked by predicted improvement
    """
    model = get_prediction_model()

    if model.preprocessor is None:
        from ml.preprocessor import ENEMPreprocessor
        model.preprocessor = ENEMPreprocessor()

    # Get 2024 schools
    df_2024 = model.preprocessor.df[model.preprocessor.df['ano'] == 2024].copy()

    if uf:
        df_2024 = df_2024[df_2024['uf'] == uf]

    if tipo_escola:
        df_2024 = df_2024[df_2024['tipo_escola'] == tipo_escola]

    # Sample schools for batch prediction (limit computation)
    sample_schools = df_2024['codigo_inep'].head(500).tolist()

    results = []
    for codigo_inep in sample_schools:
        try:
            pred = model.predict(codigo_inep, 'nota_media')
            actual = df_2024[df_2024['codigo_inep'] == codigo_inep]['nota_media'].values[0]

            if actual and pred['prediction']:
                improvement = pred['prediction'] - actual
                results.append({
                    'codigo_inep': codigo_inep,
                    'nome_escola': df_2024[df_2024['codigo_inep'] == codigo_inep]['nome_escola'].values[0],
                    'nota_atual': float(actual),
                    'nota_prevista': pred['prediction'],
                    'melhoria_esperada': improvement
                })
        except (ValueError, IndexError, KeyError):
            continue
        except Exception as e:
            print(f"Unexpected error predicting {codigo_inep}: {e}")
            continue

    # Sort by improvement potential
    results.sort(key=lambda x: x['melhoria_esperada'], reverse=True)

    return {
        'total': len(results),
        'schools': results[:limit]
    }


@router.get("/comparison/{codigo_inep}")
async def get_prediction_comparison(
    codigo_inep: str,
    _: UserProfile = Depends(get_authorized_school_user),
):
    """
    Compare predicted scores with actual historical performance

    Args:
        codigo_inep: School INEP code

    Returns:
        Comparison of predictions vs historical data
    """
    model = get_prediction_model()

    try:
        predictions = model.predict_all_scores(codigo_inep)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    # Get historical data
    if model.preprocessor is None:
        from ml.preprocessor import ENEMPreprocessor
        model.preprocessor = ENEMPreprocessor()

    school_df = model.preprocessor.df[
        model.preprocessor.df['codigo_inep'] == codigo_inep
    ].sort_values('ano')

    if len(school_df) == 0:
        raise HTTPException(status_code=404, detail="School not found")

    # Get latest actual scores
    latest = school_df.iloc[-1]
    latest_year = int(latest['ano'])

    historical = {
        'year': latest_year,
        'scores': {
            'cn': float(latest.get('nota_cn', 0)) if latest.get('nota_cn') else None,
            'ch': float(latest.get('nota_ch', 0)) if latest.get('nota_ch') else None,
            'lc': float(latest.get('nota_lc', 0)) if latest.get('nota_lc') else None,
            'mt': float(latest.get('nota_mt', 0)) if latest.get('nota_mt') else None,
            'redacao': float(latest.get('nota_redacao', 0)) if latest.get('nota_redacao') else None,
            'media': float(latest.get('nota_media', 0)) if latest.get('nota_media') else None,
        }
    }

    # Calculate expected change
    expected_change = {}
    for key in ['cn', 'ch', 'lc', 'mt', 'redacao', 'media']:
        if key in predictions['scores'] and historical['scores'].get(key):
            expected_change[key] = predictions['scores'][key] - historical['scores'][key]

    return {
        'codigo_inep': codigo_inep,
        'historical': historical,
        'predicted': {
            'year': 2025,
            'scores': predictions['scores']
        },
        'expected_change': expected_change,
        'confidence_intervals': predictions.get('confidence_intervals', {})
    }


@router.get("/{codigo_inep}/feature-importance/{target}", response_model=List[FeatureImportance])
async def get_feature_importance(
    codigo_inep: str,
    target: str = PathParam(..., pattern="^(cn|ch|lc|mt|redacao|media)$"),
    _: UserProfile = Depends(get_authorized_school_user),
):
    """
    Get feature importance for a prediction model

    Args:
        codigo_inep: School INEP code (for context, not currently used)
        target: Target score model (cn, ch, lc, mt, redacao, media)

    Returns:
        List of features with their importance scores
    """
    model = get_prediction_model()
    target_col = f"nota_{target}"

    importance = model.get_feature_importance(target_col)

    if not importance:
        raise HTTPException(status_code=404, detail="Feature importance not available")

    return [
        FeatureImportance(feature=item['feature'], importance=item['importance'])
        for item in importance
    ]


# Add pandas import for TRI analysis
import pandas as pd


@router.get("/{codigo_inep}/tri-analysis")
async def get_tri_based_prediction_analysis(
    codigo_inep: str,
    _: UserProfile = Depends(get_authorized_school_user),
):
    """
    Get TRI-based prediction analysis for a school.

    Shows which TRI content the school can handle, skill mastery levels,
    and recommendations based on TRI difficulty progression.
    """
    model = get_prediction_model()

    if model.preprocessor is None:
        from ml.preprocessor import ENEMPreprocessor
        model.preprocessor = ENEMPreprocessor()

    preprocessor = model.preprocessor

    # Get school data
    school_df = preprocessor.df[preprocessor.df['codigo_inep'] == codigo_inep]
    if len(school_df) == 0:
        raise HTTPException(status_code=404, detail="School not found")

    # Get TRI-based features
    tri_features = preprocessor.create_tri_based_features(school_df)
    skill_gap_features = preprocessor.create_skill_gap_features(school_df)

    # Get estimated TRI scores by content
    tri_estimates = preprocessor.estimate_tri_score_by_content(codigo_inep)

    # Get predictions
    try:
        predictions = model.predict_all_scores(codigo_inep)
    except ValueError:
        predictions = {'scores': {}, 'error': 'Dados insuficientes para prediction'}
    except Exception as e:
        print(f"Prediction error for {codigo_inep}: {e}")
        predictions = {'scores': {}, 'error': str(e)}

    # Build area analysis
    area_analysis = []
    area_mapping = {
        'cn': ('Ciências da Natureza', 'CN', '#22c55e'),
        'ch': ('Ciências Humanas', 'CH', '#8b5cf6'),
        'lc': ('Linguagens', 'LC', '#ec4899'),
        'mt': ('Matemática', 'MT', '#f97316'),
        'redacao': ('Redação', 'RE', '#3ABFF8')
    }

    latest = school_df.sort_values('ano').iloc[-1]

    for area_key, (area_name, area_code, color) in area_mapping.items():
        current_score = latest.get(f'nota_{area_key}', 500)
        if pd.isna(current_score):
            current_score = 500 if area_key != 'redacao' else 600  # Redação uses 0-1000 scale

        predicted = predictions.get('scores', {}).get(area_key, current_score)

        # Get TRI content stats for this area (not applicable for Redação)
        accessible_content = []
        stretch_content = []

        # Redação doesn't have TRI content - it's evaluated by competencies (C1-C5)
        if area_key == 'redacao':
            # For Redação, calculate mastery based on score range (0-1000)
            mastery_level = current_score / 1000.0
            # Gap to median (national avg around 600)
            gap_to_median = current_score - 600
            # Potential for improvement
            potential = (1000 - current_score) / 1000.0

            # Add competency-based "content" for Redação
            competencies = [
                {'skill': 'C1', 'tri_score': 200, 'description': 'Domínio da norma culta da língua escrita'},
                {'skill': 'C2', 'tri_score': 200, 'description': 'Compreensão da proposta e aplicação de conceitos'},
                {'skill': 'C3', 'tri_score': 200, 'description': 'Seleção e organização de informações e argumentos'},
                {'skill': 'C4', 'tri_score': 200, 'description': 'Conhecimento dos mecanismos linguísticos de argumentação'},
                {'skill': 'C5', 'tri_score': 200, 'description': 'Proposta de intervenção respeitando direitos humanos'},
            ]

            # Get competencia_redacao_media if available
            comp_media = latest.get('competencia_redacao_media')
            if pd.notna(comp_media):
                avg_comp = float(comp_media)
                # Accessible: competencies where school scores above 120
                if avg_comp >= 120:
                    accessible_content = [c for c in competencies if c['tri_score'] <= avg_comp + 40][:3]
                # Stretch: competencies to improve
                stretch_content = [
                    {**c, 'gap': 200 - avg_comp}
                    for c in competencies if c['tri_score'] > avg_comp
                ][:3]
        elif preprocessor.tri_content_df is not None:
            area_content = preprocessor.tri_content_df[preprocessor.tri_content_df['area_code'] == area_code]

            # Content school can handle now (TRI <= current score)
            accessible = area_content[area_content['tri_score'] <= current_score]
            if len(accessible) > 0:
                accessible_content = [
                    {
                        'skill': row['habilidade'],
                        'tri_score': row['tri_score'],
                        'description': row['descricao'][:100] + '...' if len(row['descricao']) > 100 else row['descricao']
                    }
                    for _, row in accessible.sample(min(5, len(accessible))).iterrows()
                ]

            # Stretch content (slightly above current level)
            stretch = area_content[
                (area_content['tri_score'] > current_score) &
                (area_content['tri_score'] <= current_score + 100)
            ]
            if len(stretch) > 0:
                stretch_content = [
                    {
                        'skill': row['habilidade'],
                        'tri_score': row['tri_score'],
                        'description': row['descricao'][:100] + '...' if len(row['descricao']) > 100 else row['descricao'],
                        'gap': row['tri_score'] - current_score
                    }
                    for _, row in stretch.sample(min(5, len(stretch))).iterrows()
                ]

            mastery_level = tri_features.get(f'tri_mastery_level_{area_key}', 0.5)
            gap_to_median = tri_features.get(f'tri_gap_to_median_{area_key}', 0)
            potential = tri_features.get(f'tri_potential_{area_key}', 0)

        # Set mastery/gap/potential for non-redacao areas
        if area_key != 'redacao':
            mastery_level = tri_features.get(f'tri_mastery_level_{area_key}', 0.5)
            gap_to_median = tri_features.get(f'tri_gap_to_median_{area_key}', 0)
            potential = tri_features.get(f'tri_potential_{area_key}', 0)

        area_analysis.append({
            'area': area_code,
            'area_name': area_name,
            'color': color,
            'current_score': float(current_score),
            'predicted_score': float(predicted),
            'expected_change': float(predicted - current_score),
            'tri_mastery_level': mastery_level,
            'tri_gap_to_median': gap_to_median,
            'tri_potential': potential,
            'skill_gap_national': skill_gap_features.get(f'skill_gap_national_{area_key}', 0),
            'weak_skill_count': skill_gap_features.get(f'low_skill_count_{area_key}', 0),
            'accessible_content_sample': accessible_content,
            'stretch_content_sample': stretch_content,
            'content_based_estimate': tri_estimates.get(area_key, current_score)
        })

    return {
        'codigo_inep': codigo_inep,
        'overall_tri_mastery': tri_features.get('overall_tri_mastery', 0.5),
        'total_weak_skills': skill_gap_features.get('total_weak_skills', 0),
        'area_analysis': area_analysis,
        'insights': {
            'mastery_interpretation': _get_mastery_interpretation(tri_features.get('overall_tri_mastery', 0.5)),
            'recommendation': _get_improvement_recommendation(skill_gap_features.get('total_weak_skills', 0))
        }
    }


def _get_mastery_interpretation(mastery: float) -> str:
    """Get human-readable interpretation of mastery level"""
    if mastery >= 0.8:
        return "Excelente domínio do conteúdo TRI - escola consegue resolver questões de alta dificuldade"
    elif mastery >= 0.6:
        return "Bom domínio - escola está acima da mediana e pode avançar para conteúdos mais difíceis"
    elif mastery >= 0.4:
        return "Domínio intermediário - há espaço significativo para melhoria em conteúdos de nível médio"
    else:
        return "Foco em fundamentos - priorizar conteúdos de TRI mais acessíveis antes de avançar"


def _get_improvement_recommendation(weak_skills: float) -> str:
    """Get recommendation based on weak skill count"""
    if weak_skills <= 5:
        return "Escola tem poucos gaps críticos - focar em refinamento e conteúdos avançados"
    elif weak_skills <= 15:
        return "Gaps identificados em habilidades específicas - treino focado pode gerar ganhos rápidos"
    elif weak_skills <= 30:
        return "Vários gaps identificados - recomenda-se plano estruturado de recuperação por área"
    else:
        return "Muitos gaps críticos - priorizar fundamentos e habilidades mais frequentes no ENEM"


@router.get("/{codigo_inep}/area-projection/{area}")
async def get_area_projection(
    codigo_inep: str,
    area: str = PathParam(..., pattern="^(cn|ch|lc|mt|re|redacao|CN|CH|LC|MT|RE|REDACAO)$"),
    _: UserProfile = Depends(get_authorized_school_user),
):
    """
    Get detailed TRI projection for a specific area.

    Uses ALL historical TRI scores to project future performance
    if the school masters the stretch content.

    Args:
        codigo_inep: School INEP code
        area: Area code (cn, ch, lc, mt, re/redacao)

    Returns:
        Detailed projection with historical analysis and future TRI estimate
    """
    import numpy as np
    from scipy import stats

    model = get_prediction_model()

    if model.preprocessor is None:
        from ml.preprocessor import ENEMPreprocessor
        model.preprocessor = ENEMPreprocessor()

    preprocessor = model.preprocessor
    area_lower = area.lower()
    area_upper = area.upper()

    # Get ALL historical data for this school
    school_df = preprocessor.df[
        preprocessor.df['codigo_inep'] == codigo_inep
    ].sort_values('ano')

    if len(school_df) == 0:
        raise HTTPException(status_code=404, detail="School not found")

    # Area configuration
    area_config = {
        'cn': ('Ciências da Natureza', 'CN', '#22c55e'),
        'ch': ('Ciências Humanas', 'CH', '#8b5cf6'),
        'lc': ('Linguagens', 'LC', '#ec4899'),
        'mt': ('Matemática', 'MT', '#f97316'),
        're': ('Redação', 'RE', '#3ABFF8'),
        'redacao': ('Redação', 'RE', '#3ABFF8')
    }

    if area_lower not in area_config:
        raise HTTPException(status_code=400, detail=f"Invalid area: {area}")

    area_name, area_code, color = area_config[area_lower]
    # Handle Redação column name
    nota_col = 'nota_redacao' if area_lower in ['re', 'redacao'] else f'nota_{area_lower}'

    # Extract historical TRI scores (all years)
    historical_scores = []
    for _, row in school_df.iterrows():
        score = row.get(nota_col)
        if pd.notna(score) and score > 0:
            historical_scores.append({
                'ano': int(row['ano']),
                'score': float(score),
                'ranking': int(row.get('ranking_brasil', 0)) if pd.notna(row.get('ranking_brasil')) else None
            })

    if len(historical_scores) == 0:
        raise HTTPException(status_code=404, detail=f"No historical data for {area_name}")

    # Calculate trend using linear regression on all historical data
    years = np.array([h['ano'] for h in historical_scores])
    scores = np.array([h['score'] for h in historical_scores])

    # Current score (latest)
    current_score = historical_scores[-1]['score']
    current_year = historical_scores[-1]['ano']

    # Calculate linear trend
    if len(years) >= 2:
        slope, intercept, r_value, p_value, std_err = stats.linregress(years, scores)
        trend_direction = 'ascending' if slope > 0 else 'descending' if slope < 0 else 'stable'
        annual_change = float(slope)
        trend_strength = abs(r_value)  # R² shows how consistent the trend is
    else:
        slope = 0
        intercept = current_score
        r_value = 0
        annual_change = 0
        trend_direction = 'insufficient_data'
        trend_strength = 0

    # Get stretch content for this area
    stretch_content = []
    total_stretch_items = 0
    is_redacao = area_lower in ['re', 'redacao']

    if is_redacao:
        # Redação uses competency-based content (C1-C5), each worth 0-200 points
        # Total score is 0-1000
        competencies = [
            {'skill': 'C1', 'tri_score': 200, 'description': 'Domínio da norma culta da língua escrita'},
            {'skill': 'C2', 'tri_score': 200, 'description': 'Compreensão da proposta e aplicação de conceitos de várias áreas'},
            {'skill': 'C3', 'tri_score': 200, 'description': 'Seleção, organização e interpretação de informações e argumentos'},
            {'skill': 'C4', 'tri_score': 200, 'description': 'Conhecimento dos mecanismos linguísticos para argumentação'},
            {'skill': 'C5', 'tri_score': 200, 'description': 'Proposta de intervenção respeitando direitos humanos'},
        ]

        # Calculate average competency score based on current total
        avg_comp = current_score / 5  # Average per competency

        # "Stretch" content: competencies where school can improve
        for comp in competencies:
            gap = 200 - avg_comp
            if gap > 20:  # Room for improvement
                stretch_content.append({
                    'skill': comp['skill'],
                    'tri_score': 200.0,  # Max score per competency
                    'description': comp['description'],
                    'gap': float(gap)
                })

        total_stretch_items = len(stretch_content)
    elif preprocessor.tri_content_df is not None:
        area_content = preprocessor.tri_content_df[
            preprocessor.tri_content_df['area_code'] == area_code
        ]

        # Content slightly above current level (within 100 points)
        stretch_df = area_content[
            (area_content['tri_score'] > current_score) &
            (area_content['tri_score'] <= current_score + 100)
        ].sort_values('tri_score')

        total_stretch_items = len(stretch_df)

        # Get sample of stretch content
        for _, row in stretch_df.head(10).iterrows():
            stretch_content.append({
                'skill': row['habilidade'],
                'tri_score': float(row['tri_score']),
                'description': row['descricao'],
                'gap': float(row['tri_score'] - current_score)
            })

    # Calculate projected score if school masters stretch content
    # Method: Use historical trend + potential gain from mastering stretch content

    # Base projection from trend (project to next year)
    next_year = current_year + 1
    trend_projection = intercept + slope * next_year

    # For Redação, cap at 1000 (max score)
    max_possible_score = 1000 if is_redacao else 850  # TRI areas rarely exceed 850

    # If school masters stretch content, they could reach the highest stretch TRI
    if len(stretch_content) > 0:
        if is_redacao:
            # For Redação: optimistic = all competencies at 200 (total 1000)
            max_stretch_tri = 1000
            avg_stretch_tri = current_score + sum(s['gap'] for s in stretch_content) / 2
        else:
            max_stretch_tri = max(s['tri_score'] for s in stretch_content)
            avg_stretch_tri = sum(s['tri_score'] for s in stretch_content) / len(stretch_content)

        # Conservative projection: average between trend and stretch mastery
        # Optimistic projection: if all stretch content is mastered
        conservative_projection = (trend_projection + avg_stretch_tri) / 2
        optimistic_projection = min(max_stretch_tri, max_possible_score)

        # Realistic projection based on historical improvement rate
        historical_max = max(scores)
        historical_min = min(scores)
        historical_range = historical_max - historical_min

        # The school's typical improvement capacity
        if len(scores) >= 3:
            improvements = np.diff(scores)
            avg_improvement = np.mean(improvements[improvements > 0]) if any(improvements > 0) else 0
            max_improvement = np.max(improvements) if len(improvements) > 0 else 0
        else:
            avg_improvement = annual_change if annual_change > 0 else 0
            max_improvement = annual_change * 2 if annual_change > 0 else 20

        # Realistic projection: current + realistic improvement
        # For Redação, allow higher improvements (it's on a 0-1000 scale vs ~400-800 for TRI)
        improvement_cap = 100 if is_redacao else 50
        realistic_projection = current_score + min(max_improvement * 1.5, improvement_cap)
        realistic_projection = min(realistic_projection, optimistic_projection)  # Can't exceed max stretch
        realistic_projection = min(realistic_projection, max_possible_score)  # Cap at max possible
    else:
        conservative_projection = trend_projection
        optimistic_projection = min(trend_projection + (60 if is_redacao else 30), max_possible_score)
        realistic_projection = min(trend_projection + (30 if is_redacao else 15), max_possible_score)
        avg_improvement = annual_change if annual_change > 0 else 0
        max_improvement = annual_change * 2 if annual_change > 0 else (40 if is_redacao else 20)

    # Calculate confidence interval using historical volatility
    if len(scores) >= 3:
        std_dev = np.std(scores)
        confidence_interval = {
            'low': float(realistic_projection - 1.96 * std_dev),
            'high': float(realistic_projection + 1.96 * std_dev)
        }
    else:
        confidence_interval = {
            'low': float(realistic_projection - 30),
            'high': float(realistic_projection + 30)
        }

    # Generate insights based on the analysis
    insights = []

    # Trend insight
    if trend_direction == 'ascending':
        insights.append({
            'type': 'positive',
            'title': 'Tendência de Crescimento',
            'message': f'A escola demonstra crescimento médio de {annual_change:.1f} pontos/ano nos últimos {len(years)} anos.'
        })
    elif trend_direction == 'descending':
        insights.append({
            'type': 'warning',
            'title': 'Tendência de Queda',
            'message': f'A escola apresenta queda média de {abs(annual_change):.1f} pontos/ano. Atenção redobrada necessária.'
        })
    else:
        insights.append({
            'type': 'neutral',
            'title': 'Performance Estável',
            'message': 'A escola mantém performance consistente ao longo dos anos.'
        })

    # Stretch content insight
    if total_stretch_items > 0:
        insights.append({
            'type': 'info',
            'title': f'{total_stretch_items} Conteúdos Próximos',
            'message': f'Existem {total_stretch_items} itens TRI entre {current_score:.0f} e {current_score + 100:.0f} pontos que podem ser dominados.'
        })

    # Projection insight
    potential_gain = realistic_projection - current_score
    if potential_gain > 20:
        insights.append({
            'type': 'positive',
            'title': 'Alto Potencial de Melhoria',
            'message': f'Se dominar o conteúdo stretch, a escola pode ganhar até {potential_gain:.0f} pontos.'
        })
    elif potential_gain > 0:
        insights.append({
            'type': 'neutral',
            'title': 'Potencial de Melhoria Moderado',
            'message': f'Projeção indica ganho potencial de {potential_gain:.0f} pontos com foco no conteúdo apropriado.'
        })

    return {
        'codigo_inep': codigo_inep,
        'area': area_code,
        'area_name': area_name,
        'color': color,
        'current_year': current_year,
        'current_score': current_score,
        'historical_analysis': {
            'total_years': len(historical_scores),
            'scores': historical_scores,
            'trend': {
                'direction': trend_direction,
                'annual_change': annual_change,
                'strength': trend_strength,  # R² value
                'r_squared': float(r_value ** 2) if r_value else 0
            },
            'statistics': {
                'mean': float(np.mean(scores)),
                'std': float(np.std(scores)) if len(scores) > 1 else 0,
                'min': float(np.min(scores)),
                'max': float(np.max(scores)),
                'avg_improvement': float(avg_improvement),
                'max_improvement': float(max_improvement)
            }
        },
        'stretch_content': {
            'total_items': total_stretch_items,
            'items': stretch_content,
            'tri_range': {
                'min': current_score,
                'max': current_score + 100
            }
        },
        'projection': {
            'target_year': next_year,
            'scenarios': {
                'trend_based': float(trend_projection),
                'conservative': float(conservative_projection),
                'realistic': float(realistic_projection),
                'optimistic': float(optimistic_projection)
            },
            'recommended': float(realistic_projection),
            'confidence_interval': confidence_interval,
            'potential_gain': float(potential_gain)
        },
        'insights': insights
    }


@router.get("/{codigo_inep}/{target}", response_model=SinglePrediction)
async def predict_single_score(
    codigo_inep: str,
    target: str = PathParam(..., pattern="^(cn|ch|lc|mt|redacao|media)$"),
    _: UserProfile = Depends(get_authorized_school_user),
):
    """
    Predict a single TRI score for a school

    Args:
        codigo_inep: School INEP code
        target: Score to predict (cn, ch, lc, mt, redacao, media)

    Returns:
        Single prediction with confidence interval
    """
    model = get_prediction_model()

    target_col = f"nota_{target}"

    try:
        result = model.predict(codigo_inep, target_col)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")

    return SinglePrediction(
        codigo_inep=codigo_inep,
        target=target,
        prediction=result['prediction'],
        confidence_interval=ConfidenceInterval(
            low=result['confidence_interval']['low'],
            high=result['confidence_interval']['high']
        ),
        uncertainty=result['uncertainty']
    )


@router.get("/{codigo_inep}", response_model=PredictionResult)
async def predict_school_scores(
    codigo_inep: str,
    target_year: int = Query(2025, ge=2025, le=2025),
    _: UserProfile = Depends(get_authorized_school_user),
):
    """
    Predict all TRI scores for a school.

    The model predicts the next ENEM cycle (2025) based on historical data.
    It cannot extrapolate to years beyond 2025.

    Args:
        codigo_inep: School INEP code
        target_year: Fixed at 2025 (model does not support other years)

    Returns:
        Predicted scores with confidence intervals
    """
    model = get_prediction_model()

    try:
        result = model.predict_all_scores(codigo_inep)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")

    if 'error' in result:
        raise HTTPException(status_code=422, detail=result['error'])

    # Format confidence intervals
    confidence_intervals = {}
    for key, ci in result.get('confidence_intervals', {}).items():
        confidence_intervals[key] = ConfidenceInterval(
            low=ci['low'],
            high=ci['high']
        )

    return PredictionResult(
        codigo_inep=codigo_inep,
        target_year=2025,
        scores=result.get('scores', {}),
        confidence_intervals=confidence_intervals,
        model_info={
            "algorithm": "HistGradientBoostingRegressor",
            "training_samples": result.get('training_info', {}).get('samples', 15807),
            "disclaimer": result.get('disclaimer', ''),
        }
    )
