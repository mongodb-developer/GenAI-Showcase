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
    logger.info("Starting Memoir API...")
    connect_db()
    logger.info("Memoir API started successfully")
    yield
    # Shutdown
    logger.info("Shutting down Memoir API...")
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
app.include_router(routes.router, prefix="/api/entries", tags=["entries"])


@app.get("/")
def root():
    return {"message": "Welcome to Memoir API"}


@app.get("/health")
def health_check():
    return {"status": "healthy"}
