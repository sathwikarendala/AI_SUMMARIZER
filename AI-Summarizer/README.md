# AI Text Summarizer 🤖

> A full-stack, AI-powered text summarization platform with **PDF upload**, **keyword extraction**, **audio output**, **multilingual support**, and **Chat with AI (RAG)**.

🔗 **Live Website Demo:** [https://ai-summarizer-three-gamma.vercel.app/](https://ai-summarizer-three-gamma.vercel.app/)  
🔗 **Live Backend API Docs:** [https://ai-summarizer-backend-isog.onrender.com/docs](https://ai-summarizer-backend-isog.onrender.com/docs)

![Stack](https://img.shields.io/badge/Stack-FastAPI%20%2B%20HTML%2FCSS%2FJS-7c3aed?style=flat-square)
![Models](https://img.shields.io/badge/Models-BART%20%7C%20T5%20%7C%20Gemini-06b6d4?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-10b981?style=flat-square)

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| ⚡ **Text Summarization** | Paste any text → AI generates a concise summary |
| 📄 **File Upload** | Support for PDF, DOCX, TXT with text extraction |
| 🔍 **Keyword Extraction** | KeyBERT + RAKE for key phrase detection |
| 💭 **Sentiment Analysis** | DistilBERT-powered positive/negative/neutral detection |
| 📌 **Topic Detection** | Zero-shot classification across 15 topics |
| ❓ **Question Generation** | Auto-generate comprehension questions |
| 🔊 **Audio TTS** | Text-to-speech in 20+ languages (gTTS + pyttsx3) |
| ▶️ **YouTube** | Transcript extraction → summarization |
| 🌐 **Webpage** | BeautifulSoup scraping → summarization |
| 💬 **Chat with AI** | RAG: ChromaDB + sentence-transformers + Gemini |
| 🕐 **History** | SQLite-backed summary storage |
| 🌙 **Dark/Light Mode** | Toggle between themes |

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────┐
│                   Frontend (HTML/CSS/JS)           │
│  Sidebar SPA · Dark Glassmorphism · 7 Sections    │
└────────────────────┬─────────────────────────────┘
                     │ REST API (FastAPI)
┌────────────────────▼─────────────────────────────┐
│                  Backend (FastAPI)                 │
│  /api/summarize  /api/upload  /api/keywords        │
│  /api/audio  /api/youtube  /api/webpage            │
│  /api/chat  /api/history                          │
└────┬───────┬───────┬───────┬───────┬──────────────┘
     │       │       │       │       │
   BART    T5    KeyBERT ChromaDB Gemini
   T5   Pegasus  RAKE   sentence- API
                         transformers
                      SQLite (history)
```

---

## 🚀 Quick Start

### Prerequisites
- Python 3.9+ 
- ~3GB disk space (for BART model download)
- Internet connection (first run for model download)

### 1. Clone & Setup

```bash
# Clone
git clone https://github.com/yourusername/ai-text-summarizer.git
cd ai-text-summarizer/backend

# Windows
setup.bat

# Linux/Mac
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

### 2. Configure API Keys (Optional for Phase 4+)

Edit `backend/.env`:

```env
GEMINI_API_KEY=your_key_here   # Get free at: https://makersuite.google.com/
```

### 3. Start the Server (Backend)

You can run the FastAPI backend using either the batch script or directly with the virtual environment's Python command:

**Using batch script (Windows):**
```bash
# Windows
start.bat
```

**Using Python command directly (Windows / Linux / Mac):**
```bash
# Windows (from the backend directory)
venv\Scripts\python main.py

# Linux/Mac (from the backend directory)
cd backend && python main.py
```

### 4. Setup & Start the React Frontend

Open a new terminal window:

```bash
cd frontend

# If you get a PowerShell Execution Policy error on Windows, use npm.cmd:
npm.cmd install
npm.cmd run dev

# Otherwise:
npm install
npm run dev
```

> [!TIP]
> **PowerShell execution error?** If you get a `SecurityError: npm.ps1 cannot be loaded...` error on Windows, you can either:
> 1. Use `npm.cmd` instead of `npm` (e.g., `npm.cmd install`, `npm.cmd run dev`).
> 2. Or, unblock the execution policy temporarily by running `Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process` in your PowerShell terminal.

### 5. Open the App

- **React Developer server:** [http://localhost:5173](http://localhost:5173)
- **FastAPI Backend / Served App:** [http://localhost:8000](http://localhost:8000)
- **Backend API Docs:** [http://localhost:8000/docs](http://localhost:8000/docs)

---

## 📁 Project Structure

```
AI-Text-Summarizer/
├── backend/
│   ├── main.py                  # FastAPI entry point
│   ├── requirements.txt
│   ├── .env.example
│   ├── routers/                 # API route handlers
│   │   ├── summarize.py         # POST /api/summarize
│   │   ├── upload.py            # POST /api/upload
│   │   ├── keywords.py          # POST /api/keywords, /sentiment, /topics
│   │   ├── audio.py             # POST /api/audio
│   │   ├── sources.py           # POST /api/youtube, /webpage
│   │   ├── chat.py              # POST /api/chat/upload, /query
│   │   └── history.py           # GET/DELETE /api/history
│   ├── services/                # Business logic
│   │   ├── summarizer.py        # BART/T5/Gemini summarization
│   │   ├── file_parser.py       # PDF/DOCX/TXT extraction
│   │   ├── keyword_extractor.py # KeyBERT/RAKE/Sentiment/Topics
│   │   ├── tts_service.py       # gTTS audio generation
│   │   ├── rag_service.py       # ChromaDB RAG pipeline
│   │   ├── youtube_service.py   # Transcript extraction
│   │   └── web_scraper.py       # BeautifulSoup scraping
│   └── database/
│       └── db.py                # SQLAlchemy + SQLite
│
├── frontend/
│   ├── index.html               # SPA shell (7 sections)
│   ├── css/
│   │   └── styles.css           # Full design system
│   └── js/
│       ├── app.js               # Main logic + event bindings
│       ├── api.js               # API client module
│       ├── ui.js                # UI helpers
│       └── chat.js              # RAG chat logic
│
├── Procfile                     # Render/Railway deployment
├── .gitignore
└── README.md
```

---

## 🔌 API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/summarize` | Summarize raw text |
| POST | `/api/upload` | Upload & summarize file |
| POST | `/api/keywords` | Extract keywords |
| POST | `/api/sentiment` | Analyze sentiment |
| POST | `/api/topics` | Detect topics |
| POST | `/api/questions` | Generate questions |
| POST | `/api/audio` | Generate TTS audio |
| GET  | `/api/audio/{filename}` | Stream audio file |
| POST | `/api/youtube` | YouTube → summary |
| POST | `/api/webpage` | Webpage → summary |
| POST | `/api/chat/upload` | Index doc for RAG |
| POST | `/api/chat/query` | Ask question (RAG) |
| GET  | `/api/history` | Get history |
| DELETE | `/api/history/{id}` | Delete history item |

Full interactive API docs: `http://localhost:8000/docs`

---

## 🤖 Models Used

| Task | Model | Size |
|------|-------|------|
| Summarization | `facebook/bart-large-cnn` | ~1.6GB |
| Summarization (fast) | `t5-base` | ~250MB |
| Sentiment | `distilbert-base-uncased-finetuned-sst-2-english` | ~250MB |
| Zero-shot topics | `facebook/bart-large-mnli` | ~1.6GB |
| Question generation | `valhalla/t5-base-qg-hl` | ~250MB |
| Embeddings (RAG) | `all-MiniLM-L6-v2` | ~90MB |
| LLM (RAG + multilingual) | Gemini Pro (API) | Cloud |

> **Note:** Models are downloaded automatically on first use via Hugging Face.

---

## 🚢 Deployment

### Render (Free Tier)

1. Push to GitHub
2. Connect repo on [render.com](https://render.com)
3. Set environment: `GEMINI_API_KEY=...`
4. Build command: `pip install -r backend/requirements.txt`
5. Start command: `cd backend && uvicorn main:app --host 0.0.0.0 --port $PORT`

### Vercel (Frontend Only)

Deploy `frontend/` folder directly to Vercel with backend URL configured in `api.js`.

---

## 🧪 Testing

```bash
cd backend
pip install pytest httpx
pytest tests/ -v
```

---

## 📊 ROUGE Evaluation

```bash
python evaluate.py --text "original.txt" --summary "summary.txt"
```

---

## 📝 License

MIT License — Free to use for portfolio and educational projects.

---

## 👨‍💻 Built With

- **FastAPI** — Modern Python API framework
- **HuggingFace Transformers** — BART, T5, DistilBERT models
- **ChromaDB** — Vector database for RAG
- **sentence-transformers** — Semantic embeddings
- **Google Gemini** — LLM for multilingual + RAG answers
- **gTTS** — Google Text-to-Speech
- **pdfplumber** — PDF text extraction
- **BeautifulSoup** — Web scraping
- **SQLAlchemy** — ORM for SQLite history
