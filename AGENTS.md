# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

GLiNER2 is a unified information extraction library that combines Named Entity Recognition, Text Classification, Structured Data Extraction, and Relation Extraction into a single 205M parameter model. It's CPU-optimized and designed for local inference without external API dependencies.

## Common Commands

```bash
# Install package (for development)
pip install -e .

# Install dependencies
pip install gliner

# Run tests
python tests/test_entity_extraction.py
python tests/test_relation_extraction.py
python tests/test_structure_extraction.py
```

## Architecture

### Core Components

```
gliner2/
├── inference/engine.py   # GLiNER2 main class, Schema builder, RegexValidator
├── model.py              # Extractor (PyTorch model), ExtractorConfig
├── processor.py          # SchemaTransformer, PreprocessedBatch, tokenization
├── layers.py             # CountLSTM, CountLSTMoE, MLP builders
├── api_client.py         # GLiNER2API for cloud inference
└── training/
    ├── trainer.py        # GLiNER2Trainer, TrainingConfig
    ├── data.py           # InputExample, TrainingDataset, data loading
    └── lora.py           # LoRA adapter implementation
```

### Class Hierarchy

- `GLiNER2` (engine.py) extends `Extractor` (model.py) extends `PreTrainedModel`
- `GLiNER2` is the main user-facing class with extraction methods
- `Extractor` handles model forward pass, span representations, and loss computation
- `SchemaTransformer` (processor.py) handles tokenization and schema-to-tensor conversion

### Data Flow

1. User calls `extract_entities()`, `classify_text()`, `extract_json()`, or `extract_relations()`
2. Schema builder creates schema dict with task specifications
3. `SchemaTransformer` tokenizes text + schema into `PreprocessedBatch`
4. `Extractor` encodes batch through transformer encoder
5. Span representations computed via `SpanRepLayer`
6. `CountLSTM` predicts instance counts and projects schema embeddings
7. Results decoded and formatted with optional confidence/spans

### Schema Builder Pattern

```python
schema = extractor.create_schema()
    .entities({"person": "Human names", "company": "Organizations"})
    .classification("sentiment", ["positive", "negative", "neutral"])
    .relations(["works_for", "located_in"])
    .structure("product")
        .field("name", dtype="str")
        .field("price", dtype="str")
        .field("features", dtype="list")
```

### Training Data Format (JSONL)

```jsonl
{"input": "text here", "output": {"entities": {"type": ["span"]}, "entity_descriptions": {...}}}
{"input": "text here", "output": {"classifications": [{"task": "name", "labels": [...], "true_label": [...]}]}}
{"input": "text here", "output": {"json_structures": [{"parent": {"field": "value"}}]}}
{"input": "text here", "output": {"relations": [{"rel_type": {"head": "entity1", "tail": "entity2"}}]}}
```

## Key Patterns

### Extraction Methods

All extraction routes through `batch_extract()` which:
1. Normalizes schemas (handles both `Schema` objects and raw dicts)
2. Uses `ExtractorCollator` for batching
3. Calls `_extract_from_batch()` for inference
4. Formats results via `format_results()`

### LoRA Adapters

```python
# Training with LoRA
config = TrainingConfig(use_lora=True, lora_r=8, lora_alpha=16.0)

# Loading adapters at inference
model.load_adapter("./adapter_path")
model.unload_adapter()
model.merge_lora()  # Permanent merge
```

### RegexValidator

Used to filter extracted spans post-inference:
```python
validator = RegexValidator(r"^\d+$", mode="full")  # Must match entirely
validator = RegexValidator(r"test", exclude=True)  # Exclude matches
```

## Testing

Tests are standalone scripts that load models and run extraction tests. They print results to stdout for manual verification. No test framework is configured - run directly with Python.
