"""
api/index.py — FastAPI app for Vercel serverless deployment.
Vercel's @vercel/python runtime supports ASGI natively — no Mangum needed.
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.auth import router as auth_router
from routes.vault import router as vault_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Only auto-create tables in local development.
    # In production, run migrations separately — don't do DDL on every cold start.
    if os.getenv("ENVIRONMENT", "development") == "development":
        from database import create_tables
        try:
            create_tables()
        except Exception as e:
            print(f"Warning: Could not create tables: {e}")
    yield

app = FastAPI(
    title="Cipheria API",
    description="Secure serverless password manager backend",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

# CORS — restrict to your frontend domain in production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_origin_regex=r"https://.*\.vercel\.app|chrome-extension://.*|moz-extension://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth_router, prefix="/api")
app.include_router(vault_router, prefix="/api")

@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "cipheria-api"}
