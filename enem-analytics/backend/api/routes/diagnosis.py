"""
Diagnosis API endpoints for ENEM Analytics
Skill gap analysis and priority recommendations
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Path as PathParam
from pydantic import BaseModel
from typing import Dict, List, Optional, Any
import sys
from pathlib import Path

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from ml.diagnosis_engine import DiagnosisEngine
from api.auth.authorization import get_authorized_school_user
from api.auth.supabase_dependencies import UserProfile, get_current_admin

router = APIRouter(prefix="/api/diagnosis", tags=["diagnosis"])

# Initialize engine (lazy loading)
_diagnosis_engine = None


def get_diagnosis_engine() -> DiagnosisEngine:
    """Get or create diagnosis engine instance"""
    global _diagnosis_engine
    if _diagnosis_engine is None:
        _diagnosis_engine = DiagnosisEngine()
        print(f"Diagnosis engine loaded: {len(_diagnosis_engine.skill_averages)} skills, {len(_diagnosis_engine.df)} records")
    return _diagnosis_engine


# IMPORTANT: Static routes must come BEFORE dynamic routes

@router.get("/stats/national")
async def get_national_stats(
    _: UserProfile = Depends(get_current_admin),
):
    """
    Get national statistics for all areas

    Returns:
        Statistics (mean, std, percentiles) for each area
    """
    engine = get_diagnosis_engine()
    latest_year = int(engine.df["ano"].max())

    return {
        'year': latest_year,
        'areas': engine.area_stats,
        'skill_count': len(engine.skill_averages)
    }


@router.get("/stats/skills")
async def get_skill_stats(
    _: UserProfile = Depends(get_current_admin),
):
    """
    Get national skill averages

    Returns:
        Average performance for each skill (120 skills total)
    """
    engine = get_diagnosis_engine()
    latest_year = int(engine.df["ano"].max())

    # Group by area
    skills_by_area = {'CN': [], 'CH': [], 'LC': [], 'MT': []}

    for skill_code, avg in engine.skill_averages.items():
        area = skill_code.split('_')[0]
        skill_num = int(skill_code.split('H')[1])

        if area in skills_by_area:
            skills_by_area[area].append({
                'skill_code': skill_code,
                'skill_number': skill_num,
                'national_avg': round(avg, 1),
                'difficulty': 'hard' if avg < 40 else 'medium' if avg < 60 else 'easy'
            })

    # Sort each area by skill number
    for area in skills_by_area:
        skills_by_area[area].sort(key=lambda x: x['skill_number'])

    return {
        'year': latest_year,
        'skills_by_area': skills_by_area,
        'total_skills': len(engine.skill_averages)
    }


@router.get("/compare/{codigo_inep_1}/{codigo_inep_2}")
async def compare_schools(
    codigo_inep_1: str,
    codigo_inep_2: str,
    _: UserProfile = Depends(get_current_admin),
):
    """
    Compare two schools

    Args:
        codigo_inep_1: First school INEP code
        codigo_inep_2: Second school INEP code

    Returns:
        Comparative analysis of both schools
    """
    try:
        engine = get_diagnosis_engine()
        comparison = engine.compare_schools(codigo_inep_1, codigo_inep_2)

        if 'error' in comparison:
            raise HTTPException(status_code=404, detail=comparison['error'])

        return comparison
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error comparing schools {codigo_inep_1} vs {codigo_inep_2}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error comparing schools: {str(e)}"
        )


@router.get("/{codigo_inep}/improvement-potential")
async def get_improvement_potential(
    codigo_inep: str,
    _: UserProfile = Depends(get_authorized_school_user),
):
    """
    Calculate potential improvement for a school

    Args:
        codigo_inep: School INEP code

    Returns:
        Potential score improvements by area if weak areas reach peer average
    """
    engine = get_diagnosis_engine()

    potential = engine.get_improvement_potential(codigo_inep)

    if 'error' in potential:
        raise HTTPException(status_code=404, detail=potential['error'])

    return potential


@router.get("/{codigo_inep}/quick-wins")
async def get_quick_wins(
    codigo_inep: str,
    limit: int = Query(10, ge=1, le=30),
    _: UserProfile = Depends(get_authorized_school_user),
):
    """
    Get quick win recommendations - areas with best improvement ROI

    Quick wins are areas that:
    - Have moderate gaps (not too severe)
    - Offer good return on improvement efforts

    Args:
        codigo_inep: School INEP code
        limit: Number of recommendations

    Returns:
        List of quick win areas to prioritize
    """
    engine = get_diagnosis_engine()

    diagnosis = engine.diagnose(codigo_inep)

    if 'error' in diagnosis:
        raise HTTPException(status_code=404, detail=diagnosis['error'])

    # Quick wins: moderate gaps with feasible improvement
    quick_wins = []
    for area in diagnosis['area_analysis']:
        gap = area['gap_to_peer']
        z_score = area['z_score']

        # Quick wins have moderate gaps (-0.5 to -1.5 z-score)
        if -1.5 <= z_score < -0.25:
            quick_win_score = abs(gap) * (1 / (1 + abs(z_score)))  # Favor smaller gaps
            quick_wins.append({
                **area,
                'quick_win_score': round(quick_win_score, 2),
                'feasibility': 'high' if z_score > -1 else 'medium'
            })

    # Sort by quick win score
    quick_wins.sort(key=lambda x: x['quick_win_score'], reverse=True)

    return {
        'codigo_inep': codigo_inep,
        'quick_wins': quick_wins[:limit],
        'explanation': 'Areas with moderate gaps and high improvement potential'
    }


@router.get("/{codigo_inep}/area/{area}")
async def get_area_diagnosis(
    codigo_inep: str,
    area: str = PathParam(..., pattern="^(CN|CH|LC|MT|redacao)$"),
    _: UserProfile = Depends(get_authorized_school_user),
):
    """
    Get detailed diagnosis for a specific area

    Args:
        codigo_inep: School INEP code
        area: Area to analyze (CN, CH, LC, MT, redacao)

    Returns:
        Detailed analysis for the specified area
    """
    engine = get_diagnosis_engine()

    # Get full diagnosis
    diagnosis = engine.diagnose(codigo_inep)

    if 'error' in diagnosis:
        raise HTTPException(status_code=404, detail=diagnosis['error'])

    # Find this area
    area_info = next(
        (a for a in diagnosis['area_analysis'] if a['area'] == area),
        None
    )

    if not area_info:
        raise HTTPException(status_code=404, detail=f"Area {area} not found for school")

    # Get skill gaps for this area
    area_skill_gaps = [
        s for s in diagnosis.get('skill_gaps', [])
        if s['area'] == area
    ]

    return {
        'codigo_inep': codigo_inep,
        'area': area,
        'area_name': area_info['area_name'],
        'analysis': area_info,
        'skill_gaps': area_skill_gaps,
        'peer_comparison': diagnosis['peer_comparison']
    }


@router.get("/{codigo_inep}")
async def get_diagnosis(
    codigo_inep: str,
    _: UserProfile = Depends(get_authorized_school_user),
):
    """
    Get comprehensive diagnosis for a school

    Args:
        codigo_inep: School INEP code

    Returns:
        Complete diagnosis with:
        - Overall health assessment
        - Area-by-area analysis
        - Peer comparison
        - Skill gaps and priorities
    """
    engine = get_diagnosis_engine()

    diagnosis = engine.diagnose(codigo_inep)

    if 'error' in diagnosis:
        raise HTTPException(status_code=404, detail=diagnosis['error'])

    return diagnosis
