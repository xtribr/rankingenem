"""
Testes unitários para SchemaTransformer e PreprocessedBatch.

Testa: WhitespaceTokenSplitter, SchemaTransformer, PreprocessedBatch,
       SamplingConfig, TransformedRecord
"""

import pytest
import torch
from dataclasses import dataclass
from unittest.mock import MagicMock, patch

from gliner2.processor import (
    WhitespaceTokenSplitter,
    SchemaTransformer,
    PreprocessedBatch,
    TransformedRecord,
    SamplingConfig,
)


# =============================================================================
# Tests for WhitespaceTokenSplitter
# =============================================================================

class TestWhitespaceTokenSplitter:
    """Testes para o tokenizador whitespace."""
    
    @pytest.fixture
    def splitter(self):
        return WhitespaceTokenSplitter()
    
    def test_basic_tokenization(self, splitter):
        """Testa tokenização básica."""
        text = "Tim Cook works at Apple"
        tokens = list(splitter(text, lower=True))
        
        assert len(tokens) == 5
        assert tokens[0] == ("tim", 0, 3)
        assert tokens[1] == ("cook", 4, 8)
        assert tokens[2] == ("works", 9, 14)
        assert tokens[3] == ("at", 15, 17)
        assert tokens[4] == ("apple", 18, 23)
    
    def test_tokenization_no_lower(self, splitter):
        """Testa tokenização sem lowercase."""
        text = "Tim Cook"
        tokens = list(splitter(text, lower=False))
        
        assert tokens[0] == ("Tim", 0, 3)
        assert tokens[1] == ("Cook", 4, 8)
    
    def test_tokenization_urls(self, splitter):
        """Testa tokenização preservando URLs."""
        text = "Visit https://example.com for more"
        tokens = list(splitter(text))
        
        urls = [t for t in tokens if t[0].startswith("http")]
        assert len(urls) == 1
        assert urls[0][0] == "https://example.com"
    
    def test_tokenization_emails(self, splitter):
        """Testa tokenização preservando emails."""
        text = "Contact john@example.com please"
        tokens = list(splitter(text))
        
        emails = [t for t in tokens if "@" in t[0]]
        assert len(emails) == 1
        assert emails[0][0] == "john@example.com"
    
    def test_tokenization_mentions(self, splitter):
        """Testa tokenização de @mentions."""
        text = "Thanks @username for the help"
        tokens = list(splitter(text))
        
        mentions = [t for t in tokens if t[0].startswith("@")]
        assert len(mentions) == 1
        assert mentions[0][0] == "@username"
    
    def test_tokenization_hyphenated(self, splitter):
        """Testa tokenização de palavras com hífen."""
        text = "state-of-the-art technology"
        tokens = list(splitter(text))
        
        assert any(t[0] == "state-of-the-art" for t in tokens)
    
    def test_tokenization_special_chars(self, splitter):
        """Testa tokenização com caracteres especiais."""
        text = "Price: $100.00!!!"
        tokens = list(splitter(text))
        
        # Deve preservar caracteres especiais como tokens individuais
        assert len(tokens) > 0
    
    def test_tokenization_positions(self, splitter):
        """Testa que posições de caracteres estão corretas."""
        text = "Hello world"
        tokens = list(splitter(text))
        
        for token, start, end in tokens:
            assert text[start:end] == token or text[start:end].lower() == token


# =============================================================================
# Tests for SamplingConfig
# =============================================================================

class TestSamplingConfig:
    """Testes para SamplingConfig."""
    
    def test_default_values(self):
        """Testa valores padrão."""
        config = SamplingConfig()
        
        assert config.remove_json_structure_prob == 0.2
        assert config.shuffle_json_fields is True
        assert config.remove_entities_prob == 0.0
        assert config.synthetic_entity_label_prob == 0.2
        assert config.max_num_labels == 1000
    
    def test_custom_values(self):
        """Testa valores customizados."""
        config = SamplingConfig(
            remove_json_structure_prob=0.5,
            shuffle_json_fields=False,
            remove_entities_prob=0.3
        )
        
        assert config.remove_json_structure_prob == 0.5
        assert config.shuffle_json_fields is False
        assert config.remove_entities_prob == 0.3


# =============================================================================
# Tests for TransformedRecord
# =============================================================================

class TestTransformedRecord:
    """Testes para TransformedRecord."""
    
    def test_creation(self):
        """Testa criação básica."""
        record = TransformedRecord(
            input_ids=[101, 2023, 102],
            mapped_indices=[("text", 0, 0), ("text", 1, 0)],
            schema_tokens_list=[["(", "[P]", "test", ")"]],
            text_tokens=["hello", "world"],
            structure_labels=[[1, [[(0, 1)]]]],
            task_types=["entities"],
            start_token_idx=[0, 6],
            end_token_idx=[5, 11],
            text="hello world",
            schema={"entities": {"test": ""}}
        )
        
        assert record.num_schemas == 1
        assert record.text == "hello world"
    
    def test_multiple_schemas(self):
        """Testa com múltiplos schemas."""
        record = TransformedRecord(
            input_ids=[101, 102],
            mapped_indices=[],
            schema_tokens_list=[["schema1"], ["schema2"], ["schema3"]],
            text_tokens=[],
            structure_labels=[],
            task_types=[],
            start_token_idx=[],
            end_token_idx=[],
            text="test",
            schema={}
        )
        
        assert record.num_schemas == 3


# =============================================================================
# Tests for PreprocessedBatch
# =============================================================================

class TestPreprocessedBatch:
    """Testes para PreprocessedBatch."""
    
    @pytest.fixture
    def sample_batch(self):
        """Cria um batch de exemplo."""
        return PreprocessedBatch(
            input_ids=torch.tensor([[101, 2023, 102, 0], [101, 2024, 2025, 102]]),
            attention_mask=torch.tensor([[1, 1, 1, 0], [1, 1, 1, 1]]),
            mapped_indices=[[("text", 0, 0)], [("text", 0, 0)]],
            schema_counts=[1, 1],
            original_lengths=[3, 4],
            structure_labels=[[[1, [[(0, 1)]]]], [[1, [[(0, 1)]]]]],
            task_types=[["entities"], ["entities"]],
            text_tokens=[["hello"], ["world"]],
            schema_tokens_list=[[["schema"]], [["schema"]]],
            start_mappings=[[0], [0]],
            end_mappings=[[5], [5]],
            original_texts=["hello", "world"],
            original_schemas=[{"entities": {}}, {"entities": {}}]
        )
    
    def test_batch_length(self, sample_batch):
        """Testa comprimento do batch."""
        assert len(sample_batch) == 2
    
    def test_batch_iteration(self, sample_batch):
        """Testa iteração sobre campos do batch."""
        fields = list(sample_batch)
        assert "input_ids" in fields
        assert "attention_mask" in fields
    
    def test_batch_contains(self, sample_batch):
        """Testa operador 'in'."""
        assert "input_ids" in sample_batch
        assert "nonexistent" not in sample_batch
    
    def test_batch_getitem(self, sample_batch):
        """Testa acesso por chave."""
        assert sample_batch["input_ids"] is not None
        assert sample_batch["attention_mask"] is not None
    
    def test_batch_getitem_invalid(self, sample_batch):
        """Testa erro com chave inválida."""
        with pytest.raises(KeyError):
            _ = sample_batch[0]  # Integer indexing not supported
    
    def test_batch_to_device(self, sample_batch):
        """Testa movimentação para device."""
        # Testa movendo para CPU (mesmo device)
        batch_cpu = sample_batch.to(torch.device("cpu"))
        
        assert batch_cpu.input_ids.device.type == "cpu"
        assert batch_cpu.attention_mask.device.type == "cpu"
        # Listas devem permanecer inalteradas
        assert batch_cpu.mapped_indices == sample_batch.mapped_indices
    
    def test_batch_pin_memory(self, sample_batch):
        """Testa pin de memória."""
        # Nota: pin_memory pode falhar em CPUs sem suporte ou com MPS
        # Vamos verificar que o método existe e retorna o tipo correto
        try:
            batch_pinned = sample_batch.pin_memory()
            assert isinstance(batch_pinned, PreprocessedBatch)
        except RuntimeError:
            # Ignora erro de pin_memory em dispositivos não suportados
            pytest.skip("pin_memory não suportado neste dispositivo")


# =============================================================================
# Tests for SchemaTransformer
# =============================================================================

class TestSchemaTransformer:
    """Testes para SchemaTransformer."""
    
    @pytest.fixture
    def transformer(self, mock_tokenizer):
        """Cria um SchemaTransformer com tokenizer mock."""
        with patch("gliner2.processor.AutoTokenizer") as mock_auto:
            mock_auto.from_pretrained.return_value = mock_tokenizer
            return SchemaTransformer("bert-base-uncased")
    
    def test_initialization(self, mock_tokenizer):
        """Testa inicialização."""
        with patch("gliner2.processor.AutoTokenizer") as mock_auto:
            mock_auto.from_pretrained.return_value = mock_tokenizer
            transformer = SchemaTransformer("bert-base-uncased")
            
            assert transformer.token_pooling == "first"
            assert transformer.is_training is False
            mock_tokenizer.add_special_tokens.assert_called_once()
    
    def test_initialization_with_tokenizer(self, mock_tokenizer):
        """Testa inicialização com tokenizer fornecido."""
        transformer = SchemaTransformer(tokenizer=mock_tokenizer)
        
        assert transformer.tokenizer is mock_tokenizer
    
    def test_initialization_error(self):
        """Testa erro quando nenhum modelo/tokenizer é fornecido."""
        with pytest.raises(ValueError):
            SchemaTransformer()
    
    def test_change_mode(self, transformer):
        """Testa mudança de modo."""
        assert transformer.is_training is False
        
        transformer.change_mode(True)
        assert transformer.is_training is True
        
        transformer.change_mode(False)
        assert transformer.is_training is False
    
    def test_special_tokens(self, transformer):
        """Testa tokens especiais."""
        assert transformer.SEP_STRUCT == "[SEP_STRUCT]"
        assert transformer.SEP_TEXT == "[SEP_TEXT]"
        assert transformer.P_TOKEN == "[P]"
        assert transformer.C_TOKEN == "[C]"
        assert transformer.E_TOKEN == "[E]"
        assert transformer.R_TOKEN == "[R]"
        assert transformer.L_TOKEN == "[L]"
    
    def test_collate_fn_inference(self, transformer):
        """Testa collate function para inference."""
        batch = [
            ("Tim works at Apple.", {"entities": {"person": "", "company": ""}})
        ]
        
        result = transformer.collate_fn_inference(batch)
        
        assert isinstance(result, PreprocessedBatch)
        assert len(result) == 1
        assert transformer.is_training is False
    
    def test_collate_fn_train(self, transformer):
        """Testa collate function para treinamento."""
        batch = [
            ("Tim works at Apple.", {"entities": {"person": ["Tim"], "company": ["Apple"]}})
        ]
        
        result = transformer.collate_fn_train(batch)
        
        assert isinstance(result, PreprocessedBatch)
        assert transformer.is_training is True
    
    def test_transform_and_format(self, transformer):
        """Testa transformação de registro único."""
        text = "Tim works at Apple."
        schema = {"entities": {"person": "", "company": ""}}
        
        result = transformer.transform_and_format(text, schema)
        
        assert isinstance(result, TransformedRecord)
        assert result.text == text
        assert len(result.input_ids) > 0
    
    def test_empty_text_handling(self, transformer):
        """Testa tratamento de texto vazio."""
        text = ""
        schema = {"entities": {"test": ""}}
        
        result = transformer.collate_fn_inference([(text, schema)])
        
        assert len(result) == 1
        # Texto vazio deve ser normalizado para "."
        assert result.original_texts[0] == "."
    
    def test_text_without_punctuation(self, transformer):
        """Testa que texto sem pontuação recebe ponto."""
        text = "Tim works at Apple"  # Sem ponto
        schema = {"entities": {"person": ""}}
        
        result = transformer.collate_fn_inference([(text, schema)])
        
        # Deve adicionar ponto final
        assert result.original_texts[0].endswith(".")
    
    def test_find_sublist(self, transformer):
        """Testa busca de sublista."""
        sub = ["tim", "cook"]
        lst = ["tim", "cook", "works", "at", "apple"]
        
        result = transformer._find_sublist(sub, lst)
        
        assert result == [(0, 1)]
    
    def test_find_sublist_not_found(self, transformer):
        """Testa busca quando sublista não existe."""
        sub = ["not", "found"]
        lst = ["tim", "cook"]
        
        result = transformer._find_sublist(sub, lst)
        
        assert result == [(-1, -1)]
    
    def test_find_sublist_empty(self, transformer):
        """Testa busca com sublista vazia."""
        sub = []
        lst = ["tim", "cook"]
        
        result = transformer._find_sublist(sub, lst)
        
        assert result == [(-1, -1)]
    
    def test_find_sublist_multiple_matches(self, transformer):
        """Testa busca com múltiplas ocorrências."""
        sub = ["tim"]
        lst = ["tim", "works", "with", "tim"]
        
        result = transformer._find_sublist(sub, lst)
        
        assert len(result) == 2
        assert (0, 0) in result
        assert (3, 3) in result
    
    def test_tokenize_text(self, transformer):
        """Testa tokenização de texto."""
        text = "Tim Cook works"
        
        tokens = transformer._tokenize_text(text)
        
        assert isinstance(tokens, list)
        assert len(tokens) == 3
        assert all(isinstance(t, str) for t in tokens)
    
    def test_build_classification_prefix(self, transformer):
        """Testa construção de prefixo de classificação."""
        schema = {
            "json_structures": [
                {
                    "product": {
                        "tier": {"value": "premium", "choices": ["basic", "premium", "enterprise"]}
                    }
                }
            ]
        }
        
        prefix = transformer._build_classification_prefix(schema)
        
        assert isinstance(prefix, list)
        # Deve conter nome do campo e opções
        assert any("tier" in str(p) for p in prefix)
    
    def test_infer_from_json_entities(self, transformer):
        """Testa inferência de schema com entidades."""
        schema = {"entities": {"person": ["Tim Cook"], "company": ["Apple"]}}
        
        result = transformer._infer_from_json(schema)
        
        assert "schemas" in result
        assert "structure_labels" in result
        assert "task_types" in result
        assert "entities" in result["task_types"]
    
    def test_infer_from_json_classifications(self, transformer):
        """Testa inferência com classificações."""
        schema = {
            "classifications": [
                {
                    "task": "sentiment",
                    "labels": ["positive", "negative"],
                    "true_label": ["positive"]
                }
            ]
        }
        
        result = transformer._infer_from_json(schema)
        
        assert "classifications" in result["task_types"]
    
    def test_infer_from_json_relations(self, transformer):
        """Testa inferência com relações."""
        schema = {
            "relations": [
                {"works_for": {"head": "Tim Cook", "tail": "Apple"}}
            ]
        }
        
        result = transformer._infer_from_json(schema)
        
        assert "relations" in result["task_types"]
    
    def test_infer_from_json_structures(self, transformer):
        """Testa inferência com estruturas JSON."""
        schema = {
            "json_structures": [
                {"product": {"name": "iPhone", "price": "$999"}}
            ]
        }
        
        result = transformer._infer_from_json(schema)
        
        assert "json_structures" in result["task_types"]
    
    def test_transform_schema(self, transformer):
        """Testa transformação de schema."""
        tokens = transformer._transform_schema(
            parent="entities",
            fields=["person", "company"],
            child_prefix="[E]"
        )
        
        assert isinstance(tokens, list)
        assert "[P]" in tokens
        assert "[E]" in tokens
        assert "person" in tokens
        assert "company" in tokens
    
    def test_transform_schema_with_descriptions(self, transformer):
        """Testa transformação com descrições."""
        tokens = transformer._transform_schema(
            parent="entities",
            fields=["person"],
            child_prefix="[E]",
            label_descriptions={"person": "Names of people"},
            example_mode="descriptions"
        )
        
        assert any("DESCRIPTION" in str(t) for t in tokens)
    
    def test_transform_schema_with_examples(self, transformer):
        """Testa transformação com few-shot examples."""
        tokens = transformer._transform_schema(
            parent="sentiment",
            fields=["positive", "negative"],
            child_prefix="[L]",
            examples=[("Great!", "positive"), ("Bad!", "negative")],
            example_mode="few_shot"
        )
        
        assert any("EXAMPLE" in str(t) for t in tokens)
    
    def test_empty_batch(self, transformer):
        """Testa criação de batch vazio."""
        empty = transformer._empty_batch()
        
        assert len(empty) == 0
        assert empty.input_ids.shape == (0, 0)
        assert empty.schema_counts == []


# =============================================================================
# Tests for SchemaTransformer Processing
# =============================================================================

class TestSchemaTransformerProcessing:
    """Testes adicionais para processamento de schemas."""
    
    @pytest.fixture
    def transformer(self, mock_tokenizer):
        with patch("gliner2.processor.AutoTokenizer") as mock_auto:
            mock_auto.from_pretrained.return_value = mock_tokenizer
            return SchemaTransformer("bert-base-uncased")
    
    def test_process_entities_with_sampling(self, transformer):
        """Testa processamento de entidades com sampling."""
        transformer.is_training = True
        schema = {"entities": {"person": ["Tim"], "company": ["Apple"], "product": ["iPhone"]}}
        
        schemas = []
        labels = []
        types = []
        
        transformer._process_entities(schema, schemas, labels, types, transformer.sampling_config)
        
        # Deve criar um schema de entidades
        assert len(types) == 1
        assert types[0] == "entities"
    
    def test_process_classifications(self, transformer):
        """Testa processamento de classificações."""
        schema = {
            "classifications": [
                {
                    "task": "sentiment",
                    "labels": ["pos", "neg"],
                    "true_label": ["pos"]
                }
            ]
        }
        schemas = []
        labels = []
        types = []
        
        transformer._process_classifications(schema, schemas, labels, types, None)
        
        assert len(types) == 1
        assert types[0] == "classifications"
    
    def test_process_relations(self, transformer):
        """Testa processamento de relações."""
        schema = {
            "relations": [
                {"works_for": {"head": "Tim", "tail": "Apple"}}
            ]
        }
        schemas = []
        labels = []
        types = []
        
        transformer._process_relations(schema, schemas, labels, types, None)
        
        assert len(types) == 1
        assert types[0] == "relations"
    
    def test_process_json_structures(self, transformer):
        """Testa processamento de estruturas JSON."""
        schema = {
            "json_structures": [
                {"product": {"name": "iPhone", "price": "$999"}}
            ]
        }
        schemas = []
        labels = []
        types = []
        
        transformer._process_json_structures(schema, schemas, labels, types, None)
        
        assert len(types) == 1
        assert types[0] == "json_structures"
    
    def test_format_input_with_mapping(self, transformer):
        """Testa formatação de input com mapeamento."""
        schema_tokens_list = [["(", "[P]", "entities", "(", "[E]", "person", ")", ")"]]
        text_tokens = ["tim", "works", "at", "apple"]
        
        result = transformer._format_input_with_mapping(schema_tokens_list, text_tokens)
        
        assert "input_ids" in result
        assert "mapped_indices" in result
        assert "subword_list" in result
        assert len(result["mapped_indices"]) == len(result["subword_list"])
    
    def test_build_outputs_for_entities(self, transformer):
        """Testa construção de outputs para entidades."""
        processed = {
            "schemas": [["(", "[P]", "entities", "(", "[E]", "person", ")", ")"]],
            "structure_labels": [[1, [[["Tim"]]]]],
            "task_types": ["entities"]
        }
        schema = {"entities": {"person": ["Tim"]}}
        text_tokens = ["tim", "works", "at", "apple"]
        
        results = transformer._build_outputs(processed, schema, text_tokens, 0)
        
        assert len(results) == 1
        assert results[0]["task_type"] == "entities"
        assert "schema_tokens" in results[0]
        assert "output" in results[0]
