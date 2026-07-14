from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
from services.keyword_extractor import (
    extract_keywords,
    analyze_sentiment,
    detect_topics,
    generate_questions,
    highlight_sentences,
)

router = APIRouter()


class TextRequest(BaseModel):
    text: str = Field(..., min_length=20)
    top_n: Optional[int] = Field(default=15, ge=1, le=30)


@router.post("/keywords")
async def get_keywords(req: TextRequest):
    """Extract keywords and keyphrases from text."""
    try:
        keywords = extract_keywords(req.text, top_n=req.top_n)
        highlights = highlight_sentences(req.text, top_n=5)
        return {
            "success": True,
            "keywords": keywords,
            "highlighted_sentences": highlights,
            "total": len(keywords),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Keyword extraction failed: {str(e)}")


@router.post("/sentiment")
async def get_sentiment(req: TextRequest):
    """Analyze sentiment of the text."""
    try:
        result = analyze_sentiment(req.text)
        return {"success": True, **result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sentiment analysis failed: {str(e)}")


@router.post("/topics")
async def get_topics(req: TextRequest):
    """Detect topics in the text using zero-shot classification."""
    try:
        topics = detect_topics(req.text, top_n=req.top_n or 10)
        return {"success": True, "topics": topics}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Topic detection failed: {str(e)}")


@router.post("/questions")
async def get_questions(req: TextRequest):
    """Generate questions from the text."""
    try:
        questions = generate_questions(req.text, num_questions=req.top_n or 5)
        return {"success": True, "questions": questions}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Question generation failed: {str(e)}")


@router.post("/analyze")
async def full_analysis(req: TextRequest):
    """Run all NLP analysis in one request: keywords, sentiment, topics, questions."""
    try:
        keywords = extract_keywords(req.text, top_n=15)
        sentiment = analyze_sentiment(req.text)
        topics = detect_topics(req.text, top_n=10)
        highlights = highlight_sentences(req.text, top_n=5)
        return {
            "success": True,
            "keywords": keywords,
            "sentiment": sentiment,
            "topics": topics,
            "highlighted_sentences": highlights,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")
