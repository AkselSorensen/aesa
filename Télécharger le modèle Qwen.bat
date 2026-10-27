@echo off
setlocal
set "OLLAMA=%LOCALAPPDATA%\Programs\Ollama\ollama.exe"
if not exist "%OLLAMA%" set "OLLAMA=ollama"
"%OLLAMA%" --version >nul 2>nul
if errorlevel 1 (
  echo Ollama n'est pas installe.
  echo Le telechargement officiel fonctionne sous Windows 10 ou plus recent.
  start "Telecharger Ollama" https://ollama.com/download/windows
  pause
  exit /b 1
)
echo Telechargement de Qwen3.5 4B, environ 3,3 Go...
"%OLLAMA%" pull qwen3.5:4b
if errorlevel 1 (
  echo Le telechargement a echoue. Verifiez votre connexion puis relancez ce fichier.
  pause
  exit /b 1
)
echo Telechargement de Qwen3.5 9B, environ 6,6 Go...
"%OLLAMA%" pull qwen3.5:9b
if errorlevel 1 (
  echo Le modele 4B est installe. Le telechargement du 9B a echoue.
  pause
  exit /b 1
)
echo Les deux modeles sont installes. Vous pouvez maintenant lancer la simulation.
pause
