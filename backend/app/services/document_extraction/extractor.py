"""
Robust PDF text extraction using PyMuPDF with page boundary tracking,
scanned page detection, and OCR fallback integration.
"""
import logging
from typing import List, Optional, Tuple
from pydantic import BaseModel
import fitz  # PyMuPDF

from app.services.document_extraction.ocr import OCRProcessor

logger = logging.getLogger(__name__)


class PageContent(BaseModel):
    page_num: int
    text: str
    char_count: int
    is_scanned: bool = False
    extraction_method: str = "native"  # "native" | "ocr" | "empty"
    error: Optional[str] = None


class ExtractionResult(BaseModel):
    pages: List[PageContent]
    total_pages: int
    total_characters: int
    scanned_pages_count: int
    method_used: str  # "native" | "ocr" | "mixed"
    error: Optional[str] = None


class DocumentExtractor:
    def __init__(self):
        self.ocr_processor = OCRProcessor()

    def extract_pages(self, file_path: str) -> List[PageContent]:
        """
        Extract text from PDF pages preserving 1-indexed page boundaries.
        Detects scanned pages (< 50 chars) and attempts OCR if available.
        Handles encrypted, corrupted, and empty files gracefully.
        """
        pages: List[PageContent] = []

        try:
            doc = fitz.open(file_path)
        except Exception as e:
            logger.error(f"Failed to open PDF at {file_path}: {e}")
            return [PageContent(
                page_num=1,
                text="",
                char_count=0,
                is_scanned=False,
                extraction_method="error",
                error=f"Unable to read PDF file: {str(e)}"
            )]

        try:
            if doc.is_encrypted:
                logger.error(f"PDF at {file_path} is password-protected.")
                return [PageContent(
                    page_num=1,
                    text="",
                    char_count=0,
                    is_scanned=False,
                    extraction_method="error",
                    error="PDF is password protected. Please provide an unlocked document."
                )]

            total_doc_pages = len(doc)
            if total_doc_pages == 0:
                return [PageContent(
                    page_num=1,
                    text="",
                    char_count=0,
                    is_scanned=False,
                    extraction_method="empty",
                    error="PDF document contains zero pages."
                )]

            for page_index in range(total_doc_pages):
                page_num = page_index + 1
                try:
                    page = doc[page_index]
                    text = page.get_text("text") or ""
                    cleaned_text = text.strip()
                    char_count = len(cleaned_text)

                    is_scanned = char_count < 50
                    method = "native"

                    # If page appears scanned and OCR is available, run OCR
                    if is_scanned and self.ocr_processor.is_available():
                        ocr_text = self.ocr_processor.ocr_page(page)
                        if ocr_text and len(ocr_text.strip()) > char_count:
                            text = ocr_text
                            cleaned_text = ocr_text.strip()
                            char_count = len(cleaned_text)
                            method = "ocr"
                    elif is_scanned:
                        method = "empty" if char_count == 0 else "native_low_char"

                    pages.append(PageContent(
                        page_num=page_num,
                        text=text,
                        char_count=char_count,
                        is_scanned=is_scanned,
                        extraction_method=method,
                        error=None
                    ))

                except Exception as page_err:
                    logger.error(f"Error extracting page {page_num}: {page_err}")
                    pages.append(PageContent(
                        page_num=page_num,
                        text="",
                        char_count=0,
                        is_scanned=False,
                        extraction_method="error",
                        error=str(page_err)
                    ))

        finally:
            doc.close()

        return pages

    def get_summary(self, pages: List[PageContent]) -> ExtractionResult:
        """Computes summary statistics and overall extraction method."""
        total_pages = len(pages)
        total_chars = sum(p.char_count for p in pages)
        scanned_count = sum(1 for p in pages if p.is_scanned)
        ocr_count = sum(1 for p in pages if p.extraction_method == "ocr")

        if ocr_count == total_pages and total_pages > 0:
            method = "ocr"
        elif ocr_count > 0:
            method = "mixed"
        else:
            method = "native"

        return ExtractionResult(
            pages=pages,
            total_pages=total_pages,
            total_characters=total_chars,
            scanned_pages_count=scanned_count,
            method_used=method
        )
