## Setup

### Backend

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
cp .env.example .env
# Edit .env with your values:
# MONGODB_URI=your-mongodb-connection-string
# OPENAI_API_KEY=your-openai-api-key

# Run the server
uvicorn app.main:app --reload
```

Backend runs at http://localhost:8000

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Run the dev server
npm run dev
```

Frontend runs at http://localhost:5173
