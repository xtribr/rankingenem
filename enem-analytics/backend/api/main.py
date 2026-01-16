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
import pandas as pd
from pathlib import Path

from api.routes import schools, predictions, diagnosis, clusters, recommendations, tri_lists, gliner_insights, contact, oracle
from api.auth import router as auth_router
from api.admin import router as admin_router
from database.config import engine
from database.models import Base
from data.duckdb_store import init_database as init_duckdb

# Global data store
data_store = {}


def load_data():
    """Load ENEM data from CSV into memory with pre-computed aggregations"""
    data_path = Path(__file__).parent.parent / "data" / "enem_2018_2024_completo.csv"

    df = pd.read_csv(data_path)

    # Clean and prepare data
    df["codigo_inep"] = df["codigo_inep"].astype(str)
    df["ano"] = df["ano"].astype(int)

    # Extract state code from INEP (first 2 digits)
    df["uf_code"] = df["codigo_inep"].str[:2]

    # Map UF codes to state names
    uf_map = {
        "11": "RO", "12": "AC", "13": "AM", "14": "RR", "15": "PA",
        "16": "AP", "17": "TO", "21": "MA", "22": "PI", "23": "CE",
        "24": "RN", "25": "PB", "26": "PE", "27": "AL", "28": "SE",
        "29": "BA", "31": "MG", "32": "ES", "33": "RJ", "35": "SP",
        "41": "PR", "42": "SC", "43": "RS", "50": "MS", "51": "MT",
        "52": "GO", "53": "DF"
    }
    df["uf"] = df["uf_code"].map(uf_map)

    # Pre-compute anos_participacao for each school (PERFORMANCE OPTIMIZATION)
    anos_participacao = df.groupby("codigo_inep")["ano"].nunique().reset_index()
    anos_participacao.columns = ["codigo_inep", "anos_participacao"]
    df = df.merge(anos_participacao, on="codigo_inep", how="left")

    return df


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load data and initialize database on startup"""
    # Create database tables (if database is configured)
    if engine:
        print("Initializing database...")
        Base.metadata.create_all(bind=engine)
        print("Database ready")
    else:
        print("Database not configured (DATABASE_URL not set)")

    # Initialize DuckDB for fast school queries
    print("Initializing DuckDB...")
    init_duckdb()

    # Load ENEM data (Pandas - for legacy endpoints that still need it)
    print("Loading ENEM data (Pandas)...")
    data_store["df"] = load_data()
    print(f"Loaded {len(data_store['df']):,} records")
    print(f"Years: {sorted(data_store['df']['ano'].unique())}")
    print(f"Schools: {data_store['df']['codigo_inep'].nunique():,}")
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
async def get_stats():
    """Get general statistics"""
    df = data_store["df"]

    return {
        "total_records": len(df),
        "total_schools": df["codigo_inep"].nunique(),
        "years": sorted(df["ano"].unique().tolist()),
        "states": sorted(df["uf"].dropna().unique().tolist()),
        "avg_scores": {
            "nota_cn": round(df["nota_cn"].mean(), 2),
            "nota_ch": round(df["nota_ch"].mean(), 2),
            "nota_lc": round(df["nota_lc"].mean(), 2),
            "nota_mt": round(df["nota_mt"].mean(), 2),
            "nota_redacao": round(df["nota_redacao"].mean(), 2),
        }
    }


def get_dataframe():
    """Get the loaded dataframe"""
    return data_store.get("df")


def get_latest_year_df():
    """Get pre-filtered DataFrame for the most recent year (cached for performance)"""
    if "df_latest_year" not in data_store:
        df = data_store.get("df")
        if df is not None:
            latest_year = int(df["ano"].max())
            data_store["df_latest_year"] = df[df["ano"] == latest_year].copy()
            data_store["latest_year"] = latest_year
    return data_store.get("df_latest_year"), data_store.get("latest_year")
