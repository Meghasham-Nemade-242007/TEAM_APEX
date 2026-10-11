import asyncio
import io
import logging
import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import List, Optional

import fitz  # PyMuPDF
from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile, Query, status
from fastapi.responses import FileResponse
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config import settings
from app.database import CaseSummary, Conversation, Document, Message, SessionLocal, User, get_db
from app.dependencies import get_current_user, security_scheme, get_user_from_raw_token, get_or_create_demo_user
from app.services.document_extraction.chunker import LegalChunker
from app.services.document_extraction.extractor import DocumentExtractor
from app.services.embeddings.bm25_store import BM25Store
from app.services.embeddings.embedder import Embedder
from app.services.embeddings.faiss_store import FAISSStore
from app.services.legal_analysis.analyzer import LegalAnalyzer

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/documents", tags=["documents"])


# --- Schemas ---

class DocumentStatusResponse(BaseModel):
    document_id: str
    status: str
    progress_step: int
    status_message: str
    total_steps: int = 7

class DocumentItemResponse(BaseModel):
    id: str
    original_filename: str
    file_size: Optional[int] = None
    page_count: Optional[int] = None
    status: str
    progress_step: int
    status_message: str
    case_category: Optional[str] = None
    court_name: Optional[str] = None
    case_number: Optional[str] = None
    case_date: Optional[str] = None
    has_summary: bool
    uploaded_at: Optional[datetime] = None
    processed_at: Optional[datetime] = None

class DocumentUploadResponse(BaseModel):
    document_id: str
    id: str
    filename: str
    status: str
    document: Optional[DocumentItemResponse] = None


# --- Background Processing Task ---

def run_process_document_sync(document_id: str):
    """
    Synchronous wrapper to run async background analysis within an event loop.
    """
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

    if loop.is_running():
        asyncio.create_task(process_document(document_id, SessionLocal))
    else:
        loop.run_until_complete(process_document(document_id, SessionLocal))


async def process_document(document_id: str, db_session_factory):
    db: Session = db_session_factory()
    try:
        doc = db.query(Document).filter(Document.id == document_id).first()
        if not doc:
            logger.error(f"Document {document_id} not found in database during background process")
            return

        file_path = Path(settings.upload_dir) / doc.stored_filename
        if not file_path.exists():
            raise FileNotFoundError(f"Stored file {file_path} not found")

        # Step 1: Uploading document (already done)
        doc.status = "processing"
        doc.progress_step = 1
        doc.status_message = "Document uploaded successfully"
        db.commit()

        # Step 2: Extracting text
        doc.progress_step = 2
        doc.status_message = "Extracting text from pages"
        db.commit()

        extractor = DocumentExtractor()
        pages = extractor.extract_pages(str(file_path))
        doc.page_count = len(pages)
        db.commit()

        # Step 3: Identifying pages and structure
        doc.progress_step = 3
        doc.status_message = "Analyzing document structure and layout"
        db.commit()
        # Structure analysis / statistics
        total_chars = sum(p.char_count for p in pages)
        scanned_count = sum(1 for p in pages if p.is_scanned)
        logger.info(f"Doc {document_id}: {len(pages)} pages, {total_chars} chars, {scanned_count} scanned pages")

        # Step 4: Analyzing legal content
        doc.progress_step = 4
        doc.status_message = "Analyzing legal content and extracting facts"
        db.commit()

        analyzer = LegalAnalyzer()
        analysis = await analyzer.analyze(pages, doc_id=document_id)

        # Step 5: Preparing searchable passages
        doc.progress_step = 5
        doc.status_message = "Building semantic and lexical search indexes"
        db.commit()

        chunker = LegalChunker(target_chunk_size=800, overlap=100)
        chunks = chunker.chunk_pages(pages, doc_id=document_id)

        if chunks:
            embedder = Embedder()
            chunk_texts = [c.text for c in chunks]
            embeddings = embedder.encode(chunk_texts)

            faiss_store = FAISSStore()
            faiss_store.build_index(chunks, embeddings, doc_id=document_id)

            bm25_store = BM25Store()
            bm25_store.build_index(chunks, doc_id=document_id)

        # Step 6: Generating case summary & saving to DB
        doc.progress_step = 6
        doc.status_message = "Saving case summary and structured findings"
        db.commit()

        # Save or update CaseSummary
        case_summary = db.query(CaseSummary).filter(CaseSummary.document_id == document_id).first()
        summary_payload = analysis.model_dump()
        if not case_summary:
            case_summary = CaseSummary(
                document_id=document_id,
                summary_json=summary_payload
            )
            db.add(case_summary)
        else:
            case_summary.summary_json = summary_payload

        # Update Document metadata from analysis
        if analysis.court_name and analysis.court_name.lower() not in ["unknown", "none", ""]:
            doc.court_name = analysis.court_name
        if analysis.case_number and analysis.case_number.lower() not in ["unknown", "none", ""]:
            doc.case_number = analysis.case_number
        if analysis.case_date and analysis.case_date.lower() not in ["unknown", "none", ""]:
            doc.case_date = analysis.case_date
        if analysis.case_type and analysis.case_type.lower() not in ["unknown", "none", ""]:
            doc.case_category = analysis.case_type

        doc.has_summary = True

        # Step 7: Analysis complete / status check
        doc.progress_step = 7
        if (
            analysis.extraction_quality in ["verified", "good"]
            and analysis.operative_decision
            and "unable to determine" not in analysis.operative_decision.lower()
        ):
            doc.status = "completed"
            doc.status_message = "Analysis verified and completed"
        else:
            doc.status = "completed_with_warnings"
            doc.status_message = "Analysis completed with advisory notices"

        doc.processed_at = datetime.utcnow()
        db.commit()

    except Exception as e:
        logger.error(f"Error processing document {document_id}: {e}", exc_info=True)
        try:
            doc = db.query(Document).filter(Document.id == document_id).first()
            if doc:
                doc.status = "failed"
                doc.status_message = f"Analysis failed: {str(e)}"
                db.commit()
        except Exception as db_err:
            logger.error(f"Failed to record error state for {document_id}: {db_err}")
    finally:
        db.close()


# --- Endpoints ---

@router.post("/upload", response_model=DocumentUploadResponse)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Validate MIME type
    if file.content_type not in ["application/pdf", "application/x-pdf"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file format. Only PDF documents are supported."
        )

    # Read content
    contents = await file.read()
    file_size = len(contents)

    # Validate file size
    if file_size > settings.max_upload_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File exceeds maximum allowed size of {settings.max_upload_mb} MB"
        )

    # Validate magic bytes: %PDF
    if not contents.startswith(b"%PDF"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid PDF file header."
        )

    # Check page count
    try:
        pdf_stream = io.BytesIO(contents)
        doc_reader = fitz.open(stream=pdf_stream, filetype="pdf")
        page_count = len(doc_reader)
        doc_reader.close()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unable to parse PDF: {str(e)}"
        )

    if page_count > settings.max_pdf_pages:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Document exceeds maximum permitted {settings.max_pdf_pages} pages (has {page_count} pages)."
        )

    # Save to disk
    doc_id = str(uuid.uuid4())
    stored_filename = f"{doc_id}.pdf"
    target_path = Path(settings.upload_dir) / stored_filename
    target_path.parent.mkdir(parents=True, exist_ok=True)

    with open(target_path, "wb") as f:
        f.write(contents)

    # Insert DB record
    new_doc = Document(
        id=doc_id,
        owner_id=current_user.id,
        original_filename=file.filename or "uploaded.pdf",
        stored_filename=stored_filename,
        file_size=file_size,
        page_count=page_count,
        status="pending",
        progress_step=1,
        status_message="Document uploaded",
        has_summary=False,
        uploaded_at=datetime.utcnow()
    )
    db.add(new_doc)
    db.commit()
    db.refresh(new_doc)

    # Trigger background task
    background_tasks.add_task(process_document, doc_id, SessionLocal)

    doc_item = DocumentItemResponse(
        id=new_doc.id,
        original_filename=new_doc.original_filename,
        file_size=new_doc.file_size,
        page_count=new_doc.page_count,
        status=new_doc.status,
        progress_step=new_doc.progress_step,
        status_message=new_doc.status_message,
        has_summary=new_doc.has_summary,
        uploaded_at=new_doc.uploaded_at,
    )

    return DocumentUploadResponse(
        document_id=doc_id,
        id=doc_id,
        filename=new_doc.original_filename,
        status="pending",
        document=doc_item,
    )


@router.post("/{document_id}/analyze")
async def retrigger_analysis(
    document_id: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    doc.status = "processing"
    doc.progress_step = 1
    doc.status_message = "Analysis re-triggered"
    db.commit()

    background_tasks.add_task(process_document, document_id, SessionLocal)

    return {"document_id": document_id, "status": "processing", "message": "Analysis started"}


@router.get("/{document_id}/status", response_model=DocumentStatusResponse)
def get_document_status(
    document_id: str,
    db: Session = Depends(get_db)
):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    return DocumentStatusResponse(
        document_id=doc.id,
        status=doc.status,
        progress_step=doc.progress_step,
        status_message=doc.status_message or "",
        total_steps=7
    )


@router.get("/{document_id}", response_model=DocumentItemResponse)
def get_document_details(
    document_id: str,
    db: Session = Depends(get_db)
):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    return DocumentItemResponse(
        id=doc.id,
        original_filename=doc.original_filename,
        file_size=doc.file_size,
        page_count=doc.page_count,
        status=doc.status,
        progress_step=doc.progress_step,
        status_message=doc.status_message or "",
        case_category=doc.case_category,
        court_name=doc.court_name,
        case_number=doc.case_number,
        case_date=doc.case_date,
        has_summary=doc.has_summary,
        uploaded_at=doc.uploaded_at,
        processed_at=doc.processed_at
    )


@router.get("/{document_id}/summary")
def get_document_summary(
    document_id: str,
    db: Session = Depends(get_db)
):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    summary = db.query(CaseSummary).filter(CaseSummary.document_id == document_id).first()
    if not summary:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Summary not found. Document status is currently '{doc.status}'."
        )

    # Ensure even historical/cached summaries have comprehensive multi-section briefings
    data = dict(summary.summary_json)
    try:
        from app.services.legal_analysis.schema import CaseAnalysis
        analysis_obj = CaseAnalysis(**data)
        curr_words = len((analysis_obj.executive_summary or "").split())
        if curr_words < 140 or "###" not in (analysis_obj.executive_summary or ""):
            analysis_obj.ensure_comprehensive_summary()
            data["executive_summary"] = analysis_obj.executive_summary
    except Exception as e:
        logger.warning(f"On-the-fly summary enrichment notice for {document_id}: {e}")

    return data


@router.get("", response_model=List[DocumentItemResponse])
def list_documents(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    docs = (
        db.query(Document)
        .filter(Document.owner_id == current_user.id)
        .order_by(Document.uploaded_at.desc())
        .all()
    )

    return [
        DocumentItemResponse(
            id=d.id,
            original_filename=d.original_filename,
            file_size=d.file_size,
            page_count=d.page_count,
            status=d.status,
            progress_step=d.progress_step,
            status_message=d.status_message or "",
            case_category=d.case_category,
            court_name=d.court_name,
            case_number=d.case_number,
            case_date=d.case_date,
            has_summary=d.has_summary,
            uploaded_at=d.uploaded_at,
            processed_at=d.processed_at
        )
        for d in docs
    ]


@router.delete("/{document_id}")
def delete_document(
    document_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    # 1. Delete physical stored file
    stored_path = Path(settings.upload_dir) / doc.stored_filename
    if stored_path.exists():
        try:
            os.remove(stored_path)
        except Exception as e:
            logger.warning(f"Failed to delete stored file {stored_path}: {e}")

    # 2. Delete FAISS & BM25 indexes
    faiss_store = FAISSStore()
    faiss_store.delete_index(document_id)

    bm25_store = BM25Store()
    bm25_store.delete_index(document_id)

    # 3. Delete DB records
    # Delete summaries
    db.query(CaseSummary).filter(CaseSummary.document_id == document_id).delete()

    # Delete conversations and messages
    convs = db.query(Conversation).filter(Conversation.document_id == document_id).all()
    for conv in convs:
        db.query(Message).filter(Message.conversation_id == conv.id).delete()
    db.query(Conversation).filter(Conversation.document_id == document_id).delete()

    # Delete document
    db.delete(doc)
    db.commit()

    return {"status": "success", "message": f"Document {document_id} and associated data deleted"}


@router.get("/{document_id}/file")
def serve_document_file(
    document_id: str,
    token: Optional[str] = Query(None),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
    db: Session = Depends(get_db),
):
    """Serve the original PDF file for the in-browser PDF viewer.
    Supports Authorization Bearer header or ?token= query parameter.
    Validates document ownership and enforces path traversal security.
    """
    # 1. Resolve user from query param token or Authorization header
    user = None
    if credentials and credentials.credentials:
        user = get_user_from_raw_token(credentials.credentials, db)
    elif token:
        user = get_user_from_raw_token(token, db)

    if not user:
        # Fallback to demo user
        user = get_or_create_demo_user(db)

    # 2. Retrieve document
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # 3. Ownership and authorization check
    if doc.owner_id != user.id:
        # Check if single-user local environment (permit access if <= 2 registered users)
        total_users = db.query(User).count()
        if total_users > 2:
            raise HTTPException(status_code=404, detail="Document not found")

    # 4. Safe file path check (prevent path traversal)
    upload_dir = Path(settings.upload_dir).resolve()
    file_path = (upload_dir / doc.stored_filename).resolve()

    if not str(file_path).startswith(str(upload_dir)):
        raise HTTPException(status_code=403, detail="Access denied: invalid file path")

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="PDF file not found on server")

    return FileResponse(
        path=str(file_path),
        media_type="application/pdf",
        filename=doc.original_filename,
        headers={
            "Content-Disposition": f"inline; filename=\"{doc.original_filename}\"",
            "Accept-Ranges": "bytes",
            "X-Content-Type-Options": "nosniff",
        },
    )
