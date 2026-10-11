@echo off
title Legal Document Analysis System - Backend Server
echo ============================================================
echo   LEGAL DOCUMENT ANALYSIS SYSTEM - BACKEND (FastAPI)
echo ============================================================
echo.

cd /d "%~dp0backend"

REM Check if Python is installed
python --version >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Python is not found in your PATH!
    echo Please install Python 3.11+ and check "Add Python to PATH".
    pause
    exit /b 1
)

REM Check or create virtual environment if not present
if not exist "venv" (
    echo [INFO] Creating Python virtual environment venv...
    python -m venv venv
    if %ERRORLEVEL% neq 0 (
        echo [WARNING] Could not create virtual environment. Using global Python.
    )
)

if exist "venv\Scripts\activate.bat" (
    echo [INFO] Activating virtual environment...
    call venv\Scripts\activate.bat
)

REM Install/verify dependencies
echo [INFO] Checking Python dependencies...
pip install -r requirements.txt

REM Ensure .env exists
if not exist ".env" (
    if exist ".env.example" (
        echo [INFO] Copying .env.example to .env...
        copy .env.example .env
    )
)

echo.
echo [INFO] Starting FastAPI server on http://localhost:8000 ...
echo [INFO] Swagger API Docs will be available at http://localhost:8000/docs
echo.
python run.py

if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] Backend exited with code %ERRORLEVEL%.
    pause
)
