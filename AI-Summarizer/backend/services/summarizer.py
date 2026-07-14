"""
Summarization service using Hugging Face Transformers (BART/T5/Pegasus)
with optional Gemini API for multilingual summarization.
"""
from __future__ import annotations
import os
import re
from typing import Any, Optional
from pathlib import Path
from dotenv import load_dotenv
load_dotenv(dotenv_path=Path(__file__).resolve().parent.parent / ".env")

# ─────────────────────────────────────────────
# Lazy-loaded models (avoids slow startup)
# ─────────────────────────────────────────────
_models: dict = {}


def _get_model_and_tokenizer(model_name: str):
    if model_name in _models:
        return _models[model_name]
    try:
        from transformers import AutoTokenizer, AutoModelForSeq2SeqLM  # type: ignore
        import torch  # type: ignore

        device = "cuda" if torch.cuda.is_available() else "cpu"
        print(f"Loading tokenizer & model: {model_name} (device={device})...")
        
        tokenizer = AutoTokenizer.from_pretrained(model_name)
        model = AutoModelForSeq2SeqLM.from_pretrained(model_name).to(device)
        
        print(f"Model and tokenizer loaded successfully: {model_name}")
        _models[model_name] = (model, tokenizer, device)
        return model, tokenizer, device
    except Exception as e:
        raise RuntimeError(f"Failed to load model '{model_name}': {e}")


def _is_t5_model(model_name: str) -> bool:
    """T5-based models need 'summarize: ' prefix to activate summarization task."""
    return "t5" in model_name.lower()


# ─────────────────────────────────────────────
# Text helpers
# ─────────────────────────────────────────────
def _chunk_text(text: str, max_words: int = 400) -> list[str]:
    """Split text into overlapping chunks of ~max_words words."""
    words = text.split()
    if len(words) <= max_words:
        return [text]
    overlap = max_words // 10
    chunks, i = [], 0
    while i < len(words):
        chunk = words[i: i + max_words]
        chunks.append(" ".join(chunk))
        i += max_words - overlap
        if i >= len(words):
            break
    return chunks


def _clean_text(text: str) -> str:
    """Remove excessive whitespace and non-printable chars."""
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"[^\x20-\x7E\n]", " ", text)
    return text.strip()


# ─────────────────────────────────────────────
# Length configuration
# ─────────────────────────────────────────────
LENGTH_CONFIG = {
    "short":    {"ratio": 0.15, "max_abs": 70,  "min_abs": 25},
    "medium":   {"ratio": 0.35, "max_abs": 150, "min_abs": 60},
    "detailed": {"ratio": 0.60, "max_abs": 350, "min_abs": 120},
}


def _compute_lengths(word_count: int, mode: str) -> tuple[int, int]:
    cfg = LENGTH_CONFIG.get(mode, LENGTH_CONFIG["medium"])
    max_len = max(cfg["min_abs"], min(int(word_count * cfg["ratio"]), cfg["max_abs"]))
    min_len = max(20, int(max_len * 0.5))
    return max_len, min_len


# ─────────────────────────────────────────────
# Local summarization (BART / T5 / Pegasus)
# ─────────────────────────────────────────────
ENGLISH_STOP_WORDS = {
    "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are", "aren't", "as", "at",
    "be", "because", "been", "before", "being", "below", "between", "both", "but", "by", "can't", "cannot", "could",
    "couldn't", "did", "didn't", "do", "does", "doesn't", "doing", "don't", "down", "during", "each", "few", "for",
    "from", "further", "had", "hadn't", "has", "hasn't", "have", "haven't", "having", "he", "he'd", "he'll", "he's",
    "her", "here", "here's", "hers", "herself", "him", "himself", "his", "how", "how's", "i", "i'd", "i'll", "i'm",
    "i've", "if", "in", "into", "is", "isn't", "it", "it's", "its", "itself", "let's", "me", "more", "most", "mustn't",
    "my", "myself", "no", "nor", "not", "of", "off", "on", "once", "only", "or", "other", "ought", "our", "ours",
    "ourselves", "out", "over", "own", "same", "shan't", "she", "she'd", "she'll", "she's", "should", "shouldn't",
    "so", "some", "such", "than", "that", "that's", "the", "their", "theirs", "them", "themselves", "then", "there",
    "there's", "these", "they", "they'd", "they'll", "they're", "they've", "this", "those", "through", "to", "too",
    "under", "until", "up", "very", "was", "wasn't", "we", "we'd", "we'll", "we're", "we've", "were", "weren't",
    "what", "what's", "when", "when's", "where", "where's", "which", "while", "who", "who's", "whom", "why", "why's",
    "with", "won't", "would", "wouldn't", "you", "you'd", "you'll", "you're", "you've", "your", "yours", "yourself",
    "yourselves"
}

def split_sentences(text: str) -> list[str]:
    """Helper to split text into clean sentences."""
    # Simple regex to split text into sentences, handling standard punctuation and abbreviations
    sentence_endings = re.compile(r'(?<!\w\.\w.)(?<![A-Z][a-z]\.)(?<=\.|\?|!)\s')
    return [s.strip() for s in sentence_endings.split(text) if s.strip()]


def summarize_local(
    text: str,
    model_name: str = "extractive-local",
    length_mode: str = "medium",
    bullet_points: bool = False,
) -> dict:
    """
    Summarize text using an ultra-fast, local sentence-ranking extractive algorithm.
    Runs in milliseconds, does not load any heavy deep learning models, and requires no API keys.
    """
    text_clean = _clean_text(text)
    word_count = len(text_clean.split())

    # Very short text — return as-is
    if word_count < 30:
        return {
            "summary":        text_clean,
            "original_words": word_count,
            "summary_words":  word_count,
            "reduction_pct":  0.0,
            "model_used":     "extractive-local",
            "length_mode":    length_mode,
        }

    sentences = split_sentences(text_clean)
    if not sentences:
        return {
            "summary":        text_clean,
            "original_words": word_count,
            "summary_words":  word_count,
            "reduction_pct":  0.0,
            "model_used":     "extractive-local",
            "length_mode":    length_mode,
        }

    # Count word frequencies in text
    words = re.findall(r'\b\w+\b', text_clean.lower())
    word_freq = {}
    for w in words:
        if w not in ENGLISH_STOP_WORDS and len(w) > 2:
            word_freq[w] = word_freq.get(w, 0) + 1

    # Score sentences based on word frequency
    scored_sentences = []
    for idx, sent in enumerate(sentences):
        sent_words = re.findall(r'\b\w+\b', sent.lower())
        if not sent_words:
            continue
        score = sum(word_freq.get(w, 0) for w in sent_words if w in word_freq)
        normalized_score = score / (len(sent_words) ** 0.5) if len(sent_words) > 0 else 0
        scored_sentences.append((normalized_score, idx, sent))

    if not scored_sentences:
        summary = " ".join(sentences[:3])
    else:
        # Sort sentences by score descending
        scored_sentences.sort(key=lambda x: x[0], reverse=True)

        # Determine target number of sentences to keep
        total_sents = len(sentences)
        if length_mode == "short":
            num_to_keep = max(2, min(4, int(total_sents * 0.15)))
        elif length_mode == "detailed":
            num_to_keep = max(6, min(15, int(total_sents * 0.50)))
        else: # medium
            num_to_keep = max(3, min(8, int(total_sents * 0.30)))

        # Take the top N scoring sentences and sort them back to original chronological order
        top_sents = scored_sentences[:num_to_keep]
        top_sents.sort(key=lambda x: x[1])
        summary = " ".join([item[2] for item in top_sents])

    # Format as bullet points if requested
    if bullet_points:
        sentences_list = split_sentences(summary)
        summary = "\n".join(f"• {s}" for s in sentences_list)

    sw = len(summary.split())
    return {
        "summary":        summary,
        "original_words": word_count,
        "summary_words":  sw,
        "reduction_pct":  round((1 - sw / max(word_count, 1)) * 100, 1),
        "model_used":     "extractive-local",
        "length_mode":    length_mode,
    }


# ─────────────────────────────────────────────
# Gemini summarization (multilingual)
# ─────────────────────────────────────────────
def summarize_gemini(
    text: str,
    length_mode: str = "medium",
    bullet_points: bool = False,
    language: str = "en",
) -> dict:
    """Summarize using Google Gemini API."""
    api_key = os.getenv("GEMINI_API_KEY", "")
    if not api_key or api_key == "your_gemini_api_key_here":
        raise ValueError("GEMINI_API_KEY is not set in your .env file.")

    model_name = os.getenv("GEMINI_MODEL", "gemini-3.1-flash-lite")
    try:
        import google.generativeai as genai  # type: ignore
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(model_name)

        if length_mode == "medium":
            # Generate the short summary first
            short_res = summarize_gemini(text, length_mode="short", bullet_points=bullet_points, language=language)
            short_summary = short_res["summary"]
            
            bullet_instr = "Format the summary as bullet points.\n" if bullet_points else ""
            lang_names = {
                "en": "English", "english": "English",
                "hi": "Hindi", "hindi": "Hindi",
                "te": "Telugu", "telugu": "Telugu",
                "de": "German", "german": "German"
            }
            lang_lower = language.lower().strip()
            target_lang_name = lang_names.get(lang_lower, language)
            lang_instr = f"Respond in {target_lang_name} language.\n" if lang_lower != "en" else ""
            
            prompt = (
                f"You are an expert summarizer.\n"
                f"Your task is to take the provided Short Summary and expand it into a Medium Summary (approximately 35% of the original text's length) using details and context from the Original Text.\n"
                f"Crucially, the Medium Summary must incorporate or build directly upon the content of the Short Summary, extending it with more context, details, and explanation.\n"
                f"{bullet_instr.strip()}\n"
                f"{lang_instr.strip()}\n\n"
                f"Short Summary:\n{short_summary}\n\n"
                f"Original Text:\n{text[:25000]}\n\n"
                f"Medium Summary:"
            )
            response = model.generate_content(prompt)
            summary  = response.text.strip()
            
        elif length_mode == "detailed":
            # Generate the medium summary first (which builds on the short summary)
            medium_res = summarize_gemini(text, length_mode="medium", bullet_points=bullet_points, language=language)
            medium_summary = medium_res["summary"]
            
            bullet_instr = "Format the summary as bullet points.\n" if bullet_points else ""
            lang_names = {
                "en": "English", "english": "English",
                "hi": "Hindi", "hindi": "Hindi",
                "te": "Telugu", "telugu": "Telugu",
                "de": "German", "german": "German"
            }
            lang_lower = language.lower().strip()
            target_lang_name = lang_names.get(lang_lower, language)
            lang_instr = f"Respond in {target_lang_name} language.\n" if lang_lower != "en" else ""
            
            prompt = (
                f"You are an expert summarizer.\n"
                f"Your task is to take the provided Medium Summary and expand it into a Detailed Summary (approximately 60% of the original text's length) using details and deep conceptual information from the Original Text.\n"
                f"Crucially, the Detailed Summary must incorporate and build directly upon the content of the Medium Summary, adding conceptual depth, explanation, and key nuances from the Original Text.\n"
                f"{bullet_instr.strip()}\n"
                f"{lang_instr.strip()}\n\n"
                f"Medium Summary:\n{medium_summary}\n\n"
                f"Original Text:\n{text[:20000]}\n\n"
                f"Detailed Summary:"
            )
            response = model.generate_content(prompt)
            summary  = response.text.strip()
            
        else: # short
            ratio_label  = "15%"
            bullet_instr = "Format the summary as bullet points.\n" if bullet_points else ""
            
            lang_names = {
                "en": "English", "english": "English",
                "hi": "Hindi", "hindi": "Hindi",
                "te": "Telugu", "telugu": "Telugu",
                "de": "German", "german": "German"
            }
            lang_lower = language.lower().strip()
            target_lang_name = lang_names.get(lang_lower, language)
            lang_instr = f"Respond in {target_lang_name} language.\n" if lang_lower != "en" else ""

            mode_instr = (
                "Extract the core matter in a simple, clear, and easily understandable way for the user from the given text."
            )

            prompt = (
                f"Please summarize the following text based on these instructions:\n"
                f"1. Length: Approximately {ratio_label} of the original length.\n"
                f"2. Goal: {mode_instr}\n"
                f"{f'3. {bullet_instr.strip()}' if bullet_points else ''}\n"
                f"{f'4. Language: {lang_instr.strip()}' if lang_lower != 'en' else ''}\n\n"
                f"Text:\n{text[:30000]}\n\nSummary:"
            )

            response = model.generate_content(prompt)
            summary  = response.text.strip()

    except Exception as e:
        raise RuntimeError(f"Gemini API error: {str(e)}")

    word_count = len(text.split())
    sw = len(summary.split())
    return {
        "summary":        summary,
        "original_words": word_count,
        "summary_words":  sw,
        "reduction_pct":  round((1 - sw / max(word_count, 1)) * 100, 1),
        "model_used":     model_name,
        "length_mode":    length_mode,
    }


# ─────────────────────────────────────────────
# Groq summarization (Llama 3.3 70B)
# ─────────────────────────────────────────────
def summarize_groq(
    text: str,
    length_mode: str = "medium",
    bullet_points: bool = False,
    language: str = "en",
) -> dict:
    """Summarize using Groq API (Llama 3.3 70B)."""
    api_key = os.getenv("GROQ_API_KEY", "")
    if not api_key or api_key == "your_groq_api_key_here":
        raise ValueError("GROQ_API_KEY is not set in your .env file.")

    import requests

    if length_mode == "medium":
        # Generate the short summary first
        short_res = summarize_groq(text, length_mode="short", bullet_points=bullet_points, language=language)
        short_summary = short_res["summary"]
        
        bullet_instr = "Format the summary as bullet points.\n" if bullet_points else ""
        lang_names = {
            "en": "English", "english": "English",
            "hi": "Hindi", "hindi": "Hindi",
            "te": "Telugu", "telugu": "Telugu",
            "de": "German", "german": "German"
        }
        lang_lower = language.lower().strip()
        target_lang_name = lang_names.get(lang_lower, language)
        lang_instr = f"Respond in {target_lang_name} language.\n" if lang_lower != "en" else ""
        
        prompt = (
            f"You are an expert summarizer.\n"
            f"Your task is to take the provided Short Summary and expand it into a Medium Summary (approximately 35% of the original text's length) using details and context from the Original Text.\n"
            f"Crucially, the Medium Summary must incorporate or build directly upon the content of the Short Summary, extending it with more context, details, and explanation.\n"
            f"{bullet_instr.strip()}\n"
            f"{lang_instr.strip()}\n\n"
            f"Short Summary:\n{short_summary}\n\n"
            f"Original Text:\n{text[:25000]}\n\n"
            f"Medium Summary:"
        )
        
    elif length_mode == "detailed":
        # Generate the medium summary first (which builds on the short summary)
        medium_res = summarize_groq(text, length_mode="medium", bullet_points=bullet_points, language=language)
        medium_summary = medium_res["summary"]
        
        bullet_instr = "Format the summary as bullet points.\n" if bullet_points else ""
        lang_names = {
            "en": "English", "english": "English",
            "hi": "Hindi", "hindi": "Hindi",
            "te": "Telugu", "telugu": "Telugu",
            "de": "German", "german": "German"
        }
        lang_lower = language.lower().strip()
        target_lang_name = lang_names.get(lang_lower, language)
        lang_instr = f"Respond in {target_lang_name} language.\n" if lang_lower != "en" else ""
        
        prompt = (
            f"You are an expert summarizer.\n"
            f"Your task is to take the provided Medium Summary and expand it into a Detailed Summary (approximately 60% of the original text's length) using details and deep conceptual information from the Original Text.\n"
            f"Crucially, the Detailed Summary must incorporate and build directly upon the content of the Medium Summary, adding conceptual depth, explanation, and key nuances from the Original Text.\n"
            f"{bullet_instr.strip()}\n"
            f"{lang_instr.strip()}\n\n"
            f"Medium Summary:\n{medium_summary}\n\n"
            f"Original Text:\n{text[:20000]}\n\n"
            f"Detailed Summary:"
        )
        
    else: # short
        ratio_label  = "15%"
        bullet_instr = "Format the summary as bullet points.\n" if bullet_points else ""
        
        lang_names = {
            "en": "English", "english": "English",
            "hi": "Hindi", "hindi": "Hindi",
            "te": "Telugu", "telugu": "Telugu",
            "de": "German", "german": "German"
        }
        lang_lower = language.lower().strip()
        target_lang_name = lang_names.get(lang_lower, language)
        lang_instr = f"Respond in {target_lang_name} language.\n" if lang_lower != "en" else ""

        mode_instr = (
            "Extract the core matter in a simple, clear, and easily understandable way for the user from the given text."
        )

        prompt = (
            f"Please summarize the following text based on these instructions:\n"
            f"1. Length: Approximately {ratio_label} of the original length.\n"
            f"2. Goal: {mode_instr}\n"
            f"{f'3. {bullet_instr.strip()}' if bullet_points else ''}\n"
            f"{f'4. Language: {lang_instr.strip()}' if lang_lower != 'en' else ''}\n\n"
            f"Text:\n{text[:30000]}\n\nSummary:"
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
        "temperature": 0.3
    }

    try:
        url = "https://api.groq.com/openai/v1/chat/completions"
        response = requests.post(url, json=payload, headers=headers, timeout=30)
        response.raise_for_status()
        data = response.json()
        summary = data["choices"][0]["message"]["content"].strip()
    except Exception as e:
        raise RuntimeError(f"Groq API error: {str(e)}")

    word_count = len(text.split())
    sw = len(summary.split())
    return {
        "summary":        summary,
        "original_words": word_count,
        "summary_words":  sw,
        "reduction_pct":  round((1 - sw / max(word_count, 1)) * 100, 1),
        "model_used":     "llama-3.3-70b-versatile (Groq)",
        "length_mode":    length_mode,
    }


# ─────────────────────────────────────────────
# Smart Hybrid model
# ─────────────────────────────────────────────
def summarize_hybrid(
    text: str,
    length_mode: str = "medium",
    bullet_points: bool = False,
    language: str = "en",
) -> dict:
    """Smart Hybrid model that auto-selects the best available API with local fallback."""
    gemini_key = os.getenv("GEMINI_API_KEY", "")
    groq_key = os.getenv("GROQ_API_KEY", "")

    has_gemini = bool(gemini_key) and not gemini_key.startswith("your_") and len(gemini_key) > 10
    has_groq = bool(groq_key) and not groq_key.startswith("your_") and len(groq_key) > 10

    if has_gemini:
        try:
            res = summarize_gemini(text, length_mode, bullet_points, language)
            res["model_used"] += " (Smart Hybrid)"
            return res
        except Exception as e:
            print(f"[Hybrid] Gemini failed: {e}. Trying Groq fallback...")
            if has_groq:
                try:
                    res = summarize_groq(text, length_mode, bullet_points, language)
                    res["model_used"] += " (Smart Hybrid - Gemini Fallback)"
                    return res
                except Exception as groq_err:
                    print(f"[Hybrid] Groq fallback also failed: {groq_err}. Falling back to local offline model...")
            else:
                print(f"[Hybrid] No Groq API key configured. Falling back to local offline model...")
            
            res = summarize_local(text, "extractive-local", length_mode, bullet_points)
            res["model_used"] = "extractive-local (Offline Fallback)"
            return res
    elif has_groq:
        try:
            res = summarize_groq(text, length_mode, bullet_points, language)
            res["model_used"] += " (Smart Hybrid)"
            return res
        except Exception as groq_err:
            print(f"[Hybrid] Groq failed: {groq_err}. Falling back to local offline model...")
            res = summarize_local(text, "extractive-local", length_mode, bullet_points)
            res["model_used"] = "extractive-local (Offline Fallback)"
            return res
    else:
        print("[Hybrid] No API keys configured in .env. Falling back to local offline model...")
        res = summarize_local(text, "extractive-local", length_mode, bullet_points)
        res["model_used"] = "extractive-local (Offline Fallback)"
        return res


# ─────────────────────────────────────────────
# Main entry point
# ─────────────────────────────────────────────
def summarize_text(
    text: str,
    model_name: str = "auto",
    length_mode: str = "medium",
    bullet_points: bool = False,
    use_gemini: bool = False,
    language: str = "en",
) -> dict:
    """Route to extractive summarizer, Gemini, Groq, or Hybrid based on parameters."""
    # Default to extractive local if auto is requested for maximum speed and offline support
    if model_name == "auto":
        model_name = "extractive-local"

    lang_map = {
        "en": "en", "english": "en",
        "hi": "hi", "hindi": "hi",
        "te": "te", "telugu": "te",
        "de": "de", "german": "de"
    }
    target_code = lang_map.get(language.lower().strip(), "en")

    if model_name == "extractive-local":
        res = summarize_local(text, model_name, length_mode, bullet_points)
    elif model_name == "hybrid-cloud":
        res = summarize_hybrid(text, length_mode, bullet_points, target_code)
    elif model_name == "groq":
        res = summarize_groq(text, length_mode, bullet_points, target_code)
    elif use_gemini or model_name == "gemini-pro":
        res = summarize_gemini(text, length_mode, bullet_points, target_code)
    else:
        res = summarize_local(text, model_name, length_mode, bullet_points)

    # Translate local summary to the desired target language if not English
    if target_code != "en" and not (model_name in ("hybrid-cloud", "groq", "gemini-pro") or use_gemini) and res.get("summary"):
        print(f"[Summarizer] Translating local summary to target language '{target_code}'...")
        try:
            from deep_translator import GoogleTranslator  # type: ignore
            original_summary = res["summary"]
            # Handle bullet point formatting translation cleanly
            if bullet_points and "\n" in original_summary:
                lines = [line.strip().lstrip("• ") for line in original_summary.split("\n") if line.strip()]
                translated_lines = []
                for line in lines:
                    t_line = GoogleTranslator(source="en", target=target_code).translate(line)
                    translated_lines.append(f"• {t_line or line}")
                translated_summary = "\n".join(translated_lines)
            else:
                translated_summary = GoogleTranslator(source="en", target=target_code).translate(original_summary)

            if translated_summary:
                res["summary"] = translated_summary
                res["summary_words"] = len(translated_summary.split())
                res["reduction_pct"] = round((1 - res["summary_words"] / max(res["original_words"], 1)) * 100, 1)
        except Exception as e:
            print(f"[Summarizer] Translation of local summary failed: {e}")

    return res
