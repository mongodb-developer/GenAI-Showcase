from dotenv import load_dotenv

load_dotenv(override=True)

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import routes
from app.services.mongodb import close_db, connect_db

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting MongoDB Projects API...")
    connect_db()
    logger.info("MongoDB Projects API started successfully")
    yield
    # Shutdown
    logger.info("Shutting down MongoDB Projects API...")
    close_db()


app = FastAPI(
    title="MongoDB Projects",
    description="AI-powered developer productivity assistant for project planning",
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
app.include_router(routes.router, prefix="/api/projects", tags=["projects"])


@app.get("/")
def root():
    return {"message": "Welcome to MongoDB Projects API"}


@app.get("/health")
def health_check():
    return {"status": "healthy"}
