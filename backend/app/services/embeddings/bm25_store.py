import json
import logging
import os
import pickle
import re
from pathlib import Path
from typing import List, Optional
from rank_bm25 import BM25Okapi

from app.config import settings
from app.services.document_extraction.chunker import Chunk
from app.services.embeddings.faiss_store import SearchResult

logger = logging.getLogger(__name__)

def legal_tokenize(text: str) -> List[str]:
    """Tokenize text preserving legal citations and alphanumeric identifiers (e.g. 'sec. 302', 'u/s', 'art. 21')."""
    text = text.lower()
    tokens = re.findall(r"[a-z0-9]+(?:[-_/.][a-z0-9]+)*", text)
    return tokens

class BM25Store:
    def __init__(self, index_dir: Optional[str] = None):
        self.index_dir = Path(index_dir or settings.index_dir)
        self.index_dir.mkdir(parents=True, exist_ok=True)
        self._bm25_models = {}  # doc_id -> BM25Okapi
        self._chunks = {}       # doc_id -> List[Chunk]

    def _bm25_path(self, doc_id: str) -> Path:
        return self.index_dir / f"{doc_id}_bm25.pkl"

    def _meta_path(self, doc_id: str) -> Path:
        return self.index_dir / f"{doc_id}_bm25_meta.json"

    def build_index(self, chunks: List[Chunk], doc_id: str):
        if not chunks:
            logger.warning(f"No chunks to build BM25 index for {doc_id}")
            return

        corpus = [legal_tokenize(c.text) for c in chunks]
        bm25 = BM25Okapi(corpus)

        self._bm25_models[doc_id] = bm25
        self._chunks[doc_id] = chunks
        self.save_index(doc_id)

    def save_index(self, doc_id: str):
        if doc_id in self._bm25_models and doc_id in self._chunks:
            with open(self._bm25_path(doc_id), "wb") as f:
                pickle.dump(self._bm25_models[doc_id], f)
            with open(self._meta_path(doc_id), "w", encoding="utf-8") as f:
                json.dump([c.model_dump() for c in self._chunks[doc_id]], f, ensure_ascii=False)

    def load_index(self, doc_id: str) -> bool:
        bm25_p = self._bm25_path(doc_id)
        meta_p = self._meta_path(doc_id)
        if not bm25_p.exists() or not meta_p.exists():
            return False

        try:
            with open(bm25_p, "rb") as f:
                self._bm25_models[doc_id] = pickle.load(f)
            with open(meta_p, "r", encoding="utf-8") as f:
                chunks_data = json.load(f)
                self._chunks[doc_id] = [Chunk(**d) for d in chunks_data]
            return True
        except Exception as e:
            logger.error(f"Failed to load BM25 index for {doc_id}: {e}")
            return False

    def search(self, query: str, doc_id: str, top_k: int = 10) -> List[SearchResult]:
        if doc_id not in self._bm25_models:
            loaded = self.load_index(doc_id)
            if not loaded:
                logger.warning(f"No BM25 index available for doc_id {doc_id}")
                return []

        bm25 = self._bm25_models[doc_id]
        chunks = self._chunks[doc_id]
        if not chunks:
            return []

        query_tokens = legal_tokenize(query)
        if not query_tokens:
            return []

        scores = bm25.get_scores(query_tokens)
        sorted_indices = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)

        results: List[SearchResult] = []
        for idx in sorted_indices[:top_k]:
            if scores[idx] <= 0:
                continue
            chunk = chunks[idx]
            results.append(SearchResult(
                chunk_id=chunk.chunk_id,
                text=chunk.text,
                page_num=chunk.page_num,
                para_num=chunk.para_num,
                score=float(scores[idx]),
                section_heading=chunk.section_heading
            ))
        return results

    def delete_index(self, doc_id: str):
        self._bm25_models.pop(doc_id, None)
        self._chunks.pop(doc_id, None)
        bm25_p = self._bm25_path(doc_id)
        meta_p = self._meta_path(doc_id)
        if bm25_p.exists():
            try:
                os.remove(bm25_p)
            except Exception as e:
                logger.error(f"Error removing BM25 index file: {e}")
        if meta_p.exists():
            try:
                os.remove(meta_p)
            except Exception as e:
                logger.error(f"Error removing BM25 meta file: {e}")
