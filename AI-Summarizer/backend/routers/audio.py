"""
Audio router — TTS generation and file serving.
IMPORTANT: Static routes MUST be defined BEFORE parameterized routes.
"""
import os
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from services.tts_service import generate_audio, get_supported_languages

router = APIRouter()
AUDIO_DIR = os.getenv("AUDIO_OUTPUT_DIR", "audio")


class AudioRequest(BaseModel):
    text: str = Field(..., min_length=10, description="Text to convert to speech")
    language: str = Field(default="English", description="Language name e.g. 'Telugu', 'Hindi', 'English'")


# ── Static routes BEFORE parameterized ones ──────────────

@router.get("/audio/languages/list")
async def list_languages():
    """Return all supported TTS languages with voice info."""
    return {"success": True, "languages": get_supported_languages()}


@router.post("/audio")
async def create_audio(req: AudioRequest):
    """
    Generate audio (MP3) from text in the selected language.
    Automatically translates text to target language if non-English selected.
    """
    try:
        result = generate_audio(text=req.text, language=req.language)
        return {
            "success":    True,
            "filename":   result["filename"],
            "audio_url":  result["audio_url"],
            "language":   result["language"],
            "voice":      result["voice"],
            "translated": result["translated"],
            "char_count": result["char_count"],
        }
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Audio generation failed: {str(e)}")


# ── Parameterized route AFTER static routes ───────────────

@router.get("/audio/{filename}")
async def serve_audio(filename: str):
    """Stream a generated audio MP3 file."""
    # Sanitize — prevent path traversal
    safe_name = os.path.basename(filename)
    if not safe_name.endswith(".mp3"):
        raise HTTPException(status_code=400, detail="Invalid audio filename")

    filepath = os.path.join(AUDIO_DIR, safe_name)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Audio file not found")

    return FileResponse(
        path=filepath,
        media_type="audio/mpeg",
        filename=safe_name,
    )
