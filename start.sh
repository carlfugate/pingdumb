#!/bin/bash

echo "Starting pingdumb network monitoring..."

# Copy existing database to data directory if it exists
if [ -f "backend/network_tests.db" ] && [ ! -f "data/network_tests.db" ]; then
    echo "Copying existing database to data directory..."
    cp backend/network_tests.db data/
fi

# Start with docker-compose
docker-compose up -d

echo "Services starting..."
echo "Frontend: http://localhost:3000"
echo "Backend API: http://localhost:8000"
echo ""
echo "To stop: docker-compose down"
echo "To view logs: docker-compose logs -f"
