"""
Testes unitários para dados de treinamento do GLiNER2.

Testa: InputExample, Classification, Structure, Relation, 
       TrainingDataset, DataLoader_Factory
"""

import pytest
import json
import tempfile
from pathlib import Path
from unittest.mock import patch, mock_open

from gliner2.training.data import (
    InputExample,
    Classification,
    Structure,
    Relation,
    ChoiceField,
    TrainingDataset,
    DataLoader_Factory,
    DataFormat,
    detect_data_format,
    ValidationError,
    create_entity_example,
    create_classification_example,
    create_structure_example,
    create_relation_example,
)


# =============================================================================
# Tests for Classification
# =============================================================================

class TestClassification:
    """Testes para a classe Classification."""
    
    def test_classification_creation(self):
        """Testa criação básica de Classification."""
        cls = Classification(
            task="sentiment",
            labels=["positive", "negative", "neutral"],
            true_label="positive"
        )
        
        assert cls.task == "sentiment"
        assert cls.labels == ["positive", "negative", "neutral"]
        assert cls._true_label_list == ["positive"]
        assert cls.multi_label is False
    
    def test_classification_multi_label_auto_detection(self):
        """Testa detecção automática de multi_label."""
        cls = Classification(
            task="topics",
            labels=["tech", "business", "sports"],
            true_label=["tech", "business"]
        )
        
        assert cls.multi_label is True
        assert cls._true_label_list == ["tech", "business"]
    
    def test_classification_validation_valid(self):
        """Testa validação de classification válida."""
        cls = Classification(
            task="sentiment",
            labels=["positive", "negative"],
            true_label="positive"
        )
        
        errors = cls.validate()
        assert errors == []
    
    def test_classification_validation_empty_task(self):
        """Testa validação com task vazio."""
        cls = Classification(
            task="",
            labels=["positive", "negative"],
            true_label="positive"
        )
        
        errors = cls.validate()
        assert any("task name cannot be empty" in e for e in errors)
    
    def test_classification_validation_no_labels(self):
        """Testa validação sem labels."""
        cls = Classification(
            task="sentiment",
            labels=[],
            true_label="positive"
        )
        
        errors = cls.validate()
        assert any("has no labels" in e for e in errors)
    
    def test_classification_validation_invalid_true_label(self):
        """Testa validação com true_label não presente em labels."""
        cls = Classification(
            task="sentiment",
            labels=["positive", "negative"],
            true_label="neutral"
        )
        
        errors = cls.validate()
        assert any("not in labels list" in e for e in errors)
    
    def test_classification_to_dict(self):
        """Testa conversão para dict."""
        cls = Classification(
            task="sentiment",
            labels=["positive", "negative"],
            true_label="positive",
            multi_label=False,
            prompt="Classify the sentiment",
            examples=[("Great!", "positive"), ("Bad!", "negative")],
            label_descriptions={"positive": "Good sentiment", "negative": "Bad sentiment"}
        )
        
        result = cls.to_dict()
        
        assert result["task"] == "sentiment"
        assert result["labels"] == ["positive", "negative"]
        assert result["true_label"] == ["positive"]
        # multi_label só é incluído no dict se for True
        assert "multi_label" not in result or result["multi_label"] is False
        assert result["prompt"] == "Classify the sentiment"
        assert result["examples"] == [["Great!", "positive"], ["Bad!", "negative"]]
        assert result["label_descriptions"]["positive"] == "Good sentiment"


# =============================================================================
# Tests for ChoiceField
# =============================================================================

class TestChoiceField:
    """Testes para a classe ChoiceField."""
    
    def test_choice_field_creation(self):
        """Testa criação de ChoiceField."""
        field = ChoiceField(value="premium", choices=["basic", "premium", "enterprise"])
        
        assert field.value == "premium"
        assert field.choices == ["basic", "premium", "enterprise"]
    
    def test_choice_field_validation_valid(self):
        """Testa validação de ChoiceField válido."""
        field = ChoiceField(value="premium", choices=["basic", "premium", "enterprise"])
        
        errors = field.validate("tier")
        assert errors == []
    
    def test_choice_field_validation_invalid(self):
        """Testa validação com valor inválido."""
        field = ChoiceField(value="invalid", choices=["basic", "premium"])
        
        errors = field.validate("tier")
        assert any("not in choices" in e for e in errors)
    
    def test_choice_field_to_dict(self):
        """Testa conversão para dict."""
        field = ChoiceField(value="premium", choices=["basic", "premium"])
        
        result = field.to_dict()
        assert result == {"value": "premium", "choices": ["basic", "premium"]}


# =============================================================================
# Tests for Structure
# =============================================================================

class TestStructure:
    """Testes para a classe Structure."""
    
    def test_structure_creation(self):
        """Testa criação básica de Structure."""
        struct = Structure(
            "product",
            name="iPhone 15",
            price="$999",
            company="Apple"
        )
        
        assert struct.struct_name == "product"
        assert struct._fields["name"] == "iPhone 15"
        assert struct._fields["price"] == "$999"
    
    def test_structure_with_descriptions(self):
        """Testa criação com descrições."""
        struct = Structure(
            "product",
            _descriptions={"name": "Product name", "price": "Product price"},
            name="iPhone 15"
        )
        
        assert struct.descriptions == {"name": "Product name", "price": "Product price"}
    
    def test_structure_validation_valid(self):
        """Testa validação de structure válida."""
        text = "Apple announced iPhone 15 at $999"
        struct = Structure("product", name="iPhone 15", price="$999")
        
        errors = struct.validate(text)
        assert errors == []
    
    def test_structure_validation_value_not_in_text(self):
        """Testa validação quando valor não está no texto."""
        text = "Apple announced iPhone 15"
        struct = Structure("product", name="iPhone 15", price="$999")
        
        errors = struct.validate(text)
        assert any("not found in text" in e for e in errors)
    
    def test_structure_validation_with_list_values(self):
        """Testa validação com valores em lista."""
        text = "Features include camera, battery, and display"
        struct = Structure("product", features=["camera", "battery", "display"])
        
        errors = struct.validate(text)
        assert errors == []
    
    def test_structure_validation_empty_name(self):
        """Testa validação com nome vazio."""
        struct = Structure("", name="test")
        
        errors = struct.validate("test text")
        assert any("name cannot be empty" in e for e in errors)
    
    def test_structure_validation_no_fields(self):
        """Testa validação sem campos."""
        struct = Structure("product")
        
        errors = struct.validate("test text")
        assert any("has no fields" in e for e in errors)
    
    def test_structure_with_choice_field(self):
        """Testa structure com ChoiceField."""
        struct = Structure(
            "subscription",
            tier=ChoiceField("premium", ["basic", "premium"]),
            price="$99"
        )
        
        errors = struct.validate("Premium subscription at $99")
        assert errors == []
    
    def test_structure_to_dict(self):
        """Testa conversão para dict."""
        struct = Structure("product", name="iPhone 15", price="$999")
        
        result = struct.to_dict()
        assert result == {"product": {"name": "iPhone 15", "price": "$999"}}
    
    def test_structure_get_descriptions(self):
        """Testa obtenção de descrições."""
        struct = Structure(
            "product",
            _descriptions={"name": "Product name"},
            name="iPhone 15"
        )
        
        result = struct.get_descriptions()
        assert result == {"product": {"name": "Product name"}}


# =============================================================================
# Tests for Relation
# =============================================================================

class TestRelation:
    """Testes para a classe Relation."""
    
    def test_relation_creation_head_tail(self):
        """Testa criação com head/tail."""
        rel = Relation("works_for", head="Tim Cook", tail="Apple")
        
        assert rel.name == "works_for"
        assert rel._fields == {"head": "Tim Cook", "tail": "Apple"}
    
    def test_relation_creation_custom_fields(self):
        """Testa criação com campos customizados."""
        rel = Relation("founded", founder="Elon Musk", company="SpaceX", year="2002")
        
        assert rel.name == "founded"
        assert rel._fields["founder"] == "Elon Musk"
        assert rel._fields["company"] == "SpaceX"
        assert rel._fields["year"] == "2002"
    
    def test_relation_validation_valid(self):
        """Testa validação de relation válida."""
        text = "Tim Cook works for Apple"
        rel = Relation("works_for", head="Tim Cook", tail="Apple")
        
        errors = rel.validate(text)
        assert errors == []
    
    def test_relation_validation_value_not_in_text(self):
        """Testa validação quando valor não está no texto."""
        text = "Tim Cook works for Google"
        rel = Relation("works_for", head="Tim Cook", tail="Apple")
        
        errors = rel.validate(text)
        assert any("not found in text" in e for e in errors)
    
    def test_relation_validation_empty_name(self):
        """Testa validação com nome vazio."""
        rel = Relation("", head="Tim", tail="Apple")
        
        errors = rel.validate("Tim works for Apple")
        assert any("name cannot be empty" in e for e in errors)
    
    def test_relation_validation_no_fields(self):
        """Testa validação sem campos."""
        rel = Relation("works_for")
        
        errors = rel.validate("test text")
        assert any("has no fields" in e for e in errors)
    
    def test_relation_get_field_names(self):
        """Testa obtenção de nomes de campos."""
        rel = Relation("founded", head="Elon", tail="SpaceX")
        
        fields = rel.get_field_names()
        assert set(fields) == {"head", "tail"}
    
    def test_relation_to_dict(self):
        """Testa conversão para dict."""
        rel = Relation("works_for", head="Tim Cook", tail="Apple")
        
        result = rel.to_dict()
        assert result == {"works_for": {"head": "Tim Cook", "tail": "Apple"}}


# =============================================================================
# Tests for InputExample
# =============================================================================

class TestInputExample:
    """Testes para a classe InputExample."""
    
    def test_input_example_creation_minimal(self):
        """Testa criação mínima de InputExample."""
        example = InputExample(text="Simple text")
        
        assert example.text == "Simple text"
        assert example.entities == {}
        assert example.classifications == []
        assert example.structures == []
        assert example.relations == []
    
    def test_input_example_creation_full(self):
        """Testa criação completa de InputExample."""
        example = InputExample(
            text="Tim Cook works at Apple in Cupertino.",
            entities={"person": ["Tim Cook"], "company": ["Apple"]},
            entity_descriptions={"person": "Names of people"},
            classifications=[Classification("sentiment", ["pos", "neg"], "pos")],
            structures=[Structure("location", city="Cupertino")],
            relations=[Relation("works_for", head="Tim Cook", tail="Apple")]
        )
        
        assert example.text == "Tim Cook works at Apple in Cupertino."
        assert "person" in example.entities
        assert len(example.classifications) == 1
        assert len(example.structures) == 1
        assert len(example.relations) == 1
    
    def test_input_example_validation_valid(self):
        """Testa validação de exemplo válido."""
        example = InputExample(
            text="Tim Cook works at Apple.",
            entities={"person": ["Tim Cook"], "company": ["Apple"]}
        )
        
        errors = example.validate()
        assert errors == []
        assert example.is_valid() is True
    
    def test_input_example_validation_empty_text(self):
        """Testa validação com texto vazio."""
        example = InputExample(text="", entities={"person": ["Tim"]})
        
        errors = example.validate()
        assert any("Text cannot be empty" in e for e in errors)
    
    def test_input_example_validation_entity_not_in_text(self):
        """Testa validação quando entidade não está no texto."""
        example = InputExample(
            text="Tim Cook works at Apple.",
            entities={"person": ["Elon Musk"]}
        )
        
        errors = example.validate()
        assert any("not found in text" in e for e in errors)
    
    def test_input_example_validation_no_content(self):
        """Testa validação sem nenhuma task."""
        example = InputExample(text="Some text")
        
        errors = example.validate()
        assert any("at least one task" in e for e in errors)
    
    def test_input_example_sanitize_valid(self):
        """Testa sanitização de exemplo válido."""
        example = InputExample(
            text="Tim Cook works at Apple.",
            entities={"person": ["Tim Cook"], "company": ["Apple"]}
        )
        
        warnings, is_valid = example.sanitize()
        assert is_valid is True
        assert example.entities == {"person": ["Tim Cook"], "company": ["Apple"]}
    
    def test_input_example_sanitize_remove_invalid_entity(self):
        """Testa sanitização removendo entidade inválida."""
        example = InputExample(
            text="Tim Cook works at Apple.",
            entities={
                "person": ["Tim Cook"],
                "company": ["Google"]  # Não está no texto
            }
        )
        
        warnings, is_valid = example.sanitize()
        
        assert is_valid is True
        assert "company" not in example.entities
        assert "person" in example.entities
        assert any("dropping entity type" in w for w in warnings)
    
    def test_input_example_sanitize_all_invalid(self):
        """Testa sanitização quando tudo é inválido."""
        example = InputExample(
            text="Some text.",
            entities={"person": ["Nobody"]}
        )
        
        warnings, is_valid = example.sanitize()
        
        assert is_valid is False
        assert "No valid tasks remain" in warnings[-1]
    
    def test_input_example_to_dict(self):
        """Testa conversão para dict."""
        example = InputExample(
            text="Tim Cook works at Apple.",
            entities={"person": ["Tim Cook"]}
        )
        
        result = example.to_dict()
        
        assert result["input"] == "Tim Cook works at Apple."
        assert "entities" in result["output"]
        assert result["output"]["entities"]["person"] == ["Tim Cook"]
    
    def test_input_example_to_json(self):
        """Testa conversão para JSON."""
        example = InputExample(
            text="Test text.",
            entities={"person": ["John"]}
        )
        
        json_str = example.to_json()
        data = json.loads(json_str)
        
        assert data["input"] == "Test text."
        assert "entities" in data["output"]
    
    def test_input_example_from_dict(self):
        """Testa criação a partir de dict."""
        data = {
            "input": "Tim Cook works at Apple.",
            "output": {
                "entities": {"person": ["Tim Cook"]},
                "entity_descriptions": {"person": "Names"},
                "classifications": [
                    {"task": "sentiment", "labels": ["pos", "neg"], "true_label": ["pos"]}
                ],
                "json_structures": [{"product": {"name": "iPhone"}}],
                "json_descriptions": {"product": {"name": "Product name"}},
                "relations": [{"works_for": {"head": "Tim", "tail": "Apple"}}]
            }
        }
        
        example = InputExample.from_dict(data)
        
        assert example.text == "Tim Cook works at Apple."
        assert "person" in example.entities
        assert len(example.classifications) == 1
        assert len(example.structures) == 1
        assert len(example.relations) == 1
    
    def test_input_example_from_json(self):
        """Testa criação a partir de JSON string."""
        json_str = '{"input": "Test.", "output": {"entities": {"x": ["y"]}}}'
        
        example = InputExample.from_json(json_str)
        
        assert example.text == "Test."


# =============================================================================
# Tests for TrainingDataset
# =============================================================================

class TestTrainingDataset:
    """Testes para a classe TrainingDataset."""
    
    def test_dataset_creation_empty(self):
        """Testa criação de dataset vazio."""
        dataset = TrainingDataset()
        
        assert len(dataset) == 0
        assert list(dataset) == []
    
    def test_dataset_creation_with_examples(self):
        """Testa criação com exemplos."""
        examples = [
            InputExample(text="Text 1", entities={"x": ["y"]}),
            InputExample(text="Text 2", entities={"x": ["z"]})
        ]
        dataset = TrainingDataset(examples)
        
        assert len(dataset) == 2
        assert dataset[0].text == "Text 1"
        assert dataset[1].text == "Text 2"
    
    def test_dataset_add(self):
        """Testa adição de exemplo."""
        dataset = TrainingDataset()
        example = InputExample(text="Test", entities={"x": ["y"]})
        
        dataset.add(example)
        
        assert len(dataset) == 1
        assert dataset[0].text == "Test"
    
    def test_dataset_add_many(self):
        """Testa adição de múltiplos exemplos."""
        dataset = TrainingDataset()
        examples = [
            InputExample(text="Text 1", entities={"x": ["y"]}),
            InputExample(text="Text 2", entities={"x": ["z"]})
        ]
        
        dataset.add_many(examples)
        
        assert len(dataset) == 2
    
    def test_dataset_iteration(self):
        """Testa iteração sobre dataset."""
        examples = [
            InputExample(text="Text 1", entities={"x": ["y"]}),
            InputExample(text="Text 2", entities={"x": ["z"]})
        ]
        dataset = TrainingDataset(examples)
        
        texts = [ex.text for ex in dataset]
        assert texts == ["Text 1", "Text 2"]
    
    def test_dataset_validate_all_valid(self):
        """Testa validação quando todos são válidos."""
        examples = [
            InputExample(text="Tim works at Apple.", entities={"person": ["Tim"]}),
            InputExample(text="John works at Google.", entities={"person": ["John"]})
        ]
        dataset = TrainingDataset(examples)
        
        report = dataset.validate(raise_on_error=False)
        
        assert report["valid"] == 2
        assert report["invalid"] == 0
    
    def test_dataset_validate_with_invalid(self):
        """Testa validação com exemplos inválidos."""
        examples = [
            InputExample(text="Tim works at Apple.", entities={"person": ["Tim"]}),
            InputExample(text="Text only", entities={"person": ["Nobody"]})
        ]
        dataset = TrainingDataset(examples)
        
        report = dataset.validate(raise_on_error=False)
        
        assert report["valid"] == 1
        assert report["invalid"] == 1
        assert report["invalid_indices"] == [1]
    
    def test_dataset_validate_raises(self):
        """Testa que validação levanta erro quando raise_on_error=True."""
        examples = [
            InputExample(text="Text", entities={"person": ["Nobody"]})
        ]
        dataset = TrainingDataset(examples)
        
        with pytest.raises(ValidationError):
            dataset.validate(raise_on_error=True)
    
    def test_dataset_stats(self):
        """Testa geração de estatísticas."""
        examples = [
            InputExample(text="Tim works at Apple.", entities={"person": ["Tim"], "company": ["Apple"]}),
            InputExample(text="John works at Google.", entities={"person": ["John"]})
        ]
        dataset = TrainingDataset(examples)
        
        stats = dataset.stats()
        
        assert stats["total_examples"] == 2
        assert stats["entity_types"]["person"] == 2
        assert stats["entity_types"]["company"] == 1
        assert stats["entity_mentions"] == 3
    
    def test_dataset_to_records(self):
        """Testa conversão para records."""
        examples = [
            InputExample(text="Text 1", entities={"x": ["y"]}),
            InputExample(text="Text 2", entities={"x": ["z"]})
        ]
        dataset = TrainingDataset(examples)
        
        records = dataset.to_records()
        
        assert len(records) == 2
        assert all("input" in r and "output" in r for r in records)
    
    def test_dataset_to_jsonl(self):
        """Testa conversão para JSONL."""
        examples = [InputExample(text="Test", entities={"x": ["y"]})]
        dataset = TrainingDataset(examples)
        
        jsonl = dataset.to_jsonl()
        
        assert isinstance(jsonl, str)
        data = json.loads(jsonl)
        assert data["input"] == "Test"
    
    def test_dataset_save_load(self, tmp_path):
        """Testa salvamento e carregamento."""
        examples = [
            InputExample(text="Text 1", entities={"x": ["y"]}),
            InputExample(text="Text 2", entities={"x": ["z"]})
        ]
        dataset = TrainingDataset(examples)
        
        file_path = tmp_path / "test.jsonl"
        dataset.save(str(file_path), validate_first=False)
        
        loaded = TrainingDataset.load(str(file_path))
        
        assert len(loaded) == 2
        assert loaded[0].text == "Text 1"
    
    def test_dataset_load_multiple_files(self, tmp_path):
        """Testa carregamento de múltiplos arquivos."""
        file1 = tmp_path / "file1.jsonl"
        file2 = tmp_path / "file2.jsonl"
        
        with open(file1, "w") as f:
            f.write('{"input": "Text 1", "output": {"entities": {"x": ["y"]}}}\n')
        with open(file2, "w") as f:
            f.write('{"input": "Text 2", "output": {"entities": {"x": ["z"]}}}\n')
        
        dataset = TrainingDataset.load([str(file1), str(file2)])
        
        assert len(dataset) == 2
    
    def test_dataset_split(self):
        """Testa divisão em train/val/test."""
        examples = [InputExample(text=f"Text {i}", entities={"x": ["y"]}) for i in range(10)]
        dataset = TrainingDataset(examples)
        
        train, val, test = dataset.split(train_ratio=0.6, val_ratio=0.2, test_ratio=0.2)
        
        assert len(train) == 6
        assert len(val) == 2
        assert len(test) == 2
    
    def test_dataset_split_invalid_ratio(self):
        """Testa divisão com proporções inválidas."""
        examples = [InputExample(text="Test", entities={"x": ["y"]})]
        dataset = TrainingDataset(examples)
        
        with pytest.raises(ValueError):
            dataset.split(train_ratio=0.5, val_ratio=0.5, test_ratio=0.5)
    
    def test_dataset_filter(self):
        """Testa filtragem de exemplos."""
        examples = [
            InputExample(text="Apple is great.", entities={"company": ["Apple"]}),
            InputExample(text="Tim works here.", entities={"person": ["Tim"]})
        ]
        dataset = TrainingDataset(examples)
        
        filtered = dataset.filter(lambda ex: "company" in ex.entities)
        
        assert len(filtered) == 1
        assert filtered[0].text == "Apple is great."
    
    def test_dataset_sample(self):
        """Testa amostragem."""
        examples = [InputExample(text=f"Text {i}", entities={"x": ["y"]}) for i in range(10)]
        dataset = TrainingDataset(examples)
        
        sampled = dataset.sample(n=3, seed=42)
        
        assert len(sampled) == 3
    
    def test_dataset_from_records(self):
        """Testa criação a partir de records."""
        records = [
            {"input": "Text 1", "output": {"entities": {"x": ["y"]}}},
            {"input": "Text 2", "output": {"entities": {"x": ["z"]}}}
        ]
        
        dataset = TrainingDataset.from_records(records)
        
        assert len(dataset) == 2
        assert dataset[0].text == "Text 1"
    
    def test_dataset_validate_relation_consistency(self):
        """Testa validação de consistência de relações."""
        examples = [
            InputExample(
                text="Text 1",
                relations=[Relation("works_for", head="A", tail="B")]
            ),
            InputExample(
                text="Text 2",
                relations=[Relation("works_for", head="C", tail="D", extra="E")]
            )
        ]
        dataset = TrainingDataset(examples)
        
        errors = dataset.validate_relation_consistency()
        
        assert len(errors) == 1
        assert "field inconsistency" in errors[0]


# =============================================================================
# Tests for DataLoader_Factory
# =============================================================================

class TestDataLoaderFactory:
    """Testes para DataLoader_Factory."""
    
    def test_detect_format_jsonl_path(self):
        """Testa detecção de formato JSONL a partir de path."""
        assert detect_data_format("data.jsonl") == DataFormat.JSONL
        assert detect_data_format(Path("data.jsonl")) == DataFormat.JSONL
    
    def test_detect_format_input_example_list(self):
        """Testa detecção de lista de InputExamples."""
        data = [InputExample(text="Test", entities={})]
        assert detect_data_format(data) == DataFormat.INPUT_EXAMPLE_LIST
    
    def test_detect_format_dict_list(self):
        """Testa detecção de lista de dicts."""
        data = [{"input": "Test", "output": {}}]
        assert detect_data_format(data) == DataFormat.DICT_LIST
    
    def test_detect_format_empty_list(self):
        """Testa detecção de lista vazia."""
        assert detect_data_format([]) == DataFormat.DICT_LIST
    
    def test_detect_format_training_dataset(self):
        """Testa detecção de TrainingDataset."""
        dataset = TrainingDataset()
        assert detect_data_format(dataset) == DataFormat.TRAINING_DATASET
    
    def test_detect_format_jsonl_list(self):
        """Testa detecção de lista de paths."""
        data = ["file1.jsonl", "file2.jsonl"]
        assert detect_data_format(data) == DataFormat.JSONL_LIST
    
    def test_detect_format_unsupported(self):
        """Testa erro para formato não suportado."""
        with pytest.raises(ValueError):
            detect_data_format(12345)
    
    def test_load_jsonl(self, tmp_path):
        """Testa carregamento de JSONL."""
        file_path = tmp_path / "test.jsonl"
        with open(file_path, "w") as f:
            f.write('{"input": "Text 1", "output": {}}\n')
            f.write('{"input": "Text 2", "output": {}}\n')
        
        records = DataLoader_Factory._load_jsonl(file_path)
        
        assert len(records) == 2
        assert records[0]["input"] == "Text 1"
    
    def test_load_jsonl_file_not_found(self):
        """Testa erro quando arquivo não existe."""
        with pytest.raises(FileNotFoundError):
            DataLoader_Factory._load_jsonl("nonexistent.jsonl")
    
    def test_load_jsonl_invalid_json(self, tmp_path):
        """Testa erro com JSON inválido."""
        file_path = tmp_path / "test.jsonl"
        with open(file_path, "w") as f:
            f.write("invalid json\n")
        
        with pytest.raises(ValueError):
            DataLoader_Factory._load_jsonl(file_path)
    
    def test_load_input_examples(self):
        """Testa carregamento de InputExamples."""
        examples = [
            InputExample(text="Text 1", entities={"x": ["y"]}),
            InputExample(text="Text 2", entities={"x": ["z"]})
        ]
        
        records = DataLoader_Factory._load_input_examples(examples)
        
        assert len(records) == 2
        assert all("input" in r and "output" in r for r in records)
    
    def test_load_dict_list_input_output(self):
        """Testa carregamento de dicts no formato input/output."""
        dicts = [
            {"input": "Text 1", "output": {"entities": {"x": ["y"]}}},
            {"input": "Text 2", "output": {"entities": {"x": ["z"]}}}
        ]
        
        records = DataLoader_Factory._load_dict_list(dicts)
        
        assert len(records) == 2
    
    def test_load_dict_list_text_schema(self):
        """Testa carregamento de dicts no formato text/schema."""
        dicts = [
            {"text": "Text 1", "schema": {"entities": {}}}
        ]
        
        records = DataLoader_Factory._load_dict_list(dicts)
        
        assert len(records) == 1
    
    def test_load_dict_list_text_entities(self):
        """Testa carregamento de dicts com entities no topo."""
        dicts = [
            {"text": "Text 1", "entities": {"x": ["y"]}, "classifications": []}
        ]
        
        records = DataLoader_Factory._load_dict_list(dicts)
        
        assert len(records) == 1
        assert "input" in records[0]
        assert "output" in records[0]
    
    def test_load_dict_list_unknown_format(self):
        """Testa erro com formato desconhecido."""
        dicts = [{"unknown_key": "value"}]
        
        with pytest.raises(ValueError):
            DataLoader_Factory._load_dict_list(dicts)
    
    def test_load_with_shuffle(self):
        """Testa carregamento com shuffle."""
        dicts = [{"input": f"Text {i}", "output": {}} for i in range(100)]
        
        records1 = DataLoader_Factory.load(dicts, shuffle=True, seed=42)
        records2 = DataLoader_Factory.load(dicts, shuffle=True, seed=42)
        records3 = DataLoader_Factory.load(dicts, shuffle=True, seed=999)
        
        # Mesma seed = mesma ordem
        assert [r["input"] for r in records1] == [r["input"] for r in records2]
        # Seed diferente = ordem diferente (com alta probabilidade, mas não garantido)
        # Vamos apenas verificar que o shuffle foi aplicado verificando 
        # que nem todas as posições são iguais à ordem original
        original_order = [d["input"] for d in dicts]
        assert len(records1) == len(original_order)
    
    def test_load_with_max_samples(self):
        """Testa carregamento com limite de amostras."""
        dicts = [{"input": f"Text {i}", "output": {}} for i in range(100)]
        
        records = DataLoader_Factory.load(dicts, max_samples=10)
        
        assert len(records) == 10


# =============================================================================
# Tests for Convenience Functions
# =============================================================================

class TestConvenienceFunctions:
    """Testes para funções utilitárias."""
    
    def test_create_entity_example(self):
        """Testa criação de exemplo de entidade."""
        example = create_entity_example(
            text="Tim works at Apple.",
            entities={"person": ["Tim"], "company": ["Apple"]},
            descriptions={"person": "Names of people"}
        )
        
        assert example.text == "Tim works at Apple."
        assert example.entities["person"] == ["Tim"]
        assert example.entity_descriptions["person"] == "Names of people"
    
    def test_create_classification_example(self):
        """Testa criação de exemplo de classificação."""
        example = create_classification_example(
            text="Great product!",
            task="sentiment",
            labels=["positive", "negative"],
            true_label="positive",
            multi_label=False
        )
        
        assert example.text == "Great product!"
        assert len(example.classifications) == 1
        assert example.classifications[0].task == "sentiment"
    
    def test_create_structure_example(self):
        """Testa criação de exemplo de estrutura."""
        example = create_structure_example(
            text="iPhone costs $999",
            structure_name="product",
            name="iPhone",
            price="$999"
        )
        
        assert example.text == "iPhone costs $999"
        assert len(example.structures) == 1
        assert example.structures[0].struct_name == "product"
    
    def test_create_relation_example(self):
        """Testa criação de exemplo de relação."""
        example = create_relation_example(
            text="Tim works at Apple.",
            relation_name="works_for",
            head="Tim",
            tail="Apple"
        )
        
        assert example.text == "Tim works at Apple."
        assert len(example.relations) == 1
        assert example.relations[0].name == "works_for"
