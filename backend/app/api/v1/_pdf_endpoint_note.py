"""
Additional API endpoint: Serve the original PDF file for the in-browser PDF viewer.
Add this to e:/LEGAL/backend/app/api/v1/documents.py
"""

# GET /api/documents/{document_id}/file
# This endpoint must be added to documents.py router

ADDITIONAL_ENDPOINT = """
from fastapi.responses import FileResponse
import os

@router.get("/{document_id}/file")
async def serve_document_file(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    \"\"\"Serve the original PDF file for the in-browser PDF viewer.\"\"\"
    doc = db.query(Document).filter(
        Document.id == document_id,
        Document.owner_id == current_user.id,
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    file_path = os.path.join(settings.upload_dir, doc.stored_filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found on server")
    
    return FileResponse(
        path=file_path,
        media_type="application/pdf",
        filename=doc.original_filename,
        headers={"Content-Disposition": f"inline; filename={doc.original_filename}"},
    )
"""
