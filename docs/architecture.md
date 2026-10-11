# System Architecture

## Data Flow Diagrams

### Document Upload & Analysis Flow

```
User                Frontend            Backend API          Services              Storage
 │                     │                    │                    │                    │
 │  Upload PDF         │                    │                    │                    │
 ├────────────────────►│                    │                    │                    │
 │                     │  POST /upload      │                    │                    │
 │                     ├───────────────────►│                    │                    │
 │                     │                    │ Validate MIME,     │                    │
 │                     │                    │ magic bytes, size  │                    │
 │                     │                    │                    │                    │
 │                     │                    │ Save UUID.pdf ─────────────────────────►│
 │                     │                    │ Create Document DB record               │
 │                     │                    │ Start BackgroundTask                    │
 │                     │  {document_id}     │                    │                    │
 │                     │◄───────────────────│                    │                    │
 │                     │                    │                    │                    │
 │  Poll status every  │                    │                    │                    │
 │  2 seconds          │                    │                    │                    │
 │                     │  GET /status       │                    │                    │
 │                     ├───────────────────►│                    │                    │
 │                     │  {step: 2, ...}    │                    │                    │
 │                     │◄───────────────────│   Background Task: │                    │
 │                     │                    │   Step 2: Extract  │                    │
 │                     │                    │   ─────────────────►DocumentExtractor   │
 │                     │                    │                    │ PyMuPDF page-by-   │
 │                     │                    │                    │ page + OCR fallback│
 │                     │                    │                    │                    │
 │                     │                    │   Step 4: Analyze  │                    │
 │                     │                    │   ─────────────────►LegalAnalyzer       │
 │                     │                    │                    │ → GeminiProvider   │
 │                     │                    │                    │ → CaseAnalysis JSON│
 │                     │                    │                    │ Save to CaseSummary│
 │                     │                    │                    │                    │
 │                     │                    │   Step 5: Index    │                    │
 │                     │                    │   ─────────────────►LegalChunker        │
 │                     │                    │                    │ → Embedder         │
 │                     │                    │                    │ → FAISSStore ──────►│
 │                     │                    │                    │ → BM25Store ───────►│
 │                     │                    │                    │                    │
 │                     │                    │   Step 7: Complete │                    │
 │                     │  {step: 7, status: │                    │                    │
 │                     │   "complete"}      │                    │                    │
 │                     │◄───────────────────│                    │                    │
 │  Navigate to        │                    │                    │                    │
 │  workspace          │                    │                    │                    │
 │◄────────────────────│                    │                    │                    │
```

### Chat / RAG Query Flow

```
User                Frontend            Backend API          Services              LLM
 │                     │                    │                    │                    │
 │  Ask question       │                    │                    │                    │
 ├────────────────────►│                    │                    │                    │
 │                     │  POST /chat        │                    │                    │
 │                     │  {question, conv_  │                    │                    │
 │                     │   id}              │                    │                    │
 │                     ├───────────────────►│                    │                    │
 │                     │                    │  QAService.answer()│                    │
 │                     │                    │  ──────────────────►                    │
 │                     │                    │                    │ HybridRetriever    │
 │                     │                    │                    │ .retrieve(question,│
 │                     │                    │                    │  doc_id)           │
 │                     │                    │                    │                    │
 │                     │                    │                    │ FAISS semantic ─┐  │
 │                     │                    │                    │ BM25 keyword   ─┤  │
 │                     │                    │                    │ RRF fusion     ─┘  │
 │                     │                    │                    │                    │
 │                     │                    │                    │ Build prompt with  │
 │                     │                    │                    │ passages + history │
 │                     │                    │                    │ ───────────────────►
 │                     │                    │                    │                 Gemini
 │                     │                    │                    │ JSON response ◄────│
 │                     │                    │                    │ {answer, citations}│
 │                     │                    │                    │                    │
 │                     │                    │  Save messages     │                    │
 │                     │                    │  to Conversation   │                    │
 │                     │  {answer,          │                    │                    │
 │                     │   citations,       │                    │                    │
 │                     │   uncertainty}     │                    │                    │
 │                     │◄───────────────────│                    │                    │
 │  Display answer     │                    │                    │                    │
 │  with p.N badges    │                    │                    │                    │
 │◄────────────────────│                    │                    │                    │
 │                     │                    │                    │                    │
 │  Click citation     │                    │                    │                    │
 │  badge "p.5"        │                    │                    │                    │
 ├────────────────────►│                    │                    │                    │
 │                     │  jumpToPage(5)     │                    │                    │
 │                     │  PDF viewer jumps  │                    │                    │
 │◄────────────────────│                    │                    │                    │
```

## Database Schema

```
┌──────────────────┐     ┌──────────────────────┐
│      users       │     │      documents        │
├──────────────────┤     ├──────────────────────┤
│ id (PK, UUID)    │◄────│ owner_id (FK)         │
│ email (unique)   │     │ id (PK, UUID)         │
│ full_name        │     │ original_filename     │
│ hashed_password  │     │ stored_filename       │
│ is_active        │     │ file_size             │
│ created_at       │     │ page_count            │
└──────────────────┘     │ status                │
                         │ progress_step         │
                         │ status_message        │
                         │ court_name            │
                         │ case_number           │
                         │ case_date             │
                         │ case_category         │
                         │ has_summary           │
                         │ uploaded_at           │
                         │ processed_at          │
                         └──────────┬───────────┘
                                    │
                    ┌───────────────┴────────────────┐
                    │                                │
          ┌─────────▼──────────┐       ┌────────────▼────────┐
          │   case_summaries   │       │    conversations     │
          ├────────────────────┤       ├─────────────────────┤
          │ id (PK, UUID)      │       │ id (PK, UUID)       │
          │ document_id (FK)   │       │ document_id (FK)    │
          │ summary_json (JSON)│       │ created_at          │
          │ created_at         │       └──────────┬──────────┘
          └────────────────────┘                  │
                                        ┌─────────▼──────────┐
                                        │      messages       │
                                        ├────────────────────┤
                                        │ id (PK, UUID)      │
                                        │ conversation_id FK │
                                        │ role (user/assist) │
                                        │ content (Text)     │
                                        │ citations (JSON)   │
                                        │ created_at         │
                                        └────────────────────┘
```

## File Storage Layout

```
data/
  uploads/
    {uuid1}.pdf          ← Original PDF files, UUID-named
    {uuid2}.pdf             Never served directly from public URL
  indexes/
    {doc_id}/
      faiss.index        ← FAISS dense vector index
      faiss_meta.pkl     ← Chunk metadata (text, page_num, etc.)
      bm25.pkl           ← Serialized BM25Okapi index
      bm25_corpus.pkl    ← Tokenized corpus for BM25
  db/
    legal_docs.db        ← SQLite database
```

## Security Layers

```
Request → FastAPI Middleware
           ↓
         CORS check (allowed origins only)
           ↓
         Endpoint handler
           ↓
         get_current_user() dependency
           - Decode JWT from Authorization header
           - Verify signature + expiry
           - Load user from DB
           - Auto-create demo user if no token (hackathon mode)
           ↓
         Document ownership check
           - Filter all Document queries by owner_id = current_user.id
           - 404 (not 403) to prevent information leakage
           ↓
         File validation
           - MIME type check
           - Magic bytes (%PDF) check
           - Size limit check
           - Page count limit check
           ↓
         Prompt injection protection
           - User document content marked as UNTRUSTED DATA in prompts
           - Never interpreted as system instructions
```
