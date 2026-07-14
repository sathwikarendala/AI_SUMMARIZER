from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from services.text_processor_service import analyze_text

router = APIRouter(prefix="/text-processor", tags=["Text Processor"])

class AnalyzeRequest(BaseModel):
    text: str = Field(..., min_length=10, description="Text content to process and analyze")

@router.post("/analyze")
async def analyze_endpoint(req: AnalyzeRequest):
    """
    Run Text Processor analysis on input text.
    Evaluates Grammar, Readability, Style, Tone, and Vocabulary.
    """
    try:
        results = analyze_text(req.text)
        return {
            "success": True,
            "results": results
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Text analysis failed: {str(e)}")
