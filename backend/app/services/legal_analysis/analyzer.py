"""
Legal analysis extraction orchestrator with structured JSON recovery,
metadata harmonization, and dedicated operative decree verification.
"""
import logging
from typing import List, Optional

from app.services.document_extraction.extractor import PageContent
from app.services.legal_analysis.prompts import (
    SYSTEM_PROMPT_EXTRACTION,
    EXTRACTION_USER_TEMPLATE,
    SYSTEM_PROMPT_DEEP_SUMMARY,
    DEEP_SUMMARY_USER_TEMPLATE,
)
from app.services.legal_analysis.schema import CaseAnalysis, SourceReference, Party, LegalProvision, CitedPrecedent
from app.services.legal_analysis.json_parser import extract_and_repair_json, JSONParseError
from app.services.legal_analysis.operative_decision import OperativeDecisionExtractor
from app.services.llm.provider import LLMProvider
from app.services.llm.gemini import GeminiProvider

logger = logging.getLogger(__name__)


class LegalAnalyzer:
    def __init__(self, llm_provider: Optional[LLMProvider] = None):
        self.llm = llm_provider or GeminiProvider()
        self.operative_extractor = OperativeDecisionExtractor(self.llm)

    async def _generate_deep_summary(
        self,
        pages: List[PageContent],
        analysis: CaseAnalysis,
        doc_id: str
    ) -> Optional[str]:
        """Generates an in-depth, structured 400-600 word case briefing using Gemini."""
        if not self.llm.is_configured():
            return None

        try:
            doc_sample = self._build_text_sample(pages, max_pages=20)
            context_items = []
            if analysis.court_name:
                context_items.append(f"Court: {analysis.court_name}")
            if analysis.case_number:
                context_items.append(f"Case No: {analysis.case_number}")
            if analysis.operative_decision:
                context_items.append(f"Operative Decision: {analysis.operative_decision}")
            if analysis.directions_conditions:
                context_items.append(f"Directives: {'; '.join(analysis.directions_conditions[:4])}")
            if analysis.legal_issues:
                context_items.append(f"Legal Issues: {'; '.join(analysis.legal_issues[:3])}")

            prompt = DEEP_SUMMARY_USER_TEMPLATE.format(
                document_text=doc_sample,
                extracted_context="\n".join(context_items) if context_items else "None available yet"
            )
            deep_summary = await self.llm.generate(
                system_prompt=SYSTEM_PROMPT_DEEP_SUMMARY,
                user_prompt=prompt,
                temperature=0.1,
                max_tokens=3000,
                json_mode=False
            )
            if deep_summary and len(deep_summary.strip().split()) >= 100:
                return deep_summary.strip()
        except Exception as e:
            logger.warning(f"Dedicated deep summary generation encountered notice for {doc_id}: {e}")
        return None

    def _build_text_sample(self, pages: List[PageContent], max_pages: int = 25) -> str:
        """
        Builds a representative document text sample prioritising:
        - First 8 pages (Header, Parties, Court, Issues)
        - Last 5 pages (Final Arguments, Findings, Operative Decree)
        - Selected middle pages (Reasoning, Statutes)
        """
        if not pages:
            return ""

        if len(pages) <= max_pages:
            selected_pages = pages
        else:
            first_pages = pages[:10]
            last_pages = pages[-6:]
            middle_step = max(1, (len(pages) - 16) // (max_pages - 16))
            middle_pages = pages[10:-6:middle_step]
            selected_pages = sorted(list({p.page_num: p for p in (first_pages + middle_pages + last_pages)}.values()), key=lambda p: p.page_num)

        formatted = []
        for p in selected_pages:
            if p.text and p.text.strip():
                formatted.append(f"--- [PAGE {p.page_num}] ---\n{p.text[:3500]}")

        return "\n\n".join(formatted)

    def _basic_fallback_analysis(self, pages: List[PageContent], reason: str) -> CaseAnalysis:
        """Deterministic rule-based fallback when LLM is unavailable."""
        first_page_text = pages[0].text if pages else ""
        first_lines = [l.strip() for l in first_page_text.split("\n") if l.strip()][:25]

        court_guess = None
        case_no_guess = None

        for line in first_lines:
            if any(k in line.lower() for k in ["court", "tribunal", "judicature"]):
                court_guess = line[:120]
                break

        for line in first_lines:
            if any(k in line.lower() for k in ["petition", "appeal", "suit", "no.", "w.p", "crl"]):
                case_no_guess = line[:100]
                break

        summary_preview = " ".join(first_lines[:4])

        analysis = CaseAnalysis(
            court_name=court_guess,
            case_number=case_no_guess,
            executive_summary=f"Automated initial review. Text excerpt: {summary_preview}",
            uncertainties=[f"Analysis generated via fallback heuristic: {reason}"],
            extraction_quality="partial"
        )
        # Harmonize metadata
        analysis.harmonize(first_page_text)
        analysis.ensure_comprehensive_summary()
        return analysis

    async def analyze(self, pages: List[PageContent], doc_id: str) -> CaseAnalysis:
        """
        Orchestrates full structured extraction:
        1. Substantive legal extraction via LLM with JSON repair.
        2. Dedicated concluding-page operative decree extraction.
        3. Deep multi-section legal briefing generation / synthesis.
        4. Metadata harmonization (Writ Petition, High Court detection).
        5. Quality verification.
        """
        if not pages:
            return CaseAnalysis(
                executive_summary="Empty document: no extractable pages found.",
                uncertainties=["No pages were extracted from document."],
                extraction_quality="insufficient"
            )

        full_doc_text = "\n".join(p.text[:1000] for p in pages[:5])

        if not self.llm.is_configured():
            logger.warning("LLM provider is not configured. Falling back to heuristic extraction.")
            fallback = self._basic_fallback_analysis(pages, "LLM provider unconfigured")
            # Still run rule-based operative decision extraction on concluding pages!
            op_decision, op_sources, op_directions = await self.operative_extractor.extract(pages)
            if op_decision:
                fallback.operative_decision = op_decision
                fallback.decision_sources = op_sources
                fallback.directions_conditions = op_directions
            fallback.ensure_comprehensive_summary()
            return fallback

        document_text = self._build_text_sample(pages, max_pages=25)
        user_prompt = EXTRACTION_USER_TEMPLATE.format(document_text=document_text)

        analysis = None

        try:
            raw_response = await self.llm.generate(
                system_prompt=SYSTEM_PROMPT_EXTRACTION,
                user_prompt=user_prompt,
                temperature=0.0,
                max_tokens=8192,
                json_mode=True
            )

            # Robust JSON extraction and repair
            parsed_data = extract_and_repair_json(raw_response)

            # Normalize list fields
            for list_field in [
                "background_facts", "legal_issues", "petitioner_arguments",
                "respondent_arguments", "court_reasoning", "uncertainties",
                "bench_judges", "counsel_details", "procedural_history",
                "findings_and_holdings", "directions_conditions"
            ]:
                if list_field in parsed_data and isinstance(parsed_data[list_field], str):
                    parsed_data[list_field] = [parsed_data[list_field]]

            analysis = CaseAnalysis(**parsed_data)

        except JSONParseError as jpe:
            logger.warning(f"JSON recovery triggered for doc {doc_id}: {jpe.message}")
            analysis = self._basic_fallback_analysis(pages, f"Structured output recovery: {jpe.category}")

        except Exception as e:
            logger.error(f"Analysis LLM generation failed for doc {doc_id}: {e}")
            analysis = self._basic_fallback_analysis(pages, f"LLM error: {str(e)[:80]}")

        # Step 2: Dedicated Operative Decision Extraction & Verification
        # If operative decision is missing, vague, or "unknown", run targeted concluding-page extraction
        needs_op_extraction = (
            not analysis.operative_decision
            or analysis.operative_decision.strip().lower() in [
                "unknown", "none", "null", "", "unable to determine from the available text"
            ]
            or len(analysis.decision_sources) == 0
        )

        if needs_op_extraction:
            logger.info(f"Running dedicated operative decree extraction for doc {doc_id} on concluding pages...")
            op_decision, op_sources, op_directions = await self.operative_extractor.extract(pages)
            if op_decision:
                analysis.operative_decision = op_decision
                analysis.decision_sources = op_sources
                if op_directions and not analysis.directions_conditions:
                    analysis.directions_conditions = op_directions

        # Step 3: Deep Legal Summary Generation & Enrichment
        # If executive_summary is brief (< 160 words) or lacks markdown sections, enhance it!
        curr_words = len((analysis.executive_summary or "").split())
        if curr_words < 160 or "###" not in (analysis.executive_summary or ""):
            logger.info(f"Summary for doc {doc_id} is brief ({curr_words} words). Generating in-depth legal briefing...")
            deep_brief = await self._generate_deep_summary(pages, analysis, doc_id)
            if deep_brief and len(deep_brief.split()) >= 100:
                analysis.executive_summary = deep_brief
            else:
                analysis.ensure_comprehensive_summary()
        else:
            analysis.ensure_comprehensive_summary()

        # Step 4: Harmonize Metadata (Case Type, Court Name, Document Type)
        analysis.harmonize(full_doc_text)

        # Step 5: Quality Assessment
        has_decision = bool(analysis.operative_decision and "unable to determine" not in analysis.operative_decision.lower())
        has_metadata = bool(analysis.court_name and analysis.case_number)
        has_reasoning = bool(len(analysis.court_reasoning) > 0 or len(analysis.background_facts) > 0)

        if has_decision and has_metadata and has_reasoning:
            analysis.extraction_quality = "verified"
        elif has_metadata and (has_decision or has_reasoning):
            analysis.extraction_quality = "good"
        else:
            analysis.extraction_quality = "partial"

        return analysis
