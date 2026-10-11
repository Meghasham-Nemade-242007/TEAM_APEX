import json
import logging
import os
from pathlib import Path
from typing import List, Optional
import faiss
import numpy as np
from pydantic import BaseModel

from app.config import settings
from app.services.document_extraction.chunker import Chunk

logger = logging.getLogger(__name__)

class SearchResult(BaseModel):
    chunk_id: str
    text: str
    page_num: int
    para_num: int
    score: float
    section_heading: Optional[str] = None

class FAISSStore:
    def __init__(self, index_dir: Optional[str] = None):
        self.index_dir = Path(index_dir or settings.index_dir)
        self.index_dir.mkdir(parents=True, exist_ok=True)
        self._indexes = {}  # doc_id -> faiss index
        self._chunks = {}   # doc_id -> list of Chunk

    def _index_path(self, doc_id: str) -> Path:
        return self.index_dir / f"{doc_id}.faiss"

    def _meta_path(self, doc_id: str) -> Path:
        return self.index_dir / f"{doc_id}_faiss_meta.json"

    def build_index(self, chunks: List[Chunk], embeddings: np.ndarray, doc_id: str):
        if len(chunks) == 0 or embeddings.shape[0] == 0:
            logger.warning(f"No chunks or embeddings to index for document {doc_id}")
            return

        dim = embeddings.shape[1]
        # Using IndexFlatIP since embeddings are normalized (cosine similarity)
        index = faiss.IndexFlatIP(dim)
        # Normalize just in case
        faiss.normalize_L2(embeddings)
        index.add(embeddings)

        self._indexes[doc_id] = index
        self._chunks[doc_id] = chunks
        self.save_index(doc_id)

    def save_index(self, doc_id: str):
        if doc_id in self._indexes and doc_id in self._chunks:
            faiss.write_index(self._indexes[doc_id], str(self._index_path(doc_id)))
            with open(self._meta_path(doc_id), "w", encoding="utf-8") as f:
                json.dump([c.model_dump() for c in self._chunks[doc_id]], f, ensure_ascii=False)

    def load_index(self, doc_id: str) -> bool:
        idx_p = self._index_path(doc_id)
        meta_p = self._meta_path(doc_id)
        if not idx_p.exists() or not meta_p.exists():
            return False

        try:
            self._indexes[doc_id] = faiss.read_index(str(idx_p))
            with open(meta_p, "r", encoding="utf-8") as f:
                chunks_data = json.load(f)
                self._chunks[doc_id] = [Chunk(**d) for d in chunks_data]
            return True
        except Exception as e:
            logger.error(f"Failed to load FAISS index for {doc_id}: {e}")
            return False

    def search(self, query_embedding: np.ndarray, doc_id: str, top_k: int = 10) -> List[SearchResult]:
        if doc_id not in self._indexes:
            loaded = self.load_index(doc_id)
            if not loaded:
                logger.warning(f"No FAISS index available for doc_id {doc_id}")
                return []

        index = self._indexes[doc_id]
        chunks = self._chunks[doc_id]

        if index.ntotal == 0 or len(chunks) == 0:
            return []

        q_emb = np.array([query_embedding], dtype=np.float32)
        faiss.normalize_L2(q_emb)

        actual_k = min(top_k, index.ntotal)
        scores, indices = index.search(q_emb, actual_k)

        results: List[SearchResult] = []
        for score, idx in zip(scores[0], indices[0]):
            if idx < 0 or idx >= len(chunks):
                continue
            chunk = chunks[idx]
            results.append(SearchResult(
                chunk_id=chunk.chunk_id,
                text=chunk.text,
                page_num=chunk.page_num,
                para_num=chunk.para_num,
                score=float(score),
                section_heading=chunk.section_heading
            ))
        return results

    def delete_index(self, doc_id: str):
        self._indexes.pop(doc_id, None)
        self._chunks.pop(doc_id, None)
        idx_p = self._index_path(doc_id)
        meta_p = self._meta_path(doc_id)
        if idx_p.exists():
            try:
                os.remove(idx_p)
            except Exception as e:
                logger.error(f"Error removing FAISS index file: {e}")
        if meta_p.exists():
            try:
                os.remove(meta_p)
            except Exception as e:
                logger.error(f"Error removing FAISS meta file: {e}")
