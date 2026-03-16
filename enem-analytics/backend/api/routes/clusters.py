"""
Clustering API endpoints for ENEM Analytics
School personas and similar schools
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
import sys
from pathlib import Path

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from ml.clustering_model import SchoolClusteringModel
from data.year_resolver import get_latest_year_from_df, get_previous_year_from_df
from api.auth.authorization import get_authorized_school_user
from api.auth.supabase_dependencies import UserProfile, get_current_admin

router = APIRouter(prefix="/api/clusters", tags=["clusters"])

# Initialize model (lazy loading)
_clustering_model = None


def get_clustering_model() -> SchoolClusteringModel:
    """Get or create clustering model instance"""
    global _clustering_model
    if _clustering_model is None:
        _clustering_model = SchoolClusteringModel()
        if not _clustering_model.load_model():
            # Train if not available
            print("Training clustering model...")
            result = _clustering_model.train()
            print(f"Trained with {result.get('n_samples', 0)} samples")
    return _clustering_model


@router.get("/personas")
async def get_all_personas(
    _: UserProfile = Depends(get_current_admin),
):
    """
    Get all school personas (cluster descriptions)

    Returns:
        List of cluster personas with descriptions
    """
    model = get_clustering_model()
    return {
        'personas': model.get_cluster_summary()
    }


@router.get("/train")
async def train_model(
    _: UserProfile = Depends(get_current_admin),
):
    """
    Train or retrain the clustering model

    Returns:
        Training metrics
    """
    model = get_clustering_model()
    result = model.train()

    if 'error' in result:
        raise HTTPException(status_code=500, detail=result['error'])

    return result


@router.get("/{codigo_inep}/cluster")
async def get_school_cluster(
    codigo_inep: str,
    _: UserProfile = Depends(get_authorized_school_user),
):
    """
    Get cluster/persona for a specific school

    Args:
        codigo_inep: School INEP code

    Returns:
        Cluster information including persona and scores
    """
    model = get_clustering_model()

    result = model.predict_cluster(codigo_inep)

    if result is None:
        raise HTTPException(status_code=404, detail="School not found or insufficient data")

    return result


@router.get("/{codigo_inep}/similar")
async def get_similar_schools(
    codigo_inep: str,
    limit: int = Query(10, ge=1, le=50),
    same_cluster: bool = Query(True),
    _: UserProfile = Depends(get_authorized_school_user),
):
    """
    Find schools similar to the given school

    Args:
        codigo_inep: School INEP code
        limit: Maximum number of similar schools
        same_cluster: Only include schools from the same cluster

    Returns:
        List of similar schools sorted by similarity
    """
    model = get_clustering_model()

    # First get the school's cluster
    school_cluster = model.predict_cluster(codigo_inep)
    if school_cluster is None:
        raise HTTPException(status_code=404, detail="School not found")

    similar = model.get_similar_schools(codigo_inep, limit, same_cluster)

    return {
        'codigo_inep': codigo_inep,
        'school_cluster': school_cluster,
        'similar_schools': similar
    }


@router.get("/{codigo_inep}/similar-improved")
async def get_similar_improved_schools(
    codigo_inep: str,
    limit: int = Query(10, ge=1, le=50),
    min_improvement: float = Query(10.0, ge=0),
    _: UserProfile = Depends(get_authorized_school_user),
):
    """
    Find similar schools that improved significantly

    These are schools that:
    - Had similar scores to the target school in the previous cycle
    - Improved by at least min_improvement points in the latest cycle

    Args:
        codigo_inep: School INEP code
        limit: Maximum number of schools
        min_improvement: Minimum improvement in nota_media

    Returns:
        List of similar schools that improved
    """
    model = get_clustering_model()

    # Get school's cluster first
    school_cluster = model.predict_cluster(codigo_inep)
    if school_cluster is None:
        raise HTTPException(status_code=404, detail="School not found")

    improved = model.get_improved_similar_schools(codigo_inep, limit, min_improvement)

    return {
        'codigo_inep': codigo_inep,
        'school_cluster': school_cluster,
        'improved_similar_schools': improved,
        'insight': f'Schools similar to yours that improved by {min_improvement}+ points in the latest cycle'
    }


@router.get("/stats")
async def get_cluster_stats(
    _: UserProfile = Depends(get_current_admin),
):
    """
    Get statistics about the clustering

    Returns:
        Cluster distribution and statistics
    """
    model = get_clustering_model()

    if model.df is None:
        model.df = model._load_data()

    # Get cluster distribution
    summary = model.get_cluster_summary()

    # Calculate sizes
    latest_year = get_latest_year_from_df(model.df)
    previous_year = get_previous_year_from_df(model.df, latest_year)
    if latest_year is None:
        raise HTTPException(status_code=500, detail="No ENEM cycle available for clustering stats")

    df_latest = model.df[model.df['ano'] == latest_year]
    cluster_sizes = {}

    for _, row in df_latest.iterrows():
        cluster_info = model.predict_cluster(row['codigo_inep'])
        if cluster_info:
            cluster = cluster_info['cluster']
            cluster_sizes[cluster] = cluster_sizes.get(cluster, 0) + 1

    # Add sizes to summary
    for s in summary:
        s['size'] = cluster_sizes.get(s['cluster'], 0)

    return {
        'year': latest_year,
        'comparison_years': {'previous': previous_year, 'current': latest_year},
        'n_clusters': model.n_clusters,
        'cluster_summary': summary,
        'total_schools': sum(cluster_sizes.values())
    }
