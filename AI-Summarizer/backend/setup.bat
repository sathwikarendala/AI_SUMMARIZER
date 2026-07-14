@echo off
echo ============================================
echo   AI Text Summarizer - Windows Setup
echo ============================================

:: Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found. Install from https://python.org
    pause & exit /b 1
)

echo [1/4] Creating virtual environment...
python -m venv venv
if errorlevel 1 ( echo [ERROR] venv creation failed & pause & exit /b 1 )

echo [2/4] Activating virtual environment...
call venv\Scripts\activate.bat

echo [3/4] Installing dependencies (this may take 5-10 min for first run)...
pip install --upgrade pip
pip install -r requirements.txt

echo [4/4] Setting up environment file...
if not exist .env (
    copy .env.example .env
    echo [INFO] .env file created. Edit it to add your GEMINI_API_KEY.
) else (
    echo [INFO] .env already exists.
)

echo.
echo ============================================
echo   Setup Complete!
echo ============================================
echo.
echo To start the server, run: start.bat
echo Then open: http://localhost:8000
echo.
pause
