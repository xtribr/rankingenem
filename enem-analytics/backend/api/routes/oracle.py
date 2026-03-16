"""
Rotas do Oráculo ENEM - Predições para 2026
"""

from fastapi import APIRouter, Depends, HTTPException
from typing import Optional, List
import json
from pathlib import Path

from api.auth.supabase_dependencies import UserProfile, get_current_admin

router = APIRouter(prefix="/api/oracle", tags=["oracle"])

# Load predictions from file (relative to backend/data/)
PREDICTIONS_FILE = Path(__file__).parent.parent.parent / "data" / "predictions_2026.json"


def load_predictions():
    """Load predictions from JSON file."""
    if not PREDICTIONS_FILE.exists():
        return None

    with open(PREDICTIONS_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)


@router.get("/predictions")
async def get_all_predictions(
    limit: Optional[int] = None,
    area: Optional[str] = None,
    tipo: Optional[str] = None,
    _: UserProfile = Depends(get_current_admin),
):
    """
    Retorna todas as predições do Oráculo para ENEM 2026.

    Args:
        limit: Limitar número de resultados
        area: Filtrar por área (Linguagens, Humanas, Natureza, Matematica)
        tipo: Filtrar por tipo (Recorrente, Frequente, Ocasional)

    Returns:
        Lista de predições rankeadas por probabilidade
    """
    data = load_predictions()
    if not data:
        raise HTTPException(status_code=404, detail="Predições não encontradas")

    predictions = data.get("predicoes_temas", [])

    # Filter by area (case insensitive)
    if area:
        predictions = [p for p in predictions if p["area"].lower() == area.lower()]

    # Filter by tipo
    if tipo:
        predictions = [p for p in predictions if tipo.lower() in p["tipo"].lower()]

    # Limit results
    if limit:
        predictions = predictions[:limit]

    return {
        "total": len(predictions),
        "ano_predicao": data.get("ano_predicao"),
        "gerado_em": data.get("gerado_em"),
        "modelo": data.get("modelo"),
        "versao": data.get("versao"),
        "metodologia": data.get("metodologia"),
        "predicoes": predictions
    }


@router.get("/predictions/{area}")
async def get_predictions_by_area(
    area: str,
    limit: Optional[int] = 10,
    _: UserProfile = Depends(get_current_admin),
):
    """
    Retorna predições para uma área específica.

    Args:
        area: Nome da área (linguagens, humanas, natureza, matematica)
        limit: Número máximo de predições

    Returns:
        Predições filtradas por área
    """
    # Normalize area names
    area_map = {
        "linguagens": "Linguagens",
        "languages": "Linguagens",
        "humanas": "Ciências Humanas",
        "human-sciences": "Ciências Humanas",
        "natureza": "Ciências da Natureza",
        "natural-sciences": "Ciências da Natureza",
        "matematica": "Matemática",
        "mathematics": "Matemática"
    }

    normalized_area = area_map.get(area.lower(), area)

    data = load_predictions()
    if not data:
        raise HTTPException(status_code=404, detail="Predições não encontradas")

    predictions = [
        p for p in data.get("predicoes_temas", [])
        if p["area"] == normalized_area
    ]

    if not predictions:
        raise HTTPException(
            status_code=404,
            detail=f"Área não encontrada: {area}. Áreas válidas: linguagens, humanas, natureza, matematica"
        )

    return {
        "area": normalized_area,
        "total": len(predictions[:limit]),
        "predicoes": predictions[:limit]
    }


@router.get("/skills")
async def get_skill_predictions(
    area: Optional[str] = None,
    _: UserProfile = Depends(get_current_admin),
):
    """
    Retorna predições de habilidades mais prováveis.

    Args:
        area: Filtrar por área específica

    Returns:
        Predições de habilidades por área
    """
    data = load_predictions()
    if not data:
        raise HTTPException(status_code=404, detail="Predições não encontradas")

    skills = data.get("predicoes_habilidades", {})

    if area:
        area_map = {
            "linguagens": "Linguagens",
            "humanas": "Ciências Humanas",
            "natureza": "Ciências da Natureza",
            "matematica": "Matemática"
        }
        normalized_area = area_map.get(area.lower(), area)
        if normalized_area in skills:
            return {normalized_area: skills[normalized_area]}
        raise HTTPException(status_code=404, detail=f"Área não encontrada: {area}")

    return skills


@router.get("/summary")
async def get_oracle_summary(
    _: UserProfile = Depends(get_current_admin),
):
    """
    Retorna um resumo das predições do Oráculo.

    Returns:
        Resumo com estatísticas e top predições
    """
    data = load_predictions()
    if not data:
        raise HTTPException(status_code=404, detail="Predições não encontradas")

    predictions = data.get("predicoes_temas", [])

    # Group by area
    by_area = {}
    for p in predictions:
        area = p["area"]
        if area not in by_area:
            by_area[area] = []
        by_area[area].append(p)

    # Top 5 per area
    top_by_area = {
        area: sorted(preds, key=lambda x: x["probabilidade"], reverse=True)[:5]
        for area, preds in by_area.items()
    }

    return {
        "ano_predicao": data.get("ano_predicao"),
        "gerado_em": data.get("gerado_em"),
        "modelo": data.get("modelo"),
        "total_predicoes": len(predictions),
        "areas": list(by_area.keys()),
        "metodologia": data.get("metodologia"),
        "top_10_geral": predictions[:10],
        "top_5_por_area": top_by_area
    }


@router.get("/metodologia")
async def get_methodology(
    _: UserProfile = Depends(get_current_admin),
):
    """
    Retorna informações sobre a metodologia do Oráculo.

    Returns:
        Descrição da metodologia e fontes utilizadas
    """
    data = load_predictions()
    if not data:
        raise HTTPException(status_code=404, detail="Predições não encontradas")

    return {
        "modelo": data.get("modelo"),
        "metodologia": data.get("metodologia"),
        "total_predicoes": data.get("total_predicoes"),
        "areas_cobertas": data.get("areas")
    }
