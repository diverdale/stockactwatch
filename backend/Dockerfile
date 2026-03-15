FROM python:3.12-slim

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /usr/local/bin/

WORKDIR /app

# Copy dependency files first for layer caching
COPY pyproject.toml uv.lock ./

# Install dependencies into the system Python (no venv) using uv
RUN uv pip install --system --no-cache -r pyproject.toml

# Copy application source
COPY alembic.ini ./
COPY alembic/ ./alembic/
COPY app/ ./app/

# Cloud Run uses PORT env var; default to 8080
ENV PORT=8080

EXPOSE 8080

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
