@echo off
setlocal

cd /d "%~dp0"

start "CodeSync Backend" /D "%~dp0" cmd /k "npm --workspace server run dev"
start "CodeSync Frontend" /D "%~dp0" cmd /k "npm --workspace client run dev"

endlocal
