"""CertAI Backend — FastAPI Application

Adaptive AI-powered certification exam prep platform.
This is the main entry point that configures middleware and mounts all route modules.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config import CORS_ORIGINS

from routes.auth_routes import router as auth_router
from routes.exam_routes import router as exam_router
from routes.progress_routes import router as progress_router
from routes.certification_routes import router as cert_router

app = FastAPI(
    title="CertAI API",
    description="Adaptive AI certification exam platform",
    version="1.0.0",
)

# CORS configuration for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount route modules
app.include_router(auth_router)
app.include_router(exam_router)
app.include_router(progress_router)
app.include_router(cert_router)


@app.get("/health")
async def health_check():
    """Health check endpoint for monitoring."""
    return {"status": "healthy", "version": "1.0.0"}
