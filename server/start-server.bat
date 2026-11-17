@echo off
cd /d "%~dp0"
echo =======================================================
echo   Starting MistleTunes Lyrics Server (Groq Cloud + LRCLIB)
echo =======================================================
echo.
if exist ".venv\Scripts\python.exe" (
  ".venv\Scripts\python.exe" -X utf8 -u server.py
) else (
  python -X utf8 -u server.py
)
pause
