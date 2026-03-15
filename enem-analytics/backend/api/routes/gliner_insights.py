"""
GLiNER Enhanced Insights API

Provides rich educational analytics using GLiNER-extracted entities:
- Concept analysis per area with confidence scores
- Theme distribution and trends
- Skill-concept mapping
- Cognitive skills breakdown
- Knowledge graph data
"""

import os
import sys
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple, Set
from collections import Counter
from difflib import SequenceMatcher
import pandas as pd
from fastapi import APIRouter, HTTPException, Query


def levenshtein_ratio(s1: str, s2: str) -> float:
    """Calculate similarity ratio between two strings using SequenceMatcher."""
    return SequenceMatcher(None, s1.lower(), s2.lower()).ratio()


def find_similar_labels(labels: List[Tuple[str, str, str]], threshold: float = 0.7) -> List[Dict]:
    """
    Find similar labels that might be duplicates or related concepts.

    Args:
        labels: List of (node_id, label, area) tuples
        threshold: Minimum similarity ratio to consider as match

    Returns:
        List of similarity matches with scores
    """
    matches = []
    n = len(labels)

    for i in range(n):
        id1, label1, area1 = labels[i]
        label1_lower = label1.lower().strip()

        for j in range(i + 1, n):
            id2, label2, area2 = labels[j]
            label2_lower = label2.lower().strip()

            # Skip if same area (we want cross-area connections)
            # But still detect duplicates within same area for reporting

            # Calculate similarity
            ratio = levenshtein_ratio(label1_lower, label2_lower)

            # Also check for prefix/suffix matches
            is_prefix = label1_lower.startswith(label2_lower[:min(8, len(label2_lower))]) or \
                       label2_lower.startswith(label1_lower[:min(8, len(label1_lower))])

            # Check for word overlap
            words1 = set(label1_lower.split())
            words2 = set(label2_lower.split())
            word_overlap = len(words1 & words2) / max(len(words1 | words2), 1)

            # Combine scores
            combined_score = max(ratio, word_overlap * 0.9)
            if is_prefix and len(label1_lower) > 5 and len(label2_lower) > 5:
                combined_score = max(combined_score, 0.75)

            if combined_score >= threshold:
                matches.append({
                    'node1_id': id1,
                    'node2_id': id2,
                    'label1': label1,
                    'label2': label2,
                    'area1': area1,
                    'area2': area2,
                    'similarity': round(combined_score, 3),
                    'is_cross_area': area1 != area2,
                    'match_type': 'exact' if ratio > 0.95 else ('prefix' if is_prefix else 'similar')
                })

    return sorted(matches, key=lambda x: -x['similarity'])

# Data paths
DADOS_DIR = Path(__file__).parent.parent.parent / "data"

router = APIRouter()

# Cache the GLiNER data
_gliner_df: Optional[pd.DataFrame] = None


def get_gliner_data() -> pd.DataFrame:
    """Load GLiNER-enriched TRI content data."""
    global _gliner_df
    if _gliner_df is None:
        gliner_path = DADOS_DIR / "conteudos_tri_gliner.csv"
        if not gliner_path.exists():
            raise HTTPException(status_code=500, detail="GLiNER data not found")
        # Use quoting=1 (QUOTE_ALL) to properly handle fields with commas
        _gliner_df = pd.read_csv(gliner_path, quoting=1)
    return _gliner_df


def parse_list_field(value: Any) -> List[str]:
    """Parse comma-separated field into list."""
    if pd.isna(value) or not value:
        return []
    return [item.strip() for item in str(value).split(',') if item.strip()]


def parse_confidence_field(value: Any) -> List[float]:
    """Parse comma-separated confidence scores into list of floats."""
    if pd.isna(value) or not value:
        return []
    result = []
    for item in str(value).split(','):
        item = item.strip()
        try:
            result.append(float(item))
        except (ValueError, TypeError):
            result.append(0.0)
    return result


AREA_NAMES = {
    'CN': 'Ciências da Natureza',
    'CH': 'Ciências Humanas',
    'LC': 'Linguagens e Códigos',
    'MT': 'Matemática'
}

AREA_COLORS = {
    'CN': '#22c55e',  # green
    'CH': '#8b5cf6',  # purple
    'LC': '#ec4899',  # pink
    'MT': '#f97316'   # orange
}

# Entity type descriptions for enhanced extraction - compound phrases only
ENTITY_DEFINITIONS = {
    "conceito_cientifico": "Teoria científica, lei física, princípio químico ou fenômeno biológico composto (ex: 'teoria da evolução', 'lei de gravitação universal', 'efeito estufa', 'cadeia alimentar')",
    "campo_semantico": "Campo semântico ou área temática educacional composta (ex: 'movimentos sociais no Brasil', 'revolução industrial', 'literatura modernista')",
    "campo_lexical": "Campo lexical ou domínio de conhecimento específico (ex: 'termodinâmica', 'genética molecular', 'história colonial')",
    "processo_fenomeno": "Processo, fenômeno ou transformação descrita em frase (ex: 'urbanização acelerada', 'degradação ambiental', 'exclusão social')",
    "contexto_historico": "Período, movimento ou contexto histórico-social específico (ex: 'Era Vargas', 'Ditadura Militar', 'Período Colonial')",
    "habilidade_composta": "Habilidade ou competência cognitiva composta (ex: 'análise crítica de textos', 'interpretação de gráficos')"
}

# Column mappings for the new entity types
ENTITY_COLUMNS = {
    'conceitos_cientificos': 'conceito_cientifico',
    'campos_semanticos': 'campo_semantico',
    'campos_lexicais': 'campo_lexical',
    'processos_fenomenos': 'processo_fenomeno',
    'contextos_historicos': 'contexto_historico',
    'habilidades_compostas': 'habilidade_composta',
    'all_entities': 'all_entities'
}


@router.get("/school/{codigo_inep}/concepts")
async def get_school_concept_analysis(
    codigo_inep: str,
    top_n: int = Query(20, ge=5, le=100)
) -> Dict[str, Any]:
    """
    Get comprehensive concept analysis for a school based on their performance gaps.

    Returns:
    - Priority concepts by area (concepts the school needs to focus on)
    - Concept frequency distribution
    - Related themes for each concept
    - Skill-concept mapping
    """
    from ml.prediction_model import ENEMPredictionModel

    try:
        model = ENEMPredictionModel()
        predictions = model.predict_all_scores(codigo_inep)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")

    df = get_gliner_data()

    area_analyses = []
    all_priority_concepts = []

    for area_code in ['CN', 'CH', 'LC', 'MT']:
        score_key = area_code.lower()
        predicted_score = predictions.get('scores', {}).get(score_key, 550)

        # Get content relevant to this school's level
        area_df = df[df['area_code'] == area_code].copy()

        # Filter by appropriate TRI range (more inclusive to capture entities)
        # Use broader ranges to ensure we get content with extracted entities
        if predicted_score >= 650:
            # High performers: focus on 550+ difficulty
            area_df = area_df[area_df['tri_score'] >= 500]
        elif predicted_score >= 500:
            # Medium performers: all difficulty ranges
            area_df = area_df[(area_df['tri_score'] >= 350) & (area_df['tri_score'] < 800)]
        else:
            # Lower performers: focus on foundation and intermediate
            area_df = area_df[area_df['tri_score'] < 650]

        # Extract all entities using new compound phrase columns
        concepts: Counter = Counter()  # conceitos_cientificos
        semantic_fields: Counter = Counter()  # campos_semanticos
        lexical_fields: Counter = Counter()  # campos_lexicais
        processes: Counter = Counter()  # processos_fenomenos
        historical_contexts: Counter = Counter()  # contextos_historicos
        compound_skills: Counter = Counter()  # habilidades_compostas

        concept_semantic: Dict[str, set] = {}  # concept -> related semantic fields
        concept_lexical: Dict[str, set] = {}  # concept -> related lexical fields
        concept_skill_codes: Dict[str, set] = {}  # concept -> related ENEM skills
        concept_confidences: Dict[str, List[float]] = {}  # concept -> list of real model confidences

        for _, row in area_df.iterrows():
            row_concepts = parse_list_field(row.get('conceitos_cientificos'))
            row_concept_confs = parse_confidence_field(row.get('conceitos_cientificos_confidence'))
            row_semantic = parse_list_field(row.get('campos_semanticos'))
            row_lexical = parse_list_field(row.get('campos_lexicais'))
            row_processes = parse_list_field(row.get('processos_fenomenos'))
            row_historical = parse_list_field(row.get('contextos_historicos'))
            row_compound_skills = parse_list_field(row.get('habilidades_compostas'))

            for i, c in enumerate(row_concepts):
                concepts[c] += 1
                if c not in concept_semantic:
                    concept_semantic[c] = set()
                concept_semantic[c].update(row_semantic)

                if c not in concept_lexical:
                    concept_lexical[c] = set()
                concept_lexical[c].update(row_lexical)

                if c not in concept_skill_codes:
                    concept_skill_codes[c] = set()
                concept_skill_codes[c].add(row.get('habilidade', ''))

                # Collect real model confidence scores
                if c not in concept_confidences:
                    concept_confidences[c] = []
                if i < len(row_concept_confs) and row_concept_confs[i] > 0:
                    concept_confidences[c].append(row_concept_confs[i])

            semantic_fields.update(row_semantic)
            lexical_fields.update(row_lexical)
            processes.update(row_processes)
            historical_contexts.update(row_historical)
            compound_skills.update(row_compound_skills)

        # Build concept details with real model confidence
        concept_details = []
        total_concepts = sum(concepts.values())
        for concept, count in concepts.most_common(top_n):
            freq = count / total_concepts if total_concepts > 0 else 0

            # Use real GLiNER confidence (average across occurrences)
            real_confs = concept_confidences.get(concept, [])
            avg_confidence = sum(real_confs) / len(real_confs) if real_confs else None

            concept_details.append({
                'concept': concept,
                'count': count,
                'frequency': round(freq * 100, 1),
                'confidence': round(avg_confidence, 4) if avg_confidence is not None else None,
                'semantic_fields': list(concept_semantic.get(concept, set()))[:5],
                'lexical_fields': list(concept_lexical.get(concept, set()))[:3],
                'related_skills': list(concept_skill_codes.get(concept, set()))[:3],
                'importance': 'high' if freq > 0.1 else 'medium' if freq > 0.05 else 'low'
            })
            all_priority_concepts.append({
                'concept': concept,
                'area': area_code,
                'area_name': AREA_NAMES[area_code],
                'frequency': round(freq * 100, 1)
            })

        area_analyses.append({
            'area': area_code,
            'area_name': AREA_NAMES[area_code],
            'color': AREA_COLORS[area_code],
            'predicted_score': round(predicted_score, 0),
            'total_content_items': len(area_df),
            'unique_concepts': len(concepts),
            'unique_semantic_fields': len(semantic_fields),
            'unique_lexical_fields': len(lexical_fields),
            'top_concepts': concept_details,
            'semantic_fields': [
                {'field': field, 'count': count}
                for field, count in semantic_fields.most_common(10)
            ],
            'lexical_fields': [
                {'field': field, 'count': count}
                for field, count in lexical_fields.most_common(8)
            ],
            'processes_phenomena': [
                {'process': p, 'count': count}
                for p, count in processes.most_common(5)
            ],
            'historical_contexts': [
                {'context': ctx, 'count': count}
                for ctx, count in historical_contexts.most_common(5)
            ],
            'compound_skills': [
                {'skill': skill, 'count': count}
                for skill, count in compound_skills.most_common(5)
            ]
        })

    # Sort all concepts by frequency
    all_priority_concepts.sort(key=lambda x: x['frequency'], reverse=True)

    return {
        'codigo_inep': codigo_inep,
        'area_analyses': area_analyses,
        'priority_concepts': all_priority_concepts[:30],
        'entity_definitions': ENTITY_DEFINITIONS,
        'summary': {
            'total_areas': 4,
            'total_unique_concepts': sum(a['unique_concepts'] for a in area_analyses),
            'total_semantic_fields': sum(a['unique_semantic_fields'] for a in area_analyses),
            'total_lexical_fields': sum(a['unique_lexical_fields'] for a in area_analyses)
        }
    }


@router.get("/school/{codigo_inep}/knowledge-graph")
async def get_knowledge_graph(
    codigo_inep: str,
    area: Optional[str] = Query(None, regex="^(CN|CH|LC|MT)$")
) -> Dict[str, Any]:
    """
    Get knowledge graph data showing relationships between concepts, themes, and skills.

    Returns nodes (concepts, themes, skills) and edges (relationships) for visualization.
    Each node includes its primary area for proper clustering.
    """
    from ml.prediction_model import ENEMPredictionModel

    try:
        model = ENEMPredictionModel()
        predictions = model.predict_all_scores(codigo_inep)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")

    df = get_gliner_data()

    if area:
        df = df[df['area_code'] == area]

    nodes = []
    edges = []
    node_ids = set()

    # Track concept-semantic and concept-lexical relationships
    concept_semantic_edges = Counter()
    concept_lexical_edges = Counter()
    concept_process_edges = Counter()
    semantic_counts = Counter()
    lexical_counts = Counter()
    concept_counts = Counter()

    # Track area distribution for each entity (for proper clustering)
    concept_areas: Dict[str, Counter] = {}
    semantic_areas: Dict[str, Counter] = {}
    lexical_areas: Dict[str, Counter] = {}

    for _, row in df.iterrows():
        concepts = parse_list_field(row.get('conceitos_cientificos'))
        semantic_fields = parse_list_field(row.get('campos_semanticos'))
        lexical_fields = parse_list_field(row.get('campos_lexicais'))
        processes = parse_list_field(row.get('processos_fenomenos'))
        row_area = row.get('area_code', '')

        for concept in concepts:
            concept_counts[concept] += 1
            # Track which area this concept appears in
            if concept not in concept_areas:
                concept_areas[concept] = Counter()
            concept_areas[concept][row_area] += 1

            for sem in semantic_fields:
                semantic_counts[sem] += 1
                if sem not in semantic_areas:
                    semantic_areas[sem] = Counter()
                semantic_areas[sem][row_area] += 1
                edge_key = (concept, sem)
                concept_semantic_edges[edge_key] += 1

            for lex in lexical_fields:
                lexical_counts[lex] += 1
                if lex not in lexical_areas:
                    lexical_areas[lex] = Counter()
                lexical_areas[lex][row_area] += 1
                concept_lexical_edges[(concept, lex)] += 1

            for proc in processes:
                concept_process_edges[(concept, proc)] += 1

    def get_primary_area(area_counter: Counter) -> str:
        """Get the most common area for an entity."""
        if not area_counter:
            return 'CN'  # Default
        return area_counter.most_common(1)[0][0]

    def get_area_distribution(area_counter: Counter) -> Dict[str, int]:
        """Get the full area distribution for interdisciplinary concepts."""
        return dict(area_counter)

    # Track which labels have already been added PER TYPE (to avoid duplicates within same type)
    added_concept_labels: set = set()
    added_semantic_labels: set = set()
    added_lexical_labels: set = set()

    def normalize_label(label: str) -> str:
        """Normalize label for deduplication comparison."""
        return label.lower().strip()

    # Dynamic limits: more nodes when showing all areas (4x for 4 areas)
    multiplier = 1 if area else 4
    concept_limit = 30 * multiplier
    semantic_limit = 20 * multiplier
    lexical_limit = 20 * multiplier  # Increased to match semantic
    concept_semantic_edge_limit = 80 * multiplier
    concept_lexical_edge_limit = 60 * multiplier

    # Add concept nodes - scientific concepts in blue (highest priority)
    for concept, count in concept_counts.most_common(concept_limit):
        normalized = normalize_label(concept)
        if normalized in added_concept_labels:
            continue  # Skip duplicate within same type
        node_id = f"concept_{concept}"
        if node_id not in node_ids:
            primary_area = get_primary_area(concept_areas.get(concept, Counter()))
            area_dist = get_area_distribution(concept_areas.get(concept, Counter()))
            nodes.append({
                'id': node_id,
                'label': concept,
                'type': 'conceito_cientifico',
                'size': min(40, 15 + count * 2),
                'color': '#3b82f6',  # blue
                'count': count,
                'area': primary_area,
                'area_name': AREA_NAMES.get(primary_area, primary_area),
                'area_distribution': area_dist,
                'is_interdisciplinary': len(area_dist) > 1
            })
            node_ids.add(node_id)
            added_concept_labels.add(normalized)

    # Add semantic field nodes - purple (second priority)
    for sem, count in semantic_counts.most_common(semantic_limit):
        normalized = normalize_label(sem)
        if normalized in added_semantic_labels:
            continue  # Skip duplicate within same type
        node_id = f"semantic_{sem}"
        if node_id not in node_ids:
            primary_area = get_primary_area(semantic_areas.get(sem, Counter()))
            area_dist = get_area_distribution(semantic_areas.get(sem, Counter()))
            nodes.append({
                'id': node_id,
                'label': sem,
                'type': 'campo_semantico',
                'size': min(35, 12 + count * 1.5),
                'color': '#8b5cf6',  # purple
                'count': count,
                'area': primary_area,
                'area_name': AREA_NAMES.get(primary_area, primary_area),
                'area_distribution': area_dist,
                'is_interdisciplinary': len(area_dist) > 1
            })
            node_ids.add(node_id)
            added_semantic_labels.add(normalized)

    # Add lexical field nodes - green
    for lex, count in lexical_counts.most_common(lexical_limit):
        normalized = normalize_label(lex)
        if normalized in added_lexical_labels:
            continue  # Skip duplicate within same type
        node_id = f"lexical_{lex}"
        if node_id not in node_ids:
            primary_area = get_primary_area(lexical_areas.get(lex, Counter()))
            area_dist = get_area_distribution(lexical_areas.get(lex, Counter()))
            nodes.append({
                'id': node_id,
                'label': lex,
                'type': 'campo_lexical',
                'size': min(30, 10 + count * 1.2),
                'color': '#22c55e',  # green
                'count': count,
                'area': primary_area,
                'area_name': AREA_NAMES.get(primary_area, primary_area),
                'area_distribution': area_dist,
                'is_interdisciplinary': len(area_dist) > 1
            })
            node_ids.add(node_id)
            added_lexical_labels.add(normalized)

    # Add edges (concept-semantic relationships)
    for (concept, sem), weight in concept_semantic_edges.most_common(concept_semantic_edge_limit):
        source_id = f"concept_{concept}"
        target_id = f"semantic_{sem}"
        if source_id in node_ids and target_id in node_ids:
            edges.append({
                'source': source_id,
                'target': target_id,
                'weight': weight,
                'type': 'concept-semantic'
            })

    # Add edges (concept-lexical relationships)
    for (concept, lex), weight in concept_lexical_edges.most_common(concept_lexical_edge_limit):
        source_id = f"concept_{concept}"
        target_id = f"lexical_{lex}"
        if source_id in node_ids and target_id in node_ids:
            edges.append({
                'source': source_id,
                'target': target_id,
                'weight': weight,
                'type': 'concept-lexical'
            })

    # Add interdisciplinary edges (cross-area connections)
    # Connect concepts from different areas that share semantic/lexical fields
    added_interdisciplinary = set()

    # Find semantic fields that appear in multiple areas
    for sem, sem_area_dist in semantic_areas.items():
        if len(sem_area_dist) > 1:  # Appears in multiple areas
            sem_id = f"semantic_{sem}"
            if sem_id not in node_ids:
                continue

            # Get all concepts connected to this semantic field
            connected_concepts = [
                concept for (concept, s), _ in concept_semantic_edges.items()
                if s == sem and f"concept_{concept}" in node_ids
            ]

            # Create edges between concepts from different areas through this semantic field
            for i, c1 in enumerate(connected_concepts):
                c1_area = get_primary_area(concept_areas.get(c1, Counter()))
                for c2 in connected_concepts[i+1:]:
                    c2_area = get_primary_area(concept_areas.get(c2, Counter()))
                    if c1_area != c2_area:  # Different areas = interdisciplinary
                        edge_key = tuple(sorted([f"concept_{c1}", f"concept_{c2}"]))
                        if edge_key not in added_interdisciplinary:
                            edges.append({
                                'source': f"concept_{c1}",
                                'target': f"concept_{c2}",
                                'weight': 1,
                                'type': 'interdisciplinary',
                                'via': sem
                            })
                            added_interdisciplinary.add(edge_key)

    # Same for lexical fields
    for lex, lex_area_dist in lexical_areas.items():
        if len(lex_area_dist) > 1:  # Appears in multiple areas
            lex_id = f"lexical_{lex}"
            if lex_id not in node_ids:
                continue

            connected_concepts = [
                concept for (concept, l), _ in concept_lexical_edges.items()
                if l == lex and f"concept_{concept}" in node_ids
            ]

            for i, c1 in enumerate(connected_concepts):
                c1_area = get_primary_area(concept_areas.get(c1, Counter()))
                for c2 in connected_concepts[i+1:]:
                    c2_area = get_primary_area(concept_areas.get(c2, Counter()))
                    if c1_area != c2_area:
                        edge_key = tuple(sorted([f"concept_{c1}", f"concept_{c2}"]))
                        if edge_key not in added_interdisciplinary:
                            edges.append({
                                'source': f"concept_{c1}",
                                'target': f"concept_{c2}",
                                'weight': 1,
                                'type': 'interdisciplinary',
                                'via': lex
                            })
                            added_interdisciplinary.add(edge_key)

    # Count interdisciplinary nodes and edges
    interdisciplinary_count = len([n for n in nodes if n.get('is_interdisciplinary', False)])
    interdisciplinary_edges = len([e for e in edges if e.get('type') == 'interdisciplinary'])

    # ========================================
    # SEMANTIC SIMILARITY DETECTION
    # Find and connect similar labels across different areas
    # ========================================

    # Build list of all node labels with their areas
    all_labels = [(n['id'], n['label'], n.get('area', 'unknown')) for n in nodes]

    # Find similar labels (threshold 0.65 for broader matching)
    similarity_matches = find_similar_labels(all_labels, threshold=0.65)

    # Create edges for cross-area similar labels
    similarity_edges_added = set()
    similarity_report = {
        'exact_duplicates': [],
        'similar_labels': [],
        'suggested_connections': []
    }

    for match in similarity_matches:
        node1_id = match['node1_id']
        node2_id = match['node2_id']

        # Categorize the match
        if match['similarity'] > 0.95:
            similarity_report['exact_duplicates'].append(match)
        elif match['similarity'] > 0.75:
            similarity_report['similar_labels'].append(match)
        else:
            similarity_report['suggested_connections'].append(match)

        # Only create edges for cross-area connections
        if match['is_cross_area']:
            edge_key = tuple(sorted([node1_id, node2_id]))
            # Skip if edge already exists
            if edge_key not in added_interdisciplinary and edge_key not in similarity_edges_added:
                edges.append({
                    'source': node1_id,
                    'target': node2_id,
                    'weight': match['similarity'],
                    'type': 'semantic_similarity',
                    'similarity': match['similarity'],
                    'match_type': match['match_type']
                })
                similarity_edges_added.add(edge_key)

    # Update interdisciplinary count
    similarity_edge_count = len([e for e in edges if e.get('type') == 'semantic_similarity'])

    return {
        'codigo_inep': codigo_inep,
        'area': area,
        'nodes': nodes,
        'edges': edges,
        'stats': {
            'total_nodes': len(nodes),
            'total_edges': len(edges),
            'concept_nodes': len([n for n in nodes if n['type'] == 'conceito_cientifico']),
            'semantic_nodes': len([n for n in nodes if n['type'] == 'campo_semantico']),
            'lexical_nodes': len([n for n in nodes if n['type'] == 'campo_lexical']),
            'interdisciplinary_nodes': interdisciplinary_count,
            'interdisciplinary_edges': interdisciplinary_edges,
            'similarity_edges': similarity_edge_count,
            'nodes_by_area': {
                area_code: len([n for n in nodes if n.get('area') == area_code])
                for area_code in ['CN', 'CH', 'LC', 'MT']
            }
        },
        'similarity_audit': {
            'exact_duplicates': len(similarity_report['exact_duplicates']),
            'similar_labels': len(similarity_report['similar_labels']),
            'suggested_connections': len(similarity_report['suggested_connections']),
            'total_similarity_edges': similarity_edge_count,
            'details': {
                'duplicates': similarity_report['exact_duplicates'][:20],  # Top 20
                'similar': similarity_report['similar_labels'][:20],
                'suggested': similarity_report['suggested_connections'][:20]
            }
        }
    }


@router.get("/school/{codigo_inep}/skill-concepts")
async def get_skill_concept_mapping(
    codigo_inep: str,
    area: Optional[str] = Query(None, regex="^(CN|CH|LC|MT)$")
) -> Dict[str, Any]:
    """
    Get mapping between ENEM skills and GLiNER-extracted concepts.

    Shows which concepts are associated with each skill and helps identify
    concept gaps for skills where the school is underperforming.
    """
    from ml.prediction_model import ENEMPredictionModel
    from ml.diagnosis_engine import DiagnosisEngine

    try:
        model = ENEMPredictionModel()
        diagnosis_engine = DiagnosisEngine()

        predictions = model.predict_all_scores(codigo_inep)
        diagnosis = diagnosis_engine.diagnose(codigo_inep)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

    df = get_gliner_data()

    if area:
        df = df[df['area_code'] == area]

    # Build skill-concept mapping with new entity types
    skill_mapping = {}

    for _, row in df.iterrows():
        skill_code = row.get('habilidade', '')
        if not skill_code:
            continue

        if skill_code not in skill_mapping:
            skill_mapping[skill_code] = {
                'skill_code': skill_code,
                'area': row.get('area_code', ''),
                'description': row.get('descricao', ''),
                'concepts': Counter(),
                'semantic_fields': Counter(),
                'lexical_fields': Counter(),
                'processes': Counter(),
                'content_count': 0,
                'avg_tri_score': 0,
                'tri_scores': []
            }

        mapping = skill_mapping[skill_code]
        mapping['content_count'] += 1
        mapping['tri_scores'].append(row.get('tri_score', 0))

        concepts = parse_list_field(row.get('conceitos_cientificos'))
        semantic = parse_list_field(row.get('campos_semanticos'))
        lexical = parse_list_field(row.get('campos_lexicais'))
        processes = parse_list_field(row.get('processos_fenomenos'))

        mapping['concepts'].update(concepts)
        mapping['semantic_fields'].update(semantic)
        mapping['lexical_fields'].update(lexical)
        mapping['processes'].update(processes)

    # Convert to output format
    skills_output = []
    for skill_code, data in skill_mapping.items():
        avg_tri = sum(data['tri_scores']) / len(data['tri_scores']) if data['tri_scores'] else 0

        # Find if this skill is a priority (from diagnosis)
        is_priority = False
        priority_level = 'normal'
        if diagnosis and 'priority_areas' in diagnosis:
            for pa in diagnosis.get('priority_areas', []):
                if pa.get('area') == data['area']:
                    is_priority = True
                    priority_level = pa.get('status', 'normal')
                    break

        skills_output.append({
            'skill_code': skill_code,
            'area': data['area'],
            'area_name': AREA_NAMES.get(data['area'], data['area']),
            'description': data['description'][:200] if data['description'] else '',
            'content_count': data['content_count'],
            'avg_tri_score': round(avg_tri, 1),
            'top_concepts': [
                {'concept': c, 'count': n}
                for c, n in data['concepts'].most_common(5)
            ],
            'semantic_fields': [
                {'field': f, 'count': n}
                for f, n in data['semantic_fields'].most_common(3)
            ],
            'lexical_fields': [
                {'field': f, 'count': n}
                for f, n in data['lexical_fields'].most_common(3)
            ],
            'processes': [
                {'process': p, 'count': n}
                for p, n in data['processes'].most_common(2)
            ],
            'is_priority': is_priority,
            'priority_level': priority_level
        })

    # Sort by priority and content count
    skills_output.sort(key=lambda x: (x['is_priority'], x['content_count']), reverse=True)

    return {
        'codigo_inep': codigo_inep,
        'area': area,
        'skills': skills_output[:50],
        'total_skills': len(skills_output),
        'summary': {
            'priority_skills': len([s for s in skills_output if s['is_priority']]),
            'total_unique_concepts': len(set(
                c['concept'] for s in skills_output for c in s['top_concepts']
            ))
        }
    }


@router.get("/school/{codigo_inep}/study-focus")
async def get_study_focus(codigo_inep: str) -> Dict[str, Any]:
    """
    Get personalized study focus based on GLiNER analysis.

    Returns:
    - Priority concepts to master (based on school's weak areas)
    - Recommended study sequence
    - Concept difficulty progression
    - Estimated impact on scores
    """
    from ml.prediction_model import ENEMPredictionModel
    from ml.diagnosis_engine import DiagnosisEngine

    try:
        model = ENEMPredictionModel()
        diagnosis_engine = DiagnosisEngine()

        predictions = model.predict_all_scores(codigo_inep)
        diagnosis = diagnosis_engine.diagnose(codigo_inep)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

    df = get_gliner_data()

    # Identify weak areas
    weak_areas = []
    if diagnosis:
        for area in diagnosis.get('priority_areas', []):
            if area.get('status') in ['critical', 'needs_attention']:
                weak_areas.append(area.get('area'))

    if not weak_areas:
        weak_areas = ['CN', 'CH', 'LC', 'MT']

    # Build study focus for weak areas
    focus_areas = []

    for area_code in weak_areas[:3]:  # Focus on top 3 weak areas
        score_key = area_code.lower()
        predicted_score = predictions.get('scores', {}).get(score_key, 550)

        area_df = df[df['area_code'] == area_code]

        # Determine TRI range for study
        if predicted_score < 450:
            target_range = (350, 500)
            level = 'foundation'
        elif predicted_score < 550:
            target_range = (450, 600)
            level = 'intermediate'
        elif predicted_score < 650:
            target_range = (550, 700)
            level = 'advanced'
        else:
            target_range = (650, 850)
            level = 'elite'

        # Filter content by TRI range
        range_df = area_df[
            (area_df['tri_score'] >= target_range[0]) &
            (area_df['tri_score'] <= target_range[1])
        ]

        # Extract concepts with frequency using new entity types
        concepts = Counter()
        concept_info = {}

        for _, row in range_df.iterrows():
            row_concepts = parse_list_field(row.get('conceitos_cientificos'))
            row_semantic = parse_list_field(row.get('campos_semanticos'))
            row_lexical = parse_list_field(row.get('campos_lexicais'))
            row_processes = parse_list_field(row.get('processos_fenomenos'))

            for c in row_concepts:
                concepts[c] += 1
                if c not in concept_info:
                    concept_info[c] = {
                        'semantic_fields': set(),
                        'lexical_fields': set(),
                        'processes': set(),
                        'tri_scores': []
                    }
                concept_info[c]['semantic_fields'].update(row_semantic)
                concept_info[c]['lexical_fields'].update(row_lexical)
                concept_info[c]['processes'].update(row_processes)
                concept_info[c]['tri_scores'].append(row.get('tri_score', 0))

        # Build study sequence (easier concepts first)
        study_sequence = []
        for concept, count in concepts.most_common(15):
            info = concept_info[concept]
            avg_tri = sum(info['tri_scores']) / len(info['tri_scores']) if info['tri_scores'] else 0

            study_sequence.append({
                'concept': concept,
                'frequency': count,
                'avg_difficulty': round(avg_tri, 0),
                'semantic_fields': list(info['semantic_fields'])[:3],
                'lexical_fields': list(info['lexical_fields'])[:2],
                'related_processes': list(info['processes'])[:2],
                'priority': 'high' if count >= 5 else 'medium' if count >= 3 else 'low',
                'estimated_impact': round(min(15, count * 2), 0)  # Points gained
            })

        # Sort by difficulty (easier first)
        study_sequence.sort(key=lambda x: x['avg_difficulty'])

        focus_areas.append({
            'area': area_code,
            'area_name': AREA_NAMES[area_code],
            'color': AREA_COLORS[area_code],
            'current_score': round(predicted_score, 0),
            'target_range': target_range,
            'level': level,
            'study_sequence': study_sequence,
            'total_concepts': len(concepts),
            'estimated_total_impact': sum(s['estimated_impact'] for s in study_sequence)
        })

    return {
        'codigo_inep': codigo_inep,
        'focus_areas': focus_areas,
        'total_estimated_improvement': sum(fa['estimated_total_impact'] for fa in focus_areas),
        'study_plan': {
            'phase_1': {
                'name': 'Fundamentos',
                'description': 'Dominar conceitos básicos de cada área',
                'concepts_count': sum(
                    len([s for s in fa['study_sequence'] if s['priority'] == 'high'])
                    for fa in focus_areas
                )
            },
            'phase_2': {
                'name': 'Consolidação',
                'description': 'Aprofundar em conceitos intermediários',
                'concepts_count': sum(
                    len([s for s in fa['study_sequence'] if s['priority'] == 'medium'])
                    for fa in focus_areas
                )
            },
            'phase_3': {
                'name': 'Excelência',
                'description': 'Dominar conceitos avançados',
                'concepts_count': sum(
                    len([s for s in fa['study_sequence'] if s['priority'] == 'low'])
                    for fa in focus_areas
                )
            }
        }
    }


@router.get("/global/trending-concepts")
async def get_trending_concepts(
    area: Optional[str] = Query(None, regex="^(CN|CH|LC|MT)$"),
    limit: int = Query(30, ge=10, le=100)
) -> Dict[str, Any]:
    """
    Get trending/most important concepts across all content.

    Useful for understanding which concepts are most tested in ENEM.
    """
    df = get_gliner_data()

    if area:
        df = df[df['area_code'] == area]

    # Count all concepts (using new compound phrase columns)
    all_concepts = Counter()
    concept_areas = {}
    concept_tri_scores = {}
    concept_semantic = {}

    for _, row in df.iterrows():
        concepts = parse_list_field(row.get('conceitos_cientificos'))
        semantic_fields = parse_list_field(row.get('campos_semanticos'))
        area_code = row.get('area_code', '')
        tri_score = row.get('tri_score', 0)

        for c in concepts:
            all_concepts[c] += 1

            if c not in concept_areas:
                concept_areas[c] = Counter()
            concept_areas[c][area_code] += 1

            if c not in concept_tri_scores:
                concept_tri_scores[c] = []
            concept_tri_scores[c].append(tri_score)

            if c not in concept_semantic:
                concept_semantic[c] = set()
            concept_semantic[c].update(semantic_fields)

    # Build output
    trending = []
    for concept, count in all_concepts.most_common(limit):
        areas_dist = concept_areas.get(concept, Counter())
        tri_scores = concept_tri_scores.get(concept, [])
        semantic = concept_semantic.get(concept, set())
        avg_tri = sum(tri_scores) / len(tri_scores) if tri_scores else 0

        trending.append({
            'concept': concept,
            'total_count': count,
            'avg_tri_score': round(avg_tri, 0),
            'semantic_fields': list(semantic)[:5],
            'areas': [
                {'area': a, 'area_name': AREA_NAMES.get(a, a), 'count': n}
                for a, n in areas_dist.most_common()
            ],
            'primary_area': areas_dist.most_common(1)[0][0] if areas_dist else None,
            'difficulty': 'hard' if avg_tri > 650 else 'medium' if avg_tri > 500 else 'easy'
        })

    return {
        'area': area,
        'trending_concepts': trending,
        'total_unique_concepts': len(all_concepts),
        'summary_by_area': {
            area_code: {
                'name': AREA_NAMES[area_code],
                'unique_concepts': len([
                    c for c, areas in concept_areas.items()
                    if area_code in areas
                ])
            }
            for area_code in ['CN', 'CH', 'LC', 'MT']
        }
    }
