@echo off
chcp 65001 > nul
title banya_web - Cloudflare Tunnel
cd /d "%~dp0\.."

echo ============================================================
echo  Cloudflare Quick Tunnel (port 8000 → 외부 HTTPS)
echo ============================================================
echo.
echo 출력 중간에 보이는
echo   https://xxx-xxx-xxx.trycloudflare.com
echo URL 을 폰·외부 PC 에서 접속하세요.
echo.
echo 종료: Ctrl+C
echo ============================================================
echo.

where cloudflared > nul 2>&1
if errorlevel 1 (
    echo [!] cloudflared 설치 안 됨.
    echo     winget install Cloudflare.cloudflared
    echo.
    pause
    exit /b 1
)

cloudflared tunnel --url http://localhost:8000

echo.
echo === 터널 종료됨 ===
pause
