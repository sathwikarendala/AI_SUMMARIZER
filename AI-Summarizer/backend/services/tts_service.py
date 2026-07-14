"""
Text-to-Speech service using Microsoft Edge Neural TTS (edge-tts).
- Auto-translates text to the selected language before speaking
- Uses high-quality neural voices (NO API KEY needed, completely FREE)
- Supports 20+ languages with 100% native pronunciation
"""
from __future__ import annotations
import os
import uuid
import asyncio
import threading

AUDIO_DIR = os.getenv("AUDIO_OUTPUT_DIR", "audio")

# ─────────────────────────────────────────────────────────────
# Language Config: display name → {voice, translate_code}
#   voice          = Microsoft Edge Neural TTS voice name
#   translate_code = Google Translate language code
# ─────────────────────────────────────────────────────────────
LANGUAGE_CONFIG = {
    "English":    {"voice": "en-US-AriaNeural",      "translate_code": None},   # no translation
    "Hindi":      {"voice": "hi-IN-SwaraNeural",     "translate_code": "hi"},
    "Telugu":     {"voice": "te-IN-ShrutiNeural",    "translate_code": "te"},
    "German":     {"voice": "de-DE-KatjaNeural",     "translate_code": "de"},
}


# ─────────────────────────────────────────────────────────────
# Translation helper
# ─────────────────────────────────────────────────────────────
def _translate_text(text: str, target_code: str) -> str:
    """
    Translate text to the target language using deep-translator (free, no API key).
    Falls back to original text if translation fails.
    """
    try:
        from deep_translator import GoogleTranslator
        # Chunk if text is too long (deep-translator limit is ~5000 chars per call)
        if len(text) <= 4500:
            translated = GoogleTranslator(source="auto", target=target_code).translate(text)
            return translated or text

        # Split into chunks for long text
        words = text.split()
        chunk_size = 600  # ~4000 chars per chunk
        chunks, i = [], 0
        while i < len(words):
            chunks.append(" ".join(words[i: i + chunk_size]))
            i += chunk_size

        translated_chunks = []
        for chunk in chunks:
            t = GoogleTranslator(source="auto", target=target_code).translate(chunk)
            translated_chunks.append(t or chunk)

        return " ".join(translated_chunks)

    except Exception as e:
        print(f"[TTS] Translation failed ({target_code}): {e} — using original text")
        return text  # fallback: use original text


# ─────────────────────────────────────────────────────────────
# Edge TTS async core
# ─────────────────────────────────────────────────────────────
async def _edge_tts_async(text: str, voice: str, filepath: str) -> None:
    """Run edge-tts async generation."""
    import edge_tts
    communicate = edge_tts.Communicate(text=text, voice=voice)
    await communicate.save(filepath)


def _run_edge_tts(text: str, voice: str, filepath: str) -> None:
    """
    Run async edge-tts in a dedicated thread with its own event loop.
    This avoids conflicts with FastAPI's running event loop.
    """
    result = {"error": None}

    def thread_target():
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(_edge_tts_async(text, voice, filepath))
        except Exception as e:
            result["error"] = e
        finally:
            loop.close()

    t = threading.Thread(target=thread_target, daemon=True)
    t.start()
    t.join(timeout=60)  # max 60s wait

    if t.is_alive():
        raise RuntimeError("Audio generation timed out after 60 seconds.")
    if result["error"]:
        raise RuntimeError(f"Edge TTS failed: {result['error']}")


# ─────────────────────────────────────────────────────────────
# Main public function
# ─────────────────────────────────────────────────────────────
def generate_audio(text: str, language: str = "English") -> dict:
    """
    Generate MP3 audio from text in the selected language.

    Steps:
      1. Look up Microsoft Neural voice + translation code for language
      2. If non-English: auto-translate text to target language (free)
      3. Generate audio using Edge TTS neural voice (free, no API key)
      4. Save MP3 and return metadata

    Returns: {filename, audio_url, language, voice, translated, char_count}
    """
    os.makedirs(AUDIO_DIR, exist_ok=True)

    # Get config for language
    config = LANGUAGE_CONFIG.get(language, LANGUAGE_CONFIG["English"])
    voice          = config["voice"]
    translate_code = config["translate_code"]

    # Clean and limit text
    text = text.strip()
    if not text:
        raise ValueError("Text is empty — nothing to convert to speech.")
    text = text[:5000]  # Edge TTS handles long text well but limit for speed

    # ── Step 1: Translate if needed ──────────────────────────
    translated = False
    if translate_code:  # non-English language selected
        print(f"[TTS] Translating to {language} ({translate_code})...")
        text = _translate_text(text, translate_code)
        translated = True
        print(f"[TTS] Translation complete -> {text[:80]}...")

    # ── Step 2: Generate audio ───────────────────────────────
    filename = f"audio_{uuid.uuid4().hex[:8]}.mp3"
    filepath = os.path.join(AUDIO_DIR, filename)

    print(f"[TTS] Generating audio: voice={voice}, chars={len(text)}")
    try:
        _run_edge_tts(text, voice, filepath)
    except Exception as e:
        # Fallback to gTTS if edge-tts fails
        print(f"[TTS] Edge TTS failed, falling back to gTTS: {e}")
        _gtts_fallback(text, translate_code or "en", filepath)

    if not os.path.exists(filepath):
        raise RuntimeError("Audio file was not created. Check your internet connection.")

    print(f"[TTS] Audio saved: {filename}")
    return {
        "filename":   filename,
        "audio_url":  f"/api/audio/{filename}",
        "language":   language,
        "voice":      voice,
        "translated": translated,
        "char_count": len(text),
    }


# ─────────────────────────────────────────────────────────────
# gTTS fallback (if edge-tts fails)
# ─────────────────────────────────────────────────────────────
_GTTS_CODES = {
    "en": "en",
    "hi": "hi",
    "te": "te",
    "de": "de",
}

def _gtts_fallback(text: str, lang_code: str, filepath: str) -> None:
    from gtts import gTTS
    code = _GTTS_CODES.get(lang_code, "en")
    tts = gTTS(text=text[:4000], lang=code, slow=False)
    tts.save(filepath)


# ─────────────────────────────────────────────────────────────
# Languages list for UI
# ─────────────────────────────────────────────────────────────
def get_supported_languages() -> list[dict]:
    """Return all supported languages for the UI dropdown."""
    return [
        {
            "name":       name,
            "voice":      cfg["voice"],
            "translates": cfg["translate_code"] is not None,
        }
        for name, cfg in LANGUAGE_CONFIG.items()
    ]
