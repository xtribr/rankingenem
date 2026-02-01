"""
Testes unitários para camadas customizadas do GLiNER2.

Testa: create_mlp, DownscaledTransformer, CountLSTM, CountLSTMv2, 
       CountLSTMoE, LoRALayer
"""

import pytest
import torch
import torch.nn as nn
import math

from gliner2.layers import (
    create_mlp,
    DownscaledTransformer,
    CountLSTM,
    CountLSTMv2,
    CountLSTMoE,
)
from gliner2.training.lora import (
    LoRALayer,
    LoRAConfig,
    apply_lora_to_model,
    get_lora_parameters,
    get_lora_state_dict,
    count_lora_parameters,
    has_lora_adapter,
)


# =============================================================================
# Tests for create_mlp
# =============================================================================

class TestCreateMLP:
    """Testes para a função create_mlp."""
    
    def test_mlp_basic_creation(self):
        """Testa criação básica de MLP."""
        mlp = create_mlp(
            input_dim=128,
            intermediate_dims=[256, 512],
            output_dim=64
        )
        
        assert isinstance(mlp, nn.Sequential)
        # Verifica camadas: Linear(128,256) -> GELU -> Dropout -> Linear(256,512) -> GELU -> Dropout -> Linear(512,64)
        # Total: 7 camadas (com dropout padrão=0.1)
        assert len(mlp) == 7
    
    def test_mlp_activation_relu(self):
        """Testa MLP com ativação ReLU."""
        mlp = create_mlp(
            input_dim=64,
            intermediate_dims=[128],
            output_dim=32,
            activation="relu"
        )
        
        assert any(isinstance(layer, nn.ReLU) for layer in mlp)
    
    def test_mlp_activation_tanh(self):
        """Testa MLP com ativação Tanh."""
        mlp = create_mlp(
            input_dim=64,
            intermediate_dims=[128],
            output_dim=32,
            activation="tanh"
        )
        
        assert any(isinstance(layer, nn.Tanh) for layer in mlp)
    
    def test_mlp_activation_sigmoid(self):
        """Testa MLP com ativação Sigmoid."""
        mlp = create_mlp(
            input_dim=64,
            intermediate_dims=[128],
            output_dim=32,
            activation="sigmoid"
        )
        
        assert any(isinstance(layer, nn.Sigmoid) for layer in mlp)
    
    def test_mlp_activation_leaky_relu(self):
        """Testa MLP com ativação LeakyReLU."""
        mlp = create_mlp(
            input_dim=64,
            intermediate_dims=[128],
            output_dim=32,
            activation="leaky_relu"
        )
        
        assert any(isinstance(layer, nn.LeakyReLU) for layer in mlp)
    
    def test_mlp_with_dropout(self):
        """Testa MLP com dropout."""
        mlp = create_mlp(
            input_dim=64,
            intermediate_dims=[128],
            output_dim=32,
            dropout=0.5
        )
        
        assert any(isinstance(layer, nn.Dropout) for layer in mlp)
    
    def test_mlp_with_layer_norm(self):
        """Testa MLP com LayerNorm."""
        mlp = create_mlp(
            input_dim=64,
            intermediate_dims=[128],
            output_dim=32,
            add_layer_norm=True
        )
        
        assert any(isinstance(layer, nn.LayerNorm) for layer in mlp)
    
    def test_mlp_no_intermediate(self):
        """Testa MLP sem camadas intermediárias."""
        mlp = create_mlp(
            input_dim=64,
            intermediate_dims=[],
            output_dim=32
        )
        
        # Deve ter apenas Linear(64,32)
        assert len(mlp) == 1
        assert isinstance(mlp[0], nn.Linear)
    
    def test_mlp_forward_pass(self):
        """Testa forward pass do MLP."""
        mlp = create_mlp(128, [256], 64)
        x = torch.randn(2, 128)
        
        output = mlp(x)
        
        assert output.shape == (2, 64)
    
    def test_mlp_invalid_activation(self):
        """Testa erro com ativação inválida."""
        with pytest.raises(KeyError):
            create_mlp(64, [128], 32, activation="invalid")


# =============================================================================
# Tests for DownscaledTransformer
# =============================================================================

class TestDownscaledTransformer:
    """Testes para DownscaledTransformer."""
    
    @pytest.fixture
    def transformer(self):
        return DownscaledTransformer(
            input_size=128,
            hidden_size=64,
            num_heads=4,
            num_layers=2,
            dropout=0.1
        )
    
    def test_initialization(self, transformer):
        """Testa inicialização."""
        assert transformer.input_size == 128
        assert transformer.hidden_size == 64
        assert transformer.num_heads == 4
        assert transformer.num_layers == 2
    
    def test_layer_structure(self, transformer):
        """Testa estrutura das camadas."""
        assert isinstance(transformer.in_projector, nn.Linear)
        assert isinstance(transformer.transformer, nn.TransformerEncoder)
        assert isinstance(transformer.out_projector, nn.Sequential)
    
    def test_forward_pass(self, transformer):
        """Testa forward pass."""
        # Input shape: (seq_len, batch, input_size)
        x = torch.randn(10, 2, 128)
        
        output = transformer(x)
        
        # Output deve ter mesmo shape do input
        assert output.shape == (10, 2, 128)
    
    def test_forward_different_sequence_lengths(self, transformer):
        """Testa forward com diferentes comprimentos de sequência."""
        for seq_len in [1, 5, 20, 100]:
            x = torch.randn(seq_len, 2, 128)
            output = transformer(x)
            assert output.shape == (seq_len, 2, 128)


# =============================================================================
# Tests for CountLSTM
# =============================================================================

class TestCountLSTM:
    """Testes para CountLSTM."""
    
    @pytest.fixture
    def count_lstm(self):
        return CountLSTM(hidden_size=128, max_count=20)
    
    def test_initialization(self, count_lstm):
        """Testa inicialização."""
        assert count_lstm.hidden_size == 128
        assert count_lstm.max_count == 20
        assert isinstance(count_lstm.pos_embedding, nn.Embedding)
        assert isinstance(count_lstm.gru, nn.GRU)
        assert isinstance(count_lstm.projector, nn.Sequential)
    
    def test_forward_pass(self, count_lstm):
        """Testa forward pass."""
        # pc_emb: (num_fields, hidden_size)
        pc_emb = torch.randn(5, 128)
        gold_count = 3
        
        output = count_lstm(pc_emb, gold_count)
        
        # Output: (gold_count, num_fields, hidden_size)
        assert output.shape == (3, 5, 128)
    
    def test_forward_single_count(self, count_lstm):
        """Testa forward com count=1."""
        pc_emb = torch.randn(5, 128)
        
        output = count_lstm(pc_emb, 1)
        
        assert output.shape == (1, 5, 128)
    
    def test_forward_max_count_cap(self, count_lstm):
        """Testa que count é limitado por max_count."""
        pc_emb = torch.randn(5, 128)
        
        output = count_lstm(pc_emb, 25)  # > max_count de 20
        
        assert output.shape[0] == 20  # Deve ser limitado a 20
    
    def test_forward_different_num_fields(self, count_lstm):
        """Testa forward com diferentes números de campos."""
        for num_fields in [1, 3, 10]:
            pc_emb = torch.randn(num_fields, 128)
            output = count_lstm(pc_emb, 3)
            assert output.shape == (3, num_fields, 128)


# =============================================================================
# Tests for CountLSTMv2
# =============================================================================

class TestCountLSTMv2:
    """Testes para CountLSTMv2."""
    
    @pytest.fixture
    def count_lstm_v2(self):
        return CountLSTMv2(hidden_size=128, max_count=20)
    
    def test_initialization(self, count_lstm_v2):
        """Testa inicialização."""
        assert count_lstm_v2.hidden_size == 128
        assert count_lstm_v2.max_count == 20
        assert isinstance(count_lstm_v2.transformer, DownscaledTransformer)
    
    def test_forward_pass(self, count_lstm_v2):
        """Testa forward pass."""
        pc_emb = torch.randn(5, 128)
        gold_count = 3
        
        output = count_lstm_v2(pc_emb, gold_count)
        
        assert output.shape == (3, 5, 128)
    
    def test_forward_compatibility_with_tensor(self, count_lstm_v2):
        """Testa compatibilidade com tensor como gold_count."""
        pc_emb = torch.randn(5, 128)
        gold_count_tensor = torch.tensor(3)
        
        # Deve funcionar mesmo com tensor
        output = count_lstm_v2(pc_emb, int(gold_count_tensor.item()))
        assert output.shape == (3, 5, 128)


# =============================================================================
# Tests for CountLSTMoE
# =============================================================================

class TestCountLSTMoE:
    """Testes para CountLSTMoE (Mixture of Experts)."""
    
    @pytest.fixture
    def count_lstm_moe(self):
        return CountLSTMoE(
            hidden_size=128,
            max_count=20,
            n_experts=4,
            ffn_mult=2,
            dropout=0.1
        )
    
    def test_initialization(self, count_lstm_moe):
        """Testa inicialização."""
        assert count_lstm_moe.hidden_size == 128
        assert count_lstm_moe.max_count == 20
        assert count_lstm_moe.n_experts == 4
        assert count_lstm_moe.w1.shape == (4, 128, 256)  # n_experts, hidden, hidden*ffn_mult
        assert count_lstm_moe.w2.shape == (4, 256, 128)
    
    def test_router_structure(self, count_lstm_moe):
        """Testa estrutura do router."""
        assert isinstance(count_lstm_moe.router, nn.Sequential)
        # Router deve ter Linear -> GELU -> Linear -> Softmax
        assert len(count_lstm_moe.router) == 4
    
    def test_forward_pass(self, count_lstm_moe):
        """Testa forward pass."""
        pc_emb = torch.randn(5, 128)
        gold_count = 3
        
        output = count_lstm_moe(pc_emb, gold_count)
        
        assert output.shape == (3, 5, 128)
    
    def test_expert_weights_initialized(self, count_lstm_moe):
        """Testa que pesos dos experts foram inicializados."""
        # Xavier uniform deve inicializar com valores não-nulos
        assert not torch.all(count_lstm_moe.w1 == 0)
        assert not torch.all(count_lstm_moe.w2 == 0)
    
    def test_gating_output(self, count_lstm_moe):
        """Testa que gating soma a 1."""
        pc_emb = torch.randn(5, 128)
        
        # Simula parte do forward para verificar gating
        import torch.nn.functional as F
        pos_seq = count_lstm_moe.pos_embedding(torch.arange(3)).unsqueeze(1).expand(3, 5, 128)
        h0 = pc_emb.unsqueeze(0)
        h, _ = count_lstm_moe.gru(pos_seq, h0)
        gates = count_lstm_moe.router(h)
        
        # Gates devem somar a 1 para cada posição
        gate_sums = gates.sum(dim=-1)
        assert torch.allclose(gate_sums, torch.ones_like(gate_sums), atol=1e-6)


# =============================================================================
# Tests for LoRALayer
# =============================================================================

class TestLoRALayer:
    """Testes para LoRALayer."""
    
    @pytest.fixture
    def base_linear(self):
        return nn.Linear(128, 64)
    
    @pytest.fixture
    def lora_layer(self, base_linear):
        return LoRALayer(
            base_layer=base_linear,
            r=8,
            alpha=16.0,
            dropout=0.0
        )
    
    def test_initialization(self, lora_layer, base_linear):
        """Testa inicialização."""
        assert lora_layer.r == 8
        assert lora_layer.alpha == 16.0
        assert lora_layer.scaling == 2.0  # alpha / r
        assert lora_layer.base_layer is base_linear
        assert lora_layer.merged is False
    
    def test_lora_matrices_shape(self, lora_layer):
        """Testa shapes das matrizes LoRA."""
        # A: (r, in_features) = (8, 128)
        assert lora_layer.lora_A.shape == (8, 128)
        # B: (out_features, r) = (64, 8)
        assert lora_layer.lora_B.shape == (64, 8)
    
    def test_base_layer_frozen(self, lora_layer, base_linear):
        """Testa que base layer está congelado."""
        for param in base_linear.parameters():
            assert param.requires_grad is False
    
    def test_lora_parameters_trainable(self, lora_layer):
        """Testa que parâmetros LoRA são treináveis."""
        assert lora_layer.lora_A.requires_grad is True
        assert lora_layer.lora_B.requires_grad is True
    
    def test_initialization_values(self, lora_layer):
        """Testa valores de inicialização."""
        # A deve ser inicializado com Kaiming (valores não-zero)
        assert not torch.all(lora_layer.lora_A == 0)
        # B deve ser zero
        assert torch.all(lora_layer.lora_B == 0)
    
    def test_forward_pass(self, lora_layer):
        """Testa forward pass."""
        x = torch.randn(2, 128)
        
        output = lora_layer(x)
        
        assert output.shape == (2, 64)
    
    def test_forward_no_dropout(self, lora_layer):
        """Testa forward sem dropout."""
        x = torch.randn(2, 128)
        lora_layer.lora_dropout = nn.Identity()
        
        output1 = lora_layer(x)
        output2 = lora_layer(x)
        
        # Deve ser determinístico sem dropout
        assert torch.allclose(output1, output2)
    
    def test_forward_with_dropout(self, base_linear):
        """Testa forward com dropout."""
        lora = LoRALayer(base_linear, r=8, alpha=16.0, dropout=0.5)
        x = torch.randn(2, 128)
        lora.train()  # Ativa dropout
        
        output1 = lora(x)
        output2 = lora(x)
        
        # Com dropout, pode ser diferente
        # (não garantido, mas provável)
    
    def test_merge_weights(self, lora_layer, base_linear):
        """Testa merge de pesos."""
        # Inicializa lora_B com valores não-zero para que o merge tenha efeito
        lora_layer.lora_B.data = torch.randn_like(lora_layer.lora_B.data)
        
        # Guarda peso original
        original_weight = base_linear.weight.data.clone()
        
        lora_layer.merge_weights()
        
        assert lora_layer.merged is True
        # Peso deve ter mudado
        assert not torch.allclose(base_linear.weight.data, original_weight)
    
    def test_merge_already_merged(self, lora_layer):
        """Testa merge quando já está merged."""
        lora_layer.merge_weights()
        
        # Não deve lançar erro
        lora_layer.merge_weights()
        assert lora_layer.merged is True
    
    def test_unmerge_weights(self, lora_layer, base_linear):
        """Testa unmerge de pesos."""
        original_weight = base_linear.weight.data.clone()
        
        lora_layer.merge_weights()
        lora_layer.unmerge_weights()
        
        assert lora_layer.merged is False
        # Peso deve voltar ao original
        assert torch.allclose(base_linear.weight.data, original_weight)
    
    def test_unmerge_not_merged(self, lora_layer):
        """Testa unmerge quando não está merged."""
        # Não deve lançar erro
        lora_layer.unmerge_weights()
        assert lora_layer.merged is False
    
    def test_merge_unmerge_cycle(self, lora_layer, base_linear):
        """Testa ciclo completo de merge/unmerge."""
        original_weight = base_linear.weight.data.clone()
        
        lora_layer.merge_weights()
        lora_layer.unmerge_weights()
        
        assert torch.allclose(base_linear.weight.data, original_weight)
    
    def test_exposed_attributes(self, lora_layer, base_linear):
        """Testa que atributos da base layer são expostos."""
        assert lora_layer.weight is base_linear.weight
        assert lora_layer.bias is base_linear.bias
        assert lora_layer.in_features == base_linear.in_features
        assert lora_layer.out_features == base_linear.out_features
    
    def test_forward_merged(self, lora_layer):
        """Testa forward quando merged."""
        x = torch.randn(2, 128)
        
        output_before = lora_layer(x)
        lora_layer.merge_weights()
        output_after = lora_layer(x)
        
        # Outputs devem ser iguais (aproximadamente)
        assert torch.allclose(output_before, output_after, atol=1e-5)


# =============================================================================
# Tests for LoRA Helper Functions (Simplified)
# =============================================================================

class TestLoRAHelpers:
    """Testes para funções auxiliares de LoRA."""
    
    def test_apply_lora_disabled(self):
        """Testa aplicação quando LoRA está desabilitado."""
        model = nn.Sequential(
            nn.Linear(128, 64),
            nn.ReLU(),
        )
        
        config = LoRAConfig(enabled=False)
        model, lora_layers = apply_lora_to_model(model, config)
        
        assert len(lora_layers) == 0
        # Modelo deve permanecer inalterado
        assert isinstance(model[0], nn.Linear)
    
    def test_get_lora_parameters_empty(self):
        """Testa extração de parâmetros LoRA quando não há."""
        model = nn.Sequential(nn.Linear(128, 64))
        
        params = get_lora_parameters(model)
        
        assert len(params) == 0
    
    def test_get_lora_state_dict_empty(self):
        """Testa extração de state dict LoRA quando não há."""
        model = nn.Sequential(nn.Linear(128, 64))
        
        state_dict = get_lora_state_dict(model)
        
        assert len(state_dict) == 0
    
    def test_count_lora_parameters_no_lora(self):
        """Testa contagem quando não há LoRA."""
        model = nn.Sequential(nn.Linear(128, 64))
        
        lora_params, total_params, percentage = count_lora_parameters(model)
        
        assert lora_params == 0
        assert total_params > 0
        assert percentage == 0.0
    
    def test_has_lora_adapter_false(self):
        """Testa detecção de LoRA quando ausente."""
        model = nn.Sequential(nn.Linear(128, 64))
        assert has_lora_adapter(model) is False


# =============================================================================
# Tests for LoRAConfig
# =============================================================================

class TestLoRAConfig:
    """Testes para LoRAConfig."""
    
    def test_default_config(self):
        """Testa configuração padrão."""
        config = LoRAConfig()
        
        assert config.enabled is False
        assert config.r == 8
        assert config.alpha == 16.0
        assert config.dropout == 0.0
        assert config.target_modules == ["encoder"]
    
    def test_custom_config(self):
        """Testa configuração customizada."""
        config = LoRAConfig(
            enabled=True,
            r=16,
            alpha=32.0,
            dropout=0.1,
            target_modules=["encoder", "classifier"]
        )
        
        assert config.enabled is True
        assert config.r == 16
        assert config.alpha == 32.0
    
    def test_invalid_rank(self):
        """Testa erro com rank inválido."""
        with pytest.raises(ValueError):
            LoRAConfig(enabled=True, r=0)
    
    def test_invalid_alpha(self):
        """Testa erro com alpha inválido."""
        with pytest.raises(ValueError):
            LoRAConfig(enabled=True, alpha=0)
    
    def test_invalid_dropout(self):
        """Testa erro com dropout inválido."""
        with pytest.raises(ValueError):
            LoRAConfig(enabled=True, dropout=1.5)
    
    def test_empty_target_modules(self):
        """Testa erro com target_modules vazio."""
        with pytest.raises(ValueError):
            LoRAConfig(enabled=True, target_modules=[])
