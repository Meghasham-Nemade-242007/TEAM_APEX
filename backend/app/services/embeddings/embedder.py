import logging
from typing import List
import numpy as np

from app.config import settings

logger = logging.getLogger(__name__)

class Embedder:
    _instance = None
    _model = None

    def __init__(self, model_name: str = None):
        self.model_name = model_name or settings.embedding_model or "all-MiniLM-L6-v2"

    def _get_model(self):
        if Embedder._model is None:
            logger.info(f"Loading sentence-transformers model: {self.model_name}")
            from sentence_transformers import SentenceTransformer
            Embedder._model = SentenceTransformer(self.model_name)
        return Embedder._model

    def encode(self, texts: List[str]) -> np.ndarray:
        if not texts:
            return np.empty((0, 384), dtype=np.float32)
        model = self._get_model()
        embeddings = model.encode(texts, convert_to_numpy=True, show_progress_bar=False, normalize_embeddings=True)
        return np.asarray(embeddings, dtype=np.float32)

    def encode_query(self, text: str) -> np.ndarray:
        model = self._get_model()
        embedding = model.encode([text], convert_to_numpy=True, show_progress_bar=False, normalize_embeddings=True)
        return np.asarray(embedding, dtype=np.float32)[0]
