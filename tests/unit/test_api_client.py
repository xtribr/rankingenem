"""
Testes unitários para o API Client do GLiNER2.

Testa: GLiNER2API, SchemaAPI, StructureBuilderAPI com mocks HTTP.
"""

import pytest
import json
from unittest.mock import MagicMock, patch, Mock
from requests.exceptions import Timeout, ConnectionError, RequestException

from gliner2.api_client import (
    GLiNER2API,
    GLiNER2APIError,
    AuthenticationError,
    ValidationError,
    ServerError,
    SchemaAPI,
    StructureBuilderAPI,
)


# =============================================================================
# Tests for API Client Initialization
# =============================================================================

class TestGLiNER2APIInitialization:
    """Testes para inicialização do API client."""
    
    def test_initialization_with_api_key(self):
        """Testa inicialização com API key explícita."""
        with patch.dict('os.environ', {}, clear=True):  # Limpa env vars
            client = GLiNER2API(api_key="test_key_123")
            
            assert client.api_key == "test_key_123"
            assert client.base_url == "https://api.fastino.ai"
            assert client.timeout == 30.0
            assert client.max_retries == 3
    
    def test_initialization_from_env_var(self):
        """Testa inicialização com API key de variável de ambiente."""
        with patch.dict('os.environ', {'PIONEER_API_KEY': 'env_key_456'}):
            client = GLiNER2API()
            
            assert client.api_key == "env_key_456"
    
    def test_initialization_error_no_key(self):
        """Testa erro quando não há API key."""
        with patch.dict('os.environ', {}, clear=True):
            with pytest.raises(ValueError) as exc_info:
                GLiNER2API()
            
            assert "API key must be provided" in str(exc_info.value)
    
    def test_initialization_custom_base_url(self):
        """Testa inicialização com URL customizada."""
        with patch.dict('os.environ', {'PIONEER_API_KEY': 'test_key'}):
            client = GLiNER2API(api_base_url="https://custom.api.com")
            
            assert client.base_url == "https://custom.api.com"
    
    def test_initialization_custom_timeout(self):
        """Testa inicialização com timeout customizado."""
        with patch.dict('os.environ', {'PIONEER_API_KEY': 'test_key'}):
            client = GLiNER2API(timeout=60.0)
            
            assert client.timeout == 60.0
    
    def test_session_headers(self):
        """Testa que sessão tem headers corretos."""
        with patch.dict('os.environ', {'PIONEER_API_KEY': 'test_key'}):
            client = GLiNER2API()
            
            assert client.session.headers["X-API-Key"] == "test_key"
            assert client.session.headers["Content-Type"] == "application/json"


# =============================================================================
# Tests for API Request Method
# =============================================================================

class TestGLiNER2APIRequests:
    """Testes para requisições HTTP do API client."""
    
    @pytest.fixture
    def client(self):
        with patch.dict('os.environ', {'PIONEER_API_KEY': 'test_key'}):
            return GLiNER2API()
    
    def test_make_request_success(self, client):
        """Testa requisição bem-sucedida."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"result": {"entities": {"person": ["John"]}}}
        mock_response.ok = True
        
        with patch.object(client.session, 'post', return_value=mock_response):
            result = client._make_request(
                task="extract_entities",
                text="John works at Apple.",
                schema=["person", "company"]
            )
        
        assert result == {"entities": {"person": ["John"]}}
    
    def test_make_request_with_list_text(self, client):
        """Testa requisição com lista de textos."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"result": [{"entities": {"person": ["John"]}}]}
        mock_response.ok = True
        
        with patch.object(client.session, 'post', return_value=mock_response):
            result = client._make_request(
                task="extract_entities",
                text=["John works at Apple.", "Jane works at Google."],
                schema=["person", "company"]
            )
        
        assert isinstance(result, list)
    
    def test_make_request_authentication_error(self, client):
        """Testa erro de autenticação (401)."""
        mock_response = MagicMock()
        mock_response.status_code = 401
        mock_response.json.return_value = {"detail": "Invalid API key"}
        mock_response.content = b'{"detail": "Invalid API key"}'
        mock_response.ok = False
        
        with patch.object(client.session, 'post', return_value=mock_response):
            with pytest.raises(AuthenticationError) as exc_info:
                client._make_request(
                    task="extract_entities",
                    text="Test",
                    schema=["person"]
                )
            
            # Verifica que o erro tem a mensagem esperada
            assert "Invalid" in str(exc_info.value) or "API key" in str(exc_info.value)
            assert exc_info.value.status_code is None  # AuthenticationError não recebe status_code
    
    def test_make_request_validation_error(self, client):
        """Testa erro de validação (400/422)."""
        mock_response = MagicMock()
        mock_response.status_code = 422
        mock_response.json.return_value = {"detail": "Invalid schema"}
        mock_response.content = b'{"detail": "Invalid schema"}'
        mock_response.ok = False
        
        with patch.object(client.session, 'post', return_value=mock_response):
            with pytest.raises(ValidationError) as exc_info:
                client._make_request(
                    task="extract_entities",
                    text="Test",
                    schema="invalid_schema"
                )
            
            assert exc_info.value.status_code == 422
    
    def test_make_request_server_error(self, client):
        """Testa erro do servidor (500)."""
        mock_response = MagicMock()
        mock_response.status_code = 500
        mock_response.json.return_value = {"detail": "Internal server error"}
        mock_response.content = b'{"detail": "Internal server error"}'
        mock_response.ok = False
        
        with patch.object(client.session, 'post', return_value=mock_response):
            with pytest.raises(ServerError) as exc_info:
                client._make_request(
                    task="extract_entities",
                    text="Test",
                    schema=["person"]
                )
            
            assert exc_info.value.status_code == 500
    
    def test_make_request_timeout(self, client):
        """Testa timeout."""
        with patch.object(client.session, 'post', side_effect=Timeout()):
            with pytest.raises(GLiNER2APIError) as exc_info:
                client._make_request(
                    task="extract_entities",
                    text="Test",
                    schema=["person"]
                )
            
            assert "timed out" in str(exc_info.value).lower()
    
    def test_make_request_connection_error(self, client):
        """Testa erro de conexão."""
        with patch.object(client.session, 'post', side_effect=ConnectionError("No connection")):
            with pytest.raises(GLiNER2APIError) as exc_info:
                client._make_request(
                    task="extract_entities",
                    text="Test",
                    schema=["person"]
                )
            
            assert "Connection error" in str(exc_info.value)
    
    def test_make_request_generic_error(self, client):
        """Testa erro genérico de requisição."""
        with patch.object(client.session, 'post', side_effect=RequestException("Failed")):
            with pytest.raises(GLiNER2APIError) as exc_info:
                client._make_request(
                    task="extract_entities",
                    text="Test",
                    schema=["person"]
                )
            
            assert "Request failed" in str(exc_info.value)


# =============================================================================
# Tests for Entity Extraction Methods
# =============================================================================

class TestAPIEntityExtraction:
    """Testes para extração de entidades via API."""
    
    @pytest.fixture
    def client(self):
        with patch.dict('os.environ', {'PIONEER_API_KEY': 'test_key'}):
            return GLiNER2API()
    
    def test_extract_entities_basic(self, client):
        """Testa extração básica de entidades."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"result": {"person": ["Tim Cook"], "company": ["Apple"]}}
        mock_response.ok = True
        
        with patch.object(client.session, 'post', return_value=mock_response):
            result = client.extract_entities(
                "Tim Cook works at Apple.",
                ["person", "company"]
            )
        
        assert "person" in result or "entities" in result
    
    def test_extract_entities_with_dict_schema(self, client):
        """Testa extração com schema como dict."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"result": {"person": ["Tim Cook"]}}
        mock_response.ok = True
        
        with patch.object(client.session, 'post', return_value=mock_response):
            result = client.extract_entities(
                "Tim Cook works at Apple.",
                {"person": "Names of people", "company": "Company names"}
            )
        
        assert isinstance(result, dict)
    
    def test_extract_entities_with_options(self, client):
        """Testa extração com opções."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "result": {
                "entities": {
                    "person": [{"text": "Tim Cook", "confidence": 0.95}]
                }
            }
        }
        mock_response.ok = True
        
        with patch.object(client.session, 'post', return_value=mock_response):
            result = client.extract_entities(
                "Tim Cook works at Apple.",
                ["person"],
                include_confidence=True,
                include_spans=True
            )
        
        assert isinstance(result, dict)
    
    def test_batch_extract_entities(self, client):
        """Testa extração em batch."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "result": [
                {"entities": {"person": ["Tim"]}},
                {"entities": {"person": ["Jane"]}}
            ]
        }
        mock_response.ok = True
        
        with patch.object(client.session, 'post', return_value=mock_response):
            results = client.batch_extract_entities(
                ["Tim works at Apple.", "Jane works at Google."],
                ["person", "company"]
            )
        
        assert isinstance(results, list)
        assert len(results) == 2


# =============================================================================
# Tests for Classification Methods
# =============================================================================

class TestAPIClassification:
    """Testes para classificação via API."""
    
    @pytest.fixture
    def client(self):
        with patch.dict('os.environ', {'PIONEER_API_KEY': 'test_key'}):
            return GLiNER2API()
    
    def test_classify_text_single_task(self, client):
        """Testa classificação com tarefa única."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"result": {"classification": "positive"}}
        mock_response.ok = True
        
        with patch.object(client.session, 'post', return_value=mock_response):
            result = client.classify_text(
                "I love this!",
                {"sentiment": ["positive", "negative", "neutral"]}
            )
        
        assert "sentiment" in result
    
    def test_classify_text_multi_task(self, client):
        """Testa classificação com múltiplas tarefas."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "result": {
                "sentiment": "positive",
                "category": "technology"
            }
        }
        mock_response.ok = True
        
        with patch.object(client.session, 'post', return_value=mock_response):
            result = client.classify_text(
                "Apple announced new iPhone.",
                {
                    "sentiment": ["positive", "negative"],
                    "category": ["technology", "business"]
                }
            )
        
        assert "sentiment" in result
        assert "category" in result


# =============================================================================
# Tests for JSON Extraction Methods
# =============================================================================

class TestAPIJSONExtraction:
    """Testes para extração de JSON via API."""
    
    @pytest.fixture
    def client(self):
        with patch.dict('os.environ', {'PIONEER_API_KEY': 'test_key'}):
            return GLiNER2API()
    
    def test_extract_json_basic(self, client):
        """Testa extração JSON básica."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "result": {
                "product": [{"name": "iPhone 15", "price": "$999"}]
            }
        }
        mock_response.ok = True
        
        with patch.object(client.session, 'post', return_value=mock_response):
            result = client.extract_json(
                "Apple announced iPhone 15 at $999.",
                {"product": ["name::str", "price::str"]}
            )
        
        assert "product" in result
    
    def test_batch_extract_json(self, client):
        """Testa extração JSON em batch."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "result": [
                {"product": [{"name": "iPhone 15"}]},
                {"product": [{"name": "Pixel 8"}]}
            ]
        }
        mock_response.ok = True
        
        with patch.object(client.session, 'post', return_value=mock_response):
            results = client.batch_extract_json(
                ["Apple announced iPhone 15.", "Google announced Pixel 8."],
                {"product": ["name::str"]}
            )
        
        assert isinstance(results, list)
        assert len(results) == 2


# =============================================================================
# Tests for Relation Extraction Methods
# =============================================================================

class TestAPIRelationExtraction:
    """Testes para extração de relações via API."""
    
    @pytest.fixture
    def client(self):
        with patch.dict('os.environ', {'PIONEER_API_KEY': 'test_key'}):
            return GLiNER2API()
    
    def test_extract_relations_basic(self, client):
        """Testa extração básica de relações."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "result": {
                "relation_extraction": {
                    "works_for": [["Tim Cook", "Apple"]]
                }
            }
        }
        mock_response.ok = True
        
        with patch.object(client.session, 'post', return_value=mock_response):
            result = client.extract_relations(
                "Tim Cook works for Apple.",
                ["works_for", "founded"]
            )
        
        assert "relation_extraction" in result
    
    def test_extract_relations_with_dict(self, client):
        """Testa extração de relações com dict."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "result": {"relation_extraction": {"works_for": [["Tim", "Apple"]]}}
        }
        mock_response.ok = True
        
        with patch.object(client.session, 'post', return_value=mock_response):
            result = client.extract_relations(
                "Tim works for Apple.",
                {"works_for": "Employment relationship"}
            )
        
        assert isinstance(result, dict)


# =============================================================================
# Tests for General Extract Method
# =============================================================================

class TestAPIGeneralExtract:
    """Testes para método extract geral."""
    
    @pytest.fixture
    def client(self):
        with patch.dict('os.environ', {'PIONEER_API_KEY': 'test_key'}):
            return GLiNER2API()
    
    def test_extract_with_schema_api(self, client):
        """Testa extract com SchemaAPI."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "result": {
                "entities": {"person": ["Tim Cook"]},
                "sentiment": "positive"
            }
        }
        mock_response.ok = True
        
        schema = SchemaAPI()
        schema.entities(["person"])
        schema.classification("sentiment", ["positive", "negative"])
        
        with patch.object(client.session, 'post', return_value=mock_response):
            result = client.extract(
                "Tim Cook announced great news.",
                schema
            )
        
        assert isinstance(result, dict)
    
    def test_extract_with_dict_schema(self, client):
        """Testa extract com dict."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"result": {"entities": {"person": ["Tim"]}}}
        mock_response.ok = True
        
        schema = {"entities": ["person"], "classifications": {}}
        
        with patch.object(client.session, 'post', return_value=mock_response):
            result = client.extract(
                "Tim works here.",
                schema
            )
        
        assert isinstance(result, dict)
    
    def test_extract_empty_schema_error(self, client):
        """Testa erro com schema vazio."""
        with pytest.raises(ValueError) as exc_info:
            client.extract("Test text", {})
        
        assert "at least one extraction task" in str(exc_info.value)
    
    def test_batch_extract_with_list_schemas(self, client):
        """Testa batch extract com lista de schemas."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "result": [
                {"entities": {"person": ["Tim"]}},
                {"entities": {"person": ["Jane"]}}
            ]
        }
        mock_response.ok = True
        
        schema1 = SchemaAPI()
        schema1.entities(["person"])
        
        schema2 = SchemaAPI()
        schema2.entities(["person"])
        
        # Deve processar individualmente com warning
        import warnings
        with warnings.catch_warnings(record=True) as w:
            warnings.simplefilter("always")
            with patch.object(client.session, 'post', return_value=mock_response):
                results = client.batch_extract(
                    ["Tim works here.", "Jane works here."],
                    [schema1, schema2]
                )
            
            # Deve ter warning sobre multi-schema
            assert len(w) == 1
            assert "Multi-schema batch" in str(w[0].message)
        
        assert isinstance(results, list)


# =============================================================================
# Tests for Context Manager
# =============================================================================

class TestAPIContextManager:
    """Testes para context manager."""
    
    def test_context_manager(self):
        """Testa uso como context manager."""
        with patch.dict('os.environ', {'PIONEER_API_KEY': 'test_key'}):
            with patch('gliner2.api_client.requests.Session') as mock_session:
                with GLiNER2API() as client:
                    assert isinstance(client, GLiNER2API)
                
                # Verifica que close foi chamado
                mock_session.return_value.close.assert_called_once()


# =============================================================================
# Tests for Exception Classes
# =============================================================================

class TestExceptionClasses:
    """Testes para classes de exceção."""
    
    def test_gliner2_api_error_basic(self):
        """Testa GLiNER2APIError básico."""
        error = GLiNER2APIError("Test error")
        
        assert str(error) == "Test error"
        assert error.status_code is None
        assert error.response_data is None
    
    def test_gliner2_api_error_with_status(self):
        """Testa GLiNER2APIError com status code."""
        error = GLiNER2APIError("Test error", status_code=500, response_data={"detail": "Error"})
        
        assert error.status_code == 500
        assert error.response_data == {"detail": "Error"}
    
    def test_authentication_error(self):
        """Testa AuthenticationError."""
        error = AuthenticationError("Invalid key")
        
        assert isinstance(error, GLiNER2APIError)
        assert str(error) == "Invalid key"
    
    def test_validation_error(self):
        """Testa ValidationError."""
        error = ValidationError("Invalid data", status_code=422, response_data={"errors": []})
        
        assert isinstance(error, GLiNER2APIError)
        assert error.status_code == 422
    
    def test_server_error(self):
        """Testa ServerError."""
        error = ServerError("Internal error", status_code=500)
        
        assert isinstance(error, GLiNER2APIError)
        assert error.status_code == 500


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
