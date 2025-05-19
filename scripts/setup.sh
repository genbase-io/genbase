#!/bin/bash

# Genbase Development Setup Script

set -e

# Change to the parent directory (genbase root)
cd "$(dirname "$0")/.."

echo "🚀 Setting up Genbase development environment..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Build and start services
echo "🏗️  Building Docker images..."
docker-compose -f docker/docker-compose.yml build

echo "🔄 Starting services..."
docker-compose -f docker/docker-compose.yml up -d

# Wait for database to be ready
echo "⏳ Waiting for database to be ready..."
sleep 10

# Run database migrations
echo "🗃️  Running database migrations..."
docker-compose -f docker/docker-compose.yml exec server alembic upgrade head

echo "✅ Genbase is ready!"
echo ""
echo "📱 Frontend (App): http://localhost:3000"
echo "🔧 Backend API: http://localhost:8000"
echo "🗃️  Database: localhost:5432"
echo ""
echo "To view logs: ./scripts/logs.sh"
echo "To stop: ./scripts/teardown.sh"
echo "To reset: ./scripts/reset.sh"