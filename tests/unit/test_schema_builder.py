"""
Testes unitários para o Schema Builder do GLiNER2.

Testa: StructureBuilder, Schema, SchemaAPI (API client)
"""

import pytest
from collections import OrderedDict

from gliner2.inference.engine import Schema, StructureBuilder, RegexValidator
from gliner2.api_client import SchemaAPI, StructureBuilderAPI


# =============================================================================
# Tests for RegexValidator
# =============================================================================

class TestRegexValidator:
    """Testes para RegexValidator."""
    
    def test_validator_creation_string_pattern(self):
        """Testa criação com pattern string."""
        validator = RegexValidator(r"^\d+$")
        
        assert validator.pattern == r"^\d+$"
        assert validator.mode == "full"
        assert validator.exclude is False
    
    def test_validator_creation_compiled_pattern(self):
        """Testa criação com pattern compilado."""
        import re
        pattern = re.compile(r"^\d+$")
        validator = RegexValidator(pattern)
        
        assert validator._compiled is pattern
    
    def test_validator_creation_partial_mode(self):
        """Testa criação com mode='partial'."""
        validator = RegexValidator(r"\d+", mode="partial")
        
        assert validator.mode == "partial"
    
    def test_validator_creation_exclude_mode(self):
        """Testa criação com exclude=True."""
        validator = RegexValidator(r"test", exclude=True)
        
        assert validator.exclude is True
    
    def test_validator_invalid_mode(self):
        """Testa erro com mode inválido."""
        with pytest.raises(ValueError):
            RegexValidator(r"test", mode="invalid")
    
    def test_validator_invalid_regex(self):
        """Testa erro com regex inválido."""
        with pytest.raises(ValueError):
            RegexValidator(r"[invalid")
    
    def test_validator_full_match_success(self):
        """Testa match completo bem-sucedido."""
        validator = RegexValidator(r"^\d+$")
        
        assert validator("12345") is True
        assert validator("abc") is False
    
    def test_validator_full_match_exclude(self):
        """Testa match completo com exclude."""
        validator = RegexValidator(r"^test$", exclude=True)
        
        assert validator("test") is False   # Matcha completamente, mas exclui
        assert validator("hello") is True   # Não matcha, inclui
    
    def test_validator_partial_match(self):
        """Testa match parcial."""
        validator = RegexValidator(r"\d+", mode="partial")
        
        assert validator("abc123def") is True
        assert validator("abcdef") is False
    
    def test_validator_callable(self):
        """Testa que validator é callable."""
        validator = RegexValidator(r"test")
        
        result = validator("test")
        assert isinstance(result, bool)


# =============================================================================
# Tests for StructureBuilder
# =============================================================================

class TestStructureBuilder:
    """Testes para StructureBuilder."""
    
    @pytest.fixture
    def schema(self):
        return Schema()
    
    @pytest.fixture
    def builder(self, schema):
        return StructureBuilder(schema, "product")
    
    def test_initialization(self, builder, schema):
        """Testa inicialização."""
        assert builder.schema is schema
        assert builder.parent == "product"
        assert builder.fields == OrderedDict()
        assert builder._finished is False
    
    def test_add_field_basic(self, builder):
        """Testa adição de campo básico."""
        result = builder.field("name")
        
        assert result is builder  # Retorna self para chaining
        assert "name" in builder.fields
        assert builder.fields["name"] == ""
        assert "name" in builder.field_order
    
    def test_add_field_with_dtype(self, builder):
        """Testa adição de campo com dtype."""
        builder.field("name", dtype="str")
        
        assert builder.fields["name"] == ""
    
    def test_add_field_with_choices(self, builder, schema):
        """Testa adição de campo com choices."""
        builder.field("tier", choices=["basic", "premium", "enterprise"])
        
        assert "value" in builder.fields["tier"]
        assert "choices" in builder.fields["tier"]
        assert builder.fields["tier"]["choices"] == ["basic", "premium", "enterprise"]
    
    def test_add_field_with_description(self, builder):
        """Testa adição de campo com descrição."""
        builder.field("name", description="Product name")
        
        assert builder.descriptions["name"] == "Product name"
    
    def test_add_field_with_threshold(self, builder, schema):
        """Testa adição de campo com threshold."""
        builder.field("name", threshold=0.8)
        
        metadata = schema._field_metadata.get("product.name")
        assert metadata is not None
        assert metadata["threshold"] == 0.8
    
    def test_add_field_with_validators(self, builder, schema):
        """Testa adição de campo com validators."""
        validator = RegexValidator(r"^\d+$")
        builder.field("code", validators=[validator])
        
        metadata = schema._field_metadata.get("product.code")
        assert metadata is not None
        assert metadata["validators"] == [validator]
    
    def test_add_field_invalid_threshold(self, builder):
        """Testa erro com threshold inválido."""
        with pytest.raises(ValueError):
            builder.field("name", threshold=1.5)
    
    def test_chaining(self, builder):
        """Testa chaining de métodos."""
        builder.field("name").field("price").field("description")
        
        assert len(builder.fields) == 3
        assert list(builder.fields.keys()) == ["name", "price", "description"]
    
    def test_auto_finish(self, builder, schema):
        """Testa finalização automática."""
        builder.field("name").field("price")
        builder._auto_finish()
        
        assert builder._finished is True
        assert len(schema.schema["json_structures"]) == 1
        assert "product" in schema.schema["json_structures"][0]
    
    def test_auto_finish_with_descriptions(self, builder, schema):
        """Testa finalização com descrições."""
        builder.field("name", description="Product name")
        builder._auto_finish()
        
        assert "json_descriptions" in schema.schema
        assert "product" in schema.schema["json_descriptions"]


# =============================================================================
# Tests for Schema (Local Model)
# =============================================================================

class TestSchema:
    """Testes para Schema (builder de schemas local)."""
    
    @pytest.fixture
    def schema(self):
        return Schema()
    
    def test_initialization(self, schema):
        """Testa inicialização."""
        assert schema.schema["json_structures"] == []
        assert schema.schema["classifications"] == []
        assert schema.schema["entities"] == OrderedDict()
        assert schema.schema["relations"] == []
    
    def test_structure_method(self, schema):
        """Testa método structure."""
        builder = schema.structure("product")
        
        assert isinstance(builder, StructureBuilder)
        assert builder.parent == "product"
    
    def test_structure_auto_finishes_previous(self, schema):
        """Testa que structure finaliza builder anterior."""
        builder1 = schema.structure("product")
        builder1.field("name")
        
        builder2 = schema.structure("company")
        builder2.field("name")
        
        # builder1 deve ter sido finalizado automaticamente
        assert builder1._finished is True
    
    def test_classification_basic(self, schema):
        """Testa adição de classificação básica."""
        result = schema.classification("sentiment", ["positive", "negative"])
        
        assert result is schema  # Retorna self para chaining
        assert len(schema.schema["classifications"]) == 1
        assert schema.schema["classifications"][0]["task"] == "sentiment"
    
    def test_classification_with_dict_labels(self, schema):
        """Testa classificação com labels como dict."""
        labels = {
            "positive": "Good sentiment",
            "negative": "Bad sentiment"
        }
        schema.classification("sentiment", labels)
        
        cls = schema.schema["classifications"][0]
        assert cls["labels"] == ["positive", "negative"]
        assert cls["label_descriptions"]["positive"] == "Good sentiment"
    
    def test_classification_multi_label(self, schema):
        """Testa classificação multi-label."""
        schema.classification(
            "topics",
            ["tech", "business", "sports"],
            multi_label=True,
            cls_threshold=0.3
        )
        
        cls = schema.schema["classifications"][0]
        assert cls["multi_label"] is True
        assert cls["cls_threshold"] == 0.3
    
    def test_classification_auto_finishes_structure(self, schema):
        """Testa que classification finaliza structure builder."""
        builder = schema.structure("product")
        builder.field("name")
        
        schema.classification("sentiment", ["positive", "negative"])
        
        assert builder._finished is True
    
    def test_entities_basic_list(self, schema):
        """Testa adição de entidades como lista."""
        result = schema.entities(["person", "company", "product"])
        
        assert result is schema
        assert list(schema.schema["entities"].keys()) == ["person", "company", "product"]
    
    def test_entities_basic_string(self, schema):
        """Testa adição de entidade como string."""
        schema.entities("person")
        
        assert "person" in schema.schema["entities"]
    
    def test_entities_with_dict_descriptions(self, schema):
        """Testa entidades com descrições."""
        entities = {
            "person": "Names of people",
            "company": "Company names"
        }
        schema.entities(entities)
        
        assert schema.schema["entity_descriptions"]["person"] == "Names of people"
        assert schema.schema["entity_descriptions"]["company"] == "Company names"
    
    def test_entities_with_dict_config(self, schema):
        """Testa entidades com configuração completa."""
        entities = {
            "person": {"description": "Names", "dtype": "str", "threshold": 0.8}
        }
        schema.entities(entities)
        
        metadata = schema._entity_metadata.get("person")
        assert metadata["dtype"] == "str"
        assert metadata["threshold"] == 0.8
    
    def test_entities_single_dtype(self, schema):
        """Testa entidades com dtype='str'."""
        schema.entities(["person", "company"], dtype="str", threshold=0.7)
        
        assert schema._entity_metadata["person"]["dtype"] == "str"
        assert schema._entity_metadata["person"]["threshold"] == 0.7
    
    def test_entities_auto_finishes_structure(self, schema):
        """Testa que entities finaliza structure builder."""
        builder = schema.structure("product")
        builder.field("name")
        
        schema.entities(["person"])
        
        assert builder._finished is True
    
    def test_entities_invalid_format(self, schema):
        """Testa erro com formato inválido."""
        with pytest.raises(ValueError):
            schema.entities(12345)
    
    def test_relations_basic_list(self, schema):
        """Testa adição de relações como lista."""
        result = schema.relations(["works_for", "founded", "acquired"])
        
        assert result is schema
        assert len(schema.schema["relations"]) == 3
        assert schema.schema["relations"][0] == {"works_for": {"head": "", "tail": ""}}
    
    def test_relations_basic_string(self, schema):
        """Testa adição de relação como string."""
        schema.relations("works_for")
        
        assert len(schema.schema["relations"]) == 1
    
    def test_relations_with_dict_descriptions(self, schema):
        """Testa relações com descrições."""
        relations = {
            "works_for": "Employment relationship",
            "founded": "Founding relationship"
        }
        schema.relations(relations)
        
        assert "works_for" in schema._relation_metadata
    
    def test_relations_with_threshold(self, schema):
        """Testa relações com threshold."""
        schema.relations(["works_for"], threshold=0.8)
        
        assert schema._relation_metadata["works_for"]["threshold"] == 0.8
    
    def test_relations_invalid_threshold(self, schema):
        """Testa erro com threshold inválido."""
        with pytest.raises(ValueError):
            schema.relations(["works_for"], threshold=1.5)
    
    def test_relations_auto_finishes_structure(self, schema):
        """Testa que relations finaliza structure builder."""
        builder = schema.structure("product")
        builder.field("name")
        
        schema.relations(["works_for"])
        
        assert builder._finished is True
    
    def test_relations_invalid_format(self, schema):
        """Testa erro com formato inválido."""
        with pytest.raises(ValueError):
            schema.relations(12345)
    
    def test_build_empty(self, schema):
        """Testa build com schema vazio."""
        result = schema.build()
        
        assert result["json_structures"] == []
        assert result["classifications"] == []
        assert result["entities"] == OrderedDict()
        assert result["relations"] == []
    
    def test_build_with_structure(self, schema):
        """Testa build com structure."""
        schema.structure("product").field("name").field("price")
        
        result = schema.build()
        
        assert len(result["json_structures"]) == 1
        assert "product" in result["json_structures"][0]
    
    def test_build_with_entities(self, schema):
        """Testa build com entities."""
        schema.entities(["person", "company"])
        
        result = schema.build()
        
        assert "person" in result["entities"]
        assert "company" in result["entities"]
    
    def test_build_with_classification(self, schema):
        """Testa build com classification."""
        schema.classification("sentiment", ["positive", "negative"])
        
        result = schema.build()
        
        assert len(result["classifications"]) == 1
    
    def test_build_with_relations(self, schema):
        """Testa build com relations."""
        schema.relations(["works_for"])
        
        result = schema.build()
        
        assert len(result["relations"]) == 1
    
    def test_build_comprehensive(self, schema):
        """Testa build com múltiplas tarefas."""
        (schema
            .structure("product").field("name").field("price")
            .entities(["person", "company"])
            .classification("sentiment", ["positive", "negative"])
            .relations(["works_for"]))
        
        result = schema.build()
        
        assert len(result["json_structures"]) == 1
        assert len(result["entities"]) == 2
        assert len(result["classifications"]) == 1
        assert len(result["relations"]) == 1
    
    def test_field_metadata_storage(self, schema):
        """Testa armazenamento de metadata de campos."""
        (schema
            .structure("product")
            .field("name", dtype="str", threshold=0.8)
            .field("price", dtype="list", threshold=0.5))
        
        schema.build()
        
        assert schema._field_metadata["product.name"]["dtype"] == "str"
        assert schema._field_metadata["product.name"]["threshold"] == 0.8
        assert schema._field_metadata["product.price"]["dtype"] == "list"
    
    def test_field_order_storage(self, schema):
        """Testa armazenamento de ordem de campos."""
        (schema
            .structure("product")
            .field("name")
            .field("price")
            .field("description"))
        
        schema.build()
        
        assert schema._field_orders["product"] == ["name", "price", "description"]


# =============================================================================
# Tests for SchemaAPI (API Client)
# =============================================================================

class TestSchemaAPI:
    """Testes para SchemaAPI (builder de schemas para API)."""
    
    @pytest.fixture
    def schema_api(self):
        return SchemaAPI()
    
    def test_initialization(self, schema_api):
        """Testa inicialização."""
        assert schema_api._entities is None
        assert schema_api._entity_dtype == "list"
        assert schema_api._classifications == {}
        assert schema_api._structures == {}
        assert schema_api._relations is None
    
    def test_entities_list(self, schema_api):
        """Testa adição de entidades como lista."""
        result = schema_api.entities(["person", "company"])
        
        assert result is schema_api
        assert schema_api._entities == ["person", "company"]
    
    def test_entities_dict(self, schema_api):
        """Testa adição de entidades como dict."""
        schema_api.entities({"person": {}, "company": {}})
        
        assert isinstance(schema_api._entities, dict)
    
    def test_entities_string(self, schema_api):
        """Testa adição de entidade como string."""
        schema_api.entities("person")
        
        assert schema_api._entities == ["person"]
    
    def test_entities_with_options(self, schema_api):
        """Testa entidades com dtype e threshold."""
        schema_api.entities(["person"], dtype="str", threshold=0.8)
        
        assert schema_api._entity_dtype == "str"
        assert schema_api._entity_threshold == 0.8
    
    def test_entities_auto_finishes_structure(self, schema_api):
        """Testa que entities finaliza structure builder."""
        builder = schema_api.structure("product")
        builder.field("name")
        
        schema_api.entities(["person"])
        
        assert builder._finished is True
    
    def test_classification_basic(self, schema_api):
        """Testa adição de classificação."""
        result = schema_api.classification("sentiment", ["positive", "negative"])
        
        assert result is schema_api
        assert "sentiment" in schema_api._classifications
    
    def test_classification_with_dict_labels(self, schema_api):
        """Testa classificação com labels como dict."""
        labels = {"positive": "Good", "negative": "Bad"}
        schema_api.classification("sentiment", labels)
        
        assert schema_api._classifications["sentiment"]["labels"] == ["positive", "negative"]
    
    def test_classification_options(self, schema_api):
        """Testa classificação com opções."""
        schema_api.classification(
            "topics",
            ["tech", "business"],
            multi_label=True,
            cls_threshold=0.3
        )
        
        cls = schema_api._classifications["topics"]
        assert cls["multi_label"] is True
        assert cls["cls_threshold"] == 0.3
    
    def test_classification_auto_finishes_structure(self, schema_api):
        """Testa que classification finaliza structure builder."""
        builder = schema_api.structure("product")
        builder.field("name")
        
        schema_api.classification("sentiment", ["positive"])
        
        assert builder._finished is True
    
    def test_structure_method(self, schema_api):
        """Testa método structure."""
        builder = schema_api.structure("product")
        
        assert isinstance(builder, StructureBuilderAPI)
        assert builder.parent == "product"
    
    def test_structure_auto_finishes_previous(self, schema_api):
        """Testa que structure finaliza builder anterior."""
        builder1 = schema_api.structure("product")
        builder1.field("name")
        
        builder2 = schema_api.structure("company")
        builder2.field("name")
        
        assert builder1._finished is True
    
    def test_relations_list(self, schema_api):
        """Testa adição de relações como lista."""
        result = schema_api.relations(["works_for", "founded"])
        
        assert result is schema_api
        assert schema_api._relations == ["works_for", "founded"]
    
    def test_relations_dict(self, schema_api):
        """Testa adição de relações como dict."""
        schema_api.relations({"works_for": "Employment", "founded": "Founding"})
        
        assert isinstance(schema_api._relations, dict)
    
    def test_relations_string(self, schema_api):
        """Testa adição de relação como string."""
        schema_api.relations("works_for")
        
        assert schema_api._relations == ["works_for"]
    
    def test_relations_with_threshold(self, schema_api):
        """Testa relações com threshold."""
        schema_api.relations(["works_for"], threshold=0.8)
        
        assert schema_api._relation_threshold == 0.8
    
    def test_relations_auto_finishes_structure(self, schema_api):
        """Testa que relations finaliza structure builder."""
        builder = schema_api.structure("product")
        builder.field("name")
        
        schema_api.relations(["works_for"])
        
        assert builder._finished is True
    
    def test_build_empty(self, schema_api):
        """Testa build vazio."""
        result = schema_api.build()
        
        assert result == {}
    
    def test_build_with_entities(self, schema_api):
        """Testa build com entidades."""
        schema_api.entities(["person", "company"], dtype="list")
        
        result = schema_api.build()
        
        assert result["entities"] == ["person", "company"]
        assert result["entity_dtype"] == "list"
    
    def test_build_with_entities_threshold(self, schema_api):
        """Testa build com entidades e threshold."""
        schema_api.entities(["person"], threshold=0.8)
        
        result = schema_api.build()
        
        assert result["entity_threshold"] == 0.8
    
    def test_build_with_classifications(self, schema_api):
        """Testa build com classificações."""
        schema_api.classification("sentiment", ["positive", "negative"])
        
        result = schema_api.build()
        
        assert "classifications" in result
        assert "sentiment" in result["classifications"]
    
    def test_build_with_structures(self, schema_api):
        """Testa build com estruturas."""
        (schema_api
            .structure("product")
            .field("name", dtype="str")
            .field("price", dtype="str"))
        
        result = schema_api.build()
        
        assert "structures" in result
        assert "product" in result["structures"]
    
    def test_build_with_relations(self, schema_api):
        """Testa build com relações."""
        schema_api.relations(["works_for", "founded"], threshold=0.7)
        
        result = schema_api.build()
        
        assert result["relations"] == ["works_for", "founded"]
        assert result["relation_threshold"] == 0.7
    
    def test_build_comprehensive(self, schema_api):
        """Testa build completo."""
        (schema_api
            .entities(["person", "company"])
            .classification("sentiment", ["positive", "negative"])
            .structure("product").field("name")
            .relations(["works_for"]))
        
        result = schema_api.build()
        
        assert "entities" in result
        assert "classifications" in result
        assert "structures" in result
        assert "relations" in result


# =============================================================================
# Tests for StructureBuilderAPI
# =============================================================================

class TestStructureBuilderAPI:
    """Testes para StructureBuilderAPI."""
    
    @pytest.fixture
    def schema_api(self):
        return SchemaAPI()
    
    @pytest.fixture
    def builder(self, schema_api):
        return StructureBuilderAPI(schema_api, "product")
    
    def test_initialization(self, builder, schema_api):
        """Testa inicialização."""
        assert builder.schema is schema_api
        assert builder.parent == "product"
        assert builder._finished is False
    
    def test_add_field_basic(self, builder):
        """Testa adição de campo básico."""
        result = builder.field("name")
        
        assert result is builder
        assert "name" in builder.fields
        assert builder.field_order == ["name"]
    
    def test_add_field_full_spec(self, builder):
        """Testa adição de campo completo."""
        validator = RegexValidator(r"^\d+$")
        builder.field(
            "code",
            dtype="str",
            choices=None,
            description="Product code",
            threshold=0.8,
            validators=[validator]
        )
        
        assert builder.fields["code"]["dtype"] == "str"
        assert builder.fields["code"]["description"] == "Product code"
        assert builder.fields["code"]["threshold"] == 0.8
    
    def test_add_field_with_choices(self, builder):
        """Testa adição com choices."""
        builder.field("tier", choices=["basic", "premium"])
        
        assert builder.fields["tier"]["choices"] == ["basic", "premium"]
    
    def test_add_field_with_validators_warning(self, builder):
        """Testa warning quando validators são usados."""
        import warnings
        validator = RegexValidator(r"test")
        
        with warnings.catch_warnings(record=True) as w:
            warnings.simplefilter("always")
            builder.field("code", validators=[validator])
            
            assert len(w) == 1
            assert "not supported in API mode" in str(w[0].message)
    
    def test_auto_finish_basic(self, builder, schema_api):
        """Testa finalização automática."""
        builder.field("name")
        builder._auto_finish()
        
        assert builder._finished is True
        assert "product" in schema_api._structures
    
    def test_auto_finish_simple_format(self, builder, schema_api):
        """Testa finalização com formato simples."""
        builder.field("name")
        builder._auto_finish()
        
        # Formato simples: "name::list"
        assert schema_api._structures["product"] == ["name::list"]
    
    def test_auto_finish_dict_format(self, builder, schema_api):
        """Testa finalização com formato dict."""
        builder.field("tier", choices=["basic", "premium"])
        builder._auto_finish()
        
        # Deve usar formato dict por ter choices
        structures = schema_api._structures["product"]
        assert isinstance(structures[0], dict)
        assert structures[0]["name"] == "tier"
        assert structures[0]["choices"] == ["basic", "premium"]
    
    def test_getattr_auto_finish(self, builder, schema_api):
        """Testa que getattr finaliza automaticamente."""
        builder.field("name")
        
        # Acessar atributo do schema deve finalizar
        _ = builder.entities
        
        assert builder._finished is True
    
    def test_getattr_invalid(self, builder):
        """Testa erro com atributo inválido."""
        with pytest.raises(AttributeError):
            _ = builder.nonexistent_attribute
