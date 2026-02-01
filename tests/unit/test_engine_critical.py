"""
Testes críticos para o engine do GLiNER2.

Foca em: Schema, RegexValidator, StructureBuilder.
"""

import pytest
import re
from unittest.mock import MagicMock, patch
from collections import OrderedDict


# =============================================================================
# Tests for RegexValidator
# =============================================================================

class TestRegexValidator:
    """Testes para RegexValidator."""
    
    def test_basic_creation(self):
        """Testa criação básica."""
        from gliner2.inference.engine import RegexValidator
        
        validator = RegexValidator(pattern=r"\d+")
        
        assert validator.pattern == r"\d+"
        assert validator.mode == "full"
        assert validator.exclude is False
    
    def test_custom_mode(self):
        """Testa modo partial."""
        from gliner2.inference.engine import RegexValidator
        
        validator = RegexValidator(pattern=r"test", mode="partial")
        
        assert validator.mode == "partial"
    
    def test_exclude_mode(self):
        """Testa modo exclude."""
        from gliner2.inference.engine import RegexValidator
        
        validator = RegexValidator(pattern=r"bad", exclude=True)
        
        assert validator.exclude is True
    
    def test_invalid_mode(self):
        """Testa modo inválido."""
        from gliner2.inference.engine import RegexValidator
        
        with pytest.raises(ValueError, match="mode must be 'full' or 'partial'"):
            RegexValidator(pattern=r"test", mode="invalid")
    
    def test_invalid_regex(self):
        """Testa regex inválido."""
        from gliner2.inference.engine import RegexValidator
        
        with pytest.raises(ValueError, match="Invalid regex"):
            RegexValidator(pattern=r"[invalid")
    
    def test_validate_full_match(self):
        """Testa validação full match."""
        from gliner2.inference.engine import RegexValidator
        
        validator = RegexValidator(pattern=r"\d{3}")
        
        assert validator.validate("123") is True
        assert validator.validate("1234") is False
        assert validator.validate("abc") is False
    
    def test_validate_partial_match(self):
        """Testa validação partial match."""
        from gliner2.inference.engine import RegexValidator
        
        validator = RegexValidator(pattern=r"test", mode="partial")
        
        assert validator.validate("this is a test") is True
        assert validator.validate("testing") is True
        assert validator.validate("nothing") is False
    
    def test_validate_exclude(self):
        """Testa validação com exclude - texto que NÃO deve conter o padrão."""
        from gliner2.inference.engine import RegexValidator
        
        # exclude=True: inverte o resultado
        # Com mode="full": procura match exato
        validator = RegexValidator(pattern=r"spam", exclude=True, mode="full")
        
        # "spam" dá match exato, então matched=True, return not True = False
        assert validator.validate("spam") is False
        # "good" não dá match, matched=False, return not False = True
        assert validator.validate("good") is True
        
        # Com partial: "this is spam" contém "spam"
        validator_partial = RegexValidator(pattern=r"spam", exclude=True, mode="partial")
        # "this is spam" contém "spam", matched=True, return not True = False
        assert validator_partial.validate("this is spam") is False
        # "good text" não contém "spam", matched=False, return not False = True
        assert validator_partial.validate("good text") is True
    
    def test_callable(self):
        """Testa que é callable."""
        from gliner2.inference.engine import RegexValidator
        
        validator = RegexValidator(pattern=r"\d+")
        
        # Deve ser callable
        assert callable(validator)
        assert validator("123") is True


# =============================================================================
# Tests for Schema
# =============================================================================

class TestSchema:
    """Testes para Schema."""
    
    def test_basic_creation(self):
        """Testa criação básica."""
        from gliner2.inference.engine import Schema
        
        schema = Schema()
        
        assert isinstance(schema.schema, dict)
        assert "json_structures" in schema.schema
        assert "classifications" in schema.schema
        assert "entities" in schema.schema
        assert "relations" in schema.schema
    
    def test_entities_with_list(self):
        """Testa adição de entidades com lista - retorna OrderedDict."""
        from gliner2.inference.engine import Schema
        
        schema = Schema()
        schema.entities(["person", "company", "location"])
        
        result = schema.build()
        # API real retorna OrderedDict, não lista
        assert isinstance(result["entities"], OrderedDict)
        assert "person" in result["entities"]
        assert "company" in result["entities"]
        assert "location" in result["entities"]
    
    def test_entities_with_dict(self):
        """Testa adição de entidades com dicionário."""
        from gliner2.inference.engine import Schema
        
        schema = Schema()
        schema.entities({
            "person": "Names of people",
            "company": "Business names"
        })
        
        result = schema.build()
        assert "person" in result["entity_descriptions"]
        assert result["entity_descriptions"]["person"] == "Names of people"
    
    def test_classification_with_list(self):
        """Testa adição de classificação com lista."""
        from gliner2.inference.engine import Schema
        
        schema = Schema()
        schema.classification("sentiment", ["positive", "negative", "neutral"])
        
        result = schema.build()
        assert len(result["classifications"]) == 1
        assert result["classifications"][0]["task"] == "sentiment"
    
    def test_classification_with_dict(self):
        """Testa adição de classificação com dicionário."""
        from gliner2.inference.engine import Schema
        
        schema = Schema()
        schema.classification("category", {
            "tech": "Technology related",
            "sports": "Sports related"
        })
        
        result = schema.build()
        assert "label_descriptions" in result["classifications"][0]
    
    def test_classification_multi_label(self):
        """Testa classificação multi-label."""
        from gliner2.inference.engine import Schema
        
        schema = Schema()
        schema.classification(
            "tags",
            ["important", "urgent", "review"],
            multi_label=True
        )
        
        result = schema.build()
        assert result["classifications"][0]["multi_label"] is True
    
    def test_classification_threshold(self):
        """Testa threshold de classificação."""
        from gliner2.inference.engine import Schema
        
        schema = Schema()
        schema.classification(
            "category",
            ["A", "B"],
            cls_threshold=0.7
        )
        
        result = schema.build()
        assert result["classifications"][0]["cls_threshold"] == 0.7
    
    def test_relations(self):
        """Testa adição de relações - retorna lista de dicts."""
        from gliner2.inference.engine import Schema
        
        schema = Schema()
        schema.relations(["works_at", "lives_in", "founded"])
        
        result = schema.build()
        # API real retorna lista de dicts
        assert isinstance(result["relations"], list)
        assert len(result["relations"]) == 3
        # Cada relação é um dict com a relação como chave
        assert "works_at" in result["relations"][0]
        assert "lives_in" in result["relations"][1]
        assert "founded" in result["relations"][2]
    
    def test_chained_calls(self):
        """Testa chamadas encadeadas."""
        from gliner2.inference.engine import Schema
        
        schema = Schema()
        result = schema \
            .entities(["person", "company"]) \
            .classification("sentiment", ["pos", "neg"]) \
            .relations(["works_at"]) \
            .build()
        
        assert len(result["entities"]) == 2
        assert len(result["classifications"]) == 1
        assert len(result["relations"]) == 1
    
    def test_structure_creation(self):
        """Testa criação de estrutura."""
        from gliner2.inference.engine import Schema
        
        schema = Schema()
        builder = schema.structure("person")
        
        assert builder is not None
    
    def test_structure_with_fields(self):
        """Testa estrutura com campos."""
        from gliner2.inference.engine import Schema
        
        schema = Schema()
        result = schema \
            .structure("person") \
            .field("name") \
            .field("age", dtype="str") \
            .build()
        
        assert len(result["json_structures"]) == 1
    
    def test_structure_field_with_description(self):
        """Testa campo com descrição."""
        from gliner2.inference.engine import Schema
        
        schema = Schema()
        result = schema \
            .structure("person") \
            .field("name", description="Full name of the person") \
            .build()
        
        assert "json_descriptions" in result
        assert "person" in result["json_descriptions"]
    
    def test_structure_field_with_choices(self):
        """Testa campo com choices."""
        from gliner2.inference.engine import Schema
        
        schema = Schema()
        result = schema \
            .structure("user") \
            .field("role", choices=["admin", "user", "guest"]) \
            .build()
        
        structures = result["json_structures"]
        assert len(structures) == 1
    
    def test_build_returns_dict(self):
        """Testa que build retorna dict."""
        from gliner2.inference.engine import Schema
        
        schema = Schema()
        result = schema.build()
        
        assert isinstance(result, dict)


# =============================================================================
# Tests for StructureBuilder
# =============================================================================

class TestStructureBuilder:
    """Testes para StructureBuilder."""
    
    def test_field_returns_self(self):
        """Testa que field retorna self para chaining."""
        from gliner2.inference.engine import Schema
        
        schema = Schema()
        builder = schema.structure("test")
        
        result = builder.field("field1")
        
        assert result is builder
    
    def test_multiple_fields(self):
        """Testa múltiplos campos."""
        from gliner2.inference.engine import Schema
        
        schema = Schema()
        builder = schema.structure("person")
        
        builder.field("name")
        builder.field("email")
        builder.field("phone")
        
        # Força finalização
        result = schema.build()
        
        assert len(result["json_structures"]) == 1
    
    def test_auto_finish_on_build(self):
        """Testa auto-finalização no build."""
        from gliner2.inference.engine import Schema
        
        schema = Schema()
        schema.structure("test").field("field1")
        
        # build deve auto-finalizar
        result = schema.build()
        
        assert len(result["json_structures"]) == 1


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
