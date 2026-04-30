@echo off
chcp 65001 > nul
title banya_web - Stop All

echo ============================================================
echo  banya_web 모든 프로세스 종료
echo ============================================================
echo.

echo [1/2] Python(uvicorn) 프로세스 종료...
taskkill /F /IM python.exe 2>nul
if errorlevel 1 (echo  - Python 프로세스 없음) else (echo  - Python 종료)

echo.
echo [2/2] cloudflared 터널 종료...
taskkill /F /IM cloudflared.exe 2>nul
if errorlevel 1 (echo  - cloudflared 프로세스 없음) else (echo  - cloudflared 종료)

echo.
echo === 완료 ===
timeout /t 2 > nul
