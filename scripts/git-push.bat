@echo off
chcp 65001 > nul
title banya_web - Git Push
cd /d "%~dp0\.."

echo ============================================================
echo  GitHub 에 변경사항 올리기
echo ============================================================
echo.

echo [현재 변경사항]
git status --short
echo.

git diff --quiet HEAD 2>nul
if not errorlevel 1 (
    echo === 변경사항이 없습니다. push 안 함. ===
    pause
    exit /b 0
)

set /p MSG="커밋 메시지 (한 줄): "
if "%MSG%"=="" (
    echo.
    echo === 메시지 비어있어 취소됨 ===
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
    echo [!] push 실패 - 인증 또는 충돌 가능
    echo     git pull --rebase 후 재시도 또는 PAT 갱신
    pause
    exit /b 1
)

echo.
echo === push 완료 ===
pause
