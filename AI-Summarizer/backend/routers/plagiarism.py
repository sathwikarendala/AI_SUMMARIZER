import os
from fastapi import APIRouter, File, UploadFile, Form, HTTPException
from typing import Optional
from pydantic import BaseModel, Field
import traceback
from services.file_parser import parse_file
from services.plagiarism_service import check_plagiarism, humanize_text

router = APIRouter(prefix="/plagiarism", tags=["Plagiarism & Originality"])

@router.post("/check")
async def check_plagiarism_endpoint(
    text: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    mode: str = Form("both")
):
    """
    Check text or uploaded file for plagiarism and originality.
    - **text**: Raw text to analyze (for pasted text).
    - **file**: Document (PDF, DOCX, TXT) to extract and analyze.
    - **mode**: Check mode ('local', 'global', or 'both').
    """
    if mode not in ("local", "global", "both"):
        raise HTTPException(status_code=400, detail="Invalid check mode. Choose 'local', 'global', or 'both'.")

    target_text = ""
    filename = None
    
    try:
        # 1. Parse File if provided
        if file is not None and file.filename:
            contents = await file.read()
            if not contents:
                raise HTTPException(status_code=400, detail="Uploaded file is empty.")
                
            allowed_exts = {".pdf", ".docx", ".doc", ".txt"}
            import pathlib
            ext = pathlib.Path(file.filename).suffix.lower()
            if ext not in allowed_exts:
                raise HTTPException(
                    status_code=415,
                    detail=f"Unsupported file type '{ext}'. Allowed: PDF, DOCX, TXT"
                )
            
            # Save file to uploads folder
            upload_dir = os.getenv("UPLOAD_DIR", "uploads")
            os.makedirs(upload_dir, exist_ok=True)
            file_path = os.path.join(upload_dir, file.filename)
            with open(file_path, "wb") as f:
                f.write(contents)

            parsed = parse_file(contents, file.filename)
            target_text = parsed["text"]
            filename = file.filename
        
        # 2. Otherwise use pasted text
        elif text:
            target_text = text.strip()
        
        # 3. Validation
        if not target_text:
            raise HTTPException(
                status_code=400, 
                detail="Please provide text in the box or upload a valid document."
            )
            
        word_count = len(target_text.split())
        if word_count < 10:
            raise HTTPException(
                status_code=400,
                detail=f"Text is too short for plagiarism analysis. Please provide at least 10 words (currently {word_count})."
            )
        if word_count > 10000:
            raise HTTPException(
                status_code=400,
                detail=f"Text is too long for plagiarism analysis. Maximum limit is 10000 words (currently {word_count})."
            )

        # 4. Perform check
        results = check_plagiarism(target_text, mode=mode)
        
        # Add basic stats to the response
        results.update({
            "success": True,
            "filename": filename,
            "word_count": word_count,
            "char_count": len(target_text),
            "text_preview": target_text[:300] + "..." if len(target_text) > 300 else target_text,
            "full_text": target_text,
            "mode": mode
        })
        
        return results

    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except HTTPException as e:
        raise e
    except Exception as e:
        print(f"[ERROR] /api/plagiarism/check unexpected: {str(e)}")
        traceback.print_exc()
        raise HTTPException(
            status_code=500, 
            detail=f"Plagiarism checking failed: {str(e)}"
        )

class HumanizeRequest(BaseModel):
    text: str = Field(..., description="AI text content to humanize")

@router.post("/humanize")
async def humanize_endpoint(req: HumanizeRequest):
    """
    Rewrite AI-generated text to human-styled text.
    """
    if not req.text or len(req.text.strip()) < 50:
        raise HTTPException(
            status_code=400,
            detail="Please provide at least 50 characters of text to humanize."
        )
    
    try:
        result = humanize_text(req.text)
        return {
            "success": True,
            "humanized_text": result
        }
    except Exception as e:
        print(f"[ERROR] /api/plagiarism/humanize failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Text humanization failed: {str(e)}"
        )
