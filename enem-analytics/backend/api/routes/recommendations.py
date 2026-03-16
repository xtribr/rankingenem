"""
Recommendations API endpoints for ENEM Analytics
Evidence-based recommendations with success stories and roadmaps
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
import sys
from pathlib import Path

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from ml.recommendation_engine import RecommendationEngine
from api.auth.authorization import get_authorized_school_user
from api.auth.supabase_dependencies import UserProfile, get_current_admin

router = APIRouter(prefix="/api/recommendations", tags=["recommendations"])

# Initialize engine (lazy loading)
_recommendation_engine = None


def get_recommendation_engine() -> RecommendationEngine:
    """Get or create recommendation engine instance"""
    global _recommendation_engine
    if _recommendation_engine is None:
        _recommendation_engine = RecommendationEngine()
        print(f"Recommendation engine loaded: {len(_recommendation_engine.df)} records")
    return _recommendation_engine


@router.get("/{codigo_inep}")
async def get_recommendations(
    codigo_inep: str,
    _: UserProfile = Depends(get_authorized_school_user),
):
    """
    Get comprehensive recommendations for a school

    Returns prioritized recommendations with:
    - Evidence from similar schools that improved
    - Specific action items for each area
    - Expected gains from improvements

    Args:
        codigo_inep: School INEP code

    Returns:
        Complete recommendation set with evidence
    """
    engine = get_recommendation_engine()

    result = engine.generate_recommendations(codigo_inep)

    if 'error' in result:
        raise HTTPException(status_code=404, detail=result['error'])

    return result


@router.get("/{codigo_inep}/roadmap")
async def get_roadmap(
    codigo_inep: str,
    _: UserProfile = Depends(get_authorized_school_user),
):
    """
    Get a phased improvement roadmap for a school

    The roadmap includes:
    - Current position analysis
    - Target position with expected gains
    - Multiple phases with specific goals
    - Action items for each phase
    - Success stories from similar schools

    Args:
        codigo_inep: School INEP code

    Returns:
        Structured roadmap with phases and milestones
    """
    engine = get_recommendation_engine()

    result = engine.generate_roadmap(codigo_inep)

    if 'error' in result:
        raise HTTPException(status_code=404, detail=result['error'])

    return result


@router.get("/{codigo_inep}/success-stories")
async def get_success_stories(
    codigo_inep: str,
    limit: int = Query(10, ge=1, le=50),
    _: UserProfile = Depends(get_authorized_school_user),
):
    """
    Get success stories from similar schools

    Finds schools that:
    - Had similar scores in the previous year
    - Improved significantly
    - Can serve as examples

    Args:
        codigo_inep: School INEP code
        limit: Maximum number of stories

    Returns:
        Detailed success stories with improvement data
    """
    engine = get_recommendation_engine()

    result = engine.get_success_stories(codigo_inep, limit)

    if 'error' in result:
        raise HTTPException(status_code=404, detail=result['error'])

    return result


@router.get("/{codigo_inep}/quick-wins")
async def get_quick_wins(
    codigo_inep: str,
    limit: int = Query(5, ge=1, le=20),
    _: UserProfile = Depends(get_authorized_school_user),
):
    """
    Get quick win recommendations

    Quick wins are improvements that:
    - Are relatively easy to achieve
    - Provide immediate gains
    - Build momentum for larger improvements

    Args:
        codigo_inep: School INEP code
        limit: Maximum number of recommendations

    Returns:
        List of quick win opportunities
    """
    engine = get_recommendation_engine()

    result = engine.generate_recommendations(codigo_inep)

    if 'error' in result:
        raise HTTPException(status_code=404, detail=result['error'])

    quick_wins = result.get('quick_wins', [])[:limit]

    return {
        'codigo_inep': codigo_inep,
        'school_info': result.get('school_info'),
        'quick_wins': quick_wins,
        'total_available': len(result.get('quick_wins', [])),
        'recommendation': 'Comece por essas melhorias de alto impacto e baixa dificuldade'
    }


@router.get("/{codigo_inep}/priorities")
async def get_priorities(
    codigo_inep: str,
    limit: int = Query(5, ge=1, le=20),
    _: UserProfile = Depends(get_authorized_school_user),
):
    """
    Get high priority recommendations

    These are the most critical areas that need attention based on:
    - Gap to national/peer average
    - Impact on overall score
    - Evidence from similar schools

    Args:
        codigo_inep: School INEP code
        limit: Maximum number of priorities

    Returns:
        List of high priority areas with evidence
    """
    engine = get_recommendation_engine()

    result = engine.generate_recommendations(codigo_inep)

    if 'error' in result:
        raise HTTPException(status_code=404, detail=result['error'])

    priorities = result.get('high_priority_recommendations', [])[:limit]

    return {
        'codigo_inep': codigo_inep,
        'school_info': result.get('school_info'),
        'priorities': priorities,
        'total_critical': len(result.get('high_priority_recommendations', [])),
        'recommendation': 'Estas são as áreas que mais precisam de atenção'
    }


@router.get("/{codigo_inep}/area/{area}")
async def get_area_recommendations(
    codigo_inep: str,
    area: str,
    _: UserProfile = Depends(get_authorized_school_user),
):
    """
    Get detailed recommendations for a specific area

    Args:
        codigo_inep: School INEP code
        area: Area code (CN, CH, LC, MT, redacao)

    Returns:
        Detailed recommendations for the area including:
        - Current vs target scores
        - Evidence from similar schools
        - Specific action items
    """
    engine = get_recommendation_engine()

    result = engine.generate_recommendations(codigo_inep)

    if 'error' in result:
        raise HTTPException(status_code=404, detail=result['error'])

    # Find the area
    area_rec = next(
        (r for r in result.get('all_recommendations', []) if r['area'] == area),
        None
    )

    if not area_rec:
        raise HTTPException(status_code=404, detail=f"Area {area} not found")

    return {
        'codigo_inep': codigo_inep,
        'school_info': result.get('school_info'),
        'area_recommendation': area_rec,
        'related_success_stories': [
            s for s in result.get('success_stories', [])
            if area in s.get('area_changes', {})
        ][:5]
    }


@router.get("/{codigo_inep}/action-plan")
async def get_action_plan(
    codigo_inep: str,
    _: UserProfile = Depends(get_authorized_school_user),
):
    """
    Get a consolidated action plan

    Combines recommendations and roadmap into a single
    actionable plan with:
    - Immediate actions (this month)
    - Short-term goals (next 3 months)
    - Long-term objectives (6+ months)

    Args:
        codigo_inep: School INEP code

    Returns:
        Consolidated action plan
    """
    engine = get_recommendation_engine()

    recs = engine.generate_recommendations(codigo_inep)
    if 'error' in recs:
        raise HTTPException(status_code=404, detail=recs['error'])

    roadmap = engine.generate_roadmap(codigo_inep)

    # Build action plan
    immediate_actions = []
    short_term = []
    long_term = []

    # Immediate: from quick wins
    for qw in recs.get('quick_wins', [])[:3]:
        immediate_actions.extend(qw.get('action_items', [])[:2])

    # Short-term: from first phases
    for phase in roadmap.get('phases', [])[:2]:
        short_term.extend(phase.get('action_items', [])[:3])

    # Long-term: from later phases
    for phase in roadmap.get('phases', [])[2:]:
        long_term.extend(phase.get('action_items', [])[:3])

    return {
        'codigo_inep': codigo_inep,
        'school_info': recs.get('school_info'),
        'action_plan': {
            'immediate_actions': list(set(immediate_actions))[:5],
            'short_term_goals': list(set(short_term))[:5],
            'long_term_objectives': list(set(long_term))[:5]
        },
        'expected_improvement': roadmap.get('target_position', {}).get('melhoria_esperada', 0),
        'phases_count': len(roadmap.get('phases', [])),
        'success_stories_count': len(recs.get('success_stories', []))
    }


@router.get("/patterns/top-improvers")
async def get_top_improvers(
    limit: int = Query(20, ge=1, le=100),
    uf: Optional[str] = None,
    tipo_escola: Optional[str] = None,
    _: UserProfile = Depends(get_current_admin),
):
    """
    Get schools that improved the most

    Shows schools with the biggest improvements to learn from

    Args:
        limit: Number of schools to return
        uf: Filter by state
        tipo_escola: Filter by school type

    Returns:
        List of top improving schools with details
    """
    engine = get_recommendation_engine()

    # Get improvement patterns
    patterns = engine.improvement_patterns

    top_improvers = patterns.get('top_improvers', {}).get('media', [])[:limit]

    return {
        'top_improvers': top_improvers,
        'total': len(top_improvers),
        'insight': 'Estas escolas tiveram as maiores melhorias no último ano'
    }
