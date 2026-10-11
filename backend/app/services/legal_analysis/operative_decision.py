"""
Dedicated Operative Decision & Final Order extraction and verification module.
Inspects concluding pages of Indian court judgments and orders to isolate the
court's actual final holding, directions, and costs with page attribution.
"""
import logging
import re
from typing import List, Optional, Tuple

from app.services.document_extraction.extractor import PageContent
from app.services.legal_analysis.schema import SourceReference
from app.services.legal_analysis.json_parser import extract_and_repair_json
from app.services.llm.provider import LLMProvider

logger = logging.getLogger(__name__)

# Standard Indian Court operative conclusion patterns
OPERATIVE_REGEX_PATTERNS = [
    # Bombay HC / High Courts / SC common phrases
    (r"(rule\s+is\s+made\s+absolute[^\.\n]*[\.\n]?)", "Rule Made Absolute"),
    (r"(rule\s+is\s+discharged[^\.\n]*[\.\n]?)", "Rule Discharged"),
    (r"((?:writ\s+)?petition\s+is\s+allowed[^\.\n]*[\.\n]?)", "Petition Allowed"),
    (r"((?:writ\s+)?petition\s+stands\s+allowed[^\.\n]*[\.\n]?)", "Petition Allowed"),
    (r"((?:writ\s+)?petition\s+is\s+dismissed[^\.\n]*[\.\n]?)", "Petition Dismissed"),
    (r"((?:writ\s+)?petition\s+stands\s+dismissed[^\.\n]*[\.\n]?)", "Petition Dismissed"),
    (r"((?:writ\s+)?petition\s+(?:is|stands)\s+disposed\s+of[^\.\n]*[\.\n]?)", "Petition Disposed Of"),
    (r"(appeal\s+is\s+allowed[^\.\n]*[\.\n]?)", "Appeal Allowed"),
    (r"(appeal\s+stands\s+allowed[^\.\n]*[\.\n]?)", "Appeal Allowed"),
    (r"(appeal\s+is\s+dismissed[^\.\n]*[\.\n]?)", "Appeal Dismissed"),
    (r"(impugned\s+(?:order|judgment)\s+is\s+(?:quashed|set\s+aside)[^\.\n]*[\.\n]?)", "Impugned Order Quashed/Set Aside"),
    (r"(matter\s+is\s+remanded\s+back[^\.\n]*[\.\n]?)", "Matter Remanded"),
    (r"(interim\s+relief\s+(?:granted\s+earlier\s+)?stands\s+vacated[^\.\n]*[\.\n]?)", "Interim Relief Vacated"),
    (r"(no\s+order\s+as\s+to\s+costs[^\.\n]*[\.\n]?)", "No Costs Order"),
]

SYSTEM_PROMPT_OPERATIVE = """You are a senior judicial research clerk specializing in Indian appellate and High Court judgments.
Your sole task is to isolate and extract the court's ACTUAL FINAL OPERATIVE ORDER from the concluding pages provided.

CRITICAL INSTRUCTIONS:
1. Distinguish the court's final decree from:
   - Relief prayed for in the petition (e.g. "Petitioner seeks a writ of...")
   - Submissions of counsel
   - Observations on interim applications
   - Operative orders of historical precedents cited in the text
2. Look specifically for concluding phrases:
   - "Rule is made absolute / discharged"
   - "Petition is allowed / dismissed / disposed of"
   - "Impugned order is quashed and set aside"
   - "Directions issued: ..."
   - "No order as to costs"
3. Cite the exact page number where the court delivers this order.
4. Output STRICT JSON adhering to this schema:
{
  "operative_decision": "Clear, precise statement of the operative holding and final order",
  "directions": ["Any specific directions, conditions, or deadlines ordered by the court"],
  "costs": "Cost award or 'No order as to costs'",
  "page_num": 1,
  "verbatim_passage": "Exact concluding sentence/passage containing the order"
}
If the concluding pages DO NOT contain an operative order, set "operative_decision" to null.
"""


class OperativeDecisionExtractor:
    def __init__(self, llm_provider: Optional[LLMProvider] = None):
        self.llm = llm_provider

    def _select_concluding_pages(self, pages: List[PageContent], num_pages: int = 3) -> List[PageContent]:
        """Returns the last 1-3 pages of the document where final decrees reside."""
        if not pages:
            return []
        return pages[-num_pages:] if len(pages) > num_pages else pages

    async def extract(
        self,
        pages: List[PageContent]
    ) -> Tuple[Optional[str], List[SourceReference], List[str]]:
        """
        Extracts operative decision and supporting citations using:
        1. Targeted LLM call on concluding pages (if configured).
        2. Rule-based regex parser fallback on concluding pages.
        Returns: (operative_decision, decision_sources, directions)
        """
        if not pages:
            return "Unable to determine from the available text (no pages extracted)", [], []

        concluding_pages = self._select_concluding_pages(pages, num_pages=3)
        concluding_text = "\n\n".join(
            f"--- [PAGE {p.page_num}] ---\n{p.text}" for p in concluding_pages if p.text.strip()
        )

        # 1. Attempt LLM extraction on concluding pages
        if self.llm and self.llm.is_configured() and concluding_text.strip():
            try:
                user_prompt = f"Extract the final operative order from these concluding judgment pages:\n\n{concluding_text}"
                raw_response = await self.llm.generate(
                    system_prompt=SYSTEM_PROMPT_OPERATIVE,
                    user_prompt=user_prompt,
                    temperature=0.0,
                    max_tokens=1024,
                )
                data = extract_and_repair_json(raw_response)
                decision = data.get("operative_decision")
                if decision and decision.strip() and decision.strip().lower() not in ["null", "none", "unknown"]:
                    page_num = data.get("page_num") or concluding_pages[-1].page_num
                    passage = data.get("verbatim_passage") or decision
                    directions = data.get("directions") or []
                    if isinstance(directions, str):
                        directions = [directions]

                    source = SourceReference(
                        page_num=int(page_num),
                        passage=str(passage)[:400],
                        confidence=0.95
                    )
                    logger.info(f"Targeted operative decision extracted on page {page_num}: {decision[:100]}")
                    return decision.strip(), [source], directions

            except Exception as e:
                logger.warning(f"Targeted LLM operative extraction failed: {e}. Falling back to rule-based parser.")

        # 2. Rule-based deterministic extraction on concluding pages
        rule_result = self._rule_based_extract(concluding_pages)
        if rule_result:
            decision, sources, directions = rule_result
            logger.info(f"Rule-based operative decision identified: {decision[:100]}")
            return decision, sources, directions

        # 3. If neither method found operative text (e.g. document is incomplete/truncated)
        return (
            "Unable to determine from the available text (final operative order not identified in concluding pages)",
            [],
            []
        )

    def _rule_based_extract(
        self,
        pages: List[PageContent]
    ) -> Optional[Tuple[str, List[SourceReference], List[str]]]:
        """
        Scans concluding pages in reverse (from last page backwards) for definitive court orders.
        """
        for page in reversed(pages):
            text = page.text
            if not text:
                continue

            # Check each known operative pattern
            for pattern, label in OPERATIVE_REGEX_PATTERNS:
                match = re.search(pattern, text, re.IGNORECASE)
                if match:
                    order_snippet = match.group(0).strip()
                    # Capture surrounding sentence / paragraph for context
                    start = max(0, match.start() - 60)
                    end = min(len(text), match.end() + 150)
                    context_snippet = text[start:end].replace("\n", " ").strip()

                    source = SourceReference(
                        page_num=page.page_num,
                        passage=context_snippet[:350],
                        confidence=0.90
                    )

                    # Look for cost orders
                    costs_match = re.search(r"no\s+order\s+as\s+to\s+costs", text, re.IGNORECASE)
                    directions = []
                    if costs_match:
                        directions.append("No order as to costs.")

                    decision_text = f"The {label.lower()}: \"{order_snippet}\""
                    return decision_text, [source], directions

        return None
