from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import chats
from app.services.database import close_db, connect_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    connect_db()
    yield
    # Shutdown
    close_db()


app = FastAPI(
    title="Memoir",
    description="AI-powered interactive journaling application",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite default port
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(chats.router, prefix="/api/chats", tags=["chats"])


@app.get("/")
def root():
    return {"message": "Welcome to Memoir API"}


@app.get("/health")
def health_check():
    return {"status": "healthy"}
