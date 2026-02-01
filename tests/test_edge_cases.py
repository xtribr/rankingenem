"""
Testes de edge cases e tratamento de erros do GLiNER2.

Estes testes usam o modelo real e requerem download.
Use -m "not requires_model" para pular.
"""

import pytest
import torch

# Skip todos os testes se não conseguir importar
pytestmark = [
    pytest.mark.requires_model,
    pytest.mark.slow,
]


@pytest.fixture(scope="module")
def model():
    """Fixture que carrega o modelo uma vez."""
    try:
        from gliner2 import GLiNER2
        return GLiNER2.from_pretrained("fastino/gliner2-base-v1")
    except Exception as e:
        pytest.skip(f"Não foi possível carregar o modelo: {e}")


class TestEmptyAndMinimalInput:
    """Testes com entradas vazias ou mínimas."""
    
    def test_empty_text_entity_extraction(self, model):
        """Testa extração de entidades com texto vazio."""
        result = model.extract_entities("", ["person", "company"])
        
        # Deve retornar estrutura válida, mesmo que vazia
        assert isinstance(result, dict)
        assert "entities" in result
    
    def test_whitespace_only_text(self, model):
        """Testa com texto contendo apenas whitespace."""
        result = model.extract_entities("   \n\t  ", ["person"])
        
        assert isinstance(result, dict)
    
    def test_single_character_text(self, model):
        """Testa com texto de um único caractere."""
        result = model.extract_entities("X", ["person"])
        
        assert isinstance(result, dict)
    
    def test_empty_entity_types(self, model):
        """Testa com lista de tipos de entidade vazia."""
        result = model.extract_entities("John works at Apple.", [])
        
        # Deve retornar resultado, possivelmente vazio
        assert isinstance(result, dict)


class TestVeryLongInputs:
    """Testes com entradas muito longas."""
    
    def test_very_long_text(self, model):
        """Testa com texto muito longo (repetido)."""
        text = "Apple CEO Tim Cook announced new products. " * 50
        
        result = model.extract_entities(text, ["person", "company", "product"])
        
        assert isinstance(result, dict)
        assert "entities" in result
    
    def test_long_entity_list(self, model):
        """Testa com muitos tipos de entidades."""
        entity_types = [f"type_{i}" for i in range(50)]
        
        result = model.extract_entities(
            "Some text here.",
            entity_types
        )
        
        assert isinstance(result, dict)


class TestSpecialCharactersAndEncoding:
    """Testes com caracteres especiais e codificação."""
    
    def test_unicode_characters(self, model):
        """Testa com caracteres Unicode variados."""
        texts = [
            "日本語のテキスト",  # Japonês
            "العربية النص",      # Árabe
            "Русский текст",     # Russo
            "中文文本",          # Chinês
            "Ελληνικό κείμενο",  # Grego
        ]
        
        for text in texts:
            result = model.extract_entities(text, ["entity"])
            assert isinstance(result, dict)
    
    def test_emojis(self, model):
        """Testa com emojis."""
        text = "Apple 🍎 announced iPhone 15 📱 yesterday 🎉"
        
        result = model.extract_entities(text, ["company", "product"])
        
        assert isinstance(result, dict)
    
    def test_special_punctuation(self, model):
        """Testa com pontuação especial."""
        text = "Apple (AAPL) announced iPhone 15 @ $999!!! #tech #apple"
        
        result = model.extract_entities(text, ["company", "product"])
        
        assert isinstance(result, dict)
    
    def test_html_tags(self, model):
        """Testa com tags HTML."""
        text = "<p>Apple CEO <b>Tim Cook</b> announced iPhone 15</p>"
        
        result = model.extract_entities(text, ["person", "company", "product"])
        
        assert isinstance(result, dict)
    
    def test_urls_and_emails(self, model):
        """Testa com URLs e emails."""
        text = "Contact john@apple.com or visit https://apple.com for info"
        
        result = model.extract_entities(text, ["email", "url", "company"])
        
        assert isinstance(result, dict)


class TestAmbiguousAndComplexCases:
    """Testes com casos ambíguos e complexos."""
    
    def test_overlapping_entities(self, model):
        """Testa com entidades que podem se sobrepor."""
        # "Apple" pode ser company ou product
        text = "Apple released a new Apple Watch."
        
        result = model.extract_entities(text, ["company", "product"])
        
        assert isinstance(result, dict)
        assert "entities" in result
    
    def test_same_entity_multiple_times(self, model):
        """Testa com mesma entidade aparecendo múltiplas vezes."""
        text = "Tim Cook said Tim Cook is the CEO"
        
        result = model.extract_entities(text, ["person"])
        
        assert isinstance(result, dict)
    
    def test_nested_entities(self, model):
        """Testa com entidades aninhadas (ex: nome completo)."""
        text = "Timothy Donald Cook works at Apple Inc."
        
        result = model.extract_entities(text, ["person", "company"])
        
        assert isinstance(result, dict)
    
    def test_case_sensitivity(self, model):
        """Testa sensibilidade a maiúsculas/minúsculas."""
        text = "APPLE, apple, Apple, aPpLe"
        
        result = model.extract_entities(text, ["company"])
        
        assert isinstance(result, dict)


class TestSchemaEdgeCases:
    """Testes de edge cases para schemas."""
    
    def test_empty_schema(self, model):
        """Testa schema vazio."""
        schema = model.create_schema()
        
        result = model.extract("Some text.", schema)
        
        assert isinstance(result, dict)
    
    def test_schema_with_only_metadata(self, model):
        """Testa schema com apenas metadados vazios."""
        schema = model.create_schema()
        schema.schema["entities"] = {}
        
        result = model.extract("Some text.", schema)
        
        assert isinstance(result, dict)
    
    def test_very_long_schema_description(self, model):
        """Testa com descrição muito longa no schema."""
        long_desc = "This is a very long description. " * 50
        
        schema = model.create_schema()
        schema.entities({
            "entity_type": long_desc
        })
        
        result = model.extract("Some text.", schema)
        
        assert isinstance(result, dict)


class TestBatchProcessingEdgeCases:
    """Testes de edge cases para processamento em batch."""
    
    def test_empty_batch(self, model):
        """Testa batch vazio."""
        results = model.batch_extract_entities([], ["person"])
        
        assert results == []
    
    def test_single_item_batch(self, model):
        """Testa batch com apenas um item."""
        results = model.batch_extract_entities(
            ["Tim works at Apple."],
            ["person", "company"]
        )
        
        assert len(results) == 1
        assert isinstance(results[0], dict)
    
    def test_batch_with_empty_texts(self, model):
        """Testa batch com alguns textos vazios."""
        results = model.batch_extract_entities(
            ["", "Tim works at Apple.", "", "Jane works at Google."],
            ["person", "company"]
        )
        
        assert len(results) == 4
        for result in results:
            assert isinstance(result, dict)


class TestThresholdAndConfidenceEdgeCases:
    """Testes de edge cases para thresholds e confiança."""
    
    def test_threshold_zero(self, model):
        """Testa com threshold 0."""
        result = model.extract_entities(
            "Some text",
            ["entity"],
            threshold=0.0
        )
        
        assert isinstance(result, dict)
    
    def test_threshold_one(self, model):
        """Testa com threshold 1.0."""
        result = model.extract_entities(
            "Some text",
            ["entity"],
            threshold=1.0
        )
        
        assert isinstance(result, dict)
    
    def test_confidence_scores_range(self, model):
        """Testa que scores de confiança estão em [0, 1]."""
        result = model.extract_entities(
            "Tim Cook works at Apple.",
            ["person", "company"],
            include_confidence=True
        )
        
        # Verifica que confianças estão no range correto
        if "entities" in result:
            for entity_type, entities in result["entities"].items():
                for entity in entities:
                    if isinstance(entity, dict) and "confidence" in entity:
                        assert 0 <= entity["confidence"] <= 1


class TestRelationExtractionEdgeCases:
    """Testes de edge cases para extração de relações."""
    
    def test_relation_no_entities_found(self, model):
        """Testa relação quando não encontra entidades."""
        text = "The weather is nice today."
        
        result = model.extract_relations(
            text,
            ["works_for", "located_in"]
        )
        
        assert isinstance(result, dict)
        assert "relation_extraction" in result
    
    def test_relation_same_entity_head_and_tail(self, model):
        """Testa relação onde head e tail poderiam ser o mesmo."""
        text = "Apple owns Apple"  # Caso estranho mas possível
        
        result = model.extract_relations(
            text,
            ["owns"]
        )
        
        assert isinstance(result, dict)


class TestClassificationEdgeCases:
    """Testes de edge cases para classificação."""
    
    def test_classification_single_label(self, model):
        """Testa com apenas um label possível."""
        result = model.classify_text(
            "Any text here.",
            {"category": ["only_option"]}
        )
        
        assert isinstance(result, dict)
        assert "category" in result
    
    def test_classification_many_labels(self, model):
        """Testa com muitos labels."""
        labels = [f"label_{i}" for i in range(100)]
        
        result = model.classify_text(
            "Some text.",
            {"category": labels}
        )
        
        assert isinstance(result, dict)
    
    def test_multi_label_all_false(self, model):
        """Testa multi-label onde nenhum deve ser selecionado."""
        result = model.classify_text(
            "asdfghjkl nonsense text",
            {
                "topics": {
                    "labels": ["sports", "politics", "tech"],
                    "multi_label": True,
                    "cls_threshold": 0.99  # Threshold muito alto
                }
            }
        )
        
        assert isinstance(result, dict)


class TestStructuredExtractionEdgeCases:
    """Testes de edge cases para extração estruturada."""
    
    def test_structure_no_fields_found(self, model):
        """Testa quando não encontra campos."""
        text = "Random text with no structure."
        
        schema = model.create_schema()
        schema.structure("product").field("name").field("price")
        
        result = model.extract(text, schema)
        
        assert isinstance(result, dict)
    
    def test_structure_with_optional_fields(self, model):
        """Testa com campos opcionais."""
        text = "iPhone 15 costs $999"
        
        schema = model.create_schema()
        schema.structure("product")\
            .field("name")\
            .field("price")\
            .field("color")  # color não está no texto
        
        result = model.extract(text, schema)
        
        assert isinstance(result, dict)


class TestMemoryAndPerformanceEdgeCases:
    """Testes de edge cases relacionados a memória e performance."""
    
    def test_repeated_calls(self, model):
        """Testa chamadas repetidas (verificar memory leaks)."""
        text = "Tim Cook works at Apple."
        
        for _ in range(10):
            result = model.extract_entities(text, ["person", "company"])
            assert isinstance(result, dict)
    
    def test_large_batch(self, model):
        """Testa batch grande."""
        texts = [f"Text {i} here." for i in range(50)]
        
        results = model.batch_extract_entities(
            texts,
            ["entity"],
            batch_size=16
        )
        
        assert len(results) == 50
    
    def test_model_remains_usable(self, model):
        """Testa que modelo continua usável após múltiplas operações."""
        # Entity extraction
        r1 = model.extract_entities("Tim works at Apple.", ["person", "company"])
        
        # Classification
        r2 = model.classify_text("Great!", {"sentiment": ["positive", "negative"]})
        
        # Structured
        schema = model.create_schema()
        schema.structure("product").field("name")
        r3 = model.extract("iPhone 15", schema)
        
        # Entity again
        r4 = model.extract_entities("Jane works at Google.", ["person", "company"])
        
        assert all(isinstance(r, dict) for r in [r1, r2, r3, r4])


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
