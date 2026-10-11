# Legal Document Analysis System - API Documentation

## Base URL
- Development: `http://localhost:8000/api`
- Interactive OpenAPI Docs (Swagger UI): `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

---

## Authentication

Authentication is handled via JWT Bearer tokens in the `Authorization` header:
```http
Authorization: Bearer <access_token>
```

> **Hackathon Convenience Note**:
> If no `Authorization` header is passed, the backend automatically provides a demo user identity (`demo@legal.local`) to allow immediate testing without forced registration.

### Endpoints

#### 1. Register User
- **Method**: `POST`
- **Path**: `/api/auth/register`
- **Request Body**:
  ```json
  {
    "email": "counsel@court.gov.in",
    "password": "SecurePassword123",
    "full_name": "Advocate R. Sharma"
  }
  ```
- **Response** `(200 OK)`:
  ```json
  {
    "access_token": "eyJhbGciOi...",
    "token_type": "bearer",
    "user": {
      "id": "uuid-v4",
      "email": "counsel@court.gov.in",
      "full_name": "Advocate R. Sharma"
    }
  }
  ```

#### 2. Login User
- **Method**: `POST`
- **Path**: `/api/auth/login`
- **Request Body**:
  ```json
  {
    "email": "demo@legal.local",
    "password": "demo1234"
  }
  ```
- **Response** `(200 OK)`:
  ```json
  {
    "access_token": "eyJhbGciOi...",
    "token_type": "bearer",
    "user": {
      "id": "uuid-v4",
      "email": "demo@legal.local",
      "full_name": "Demo User"
    }
  }
  ```

#### 3. Current User Profile
- **Method**: `GET`
- **Path**: `/api/auth/me`
- **Response** `(200 OK)`:
  ```json
  {
    "id": "uuid-v4",
    "email": "demo@legal.local",
    "full_name": "Demo User"
  }
  ```

---

## Document Management

#### 4. Upload Document
- **Method**: `POST`
- **Path**: `/api/documents/upload`
- **Content-Type**: `multipart/form-data`
- **Form Fields**: `file` (PDF file binary)
- **Validation**:
  - File extension must be `.pdf`
  - MIME type must be `application/pdf`
  - Magic bytes header must begin with `%PDF`
  - Maximum file size: `50 MB` (configurable via `MAX_UPLOAD_MB`)
  - Maximum page count: `500` (configurable via `MAX_PDF_PAGES`)
- **Response** `(200 OK)`:
  ```json
  {
    "id": "doc-uuid-1234",
    "message": "File uploaded successfully. Processing started in background.",
    "document": {
      "id": "doc-uuid-1234",
      "original_filename": "Civil_Appeal_No_4521_2023.pdf",
      "file_size": 1542030,
      "page_count": 28,
      "status": "processing",
      "progress_step": 1,
      "status_message": "Uploading document...",
      "has_summary": false,
      "uploaded_at": "2026-10-11T12:00:00Z"
    }
  }
  ```

#### 5. Document Processing Status
- **Method**: `GET`
- **Path**: `/api/documents/{document_id}/status`
- **Response** `(200 OK)`:
  ```json
  {
    "document_id": "doc-uuid-1234",
    "status": "processing",
    "progress_step": 4,
    "status_message": "Analyzing legal content...",
    "total_steps": 7
  }
  ```
  **Processing Pipeline Stages**:
  1. `Uploading document` (File validation and disk write)
  2. `Extracting text` (PyMuPDF per-page text & scanned detection)
  3. `Identifying pages and structure` (Heading & layout normalization)
  4. `Analyzing legal content` (Gemini legal intelligence extraction)
  5. `Preparing searchable passages` (Legal chunking, FAISS & BM25 indexing)
  6. `Generating case summary` (Persisting structured schema to DB)
  7. `Analysis complete` (Ready for review and conversational Q&A)

#### 6. Document Metadata
- **Method**: `GET`
- **Path**: `/api/documents/{document_id}`
- **Response** `(200 OK)`:
  ```json
  {
    "id": "doc-uuid-1234",
    "original_filename": "Civil_Appeal_No_4521_2023.pdf",
    "file_size": 1542030,
    "page_count": 28,
    "status": "complete",
    "progress_step": 7,
    "status_message": "Analysis completed successfully",
    "case_category": "Civil Appellate Jurisdiction",
    "court_name": "Supreme Court of India",
    "case_number": "Civil Appeal No. 4521 of 2023",
    "case_date": "14.09.2023",
    "has_summary": true,
    "uploaded_at": "2026-10-11T12:00:00Z",
    "processed_at": "2026-10-11T12:00:25Z"
  }
  ```

#### 7. Structured Case Summary
- **Method**: `GET`
- **Path**: `/api/documents/{document_id}/summary`
- **Response** `(200 OK)`:
  ```json
  {
    "court_name": "Supreme Court of India",
    "case_number": "Civil Appeal No. 4521 of 2023",
    "case_date": "14.09.2023",
    "case_type": "Civil Appeal",
    "case_type_confidence": 0.95,
    "document_type": "Final Judgment",
    "parties": [
      {
        "name": "State of Maharashtra & Anr.",
        "role": "appellant",
        "represented_by": "Senior Advocate Mr. S. Dave"
      },
      {
        "name": "M/s Reliance Infrastructure Ltd.",
        "role": "respondent",
        "represented_by": "Senior Advocate Dr. A.M. Singhvi"
      }
    ],
    "background_facts": [
      "Dispute arises out of an arbitral award dated 27.04.2019 regarding metro railway concession agreement.",
      "High Court set aside the award under Section 37 of the Arbitration Act."
    ],
    "background_sources": [
      {"page_num": 2, "passage": "The background facts giving rise to this appeal...", "confidence": 1.0}
    ],
    "legal_issues": [
      "Whether the High Court exceeded its jurisdiction under Section 37 in re-evaluating arbitral findings."
    ],
    "petitioner_arguments": [
      "The arbitral tribunal is the ultimate master of factual evaluation."
    ],
    "respondent_arguments": [
      "The award was tainted by patent illegality on the face of the record."
    ],
    "legal_provisions": [
      {
        "act_name": "Arbitration and Conciliation Act, 1996",
        "section": "Section 34",
        "description": "Setting aside arbitral award on patent illegality",
        "applied": true,
        "sources": [{"page_num": 14, "passage": "Scope of interference under Section 34...", "confidence": 1.0}]
      }
    ],
    "cited_precedents": [
      {
        "case_name": "Associate Builders v. DDA",
        "citation": "(2015) 3 SCC 49",
        "court": "Supreme Court of India",
        "how_cited": "relied upon",
        "sources": [{"page_num": 18, "passage": "Reiterating the principles settled in Associate Builders...", "confidence": 1.0}]
      }
    ],
    "court_reasoning": [
      "The court held that appellate review under Section 37 cannot morph into a full appeal on merits."
    ],
    "reasoning_sources": [
      {"page_num": 24, "passage": "Having considered the submissions, we find...", "confidence": 1.0}
    ],
    "operative_decision": "The appeal is allowed. The judgment of the High Court is set aside, and the arbitral award is reinstated.",
    "decision_sources": [
      {"page_num": 27, "passage": "In the result, the appeal is allowed. No order as to costs.", "confidence": 1.0}
    ],
    "executive_summary": "In this appeal, the Supreme Court set aside the High Court's interference with a commercial arbitral award...",
    "uncertainties": [],
    "extraction_quality": "good"
  }
  ```

#### 8. Serve Original PDF File
- **Method**: `GET`
- **Path**: `/api/documents/{document_id}/file`
- **Response**: Binary stream with headers:
  - `Content-Type: application/pdf`
  - `Content-Disposition: inline; filename="..."`
  - `X-Content-Type-Options: nosniff`

#### 9. List User Documents
- **Method**: `GET`
- **Path**: `/api/documents`
- **Response** `(200 OK)`:
  Array of `DocumentItemResponse` objects.

#### 10. Delete Document
- **Method**: `DELETE`
- **Path**: `/api/documents/{document_id}`
- **Response** `(200 OK)`:
  ```json
  {
    "status": "success",
    "message": "Document doc-uuid-1234 and associated data deleted"
  }
  ```

---

## Conversational Legal Assistant (RAG)

#### 11. Ask Question About Document
- **Method**: `POST`
- **Path**: `/api/documents/{document_id}/chat`
- **Request Body**:
  ```json
  {
    "question": "What was the final decision regarding the arbitral award?",
    "conversation_id": "conv-uuid-5678"
  }
  ```
- **Response** `(200 OK)`:
  ```json
  {
    "conversation_id": "conv-uuid-5678",
    "answer": "The Supreme Court allowed the appeal and set aside the High Court's judgment, thereby reinstating the original arbitral award in favor of the appellant.",
    "reasoning": "Grounded in paragraph 42 on page 27 of the judgment where the operative order is recorded.",
    "citations": [
      {
        "text": "Operative order reinstating award",
        "page_num": 27,
        "passage": "In the result, the appeal is allowed. The impugned judgment is set aside..."
      }
    ],
    "uncertainty": "none",
    "passages": [
      {
        "chunk_id": "chunk_doc-uuid-1234_27_0",
        "text": "In the result, the appeal is allowed...",
        "page_num": 27,
        "para_num": 42,
        "score": 0.0328,
        "section_heading": "Operative Order"
      }
    ]
  }
  ```

#### 12. Chat History
- **Method**: `GET`
- **Path**: `/api/documents/{document_id}/chat/history`
- **Response** `(200 OK)`:
  ```json
  {
    "conversation_id": "conv-uuid-5678",
    "messages": [
      {
        "id": "msg-1",
        "role": "user",
        "content": "What was the final decision?",
        "citations": [],
        "created_at": "2026-10-11T12:05:00Z"
      },
      {
        "id": "msg-2",
        "role": "assistant",
        "content": "The Supreme Court allowed the appeal...",
        "citations": [{"page_num": 27, "text": "...", "passage": "..."}],
        "created_at": "2026-10-11T12:05:03Z"
      }
    ]
  }
  ```

---

## System Health

#### 13. Health Check
- **Method**: `GET`
- **Path**: `/api/health`
- **Response** `(200 OK)`:
  ```json
  {
    "status": "ok",
    "version": "1.0.0",
    "gemini_configured": true,
    "llm_provider": "gemini",
    "llm_model": "gemini-1.5-flash"
  }
  ```
