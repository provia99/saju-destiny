@echo off
chcp 65001 > nul
title banya_web - Git Pull (DB 안전)
cd /d "%~dp0\.."

echo ============================================================
echo  GitHub 에서 최신 코드 + DB 받기
echo  (DB 안전 위해 서버를 잠시 정지함)
echo ============================================================
echo.

REM 8000 포트 점유 시 → 서버 자동 정지
netstat -ano | findstr ":8000" | findstr "LISTENING" > nul
if not errorlevel 1 (
    echo [*] 서버 실행 중 — DB 안전 pull 위해 정지...
    taskkill /F /IM python.exe 2>nul > nul
    timeout /t 2 > nul
    echo     서버 정지됨
    set RESTART=1
) else (
    set RESTART=0
)

echo.
echo [현재 브랜치]
git branch --show-current
echo.

echo [원격 변경 사항 확인 중...]
git fetch origin
echo.

echo [로컬과 원격 비교]
git log HEAD..origin/main --oneline
echo.

echo [pull 실행]
git pull
if errorlevel 1 (
    echo.
    echo [!] pull 실패 — 충돌 또는 인증 문제
    echo     git status 로 상태 점검
    pause
    exit /b 1
)

echo.
echo [의존성 변경 점검]
git diff HEAD@{1} HEAD --name-only 2>nul | findstr /B "requirements.txt" > nul
if not errorlevel 1 (
    echo  [!] requirements.txt 변경됨 - pip install 권장
    echo      .venv\Scripts\activate
    echo      pip install -r requirements.txt
)

git diff HEAD@{1} HEAD --name-only 2>nul | findstr "engine/package.json" > nul
if not errorlevel 1 (
    echo  [!] engine\package.json 변경됨 - npm install 권장
)

git diff HEAD@{1} HEAD --name-only 2>nul | findstr "data/banya.db" > nul
if not errorlevel 1 (
    echo  [+] data\banya.db 갱신됨 (다른 PC 작업 반영)
)

echo.

REM 자동 재시작 (선택)
if %RESTART%==1 (
    echo === 서버 자동 재시작? ===
    set /p RS="다시 시작하려면 Y, 안 할 거면 그냥 Enter [Y/n]: "
    if /i not "%RS%"=="n" (
        echo.
        echo [서버 재시작]
        start "banya_web Server" "%~dp0start-server.bat"
    )
)

echo.
echo === pull 완료 ===
pause
