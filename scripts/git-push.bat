@echo off
chcp 65001 > nul
title banya_web - Git Push (DB 포함, 안전)
cd /d "%~dp0\.."

echo ============================================================
echo  GitHub 에 변경사항 + DB 올리기
echo  (DB 안전 위해 서버를 잠시 정지함)
echo ============================================================
echo.

REM 8000 포트 점유 시 → 서버 자동 정지
netstat -ano | findstr ":8000" | findstr "LISTENING" > nul
if not errorlevel 1 (
    echo [*] 서버 실행 중 — DB 안전 commit 위해 정지...
    taskkill /F /IM python.exe 2>nul > nul
    timeout /t 2 > nul
    echo     서버 정지됨
    set RESTART=1
) else (
    set RESTART=0
)

echo.
echo [현재 변경사항]
git status --short
echo.

git diff --quiet HEAD 2>nul
if not errorlevel 1 (
    echo === 변경사항이 없습니다. push 안 함. ===
    if %RESTART%==1 (
        echo 서버 재시작...
        start "banya_web Server" "%~dp0start-server.bat"
    )
    pause
    exit /b 0
)

set /p MSG="커밋 메시지 (한 줄): "
if "%MSG%"=="" (
    echo.
    echo === 메시지 비어있어 취소됨 ===
    if %RESTART%==1 (
        echo 서버 재시작...
        start "banya_web Server" "%~dp0start-server.bat"
    )
    pause
    exit /b 1
)

echo.
echo [stage 추가]
git add .

echo.
echo [커밋]
git commit -m "%MSG%"
if errorlevel 1 (
    echo.
    echo [!] 커밋 실패
    pause
    exit /b 1
)

echo.
echo [push]
git push
if errorlevel 1 (
    echo.
    echo [!] push 실패 — 인증 또는 다른 PC 가 먼저 push 함
    echo.
    echo 해결: git pull --rebase 후 재시도
    echo       또는 다른 PC 동시 작업 점검
    pause
    exit /b 1
)

echo.
echo === push 완료 ===

if %RESTART%==1 (
    echo.
    echo [서버 재시작]
    start "banya_web Server" "%~dp0start-server.bat"
)

pause
