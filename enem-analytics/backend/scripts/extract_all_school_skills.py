"""
Extrator Completo de Habilidades por Escola - ENEM 2024
Extrai dados detalhados de performance por habilidade para TODAS as escolas
Organizado por UF para evitar timeout da API
"""

import requests
import json
import pandas as pd
from typing import Optional, List, Dict
import time
from pathlib import Path
from datetime import datetime

# API Configuration
API_URL = "https://wabi-brazil-south-b-primary-api.analysis.windows.net/public/reports/querydata?synchronous=true"
MODEL_ID = 6606248
DATASET_ID = "68135bd6-e83c-419b-90e2-64bdb5553961"
REPORT_ID = "e93cdfb7-4848-4123-b9f7-b075ec852dfc"

HEADERS = {
    "Accept": "application/json, text/plain, */*",
    "Content-Type": "application/json;charset=UTF-8",
    "Origin": "https://app.powerbi.com",
    "Referer": "https://app.powerbi.com/",
    "X-PowerBI-ResourceKey": "95131326-e9de-47c4-8bf5-12c27c1e113a",
}

# UF codes with names
UF_INFO = {
    "11": "RO", "12": "AC", "13": "AM", "14": "RR", "15": "PA", "16": "AP", "17": "TO",
    "21": "MA", "22": "PI", "23": "CE", "24": "RN", "25": "PB", "26": "PE", "27": "AL", "28": "SE", "29": "BA",
    "31": "MG", "32": "ES", "33": "RJ", "35": "SP",
    "41": "PR", "42": "SC", "43": "RS",
    "50": "MS", "51": "MT", "52": "GO", "53": "DF"
}

# Skill descriptions
SKILL_DESCRIPTIONS = {
    "CN": {
        1: "Compreender fenômenos naturais usando conceitos científicos",
        2: "Associar sistemas físicos, químicos e biológicos a processos naturais",
        3: "Enfrentar situações-problema usando conhecimentos científicos",
        4: "Compreender o papel da evolução na diversidade biológica",
        5: "Avaliar o impacto de intervenções humanas no ambiente",
        6: "Interpretar experimentos científicos e seus resultados",
        7: "Analisar e compreender conceitos de genética e hereditariedade",
        8: "Compreender processos de transformação de energia",
        9: "Avaliar mudanças de estado físico e transformações químicas",
        10: "Compreender a dinâmica de ecossistemas e cadeias alimentares",
        11: "Analisar fenômenos eletromagnéticos e suas aplicações",
        12: "Compreender processos de obtenção de materiais e substâncias",
        13: "Avaliar propostas de intervenção no meio ambiente",
        14: "Compreender a célula como unidade básica da vida",
        15: "Analisar fenômenos ondulatórios e suas propriedades",
        16: "Compreender processos metabólicos e bioquímicos",
        17: "Avaliar aspectos quantitativos de transformações químicas",
        18: "Compreender movimento, forças e leis de Newton",
        19: "Analisar processos de nutrição e digestão",
        20: "Compreender o sistema nervoso e seus processos",
        21: "Analisar fenômenos térmicos e termodinâmicos",
        22: "Compreender ciclos biogeoquímicos",
        23: "Avaliar impactos ambientais de atividades humanas",
        24: "Compreender processos de reprodução e desenvolvimento",
        25: "Analisar a relação entre tecnologia e ciência",
        26: "Compreender o funcionamento do sistema imunológico",
        27: "Analisar doenças e medidas de prevenção",
        28: "Compreender a origem e evolução do universo",
        29: "Analisar o uso de recursos naturais e sustentabilidade",
        30: "Compreender processos de fotossíntese e respiração celular",
    },
    "CH": {
        1: "Compreender a produção e o papel histórico das instituições sociais",
        2: "Analisar a atuação dos movimentos sociais na transformação da realidade",
        3: "Compreender conflitos gerados pela diversidade cultural",
        4: "Avaliar relações de poder entre grupos sociais",
        5: "Identificar transformações territoriais e paisagens",
        6: "Compreender processos de formação do Estado brasileiro",
        7: "Analisar o papel da mídia na sociedade contemporânea",
        8: "Compreender fatores que contribuíram para revoluções históricas",
        9: "Analisar processos migratórios e seus impactos",
        10: "Compreender organizações políticas e sistemas de governo",
        11: "Analisar desigualdades sociais e seus determinantes",
        12: "Compreender processo de urbanização e problemas urbanos",
        13: "Avaliar impactos da globalização econômica e cultural",
        14: "Analisar formação e caracterização de blocos econômicos",
        15: "Compreender aspectos geográficos de conflitos contemporâneos",
        16: "Analisar processos de industrialização e impactos",
        17: "Compreender relações entre trabalho e sociedade",
        18: "Analisar períodos históricos do Brasil",
        19: "Compreender formação cultural brasileira e identidade nacional",
        20: "Avaliar propostas de intervenção em problemas sociais",
        21: "Compreender questões ambientais e desenvolvimento sustentável",
        22: "Analisar a questão agrária brasileira e conflitos no campo",
        23: "Compreender processos de colonização e descolonização",
        24: "Analisar aspectos do trabalho no mundo contemporâneo",
        25: "Compreender dinâmicas demográficas e suas consequências",
        26: "Analisar a expansão marítima e comercial europeia",
        27: "Compreender processos de independência na América",
        28: "Analisar regimes autoritários e processos de democratização",
        29: "Compreender a formação dos Estados nacionais",
        30: "Analisar movimentos culturais e artísticos ao longo da história",
    },
    "LC": {
        1: "Identificar diferentes linguagens e seus contextos de uso",
        2: "Reconhecer a função social de diferentes gêneros textuais",
        3: "Analisar relações entre textos e seus contextos",
        4: "Reconhecer posicionamentos ideológicos em textos",
        5: "Avaliar argumentos em textos de diferentes gêneros",
        6: "Compreender propostas de intervenção social através de textos",
        7: "Relacionar linguagens verbal e não verbal",
        8: "Reconhecer o uso de figuras de linguagem e seus efeitos",
        9: "Compreender variações linguísticas e seus contextos",
        10: "Analisar recursos expressivos das linguagens artísticas",
        11: "Reconhecer estratégias argumentativas em textos",
        12: "Compreender a função social da literatura",
        13: "Analisar aspectos formais e estruturais de textos",
        14: "Identificar elementos que concorrem para a progressão temática",
        15: "Estabelecer relações entre textos de diferentes gêneros",
        16: "Reconhecer procedimentos de convencimento em textos",
        17: "Analisar a produção artística como expressão cultural",
        18: "Compreender manifestações corporais e práticas esportivas",
        19: "Avaliar o papel da mídia na construção de realidades",
        20: "Analisar a função estética em produções culturais",
        21: "Compreender textos técnicos e científicos",
        22: "Reconhecer recursos de coesão e coerência textual",
        23: "Analisar aspectos da língua portuguesa em uso",
        24: "Compreender processos de formação de palavras",
        25: "Avaliar a adequação linguística em diferentes contextos",
        26: "Analisar produções culturais de diferentes épocas",
        27: "Compreender o papel da tecnologia na comunicação",
        28: "Reconhecer diferentes formas de organização textual",
        29: "Avaliar processos de criação artística e cultural",
        30: "Compreender relações intertextuais e suas funções",
    },
    "MT": {
        1: "Construir significados para números naturais, inteiros e racionais",
        2: "Utilizar conhecimentos geométricos na resolução de problemas",
        3: "Selecionar estratégias de resolução de problemas",
        4: "Analisar dados apresentados em gráficos e tabelas",
        5: "Avaliar propostas de intervenção usando conceitos matemáticos",
        6: "Interpretar informações em diferentes representações matemáticas",
        7: "Compreender o caráter aleatório de fenômenos naturais e sociais",
        8: "Resolver problemas envolvendo grandezas proporcionais",
        9: "Utilizar instrumentos de medida e escalas",
        10: "Analisar informações expressas em gráficos e tabelas",
        11: "Utilizar noções de proporcionalidade e semelhança",
        12: "Resolver problemas envolvendo equações e inequações",
        13: "Avaliar modelos matemáticos usados em contextos reais",
        14: "Analisar problemas envolvendo variação de grandezas",
        15: "Identificar regularidades e padrões matemáticos",
        16: "Utilizar conceitos de geometria analítica",
        17: "Compreender aplicações de razões trigonométricas",
        18: "Resolver problemas de contagem e probabilidade",
        19: "Avaliar propostas de tratamento de dados estatísticos",
        20: "Analisar problemas envolvendo funções matemáticas",
        21: "Utilizar conceitos de geometria espacial",
        22: "Resolver problemas envolvendo sequências numéricas",
        23: "Analisar situações envolvendo matemática financeira",
        24: "Compreender aplicações de matrizes e determinantes",
        25: "Resolver problemas usando sistemas de equações",
        26: "Analisar gráficos de funções",
        27: "Utilizar conceitos de geometria plana",
        28: "Resolver problemas de otimização",
        29: "Avaliar argumentos matemáticos e demonstrações",
        30: "Compreender aplicações de polinômios e suas propriedades",
    },
}

# Output directory
OUTPUT_DIR = Path(__file__).parent.parent / "data"


def api_request(query: dict, retries: int = 3) -> Optional[dict]:
    """Make API request with retry and exponential backoff"""
    for attempt in range(retries):
        try:
            response = requests.post(API_URL, headers=HEADERS, json=query, timeout=120)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.Timeout:
            print(f"    ⏱️  Timeout (attempt {attempt + 1}/{retries})")
        except requests.exceptions.RequestException as e:
            print(f"    ❌ Request error (attempt {attempt + 1}/{retries}): {e}")

        if attempt < retries - 1:
            wait_time = 2 ** (attempt + 1)
            print(f"    ⏳ Waiting {wait_time}s before retry...")
            time.sleep(wait_time)

    return None


def build_school_skills_query(ano: int, uf_code: str, area: str) -> dict:
    """Build query to extract skills per school for a specific UF and area"""
    return {
        "version": "1.0.0",
        "queries": [{
            "Query": {
                "Commands": [{
                    "SemanticQueryDataShapeCommand": {
                        "Query": {
                            "Version": 2,
                            "From": [
                                {"Name": "c", "Entity": "cur-enem-school-skill", "Type": 0},
                                {"Name": "s", "Entity": "stg-senso-escolar", "Type": 0},
                                {"Name": "e", "Entity": "enem_area", "Type": 0},
                                {"Name": "f", "Entity": "filtro_tamanho", "Type": 0},
                                {"Name": "co", "Entity": "comparação", "Type": 0}
                            ],
                            "Select": [
                                {
                                    "Column": {
                                        "Expression": {"SourceRef": {"Source": "s"}},
                                        "Property": "inep_nome"
                                    },
                                    "Name": "escola"
                                },
                                {
                                    "Column": {
                                        "Expression": {"SourceRef": {"Source": "c"}},
                                        "Property": "co_habilidade"
                                    },
                                    "Name": "habilidade"
                                },
                                {
                                    "Aggregation": {
                                        "Expression": {
                                            "Column": {
                                                "Expression": {"SourceRef": {"Source": "c"}},
                                                "Property": "desempenho_hab"
                                            }
                                        },
                                        "Function": 1
                                    },
                                    "Name": "desempenho"
                                }
                            ],
                            "Where": [
                                {
                                    "Condition": {
                                        "In": {
                                            "Expressions": [{"Column": {"Expression": {"SourceRef": {"Source": "s"}}, "Property": "ano"}}],
                                            "Values": [[{"Literal": {"Value": f"{ano}L"}}]]
                                        }
                                    }
                                },
                                {
                                    "Condition": {
                                        "In": {
                                            "Expressions": [{"Column": {"Expression": {"SourceRef": {"Source": "f"}}, "Property": "nome"}}],
                                            "Values": [[{"Literal": {"Value": "'Todas escolas'"}}]]
                                        }
                                    }
                                },
                                {
                                    "Condition": {
                                        "In": {
                                            "Expressions": [{"Column": {"Expression": {"SourceRef": {"Source": "co"}}, "Property": "Coluna 1"}}],
                                            "Values": [[{"Literal": {"Value": "'Brasil'"}}]]
                                        }
                                    }
                                },
                                {
                                    "Condition": {
                                        "In": {
                                            "Expressions": [{"Column": {"Expression": {"SourceRef": {"Source": "e"}}, "Property": "area"}}],
                                            "Values": [[{"Literal": {"Value": f"'{area}'"}}]]
                                        }
                                    }
                                },
                                {
                                    "Condition": {
                                        "StartsWith": {
                                            "Left": {"Column": {"Expression": {"SourceRef": {"Source": "s"}}, "Property": "inep_nome"}},
                                            "Right": {"Literal": {"Value": f"'{uf_code}'"}}
                                        }
                                    }
                                }
                            ]
                        },
                        "Binding": {
                            "Primary": {"Groupings": [{"Projections": [0, 1, 2]}]},
                            "DataReduction": {"DataVolume": 6, "Primary": {"Window": {"Count": 100000}}},
                            "Version": 1
                        },
                        "ExecutionMetricsKind": 1
                    }
                }]
            },
            "QueryId": "",
            "ApplicationContext": {"DatasetId": DATASET_ID, "Sources": [{"ReportId": REPORT_ID}]}
        }],
        "cancelQueries": [],
        "modelId": MODEL_ID
    }


def parse_skills_response(response: dict, area: str) -> List[Dict]:
    """Parse PowerBI response to extract school skills data"""
    records = []
    try:
        ds = response["results"][0]["result"]["data"]["dsr"]["DS"][0]
        value_dicts = ds.get("ValueDicts", {})

        # Get school names from value dict
        school_names = value_dicts.get("D0", [])

        current_school = None

        for ph in ds.get("PH", []):
            for row in ph.get("DM0", []):
                if "C" not in row:
                    continue

                values = row["C"]
                repeat = row.get("R")

                # Full row with school index: [school_idx, skill_num, performance]
                if len(values) == 3 and repeat is None:
                    school_idx = values[0]
                    skill_num = int(values[1])
                    performance = float(values[2])
                    if isinstance(school_idx, int) and school_idx < len(school_names):
                        current_school = school_names[school_idx]
                    else:
                        current_school = None
                # Repeated school row: [skill_num, performance]
                elif len(values) == 2 and repeat == 1:
                    skill_num = int(values[0])
                    performance = float(values[1])
                else:
                    continue

                if current_school:
                    # Extract INEP code from "INEP-NOME" format
                    parts = current_school.split("-", 1)
                    codigo_inep = parts[0].strip() if parts else current_school
                    nome_escola = parts[1].strip() if len(parts) > 1 else ""

                    records.append({
                        "codigo_inep": codigo_inep,
                        "nome_escola": nome_escola,
                        "area": area,
                        "skill_num": skill_num,
                        "performance": round(performance * 100, 2),  # Convert to percentage
                        "descricao": SKILL_DESCRIPTIONS.get(area, {}).get(skill_num, f"Habilidade {skill_num}")
                    })

    except (KeyError, IndexError, ValueError) as e:
        print(f"    ⚠️  Parse error: {e}")

    return records


def extract_uf_area(ano: int, uf_code: str, area: str) -> List[Dict]:
    """Extract skills for one UF and one area"""
    query = build_school_skills_query(ano, uf_code, area)
    response = api_request(query)

    if not response:
        return []

    # Check for API errors
    try:
        dsr = response["results"][0]["result"]["data"]["dsr"]
        if "DataShapes" in dsr:
            shapes = dsr["DataShapes"]
            if shapes and "odata.error" in str(shapes):
                print(f"    ⚠️  API error for {uf_code}/{area}")
                return []
    except:
        pass

    return parse_skills_response(response, area)


def extract_all_schools(ano: int = 2024):
    """Extract skills for all schools, organized by UF"""
    print("=" * 60)
    print(f"EXTRAÇÃO DE HABILIDADES POR ESCOLA - ENEM {ano}")
    print("=" * 60)
    print(f"Início: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()

    all_records = []
    areas = ["CN", "CH", "LC", "MT"]
    total_ufs = len(UF_INFO)

    for uf_idx, (uf_code, uf_name) in enumerate(UF_INFO.items(), 1):
        print(f"\n[{uf_idx}/{total_ufs}] {uf_name} (código {uf_code})")
        print("-" * 40)

        uf_records = []
        for area in areas:
            print(f"  📊 Extraindo {area}...", end=" ", flush=True)
            records = extract_uf_area(ano, uf_code, area)
            uf_records.extend(records)
            print(f"✓ {len(records)} registros")
            time.sleep(0.5)  # Small delay between requests

        all_records.extend(uf_records)

        # Calculate unique schools
        unique_schools = len(set(r["codigo_inep"] for r in uf_records))
        print(f"  📈 Total {uf_name}: {len(uf_records)} registros ({unique_schools} escolas)")

        # Save progress every 5 UFs
        if uf_idx % 5 == 0:
            save_progress(all_records, ano, partial=True)

    print("\n" + "=" * 60)
    print("EXTRAÇÃO CONCLUÍDA")
    print("=" * 60)

    # Final save
    save_progress(all_records, ano, partial=False)

    # Statistics
    unique_schools = len(set(r["codigo_inep"] for r in all_records))
    print(f"\n📊 Estatísticas Finais:")
    print(f"   Total de registros: {len(all_records):,}")
    print(f"   Escolas únicas: {unique_schools:,}")
    print(f"   Áreas: {len(areas)}")
    print(f"   Média de skills por escola: {len(all_records) / unique_schools:.1f}")

    return all_records


def save_progress(records: List[Dict], ano: int, partial: bool = False):
    """Save current progress to files"""
    if not records:
        return

    suffix = "_partial" if partial else ""

    # Save as JSON
    json_path = OUTPUT_DIR / f"school_skills_{ano}{suffix}.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False, indent=2)

    # Save as CSV
    csv_path = OUTPUT_DIR / f"school_skills_{ano}{suffix}.csv"
    df = pd.DataFrame(records)
    df.to_csv(csv_path, index=False, encoding="utf-8")

    status = "parcial" if partial else "final"
    print(f"\n  💾 Salvos ({status}): {len(records):,} registros")
    print(f"     JSON: {json_path}")
    print(f"     CSV: {csv_path}")


if __name__ == "__main__":
    records = extract_all_schools(2024)
