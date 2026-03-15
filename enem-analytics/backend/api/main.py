"""
ENEM Analytics API
FastAPI backend for ENEM school data analysis and predictions
"""

# Load environment variables first
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from api.routes import schools, predictions, diagnosis, clusters, recommendations, tri_lists, gliner_insights, contact, oracle
from api.auth import router as auth_router
from api.admin import router as admin_router
from data.supabase_store import init_database as init_supabase

# Global data store (kept for legacy compatibility)
data_store = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize Supabase connection on startup"""
    print("Connecting to Supabase...")
    init_supabase()
    print("Supabase ready")
    yield
    data_store.clear()


app = FastAPI(
    title="ENEM Analytics API",
    description="API para análise de dados do ENEM por escola",
    version="1.0.0",
    lifespan=lifespan
)

# CORS - explicit origins required when using credentials
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://escolas.xtri.online",
        "https://www.xtriescolas.app",
        "https://xtriescolas.app",
        "https://www.xtriprovas.app",
        "https://xtriprovas.app",
        "https://frontend-alpha-ten-weodp2t3hu.vercel.app",
        "https://rankingenem.com",
        "https://www.rankingenem.com",
        "https://app.rankingenem.com",
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    allow_origin_regex=r"https://(frontend-.*\.vercel\.app|xtri-provas\.vercel\.app)",
)

# Include routers
app.include_router(auth_router, tags=["Authentication"])
app.include_router(admin_router, tags=["Admin"])
app.include_router(schools.router, prefix="/api/schools", tags=["Schools"])
app.include_router(predictions.router)
app.include_router(diagnosis.router)
app.include_router(clusters.router)
app.include_router(recommendations.router)
app.include_router(tri_lists.router)
app.include_router(gliner_insights.router, prefix="/api/gliner", tags=["GLiNER Insights"])
app.include_router(contact.router)
app.include_router(oracle.router, tags=["Oracle"])


@app.get("/")
async def root():
    return {
        "name": "ENEM Analytics API",
        "version": "1.0.0",
        "endpoints": {
            "schools": "/api/schools",
            "docs": "/docs"
        }
    }


@app.get("/health")
async def health():
    """Health check endpoint for Railway"""
    return {"status": "healthy", "service": "enem-analytics-api"}


@app.get("/api/stats")
async def get_stats_endpoint():
    """Get general statistics"""
    from data.supabase_store import get_stats
    return get_stats()
