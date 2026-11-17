@echo off
cd /d "%~dp0"
echo Installing the local Voxtral runtime...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup-voxtral.ps1"
if errorlevel 1 exit /b 1
if not exist ".venv\Scripts\python.exe" python -m venv .venv
if errorlevel 1 exit /b 1
".venv\Scripts\python.exe" -m pip uninstall -y qwen-asr whisperx openai-whisper faster-whisper
if errorlevel 1 exit /b 1
".venv\Scripts\python.exe" -m pip install -r requirements.txt
if errorlevel 1 exit /b 1
echo Voxtral runtime and local model weights are ready.
