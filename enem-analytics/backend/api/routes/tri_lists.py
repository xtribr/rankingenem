"""
TRI Lists API - Study materials by TRI score range
Provides content recommendations based on predicted scores
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from typing import Optional, List
import pandas as pd
from pathlib import Path
import os

from api.auth.authorization import get_authorized_school_user
from api.auth.supabase_dependencies import UserProfile, get_current_admin

router = APIRouter(prefix="/api/tri-lists", tags=["tri-lists"])

# Load TRI content data
DATA_DIR = Path(__file__).parent.parent.parent / "data"
DADOS_DIR = Path("/Volumes/notebook/GLiNER2/dados")

# Cache for TRI content
_tri_content = None
_tri_content_gliner = None


def get_tri_content() -> pd.DataFrame:
    """Load and cache TRI content"""
    global _tri_content
    if _tri_content is None:
        path = DATA_DIR / "conteudos_tri_final.csv"
        if path.exists():
            _tri_content = pd.read_csv(path)
        else:
            _tri_content = pd.DataFrame()
    return _tri_content


def get_tri_content_gliner() -> pd.DataFrame:
    """Load GLiNER-enriched TRI content if available"""
    global _tri_content_gliner
    if _tri_content_gliner is None:
        gliner_path = DATA_DIR / "conteudos_tri_gliner.csv"
        if gliner_path.exists():
            # Use quoting=1 (QUOTE_ALL) to properly handle fields with commas
            _tri_content_gliner = pd.read_csv(gliner_path, quoting=1)
        else:
            # Fall back to regular content
            _tri_content_gliner = get_tri_content()
    return _tri_content_gliner


# Area name mappings
AREA_NAMES = {
    'LC': 'Linguagens e Códigos',
    'CH': 'Ciências Humanas',
    'CN': 'Ciências da Natureza',
    'MT': 'Matemática'
}

# TRI ranges with descriptions
TRI_RANGES = {
    '200-450': {'min': 200, 'max': 450, 'label': 'Básico', 'description': 'Nível inicial - conceitos fundamentais'},
    '450-550': {'min': 450, 'max': 550, 'label': 'Intermediário', 'description': 'Nível médio - aplicação de conceitos'},
    '550-650': {'min': 550, 'max': 650, 'label': 'Avançado', 'description': 'Nível avançado - questões complexas'},
    '650-750': {'min': 650, 'max': 750, 'label': 'Excelência', 'description': 'Alto desempenho - questões desafiadoras'},
    '750+': {'min': 750, 'max': 1000, 'label': 'Elite', 'description': 'Nível elite - questões de alta complexidade'}
}


def get_recommended_range(predicted_score: float) -> str:
    """Get the recommended study range based on predicted score"""
    if predicted_score < 450:
        return '200-450'
    elif predicted_score < 550:
        return '450-550'
    elif predicted_score < 650:
        return '550-650'
    elif predicted_score < 750:
        return '650-750'
    else:
        return '750+'


@router.get("/areas")
async def list_areas(
    _: UserProfile = Depends(get_current_admin),
):
    """List available areas with content counts"""
    df = get_tri_content()

    areas = []
    for code, name in AREA_NAMES.items():
        area_df = df[df['area_code'] == code]
        areas.append({
            'code': code,
            'name': name,
            'total_content': len(area_df),
            'tri_min': float(area_df['tri_score'].min()) if len(area_df) > 0 else None,
            'tri_max': float(area_df['tri_score'].max()) if len(area_df) > 0 else None,
            'ranges': area_df.groupby('tri_range').size().to_dict()
        })

    return {
        'areas': areas,
        'total_content': len(df)
    }


@router.get("/ranges")
async def list_ranges(
    _: UserProfile = Depends(get_current_admin),
):
    """List available TRI ranges with descriptions"""
    return {
        'ranges': [
            {
                'code': code,
                **info
            }
            for code, info in TRI_RANGES.items()
        ]
    }


@router.get("/content/{area}")
async def get_area_content(
    area: str,
    tri_range: Optional[str] = None,
    habilidade: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    _: UserProfile = Depends(get_current_admin),
):
    """
    Get TRI content for an area

    Args:
        area: Area code (LC, CH, CN, MT)
        tri_range: Optional TRI range filter (200-450, 450-550, etc)
        habilidade: Optional skill filter (H1, H2, etc)
        limit: Max items to return
        offset: Pagination offset

    Returns:
        List of content items with TRI scores
    """
    area = area.upper()
    if area not in AREA_NAMES:
        raise HTTPException(status_code=400, detail=f"Invalid area. Use: {list(AREA_NAMES.keys())}")

    df = get_tri_content()
    filtered = df[df['area_code'] == area].copy()

    if tri_range and tri_range in TRI_RANGES:
        filtered = filtered[filtered['tri_range'] == tri_range]

    if habilidade:
        filtered = filtered[filtered['habilidade'] == habilidade.upper()]

    # Sort by TRI score
    filtered = filtered.sort_values('tri_score')

    total = len(filtered)
    items = filtered.iloc[offset:offset+limit]

    return {
        'area': area,
        'area_name': AREA_NAMES[area],
        'tri_range': tri_range,
        'total': total,
        'offset': offset,
        'limit': limit,
        'items': [
            {
                'habilidade': row['habilidade'],
                'descricao': row['descricao'],
                'tri_score': round(row['tri_score'], 1),
                'tri_range': row['tri_range']
            }
            for _, row in items.iterrows()
        ]
    }


@router.get("/recommend/{codigo_inep}")
async def get_recommended_content(
    codigo_inep: str,
    limit_per_area: int = Query(15, ge=1, le=100),
    _: UserProfile = Depends(get_authorized_school_user),
):
    """
    Get recommended study content based on school's predicted scores

    Uses the prediction model to determine appropriate TRI ranges
    for each area and returns targeted content with GLiNER-extracted entities.
    """
    # Import prediction model
    from ml.prediction_model import ENEMPredictionModel

    try:
        model = ENEMPredictionModel()
        predictions = model.predict_all_scores(codigo_inep)

        if 'error' in predictions:
            raise HTTPException(status_code=404, detail=predictions['error'])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")

    # Try to use GLiNER-enriched data if available
    df = get_tri_content_gliner()
    has_gliner = 'conceitos' in df.columns

    recommendations = []
    all_key_concepts = set()
    all_key_themes = set()

    # Check if predictions have actual scores
    scores = predictions.get('scores', {})
    if not scores:
        raise HTTPException(
            status_code=422,
            detail="Dados insuficientes para gerar um prediction assertivo para esta escola. "
                   "A escola pode não ter histórico suficiente no ENEM."
        )

    for area_code, area_name in AREA_NAMES.items():
        # Get predicted score for this area (keys are short: cn, ch, lc, mt)
        score_key = area_code.lower()
        predicted_score = scores.get(score_key)
        if predicted_score is None:
            continue  # Skip areas without prediction

        # Determine study range
        study_range = get_recommended_range(predicted_score)

        # Get content for this range
        area_df = df[(df['area_code'] == area_code) & (df['tri_range'] == study_range)]
        area_df = area_df.sort_values('tri_score')

        # Also get some content from the next range up (stretch goals)
        range_order = list(TRI_RANGES.keys())
        current_idx = range_order.index(study_range)
        stretch_range = range_order[min(current_idx + 1, len(range_order) - 1)]
        stretch_df = df[(df['area_code'] == area_code) & (df['tri_range'] == stretch_range)]

        # Extract key concepts and themes from GLiNER data
        area_concepts = []
        area_themes = []
        if has_gliner:
            for _, row in area_df.head(limit_per_area).iterrows():
                if pd.notna(row.get('conceitos')) and row['conceitos']:
                    concepts = [c.strip() for c in str(row['conceitos']).split(',') if c.strip()]
                    area_concepts.extend(concepts)
                    all_key_concepts.update(concepts)
                if pd.notna(row.get('temas')) and row['temas']:
                    themes = [t.strip() for t in str(row['temas']).split(',') if t.strip()]
                    area_themes.extend(themes)
                    all_key_themes.update(themes)

        # Build content items with GLiNER data
        sample_content = []
        for _, row in area_df.head(limit_per_area).iterrows():
            item = {
                'habilidade': row['habilidade'],
                'descricao': row['descricao'],
                'tri_score': round(row['tri_score'], 1)
            }
            if has_gliner:
                if pd.notna(row.get('conceitos')) and row['conceitos']:
                    item['conceitos'] = [c.strip() for c in str(row['conceitos']).split(',') if c.strip()]
                if pd.notna(row.get('temas')) and row['temas']:
                    item['temas'] = [t.strip() for t in str(row['temas']).split(',') if t.strip()]
            sample_content.append(item)

        recommendations.append({
            'area': area_code,
            'area_name': area_name,
            'predicted_score': round(predicted_score, 1),
            'recommended_range': study_range,
            'range_info': TRI_RANGES[study_range],
            'content_count': len(area_df),
            'key_concepts': list(set(area_concepts))[:10] if area_concepts else [],
            'key_themes': list(set(area_themes))[:8] if area_themes else [],
            'sample_content': sample_content,
            'stretch_goals': [
                {
                    'habilidade': row['habilidade'],
                    'descricao': row['descricao'],
                    'tri_score': round(row['tri_score'], 1)
                }
                for _, row in stretch_df.head(5).iterrows()
            ] if stretch_range != study_range else []
        })

    return {
        'codigo_inep': codigo_inep,
        'recommendations': recommendations,
        'gliner_enriched': has_gliner,
        'summary': {
            'total_key_concepts': len(all_key_concepts),
            'total_key_themes': len(all_key_themes),
            'top_concepts': list(all_key_concepts)[:15],
            'top_themes': list(all_key_themes)[:10]
        } if has_gliner else None,
        'download_available': True,
        'download_url': f'/api/tri-lists/download/{codigo_inep}'
    }


@router.get("/download/materials")
async def list_downloadable_materials():
    """List all downloadable study materials (PDFs/DOCXs)"""
    materials = []

    listas_dir = DADOS_DIR / "Listas TRI"
    if not listas_dir.exists():
        return {'materials': [], 'message': 'Materials directory not found'}

    for area_dir in listas_dir.iterdir():
        if not area_dir.is_dir() or area_dir.name.startswith('.'):
            continue

        area_name = area_dir.name
        # Normalize area name for matching (handle encoding variations)
        area_name_normalized = area_name.lower().replace('ê', 'e').replace('á', 'a')
        area_code = 'CN' if 'natureza' in area_name_normalized else \
                    'CH' if 'humanas' in area_name_normalized else \
                    'LC' if 'linguagens' in area_name_normalized else \
                    'MT' if 'matem' in area_name_normalized else area_name

        for range_dir in area_dir.iterdir():
            if not range_dir.is_dir() or range_dir.name.startswith('.'):
                continue

            tri_range = range_dir.name

            for file in range_dir.iterdir():
                if file.suffix.lower() in ['.pdf', '.docx']:
                    materials.append({
                        'area': area_code,
                        'area_name': area_name,
                        'tri_range': tri_range,
                        'filename': file.name,
                        'format': file.suffix[1:].upper(),
                        'size_kb': round(file.stat().st_size / 1024, 1),
                        'download_url': f'/api/tri-lists/download/file/{area_code}/{tri_range}/{file.name}'
                    })

    return {
        'materials': materials,
        'total': len(materials),
        'brand': 'X-TRI Escolas'
    }


@router.get("/download/file/{area}/{tri_range}/{filename}")
async def download_material(area: str, tri_range: str, filename: str):
    """Download a specific study material file"""
    area_names = {
        'CN': 'Ciências da Natureza',
        'CH': 'Ciências Humanas',
        'LC': 'Linguagens',
        'MT': 'Matemática'
    }

    area_name = area_names.get(area.upper())
    if not area_name:
        raise HTTPException(status_code=400, detail="Invalid area")

    file_path = DADOS_DIR / "Listas TRI" / area_name / tri_range / filename

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    # Security check - ensure path is within expected directory
    try:
        file_path.resolve().relative_to(DADOS_DIR.resolve())
    except ValueError:
        raise HTTPException(status_code=403, detail="Access denied")

    return FileResponse(
        path=str(file_path),
        filename=f"X-TRI_{area}_{tri_range}_{filename}",
        media_type='application/octet-stream'
    )


@router.get("/download/escola/{codigo_inep}")
async def get_school_materials(
    codigo_inep: str,
    _: UserProfile = Depends(get_authorized_school_user),
):
    """
    Get downloadable materials filtered by school's recommended TRI ranges.
    Returns only materials within the amplitude suitable for the school's level.
    """
    # Import prediction model
    from ml.prediction_model import ENEMPredictionModel

    try:
        model = ENEMPredictionModel()
        predictions = model.predict_all_scores(codigo_inep)

        if 'error' in predictions:
            raise HTTPException(status_code=404, detail=predictions['error'])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")

    # Get all materials
    listas_dir = DADOS_DIR / "Listas TRI"
    if not listas_dir.exists():
        return {'materials': [], 'message': 'Materials directory not found'}

    area_map = {
        'lc': ('LC', 'Linguagens'),
        'ch': ('CH', 'Ciências Humanas'),
        'cn': ('CN', 'Ciências da Natureza'),
        'mt': ('MT', 'Matemática')
    }

    scores = predictions.get('scores', {})
    if not scores:
        raise HTTPException(
            status_code=422,
            detail="Dados insuficientes para gerar um prediction assertivo para esta escola."
        )

    materials_by_area = {}

    for score_key, (area_code, area_name) in area_map.items():
        predicted_score = scores.get(score_key)
        if predicted_score is None:
            continue
        recommended_range = get_recommended_range(predicted_score)

        # Map recommended range to folder name patterns
        range_patterns = {
            '200-450': ['200', '200 - 500', '200-500', '300', '400', '450'],
            '450-550': ['450', '450 - 550', '450-550', '500', '500 - 550'],
            '550-650': ['550', '550 - 650', '550-650', '600', '600 - 650'],
            '650-750': ['650', '650 - 750', '650-750', '700'],
            '750+': ['750', '750+', '800', '850', '900']
        }

        patterns = range_patterns.get(recommended_range, [])

        # Find area directory
        area_dir = None
        for d in listas_dir.iterdir():
            if d.is_dir() and not d.name.startswith('.'):
                d_lower = d.name.lower()
                if ('natureza' in d_lower and area_code == 'CN') or \
                   ('humanas' in d_lower and area_code == 'CH') or \
                   ('linguagens' in d_lower and area_code == 'LC') or \
                   ('matem' in d_lower and area_code == 'MT'):
                    area_dir = d
                    break

        materials = []
        if area_dir:
            for range_dir in area_dir.iterdir():
                if not range_dir.is_dir() or range_dir.name.startswith('.'):
                    continue

                # Check if this folder matches any of our patterns
                folder_name = range_dir.name
                matches = any(pattern in folder_name for pattern in patterns)

                if matches:
                    for file in range_dir.iterdir():
                        if file.suffix.lower() in ['.pdf', '.docx']:
                            materials.append({
                                'filename': file.name,
                                'tri_range': folder_name,
                                'format': file.suffix[1:].upper(),
                                'size_kb': round(file.stat().st_size / 1024, 1),
                                'download_url': f'/api/tri-lists/download/file/{area_code}/{folder_name}/{file.name}'
                            })

        materials_by_area[area_code] = {
            'area_name': area_name,
            'predicted_score': round(predicted_score, 1),
            'recommended_range': recommended_range,
            'amplitude': TRI_RANGES[recommended_range],
            'materials': materials,
            'total_files': len(materials)
        }

    return {
        'codigo_inep': codigo_inep,
        'escola': predictions.get('escola', {}),
        'materials_by_area': materials_by_area,
        'total_materials': sum(m['total_files'] for m in materials_by_area.values())
    }


@router.get("/export/plano/{codigo_inep}")
async def export_improvement_plan(
    codigo_inep: str,
    _: UserProfile = Depends(get_authorized_school_user),
):
    """
    Export school's improvement plan as downloadable CSV with TRI amplitudes.
    Includes: areas, current scores, target scores, recommended TRI ranges, content suggestions.
    """
    import io
    import csv
    from fastapi.responses import StreamingResponse
    from ml.prediction_model import ENEMPredictionModel
    from ml.recommendation_engine import RecommendationEngine

    try:
        # Get predictions
        model = ENEMPredictionModel()
        predictions = model.predict_all_scores(codigo_inep)

        if 'error' in predictions:
            raise HTTPException(status_code=404, detail=predictions['error'])

        # Get recommendations
        rec_engine = RecommendationEngine()
        roadmap = rec_engine.generate_roadmap(codigo_inep)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating plan: {str(e)}")

    # Get TRI content for recommendations
    df = get_tri_content()

    # Create CSV content
    output = io.StringIO()
    writer = csv.writer(output, delimiter=';')

    # Header
    writer.writerow(['PLANO DE MELHORIA - ENEM', '', '', '', ''])
    writer.writerow(['Escola:', predictions.get('escola', {}).get('nome', codigo_inep)])
    writer.writerow(['Código INEP:', codigo_inep])
    writer.writerow(['Data:', pd.Timestamp.now().strftime('%d/%m/%Y')])
    writer.writerow([])

    # Scores summary
    writer.writerow(['=== RESUMO DE SCORES ==='])
    writer.writerow(['Área', 'Score Atual', 'Meta', 'Amplitude TRI Recomendada', 'Faixa Min', 'Faixa Max'])

    area_names = {
        'lc': 'Linguagens e Códigos',
        'ch': 'Ciências Humanas',
        'cn': 'Ciências da Natureza',
        'mt': 'Matemática'
    }

    scores = predictions.get('scores', {})
    if not scores:
        raise HTTPException(
            status_code=422,
            detail="Dados insuficientes para gerar um prediction assertivo para esta escola."
        )

    for area_key, area_name in area_names.items():
        score = scores.get(area_key)
        if score is None:
            continue
        target = score + 50  # Meta de melhoria
        rec_range = get_recommended_range(score)
        range_info = TRI_RANGES[rec_range]

        writer.writerow([
            area_name,
            f"{score:.1f}",
            f"{target:.1f}",
            rec_range,
            range_info['min'],
            range_info['max']
        ])

    writer.writerow([])

    # Detailed content by area
    writer.writerow(['=== CONTEÚDOS POR AMPLITUDE TRI ==='])

    for area_key, area_name in area_names.items():
        area_code = area_key.upper()
        score = scores.get(area_key)
        if score is None:
            continue
        rec_range = get_recommended_range(score)

        writer.writerow([])
        writer.writerow([f'--- {area_name} ({area_code}) ---'])
        writer.writerow([f'Score Predito: {score:.1f}', f'Amplitude: {rec_range}'])
        writer.writerow(['Habilidade', 'Descrição', 'TRI Score', 'Nível'])

        # Filter content by area and range
        area_df = df[(df['area_code'] == area_code)]
        range_info = TRI_RANGES[rec_range]
        area_df = area_df[(area_df['tri_score'] >= range_info['min']) & (area_df['tri_score'] <= range_info['max'])]
        area_df = area_df.sort_values('tri_score')

        for _, row in area_df.head(20).iterrows():
            writer.writerow([
                row['habilidade'],
                row['descricao'][:100],
                f"{row['tri_score']:.1f}",
                row.get('tri_range', rec_range)
            ])

    writer.writerow([])

    # Roadmap phases
    if roadmap and 'phases' in roadmap:
        writer.writerow(['=== FASES DO PLANO DE MELHORIA ==='])
        writer.writerow(['Fase', 'Objetivo', 'Ganho Esperado', 'Ações'])

        for phase in roadmap['phases']:
            actions = '; '.join(phase.get('actions', [])[:3])
            writer.writerow([
                phase.get('name', ''),
                phase.get('objective', ''),
                f"+{phase.get('expected_gain', 0):.0f} pts",
                actions
            ])

    writer.writerow([])
    writer.writerow(['Gerado por X-TRI Escolas - Sistema de Análise ENEM'])

    # Create response
    output.seek(0)
    escola_nome = predictions.get('escola', {}).get('nome', codigo_inep).replace(' ', '_')[:30]

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type='text/csv',
        headers={
            'Content-Disposition': f'attachment; filename=Plano_Melhoria_{escola_nome}_{codigo_inep}.csv'
        }
    )


@router.get("/skills/{area}")
async def get_area_skills(
    area: str,
    _: UserProfile = Depends(get_current_admin),
):
    """Get all skills (habilidades) for an area with content distribution"""
    area = area.upper()
    if area not in AREA_NAMES:
        raise HTTPException(status_code=400, detail=f"Invalid area. Use: {list(AREA_NAMES.keys())}")

    df = get_tri_content()
    area_df = df[df['area_code'] == area]

    skills = []
    for hab in sorted(area_df['habilidade'].unique()):
        hab_df = area_df[area_df['habilidade'] == hab]
        skills.append({
            'code': hab,
            'content_count': len(hab_df),
            'tri_min': round(hab_df['tri_score'].min(), 1),
            'tri_max': round(hab_df['tri_score'].max(), 1),
            'tri_avg': round(hab_df['tri_score'].mean(), 1),
            'ranges': hab_df.groupby('tri_range').size().to_dict()
        })

    return {
        'area': area,
        'area_name': AREA_NAMES[area],
        'total_skills': len(skills),
        'skills': skills
    }
