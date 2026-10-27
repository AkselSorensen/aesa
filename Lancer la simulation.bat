@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js est necessaire pour lancer cette simulation locale.
  echo Installez Node.js, puis relancez ce fichier.
  pause
  exit /b 1
)
set "OLLAMA=%LOCALAPPDATA%\Programs\Ollama\ollama.exe"
if not exist "%OLLAMA%" set "OLLAMA=ollama"
"%OLLAMA%" --version >nul 2>nul
if errorlevel 1 (
  echo Ollama est necessaire pour les agents IA locaux.
  echo Installez Ollama depuis https://ollama.com/download/windows
  pause
  exit /b 1
)
start "Simulation radar AESA" http://127.0.0.1:8765
node serveur_simulation.js
pause
