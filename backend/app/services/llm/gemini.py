"""
Gemini LLM Provider with dynamic model discovery, safe text extraction,
JSON response mode support, and candidate fallback.
"""
import asyncio
import logging
from typing import List, Optional
import google.generativeai as genai
from google.generativeai.types import HarmCategory, HarmBlockThreshold

from app.config import settings
from app.services.llm.provider import LLMProvider

logger = logging.getLogger(__name__)


def _extract_text_from_response(response) -> str:
    """
    Safely extract generated text from a Gemini response object
    without triggering ValueError on non-standard finish reasons or multi-part structures.
    """
    if not response:
        return ""

    # 1. Try standard response.text quick accessor
    try:
        if hasattr(response, "text") and response.text:
            return response.text.strip()
    except Exception:
        pass

    # 2. Inspect candidates and parts directly
    try:
        candidates = getattr(response, "candidates", None)
        if candidates and len(candidates) > 0:
            for cand in candidates:
                content = getattr(cand, "content", None)
                if content and getattr(content, "parts", None):
                    text_parts = []
                    for part in content.parts:
                        part_text = getattr(part, "text", "")
                        if part_text:
                            text_parts.append(part_text)
                    if text_parts:
                        return "".join(text_parts).strip()
    except Exception as e:
        logger.debug(f"Direct candidate inspection failed: {e}")

    return ""


class GeminiProvider(LLMProvider):
    _cached_working_model: Optional[str] = None

    def __init__(self, api_key: Optional[str] = None, model_name: Optional[str] = None):
        self.api_key = api_key or settings.gemini_api_key
        self.preferred_model_name = model_name or settings.llm_model or "gemini-1.5-flash"
        self._initialized = False

        if self.api_key and self.api_key.strip() and not self.api_key.startswith("your-"):
            try:
                genai.configure(api_key=self.api_key)
                self._initialized = True
            except Exception as e:
                logger.error(f"Failed to configure Gemini API: {e}")

    def is_configured(self) -> bool:
        return bool(self._initialized and self.api_key and self.api_key.strip() and not self.api_key.startswith("your-"))

    def _get_safety_settings(self):
        # Permissive safety settings for legal content (crimes, disputes, citations in evidence)
        return {
            HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_NONE,
            HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_NONE,
            HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_NONE,
            HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_NONE,
        }

    def _get_candidate_models(self) -> List[str]:
        """
        Dynamically query available models supporting generateContent from Gemini API.
        Falls back to a prioritized list if list_models fails.
        """
        available: List[str] = []
        try:
            for m in genai.list_models():
                methods = getattr(m, "supported_generation_methods", [])
                if "generateContent" in methods:
                    clean_name = m.name.replace("models/", "")
                    available.append(clean_name)
                    available.append(m.name)
            logger.info(f"Available Gemini models supporting generateContent: {available}")
        except Exception as e:
            logger.warning(f"Could not list Gemini models dynamically: {e}")

        # Build prioritized search list
        priorities = [
            self.preferred_model_name,
            f"models/{self.preferred_model_name}",
            "gemini-1.5-flash-latest",
            "models/gemini-1.5-flash-latest",
            "gemini-1.5-flash",
            "models/gemini-1.5-flash",
            "gemini-1.5-pro-latest",
            "models/gemini-1.5-pro-latest",
            "gemini-1.5-pro",
            "models/gemini-1.5-pro",
            "gemini-2.0-flash",
            "models/gemini-2.0-flash",
            "gemini-2.0-flash-exp",
            "models/gemini-2.0-flash-exp",
            "gemini-pro",
            "models/gemini-pro",
        ]

        result: List[str] = []
        if GeminiProvider._cached_working_model:
            result.append(GeminiProvider._cached_working_model)

        for p in priorities:
            if p in available and p not in result:
                result.append(p)

        for a in available:
            if a not in result:
                result.append(a)

        for p in priorities:
            if p not in result:
                result.append(p)

        return result

    def _sync_generate(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float,
        max_tokens: int,
        json_mode: bool = False
    ) -> str:
        candidates = self._get_candidate_models()
        last_error = None

        for model_candidate in candidates:
            # 1. Attempt with JSON mode if requested
            if json_mode:
                try:
                    gen_config = genai.types.GenerationConfig(
                        temperature=temperature,
                        max_output_tokens=max_tokens,
                        response_mime_type="application/json",
                    )
                    model = genai.GenerativeModel(
                        model_name=model_candidate,
                        system_instruction=system_prompt if system_prompt else None,
                        generation_config=gen_config,
                        safety_settings=self._get_safety_settings(),
                    )
                    response = model.generate_content(user_prompt)
                    text = _extract_text_from_response(response)
                    if text:
                        GeminiProvider._cached_working_model = model_candidate
                        return text
                except Exception as json_mode_err:
                    err_msg = str(json_mode_err)
                    # If 404 model not found, skip to next model candidate immediately
                    if "404" in err_msg or "not found" in err_msg.lower():
                        last_error = json_mode_err
                        continue
                    logger.debug(f"JSON mode not accepted by {model_candidate}: {json_mode_err}. Trying standard mode...")

            # 2. Standard generation mode with system_instruction
            try:
                gen_config = genai.types.GenerationConfig(
                    temperature=temperature,
                    max_output_tokens=max_tokens,
                )
                model = genai.GenerativeModel(
                    model_name=model_candidate,
                    system_instruction=system_prompt if system_prompt else None,
                    generation_config=gen_config,
                    safety_settings=self._get_safety_settings(),
                )
                response = model.generate_content(user_prompt)
                text = _extract_text_from_response(response)
                if text:
                    GeminiProvider._cached_working_model = model_candidate
                    return text
            except Exception as sys_err:
                err_msg = str(sys_err)
                if "404" in err_msg or "not found" in err_msg.lower():
                    last_error = sys_err
                    continue
                # If system_instruction was rejected by SDK version, fallback to combined prompt
                try:
                    model = genai.GenerativeModel(
                        model_name=model_candidate,
                        generation_config=gen_config,
                        safety_settings=self._get_safety_settings(),
                    )
                    combined = f"SYSTEM INSTRUCTIONS:\n{system_prompt}\n\nUSER PROMPT:\n{user_prompt}" if system_prompt else user_prompt
                    response = model.generate_content(combined)
                    text = _extract_text_from_response(response)
                    if text:
                        GeminiProvider._cached_working_model = model_candidate
                        return text
                except Exception as fallback_err:
                    last_error = fallback_err
                    logger.warning(f"Gemini candidate '{model_candidate}' failed: {fallback_err}")
                    continue

        logger.error(f"All Gemini model candidates failed. Last error: {last_error}")
        raise RuntimeError(f"Gemini generation failed on all models: {last_error}")

    async def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.1,
        max_tokens: int = 8192,
        json_mode: bool = False
    ) -> str:
        if not self.is_configured():
            raise ValueError("Gemini API key is not configured or invalid.")

        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None,
            self._sync_generate,
            system_prompt,
            user_prompt,
            temperature,
            max_tokens,
            json_mode
        )
