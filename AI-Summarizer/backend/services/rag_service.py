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
import google.generativeai as genai  # type: ignore

# Load env variables
load_dotenv()

# Configuration
STORAGE_DIR = os.getenv("CHROMA_DB_DIR", "chroma_db")
EMBED_MODEL = "all-MiniLM-L6-v2"
TOP_K = 4


_working_embedding_model = None

def _get_embeddings_gemini(texts: list[str]) -> tuple[np.ndarray, str]:
    """Computes dense document embeddings using Gemini API (with model fallback)."""
    if not _has_valid_gemini_key():
        raise ValueError("GEMINI_API_KEY is not set or is invalid in .env.")
    
    genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
    
    global _working_embedding_model
    models_to_try = [_working_embedding_model] if _working_embedding_model else ["models/text-embedding-004", "models/gemini-embedding-001", "models/gemini-embedding-2"]
    
    last_err = None
    for model in models_to_try:
        if not model:
            continue
        try:
            response = genai.embed_content(
                model=model,
                content=texts,
                task_type="retrieval_document"
            )
            _working_embedding_model = model
            return np.array(response["embedding"], dtype=np.float32), model
        except Exception as e:
            last_err = e
            print(f"[RAG Embedding] Embedding with {model} failed: {e}")
            if _working_embedding_model == model:
                _working_embedding_model = None
                
    raise RuntimeError(f"Failed to generate document embeddings via Gemini: {last_err}")


def _get_query_embedding_gemini(query: str, model_name: str = "models/text-embedding-004") -> np.ndarray:
    """Computes a query embedding using Gemini API."""
    if not _has_valid_gemini_key():
        raise ValueError("GEMINI_API_KEY is not set or is invalid in .env.")
        
    genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
    
    try:
        response = genai.embed_content(
            model=model_name,
            content=query,
            task_type="retrieval_query"
        )
        return np.array(response["embedding"], dtype=np.float32)
    except Exception as e:
        raise RuntimeError(f"Failed to generate query embedding via Gemini ({model_name}): {e}")


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
    """Chunks the text, computes dense embeddings via Gemini API, and saves them to a pickle database."""
    os.makedirs(STORAGE_DIR, exist_ok=True)

    chunks = _chunk_text(text)
    if not chunks:
        raise ValueError("Document produced no chunks after splitting.")

    # Compute cloud embeddings and retrieve the working model used
    embeddings, model_name = _get_embeddings_gemini(chunks)

    session_id = uuid.uuid4().hex[:12]
    payload = {
        "session_id": session_id,
        "doc_name":   doc_name,
        "chunks":     chunks,
        "embeddings": embeddings,      # numpy ndarray
        "model_name": model_name,      # track which model was used
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
    embeddings = payload["embeddings"]  # shape: (N, dim)

    # Determine which model was used to index this document
    model_name = payload.get("model_name")
    if not model_name:
        dim = embeddings.shape[1] if len(embeddings.shape) > 1 else 768
        if dim == 3072:
            model_name = "models/gemini-embedding-001"
        else:
            model_name = "models/text-embedding-004"

    q_vec = _get_query_embedding_gemini(question, model_name=model_name) # shape: (dim,)

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
