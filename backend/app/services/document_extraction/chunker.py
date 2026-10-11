import re
import uuid
from typing import List, Optional
from pydantic import BaseModel
from app.services.document_extraction.extractor import PageContent

class Chunk(BaseModel):
    chunk_id: str
    doc_id: str
    page_num: int
    para_num: int
    text: str
    section_heading: Optional[str] = None
    char_start: int = 0
    char_end: int = 0

class LegalChunker:
    def __init__(self, target_chunk_size: int = 800, overlap: int = 100):
        self.target_chunk_size = target_chunk_size
        self.overlap = overlap

    def _extract_heading(self, text: str) -> Optional[str]:
        """Detect potential legal headings (e.g., '1. Background', 'ORDER', 'JUDGMENT', 'Issue I')."""
        lines = [line.strip() for line in text.split("\n") if line.strip()]
        if not lines:
            return None
        first_line = lines[0]
        # Check if first line resembles a heading
        heading_patterns = [
            r"^(ORDER|JUDGMENT|FACTS|ISSUES|DISCUSSION|CONCLUSION|VERDICT|DECREE|HELD)",
            r"^(SECTION|ARTICLE|CLAUSE|POINT|GROUND|PARA|PARAGRAPH)\s+\d+",
            r"^(\d+|[A-Z]|[IVXLCDM]+)\.\s+[A-Z]",
            r"^[A-Z\s]{4,60}$"
        ]
        for pattern in heading_patterns:
            if re.match(pattern, first_line, re.IGNORECASE):
                return first_line[:100]
        return None

    def chunk_pages(self, pages: List[PageContent], doc_id: str = "") -> List[Chunk]:
        """
        Chunks pages respecting paragraph boundaries (double newlines) when possible.
        Targets ~800 characters with ~100 characters overlap.
        Preserves page number, para number, and extracted headings.
        """
        chunks: List[Chunk] = []
        global_chunk_idx = 0

        for page in pages:
            if not page.text or not page.text.strip():
                continue

            raw_text = page.text
            current_heading = self._extract_heading(raw_text)

            # Split by double newline first to get paragraphs
            paragraphs = [p.strip() for p in re.split(r"\n\s*\n", raw_text) if p.strip()]

            if not paragraphs:
                paragraphs = [raw_text.strip()]

            current_chunk_text = ""
            current_start = 0
            para_num = 1

            for para in paragraphs:
                heading_in_para = self._extract_heading(para)
                if heading_in_para:
                    current_heading = heading_in_para

                if not current_chunk_text:
                    current_chunk_text = para
                elif len(current_chunk_text) + len(para) + 1 <= self.target_chunk_size:
                    current_chunk_text += "\n\n" + para
                else:
                    # Current chunk is full, record it
                    chunk_text = current_chunk_text.strip()
                    if chunk_text:
                        chunks.append(Chunk(
                            chunk_id=f"{doc_id}_{page.page_num}_{global_chunk_idx}",
                            doc_id=doc_id,
                            page_num=page.page_num,
                            para_num=para_num,
                            text=chunk_text,
                            section_heading=current_heading,
                            char_start=current_start,
                            char_end=current_start + len(chunk_text)
                        ))
                        global_chunk_idx += 1
                        para_num += 1

                    # Handle overlap: take trailing ~100 chars from previous chunk
                    if len(chunk_text) > self.overlap:
                        overlap_prefix = chunk_text[-self.overlap:].strip() + " "
                    else:
                        overlap_prefix = ""

                    current_chunk_text = overlap_prefix + para
                    current_start += len(chunk_text)

            # Record final leftover chunk for the page
            if current_chunk_text.strip():
                chunk_text = current_chunk_text.strip()
                chunks.append(Chunk(
                    chunk_id=f"{doc_id}_{page.page_num}_{global_chunk_idx}",
                    doc_id=doc_id,
                    page_num=page.page_num,
                    para_num=para_num,
                    text=chunk_text,
                    section_heading=current_heading,
                    char_start=current_start,
                    char_end=current_start + len(chunk_text)
                ))
                global_chunk_idx += 1

        return chunks
