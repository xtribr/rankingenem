"""
Testes unitários para o modelo Extractor do GLiNER2.

Testa: ExtractorConfig, Extractor
"""

import pytest
import torch
import torch.nn as nn
from unittest.mock import MagicMock, patch, PropertyMock

from gliner2.model import ExtractorConfig, Extractor


# =============================================================================
# Tests for ExtractorConfig
# =============================================================================

class TestExtractorConfig:
    """Testes para ExtractorConfig."""
    
    def test_default_config(self):
        """Testa configuração padrão."""
        config = ExtractorConfig()
        
        assert config.model_name == "bert-base-uncased"
        assert config.max_width == 8
        assert config.counting_layer == "count_lstm"
        assert config.token_pooling == "first"
        assert config.model_type == "extractor"
    
    def test_custom_config(self):
        """Testa configuração customizada."""
        config = ExtractorConfig(
            model_name="roberta-base",
            max_width=12,
            counting_layer="count_lstm_moe",
            token_pooling="mean"
        )
        
        assert config.model_name == "roberta-base"
        assert config.max_width == 12
        assert config.counting_layer == "count_lstm_moe"
        assert config.token_pooling == "mean"


# =============================================================================
# Tests for Extractor Initialization
# =============================================================================

class TestExtractorInitialization:
    """Testes para inicialização do Extractor."""
    
    def test_config_class_attribute(self):
        """Testa que config_class está definida."""
        assert Extractor.config_class == ExtractorConfig
    
    def test_model_has_required_modules(self):
        """Testa que modelo tem módulos necessários."""
        config = ExtractorConfig()
        
        with patch('gliner2.model.AutoModel') as mock_auto:
            with patch('gliner2.model.SchemaTransformer'):
                with patch('gliner2.model.SpanRepLayer'):
                    with patch.object(Extractor, '_print_config'):
                        # Mock encoder com hidden_size real
                        mock_encoder = MagicMock()
                        mock_encoder.config.hidden_size = 768
                        mock_encoder.embeddings.word_embeddings = MagicMock()
                        mock_encoder.embeddings.word_embeddings.weight = torch.randn(30000, 768)
                        mock_auto.from_pretrained.return_value = mock_encoder
                        
                        model = Extractor(config)
                        model._lora_layers = {}
                        model._adapter_config = None
                        
                        # Verifica atributos
                        assert hasattr(model, 'encoder')
                        assert hasattr(model, 'span_rep')
                        assert hasattr(model, 'classifier')
                        assert hasattr(model, 'count_pred')
                        assert hasattr(model, 'count_embed')
                        assert model.hidden_size == 768


# =============================================================================
# Tests for Counting Layer Variants
# =============================================================================

class TestCountingLayerVariants:
    """Testes para diferentes variantes de counting layer."""
    
    def test_count_lstm_variant(self):
        """Testa CountLSTM."""
        from gliner2.layers import CountLSTM
        
        layer = CountLSTM(hidden_size=128)
        pc_emb = torch.randn(5, 128)
        output = layer(pc_emb, 3)
        
        assert output.shape == (3, 5, 128)
    
    def test_count_lstm_v2_variant(self):
        """Testa CountLSTMv2."""
        from gliner2.layers import CountLSTMv2
        
        layer = CountLSTMv2(hidden_size=128)
        pc_emb = torch.randn(5, 128)
        output = layer(pc_emb, 3)
        
        assert output.shape == (3, 5, 128)
    
    def test_count_lstm_moe_variant(self):
        """Testa CountLSTMoE."""
        from gliner2.layers import CountLSTMoE
        
        layer = CountLSTMoE(hidden_size=128, n_experts=4)
        pc_emb = torch.randn(5, 128)
        output = layer(pc_emb, 3)
        
        assert output.shape == (3, 5, 128)


# =============================================================================
# Tests for LoRA Adapter Methods
# =============================================================================

class TestExtractorLoRAMethods:
    """Testes para métodos de LoRA adapter do Extractor."""
    
    @pytest.fixture
    def model(self):
        """Cria um modelo mock para testes."""
        config = ExtractorConfig()
        
        with patch('gliner2.model.AutoModel') as mock_auto:
            with patch('gliner2.model.SchemaTransformer'):
                with patch('gliner2.model.SpanRepLayer'):
                    with patch.object(Extractor, '_print_config'):
                        mock_encoder = MagicMock()
                        mock_encoder.config.hidden_size = 768
                        mock_encoder.embeddings.word_embeddings = MagicMock()
                        mock_encoder.embeddings.word_embeddings.weight = torch.randn(30000, 768)
                        mock_auto.from_pretrained.return_value = mock_encoder
                        
                        model = Extractor(config)
                        model._lora_layers = {}
                        model._adapter_config = None
                        return model
    
    def test_load_adapter_raises_when_none(self, model):
        """Testa que save_adapter levanta erro quando não há adapter."""
        with pytest.raises(ValueError):
            model.save_adapter("/tmp/test")
    
    def test_unload_adapter_no_op(self, model):
        """Testa que unload_adapter funciona mesmo sem adapter."""
        result = model.unload_adapter()
        assert result is model  # Retorna self
    
    def test_has_adapter_property(self, model):
        """Testa propriedade has_adapter."""
        assert model.has_adapter is False
        
        # Simula adapter carregado
        model._lora_layers = {"layer1": MagicMock()}
        assert model.has_adapter is True
    
    def test_adapter_config_property(self, model):
        """Testa propriedade adapter_config."""
        assert model.adapter_config is None
        
        # Simula config
        mock_config = MagicMock()
        model._adapter_config = mock_config
        assert model.adapter_config is mock_config
    
    def test_merge_lora_raises_when_no_adapter(self, model):
        """Testa que merge_lora levanta erro sem adapter."""
        with pytest.raises(ValueError):
            model.merge_lora()


# =============================================================================
# Tests for Save/Load
# =============================================================================

class TestExtractorSaveLoad:
    """Testes para salvar e carregar modelo."""
    
    @pytest.fixture
    def model(self):
        """Cria um modelo mock para testes."""
        config = ExtractorConfig()
        
        with patch('gliner2.model.AutoModel') as mock_auto:
            with patch('gliner2.model.SchemaTransformer'):
                with patch('gliner2.model.SpanRepLayer'):
                    with patch.object(Extractor, '_print_config'):
                        mock_encoder = MagicMock()
                        mock_encoder.config.hidden_size = 768
                        mock_encoder.embeddings.word_embeddings = MagicMock()
                        mock_encoder.embeddings.word_embeddings.weight = torch.randn(30000, 768)
                        mock_auto.from_pretrained.return_value = mock_encoder
                        
                        model = Extractor(config)
                        model._lora_layers = {}
                        model._adapter_config = None
                        return model
    
    def test_save_pretrained_calls_save_file(self, model):
        """Testa que save_pretrained chama save_file."""
        with patch('gliner2.model.save_file') as mock_save:
            with patch.object(model.config, 'save_pretrained'):
                with patch.object(model.encoder.config, 'save_pretrained'):
                    with patch.object(model.processor.tokenizer, 'save_pretrained'):
                        with patch('os.makedirs'):
                            model.save_pretrained("/tmp/test")
                            
                            mock_save.assert_called_once()


# =============================================================================
# Tests for Forward Pass (Basic)
# =============================================================================

class TestExtractorForward:
    """Testes para forward pass do Extractor."""
    
    @pytest.fixture
    def model(self):
        """Cria um modelo mock para testes."""
        config = ExtractorConfig()
        
        with patch('gliner2.model.AutoModel') as mock_auto:
            with patch('gliner2.model.SchemaTransformer'):
                with patch('gliner2.model.SpanRepLayer'):
                    with patch.object(Extractor, '_print_config'):
                        mock_encoder = MagicMock()
                        mock_encoder.config.hidden_size = 768
                        mock_encoder.embeddings.word_embeddings = MagicMock()
                        mock_encoder.embeddings.word_embeddings.weight = torch.randn(30000, 768)
                        mock_auto.from_pretrained.return_value = mock_encoder
                        
                        model = Extractor(config)
                        model._lora_layers = {}
                        model._adapter_config = None
                        return model
    
    def test_forward_empty_batch(self, model):
        """Testa forward com batch vazio."""
        # Cria batch vazio
        empty_batch = MagicMock()
        empty_batch.__len__ = MagicMock(return_value=0)
        
        result = model(empty_batch)
        
        assert result["batch_size"] == 0
    
    def test_empty_loss_dict_returns_tensors_with_grad(self, model):
        """Testa que _empty_loss_dict retorna tensores com requires_grad."""
        result = model._empty_loss_dict()
        
        # total_loss deve ter requires_grad para backward
        assert result["total_loss"].requires_grad


# =============================================================================
# Tests for Loss Computation
# =============================================================================

class TestLossComputation:
    """Testes para cálculo de loss."""
    
    def test_compute_struct_loss_exists(self):
        """Testa que compute_struct_loss existe e é chamável."""
        from gliner2.model import Extractor, ExtractorConfig
        
        config = ExtractorConfig()
        
        with patch('gliner2.model.AutoModel') as mock_auto:
            with patch('gliner2.model.SchemaTransformer'):
                with patch('gliner2.model.SpanRepLayer'):
                    with patch.object(Extractor, '_print_config'):
                        mock_encoder = MagicMock()
                        mock_encoder.config.hidden_size = 768
                        mock_encoder.embeddings.word_embeddings = MagicMock()
                        mock_encoder.embeddings.word_embeddings.weight = torch.randn(30000, 768)
                        mock_auto.from_pretrained.return_value = mock_encoder
                        
                        model = Extractor(config)
                        model._lora_layers = {}
                        model._adapter_config = None
                        
                        # Verifica que o método existe
                        assert hasattr(model, 'compute_struct_loss')
                        assert callable(getattr(model, 'compute_struct_loss'))


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
