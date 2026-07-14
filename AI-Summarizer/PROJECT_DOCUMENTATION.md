# AI Text Summarizer Project Documentation 🤖

This document provides a comprehensive overview of the **AI Text Summarizer** codebase, detailing the modules, features, APIs, third-party frameworks, models, configuration keys, and setup guidelines.

---

## 📂 Project Architecture & Components

The project is structured as a full-stack web application with a modern decoupled design:

*   **Backend ([backend](file:///c:/Users/sathw/Downloads/AI-Text-Summarizer/AI-Text-Summarizer/backend))**: Powered by **FastAPI** (Python 3.9+). Handles text preprocessing, NLP pipeline, machine learning model inferences (Hugging Face Transformers), vector store indexing, RAG question-answering, and external scraping.
*   **Frontend ([frontend](file:///c:/Users/sathw/Downloads/AI-Text-Summarizer/AI-Text-Summarizer/frontend))**: A modern SPA built with **React** and **Vite**, featuring beautiful dark glassmorphic styling, responsive layout, sidebar navigation, custom panels, and notifications.
*   **Authentication**: Integrated with **Clerk** on the React frontend to protect user sessions.
*   **Database**: Uses **SQLite** via **SQLAlchemy ORM** to persist summarization and text processing history.

---

## 🛠️ Technology Stack & Frameworks

### 1. Python Backend Frameworks & Libraries
The python backend uses a rich ecosystem of libraries for API management, web scraping, and NLP tasks:

| Library / Framework | Purpose | Description |
| :--- | :--- | :--- |
| **FastAPI** | REST API Routing | Modern, fast, web framework for building APIs with Python. |
| **Uvicorn** | Web Server ASGI | A lightning-fast ASGI server implementation used to run FastAPI. |
| **SQLAlchemy** | Database ORM | Object-Relational Mapping to handle SQLite records for summaries. |
| **PyTorch (`torch`)** | Machine Learning Core | Run tensor computations and neural network models locally. |
| **Transformers** | Local ML Inference | Hugging Face's SDK to run BART, T5, and DistilBERT models locally. |
| **sentence-transformers** | Embedding Generation | Generate dense embeddings (using `all-MiniLM-L6-v2`) for local RAG and semantic plagiarism comparisons. |
| **KeyBERT** | Keyword Extraction | Leverage BERT embeddings to identify key terms in text. |
| **RAKE-NLTK & NLTK** | Keyword Extraction | Rapid Automatic Keyword Extraction and classic natural language toolkits. |
| **BeautifulSoup4 & requests** | Web Scraping | Fetch and extract clean HTML text from arbitrary URLs. |
| **firecrawl-py** | Web Scraping SDK | Optional SDK to extract clean markdown representation from webpages. |
| **youtube-transcript-api** | Video Scraping | Connects to YouTube transcripts to summarize online videos. |
| **gTTS & edge-tts** | Text-To-Speech (TTS) | Synthesize summaries into spoken audio files. |
| **deep-translator** | Translation | Translates local summaries into other target languages (Hindi, German, Telugu, etc.). |
| **pdfplumber & python-docx** | Document Parsing | Extract raw text from PDF, DOCX, and TXT files. |
| **langdetect** | Language Detection | Automatically determine the language of incoming text. |
| **google-generativeai** | Cloud LLM integration | Official Python SDK to access the Gemini API (models like `gemini-2.0-flash`). |

### 2. Frontend Frameworks & Libraries
The frontend is a single-page React app:

*   **Vite**: The build tool and development server for high-speed module reloading.
*   **React (v19)**: Component-based UI library.
*   **React Router DOM (v7)**: Handles client-side navigation.
*   **Clerk React (`@clerk/react`)**: User management, sign-in/up screens, and route protection.
*   **React Hot Toast**: Beautiful animated popup notifications.
*   **Custom Vanilla CSS**: Glassmorphic, modern responsive UI styling.

---

## 🔑 Configured API Keys & Env Variables

All credentials, local model targets, and configurations are governed by the backend environment file:
*   Backend Configuration Template: [backend/.env.example](file:///c:/Users/sathw/Downloads/AI-Text-Summarizer/AI-Text-Summarizer/backend/.env.example)
*   Frontend Configuration: [frontend/.env.local](file:///c:/Users/sathw/Downloads/AI-Text-Summarizer/AI-Text-Summarizer/frontend/.env.local)

### Required / Optional Keys

1.  **`GEMINI_API_KEY` (Makersuite/Google AI Studio)**
    *   **Required for**: RAG (Chat with AI), Global Plagiarism checks, Text humanization, Text Processor proofreading, and multilingual cloud-summarization.
    *   **Fallback**: If absent, the app falls back to Groq or local/mocked extraction.
2.  **`GROQ_API_KEY` (Groq Dashboard)**
    *   **Required for**: Fast alternative cloud summaries, plagiarism checks, and humanizer prompts.
    *   **Model targeted**: `llama-3.3-70b-versatile` (configured as fallback for Gemini).
3.  **`OPENAI_API_KEY` (OpenAI)**
    *   **Optional**: Can be configured for alternative cloud LLM tasks.
4.  **`HF_TOKEN` (HuggingFace Hub)**
    *   **Optional**: Resolves occasional 503 errors when download requests for BART/T5 models rate-limit on HuggingFace servers.
5.  **`VITE_CLERK_PUBLISHABLE_KEY` (Clerk Auth Dashboard)**
    *   **Required**: Provided to the React frontend in `.env.local` to connect to the authentication server.
6.  **`FIRECRAWL_API_KEY` (Firecrawl.dev)**
    *   **Optional**: Highly robust markdown scraper for complex, dynamic, or javascript-heavy web pages.
7.  **`SMTP_USERNAME` & `SMTP_PASSWORD`**
    *   **Optional**: Configuration for SMTP email dispatch.

---

## 🤖 Machine Learning Models Used

| Task / Domain | Model Name | Download Size | Deployment |
| :--- | :--- | :--- | :--- |
| **Text Summarization (Standard)** | `facebook/bart-large-cnn` | ~1.6 GB | Local (lazy-loaded) |
| **Text Summarization (Fast)** | `t5-base` / `t5-small` | ~250 MB | Local (lazy-loaded) |
| **RAG Embeddings** | `sentence-transformers/all-MiniLM-L6-v2` | ~90 MB | Local (lazy-loaded) |
| **Sentiment Analysis** | `distilbert-base-uncased-finetuned-sst-2-english` | ~250 MB | Local (lazy-loaded) |
| **Zero-Shot Topic Classifier** | `facebook/bart-large-mnli` | ~1.6 GB | Local (lazy-loaded) |
| **Question Generation** | `valhalla/t5-base-qg-hl` | ~250 MB | Local (lazy-loaded) |
| **LLM (RAG / Processing)** | `gemini-2.0-flash` | Cloud API | Google Cloud Platform |
| **LLM (RAG Fallback)** | `llama-3.3-70b-versatile` | Cloud API | Groq API Platform |

---

## ⚡ Main Application Sections & Routes

Here is a breakdown of the specific sections in the React SPA layout and their matching REST API endpoints:

### 1. Summarization Section
*   **UI Component**: [SummarizeSection.jsx](file:///c:/Users/sathw/Downloads/AI-Text-Summarizer/AI-Text-Summarizer/frontend/src/components/sections/SummarizeSection.jsx)
*   **Backend Router**: [routers/summarize.py](file:///c:/Users/sathw/Downloads/AI-Text-Summarizer/AI-Text-Summarizer/backend/routers/summarize.py) / [services/summarizer.py](file:///c:/Users/sathw/Downloads/AI-Text-Summarizer/AI-Text-Summarizer/backend/services/summarizer.py)
*   **APIs**: `POST /api/summarize`
*   **Details**: Summarizes input text in short, medium, or detailed lengths, with support for bullet formatting, translation, and hybrid routing.

### 2. File Upload Section
*   **UI Component**: [UploadSection.jsx](file:///c:/Users/sathw/Downloads/AI-Text-Summarizer/AI-Text-Summarizer/frontend/src/components/sections/UploadSection.jsx)
*   **Backend Router**: [routers/upload.py](file:///c:/Users/sathw/Downloads/AI-Text-Summarizer/AI-Text-Summarizer/backend/routers/upload.py) / [services/file_parser.py](file:///c:/Users/sathw/Downloads/AI-Text-Summarizer/AI-Text-Summarizer/backend/services/file_parser.py)
*   **APIs**: `POST /api/upload`
*   **Details**: Uploads PDFs, DOCX, or TXT documents, extracts plain text, and returns a summary.

### 3. Keywords & NLP Insights
*   **UI Component**: [KeywordsSection.jsx](file:///c:/Users/sathw/Downloads/AI-Text-Summarizer/AI-Text-Summarizer/frontend/src/components/sections/KeywordsSection.jsx)
*   **Backend Router**: [routers/keywords.py](file:///c:/Users/sathw/Downloads/AI-Text-Summarizer/AI-Text-Summarizer/backend/routers/keywords.py) / [services/keyword_extractor.py](file:///c:/Users/sathw/Downloads/AI-Text-Summarizer/AI-Text-Summarizer/backend/services/keyword_extractor.py)
*   **APIs**: `POST /api/keywords`, `POST /api/sentiment`, `POST /api/topics`, `POST /api/questions`
*   **Details**: Computes sentiment (Positive/Neutral/Negative), Zero-shot topic classification (15 default topics), comprehends questions from text, and extracts keyphrases.

### 4. Text Processor & Proofreader
*   **UI Component**: [TextProcessorSection.jsx](file:///c:/Users/sathw/Downloads/AI-Text-Summarizer/AI-Text-Summarizer/frontend/src/components/sections/TextProcessorSection.jsx)
*   **Backend Router**: [routers/text_processor.py](file:///c:/Users/sathw/Downloads/AI-Text-Summarizer/AI-Text-Summarizer/backend/routers/text_processor.py) / [services/text_processor_service.py](file:///c:/Users/sathw/Downloads/AI-Text-Summarizer/AI-Text-Summarizer/backend/services/text_processor_service.py)
*   **APIs**: `POST /api/text-processor/analyze`
*   **Details**: Reviews vocabulary, grammar, punctuation, readability scores (Flesch-Kincaid), style errors (like passive voice, cliches), and detected tones using Gemini/Groq.

### 5. Audio TTS Generator
*   **UI Component**: [AudioSection.jsx](file:///c:/Users/sathw/Downloads/AI-Text-Summarizer/AI-Text-Summarizer/frontend/src/components/sections/AudioSection.jsx)
*   **Backend Router**: [routers/audio.py](file:///c:/Users/sathw/Downloads/AI-Text-Summarizer/AI-Text-Summarizer/backend/routers/audio.py) / [services/tts_service.py](file:///c:/Users/sathw/Downloads/AI-Text-Summarizer/AI-Text-Summarizer/backend/services/tts_service.py)
*   **APIs**: `POST /api/audio`, `GET /api/audio/{filename}`
*   **Details**: Generates TTS audios for summarization results.

### 6. Sources Section (Webpage & YouTube)
*   **UI Component**: [SourcesSection.jsx](file:///c:/Users/sathw/Downloads/AI-Text-Summarizer/AI-Text-Summarizer/frontend/src/components/sections/SourcesSection.jsx)
*   **Backend Router**: [routers/sources.py](file:///c:/Users/sathw/Downloads/AI-Text-Summarizer/AI-Text-Summarizer/backend/routers/sources.py) / [services/web_scraper.py](file:///c:/Users/sathw/Downloads/AI-Text-Summarizer/AI-Text-Summarizer/backend/services/web_scraper.py) / [services/youtube_service.py](file:///c:/Users/sathw/Downloads/AI-Text-Summarizer/AI-Text-Summarizer/backend/services/youtube_service.py)
*   **APIs**: `POST /api/youtube`, `POST /api/webpage`
*   **Details**: Scrapes raw text from webpage URLs or video subtitles, passing them to the summarizer engine.

### 7. Chat with AI (RAG)
*   **UI Component**: [ChatSection.jsx](file:///c:/Users/sathw/Downloads/AI-Text-Summarizer/AI-Text-Summarizer/frontend/src/components/sections/ChatSection.jsx)
*   **Backend Router**: [routers/chat.py](file:///c:/Users/sathw/Downloads/AI-Text-Summarizer/AI-Text-Summarizer/backend/routers/chat.py) / [services/rag_service.py](file:///c:/Users/sathw/Downloads/AI-Text-Summarizer/AI-Text-Summarizer/backend/services/rag_service.py)
*   **APIs**: `POST /api/chat/upload`, `POST /api/chat/query`, `DELETE /api/chat/session/{session_id}`
*   **Details**: Indexed documents are chunked and converted to embeddings. Submitting questions triggers semantic lookup via Cosine Similarity, using Gemini/Groq to generate the final response.

### 8. Plagiarism & Originality Checker
*   **UI Component**: [PlagiarismSection.jsx](file:///c:/Users/sathw/Downloads/AI-Text-Summarizer/AI-Text-Summarizer/frontend/src/components/sections/PlagiarismSection.jsx)
*   **Backend Router**: [routers/plagiarism.py](file:///c:/Users/sathw/Downloads/AI-Text-Summarizer/AI-Text-Summarizer/backend/routers/plagiarism.py) / [services/plagiarism_service.py](file:///c:/Users/sathw/Downloads/AI-Text-Summarizer/AI-Text-Summarizer/backend/services/plagiarism_service.py)
*   **APIs**: `POST /api/plagiarism/check`, `POST /api/plagiarism/humanize`
*   **Details**: 
    *   **Local Check**: Evaluates text chunk embeddings against previously stored PDF sessions to compute internal copy percentages.
    *   **Global Check**: Sends text fragments to Gemini/Groq to check internet similarities, detect potential AI writing signatures, and calculate AI probability.
    *   **Humanize**: Rephrases robotic AI text blocks to emulate human structural variation (burstiness and perplexity).

### 9. History Log
*   **UI Component**: [HistorySection.jsx](file:///c:/Users/sathw/Downloads/AI-Text-Summarizer/AI-Text-Summarizer/frontend/src/components/sections/HistorySection.jsx)
*   **Backend Router**: [routers/history.py](file:///c:/Users/sathw/Downloads/AI-Text-Summarizer/AI-Text-Summarizer/backend/routers/history.py)
*   **APIs**: `GET /api/history`, `DELETE /api/history/{id}`
*   **Details**: Lists, displays, and deletes cached SQLite summary entries.

---

## ⚡ Execution and Setup Guide

### 1. Backend Server Deployment
To configure and launch the server locally on Windows:
```powershell
cd backend
copy .env.example .env
# Edit .env file and fill in at least GEMINI_API_KEY or GROQ_API_KEY
.\setup.bat

# EITHER start via batch script:
.\start.bat

# OR run with Python directly using the virtual environment:
venv\Scripts\python main.py
```
*(Runs by default on [http://localhost:8000](http://localhost:8000). Direct documentation is hosted at `/docs`)*

### 2. Frontend Launch
To run the React application:
```powershell
cd frontend

# If you get a PowerShell Execution Policy error on Windows, run:
npm.cmd install
npm.cmd run dev

# Otherwise:
npm install
npm run dev
```
*(Runs by default on [http://localhost:5173](http://localhost:5173))*

> [!TIP]
> If PowerShell blocks running the `npm` wrapper command (throwing a script execution policy error), you can bypass this by running `Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process` in the current session.

