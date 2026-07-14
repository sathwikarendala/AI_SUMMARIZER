from __future__ import annotations
"""
File parsing service for PDF, DOCX, and TXT uploads.
"""
import io
import chardet
from pathlib import Path


def parse_pdf(file_bytes: bytes) -> tuple[str, int]:
    """Extract text and count pages from a PDF file using pdfplumber."""
    import importlib
    from typing import Any
    pdfplumber: Any = importlib.import_module("pdfplumber")
    text_parts = []
    page_count = 0
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        page_count = len(pdf.pages)
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text_parts.append(page_text)
    return "\n\n".join(text_parts), page_count


def parse_docx(file_bytes: bytes) -> str:
    """Extract text from a DOCX file using python-docx."""
    import importlib
    from typing import Any
    docx: Any = importlib.import_module("docx")
    doc = docx.Document(io.BytesIO(file_bytes))
    paragraphs = [para.text for para in doc.paragraphs if para.text.strip()]
    return "\n\n".join(paragraphs)


def parse_txt(file_bytes: bytes) -> str:
    """Detect encoding and decode a plain text file."""
    detected = chardet.detect(file_bytes)
    encoding = detected.get("encoding") or "utf-8"
    return file_bytes.decode(encoding, errors="replace")


def parse_file(file_bytes: bytes, filename: str) -> dict:
    """
    Route to the correct parser based on file extension.
    Returns: {text, page_count (if PDF), word_count, char_count}
    """
    ext = Path(filename).suffix.lower()
    page_count = None

    if ext == ".pdf":
        text, page_count = parse_pdf(file_bytes)
    elif ext in (".docx", ".doc"):
        text = parse_docx(file_bytes)
    elif ext == ".txt":
        text = parse_txt(file_bytes)
    else:
        raise ValueError(f"Unsupported file type: '{ext}'. Use PDF, DOCX, or TXT.")

    # Clean up whitespace
    import re
    lines = [re.sub(r"[ \t]+", " ", line).strip() for line in text.splitlines()]
    text = "\n".join(lines)
    text = re.sub(r"\n{3,}", "\n\n", text).strip()

    if not text:
        raise ValueError("No text could be extracted from the file.")

    word_count = len(text.split())
    char_count = len(text)

    return {
        "text": text,
        "word_count": word_count,
        "char_count": char_count,
        "page_count": page_count,
        "file_type": ext.lstrip("."),
    }
