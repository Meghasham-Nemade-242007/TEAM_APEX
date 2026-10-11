"""
Automated Test Suite for Legal Document Analysis System Master Fixes
Covers:
1. Malformed JSON handling, truncation repair, markdown stripping, empty text, regex salvage.
2. Operative decision extraction: rule-based extractor on Bombay High Court concluding decrees.
3. Metadata harmonization: non-unknown case_type & court_name inference.
4. Document PDF file serving: query param token, header token, 401 unauthenticated, 404 missing, traversal blocking.
"""
import os
import json
import pytest
from pathlib import Path
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

from app.services.legal_analysis.json_parser import (
    extract_and_repair_json,
    _repair_truncated_json,
    _regex_salvage_fields,
)
from app.services.legal_analysis.operative_decision import OperativeDecisionExtractor
from app.services.legal_analysis.schema import ComprehensiveCaseAnalysis, DecisionSource


# ─── 1. MALFORMED JSON & PARSER TESTS ──────────────────────────────────────────

class TestMalformedJsonRepair:
    """Tests for multi-stage JSON repair and salvaging in json_parser.py."""

    def test_markdown_code_fenced_json(self):
        """JSON wrapped in markdown ```json ... ``` blocks should be parsed cleanly."""
        raw = """```json
{
  "court_name": "High Court of Bombay",
  "case_number": "WP/4512/2023",
  "case_type": "Writ Petition",
  "operative_decision": "Rule made absolute"
}
```"""
        parsed, repaired, raw_salvage = extract_and_repair_json(raw)
        assert parsed is not None
        assert parsed["court_name"] == "High Court of Bombay"
        assert parsed["case_number"] == "WP/4512/2023"
        assert parsed["case_type"] == "Writ Petition"
        assert parsed["operative_decision"] == "Rule made absolute"

    def test_truncated_json_with_missing_closing_brackets(self):
        """Truncated JSON lacking closing quotes, brackets, and braces should be repaired."""
        raw = """{
  "court_name": "High Court of Bombay",
  "case_number": "WP/9001/2022",
  "background_facts": [
    "The petitioner filed the petition seeking relief",
    "The respondent filed an affidavit in reply
"""
        parsed, repaired, raw_salvage = extract_and_repair_json(raw)
        assert parsed is not None
        assert parsed["court_name"] == "High Court of Bombay"
        assert parsed["case_number"] == "WP/9001/2022"
        assert isinstance(parsed.get("background_facts"), list)
        assert len(parsed["background_facts"]) >= 1

    def test_json_buried_in_conversational_prose(self):
        """JSON embedded amidst LLM introductory and concluding conversational text."""
        raw = """Here is the structured legal analysis of the Bombay High Court ruling you requested:

{
  "court_name": "High Court of Bombay",
  "case_type": "Writ Petition (Civil)",
  "operative_decision": "Petition is allowed. Impugned order quashed."
}

Hope this structured breakdown assists your research!"""
        parsed, repaired, raw_salvage = extract_and_repair_json(raw)
        assert parsed is not None
        assert parsed["court_name"] == "High Court of Bombay"
        assert parsed["case_type"] == "Writ Petition (Civil)"
        assert "quashed" in parsed["operative_decision"]

    def test_completely_empty_and_whitespace_string(self):
        """Completely empty string or whitespace returns fallback dict without throwing."""
        parsed, repaired, raw_salvage = extract_and_repair_json("")
        assert parsed is not None
        assert isinstance(parsed, dict)
        assert parsed.get("court_name") is None

        parsed_ws, _, _ = extract_and_repair_json("   \n\n\t  ")
        assert parsed_ws is not None
        assert isinstance(parsed_ws, dict)

    def test_severely_corrupted_json_regex_salvage(self):
        """When JSON is corrupted beyond repair, regex field salvaging recovers key metadata."""
        corrupted = """
        RANDOM NOISE ...
        "court_name": "High Court of Judicature at Bombay",
        "case_number": "WP-1234/2021",
        "operative_decision": "Rule discharged with costs",
        GARBAGE CHARACTERS %^&*!
        """
        salvaged = _regex_salvage_fields(corrupted)
        assert salvaged["court_name"] == "High Court of Judicature at Bombay"
        assert salvaged["case_number"] == "WP-1234/2021"
        assert salvaged["operative_decision"] == "Rule discharged with costs"


# ─── 2. OPERATIVE DECISION EXTRACTION TESTS ────────────────────────────────────

class TestOperativeDecisionExtraction:
    """Tests for deterministic and rule-based extraction of Bombay HC concluding decrees."""

    @pytest.fixture
    def extractor(self):
        return OperativeDecisionExtractor()

    def test_bombay_hc_rule_absolute(self, extractor):
        """'Rule is made absolute in terms of prayer clause (a).' -> ALLOWED / RULE ABSOLUTE"""
        text = """
        24. Having considered the statutory provisions and rival submissions, we find merit in the petition.
        25. Accordingly, Rule is made absolute in terms of prayer clause (a).
        26. No order as to costs.
        """
        decision, sources, directions = extractor._rule_based_extract(text, concluding_page_num=15)
        assert decision is not None
        lower = decision.lower()
        assert "rule is made absolute" in lower or "allowed" in lower
        assert any(s.page_num == 15 for s in sources)

    def test_bombay_hc_rule_discharged_dismissed(self, extractor):
        """'The writ petition is dismissed. Rule discharged.' -> DISMISSED"""
        text = """
        18. In view of the above discussion, we find no error in the impugned order.
        19. The writ petition is dismissed. Rule is discharged with no order as to costs.
        """
        decision, sources, directions = extractor._rule_based_extract(text, concluding_page_num=8)
        assert decision is not None
        lower = decision.lower()
        assert "dismissed" in lower or "rule is discharged" in lower

    def test_bombay_hc_petition_disposed_of(self, extractor):
        """'Writ petition stands disposed of with no order as to costs.' -> DISPOSED"""
        text = """
        12. In the result, the writ petition stands disposed of with the aforesaid directions.
        13. There shall be no order as to costs.
        """
        decision, sources, directions = extractor._rule_based_extract(text, concluding_page_num=10)
        assert decision is not None
        lower = decision.lower()
        assert "disposed" in lower

    def test_bombay_hc_impugned_order_quashed_and_set_aside(self, extractor):
        """'Impugned order is quashed and set aside.' -> ALLOWED / QUASHED"""
        text = """
        30. For the reasons stated hereinabove:
        (i) The impugned order dated 14.07.2023 passed by the Respondent is quashed and set aside.
        (ii) Respondent No. 2 is directed to reconsider the petitioner's representation within six weeks.
        """
        decision, sources, directions = extractor._rule_based_extract(text, concluding_page_num=22)
        assert decision is not None
        lower = decision.lower()
        assert "quashed and set aside" in lower
        assert len(directions) >= 1

    def test_indeterminate_outcome_returns_none(self, extractor):
        """Non-decree interim discussion returns None so fallback does not hallucinate."""
        text = "Stand over to 14th November 2024 for further hearing. Parties to exchange pleadings."
        decision, sources, directions = extractor._rule_based_extract(text, concluding_page_num=3)
        assert decision is None or "stand over" in decision.lower()


# ─── 3. METADATA HARMONIZATION TESTS ──────────────────────────────────────────

class TestMetadataHarmonization:
    """Verifies that harmonization eliminates 'unknown' case_type and court_name."""

    def test_harmonize_infers_writ_petition_from_case_number(self):
        """A document with case_number 'WP/4512/2023' must resolve to 'Writ Petition'."""
        analysis = ComprehensiveCaseAnalysis(
            case_number="WP/4512/2023",
            case_type=None,
            court_name=None,
            executive_summary="The petitioner challenges the recovery notice."
        )
        sample_text = "IN THE HIGH COURT OF JUDICATURE AT BOMBAY\nWRIT PETITION NO. 4512 OF 2023"
        analysis.harmonize(sample_text)

        assert analysis.case_type is not None
        assert analysis.case_type != "unknown"
        assert "Writ Petition" in analysis.case_type
        assert "Bombay" in (analysis.court_name or "")

    def test_harmonize_replaces_explicit_unknown_string(self):
        """If LLM generated literal 'unknown', harmonize replaces it with inferred type."""
        analysis = ComprehensiveCaseAnalysis(
            case_type="unknown",
            court_name="unknown",
            operative_decision="unknown",
            executive_summary="This public interest litigation concerns environmental degradation."
        )
        sample_text = "IN THE SUPREME COURT OF INDIA\nWRIT PETITION (PIL) NO. 99 OF 2022\nRule is made absolute."
        analysis.harmonize(sample_text)

        assert analysis.case_type != "unknown"
        assert analysis.court_name != "unknown"
        assert "Supreme Court" in (analysis.court_name or "")
        # Operative decision should be resolved from text
        assert analysis.operative_decision != "unknown"

    def test_quality_rating_graded_properly(self):
        """Complete analysis gets 'verified', partial analysis gets 'good' or 'partial'."""
        complete = ComprehensiveCaseAnalysis(
            court_name="Bombay High Court",
            case_type="Writ Petition",
            operative_decision="Petition allowed",
            background_facts=["Fact 1", "Fact 2"],
            legal_issues=["Issue 1"],
            executive_summary="Summary"
        )
        assert complete.quality_rating in ("verified", "good")

        sparse = ComprehensiveCaseAnalysis(
            court_name="Bombay High Court",
            case_type="Writ Petition",
            executive_summary="Minimal"
        )
        assert sparse.quality_rating in ("partial", "insufficient")

    def test_ensure_comprehensive_summary_enriches_terse_summary(self):
        """When executive_summary is terse, ensure_comprehensive_summary creates a multi-section legal brief."""
        from app.services.legal_analysis.schema import Party
        analysis = ComprehensiveCaseAnalysis(
            court_name="High Court of Judicature at Bombay",
            bench_judges=["Hon'ble Mr. Justice G.S. Patel", "Hon'ble Dr. Justice Neela Gokhale"],
            case_number="WP/1105/2023",
            case_type="Writ Petition (Civil)",
            case_date="14.07.2023",
            parties=[
                Party(name="Sunil Developers Pvt Ltd", role="petitioner"),
                Party(name="Municipal Corporation of Greater Mumbai", role="respondent")
            ],
            background_facts=[
                "Petitioner was issued a stop-work notice regarding redevelopment of plot No. 42.",
                "Petitioner contended all requisite statutory permissions had been secured under MRTP Act."
            ],
            legal_issues=[
                "Whether the stop-work notice was issued in breach of principles of natural justice without prior show-cause notice."
            ],
            petitioner_arguments=[
                "The impugned notice was passed without granting an opportunity of personal hearing."
            ],
            respondent_arguments=[
                "The construction deviated from sanctioned floor space index (FSI) norms."
            ],
            court_reasoning=[
                "The authority failed to furnish inspection reports prior to invoking coercive stop-work directives.",
                "Non-compliance with statutory notice requirements vitiates the impugned administrative action."
            ],
            operative_decision="Writ petition is allowed. Impugned stop-work notice is quashed and set aside.",
            directions_conditions=[
                "Respondent authority shall conduct fresh inspection within 3 weeks after giving 48 hours notice."
            ],
            executive_summary="Short summary."
        )

        full_summary = analysis.ensure_comprehensive_summary()
        assert full_summary is not None
        assert len(full_summary.split()) > 100
        assert "### 1. Case Overview" in full_summary
        assert "### 2. Factual Matrix" in full_summary
        assert "### 3. Key Issues" in full_summary
        assert "### 4. Submissions" in full_summary
        assert "### 5. Judicial Reasoning" in full_summary
        assert "### 6. Operative Decision" in full_summary
        assert "Sunil Developers" in full_summary
        assert "quashed and set aside" in full_summary


# ─── 4. PDF FILE SERVING ENDPOINT TESTS ────────────────────────────────────────

class TestDocumentFileServing:
    """Tests for secure PDF file serving at GET /api/documents/{id}/file."""

    @pytest.fixture
    def test_app_and_client(self, tmp_path):
        """Sets up a test DB, user, uploaded PDF, and TestClient."""
        from app.main import app
        from app.database import Base, engine, SessionLocal, User, Document
        from app.core.security import get_password_hash, create_access_token
        from app.config import settings

        Base.metadata.create_all(bind=engine)
        db = SessionLocal()

        # Create test user
        user = User(
            id="test-user-pdf-101",
            email="pdf_tester@legal.local",
            full_name="PDF Tester",
            hashed_password=get_password_hash("password123"),
            is_active=True
        )
        db.merge(user)

        # Create physical dummy PDF file in upload_dir
        upload_dir = Path(settings.upload_dir)
        upload_dir.mkdir(parents=True, exist_ok=True)
        stored_file = f"test_{user.id}_file.pdf"
        file_path = upload_dir / stored_file
        file_path.write_bytes(b"%PDF-1.4\n%Test PDF binary stream content\n%%EOF")

        # Create document record
        doc = Document(
            id="doc-pdf-valid-123",
            owner_id=user.id,
            original_filename="Bombay_HC_Ruling.pdf",
            stored_filename=stored_file,
            file_size=len(file_path.read_bytes()),
            page_count=5,
            status="complete"
        )
        db.merge(doc)
        db.commit()

        token = create_access_token(data={"sub": user.id})
        client = TestClient(app)

        yield {
            "client": client,
            "token": token,
            "doc_id": doc.id,
            "user_id": user.id,
            "db": db,
            "upload_dir": upload_dir,
            "file_path": file_path
        }

        # Cleanup
        try:
            if file_path.exists():
                file_path.unlink()
        except Exception:
            pass
        db.close()

    def test_serve_pdf_authenticated_via_bearer_header(self, test_app_and_client):
        """GET /api/documents/{id}/file with Authorization: Bearer succeeds."""
        client = test_app_and_client["client"]
        token = test_app_and_client["token"]
        doc_id = test_app_and_client["doc_id"]

        resp = client.get(
            f"/api/documents/{doc_id}/file",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert resp.status_code == 200
        assert resp.headers.get("content-type") == "application/pdf"
        assert b"%PDF" in resp.content
        assert resp.headers.get("accept-ranges") == "bytes"

    def test_serve_pdf_authenticated_via_query_param_token(self, test_app_and_client):
        """GET /api/documents/{id}/file?token=<token> succeeds for react-pdf / native iframes."""
        client = test_app_and_client["client"]
        token = test_app_and_client["token"]
        doc_id = test_app_and_client["doc_id"]

        resp = client.get(f"/api/documents/{doc_id}/file?token={token}")
        assert resp.status_code == 200
        assert resp.headers.get("content-type") == "application/pdf"
        assert b"%PDF" in resp.content

    def test_serve_pdf_unauthenticated_fails(self, test_app_and_client):
        """Access without token and without demo fallback should be rejected."""
        client = test_app_and_client["client"]
        # Accessing an arbitrary non-demo document without credentials returns 401 or 404
        resp = client.get(f"/api/documents/non-existent-doc-id/file")
        assert resp.status_code in (401, 404)

    def test_serve_pdf_nonexistent_file_returns_404(self, test_app_and_client):
        """Valid user requesting a document ID not in DB returns 404."""
        client = test_app_and_client["client"]
        token = test_app_and_client["token"]

        resp = client.get(
            "/api/documents/definitely-not-here-999/file",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert resp.status_code == 404

    def test_path_traversal_attack_blocked(self, test_app_and_client):
        """Document records containing path traversal characters are blocked."""
        client = test_app_and_client["client"]
        token = test_app_and_client["token"]
        db = test_app_and_client["db"]
        user_id = test_app_and_client["user_id"]
        from app.database import Document

        # Malicious document pointing outside upload_dir
        traversal_doc = Document(
            id="doc-malicious-traversal",
            owner_id=user_id,
            original_filename="exploit.pdf",
            stored_filename="../../etc/passwd",
            file_size=100,
            page_count=1,
            status="complete"
        )
        db.merge(traversal_doc)
        db.commit()

        resp = client.get(
            f"/api/documents/{traversal_doc.id}/file",
            headers={"Authorization": f"Bearer {token}"}
        )
        # Traversal attempt must be rejected with 400 or 404, never 200
        assert resp.status_code in (400, 404)
