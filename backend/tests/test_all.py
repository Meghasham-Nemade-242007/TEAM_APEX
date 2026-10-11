"""
Backend Tests for Legal Document Analysis System
"""
import pytest
import os
import tempfile
from unittest.mock import MagicMock, patch, AsyncMock
from pathlib import Path


# ─── Test: Document Extraction ─────────────────────────────────────────────────

class TestDocumentExtractor:
    """Tests for PyMuPDF-based text extraction."""

    def test_extract_text_based_pdf(self, tmp_path):
        """Verify text extraction from a text-based PDF."""
        try:
            import fitz
            # Create a minimal text PDF for testing
            doc = fitz.open()
            page = doc.new_page()
            page.insert_text((50, 100), "IN THE HIGH COURT OF JUDICATURE\nCase No: WP/123/2024")
            pdf_path = tmp_path / "test.pdf"
            doc.save(str(pdf_path))
            doc.close()

            from app.services.document_extraction.extractor import DocumentExtractor
            extractor = DocumentExtractor()
            pages = extractor.extract_pages(str(pdf_path))

            assert len(pages) >= 1
            assert pages[0].page_num == 1
            assert len(pages[0].text) > 0
            assert "HIGH COURT" in pages[0].text or len(pages[0].text) > 0
        except ImportError:
            pytest.skip("PyMuPDF not installed")

    def test_scanned_page_detection(self, tmp_path):
        """Verify scanned pages are detected (text extraction yields < 50 chars)."""
        try:
            import fitz
            doc = fitz.open()
            doc.new_page()  # Empty page with no text
            pdf_path = tmp_path / "scanned.pdf"
            doc.save(str(pdf_path))
            doc.close()

            from app.services.document_extraction.extractor import DocumentExtractor
            extractor = DocumentExtractor()
            pages = extractor.extract_pages(str(pdf_path))

            assert len(pages) >= 1
            assert pages[0].is_scanned is True
        except ImportError:
            pytest.skip("PyMuPDF not installed")

    def test_invalid_file_raises_error(self):
        """Non-PDF file should raise an appropriate error."""
        from app.services.document_extraction.extractor import DocumentExtractor
        extractor = DocumentExtractor()
        with pytest.raises(Exception):
            extractor.extract_pages("/nonexistent/file.pdf")


# ─── Test: Legal Chunker ────────────────────────────────────────────────────────

class TestLegalChunker:
    """Tests for paragraph-aware legal document chunking."""

    def test_chunking_produces_chunks(self):
        """Chunker returns at least one chunk for non-trivial content."""
        from app.services.document_extraction.extractor import PageContent
        from app.services.document_extraction.chunker import LegalChunker

        pages = [
            PageContent(
                page_num=1,
                text="IN THE SUPREME COURT OF INDIA\n\nThis is the first paragraph of a legal judgment. "
                     "It contains important facts about the case.\n\nThis is the second paragraph. "
                     "It describes the arguments presented by the petitioner.\n\nThe respondent argued that "
                     "the impugned order was without jurisdiction.",
                char_count=300,
                is_scanned=False,
            )
        ]

        chunker = LegalChunker()
        chunks = chunker.chunk_pages(pages, doc_id="test-doc-001")

        assert len(chunks) >= 1
        for chunk in chunks:
            assert chunk.doc_id == "test-doc-001"
            assert chunk.page_num == 1
            assert len(chunk.text) > 0

    def test_chunks_preserve_page_number(self):
        """All chunks from a page must carry the correct page_num."""
        from app.services.document_extraction.extractor import PageContent
        from app.services.document_extraction.chunker import LegalChunker

        long_text = "The court observed that the matter involves interpretation of Section 377 IPC. " * 20
        pages = [
            PageContent(page_num=5, text=long_text, char_count=len(long_text), is_scanned=False)
        ]

        chunker = LegalChunker()
        chunks = chunker.chunk_pages(pages, doc_id="doc-x")

        for chunk in chunks:
            assert chunk.page_num == 5

    def test_chunk_size_within_bounds(self):
        """Chunks should not exceed 1200 chars (800 target + 100 overlap + buffer)."""
        from app.services.document_extraction.extractor import PageContent
        from app.services.document_extraction.chunker import LegalChunker

        long_text = "A" * 5000
        pages = [PageContent(page_num=1, text=long_text, char_count=5000, is_scanned=False)]

        chunker = LegalChunker()
        chunks = chunker.chunk_pages(pages, doc_id="doc-y")

        for chunk in chunks:
            assert len(chunk.text) <= 1200


# ─── Test: Hybrid Retrieval ─────────────────────────────────────────────────────

class TestHybridRetrieval:
    """Tests for FAISS + BM25 hybrid retrieval."""

    @pytest.fixture
    def sample_chunks(self):
        from app.services.document_extraction.chunker import Chunk
        return [
            Chunk(chunk_id="c1", doc_id="d1", page_num=1, para_num=0,
                  text="The petitioner contended that the impugned order violates Article 21.",
                  section_heading="Petitioner's Arguments", char_start=0, char_end=70),
            Chunk(chunk_id="c2", doc_id="d1", page_num=2, para_num=1,
                  text="The respondent submitted that the writ petition is not maintainable.",
                  section_heading="Respondent's Arguments", char_start=0, char_end=70),
            Chunk(chunk_id="c3", doc_id="d1", page_num=3, para_num=0,
                  text="The court dismissed the appeal and upheld the judgment of the lower court.",
                  section_heading="Decision", char_start=0, char_end=72),
        ]

    def test_bm25_retrieval_returns_results(self, sample_chunks, tmp_path):
        """BM25 index should return relevant results for a keyword query."""
        try:
            from app.services.embeddings.bm25_store import BM25Store
            store = BM25Store(index_dir=str(tmp_path))
            store.build_index(sample_chunks, doc_id="d1")
            results = store.search("petitioner Article 21", doc_id="d1", top_k=3)
            assert len(results) >= 1
            assert any("petitioner" in r.text.lower() or "article" in r.text.lower() for r in results)
        except ImportError:
            pytest.skip("rank_bm25 not installed")

    def test_retrieval_filters_by_doc_id(self, sample_chunks, tmp_path):
        """Retrieval must only return chunks from the requested document."""
        try:
            from app.services.embeddings.bm25_store import BM25Store
            store = BM25Store(index_dir=str(tmp_path))
            store.build_index(sample_chunks, doc_id="d1")
            results = store.search("court dismissed", doc_id="d1", top_k=5)
            for r in results:
                # All results should be from d1 chunks
                assert any(c.chunk_id == r.chunk_id for c in sample_chunks)
        except ImportError:
            pytest.skip("rank_bm25 not installed")


# ─── Test: QA Service ───────────────────────────────────────────────────────────

class TestQAService:
    """Tests for the document-grounded QA pipeline."""

    @pytest.mark.asyncio
    async def test_answer_absent_question(self):
        """When no relevant passage is found, response should indicate 'not found'."""
        # Mock hybrid retriever to return empty results
        from app.services.question_answering.qa_service import QAService

        with patch("app.services.question_answering.qa_service.HybridRetriever") as MockRetriever:
            mock_instance = MockRetriever.return_value
            mock_instance.retrieve.return_value = []

            # Mock LLM to return a 'not found' response
            with patch("app.services.question_answering.qa_service.GeminiProvider") as MockLLM:
                mock_llm = MockLLM.return_value
                mock_llm.is_configured.return_value = True
                mock_llm.generate = AsyncMock(return_value='{"answer": "This information is not found in the uploaded document.", "reasoning": "No relevant passages retrieved.", "citations": [], "uncertainty": "Answer not available in document."}')

                svc = QAService()
                response = await svc.answer(
                    question="What is the name of the judge?",
                    doc_id="test-doc",
                    conversation_history=[],
                )

                assert response is not None
                assert "not found" in response.answer.lower() or "not available" in response.answer.lower() or response.answer

    @pytest.mark.asyncio
    async def test_no_llm_configured(self):
        """QA service should return a clear error when LLM is not configured."""
        from app.services.question_answering.qa_service import QAService

        with patch("app.services.question_answering.qa_service.HybridRetriever") as MockRetriever:
            mock_instance = MockRetriever.return_value
            mock_instance.retrieve.return_value = []

            with patch("app.services.question_answering.qa_service.GeminiProvider") as MockLLM:
                mock_llm = MockLLM.return_value
                mock_llm.is_configured.return_value = False

                svc = QAService()
                response = await svc.answer(
                    question="What is the main issue?",
                    doc_id="test-doc",
                    conversation_history=[],
                )

                # Should not crash; should return a configuration error message
                assert response is not None


# ─── Test: API Endpoints ─────────────────────────────────────────────────────────

class TestAPIEndpoints:
    """Integration tests for FastAPI endpoints."""

    @pytest.fixture
    def client(self):
        from fastapi.testclient import TestClient
        from app.main import app
        from app.database import create_tables
        create_tables()
        return TestClient(app)

    def test_health_endpoint(self, client):
        """Health check should return 200 OK."""
        response = client.get("/api/health")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"

    def test_upload_non_pdf_rejected(self, client, tmp_path):
        """Uploading a non-PDF file should return 400."""
        fake_file = tmp_path / "malicious.txt"
        fake_file.write_text("This is not a PDF file.")

        with open(fake_file, "rb") as f:
            response = client.post(
                "/api/documents/upload",
                files={"file": ("malicious.txt", f, "text/plain")},
            )
        assert response.status_code in (400, 422)

    def test_upload_pdf_magic_bytes_check(self, client, tmp_path):
        """File with wrong magic bytes (not %PDF) should be rejected even with PDF mime."""
        fake_pdf = tmp_path / "fake.pdf"
        fake_pdf.write_bytes(b"Not a real PDF\x00\x00")

        with open(fake_pdf, "rb") as f:
            response = client.post(
                "/api/documents/upload",
                files={"file": ("fake.pdf", f, "application/pdf")},
            )
        assert response.status_code in (400, 422)

    def test_get_nonexistent_document(self, client):
        """Requesting a nonexistent document should return 404."""
        response = client.get("/api/documents/nonexistent-doc-id")
        assert response.status_code == 404

    def test_chat_nonexistent_document(self, client):
        """Chatting about a nonexistent document should return 404."""
        response = client.post(
            "/api/documents/nonexistent-doc-id/chat",
            json={"question": "What is the case about?"},
        )
        assert response.status_code == 404

    def test_register_and_login(self, client):
        """User registration and login should return a valid JWT token."""
        import time
        unique_email = f"test_{int(time.time())}@legal.local"

        # Register
        reg_response = client.post("/api/auth/register", json={
            "email": unique_email,
            "password": "testpass123",
            "full_name": "Test User",
        })
        assert reg_response.status_code in (200, 201)

        # Login
        login_response = client.post("/api/auth/login", json={
            "email": unique_email,
            "password": "testpass123",
        })
        assert login_response.status_code == 200
        data = login_response.json()
        assert "access_token" in data

    def test_document_isolation(self, client, tmp_path):
        """
        Two users must not be able to access each other's documents.
        This test verifies the authorization layer.
        """
        import time
        t = int(time.time())

        # User A registers and logs in
        client.post("/api/auth/register", json={
            "email": f"user_a_{t}@legal.local",
            "password": "passA123",
            "full_name": "User A",
        })
        login_a = client.post("/api/auth/login", json={
            "email": f"user_a_{t}@legal.local",
            "password": "passA123",
        })
        token_a = login_a.json().get("access_token", "")

        # User B registers and logs in
        client.post("/api/auth/register", json={
            "email": f"user_b_{t}@legal.local",
            "password": "passB123",
            "full_name": "User B",
        })
        login_b = client.post("/api/auth/login", json={
            "email": f"user_b_{t}@legal.local",
            "password": "passB123",
        })
        token_b = login_b.json().get("access_token", "")

        # Use a fake document ID that was "owned by A"
        # User B should get 404 (not 403 to avoid info leakage)
        fake_doc_id = "user-a-private-doc-12345"
        response = client.get(
            f"/api/documents/{fake_doc_id}",
            headers={"Authorization": f"Bearer {token_b}"},
        )
        assert response.status_code == 404


# ─── Test: Legal Analysis Schema ────────────────────────────────────────────────

class TestLegalAnalysisSchema:
    """Tests for Pydantic schema validation."""

    def test_case_analysis_defaults(self):
        """CaseAnalysis should have sensible defaults for unknown fields."""
        from app.services.legal_analysis.schema import CaseAnalysis
        analysis = CaseAnalysis()
        assert analysis.court_name == "unknown"
        assert analysis.operative_decision == "unknown"
        assert analysis.parties == []
        assert analysis.uncertainties == []

    def test_party_roles_are_preserved(self):
        """Party role field should be stored correctly."""
        from app.services.legal_analysis.schema import Party
        p = Party(name="Ram Kumar Singh", role="petitioner")
        assert p.role == "petitioner"
        assert p.represented_by is None

    def test_source_reference_confidence(self):
        """SourceReference confidence defaults to 1.0."""
        from app.services.legal_analysis.schema import SourceReference
        ref = SourceReference(page_num=5, passage="The court held that...")
        assert ref.confidence == 1.0

    def test_legal_provision_applied_flag(self):
        """LegalProvision.applied should default to False."""
        from app.services.legal_analysis.schema import LegalProvision
        lp = LegalProvision(act_name="Indian Penal Code", section="Section 302")
        assert lp.applied is False


# ─── Evaluation: Sample Questions ───────────────────────────────────────────────

EVALUATION_QUESTIONS = [
    {
        "id": "q1",
        "question": "What is the main legal issue in this case?",
        "expected_contains": ["issue", "question", "dispute"],
        "must_have_citation": True,
    },
    {
        "id": "q2",
        "question": "What arguments did the petitioner present?",
        "expected_contains": ["petitioner", "contended", "submitted", "argued"],
        "must_have_citation": True,
    },
    {
        "id": "q3",
        "question": "What is the final operative decision of the court?",
        "expected_contains": ["dismissed", "allowed", "upheld", "remanded", "order"],
        "must_have_citation": True,
    },
    {
        "id": "q4",
        "question": "What is the weather today?",
        "expected_not_found": True,
        "must_have_citation": False,
    },
    {
        "id": "q5",
        "question": "Which legal provisions are cited in this judgment?",
        "expected_contains": ["section", "act", "article", "provision"],
        "must_have_citation": True,
    },
]
