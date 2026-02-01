"""
Testes críticos para o trainer do GLiNER2.

Foca em: TrainingConfig, inicialização.
"""

import pytest
import torch
import torch.nn as nn
from unittest.mock import MagicMock, patch, mock_open
from pathlib import Path
import json


# =============================================================================
# Tests for TrainingConfig
# =============================================================================

class TestTrainingConfig:
    """Testes para TrainingConfig."""
    
    def test_default_values(self):
        """Testa valores padrão da config."""
        from gliner2.training.trainer import TrainingConfig
        
        config = TrainingConfig(output_dir="./output")
        
        assert config.output_dir == "./output"
        assert config.num_epochs == 10
        assert config.batch_size == 2  # Default atual
        assert config.eval_batch_size == 8
        assert config.encoder_lr == 1e-5
        assert config.task_lr == 5e-4
        assert config.warmup_ratio == 0.1
        assert config.scheduler_type == "linear"
        assert config.use_lora is False
    
    def test_custom_values(self):
        """Testa valores customizados."""
        from gliner2.training.trainer import TrainingConfig
        
        config = TrainingConfig(
            output_dir="./output",
            num_epochs=20,
            batch_size=16,
            encoder_lr=5e-6,
            task_lr=1e-4,
            warmup_ratio=0.2,
            scheduler_type="cosine",
            use_lora=True,
            lora_r=16,
            lora_alpha=32.0
        )
        
        assert config.num_epochs == 20
        assert config.batch_size == 16
        assert config.encoder_lr == 5e-6
        assert config.use_lora is True
        assert config.lora_r == 16
    
    def test_lora_values(self):
        """Testa valores específicos de LoRA."""
        from gliner2.training.trainer import TrainingConfig
        
        config = TrainingConfig(
            output_dir="./output",
            use_lora=True,
            lora_r=8,
            lora_alpha=16.0,
            lora_dropout=0.1
        )
        
        assert config.lora_r == 8
        assert config.lora_alpha == 16.0
        assert config.lora_dropout == 0.1
    
    def test_early_stopping_values(self):
        """Testa valores de early stopping."""
        from gliner2.training.trainer import TrainingConfig
        
        config = TrainingConfig(
            output_dir="./output",
            early_stopping=True,
            early_stopping_patience=5,
            early_stopping_threshold=0.01
        )
        
        assert config.early_stopping is True
        assert config.early_stopping_patience == 5
        assert config.early_stopping_threshold == 0.01
    
    def test_effective_batch_size(self):
        """Testa cálculo de effective_batch_size."""
        from gliner2.training.trainer import TrainingConfig
        
        config = TrainingConfig(
            output_dir="./output",
            batch_size=4,
            gradient_accumulation_steps=2
        )
        
        assert config.effective_batch_size == 8
    
    def test_save_and_load(self, tmp_path):
        """Testa save e load."""
        from gliner2.training.trainer import TrainingConfig
        
        config = TrainingConfig(
            output_dir="./output",
            num_epochs=5,
            batch_size=8
        )
        
        save_path = tmp_path / "config.json"
        config.save(str(save_path))
        
        loaded_config = TrainingConfig.load(str(save_path))
        
        assert loaded_config.num_epochs == 5
        assert loaded_config.batch_size == 8
    
    def test_invalid_fp16_bf16_combination(self):
        """Testa erro quando fp16 e bf16 são ambos True."""
        from gliner2.training.trainer import TrainingConfig
        
        with pytest.raises(ValueError, match="Cannot use both fp16 and bf16"):
            TrainingConfig(output_dir="./output", fp16=True, bf16=True)
    
    def test_invalid_logging_steps(self):
        """Testa erro quando logging_steps <= 0."""
        from gliner2.training.trainer import TrainingConfig
        
        with pytest.raises(ValueError, match="logging_steps must be > 0"):
            TrainingConfig(output_dir="./output", logging_steps=0)
    
    def test_invalid_batch_size(self):
        """Testa erro quando batch_size <= 0."""
        from gliner2.training.trainer import TrainingConfig
        
        with pytest.raises(ValueError, match="batch_size must be > 0"):
            TrainingConfig(output_dir="./output", batch_size=0)
    
    def test_invalid_lora_r(self):
        """Testa erro quando lora_r <= 0."""
        from gliner2.training.trainer import TrainingConfig
        
        with pytest.raises(ValueError, match="lora_r must be > 0"):
            TrainingConfig(output_dir="./output", use_lora=True, lora_r=0)
    
    def test_invalid_lora_alpha(self):
        """Testa erro quando lora_alpha <= 0."""
        from gliner2.training.trainer import TrainingConfig
        
        with pytest.raises(ValueError, match="lora_alpha must be > 0"):
            TrainingConfig(output_dir="./output", use_lora=True, lora_alpha=0)
    
    def test_invalid_lora_dropout(self):
        """Testa erro quando lora_dropout >= 1."""
        from gliner2.training.trainer import TrainingConfig
        
        with pytest.raises(ValueError, match="lora_dropout must be in"):
            TrainingConfig(output_dir="./output", use_lora=True, lora_dropout=1.0)
    
    def test_empty_lora_target_modules(self):
        """Testa erro quando lora_target_modules é vazio."""
        from gliner2.training.trainer import TrainingConfig
        
        with pytest.raises(ValueError, match="lora_target_modules cannot be empty"):
            TrainingConfig(output_dir="./output", use_lora=True, lora_target_modules=[])


# =============================================================================
# Tests for Trainer Initialization
# =============================================================================

class TestTrainerInitialization:
    """Testes para inicialização do trainer."""
    
    @pytest.fixture
    def mock_model(self):
        """Fixture para modelo mockado."""
        model = MagicMock()
        model.parameters = MagicMock(return_value=[nn.Parameter(torch.randn(10))])
        model.encoder = MagicMock()
        model.encoder.parameters = MagicMock(return_value=[nn.Parameter(torch.randn(10))])
        model.classifier = MagicMock()
        model.classifier.parameters = MagicMock(return_value=[nn.Parameter(torch.randn(10))])
        model.count_pred = MagicMock()
        model.count_pred.parameters = MagicMock(return_value=[nn.Parameter(torch.randn(10))])
        model.count_embed = MagicMock()
        model.count_embed.parameters = MagicMock(return_value=[nn.Parameter(torch.randn(10))])
        model.span_rep = MagicMock()
        model.span_rep.parameters = MagicMock(return_value=[nn.Parameter(torch.randn(10))])
        model.processor = MagicMock()
        model.config = MagicMock()
        model.config.max_width = 8
        model.config.model_name = "test-model"
        return model
    
    def test_basic_initialization(self, mock_model, tmp_path):
        """Testa inicialização básica."""
        from gliner2.training.trainer import GLiNER2Trainer, TrainingConfig
        
        output_dir = tmp_path / "output"
        config = TrainingConfig(output_dir=str(output_dir))
        
        trainer = GLiNER2Trainer(mock_model, config)
        
        assert trainer.model is mock_model
        assert trainer.config is config
    
    def test_initialization_creates_output_dir(self, mock_model, tmp_path):
        """Testa que diretório de saída é criado."""
        from gliner2.training.trainer import GLiNER2Trainer, TrainingConfig
        
        output_dir = tmp_path / "new_output"
        config = TrainingConfig(output_dir=str(output_dir))
        
        trainer = GLiNER2Trainer(mock_model, config)
        
        assert output_dir.exists()
        assert (output_dir / "training_config.json").exists()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
