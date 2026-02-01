"""
Testes de integração para classificação de texto com GLiNER2.

Estes testes usam o modelo real e requerem download.
Use -m "not requires_model" para pular.
"""

import json
import pytest

# Skip todos os testes se não conseguir importar
pytestmark = [
    pytest.mark.requires_model,
    pytest.mark.slow,
]


@pytest.fixture(scope="module")
def model():
    """Fixture que carrega o modelo uma vez para todos os testes."""
    try:
        from gliner2 import GLiNER2
        return GLiNER2.from_pretrained("fastino/gliner2-base-v1")
    except Exception as e:
        pytest.skip(f"Não foi possível carregar o modelo: {e}")


class TestTextClassification:
    """Testes para classificação de texto."""
    
    def test_single_label_classification(self, model):
        """Testa classificação single-label básica."""
        text = "This movie was absolutely fantastic! Best I've seen all year."
        
        result = model.classify_text(
            text,
            {"sentiment": ["positive", "negative", "neutral"]}
        )
        
        assert "sentiment" in result
        assert result["sentiment"] in ["positive", "negative", "neutral"]
    
    def test_single_label_with_confidence(self, model):
        """Testa classificação com scores de confiança."""
        text = "I love this product, it's amazing!"
        
        result = model.classify_text(
            text,
            {"sentiment": ["positive", "negative", "neutral"]},
            include_confidence=True
        )
        
        assert "sentiment" in result
        assert isinstance(result["sentiment"], dict)
        assert "label" in result["sentiment"]
        assert "confidence" in result["sentiment"]
        assert 0 <= result["sentiment"]["confidence"] <= 1
    
    def test_multi_label_classification(self, model):
        """Testa classificação multi-label."""
        text = "This laptop has great performance but terrible battery life."
        
        result = model.classify_text(
            text,
            {
                "aspects": {
                    "labels": ["performance", "battery", "display", "price"],
                    "multi_label": True,
                    "cls_threshold": 0.3
                }
            }
        )
        
        assert "aspects" in result
        assert isinstance(result["aspects"], list)
        # Deve ter pelo menos um aspecto
        assert len(result["aspects"]) > 0
    
    def test_multi_label_with_confidence(self, model):
        """Testa multi-label com confiança."""
        text = "Great camera quality, decent performance, but poor battery life."
        
        result = model.classify_text(
            text,
            {
                "aspects": {
                    "labels": ["camera", "performance", "battery"],
                    "multi_label": True,
                    "cls_threshold": 0.3
                }
            },
            include_confidence=True
        )
        
        assert "aspects" in result
        # Cada resultado deve ter label e confidence
        for item in result["aspects"]:
            assert isinstance(item, dict)
            assert "label" in item
            assert "confidence" in item
    
    def test_classification_with_descriptions(self, model):
        """Testa classificação com descrições de labels."""
        text = "The stock market crashed today after bad economic news."
        
        result = model.classify_text(
            text,
            {
                "sentiment": {
                    "positive": "Expresses happiness, joy, or satisfaction",
                    "negative": "Expresses sadness, anger, or disappointment",
                    "neutral": "Expresses no strong emotion"
                }
            }
        )
        
        assert "sentiment" in result
        assert result["sentiment"] in ["positive", "negative", "neutral"]
    
    def test_classification_threshold(self, model):
        """Testa threshold de classificação."""
        text = "The weather today is quite typical for this time of year."
        
        result = model.classify_text(
            text,
            {
                "sentiment": {
                    "labels": ["positive", "negative", "neutral"],
                    "cls_threshold": 0.9  # Threshold alto
                }
            }
        )
        
        # Deve retornar algum resultado mesmo com threshold alto
        assert "sentiment" in result
    
    def test_multiple_classification_tasks(self, model):
        """Testa múltiplas tarefas de classificação."""
        text = "Apple announced record profits and their stock price surged."
        
        schema = (model.create_schema()
            .classification("sentiment", ["positive", "negative", "neutral"])
            .classification("category", ["technology", "finance", "health"])
        )
        
        result = model.extract(text, schema)
        
        assert "sentiment" in result
        assert "category" in result
    
    def test_batch_classification(self, model):
        """Testa classificação em batch."""
        texts = [
            "I love this!",
            "This is terrible.",
            "It's okay, nothing special."
        ]
        
        results = model.batch_classify_text(
            texts,
            {"sentiment": ["positive", "negative", "neutral"]}
        )
        
        assert len(results) == 3
        for result in results:
            assert "sentiment" in result
    
    def test_classification_with_schema_builder(self, model):
        """Testa classificação usando Schema builder."""
        text = "This is an urgent security update for your system."
        
        schema = model.create_schema().classification(
            "priority",
            ["low", "medium", "high", "urgent"]
        )
        
        result = model.extract(text, schema)
        
        assert "priority" in result
        assert result["priority"] in ["low", "medium", "high", "urgent"]


class TestClassificationEdgeCases:
    """Testes de edge cases para classificação."""
    
    def test_empty_text(self, model):
        """Testa com texto vazio."""
        result = model.classify_text(
            "",
            {"sentiment": ["positive", "negative"]}
        )
        
        # Deve retornar algum resultado (mesmo que padrão)
        assert "sentiment" in result
    
    def test_very_long_text(self, model):
        """Testa com texto muito longo."""
        text = "This is great! " * 100
        
        result = model.classify_text(
            text,
            {"sentiment": ["positive", "negative", "neutral"]}
        )
        
        assert "sentiment" in result
    
    def test_special_characters(self, model):
        """Testa com caracteres especiais."""
        text = "Amazing!!! 🎉 $100 off!!! #deal #amazing"
        
        result = model.classify_text(
            text,
            {"sentiment": ["positive", "negative", "neutral"]}
        )
        
        assert "sentiment" in result
    
    def test_ambiguous_text(self, model):
        """Testa com texto ambíguo."""
        text = "Well, it could have been worse, I suppose."
        
        result = model.classify_text(
            text,
            {"sentiment": ["positive", "negative", "neutral"]}
        )
        
        # Deve classificar de alguma forma
        assert result["sentiment"] in ["positive", "negative", "neutral"]


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
