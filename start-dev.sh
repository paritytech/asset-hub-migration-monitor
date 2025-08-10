#!/bin/bash

echo "Starting Asset Hub Migration Monitor in Development Mode..."

# Stop existing containers
echo "Stopping existing containers..."
docker-compose -f docker-compose.dev.yml down

# Create data directory if it doesn't exist
echo "Ensuring data directory exists..."
mkdir -p ./backend/data

# Build and start development containers
echo "Building and starting development containers..."
docker-compose -f docker-compose.dev.yml up --build

echo "Development containers started!"
echo "Frontend: http://localhost:3000"
echo "Backend: http://localhost:8080"
echo "Use the backend URL input field to connect to http://localhost:8080"
echo ""
echo "To stop: docker-compose -f docker-compose.dev.yml down"
echo "To view logs: docker-compose -f docker-compose.dev.yml logs -f" 