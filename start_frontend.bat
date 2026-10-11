@echo off
title Legal Document Analysis System - Frontend Server
echo ============================================================
echo   LEGAL DOCUMENT ANALYSIS SYSTEM - FRONTEND (React + Vite)
echo ============================================================
echo.

cd /d "%~dp0frontend"

REM Check if Node.js is installed
node --version >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js is not found in your PATH!
    echo Please install Node.js 18+ from https://nodejs.org/
    pause
    exit /b 1
)

REM Check if node_modules exists
if not exist "node_modules" (
    echo [INFO] Installing frontend dependencies via npm install...
    call npm install
    if %ERRORLEVEL% neq 0 (
        echo [ERROR] npm install failed.
        pause
        exit /b 1
    )
)

echo.
echo [INFO] Starting Vite development server on http://localhost:5173
echo.
call npm run dev

if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] Frontend exited with code %ERRORLEVEL%.
    pause
)
