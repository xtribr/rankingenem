"""
Fixtures compartilhadas para testes do GLiNER2.
"""

import sys
from unittest.mock import MagicMock, patch
import pytest
import torch

# Mock para gliner antes de importar gliner2
sys.modules['gliner'] = MagicMock()
sys.modules['gliner.modeling'] = MagicMock()
sys.modules['gliner.modeling.span_rep'] = MagicMock()

# Cria um mock para SpanRepLayer
mock_span_rep_layer = MagicMock()
sys.modules['gliner.modeling.span_rep'].SpanRepLayer = mock_span_rep_layer


@pytest.fixture
def sample_text():
    """Texto de exemplo para testes."""
    return "Apple CEO Tim Cook announced the iPhone 15 launch in Cupertino."


@pytest.fixture
def sample_entities():
    """Entidades de exemplo."""
    return {
        "person": ["Tim Cook"],
        "company": ["Apple"],
        "product": ["iPhone 15"],
        "location": ["Cupertino"]
    }


@pytest.fixture
def sample_entity_descriptions():
    """Descrições de entidades de exemplo."""
    return {
        "person": "Names of people, executives, or individuals",
        "company": "Organization, corporation, or business names",
        "product": "Products, services, or offerings mentioned",
        "location": "Geographic location or place"
    }


@pytest.fixture
def sample_classification():
    """Configuração de classificação de exemplo."""
    return {
        "task": "sentiment",
        "labels": ["positive", "negative", "neutral"],
        "true_label": ["positive"],
        "multi_label": False
    }


@pytest.fixture
def sample_structure():
    """Estrutura JSON de exemplo."""
    return {
        "product": {
            "name": "iPhone 15",
            "price": "$999",
            "company": "Apple"
        }
    }


@pytest.fixture
def sample_relation():
    """Relação de exemplo."""
    return {
        "works_for": {"head": "Tim Cook", "tail": "Apple"}
    }


@pytest.fixture
def sample_schema_dict():
    """Schema completo de exemplo."""
    return {
        "entities": {
            "person": "",
            "company": ""
        },
        "entity_descriptions": {
            "person": "Names of people",
            "company": "Company names"
        },
        "classifications": [
            {
                "task": "sentiment",
                "labels": ["positive", "negative"],
                "true_label": ["positive"],
                "multi_label": False
            }
        ],
        "json_structures": [
            {"product": {"name": "", "price": ""}}
        ],
        "relations": [
            {"works_for": {"head": "", "tail": ""}}
        ]
    }


@pytest.fixture
def mock_tokenizer():
    """Mock de tokenizer para testes unitários."""
    tokenizer = MagicMock()
    tokenizer.vocab_size = 30000
    tokenizer.pad_token_id = 0
    tokenizer.unk_token_id = 100
    tokenizer.cls_token_id = 101
    tokenizer.sep_token_id = 102
    
    # Mock add_special_tokens
    tokenizer.add_special_tokens = MagicMock(return_value=0)
    
    # Mock tokenize
    def mock_tokenize(text):
        if text.startswith("[") and text.endswith("]"):
            return [text]  # Special tokens
        return text.lower().split()
    
    tokenizer.tokenize = mock_tokenize
    
    # Mock convert_tokens_to_ids
    def mock_convert(tokens):
        if isinstance(tokens, str):
            tokens = [tokens]
        return [hash(t) % 30000 for t in tokens]
    
    tokenizer.convert_tokens_to_ids = mock_convert
    tokenizer.convert_ids_to_tokens = MagicMock(return_value="[P]")
    
    return tokenizer


@pytest.fixture
def mock_model_config():
    """Configuração de modelo mock."""
    return {
        "model_name": "bert-base-uncased",
        "max_width": 8,
        "counting_layer": "count_lstm",
        "token_pooling": "first",
        "hidden_size": 768
    }


@pytest.fixture
def device():
    """Device para testes (CPU por padrão)."""
    return torch.device("cpu")


@pytest.fixture
def torch_tensor():
    """Factory para criar tensores de teste."""
    def _create(shape, dtype=torch.float32, device="cpu"):
        return torch.randn(shape, dtype=dtype, device=device)
    return _create


@pytest.fixture(scope="session")
def requires_model():
    """Marker para testes que requerem download de modelo."""
    return pytest.mark.requires_model


# Skip markers comuns
@pytest.fixture
def skip_if_no_cuda():
    """Pula teste se CUDA não disponível."""
    if not torch.cuda.is_available():
        pytest.skip("CUDA não disponível")


@pytest.fixture
def mock_encoder_output():
    """Mock de saída do encoder."""
    batch_size = 2
    seq_len = 20
    hidden_size = 768
    
    output = MagicMock()
    output.last_hidden_state = torch.randn(batch_size, seq_len, hidden_size)
    return output
