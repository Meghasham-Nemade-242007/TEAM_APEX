import logging
from typing import Any

logger = logging.getLogger(__name__)

class OCRProcessor:
    def __init__(self):
        self._tesseract_available = False
        try:
            import pytesseract
            # Test if tesseract executable is reachable
            pytesseract.get_tesseract_version()
            self._tesseract_available = True
        except Exception:
            self._tesseract_available = False

    def is_available(self) -> bool:
        return self._tesseract_available

    def ocr_page(self, page: Any) -> str:
        """
        Accepts a PyMuPDF Page object, renders it to a pixmap/image, and runs pytesseract.
        Gracefully returns empty string if tesseract is not available or fails.
        """
        if not self._tesseract_available:
            return ""

        try:
            import pytesseract
            from PIL import Image
            import io

            # Render page to pixmap
            pix = page.get_pixmap(dpi=150)
            img_bytes = pix.tobytes("png")
            image = Image.open(io.BytesIO(img_bytes))

            text = pytesseract.image_to_string(image)
            return text.strip()
        except Exception as e:
            logger.warning(f"OCR failed for page: {e}")
            return ""
