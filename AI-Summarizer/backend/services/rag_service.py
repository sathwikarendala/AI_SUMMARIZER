"""
RAG (Retrieval-Augmented Generation) service.
Uses numpy + pickle for vector storage — NO C++ compiler required.
Replaces ChromaDB with a lightweight pure-Python approach.
"""
from __future__ import annotations
import os
import uuid
import pickle
import numpy as np
from pathlib import Path
from dotenv import load_dotenv

# Load env variables
load_dotenv()

# Configuration
STORAGE_DIR = os.getenv("CHROMA_DB_DIR", "chroma_db")
EMBED_MODEL = "all-MiniLM-L6-v2"
TOP_K = 4

# Global cached embedding model
_embed_model = None

def _get_embedder():
    """Lazy loads or returns the SentenceTransformer embedding model."""
    global _embed_model
    if _embed_model is None:
        # pyrefly: ignore [missing-import]
        from sentence_transformers import SentenceTransformer
        print(f"[RAG] Loading embedding model: {EMBED_MODEL}...")
        _embed_model = SentenceTransformer(EMBED_MODEL)
        print("[RAG] Embedding model loaded")
    return _embed_model


def _chunk_text(text: str, chunk_size: int = 600, overlap: int = 150) -> list[str]:
    """Split text into overlapping character chunks cleanly on sentence boundaries where possible."""
    if not text:
        return []
    
    words = text.split()
    chunks = []
    
    # Simple word count based chunking
    i = 0
    while i < len(words):
        chunk_words = words[i:i + chunk_size]
        chunks.append(" ".join(chunk_words))
        i += (chunk_size - overlap)
        
    return [c.strip() for c in chunks if len(c.strip()) > 10]


def index_document(text: str, doc_name: str = "document") -> dict:
    """Chunks the text, computes dense embeddings locally, and saves them to a pickle database."""
    os.makedirs(STORAGE_DIR, exist_ok=True)

    chunks = _chunk_text(text)
    if not chunks:
        raise ValueError("Document produced no chunks after splitting.")

    embedder = _get_embedder()
    # Compute embeddings (shape: N, 384)
    embeddings = embedder.encode(chunks, show_progress_bar=False)

    session_id = uuid.uuid4().hex[:12]
    payload = {
        "session_id": session_id,
        "doc_name":   doc_name,
        "chunks":     chunks,
        "embeddings": embeddings,      # numpy ndarray
    }

    save_path = os.path.join(STORAGE_DIR, f"{session_id}.pkl")
    with open(save_path, "wb") as f:
        pickle.dump(payload, f)

    return {
        "session_id":  session_id,
        "collection_name": session_id,
        "chunk_count": len(chunks),
        "doc_name":    doc_name,
    }


def _has_valid_gemini_key() -> bool:
    key = os.getenv("GEMINI_API_KEY", "").strip()
    return bool(key) and not key.startswith("your_") and len(key) > 10




def query_document(question: str, session_id: str, top_k: int = TOP_K) -> dict:
    """Retrieves context chunks using cosine similarity, and synthesizes an answer via LLM."""
    save_path = os.path.join(STORAGE_DIR, f"{session_id}.pkl")
    if not os.path.exists(save_path):
        raise ValueError(f"No active session found for session ID: {session_id}")

    # Load session database
    with open(save_path, "rb") as f:
        payload = pickle.load(f)

    chunks = payload["chunks"]
    embeddings = payload["embeddings"]  # shape: (N, 384)

    embedder = _get_embedder()
    q_vec = embedder.encode([question], show_progress_bar=False)[0] # shape: (384,)

    # Compute cosine similarities manually: dot(A, B) / (norm(A) * norm(B))
    norms = np.linalg.norm(embeddings, axis=1)
    q_norm = np.linalg.norm(q_vec)
    
    if q_norm == 0 or np.any(norms == 0):
        similarities = np.zeros(len(chunks))
    else:
        similarities = np.dot(embeddings, q_vec) / (norms * q_norm)

    # Get top_k indices sorted descending
    top_indices = np.argsort(similarities)[::-1][:top_k]

    sources = []
    context_parts = []
    for idx in top_indices:
        score = float(similarities[idx])
        if score > 0.05:  # filter completely irrelevant chunks
            sources.append({
                "index": int(idx),
                "text": chunks[idx],
                "score": score
            })
            context_parts.append(chunks[idx])

    if not context_parts:
        return {
            "answer": "I couldn't find any relevant sections in the document to answer your question.",
            "sources": []
        }

    context = "\n\n---\n\n".join(context_parts)
    answer = _generate_answer_gemini(question, context)

    return {
        "answer": answer,
        "sources": sources
    }


def _generate_answer_gemini(question: str, context: str) -> str:
    """Orchestrates Gemini text generation for RAG without fallbacks."""
    if not _has_valid_gemini_key():
        raise ValueError("GEMINI_API_KEY is not configured or is invalid.")

    try:
        import importlib
        from typing import Any
        genai: Any = importlib.import_module("google.generativeai")
        genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
        
        prompt = (
            "You are a helpful reading assistant. Use ONLY the following document excerpts to answer the question. "
            "If the document does not contain the answer, say that you don't know based on the provided context.\n\n"
            f"CONTEXT:\n{context}\n\n"
            f"QUESTION: {question}\n\n"
            "ANSWER:"
        )

        model = genai.GenerativeModel(os.getenv("GEMINI_MODEL", "gemini-3.1-flash-lite"))
        response = model.generate_content(prompt)
        return response.text.strip()

    except Exception as e:
        print(f"[RAG] Gemini failed: {e}")
        raise RuntimeError(f"Gemini API error: {str(e)}")





def delete_session(session_id: str) -> bool:
    """Deletes the pickle index file associated with the session ID."""
    save_path = os.path.join(STORAGE_DIR, f"{session_id}.pkl")
    if os.path.exists(save_path):
        try:
            os.remove(save_path)
            return True
        except Exception as e:
            print(f"[RAG] Error deleting index file {save_path}: {e}")
            return False
    return False
