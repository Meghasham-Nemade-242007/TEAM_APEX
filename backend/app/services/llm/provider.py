from abc import ABC, abstractmethod
from typing import Optional

class LLMProvider(ABC):
    @abstractmethod
    async def generate(self, system_prompt: str, user_prompt: str, temperature: float = 0.1, max_tokens: int = 4096) -> str:
        pass

    @abstractmethod
    def is_configured(self) -> bool:
        pass
