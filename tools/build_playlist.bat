@echo off
setlocal
cd /d "%~dp0\.."
python tools\build_playlist.py %*
if errorlevel 1 (
  echo.
  echo Failed to rebuild playlist.txt
  exit /b 1
)
echo.
echo playlist.txt rebuilt successfully.
