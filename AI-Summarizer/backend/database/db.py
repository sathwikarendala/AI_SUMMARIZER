from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, Float
from sqlalchemy.orm import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
import os

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./summarizer.db")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# ─────────────────────────────────────────────
# Models
# ─────────────────────────────────────────────
class SummaryHistory(Base):
    __tablename__ = "summary_history"

    id = Column(Integer, primary_key=True, index=True)
    source_type = Column(String(50), default="text")          # text | file | youtube | webpage
    source_name = Column(String(255), nullable=True)          # filename or URL
    text_preview = Column(Text, nullable=True)                # first 300 chars of input
    summary = Column(Text, nullable=False)
    model_used = Column(String(100), default="facebook/bart-large-cnn")
    language = Column(String(50), default="en")
    length_mode = Column(String(20), default="medium")
    original_words = Column(Integer, default=0)
    summary_words = Column(Integer, default=0)
    reduction_pct = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)


# ─────────────────────────────────────────────
# Dependency
# ─────────────────────────────────────────────
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
