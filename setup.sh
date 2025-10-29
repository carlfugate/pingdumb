#!/bin/bash

echo "Setting up pingdumb..."

# Install backend dependencies
echo "Installing Python dependencies..."
cd backend
pip3 install -r requirements.txt

# Install frontend dependencies
echo "Installing Node.js dependencies..."
cd ../frontend
npm install

cd ..

echo "Setup complete!"
echo ""
echo "To start the application:"
echo "  npm run dev"
echo ""
echo "Or start services individually:"
echo "  Backend:  cd backend && python main.py"
echo "  Frontend: cd frontend && npm run dev"
echo ""
echo "Access the dashboard at: http://localhost:3000"
