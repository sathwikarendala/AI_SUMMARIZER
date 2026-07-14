from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
import traceback
from services.summarizer import summarize_text
from database.db import SessionLocal, SummaryHistory

router = APIRouter()


class SummarizeRequest(BaseModel):
    text: str = Field(..., min_length=30, description="Text to summarize (min 30 chars)")
    model_name: str = Field(default="auto")
    length_mode: str = Field(default="medium", pattern="^(short|medium|detailed)$")
    bullet_points: bool = Field(default=False)
    save_to_history: bool = Field(default=True)
    language: str = Field(default="en")


@router.post("/summarize")
async def summarize(req: SummarizeRequest):
    """Summarize raw text input."""
    try:
        use_gemini = req.model_name == "gemini-pro"
        result = summarize_text(
            text=req.text,
            model_name=req.model_name,
            length_mode=req.length_mode,
            bullet_points=req.bullet_points,
            use_gemini=use_gemini,
            language=req.language,
        )

        # Save to history
        if req.save_to_history:
            db = SessionLocal()
            try:
                entry = SummaryHistory(
                    source_type="text",
                    text_preview=req.text[:300],
                    summary=result["summary"],
                    model_used=result["model_used"],
                    language=req.language,
                    length_mode=req.length_mode,
                    original_words=result["original_words"],
                    summary_words=result["summary_words"],
                    reduction_pct=result["reduction_pct"],
                )
                db.add(entry)
                db.commit()
                db.refresh(entry)
                result["history_id"] = entry.id
            finally:
                db.close()

        return {"success": True, **result}

    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    except RuntimeError as e:
        error_msg = str(e)
        print(f"[ERROR] /summarize RuntimeError: {error_msg}")
        traceback.print_exc()
        raise HTTPException(
            status_code=503,
            detail=(
                f"{error_msg} | "
                "TIP: Configure your GEMINI_API_KEY in the .env file to enable high-speed cloud summarization."
            )
        )

    except Exception as e:
        print(f"[ERROR] /summarize unexpected: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Summarization failed: {str(e)}")
