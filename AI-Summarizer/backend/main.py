import os
import sys
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
from dotenv import load_dotenv
import uvicorn

# Load environment variables
load_dotenv(dotenv_path=Path(__file__).resolve().parent / ".env")

# Ensure routers & services are importable
sys.path.insert(0, str(Path(__file__).parent))

from database.db import engine, Base
from routers import summarize, upload, keywords, audio, chat, history, plagiarism, text_processor

# ─────────────────────────────────────────────
# Startup / Shutdown lifecycle
# ─────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create DB tables on startup
    Base.metadata.create_all(bind=engine)
    upload_dir = os.getenv("UPLOAD_DIR", "uploads")
    audio_dir = os.getenv("AUDIO_OUTPUT_DIR", "audio")
    chroma_db_dir = os.getenv("CHROMA_DB_DIR", "chroma_db")
    for d in [upload_dir, audio_dir, chroma_db_dir]:
        os.makedirs(d, exist_ok=True)
    # Download NLTK data for KeyBERT/RAKE
    try:
        import nltk
        nltk.download("stopwords", quiet=True)
        nltk.download("punkt", quiet=True)
        nltk.download("punkt_tab", quiet=True)
    except Exception:
        pass

    # Log cloud RAG engine status on startup
    print("[Startup] RAG engine initialized with Google Gemini cloud embeddings (text-embedding-004)")



    print("[SUCCESS] AI Text Summarizer API started successfully")
    yield
    print("[INFO] API shutting down")


# ─────────────────────────────────────────────
# FastAPI App
# ─────────────────────────────────────────────
app = FastAPI(
    title="AI Text Summarizer API",
    description="A comprehensive AI-powered text summarization platform with keyword extraction, audio, RAG chat, and more.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow all origins (configure for production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────
# API Routers
# ─────────────────────────────────────────────
app.include_router(summarize.router, prefix="/api", tags=["Summarize"])
app.include_router(upload.router,    prefix="/api", tags=["Upload"])
app.include_router(keywords.router,  prefix="/api", tags=["Keywords & NLP"])
app.include_router(audio.router,     prefix="/api", tags=["Audio TTS"])
app.include_router(chat.router,      prefix="/api", tags=["Chat with AI"])
app.include_router(history.router,   prefix="/api", tags=["History"])
app.include_router(plagiarism.router,prefix="/api", tags=["Plagiarism Check"])
app.include_router(text_processor.router, prefix="/api", tags=["Text Processor"])



@app.get("/api/health", tags=["Health"])
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "message": "AI Text Summarizer API is running 🚀",
        "version": "1.0.0",
    }


# ─────────────────────────────────────────────
# Serve Frontend (static files)
# ─────────────────────────────────────────────
frontend_dist_dir = Path(__file__).parent.parent / "frontend" / "dist"
frontend_legacy_dir = Path(__file__).parent.parent / "frontend_legacy"

if frontend_dist_dir.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dist_dir), html=True), name="static")
elif frontend_legacy_dir.exists():
    app.mount("/", StaticFiles(directory=str(frontend_legacy_dir), html=True), name="static")
else:
    @app.get("/")
    async def root():
        return {"message": "Frontend not found. Run from project root."}


# ─────────────────────────────────────────────
# Entry point
# ─────────────────────────────────────────────
if __name__ == "__main__":
    host = os.getenv("HOST", "127.0.0.1")
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=False,        # Disabled — causes CancelledError on Python 3.13
        log_level="info",
        lifespan="on",
    )
