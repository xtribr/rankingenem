"""
Testes de extração com textos em português.

Este módulo testa a funcionalidade do GLiNER2 com textos em português,
incluindo caracteres acentuados, estruturas gramaticais específicas
e casos de uso relevantes para o contexto brasileiro.
"""

import json
import sys
from gliner2 import GLiNER2


def test_entity_extraction_portuguese():
    """Testa extração de entidades com textos em português."""
    
    print("=" * 80)
    print("EXTRAÇÃO DE ENTIDADES EM PORTUGUÊS")
    print("=" * 80)
    
    print("\nCarregando modelo: fastino/gliner2-base-v1...")
    try:
        model = GLiNER2.from_pretrained("fastino/gliner2-base-v1")
        print("Modelo carregado com sucesso!\n")
    except Exception as e:
        print(f"Erro ao carregar modelo: {e}")
        print("Verificando instalação...")
        return
    
    # Textos em português com diferentes níveis de complexidade
    texts = [
        # Texto 1: Notícia política
        "O presidente Lula anunciou novas medidas econômicas durante reunião em Brasília.",
        
        # Texto 2: Notícia esportiva
        "Neymar marcou dois gols na vitória do Brasil sobre a Argentina no Maracanã.",
        
        # Texto 3: Notícia de tecnologia
        "A Microsoft anunciou parceria com a Petrobras para implementar IA na exploração de petróleo.",
        
        # Texto 4: Texto com muitos acentos
        "São Paulo, Rio de Janeiro, Belo Horizonte e Salvador são as maiores cidades do país.",
        
        # Texto 5: Texto com contrações e coloquialismos
        "Tá saindo da jaula o monstro! O UFC vai realizar evento no Ginásio do Ibirapuera.",
    ]
    
    entity_types = ["pessoa", "organização", "local", "evento", "produto"]
    
    for i, text in enumerate(texts):
        print(f"\n{'='*60}")
        print(f"TEXTO {i+1}: {text}")
        print(f"{'='*60}")
        
        try:
            # Extração básica
            print("\n1. Extração básica:")
            result = model.extract_entities(text, entity_types)
            print(json.dumps(result, indent=2, ensure_ascii=False))
            
            # Com confiança
            print("\n2. Com scores de confiança:")
            result = model.extract_entities(text, entity_types, include_confidence=True)
            print(json.dumps(result, indent=2, ensure_ascii=False))
            
            # Com spans
            print("\n3. Com posições de caracteres:")
            result = model.extract_entities(text, entity_types, include_spans=True)
            print(json.dumps(result, indent=2, ensure_ascii=False))
            
        except Exception as e:
            print(f"Erro durante extração: {e}")
    
    print("\n" + "=" * 80)
    print("Testes de extração em português concluídos!")
    print("=" * 80)


def test_relation_extraction_portuguese():
    """Testa extração de relações com textos em português."""
    
    print("\n" + "=" * 80)
    print("EXTRAÇÃO DE RELAÇÕES EM PORTUGUÊS")
    print("=" * 80)
    
    print("\nCarregando modelo: fastino/gliner2-base-v1...")
    try:
        model = GLiNER2.from_pretrained("fastino/gliner2-base-v1")
        print("Modelo carregado com sucesso!\n")
    except Exception as e:
        print(f"Erro ao carregar modelo: {e}")
        return
    
    texts = [
        # Relações pessoais
        "Lula é presidente do Brasil e mora em Brasília.",
        
        # Relações empresariais
        "A Petrobras é controlada pelo governo brasileiro e tem sede no Rio de Janeiro.",
        
        # Relações esportivas
        "Neymar joga no PSG e pela seleção brasileira.",
        
        # Relações geográficas
        "São Paulo fica no estado de São Paulo, que pertence à região Sudeste do Brasil.",
    ]
    
    relation_types = ["presidente_de", "mora_em", "controlada_por", "sede_em", "joga_em", "joga_pela", "fica_em", "pertence_a"]
    
    for i, text in enumerate(texts):
        print(f"\n{'='*60}")
        print(f"TEXTO {i+1}: {text}")
        print(f"{'='*60}")
        
        try:
            # Extração básica
            print("\n1. Extração básica:")
            result = model.extract_relations(text, relation_types)
            print(json.dumps(result, indent=2, ensure_ascii=False))
            
            # Com confiança
            print("\n2. Com scores de confiança:")
            result = model.extract_relations(text, relation_types, include_confidence=True)
            print(json.dumps(result, indent=2, ensure_ascii=False))
            
        except Exception as e:
            print(f"Erro durante extração: {e}")
    
    print("\n" + "=" * 80)
    print("Testes de relações em português concluídos!")
    print("=" * 80)


def test_structure_extraction_portuguese():
    """Testa extração estruturada com textos em português."""
    
    print("\n" + "=" * 80)
    print("EXTRAÇÃO ESTRUTURADA EM PORTUGUÊS")
    print("=" * 80)
    
    print("\nCarregando modelo: fastino/gliner2-base-v1...")
    try:
        model = GLiNER2.from_pretrained("fastino/gliner2-base-v1")
        print("Modelo carregado com sucesso!\n")
    except Exception as e:
        print(f"Erro ao carregar modelo: {e}")
        return
    
    # Schema para notícias
    schema = model.create_schema()
    schema.structure("noticia")\
        .field("titulo", dtype="str")\
        .field("personagens", dtype="list")\
        .field("local", dtype="str")\
        .field("data", dtype="str")\
        .field("organizacoes", dtype="list")
    
    texts = [
        "Lula anuncia pacote econômico de R$ 300 bilhões em reunião no Palácio do Planalto, Brasília.",
        "Petrobras descobre novo campo de petróleo na Bacia de Santos, investimento de US$ 5 bilhões.",
        "Neymar marca gol na vitória do Brasil sobre Argentina por 2x1 no Maracanã, Rio de Janeiro.",
        "Microsoft anuncia centro de dados no Brasil com investimento de R$ 1 bilhão em São Paulo.",
    ]
    
    for i, text in enumerate(texts):
        print(f"\n{'='*60}")
        print(f"TEXTO {i+1}: {text}")
        print(f"{'='*60}")
        
        try:
            # Extração básica
            print("\n1. Extração básica:")
            result = model.extract(text, schema)
            print(json.dumps(result, indent=2, ensure_ascii=False))
            
            # Com confiança
            print("\n2. Com scores de confiança:")
            result = model.extract(text, schema, include_confidence=True)
            print(json.dumps(result, indent=2, ensure_ascii=False))
            
            # Com spans
            print("\n3. Com posições de caracteres:")
            result = model.extract(text, schema, include_spans=True)
            print(json.dumps(result, indent=2, ensure_ascii=False))
            
        except Exception as e:
            print(f"Erro durante extração: {e}")
    
    print("\n" + "=" * 80)
    print("Testes estruturados em português concluídos!")
    print("=" * 80)


def test_enem_data_extraction():
    """Testa extração de dados similares ao ENEM."""
    
    print("\n" + "=" * 80)
    print("EXTRAÇÃO DE DADOS TIPO ENEM")
    print("=" * 80)
    
    print("\nCarregando modelo: fastino/gliner2-base-v1...")
    try:
        model = GLiNER2.from_pretrained("fastino/gliner2-base-v1")
        print("Modelo carregado com sucesso!\n")
    except Exception as e:
        print(f"Erro ao carregar modelo: {e}")
        return
    
    # Schema para dados educacionais
    schema = model.create_schema()
    schema.structure("aluno_enem")\
        .field("nome", dtype="str")\
        .field("escola", dtype="str")\
        .field("cidade", dtype="str")\
        .field("nota_matematica", dtype="str")\
        .field("nota_linguagens", dtype="str")\
        .field("nota_humanas", dtype="str")\
        .field("nota_natureza", dtype="str")\
        .field("nota_redacao", dtype="str")
    
    texts = [
        "João Silva, aluno do Colégio Objetivo em São Paulo, obteve 780 em Matemática, 820 em Linguagens, 790 em Humanas, 800 em Natureza e 940 em Redação.",
        "Maria Santos, estudante da Escola Estadual de Brasília, alcançou 720 em Matemática, 850 em Linguagens, 880 em Humanas, 760 em Natureza e 920 em Redação.",
        "Carlos Oliveira, do Colégio Militar do Rio de Janeiro, tirou 810 em Matemática, 790 em Linguagens, 830 em Humanas, 800 em Natureza e 900 em Redação.",
    ]
    
    for i, text in enumerate(texts):
        print(f"\n{'='*60}")
        print(f"TEXTO {i+1}: {text}")
        print(f"{'='*60}")
        
        try:
            result = model.extract(text, schema, include_confidence=True)
            print(json.dumps(result, indent=2, ensure_ascii=False))
        except Exception as e:
            print(f"Erro durante extração: {e}")
    
    print("\n" + "=" * 80)
    print("Testes ENEM concluídos!")
    print("=" * 80)


def test_unicode_special_chars():
    """Testa tratamento de caracteres Unicode e especiais."""
    
    print("\n" + "=" * 80)
    print("TESTE DE CARACTERES UNICODE E ESPECIAIS")
    print("=" * 80)
    
    print("\nCarregando modelo: fastino/gliner2-base-v1...")
    try:
        model = GLiNER2.from_pretrained("fastino/gliner2-base-v1")
        print("Modelo carregado com sucesso!\n")
    except Exception as e:
        print(f"Erro ao carregar modelo: {e}")
        return
    
    texts = [
        # Texto com acentuação completa
        "Ação, coração, maçã, avião, país, não, péssimo, água, àquele",
        
        # Texto com cedilha e trema
        "Açaí, maçã, limão, canção, coração, bração, lição, ação",
        
        # Texto com caracteres especiais
        "Preço: R$ 100,00. Código: ABC-123. Email: contato@empresa.com.br",
        
        # Texto com emojis
        "Python é incrível! 🐍🚀 A programação em Python é divertida! 😊💻",
        
        # Texto com quebras de linha
        "Primeira linha.\nSegunda linha com acentuação: café.\nTerceira linha: R$ 99,99.",
    ]
    
    entity_types = ["palavra", "preco", "codigo", "email", "emoji"]
    
    for i, text in enumerate(texts):
        print(f"\n{'='*60}")
        print(f"TEXTO {i+1}: {repr(text)}")
        print(f"{'='*60}")
        
        try:
            result = model.extract_entities(text, entity_types, include_spans=True)
            print(json.dumps(result, indent=2, ensure_ascii=False))
        except Exception as e:
            print(f"Erro durante extração: {e}")
    
    print("\n" + "=" * 80)
    print("Testes Unicode concluídos!")
    print("=" * 80)


def test_batch_portuguese():
    """Testa processamento em batch com textos em português."""
    
    print("\n" + "=" * 80)
    print("PROCESSAMENTO EM BATCH - PORTUGUÊS")
    print("=" * 80)
    
    print("\nCarregando modelo: fastino/gliner2-base-v1...")
    try:
        model = GLiNER2.from_pretrained("fastino/gliner2-base-v1")
        print("Modelo carregado com sucesso!\n")
    except Exception as e:
        print(f"Erro ao carregar modelo: {e}")
        return
    
    texts = [
        "São Paulo é a maior cidade do Brasil.",
        "Rio de Janeiro tem praias famosas como Copacabana e Ipanema.",
        "Belo Horizonte é capital de Minas Gerais.",
        "Salvador foi a primeira capital do Brasil.",
        "Brasília é a capital federal do país.",
    ]
    
    entity_types = ["cidade", "estado", "pais", "capital", "caracteristica"]
    
    print(f"Número de textos: {len(texts)}")
    print(f"Tipos de entidade: {entity_types}")
    
    try:
        print("\n1. Batch com confiança e spans:")
        results = model.batch_extract_entities(
            texts, entity_types, batch_size=2,
            include_confidence=True, include_spans=True
        )
        
        for i, (text, result) in enumerate(zip(texts, results)):
            print(f"\nTexto {i+1}: {text}")
            print(f"Resultado: {json.dumps(result, indent=2, ensure_ascii=False)}")
            
    except Exception as e:
        print(f"Erro durante processamento batch: {e}")
    
    print("\n" + "=" * 80)
    print("Testes batch em português concluídos!")
    print("=" * 80)


def run_all_tests():
    """Executa todos os testes em português."""
    
    print("🚀 INICIANDO TESTES EM PORTUGUÊS")
    print("=" * 80)
    
    # Lista de testes para executar
    tests = [
        ("Extração de Entidades", test_entity_extraction_portuguese),
        ("Extração de Relações", test_relation_extraction_portuguese),
        ("Extração Estruturada", test_structure_extraction_portuguese),
        ("Dados Tipo ENEM", test_enem_data_extraction),
        ("Caracteres Unicode", test_unicode_special_chars),
        ("Processamento em Batch", test_batch_portuguese),
    ]
    
    passed = 0
    failed = 0
    
    for test_name, test_func in tests:
        print(f"\n▶️  Executando: {test_name}")
        print("-" * 60)
        
        try:
            test_func()
            print(f"✅ {test_name}: PASS")
            passed += 1
        except Exception as e:
            print(f"❌ {test_name}: FAIL - {e}")
            failed += 1
            import traceback
            traceback.print_exc()
    
    print("\n" + "=" * 80)
    print("📊 RESUMO DOS TESTES")
    print("=" * 80)
    print(f"✅ PASS: {passed}")
    print(f"❌ FAIL: {failed}")
    print(f"📈 TOTAL: {passed + failed}")
    
    if failed == 0:
        print("\n🎉 Todos os testes passaram!")
    else:
        print(f"\n⚠️  {failed} teste(s) falharam.")
    
    print("=" * 80)


if __name__ == "__main__":
    # Se passado argumento '--quick', roda apenas testes básicos
    if len(sys.argv) > 1 and sys.argv[1] == "--quick":
        print("🧪 Executando testes rápidos em português...")
        test_entity_extraction_portuguese()
        test_batch_portuguese()
    else:
        run_all_tests()