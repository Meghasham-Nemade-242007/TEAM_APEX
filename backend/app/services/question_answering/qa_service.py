import json
import logging
import re
from typing import List, Optional, Dict, Any
from pydantic import BaseModel

from app.services.llm.provider import LLMProvider
from app.services.llm.gemini import GeminiProvider
from app.services.retrieval.hybrid import HybridRetriever, RetrievedPassage
from app.services.legal_analysis.prompts import SYSTEM_PROMPT_QA, QA_USER_TEMPLATE

logger = logging.getLogger(__name__)

class Citation(BaseModel):
    text: str
    page_num: int
    passage: str

class QAResponse(BaseModel):
    answer: str
    reasoning: str = ""
    citations: List[Citation] = []
    uncertainty: str = "none"
    passages: List[RetrievedPassage] = []

class QAService:
    def __init__(
        self,
        retriever: Optional[HybridRetriever] = None,
        llm_provider: Optional[LLMProvider] = None
    ):
        self.retriever = retriever or HybridRetriever()
        self.llm = llm_provider or GeminiProvider()

    def _extract_json_string(self, text: str) -> str:
        text = text.strip()
        fence_match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
        if fence_match:
            return fence_match.group(1).strip()
        brace_match = re.search(r"(\{.*\})", text, re.DOTALL)
        if brace_match:
            return brace_match.group(1).strip()
        return text

    def _format_context_passages(self, passages: List[RetrievedPassage]) -> str:
        if not passages:
            return "No relevant passages found in document."
        formatted = []
        for i, p in enumerate(passages, start=1):
            heading_info = f" [Section: {p.section_heading}]" if p.section_heading else ""
            formatted.append(f"Passage [{i}] (Page {p.page_num}, Para {p.para_num}{heading_info}):\n{p.text}")
        return "\n\n".join(formatted)

    def _format_history(self, history: List[Dict[str, Any]]) -> str:
        if not history:
            return "None"
        recent = history[-4:]
        formatted = []
        for turn in recent:
            role = turn.get("role", "user").capitalize()
            content = turn.get("content", "")
            formatted.append(f"{role}: {content}")
        return "\n".join(formatted)

    def _validate_citations(self, citations_raw: List[Dict[str, Any]], passages: List[RetrievedPassage]) -> List[Citation]:
        valid_page_nums = {p.page_num for p in passages}
        validated = []
        for c in citations_raw:
            page_num = c.get("page_num", 1)
            # Default to first available passage page if page_num is not in context
            if page_num not in valid_page_nums and passages:
                page_num = passages[0].page_num

            validated.append(Citation(
                text=str(c.get("text", "")),
                page_num=int(page_num),
                passage=str(c.get("passage", ""))
            ))
        return validated

    async def answer(
        self,
        question: str,
        doc_id: str,
        conversation_history: Optional[List[Dict[str, Any]]] = None
    ) -> QAResponse:
        """
        Answer questions regarding a legal document using hybrid retrieval and grounded LLM synthesis.
        """
        history = conversation_history or []
        passages = self.retriever.retrieve(query=question, doc_id=doc_id, top_k=6)

        if not passages:
            return QAResponse(
                answer="No relevant passages could be found in the document to answer this question.",
                reasoning="The hybrid search returned no matching passages for the query.",
                citations=[],
                uncertainty="No document context found.",
                passages=[]
            )

        if not self.llm.is_configured():
            # Return context excerpt fallback
            top_passages_summary = "\n\n".join([f"(Page {p.page_num}): {p.text[:300]}..." for p in passages[:2]])
            return QAResponse(
                answer=f"AI model is currently unconfigured. Relevant passages identified from document:\n\n{top_passages_summary}",
                reasoning="Retrieved directly from hybrid semantic index without LLM synthesis.",
                citations=[Citation(text="Relevant passage", page_num=p.page_num, passage=p.text[:200]) for p in passages[:2]],
                uncertainty="LLM provider unconfigured",
                passages=passages
            )

        context_text = self._format_context_passages(passages)
        history_text = self._format_history(history)
        user_prompt = QA_USER_TEMPLATE.format(
            context_passages=context_text,
            conversation_history=history_text,
            question=question
        )

        try:
            raw_response = await self.llm.generate(
                system_prompt=SYSTEM_PROMPT_QA,
                user_prompt=user_prompt,
                temperature=0.1,
                max_tokens=2048
            )

            cleaned_json = self._extract_json_string(raw_response)
            parsed = json.loads(cleaned_json)
            if not isinstance(parsed, dict):
                parsed = {"answer": raw_response}

            citations_raw = parsed.get("citations", [])
            citations = self._validate_citations(citations_raw, passages)

            return QAResponse(
                answer=parsed.get("answer", raw_response),
                reasoning=parsed.get("reasoning", ""),
                citations=citations,
                uncertainty=parsed.get("uncertainty", "none"),
                passages=passages
            )

        except json.JSONDecodeError:
            logger.warning("Failed to decode JSON from QA model, using text output")
            return QAResponse(
                answer=raw_response,
                reasoning="Extracted directly from LLM text response.",
                citations=[Citation(text="Excerpt", page_num=p.page_num, passage=p.text[:150]) for p in passages[:2]],
                uncertainty="Model did not return structured JSON format.",
                passages=passages
            )
        except Exception as e:
            logger.error(f"Error during QA generation: {e}")
            return QAResponse(
                answer="An error occurred while analyzing the document to answer your question.",
                reasoning=str(e),
                citations=[],
                uncertainty=f"Generation exception: {e}",
                passages=passages
            )
