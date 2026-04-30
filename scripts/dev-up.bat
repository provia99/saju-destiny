@echo off
chcp 65001 > nul
title banya_web - Dev Up (orchestrator, DB 안전)
cd /d "%~dp0\.."

echo ============================================================
echo  banya_web 개발 환경 시작
echo  (1) 서버 정지 → (2) git pull → (3) 서버 시작 → (4) 터널 (선택)
echo ============================================================
echo.

REM 1. 서버 실행 중이면 정지
netstat -ano | findstr ":8000" | findstr "LISTENING" > nul
if not errorlevel 1 (
    echo [1/4] 기존 서버 정지...
    taskkill /F /IM python.exe 2>nul > nul
    timeout /t 2 > nul
) else (
    echo [1/4] 서버 안 떠있음 — skip
)
echo.

REM 2. Git pull
echo [2/4] 최신 코드 + DB 받기...
git pull
if errorlevel 1 (
    echo.
    echo [!] git pull 실패. 수동 점검 후 재시도.
    pause
    exit /b 1
)
echo.

REM 3. 서버 별 창 시작
echo [3/4] 서버 별 창에서 시작...
start "banya_web Server" "%~dp0start-server.bat"
echo.

echo === 서버 부팅 대기 (3초) ===
timeout /t 3 > nul
echo.

REM 4. 터널 (선택)
set /p TUNNEL="외부 노출(Cloudflare 터널) 도 시작할까요? [y/N]: "
if /i "%TUNNEL%"=="y" (
    echo [4/4] 터널 별 창에서 시작...
    start "Cloudflare Tunnel" "%~dp0start-tunnel.bat"
    echo.
    echo === 모두 시작됨 ===
    echo  - 로컬:  http://localhost:8000
    echo  - 외부:  Cloudflare 창에서 https://xxx.trycloudflare.com URL 확인
) else (
    echo [4/4] 터널 skip
    echo.
    echo === 서버만 시작됨 ===
    echo  - http://localhost:8000
)

echo.
echo 종료 시 작업 흐름:
echo   1. git-push.bat 실행 (DB 포함 변경사항 GitHub에 올림)
echo   2. stop-all.bat 실행 (서버·터널 정지)
echo.
pause
