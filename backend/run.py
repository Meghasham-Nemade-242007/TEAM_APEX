"""
FastAPI Server Launcher for Legal Document Analysis System
"""
import uvicorn
import os
import sys
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

if __name__ == "__main__":
    print("=" * 60)
    print("Starting Legal Document Analysis System - Backend API")
    print("API Documentation: http://localhost:8000/docs")
    print("Health Check:      http://localhost:8000/api/health")
    print("=" * 60)
    
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info",
    )
