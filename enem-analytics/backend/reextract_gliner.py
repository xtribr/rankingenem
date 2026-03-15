#!/usr/bin/env python3
"""
Re-extract all TRI content with GLiNER real confidence scores.
Uses local GLiNER2 model with ENEM adapter.
"""

import pandas as pd
import sys
import json
from pathlib import Path

# Add parent to path
sys.path.insert(0, str(Path(__file__).parent))

from ml.gliner_processor import GLiNERLocalProcessor, clean_entities, ENTITY_TYPES


def main():
    print("=== Re-extração GLiNER com confiança real ===")
    print()

    # Load CSV
    csv_path = Path(__file__).parent / "data" / "conteudos_tri_final.csv"
    df = pd.read_csv(csv_path)
    print(f"CSV carregado: {len(df)} linhas")

    # Init processor with clean cache
    print("Carregando modelo GLiNER2 + adapter ENEM...")
    processor = GLiNERLocalProcessor(clear_cache=True)
    # Force model load
    _ = processor.model
    print("Modelo carregado!")
    print()

    # Extract all descriptions
    descriptions = df['descricao'].tolist()
    total = len(descriptions)

    print(f"Extraindo entidades de {total} descrições...")
    print()

    extraction_results = []
    for i, desc in enumerate(descriptions):
        result = processor.extract_from_description(desc)
        extraction_results.append(result)

        if (i + 1) % 100 == 0:
            processor._save_cache()
            pct = round((i + 1) / total * 100, 1)
            print(f"  [{pct}%] {i + 1}/{total} processados")
            sys.stdout.flush()

    processor._save_cache()
    print(f"  [100%] {total}/{total} processados")
    print()

    # Helper functions
    def _extract_texts(entities_list):
        texts = []
        for e in entities_list:
            if isinstance(e, dict):
                texts.append(e.get('text', ''))
            else:
                texts.append(e)
        return texts

    def _extract_confidences(entities_list):
        confs = []
        for e in entities_list:
            if isinstance(e, dict):
                confs.append(str(round(e.get('confidence', 0.0), 4)))
            else:
                confs.append('')
        return confs

    entity_cols = {
        'conceitos_cientificos': 'conceito_cientifico',
        'campos_semanticos': 'campo_semantico',
        'campos_lexicais': 'campo_lexical',
        'processos_fenomenos': 'processo_fenomeno',
        'contextos_historicos': 'contexto_historico',
        'habilidades_compostas': 'habilidade_composta',
    }

    # Add extracted fields + confidence
    print("Salvando colunas no DataFrame...")
    for col_name, entity_key in entity_cols.items():
        df[col_name] = [
            ', '.join(_extract_texts(r.get('entities', {}).get(entity_key, []))) if r else ''
            for r in extraction_results
        ]
        df[f'{col_name}_confidence'] = [
            ', '.join(_extract_confidences(r.get('entities', {}).get(entity_key, []))) if r else ''
            for r in extraction_results
        ]

    # All entities combined
    df['all_entities'] = [
        ', '.join([
            text for entities in r.get('entities', {}).values()
            for e in (entities if isinstance(entities, list) else [])
            for text in [e.get('text', e) if isinstance(e, dict) else e]
        ]) if r else ''
        for r in extraction_results
    ]

    # Save
    output_path = Path(__file__).parent / "data" / "conteudos_tri_gliner.csv"
    df.to_csv(output_path, index=False, encoding='utf-8')
    print(f"CSV salvo: {output_path}")
    print()

    # Stats
    print("=== Estatísticas ===")
    for col_name in entity_cols.keys():
        non_empty = df[col_name].apply(lambda x: bool(x) and len(str(x).strip()) > 0).sum()
        conf_col = f'{col_name}_confidence'
        has_conf = df[conf_col].apply(lambda x: bool(x) and len(str(x).strip()) > 0).sum()
        print(f"  {col_name}: {non_empty} linhas com entidades, {has_conf} com confiança")

    # Sample
    print()
    print("=== Amostra ===")
    for _, row in df.iterrows():
        cc = str(row.get('conceitos_cientificos', ''))
        cf = str(row.get('conceitos_cientificos_confidence', ''))
        if cc and cf and len(cc) > 5 and len(cf) > 3:
            print(f"Conceitos: {cc[:120]}")
            print(f"Confiança: {cf[:120]}")
            print(f"Area: {row.get('area', '?')} | Hab: {row.get('habilidade', '?')}")
            break

    print()
    print("✓ Re-extração completa com confiança real do GLiNER!")


if __name__ == "__main__":
    main()
