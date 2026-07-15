"""
Plagiarism and originality detection service.
Provides two modes:
1. Local Library Check: semantic similarity comparison via cloud embeddings or Python TF-IDF.
2. Global AI Check: analysis of style, paraphrase, and AI probability using Gemini.
"""
from __future__ import annotations
import os
import glob
import pickle
import json
import re
import numpy as np
from collections import Counter
from pathlib import Path
from dotenv import load_dotenv
import google.generativeai as genai  # type: ignore

load_dotenv(dotenv_path=Path(__file__).resolve().parent.parent / ".env")

STORAGE_DIR = os.getenv("CHROMA_DB_DIR", "chroma_db")
LOCAL_SIMILARITY_THRESHOLD = 0.70  # Cosine similarity above which text is flagged
_gemini_quota_exceeded = False

# ─────────────────────────────────────────────
# Embedding & TF-IDF Cosine Fallback Helpers
# ─────────────────────────────────────────────

_working_embedding_model = None

def _get_gemini_embeddings(texts: list[str], task_type: str = "retrieval_document") -> list[list[float]] | None:
    """Fetch dense embeddings from Gemini Cloud API (with model fallback)."""
    global _working_embedding_model
    api_key = os.getenv("GEMINI_API_KEY", "")
    if not api_key or api_key == "your_gemini_api_key_here":
        return None
    try:
        genai.configure(api_key=api_key)
        
        models_to_try = [_working_embedding_model] if _working_embedding_model else ["models/text-embedding-004", "models/gemini-embedding-001", "models/gemini-embedding-2"]
        
        for model in models_to_try:
            if not model:
                continue
            try:
                result = genai.embed_content(
                    model=model,
                    content=texts,
                    task_type=task_type
                )
                _working_embedding_model = model
                return result.get("embedding")
            except Exception as e:
                print(f"[Plagiarism Embedding] Embedding with {model} failed: {e}")
                if _working_embedding_model == model:
                    _working_embedding_model = None
        return None
    except Exception as e:
        print(f"[Plagiarism Embedding] Gemini cloud embedding failed: {e}")
        return None

def _tokenize(text: str) -> list[str]:
    """Tokenize string into lowercase alphanumeric words."""
    return re.findall(r"\b\w+\b", text.lower())

def _tfidf_similarity_batch(query_chunks: list[str], doc_chunks: list[str]) -> list[list[float]]:
    """
    Compute Cosine Similarity between a list of query chunks and a list of document chunks
    using an optimized batch TF-IDF implementation.
    Returns: 2D list where result[i][j] is similarity of query_chunks[i] with doc_chunks[j].
    """
    if not query_chunks or not doc_chunks:
        return [[0.0] * len(doc_chunks) for _ in query_chunks]

    # 1. Tokenize corpus & query
    doc_tokens = [_tokenize(doc) for doc in doc_chunks]
    query_tokens = [_tokenize(q) for q in query_chunks]
    
    # 2. Get unique terms across all documents to build vocabulary
    vocab = {}
    for tokens in doc_tokens:
        for t in tokens:
            if t not in vocab:
                vocab[t] = len(vocab)
                
    num_docs = len(doc_chunks)
    num_queries = len(query_chunks)
    vocab_size = len(vocab)
    
    if vocab_size == 0:
        return [[0.0] * len(doc_chunks) for _ in query_chunks]

    # 3. Compute IDF for the document corpus
    doc_freq = np.zeros(vocab_size)
    for tokens in doc_tokens:
        unique_tokens = set(tokens)
        for t in unique_tokens:
            if t in vocab:
                doc_freq[vocab[t]] += 1
                
    idf = np.log((1 + num_docs) / (1 + doc_freq)) + 1

    # 4. Vectorize document chunks into a TF-IDF matrix (shape: num_docs, vocab_size)
    doc_matrix = np.zeros((num_docs, vocab_size))
    for i, tokens in enumerate(doc_tokens):
        tf = Counter(tokens)
        for term, count in tf.items():
            if term in vocab:
                idx = vocab[term]
                doc_matrix[i, idx] = count * idf[idx]

    # Normalize document vectors
    doc_norms = np.linalg.norm(doc_matrix, axis=1, keepdims=True)
    doc_norms[doc_norms == 0] = 1e-10
    doc_matrix_normalized = doc_matrix / doc_norms

    # 5. Vectorize query chunks (shape: num_queries, vocab_size)
    query_matrix = np.zeros((num_queries, vocab_size))
    for i, tokens in enumerate(query_tokens):
        tf = Counter(tokens)
        for term, count in tf.items():
            if term in vocab:
                idx = vocab[term]
                query_matrix[i, idx] = count * idf[idx]

    # Normalize query vectors
    query_norms = np.linalg.norm(query_matrix, axis=1, keepdims=True)
    query_norms[query_norms == 0] = 1e-10
    query_matrix_normalized = query_matrix / query_norms

    # 6. Compute cosine similarities (shape: num_queries, num_docs)
    sim_matrix = query_matrix_normalized @ doc_matrix_normalized.T
    return sim_matrix.tolist()



def _chunk_text(text: str, chunk_size: int = 150, overlap: int = 30) -> list[str]:
    """Split text into sentences or small phrases for plagiarism check."""
    sentences = re.split(r"(?<=[.!?])\s+", text)
    chunks = []
    current_chunk = []
    current_words = 0

    for sentence in sentences:
        words = sentence.split()
        if not words:
            continue
        current_chunk.append(sentence)
        current_words += len(words)
        
        if current_words >= chunk_size:
            chunks.append(" ".join(current_chunk))
            current_chunk = current_chunk[-1:]
            current_words = len(current_chunk[0].split())
            
    if current_chunk:
        chunks.append(" ".join(current_chunk))
        
    return [c.strip() for c in chunks if c.strip()]

def check_plagiarism_local(text: str) -> dict:
    """
    Compare input text against all saved documents in the local database.
    """
    chunks = _chunk_text(text)
    if not chunks:
        return {
            "similarity_score": 0,
            "matched_sources": [],
            "flagged_passages": [],
            "verdict": "Text is too short to evaluate."
        }

    # Fetch Cloud Embeddings if possible
    chunk_embeddings = _get_gemini_embeddings(chunks, "retrieval_document")
    if chunk_embeddings:
        chunk_embeddings = np.array(chunk_embeddings)

    flagged_passages = []
    matched_sources_map = {}
    total_flagged_words = 0
    total_words = len(text.split())

    # Find all saved pkl files
    pkl_files = glob.glob(os.path.join(STORAGE_DIR, "*.pkl"))
    
    for file_path in pkl_files:
        try:
            with open(file_path, "rb") as f:
                doc = pickle.load(f)
            
            doc_name = doc.get("doc_name", "Unnamed Document")
            doc_chunks = doc.get("chunks", [])
            doc_embeddings = doc.get("embeddings")

            if len(doc_chunks) == 0:
                continue

            # Determine whether to use dense cosine sim or TF-IDF fallback
            use_dense = False
            if chunk_embeddings is not None and doc_embeddings is not None:
                doc_embeddings = np.array(doc_embeddings)
                # Check dimensional compatibility
                if len(chunk_embeddings.shape) == 2 and len(doc_embeddings.shape) == 2:
                    if chunk_embeddings.shape[1] == doc_embeddings.shape[1]:
                        use_dense = True

            if use_dense:
                # Compute batch cosine similarities for dense embeddings
                doc_norms = np.linalg.norm(doc_embeddings, axis=1, keepdims=True) + 1e-10
                m_norm = doc_embeddings / doc_norms
                
                chunk_norms = np.linalg.norm(chunk_embeddings, axis=1, keepdims=True) + 1e-10
                q_norm = chunk_embeddings / chunk_norms
                
                all_similarities = (q_norm @ m_norm.T).tolist()
            else:
                # Fallback to batch TF-IDF
                all_similarities = _tfidf_similarity_batch(chunks, doc_chunks)

            # Check similarity of each input chunk against this document
            for i, chunk_text in enumerate(chunks):
                similarities = all_similarities[i]
                max_sim = max(similarities)
                max_idx = similarities.index(max_sim)

                if max_sim >= LOCAL_SIMILARITY_THRESHOLD:
                    matched_passage = doc_chunks[max_idx]
                    
                    flagged_passages.append({
                        "text": chunk_text,
                        "source": doc_name,
                        "reason": f"Semantic match of {round(max_sim * 100, 1)}% with local library.",
                        "matched_text": matched_passage[:150] + "..." if len(matched_passage) > 150 else matched_passage
                    })

                    # Track source match stats
                    if doc_name not in matched_sources_map:
                        matched_sources_map[doc_name] = {
                            "title": doc_name,
                            "url": "",
                            "match_percentage": 0,
                            "match_count": 0
                        }
                    matched_sources_map[doc_name]["match_count"] += 1
                    matched_sources_map[doc_name]["match_percentage"] = max(
                        matched_sources_map[doc_name]["match_percentage"], 
                        int(max_sim * 100)
                    )
                    
                    # Estimate matching words
                    total_flagged_words += len(chunk_text.split())

        except Exception as e:
            print(f"[Plagiarism] Error reading {file_path}: {e}")

    # Calculate overall similarity score
    overall_score = min(100, int((total_flagged_words / max(1, total_words)) * 100))
    
    # Sort matched sources by highest match percentage
    matched_sources = list(matched_sources_map.values())
    matched_sources.sort(key=lambda x: x["match_percentage"], reverse=True)

    # Format verdict
    if overall_score == 0:
        verdict = "No similarity detected with documents in your local library. Content appears highly original locally."
    elif overall_score < 20:
        verdict = f"Low similarity ({overall_score}%) detected with local documents. Content is mostly original."
    elif overall_score < 50:
        verdict = f"Moderate similarity ({overall_score}%) detected. Some passages match files in your library."
    else:
        verdict = f"High similarity ({overall_score}%) detected. Significant portions match your local documents."

    return {
        "similarity_score": overall_score,
        "ai_percentage": 0,  # AI percentage is calculated only by global check
        "matched_sources": matched_sources,
        "flagged_passages": flagged_passages,
        "verdict": verdict
    }

def _clean_and_parse_json(text: str) -> dict:
    """Extract and parse JSON from raw text, removing markdown codeblocks if present."""
    text_clean = text.strip()
    if text_clean.startswith("```"):
        match = re.search(r"```(?:json)?\s*(.*?)\s*```", text_clean, re.DOTALL)
        if match:
            text_clean = match.group(1).strip()
    if not (text_clean.startswith("{") and text_clean.endswith("}")):
        match = re.search(r"(\{.*\})", text_clean, re.DOTALL)
        if match:
            text_clean = match.group(1).strip()
    return json.loads(text_clean)

def check_plagiarism_global(text: str) -> dict:
    """
    Evaluate text originality, style patterns, and AI content likelihood using Gemini.
    """
    api_key = os.getenv("GEMINI_API_KEY", "")
    if not api_key or api_key == "your_gemini_api_key_here":
        raise ValueError("GEMINI_API_KEY is not configured in your .env file.")

    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(os.getenv("GEMINI_MODEL", "gemini-3.1-flash-lite"))

        prompt = (
            "You are an expert system for plagiarism detection and originality analysis.\n"
            "Analyze the text below. Identify if it appears to be copied from external web/academic resources, "
            "heavily paraphrased, or generated by an AI assistant.\n\n"
            "Respond ONLY with a valid JSON object matching this schema. Do not include markdown codeblocks or other formatting outside the JSON.\n\n"
            "{\n"
            '  "similarity_score": <integer, overall percentage of copied/plagiarized text from 0 to 100>,\n'
            '  "ai_percentage": <integer, probability of being AI-generated from 0 to 100>,\n'
            '  "verdict": "<string, a summary verdict sentence describing the originality and AI likelihood of this text>",\n'
            '  "matched_sources": [\n'
            "    {\n"
            '      "title": "<string, title of the matching article/source>",\n'
            '      "url": "<string, URL if known, else empty>",\n'
            '      "match_percentage": <integer, similarity score from 0 to 100>,\n'
            '      "snippet": "<string, brief snippet of matching content from this source>"\n'
            "    }\n"
            "  ],\n"
            '  "flagged_passages": [\n'
            "    {\n"
            '      "text": "<string, the text from the input that is flagged as plagiarized or AI written>",\n'
            '      "source": "<string, name of the matching source or \'AI Generator\'>",\n'
            '      "reason": "<string, brief explanation of why this segment is flagged: e.g., direct copy, paraphrase, AI signature>"\n'
            "    }\n"
            "  ]\n"
            "}\n\n"
            f"Text to analyze:\n{text[:4000]}"
        )

        response = model.generate_content(
            prompt,
            generation_config={"response_mime_type": "application/json"}
        )
        
        result = _clean_and_parse_json(response.text)
        return result

    except Exception as e:
        raise RuntimeError(f"Global Plagiarism Check failed: {str(e)}")

def check_plagiarism_groq(text: str) -> dict:
    """
    Evaluate text originality, style patterns, and AI content likelihood using Groq (llama-3.3-70b-versatile).
    """
    api_key = os.getenv("GROQ_API_KEY", "")
    if not api_key or api_key == "your_groq_api_key_here":
        raise ValueError("GROQ_API_KEY is not configured in your .env file.")

    import requests

    prompt = (
        "You are an expert system for plagiarism detection and originality analysis.\n"
        "Analyze the text below. Identify if it appears to be copied from external web/academic resources, "
        "heavily paraphrased, or generated by an AI assistant.\n\n"
        "Respond ONLY with a valid JSON object matching this schema. Do not include markdown codeblocks or other formatting outside the JSON.\n\n"
        "{\n"
        '  "similarity_score": <integer, overall percentage of copied/plagiarized text from 0 to 100>,\n'
        '  "ai_percentage": <integer, probability of being AI-generated from 0 to 100>,\n'
        '  "verdict": "<string, a summary verdict sentence describing the originality and AI likelihood of this text>",\n'
        '  "matched_sources": [\n'
        "    {\n"
        '      "title": "<string, title of the matching article/source>",\n'
        '      "url": "<string, URL if known, else empty>",\n'
        '      "match_percentage": <integer, similarity score from 0 to 100>,\n'
        '      "snippet": "<string, brief snippet of matching content from this source>"\n'
        "    }\n"
        "  ],\n"
        '  "flagged_passages": [\n'
        "    {\n"
        '      "text": "<string, the text from the input that is flagged as plagiarized or AI written>",\n'
        '      "source": "<string, name of the matching source or \'AI Generator\'>",\n'
        '      "reason": "<string, brief explanation of why this segment is flagged: e.g., direct copy, paraphrase, AI signature>"\n'
        "    }\n"
        "  ]\n"
        "}\n\n"
        f"Text to analyze:\n{text[:4000]}"
    )

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": "llama-3.3-70b-versatile",
        "messages": [
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.2,
        "response_format": {"type": "json_object"}
    }

    try:
        url = "https://api.groq.com/openai/v1/chat/completions"
        response = requests.post(url, json=payload, headers=headers, timeout=30)
        response.raise_for_status()
        data = response.json()
        raw_text = data["choices"][0]["message"]["content"].strip()
        result = _clean_and_parse_json(raw_text)
        return result
    except Exception as e:
        raise RuntimeError(f"Global Plagiarism Check via Groq failed: {str(e)}")

def check_plagiarism(text: str, mode: str = "both") -> dict:
    """
    Main entry point for plagiarism check.
    Supports modes: "local", "global", "both"
    """
    if mode == "local":
        return check_plagiarism_local(text)
    
    # Run global check (Gemini with Groq fallback)
    global_res = None
    global_err = None
    global _gemini_quota_exceeded

    if mode in ("global", "both"):
        if not _gemini_quota_exceeded:
            try:
                global_res = check_plagiarism_global(text)
            except Exception as e:
                err_msg = str(e).lower()
                if "quota" in err_msg or "429" in err_msg or "resource_exhausted" in err_msg or "rate limit" in err_msg:
                    _gemini_quota_exceeded = True
                    print("[Plagiarism] Gemini key is out of quota. Bypassing Gemini to use Groq directly for future requests.")
                
                print(f"[Plagiarism] Gemini check failed: {e}. Trying Groq fallback...")
                try:
                    global_res = check_plagiarism_groq(text)
                except Exception as groq_err:
                    global_err = f"Gemini & Groq APIs failed (Gemini: {e}; Groq: {groq_err})"
                    print(f"[Plagiarism] Groq fallback failed: {groq_err}")
        else:
            # Skip Gemini entirely and use Groq directly
            try:
                global_res = check_plagiarism_groq(text)
            except Exception as groq_err:
                global_err = f"Groq API failed: {groq_err}"
                print(f"[Plagiarism] Groq check failed: {groq_err}")

    if mode == "global":
        if global_res:
            return global_res
        else:
            raise RuntimeError(f"Global check failed: {global_err}")

    # mode == "both"
    local_res = check_plagiarism_local(text)
    if global_res:
        # Combine the results
        combined_flagged = local_res["flagged_passages"] + global_res.get("flagged_passages", [])
        combined_sources = local_res["matched_sources"] + global_res.get("matched_sources", [])
        
        # Deduplicate sources by title
        seen_titles = set()
        dedup_sources = []
        for src in combined_sources:
            title = src.get("title")
            if title not in seen_titles:
                seen_titles.add(title)
                dedup_sources.append(src)

        similarity_score = max(local_res["similarity_score"], global_res.get("similarity_score", 0))
        ai_percentage = global_res.get("ai_percentage", 0)

        # Build a unified verdict
        verdict = (
            f"Global Check: {global_res.get('verdict', '')} "
            f"Local Check: {local_res['verdict']}"
        )

        return {
            "similarity_score": similarity_score,
            "ai_percentage": ai_percentage,
            "matched_sources": dedup_sources,
            "flagged_passages": combined_flagged,
            "verdict": verdict
        }
    else:
        # If the user requested global or both, and the global APIs failed,
        # we raise a clear error to avoid misleading "100% human / 0% AI" results.
        raise ValueError(
            "Originality analysis failed: The global scanning APIs (Gemini and Groq) are currently "
            "rate-limited or out of quota. Please wait a moment and try again."
        )

def humanize_text(text: str) -> str:
    """
    Rewrite AI-generated text to mimic natural human writing styles,
    bypassing AI detection while maintaining original meaning and facts.
    Uses Gemini with Groq fallback.
    """
    prompt = (
        "You are an expert editor and text humanizer.\n"
        "Your task is to rewrite the following AI-generated text so that it reads naturally as if written by an experienced human writer.\n"
        "Apply these instructions carefully:\n"
        "1. Vary sentence length and complexity (create natural sentence flow / burstiness).\n"
        "2. Use diverse vocabulary, idioms, and natural transition words (increase perplexity).\n"
        "3. Avoid robotic patterns, repetitive structures, and typical AI filler phrases.\n"
        "4. Do NOT change the facts, structure, or key arguments. Keep the original meaning intact.\n"
        "5. Output ONLY the rewritten humanized text. Do not include any introductory remarks, notes, conversational text, or markdown formatting outside the rephrased text.\n\n"
        f"AI Text to humanize:\n{text}"
    )

    # Try Gemini first
    try:
        api_key = os.getenv("GEMINI_API_KEY", "")
        if not api_key or api_key.startswith("your_"):
            raise ValueError("Gemini key not set")
            
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(os.getenv("GEMINI_MODEL", "gemini-3.1-flash-lite"))
        response = model.generate_content(prompt)
        humanized = response.text.strip()
        if humanized:
            return humanized
    except Exception as e:
        print(f"[Plagiarism Service] Gemini humanize failed: {e}. Trying Groq fallback...")

    # Fallback to Groq
    try:
        api_key = os.getenv("GROQ_API_KEY", "")
        if not api_key or api_key == "your_groq_api_key_here":
            raise ValueError("GROQ_API_KEY is not configured in your .env file.")

        import requests
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": "llama-3.3-70b-versatile",
            "messages": [
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.4
        }
        url = "https://api.groq.com/openai/v1/chat/completions"
        response = requests.post(url, json=payload, headers=headers, timeout=45)
        response.raise_for_status()
        data = response.json()
        humanized = data["choices"][0]["message"]["content"].strip()
        if humanized:
            return humanized
    except Exception as groq_err:
        print(f"[Plagiarism Service] Groq humanize failed: {groq_err}")
        # Fallback: return original text when both services fail
        print("[Plagiarism Service] Both Gemini and Groq failed; returning original text.")
        return text
