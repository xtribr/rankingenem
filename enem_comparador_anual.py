"""
Comparador Anual de Dados ENEM
==============================

Script para análise comparativa entre anos do ENEM.
Detecta anomalias, tendências e valida consistência.
"""

import sqlite3
import pandas as pd
import numpy as np
from pathlib import Path
from typing import Dict, List
import matplotlib.pyplot as plt
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class ENEMComparadorAnual:
    """Comparador de dados ENEM entre anos."""
    
    def __init__(self, db_path: str = "enem_unificado.db"):
        self.db_path = db_path
        
    def get_resumo_anual(self, ano: int) -> Dict:
        """Gera resumo estatístico de um ano."""
        conn = sqlite3.connect(self.db_path)
        
        df = pd.read_sql_query(
            "SELECT * FROM escolas_enem WHERE ano = ?",
            conn,
            params=(ano,)
        )
        conn.close()
        
        if len(df) == 0:
            return {"ano": ano, "total_escolas": 0}
        
        nota_cols = ['nota_tri_media', 'nota_cn', 'nota_ch', 'nota_lc', 'nota_mt']
        
        resumo = {
            "ano": ano,
            "total_escolas": len(df),
            "nota_media_nacional": df['nota_tri_media'].mean() if 'nota_tri_media' in df.columns else None,
            "nota_mediana": df['nota_tri_media'].median() if 'nota_tri_media' in df.columns else None,
            "desvio_padrao": df['nota_tri_media'].std() if 'nota_tri_media' in df.columns else None,
            "nota_min": df['nota_tri_media'].min() if 'nota_tri_media' in df.columns else None,
            "nota_max": df['nota_tri_media'].max() if 'nota_tri_media' in df.columns else None,
        }
        
        # Estatísticas por área
        for col in nota_cols:
            if col in df.columns:
                resumo[f"{col}_media"] = df[col].mean()
                resumo[f"{col}_mediana"] = df[col].median()
        
        return resumo
    
    def comparar_anos(self, anos: List[int]) -> pd.DataFrame:
        """Compara múltiplos anos."""
        logger.info(f"Comparando anos: {anos}")
        
        resumos = []
        for ano in anos:
            resumo = self.get_resumo_anual(ano)
            resumos.append(resumo)
        
        df_comparativo = pd.DataFrame(resumos)
        return df_comparativo
    
    def detectar_anomalias_2025(self, ano_base: int = 2024, ano_novo: int = 2025) -> Dict:
        """Detecta anomalias comparando 2025 com anos anteriores."""
        logger.info(f"Detectando anomalias: {ano_novo} vs {ano_base}...")
        
        conn = sqlite3.connect(self.db_path)
        
        df_base = pd.read_sql_query(
            "SELECT codigo_inep, nota_tri_media FROM escolas_enem WHERE ano = ?",
            conn,
            params=(ano_base,)
        )
        
        df_novo = pd.read_sql_query(
            "SELECT codigo_inep, nota_tri_media FROM escolas_enem WHERE ano = ?",
            conn,
            params=(ano_novo,)
        )
        
        conn.close()
        
        anomalias = {
            "ano_base": ano_base,
            "ano_novo": ano_novo,
            "total_base": len(df_base),
            "total_novo": len(df_novo),
            "variacao_total": len(df_novo) - len(df_base),
        }
        
        # Compara estatísticas
        if len(df_base) > 0 and len(df_novo) > 0:
            media_base = df_base['nota_tri_media'].mean()
            media_novo = df_novo['nota_tri_media'].mean()
            
            anomalias["media_base"] = media_base
            anomalias["media_novo"] = media_novo
            anomalias["variacao_media"] = media_novo - media_base
            anomalias["variacao_media_pct"] = ((media_novo - media_base) / media_base * 100) if media_base > 0 else 0
            
            # Alerta se variação for muito grande
            if abs(anomalias["variacao_media_pct"]) > 10:
                anomalias["alerta"] = f"Variação média de {anomalias['variacao_media_pct']:.1f}% detectada!"
        
        # Escolas presentes em ambos
        escolas_base = set(df_base['codigo_inep'])
        escolas_novo = set(df_novo['codigo_inep'])
        
        anomalias["escolas_comuns"] = len(escolas_base & escolas_novo)
        anomalias["escolas_novas"] = len(escolas_novo - escolas_base)
        anomalias["escolas_removidas"] = len(escolas_base - escolas_novo)
        
        return anomalias
    
    def gerar_relatorio_2025(self, output_path: str = "relatorio_enem_2025.md"):
        """Gera relatório completo de análise."""
        conn = sqlite3.connect(self.db_path)
        
        # Lista anos disponíveis
        df_anos = pd.read_sql_query(
            "SELECT DISTINCT ano FROM escolas_enem ORDER BY ano",
            conn
        )
        anos = df_anos['ano'].tolist()
        
        conn.close()
        
        if not anos:
            logger.error("Nenhum dado encontrado no banco!")
            return
        
        logger.info(f"Anos disponíveis: {anos}")
        
        # Comparação anual
        df_comp = self.comparar_anos(anos)
        
        # Anomalias se tivermos 2025
        anomalias = None
        if 2025 in anos and 2024 in anos:
            anomalias = self.detectar_anomalias_2025()
        
        # Gera relatório Markdown
        with open(output_path, 'w') as f:
            f.write("# Relatório de Análise ENEM\n\n")
            f.write(f"Gerado em: {pd.Timestamp.now().strftime('%Y-%m-%d %H:%M')}\n\n")
            
            f.write("## Resumo por Ano\n\n")
            f.write(df_comp.to_markdown(index=False))
            f.write("\n\n")
            
            if anomalias:
                f.write("## Análise ENEM 2025\n\n")
                f.write(f"- **Escolas em {anomalias['ano_base']}:** {anomalias['total_base']:,}\n")
                f.write(f"- **Escolas em {anomalias['ano_novo']}:** {anomalias['total_novo']:,}\n")
                f.write(f"- **Variação:** {anomalias['variacao_total']:+d} escolas\n")
                f.write(f"- **Média {anomalias['ano_base']}:** {anomalias.get('media_base', 'N/A')}\n")
                f.write(f"- **Média {anomalias['ano_novo']}:** {anomalias.get('media_novo', 'N/A')}\n")
                
                if 'alerta' in anomalias:
                    f.write(f"\n⚠️ **ALERTA:** {anomalias['alerta']}\n")
        
        logger.info(f"✅ Relatório gerado: {output_path}")
        return output_path


def main():
    """Função principal."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Comparador Anual ENEM')
    parser.add_argument('--db', default='enem_unificado.db', help='Banco de dados')
    parser.add_argument('--output', default='relatorio_enem_2025.md', help='Arquivo de saída')
    
    args = parser.parse_args()
    
    comparador = ENEMComparadorAnual(args.db)
    comparador.gerar_relatorio_2025(args.output)


if __name__ == "__main__":
    main()
