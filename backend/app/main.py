"""
Application entrypoint.

Run with: uvicorn app.main:app --reload --port 8000
"""
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.v1.router import api_router
from app.core.config import get_settings
from app.core.database import close_mysql_connection, connect_to_mysql
from app.core.exceptions import register_exception_handlers
from app.core.qdrant import connect_to_qdrant

logging.basicConfig(level=logging.INFO)
settings = get_settings()

# Ensure upload directories exist at startup
os.makedirs("data/uploads/chat", exist_ok=True)
os.makedirs("data/uploads/documents", exist_ok=True)
os.makedirs("data/uploads/avatars", exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_to_mysql()
    connect_to_qdrant()  # logs a warning and no-ops if QDRANT_URL isn't set yet
    yield
    await close_mysql_connection()


app = FastAPI(
    title=settings.APP_NAME,
    version="2.0.0",
    description="TrueShift — AI-powered workforce attendance, leave, analytics and HR platform",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_exception_handlers(app)
app.include_router(api_router)

# Serve uploaded files (chat attachments, documents)
app.mount("/uploads", StaticFiles(directory="data/uploads"), name="uploads")


@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "ok", "service": settings.APP_NAME, "version": "2.0.0", "environment": settings.ENVIRONMENT}
