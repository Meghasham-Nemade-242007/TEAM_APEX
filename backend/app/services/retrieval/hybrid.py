import logging
from typing import List, Optional, Dict
from pydantic import BaseModel

from app.services.embeddings.embedder import Embedder
from app.services.embeddings.faiss_store import FAISSStore, SearchResult
from app.services.embeddings.bm25_store import BM25Store

logger = logging.getLogger(__name__)

class RetrievedPassage(BaseModel):
    chunk_id: str
    text: str
    page_num: int
    para_num: int
    score: float
    section_heading: Optional[str] = None

class HybridRetriever:
    def __init__(
        self,
        embedder: Optional[Embedder] = None,
        faiss_store: Optional[FAISSStore] = None,
        bm25_store: Optional[BM25Store] = None,
        rrf_k: int = 60
    ):
        self.embedder = embedder or Embedder()
        self.faiss_store = faiss_store or FAISSStore()
        self.bm25_store = bm25_store or BM25Store()
        self.rrf_k = rrf_k

    def retrieve(self, query: str, doc_id: str, top_k: int = 8) -> List[RetrievedPassage]:
        """
        Retrieves passages using dense (FAISS) and sparse (BM25) search,
        combining candidate rankings via Reciprocal Rank Fusion (RRF).
        """
        # 1. FAISS dense search
        dense_results: List[SearchResult] = []
        try:
            query_emb = self.embedder.encode_query(query)
            dense_results = self.faiss_store.search(query_emb, doc_id=doc_id, top_k=top_k * 2)
        except Exception as e:
            logger.warning(f"Dense search failed for query '{query[:30]}': {e}")

        # 2. BM25 sparse search
        sparse_results: List[SearchResult] = []
        try:
            sparse_results = self.bm25_store.search(query, doc_id=doc_id, top_k=top_k * 2)
        except Exception as e:
            logger.warning(f"Sparse search failed for query '{query[:30]}': {e}")

        if not dense_results and not sparse_results:
            return []

        # Reciprocal Rank Fusion (RRF)
        # RRF_Score(d) = sum_{rank in rankings} 1 / (k + rank)
        rrf_scores: Dict[str, float] = {}
        passage_map: Dict[str, SearchResult] = {}

        for rank, res in enumerate(dense_results, start=1):
            chunk_id = res.chunk_id
            rrf_scores[chunk_id] = rrf_scores.get(chunk_id, 0.0) + (1.0 / (self.rrf_k + rank))
            passage_map[chunk_id] = res

        for rank, res in enumerate(sparse_results, start=1):
            chunk_id = res.chunk_id
            rrf_scores[chunk_id] = rrf_scores.get(chunk_id, 0.0) + (1.0 / (self.rrf_k + rank))
            if chunk_id not in passage_map:
                passage_map[chunk_id] = res

        # Sort chunk IDs by combined RRF score
        sorted_chunks = sorted(rrf_scores.keys(), key=lambda cid: rrf_scores[cid], reverse=True)

        final_passages: List[RetrievedPassage] = []
        for cid in sorted_chunks[:top_k]:
            item = passage_map[cid]
            final_passages.append(RetrievedPassage(
                chunk_id=item.chunk_id,
                text=item.text,
                page_num=item.page_num,
                para_num=item.para_num,
                score=round(float(rrf_scores[cid]), 4),
                section_heading=item.section_heading
            ))

        return final_passages
