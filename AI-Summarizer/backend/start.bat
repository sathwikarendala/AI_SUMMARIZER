@echo off
echo Starting AI Text Summarizer...
cd /d "%~dp0"
call venv\Scripts\activate.bat 2>nul
python main.py
pause
