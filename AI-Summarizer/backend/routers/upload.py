import os
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import Optional
from services.file_parser import parse_file
from services.summarizer import summarize_text
from database.db import SessionLocal, SummaryHistory

router = APIRouter()

MAX_FILE_SIZE = int(os.getenv("MAX_FILE_SIZE_MB", 50)) * 1024 * 1024  # bytes


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    model_name: str = Form(default="auto"),
    length_mode: str = Form(default="medium"),
    bullet_points: bool = Form(default=False),
    summarize: bool = Form(default=True),
    save_to_history: bool = Form(default=True),
    language: str = Form(default="English"),
):
    """Upload a PDF, DOCX, or TXT file, extract text, and optionally summarize."""
    # Validate file size
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Max size: {MAX_FILE_SIZE // (1024*1024)}MB"
        )

    # Validate file type
    allowed_types = {
        "application/pdf", "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "text/plain",
    }
    allowed_exts = {".pdf", ".docx", ".doc", ".txt"}
    import pathlib
    ext = pathlib.Path(file.filename or "").suffix.lower()
    if ext not in allowed_exts:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type '{ext}'. Allowed: PDF, DOCX, TXT"
        )

    try:
        # Save file to uploads folder
        upload_dir = os.getenv("UPLOAD_DIR", "uploads")
        os.makedirs(upload_dir, exist_ok=True)
        file_path = os.path.join(upload_dir, file.filename)
        with open(file_path, "wb") as f:
            f.write(contents)

        # Parse file
        parsed = parse_file(contents, file.filename)
        result = {
            "success": True,
            "filename": file.filename,
            "text": parsed["text"],
            "word_count": parsed["word_count"],
            "char_count": parsed["char_count"],
            "page_count": parsed.get("page_count"),
            "file_type": parsed["file_type"],
        }

        # Summarize if requested
        if summarize:
            use_gemini = model_name == "gemini-pro"
            summary_result = summarize_text(
                text=parsed["text"],
                model_name=model_name,
                length_mode=length_mode,
                bullet_points=bullet_points,
                use_gemini=use_gemini,
                language=language,
            )
            result.update(summary_result)

            # Save to history
            if save_to_history:
                db = SessionLocal()
                try:
                    entry = SummaryHistory(
                        source_type="file",
                        source_name=file.filename,
                        text_preview=parsed["text"][:300],
                        summary=summary_result["summary"],
                        model_used=summary_result["model_used"],
                        language=language,
                        length_mode=length_mode,
                        original_words=summary_result["original_words"],
                        summary_words=summary_result["summary_words"],
                        reduction_pct=summary_result["reduction_pct"],
                    )
                    db.add(entry)
                    db.commit()
                    db.refresh(entry)
                    result["history_id"] = entry.id
                finally:
                    db.close()

        return result

    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"File processing failed: {str(e)}")
