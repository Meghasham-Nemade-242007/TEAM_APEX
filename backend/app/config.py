from pydantic_settings import BaseSettings
from pathlib import Path
from typing import List
import json

class Settings(BaseSettings):
    gemini_api_key: str = ""
    llm_provider: str = "gemini"
    llm_model: str = "gemini-1.5-flash"
    embedding_model: str = "all-MiniLM-L6-v2"
    database_url: str = "sqlite:///./data/db/legal_docs.db"
    secret_key: str = "change-me"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 10080
    max_upload_mb: int = 50
    max_pdf_pages: int = 500
    cors_origins: str = '["http://localhost:5173"]'
    upload_dir: str = "../data/uploads"
    index_dir: str = "../data/indexes"

    @property
    def cors_origins_list(self) -> List[str]:
        try:
            return json.loads(self.cors_origins)
        except Exception:
            return ["http://localhost:5173", "http://localhost:3000"]

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_mb * 1024 * 1024

    class Config:
        env_file = ".env"
        extra = "allow"

settings = Settings()

# Ensure data dirs exist
for d in [settings.upload_dir, settings.index_dir, "../data/db", "./data/db"]:
    Path(d).mkdir(parents=True, exist_ok=True)
