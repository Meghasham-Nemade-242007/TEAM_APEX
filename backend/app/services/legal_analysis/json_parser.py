"""
JSON extraction, cleanup, and structural repair engine for LLM responses.
Handles markdown fences, truncated output, unclosed braces/quotes, and malformed JSON.
"""
import json
import logging
import re
from typing import Any, Dict, Optional, Tuple

logger = logging.getLogger(__name__)


class JSONParseError(Exception):
    """Custom exception categorized by root failure cause."""
    def __init__(self, message: str, category: str = "malformed_json", raw_snippet: str = ""):
        super().__init__(message)
        self.category = category
        self.raw_snippet = raw_snippet[:200]


def extract_and_repair_json(raw_text: Optional[str]) -> Dict[str, Any]:
    """
    Extracts a JSON object from raw LLM output, with multi-stage recovery:
    1. Check for empty response.
    2. Strip markdown code fences (```json ... ``` or ``` ... ```).
    3. Locate outer-most JSON object braces { ... }.
    4. Attempt standard json.loads.
    5. If truncated or malformed, attempt structural repair (close quotes, braces, brackets).
    6. If still failing, extract key-value pairs via regex.
    """
    if not raw_text or not raw_text.strip():
        raise JSONParseError(
            message="LLM returned an empty or whitespace-only response.",
            category="empty_response",
            raw_snippet=""
        )

    text = raw_text.strip()

    # Stage 1: Strip markdown code fences
    fence_pattern = r"```(?:json)?\s*([\s\S]*?)\s*```"
    fence_matches = re.findall(fence_pattern, text)
    if fence_matches:
        # Use the largest block if multiple
        candidate_text = max(fence_matches, key=len).strip()
    else:
        candidate_text = text

    # Stage 2: Isolate the JSON object between first '{' and last '}'
    first_brace = candidate_text.find("{")
    last_brace = candidate_text.rfind("}")

    if first_brace == -1:
        # No opening brace found at all
        raise JSONParseError(
            message="No JSON object found in LLM response (missing opening brace).",
            category="no_json_object",
            raw_snippet=candidate_text[:200]
        )

    if last_brace != -1 and last_brace > first_brace:
        json_candidate = candidate_text[first_brace : last_brace + 1]
    else:
        # Truncated response that ends before closing brace
        json_candidate = candidate_text[first_brace:]

    # Stage 3: Clean up common formatting anomalies
    cleaned = _sanitize_json_string(json_candidate)

    # Stage 4: Try standard parsing
    try:
        data = json.loads(cleaned)
        if isinstance(data, dict):
            return data
    except json.JSONDecodeError:
        pass

    # Stage 5: Structural repair for truncated / unclosed JSON
    repaired, repair_success = _repair_truncated_json(cleaned)
    if repair_success:
        try:
            data = json.loads(repaired)
            if isinstance(data, dict):
                logger.info("Successfully repaired truncated JSON from LLM response.")
                return data
        except json.JSONDecodeError:
            pass

    # Stage 6: Last-resort regex field extraction
    salvaged = _regex_salvage_fields(candidate_text)
    if salvaged and any(salvaged.values()):
        logger.warning("Salvaged partial legal metadata using regex field extractor.")
        return salvaged

    # Final error if all recovery paths failed
    raise JSONParseError(
        message="Unable to parse or repair structured JSON output from model.",
        category="malformed_json",
        raw_snippet=candidate_text[:200]
    )


def _sanitize_json_string(s: str) -> str:
    """Removes trailing commas and invalid control characters."""
    # Remove trailing commas before closing braces/brackets
    s = re.sub(r",\s*([\]}])", r"\1", s)
    # Remove single-line comments // ...
    s = re.sub(r"//.*?\n", "\n", s)
    return s.strip()


def _repair_truncated_json(s: str) -> Tuple[str, bool]:
    """
    Attempts to close unclosed strings, lists, and objects caused by token limits.
    """
    s = s.strip()
    # If unclosed quote, close it
    # Count quotes not preceded by backslash
    in_string = False
    escape = False
    open_brackets = []  # tracks '{' or '['

    for char in s:
        if escape:
            escape = False
            continue
        if char == "\\":
            escape = True
            continue
        if char == '"':
            in_string = not in_string
            continue
        if not in_string:
            if char in "{[":
                open_brackets.append(char)
            elif char in "}]":
                if open_brackets:
                    matching = "{" if char == "}" else "["
                    if open_brackets[-1] == matching:
                        open_brackets.pop()

    repaired = s
    # If terminated in the middle of a string, close quote
    if in_string:
        repaired += '"'

    # Strip any trailing comma or colon
    repaired = re.sub(r"[:,\s]+$", "", repaired)

    # Close remaining brackets/braces in reverse order
    for b in reversed(open_brackets):
        if b == "{":
            repaired += "}"
        elif b == "[":
            repaired += "]"

    # Sanitize trailing commas after repair
    repaired = re.sub(r",\s*([\]}])", r"\1", repaired)

    return repaired, len(open_brackets) > 0 or in_string


def _regex_salvage_fields(text: str) -> Dict[str, Any]:
    """
    Extracts individual fields with regex when the overall JSON structure is damaged.
    """
    salvaged: Dict[str, Any] = {}

    def extract_str(field_name: str) -> Optional[str]:
        m = re.search(rf'"{field_name}"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"', text)
        if m:
            return m.group(1).replace('\\"', '"').replace('\\n', '\n').strip()
        return None

    def extract_list_strs(field_name: str) -> list:
        m = re.search(rf'"{field_name}"\s*:\s*\[([\s\S]*?)\]', text)
        if m:
            items = re.findall(r'"([^"\\]*(?:\\.[^"\\]*)*)"', m.group(1))
            return [it.replace('\\"', '"').strip() for it in items if it.strip()]
        return []

    court = extract_str("court_name")
    if court:
        salvaged["court_name"] = court

    case_no = extract_str("case_number")
    if case_no:
        salvaged["case_number"] = case_no

    case_type = extract_str("case_type")
    if case_type:
        salvaged["case_type"] = case_type

    operative = extract_str("operative_decision")
    if operative:
        salvaged["operative_decision"] = operative

    summary = extract_str("executive_summary")
    if summary:
        salvaged["executive_summary"] = summary

    facts = extract_list_strs("background_facts")
    if facts:
        salvaged["background_facts"] = facts

    issues = extract_list_strs("legal_issues")
    if issues:
        salvaged["legal_issues"] = issues

    reasoning = extract_list_strs("court_reasoning")
    if reasoning:
        salvaged["court_reasoning"] = reasoning

    return salvaged
