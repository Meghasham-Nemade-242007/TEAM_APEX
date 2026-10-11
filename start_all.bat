@echo off
title Legal Document Analysis System - Orchestrator
echo ============================================================
echo   LEGAL DOCUMENT ANALYSIS SYSTEM
echo   Court Document Review and Analysis Portal
echo ============================================================
echo.
echo Launching Backend (FastAPI on http://localhost:8000)...
start "Legal Analysis - Backend" cmd /k "%~dp0start_backend.bat"

echo.
echo Waiting 3 seconds before starting frontend...
timeout /t 3 /nobreak >nul

echo.
echo Launching Frontend (Vite on http://localhost:5173)...
start "Legal Analysis - Frontend" cmd /k "%~dp0start_frontend.bat"

echo.
echo ============================================================
echo   All servers launched in separate windows!
echo   - Web Portal: http://localhost:5173
echo   - Backend API: http://localhost:8000
echo   - API Docs:    http://localhost:8000/docs
echo ============================================================
echo.
pause
