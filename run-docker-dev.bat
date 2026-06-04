@echo off
setlocal EnableExtensions EnableDelayedExpansion

cd /d "%~dp0"

echo.
echo ========================================
echo   CodeSync Code Execution Docker Setup
echo ========================================
echo.
echo This only prepares Docker for the in-workspace Run button.
echo It does not start the CodeSync backend/frontend.
echo.

where docker >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Docker CLI was not found.
  echo Install Docker Desktop from:
  echo https://www.docker.com/products/docker-desktop/
  pause
  exit /b 1
)

docker info >nul 2>nul
if errorlevel 1 (
  echo [INFO] Docker engine is not running.
  echo [INFO] Trying to start Docker Desktop...

  if exist "C:\Program Files\Docker\Docker\Docker Desktop.exe" (
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
  ) else (
    echo [ERROR] Docker Desktop was not found at the default install path.
    echo Open Docker Desktop manually, wait until it says Docker is running, then run this file again.
    pause
    exit /b 1
  )

  echo [INFO] Waiting for Docker engine...
  set /a WAIT_SECONDS=0
  :WAIT_FOR_DOCKER
  timeout /t 5 /nobreak >nul
  set /a WAIT_SECONDS+=5
  docker info >nul 2>nul
  if errorlevel 1 (
    if !WAIT_SECONDS! GEQ 180 (
      echo [ERROR] Docker did not become ready after 3 minutes.
      echo Open Docker Desktop and check for setup prompts, WSL updates, or startup errors.
      pause
      exit /b 1
    )
    echo [INFO] Still waiting... !WAIT_SECONDS!s
    goto WAIT_FOR_DOCKER
  )
)

echo [OK] Docker is running.
echo.
echo [INFO] Pulling sandbox images used by the CodeSync Run button...
echo [INFO] First pull can take a while.
echo.

docker pull node:20-alpine
if errorlevel 1 goto PULL_FAILED

docker pull python:3.11-alpine
if errorlevel 1 goto PULL_FAILED

docker pull gcc:13
if errorlevel 1 goto PULL_FAILED

echo.
echo [OK] Code execution Docker images are ready.
echo You can now use the Run button inside a CodeSync room.
echo Keep Docker Desktop running while executing code.
pause
exit /b 0

:PULL_FAILED
echo.
echo [ERROR] Could not pull one or more Docker images.
echo Check your internet connection and Docker Desktop status, then run this file again.
pause
exit /b 1

endlocal
