"""
Teste de configuração de thresholds por campo.

Este teste demonstra como configurar thresholds específicos para diferentes
campos, entidades e relações no GLiNER2.
"""

import json
from gliner2 import GLiNER2


def test_entity_thresholds_per_field():
    """Testa thresholds por campo para extração de entidades."""
    
    print("=" * 80)
    print("THRESHOLDS POR CAMPO - ENTIDADES")
    print("=" * 80)
    
    print("\nCarregando modelo: fastino/gliner2-base-v1...")
    try:
        model = GLiNER2.from_pretrained("fastino/gliner2-base-v1")
        print("Modelo carregado com sucesso!\n")
    except Exception as e:
        print(f"Erro ao carregar modelo: {e}")
        return
    
    text = "Apple CEO Tim Cook anunciou o iPhone 15 por $999 e o MacBook Air por $1299 em Cupertino."
    
    print(f"Texto: {text}")
    print("\n" + "-" * 80)
    
    # Test 1: Thresholds diferentes por tipo de entidade
    print("\n1. THRESHOLDS DIFERENTES POR TIPO DE ENTIDADE")
    print("-" * 40)
    
    schema = model.create_schema()
    schema.entities({
        # Alta precisão para nomes de empresas
        "company": {"threshold": 0.9, "description": "Nomes de empresas e organizações"},
        
        # Precisão média para pessoas
        "person": {"threshold": 0.7, "description": "Nomes de pessoas"},
        
        # Baixa precisão para produtos (mais flexível)
        "product": {"threshold": 0.3, "description": "Nomes de produtos"},
        
        # Threshold padrão para preços
        "price": {"description": "Preços e valores monetários"},
        
        # Threshold padrão para localizações
        "location": {"description": "Localizações geográficas"}
    })
    
    result = model.extract(text, schema, include_confidence=True)
    print("Schema com thresholds específicos:")
    print(json.dumps(schema.build(), indent=2, ensure_ascii=False))
    print("\nResultado:")
    print(json.dumps(result, indent=2, ensure_ascii=False))
    
    # Verificar que os thresholds foram aplicados
    print("\nVerificação de thresholds:")
    for entity_type, entities in result.get("entities", {}).items():
        if entities:
            for entity in entities:
                if isinstance(entity, dict) and "confidence" in entity:
                    conf = entity["confidence"]
                    # Determinar threshold esperado
                    expected_threshold = {
                        "company": 0.9,
                        "person": 0.7,
                        "product": 0.3
                    }.get(entity_type, 0.5)  # Default 0.5
                    
                    print(f"  {entity_type}: '{entity['text']}' - Confiança: {conf:.3f} (Threshold: {expected_threshold})")
                    if conf < expected_threshold:
                        print(f"    ⚠️  Abaixo do threshold esperado!")
    
    print("\n" + "-" * 80)


def test_structure_thresholds_per_field():
    """Testa thresholds por campo para extração estruturada."""
    
    print("\n" + "=" * 80)
    print("THRESHOLDS POR CAMPO - ESTRUTURAS")
    print("=" * 80)
    
    print("\nCarregando modelo: fastino/gliner2-base-v1...")
    try:
        model = GLiNER2.from_pretrained("fastino/gliner2-base-v1")
        print("Modelo carregado com sucesso!\n")
    except Exception as e:
        print(f"Erro ao carregar modelo: {e}")
        return
    
    text = "iPhone 15 Pro Max com 256GB por $1199, disponível em titânio e preto."
    
    print(f"Texto: {text}")
    print("\n" + "-" * 80)
    
    # Schema com thresholds diferentes por campo
    print("\n2. SCHEMA COM THRESHOLDS POR CAMPO")
    print("-" * 40)
    
    schema = model.create_schema()
    schema.structure("product_info")\
        .field("name", dtype="str", threshold=0.9)           # Alta precisão para nome
        .field("storage", dtype="str", threshold=0.8)        # Precisão média para armazenamento
        .field("price", dtype="str", threshold=0.6)          # Precisão mais baixa para preço
        .field("colors", dtype="list", threshold=0.4)        # Muito baixa para cores (flexível)
        .field("availability", dtype="str", threshold=0.7)   # Precisão média para disponibilidade
    
    result = model.extract(text, schema, include_confidence=True)
    
    print("Schema com thresholds por campo:")
    schema_dict = schema.build()
    print(json.dumps(schema_dict, indent=2, ensure_ascii=False))
    
    print("\nResultado:")
    print(json.dumps(result, indent=2, ensure_ascii=False))
    
    # Verificar thresholds por campo
    print("\nVerificação de thresholds por campo:")
    if "product_info" in result:
        for product in result["product_info"]:
            for field, value in product.items():
                if isinstance(value, dict) and "confidence" in value:
                    conf = value["confidence"]
                    # Determinar threshold esperado
                    expected_threshold = {
                        "name": 0.9,
                        "storage": 0.8,
                        "price": 0.6,
                        "colors": 0.4,
                        "availability": 0.7
                    }.get(field, 0.5)
                    
                    print(f"  {field}: '{value['text']}' - Confiança: {conf:.3f} (Threshold: {expected_threshold})")
                    if conf < expected_threshold:
                        print(f"    ⚠️  Abaixo do threshold esperado!")
    
    print("\n" + "-" * 80)


def test_relation_thresholds():
    """Testa thresholds para extração de relações."""
    
    print("\n" + "=" * 80)
    print("THRESHOLDS POR CAMPO - RELAÇÕES")
    print("=" * 80)
    
    print("\nCarregando modelo: fastino/gliner2-base-v1...")
    try:
        model = GLiNER2.from_pretrained("fastino/gliner2-base-v1")
        print("Modelo carregado com sucesso!\n")
    except Exception as e:
        print(f"Erro ao carregar modelo: {e}")
        return
    
    text = "Tim Cook é CEO da Apple e mora em Cupertino. Apple está localizada na Califórnia."
    
    print(f"Texto: {text}")
    print("\n" + "-" * 80)
    
    # Schema com thresholds diferentes para relações
    print("\n3. THRESHOLDS DIFERENTES PARA TIPOS DE RELAÇÃO")
    print("-" * 40)
    
    schema = model.create_schema()
    schema.relations({
        # Alta precisão para relações de CEO
        "CEO_of": {"threshold": 0.9, "description": "Relação CEO de uma empresa"},
        
        # Precisão média para localização
        "located_in": {"threshold": 0.7, "description": "Localização de uma entidade"},
        
        # Baixa precisão para residência
        "lives_in": {"threshold": 0.4, "description": "Onde uma pessoa mora"}
    })
    
    result = model.extract(text, schema, include_confidence=True)
    
    print("Schema com thresholds para relações:")
    print(json.dumps(schema.build(), indent=2, ensure_ascii=False))
    
    print("\nResultado:")
    print(json.dumps(result, indent=2, ensure_ascii=False))
    
    # Verificar thresholds para relações
    print("\nVerificação de thresholds para relações:")
    if "relation_extraction" in result:
        for rel_type, relations in result["relation_extraction"].items():
            for rel in relations:
                if isinstance(rel, dict) and "head" in rel and "tail" in rel:
                    head_conf = rel["head"].get("confidence", 0.5)
                    tail_conf = rel["tail"].get("confidence", 0.5)
                    avg_conf = (head_conf + tail_conf) / 2
                    
                    # Determinar threshold esperado
                    expected_threshold = {
                        "CEO_of": 0.9,
                        "located_in": 0.7,
                        "lives_in": 0.4
                    }.get(rel_type, 0.5)
                    
                    print(f"  {rel_type}: '{rel['head']['text']}' -> '{rel['tail']['text']}'")
                    print(f"    Confiança média: {avg_conf:.3f} (Threshold: {expected_threshold})")
                    if avg_conf < expected_threshold:
                        print(f"    ⚠️  Abaixo do threshold esperado!")
    
    print("\n" + "-" * 80)


def test_mixed_thresholds():
    """Testa thresholds mistos (entidades, estruturas e relações)."""
    
    print("\n" + "=" * 80)
    print("THRESHOLDS MISTOS - TODOS OS TIPOS")
    print("=" * 80)
    
    print("\nCarregando modelo: fastino/gliner2-base-v1...")
    try:
        model = GLiNER2.from_pretrained("fastino/gliner2-base-v1")
        print("Modelo carregado com sucesso!\n")
    except Exception as e:
        print(f"Erro ao carregar modelo: {e}")
        return
    
    text = "A Microsoft, liderada por Satya Nadella, anunciou Windows 11 por $199 e Surface Pro 9 por $1299 em Seattle."
    
    print(f"Texto: {text}")
    print("\n" + "-" * 80)
    
    # Schema complexo com múltiplos tipos e thresholds
    print("\n4. SCHEMA COMPLEXO COM MÚLTIPLOS THRESHOLDS")
    print("-" * 40)
    
    schema = model.create_schema()
    
    # Entidades com thresholds diferentes
    schema.entities({
        "company": {"threshold": 0.9},      # Alta precisão
        "person": {"threshold": 0.8},       # Alta precisão
        "product": {"threshold": 0.6},      # Média precisão
        "price": {"threshold": 0.7},        # Média-alta precisão
        "location": {"threshold": 0.5}      # Precisão padrão
    })
    
    # Estrutura com thresholds por campo
    schema.structure("announcement")\
        .field("company", dtype="str", threshold=0.9)\
        .field("leader", dtype="str", threshold=0.85)\
        .field("products", dtype="list", threshold=0.6)\
        .field("prices", dtype="list", threshold=0.7)\
        .field("city", dtype="str", threshold=0.5)
    
    # Relações com thresholds diferentes
    schema.relations({
        "led_by": {"threshold": 0.85},      # Alta precisão
        "announced_in": {"threshold": 0.6}, # Média precisão
        "priced_at": {"threshold": 0.7}     # Média-alta precisão
    })
    
    result = model.extract(text, schema, include_confidence=True)
    
    print("Schema complexo:")
    print(json.dumps(schema.build(), indent=2, ensure_ascii=False))
    
    print("\nResultado completo:")
    print(json.dumps(result, indent=2, ensure_ascii=False))
    
    # Resumo de thresholds aplicados
    print("\n📊 RESUMO DE THRESHOLDS APLICADOS:")
    
    # Entidades
    if "entities" in result:
        print("\nEntidades:")
        for entity_type, entities in result["entities"].items():
            if entities:
                threshold_map = {
                    "company": 0.9, "person": 0.8, "product": 0.6,
                    "price": 0.7, "location": 0.5
                }
                expected = threshold_map.get(entity_type, 0.5)
                print(f"  {entity_type}: threshold={expected}")
    
    # Estruturas
    if "announcement" in result:
        print("\nEstrutura (announcement):")
        threshold_map = {
            "company": 0.9, "leader": 0.85, "products": 0.6,
            "prices": 0.7, "city": 0.5
        }
        for field, expected in threshold_map.items():
            print(f"  {field}: threshold={expected}")
    
    # Relações
    if "relation_extraction" in result:
        print("\nRelações:")
        threshold_map = {
            "led_by": 0.85, "announced_in": 0.6, "priced_at": 0.7
        }
        for rel_type, expected in threshold_map.items():
            print(f"  {rel_type}: threshold={expected}")
    
    print("\n" + "-" * 80)


def test_threshold_override():
    """Testa sobreposição de thresholds (global vs específico)."""
    
    print("\n" + "=" * 80)
    print("SOBREPOSIÇÃO DE THRESHOLDS")
    print("=" * 80)
    
    print("\nCarregando modelo: fastino/gliner2-base-v1...")
    try:
        model = GLiNER2.from_pretrained("fastino/gliner2-base-v1")
        print("Modelo carregado com sucesso!\n")
    except Exception as e:
        print(f"Erro ao carregar modelo: {e}")
        return
    
    text = "Google CEO Sundar Pichai apresentou o Pixel 8 em evento em Mountain View por $699."
    
    print(f"Texto: {text}")
    print("\n" + "-" * 80)
    
    print("\n5. THRESHOLD GLOBAL VS ESPECÍFICO")
    print("-" * 40)
    
    # Teste 1: Threshold global (0.5) sem configurações específicas
    print("\nA) Threshold global (0.5):")
    schema1 = model.create_schema()
    schema1.entities(["company", "person", "product", "price", "location"])
    
    result1 = model.extract(text, schema1, threshold=0.5, include_confidence=True)
    print("  Threshold aplicado: 0.5 (global)")
    
    # Teste 2: Threshold global alto (0.8)
    print("\nB) Threshold global alto (0.8):")
    result2 = model.extract(text, schema1, threshold=0.8, include_confidence=True)
    print("  Threshold aplicado: 0.8 (global)")
    
    # Teste 3: Thresholds específicos sobrepondo global
    print("\nC) Thresholds específicos (sobrepondo global 0.8):")
    schema3 = model.create_schema()
    schema3.entities({
        "company": {"threshold": 0.9},      # Específico: 0.9
        "person": {"threshold": 0.7},       # Específico: 0.7  
        "product": {"threshold": 0.4},      # Específico: 0.4 (mais baixo que global)
        "price": {},                        # Usa global: 0.8
        "location": {"threshold": 0.6}      # Específico: 0.6
    })
    
    result3 = model.extract(text, schema3, threshold=0.8, include_confidence=True)
    print("  Thresholds:")
    print("    - company: 0.9 (específico)")
    print("    - person: 0.7 (específico)")
    print("    - product: 0.4 (específico, mais baixo que global)")
    print("    - price: 0.8 (global)")
    print("    - location: 0.6 (específico)")
    
    # Comparar resultados
    print("\n📈 COMPARAÇÃO DE RESULTADOS:")
    
    entity_types = ["company", "person", "product", "price", "location"]
    
    for entity_type in entity_types:
        print(f"\n{entity_type}:")
        
        # Resultado com threshold global 0.5
        entities1 = result1.get("entities", {}).get(entity_type, [])
        count1 = len(entities1) if isinstance(entities1, list) else (1 if entities1 else 0)
        
        # Resultado com threshold global 0.8
        entities2 = result2.get("entities", {}).get(entity_type, [])
        count2 = len(entities2) if isinstance(entities2, list) else (1 if entities2 else 0)
        
        # Resultado com thresholds específicos
        entities3 = result3.get("entities", {}).get(entity_type, [])
        count3 = len(entities3) if isinstance(entities3, list) else (1 if entities3 else 0)
        
        print(f"  Threshold 0.5: {count1} extração(ões)")
        print(f"  Threshold 0.8: {count2} extração(ões)")
        print(f"  Threshold específico: {count3} extração(ões)")
        
        # Mostrar confianças se disponível
        if entities3 and isinstance(entities3, list) and len(entities3) > 0:
            if isinstance(entities3[0], dict) and "confidence" in entities3[0]:
                conf = entities3[0]["confidence"]
                # Determinar threshold esperado
                expected = {
                    "company": 0.9, "person": 0.7, "product": 0.4,
                    "price": 0.8, "location": 0.6
                }.get(entity_type, 0.8)
                print(f"    Confiança: {conf:.3f} (Threshold esperado: {expected})")
    
    print("\n" + "-" * 80)


def run_all_tests():
    """Executa todos os testes de thresholds."""
    
    print("🎯 INICIANDO TESTES DE THRESHOLDS POR CAMPO")
    print("=" * 80)
    
    tests = [
        ("Thresholds por Entidade", test_entity_thresholds_per_field),
        ("Thresholds por Campo Estruturado", test_structure_thresholds_per_field),
        ("Thresholds por Relação", test_relation_thresholds),
        ("Thresholds Mistos", test_mixed_thresholds),
        ("Sobreposição de Thresholds", test_threshold_override),
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
    print("📊 RESUMO DOS TESTES DE THRESHOLDS")
    print("=" * 80)
    print(f"✅ PASS: {passed}")
    print(f"❌ FAIL: {failed}")
    print(f"📈 TOTAL: {passed + failed}")
    
    if failed == 0:
        print("\n🎉 Todos os testes de thresholds passaram!")
    else:
        print(f"\n⚠️  {failed} teste(s) falharam.")
    
    print("=" * 80)


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "--quick":
        print("🧪 Executando testes rápidos de thresholds...")
        test_entity_thresholds_per_field()
        test_threshold_override()
    else:
        run_all_tests()