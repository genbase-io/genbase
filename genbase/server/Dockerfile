# genbase/server/Dockerfile
FROM python:3.12-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    git \
    unzip \
    gnupg \
    && rm -rf /var/lib/apt/lists/*

# Install OpenTofu
RUN curl --proto '=https' --tlsv1.2 -fsSL https://get.opentofu.org/install-opentofu.sh -o install-opentofu.sh \
    && chmod +x install-opentofu.sh \
    && ./install-opentofu.sh --install-method standalone --skip-verify \
    && rm -f install-opentofu.sh \
    && ln -s /usr/local/bin/tofu /usr/bin/tofu

# Set working directory
WORKDIR /app

# Copy and install Python dependencies first (for better caching)
COPY pyproject.toml ./
COPY src ./src
RUN pip install --no-cache-dir -e .

# Copy alembic configuration
COPY alembic.ini ./
COPY alembic ./alembic

# Create non-root user
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

# Expose port
EXPOSE 8000

# Run the application
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]