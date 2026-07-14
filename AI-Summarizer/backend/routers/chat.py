import asyncio
import os
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from pydantic import BaseModel
from services.file_parser import parse_file
from services.rag_service import index_document, query_document, delete_session

router = APIRouter()

class ChatRequest(BaseModel):
    session_id: str
    query: str
    top_k: int = 4

@router.post("/chat/upload")
async def chat_upload(file: UploadFile = File(...)):
    """
    Upload a PDF and index it for RAG-based chat.
    Returns session_id to use in /api/chat/query.
    """
    try:
        contents = await file.read()

        # Validate file type
        import pathlib
        ext = pathlib.Path(file.filename or "").suffix.lower()
        if ext != ".pdf":
            raise HTTPException(
                status_code=415,
                detail=f"Unsupported file type '{ext}'. Allowed: PDF only for RAG chat."
            )

        # Save file to uploads folder
        upload_dir = os.getenv("UPLOAD_DIR", "uploads")
        os.makedirs(upload_dir, exist_ok=True)
        file_path = os.path.join(upload_dir, file.filename)
        with open(file_path, "wb") as f:
            f.write(contents)

        # Parse text
        parsed = parse_file(contents, file.filename)

        # Index document using asyncio.to_thread to offload CPU-bound embedding computations
        index_result = await asyncio.to_thread(
            index_document,
            parsed["text"],
            file.filename
        )

        return {
            "success": True,
            "session_id": index_result["session_id"],
            "filename": index_result["doc_name"],
            "chunk_count": index_result["chunk_count"],
            "word_count": parsed["word_count"],
            "page_count": parsed.get("page_count", 1),
            "message": f"Document indexed! Ask questions using session_id: {index_result['session_id']}",
        }

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Document indexing failed: {str(e)}")


@router.post("/chat/query")
async def chat_query(req: ChatRequest):
    """Answer a question about an indexed document using RAG."""
    try:
        result = await asyncio.to_thread(
            query_document,
            req.query,
            req.session_id,
            req.top_k
        )
        return {"success": True, **result}

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query failed: {str(e)}")


@router.delete("/chat/session/{session_id}")
async def delete_chat_session(session_id: str):
    """Delete a chat session and its vector index pickle file."""
    deleted = await asyncio.to_thread(delete_session, session_id)
    return {"success": deleted, "session_id": session_id}
