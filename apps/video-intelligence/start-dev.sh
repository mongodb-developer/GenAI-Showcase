#!/bin/bash

# Video Intelligence App - Development Startup Script

echo "🎬 Starting Video Intelligence App Development Environment"
echo "========================================================"

# Check if we're in the right directory
if [ ! -f "README.md" ]; then
    echo "❌ Please run this script from the video-intelligence directory"
    exit 1
fi

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command_exists python; then
    echo "❌ Python is not installed"
    exit 1
fi

if ! command_exists node; then
    echo "❌ Node.js is not installed"
    exit 1
fi

if ! command_exists npm; then
    echo "❌ npm is not installed"
    exit 1
fi

echo "✅ Prerequisites check passed"

# Setup backend
echo ""
echo "🔧 Setting up backend..."
cd backend

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install dependencies
echo "Installing Python dependencies..."
pip install -r requirements.txt

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "⚠️  .env file not found. Copying from .env.example"
    cp .env.example .env
    echo "📝 Please edit .env file with your API keys and MongoDB connection string"
fi

cd ..

# Setup frontend
echo ""
echo "🎨 Setting up frontend..."
cd frontend

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "Installing Node.js dependencies..."
    npm install
fi

cd ..

echo ""
echo "🚀 Setup complete! To start the application:"
echo ""
echo "1. Start the backend (in terminal 1):"
echo "   cd backend && source venv/bin/activate && python main.py"
echo ""
echo "2. Start the frontend (in terminal 2):"
echo "   cd frontend && npm start"
echo ""
echo "📝 Don't forget to:"
echo "   - Configure your .env file with API keys"
echo "   - Set up MongoDB Atlas with vector search indexes"
echo "   - Check the README.md for detailed setup instructions"
echo ""
echo "🌐 App will be available at:"
echo "   Frontend: http://localhost:3000"
echo "   Backend API: http://localhost:8000"
echo "   API Docs: http://localhost:8000/docs"
