@echo off
chcp 65001 > nul
title banya_web - Dev Up (orchestrator)
cd /d "%~dp0\.."

echo ============================================================
echo  banya_web 개발 환경 한 번에 시작
echo  (1) git pull → (2) 서버 → (3) 터널 (선택)
echo ============================================================
echo.

echo [1/3] 최신 코드 받기...
git pull
if errorlevel 1 (
    echo.
    echo [!] git pull 실패. 수동 점검 후 재시도하세요.
    pause
    exit /b 1
)
echo.

echo [2/3] 서버 별 창에서 시작...
start "banya_web Server" "%~dp0start-server.bat"
echo.

echo === 서버 부팅 대기 (3초) ===
timeout /t 3 > nul
echo.

set /p TUNNEL="외부 노출(Cloudflare 터널) 도 시작할까요? [y/N]: "
if /i "%TUNNEL%"=="y" (
    echo [3/3] 터널 별 창에서 시작...
    start "Cloudflare Tunnel" "%~dp0start-tunnel.bat"
    echo.
    echo === 모두 시작됨 ===
    echo  - 로컬:  http://localhost:8000
    echo  - 외부:  Cloudflare 창에서 https://xxx.trycloudflare.com URL 확인
) else (
    echo === 서버만 시작됨 (로컬 전용) ===
    echo  - http://localhost:8000
)

echo.
echo 종료하려면 stop-all.bat 실행
pause
