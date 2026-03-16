FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for ML libraries
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements-prod.txt .

# Install Python dependencies (CPU-only PyTorch for smaller image)
RUN pip install --no-cache-dir -r requirements-prod.txt

# Copy application code
COPY . .

# Create data directory for cache
RUN mkdir -p /app/data

# Expose port for container platforms such as Coolify
EXPOSE 8080

# Run with single worker (GLiNER2 is not thread-safe)
CMD ["sh", "-c", "uvicorn api.main:app --host 0.0.0.0 --port ${PORT:-8080} --workers 1"]
