@echo off
chcp 65001 > nul
title banya_web - Git Pull
cd /d "%~dp0\.."

echo ============================================================
echo  GitHub 에서 최신 코드 받기
echo ============================================================
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
    echo [!] pull 실패 - 충돌 또는 인증 문제 가능
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
    echo      cd engine ^&^& npm install ^&^& cd ..
)

echo.
echo === pull 완료 ===
pause
