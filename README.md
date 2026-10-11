# Legal Document Analysis System

> **Court Document Review and Analysis Portal**  
> AI-powered document intelligence for Indian court judgments


---

## What It Does

The Legal Document Analysis System reads uploaded Indian court documents and:

1. **Extracts and indexes** the full document with page-level metadata
2. **Identifies** parties, advocates, judges, legal issues, statutory references, and cited precedents
3. **Separates** the current judgment's operative decision from quoted or historical decisions
4. **Generates** a structured case summary with evidence references (page numbers)
5. **Answers** legal questions grounded in retrieved passages from the specific uploaded document

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        React Frontend                           │
│  Dashboard │ Upload │ 3-Panel Workspace │ History │ Settings    │
└───────────────────────┬─────────────────────────────────────────┘
                        │ HTTPS / REST API
┌───────────────────────▼─────────────────────────────────────────┐
│                      FastAPI Backend                            │
│                                                                 │
│  ┌──────────┐  ┌──────────────┐  ┌─────────────────────────┐   │
│  │  Upload  │  │   Analysis   │  │       Chat / RAG        │   │
│  │ Endpoint │  │   Pipeline   │  │       Endpoint          │   │
│  └────┬─────┘  └──────┬───────┘  └─────────┬───────────────┘   │
│       │               │                     │                   │
│  ┌────▼──────────────────────────────────────▼─────────────┐   │
│  │                 Document Processing                      │   │
│  │  PyMuPDF Extraction → OCR (opt) → Legal Chunker         │   │
│  └────────────────────────┬────────────────────────────────┘   │
│                           │                                     │
│  ┌────────────────────────▼────────────────────────────────┐   │
│  │                 Embedding & Indexing                     │   │
│  │  sentence-transformers → FAISS (dense)                  │   │
│  │  rank-bm25 → BM25 (sparse)                              │   │
│  └────────────────────────┬────────────────────────────────┘   │
│                           │                                     │
│  ┌────────────────────────▼────────────────────────────────┐   │
│  │              Hybrid Retrieval (RRF fusion)               │   │
│  └────────────────────────┬────────────────────────────────┘   │
│                           │                                     │
│  ┌────────────────────────▼────────────────────────────────┐   │
│  │           Gemini LLM (Legal Context Prompts)             │   │
│  │  Structured Extraction │ Grounded QA │ Uncertainty       │   │
│  └────────────────────────┬────────────────────────────────┘   │
│                           │                                     │
│  ┌────────────────────────▼────────────────────────────────┐   │
│  │         SQLite (SQLAlchemy) — Persistence                │   │
│  │  Users │ Documents │ Conversations │ Messages            │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, React Router |
| PDF Viewer | react-pdf (PDF.js) |
| Markdown | react-markdown + remark-gfm |
| Icons | Lucide React |
| HTTP Client | Axios |
| Backend | Python 3.11, FastAPI, Pydantic v2 |
| PDF Extraction | PyMuPDF (fitz) |
| OCR (optional) | Tesseract via pytesseract |
| Embeddings | sentence-transformers (all-MiniLM-L6-v2, local) |
| Vector Store | FAISS (per-document index) |
| Keyword Search | rank-bm25 (BM25Okapi) |
| Retrieval | Hybrid RRF fusion |
| LLM | Google Gemini 1.5 Flash (via google-generativeai) |
| Database | SQLite via SQLAlchemy |
| Auth | JWT (python-jose) + bcrypt |

---

## Project Structure

```
legal-document-analysis-system/
  frontend/               # React + TypeScript + Vite
    src/
      components/         # Shared UI components
      pages/              # Route-level page components
      features/           # Feature-specific components
      services/           # API client
      hooks/              # React custom hooks
      types/              # TypeScript interfaces
  backend/                # FastAPI Python backend
    app/
      api/v1/             # REST endpoints (documents, chat, auth)
      core/               # Security, errors, logging
      services/
        document_extraction/  # PyMuPDF, OCR, chunking
        legal_analysis/       # LLM prompts, schema, analyzer
        embeddings/           # FAISS, BM25 stores
        retrieval/            # Hybrid retrieval
        question_answering/   # RAG QA pipeline
        llm/                  # Provider abstraction (Gemini)
      models/             # SQLAlchemy ORM models
      schemas/            # Pydantic request/response schemas
    tests/                # Automated tests
  data/
    uploads/              # Stored PDF files (gitignored)
    indexes/              # FAISS + BM25 indexes (gitignored)
    db/                   # SQLite database (gitignored)
  docs/                   # Architecture and API docs
```

---

## Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Python | ≥ 3.11 | Backend runtime |
| Node.js | ≥ 18 | Frontend build |
| npm | ≥ 9 | Package management |
| Gemini API Key | — | Free at aistudio.google.com |
| Tesseract OCR | any | Optional; for scanned PDFs |

---

## Setup Instructions

### 1. Clone and enter the repository

```bash
git clone <repo-url>
cd legal-document-analysis-system
```

### 2. Backend setup

```bash
cd backend

# Create virtual environment
python -m venv venv
# Windows:
venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
copy .env.example .env
# Edit .env and set GEMINI_API_KEY=your-actual-key
```

### 3. Frontend setup

```bash
cd frontend
npm install
```

### 4. Start the backend

```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

### 5. Start the frontend

```bash
cd frontend
npm run dev
```

The application will be available at **http://localhost:5173**

---

## Environment Variables

All configuration is in `backend/.env`. Copy from `backend/.env.example`:

| Variable | Default | Description |
|---|---|---|
| `GEMINI_API_KEY` | *(required)* | Google AI Studio API key |
| `LLM_PROVIDER` | `gemini` | LLM provider (`gemini` or `openai`) |
| `LLM_MODEL` | `gemini-1.5-flash` | Model name |
| `EMBEDDING_MODEL` | `all-MiniLM-L6-v2` | Sentence-transformers model (local) |
| `DATABASE_URL` | `sqlite:///./data/db/legal_docs.db` | SQLAlchemy connection string |
| `SECRET_KEY` | *(change in production)* | JWT signing key |
| `MAX_UPLOAD_MB` | `50` | Maximum PDF upload size |
| `MAX_PDF_PAGES` | `500` | Maximum pages per document |
| `CORS_ORIGINS` | `["http://localhost:5173"]` | Allowed frontend origins |

---

## Running Tests

```bash
cd backend

# Install test extras
pip install pytest pytest-asyncio httpx

# Run all tests
pytest tests/ -v

# Run specific test class
pytest tests/test_all.py::TestAPIEndpoints -v
```

---

## API Documentation

After starting the backend, visit:

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

### Key Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Service health check |
| `POST` | `/api/auth/register` | Register new user |
| `POST` | `/api/auth/login` | Authenticate and get JWT |
| `POST` | `/api/documents/upload` | Upload PDF for analysis |
| `GET` | `/api/documents/{id}/status` | Poll processing status (7 steps) |
| `GET` | `/api/documents/{id}/summary` | Get structured case analysis |
| `GET` | `/api/documents/{id}/file` | Serve PDF for viewer |
| `POST` | `/api/documents/{id}/chat` | Ask a question about the document |
| `GET` | `/api/documents/{id}/chat/history` | Get conversation history |
| `GET` | `/api/documents` | List user's documents |
| `DELETE` | `/api/documents/{id}` | Delete document and all data |

---

## Demonstration Workflow

### Step 1 — Start the application
```bash
# Terminal 1 (backend)
cd backend && uvicorn app.main:app --reload --port 8000

# Terminal 2 (frontend)
cd frontend && npm run dev
```

### Step 2 — Open the portal
Navigate to http://localhost:5173

The system auto-creates a demo user. No manual registration required.

### Step 3 — Upload a court document
1. Click **New Analysis** in the sidebar
2. Drag and drop or browse for an Indian court PDF
3. Click **Analyze Document**
4. Watch the 7 real processing steps (each updates the backend)

### Step 4 — Review the case summary
The middle panel shows:
- Court, case number, date
- Parties with their roles
- Background facts with page references
- Petitioner's arguments vs Respondent's arguments
- Legal provisions (with "applied" vs "mentioned" distinction)
- Cited precedents with their treatment
- Court's reasoning
- Operative decision (prominently highlighted)
- Uncertainties and data quality flags

### Step 5 — Ask questions

Try these questions in the right panel:
- *"What is the main issue in this case?"*
- *"What arguments did the petitioner present?"*
- *"Which legal provisions were actually applied by the court?"*
- *"What is the final operative decision?"*
- *"Explain the court's reasoning in simple English."*
- *"What is the weather today?"* ← System correctly says "not found in document"

### Step 6 — Navigate citations
Click any **p.X** citation badge in the summary or chat answers to jump the PDF viewer to that page.

### Step 7 — Review document history
Navigate to **Document History** to see all analyzed documents.

---

## Legal Reliability Rules (Built In)

The system enforces these rules in its LLM prompts and output validation:

1. Never fabricate legal citations or case names
2. Never invent page numbers or party details
3. Never confuse cited precedents with the current case
4. Never confuse arguments with judicial findings
5. Never assume the outcome from an isolated keyword
6. Never state a law was applied merely because it was mentioned
7. Always flag uncertainty rather than guessing
8. Always ground answers in retrieved passages
9. Display source page references for material claims
10. Say "not found in document" when evidence is absent

---

## Security Notes

- Uploaded files are stored outside the public directory with UUID filenames
- Document-level access control: users can only access their own documents
- JWT tokens for all authenticated endpoints
- File validation: MIME type + magic bytes + page count limits
- Prompt injection protection: uploaded document content is treated as untrusted data
- No secrets committed to source control

### External LLM Privacy Notice
Document content is sent to Google's Gemini API for analysis. Review [Google's data usage policy](https://ai.google.dev/gemini-api/terms) before uploading real sensitive documents.

---

## Known Limitations

1. **OCR quality**: Tesseract OCR on scanned documents may produce errors on complex legal layouts. For best results, use text-based PDFs.
2. **Very long documents**: Documents over ~100 pages may have slower embedding generation on first analysis. The system processes up to the first 30 pages for the initial LLM extraction pass.
3. **Gemini JSON parsing**: Occasionally Gemini may return malformed JSON. The analyzer includes fallback parsing but some structured fields may show as "unknown".
4. **Embedding model download**: On first run, `sentence-transformers` downloads `all-MiniLM-L6-v2` (~80 MB). This requires internet access.
5. **FAISS on Windows**: `faiss-cpu` on Windows requires Visual C++ redistributables. If installation fails, see the [FAISS installation guide](https://github.com/facebookresearch/faiss/blob/main/INSTALL.md).
6. **No multi-document comparison**: The chatbot is deliberately scoped to one document at a time to prevent cross-document answer leakage. Comparison is a planned future feature.
7. **Auth is simple**: The JWT auth is suitable for a demo. Production deployment should add refresh tokens, email verification, and rate limiting.

---

## Hackathon Innovation Summary

| Differentiator | Implementation |
|---|---|
| **Legal-context understanding** | Dedicated system prompt distinguishes allegations vs findings, arguments vs decisions, cited precedents vs current judgment |
| **Hybrid retrieval** | FAISS (semantic) + BM25 (keyword) fused with RRF — catches both contextual matches and exact statutory references |
| **Evidence-linked answers** | Every extracted claim has page-number citations; clicking navigates the PDF viewer |
| **Party-role separation** | Structured extraction separately identifies petitioner, respondent, advocates, judges, mentioned persons |
| **Operative decision detection** | Analyzes the operative section in context to avoid confusing the current decision with quoted precedents |
| **Honest uncertainty** | Unknown fields shown as "unknown"; low-confidence extractions flagged; "not found in document" explicitly stated |
| **Document isolation** | FAISS/BM25 indexes are per-document; retrieval always filtered by document_id; no cross-document leakage |

---

## Acknowledgements

Built for the legal document review hackathon challenge: *Streamlining Court Document Review and Organization*.

This system is a document-review and information-retrieval aid. It does not replace judicial reasoning or provide binding legal conclusions.
