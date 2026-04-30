@echo off
chcp 65001 > nul
title banya_web - Server (port 8000)
cd /d "%~dp0\.."

echo ============================================================
echo  banya_web 서버 시작 (port 8000)
echo ============================================================
echo.

if not exist .venv (
    echo [!] 가상환경(.venv)이 없습니다.
    echo     setup-env.bat 을 먼저 실행하거나 수동으로:
    echo       python -m venv .venv
    echo       .venv\Scripts\activate
    echo       pip install -r requirements.txt
    echo.
    pause
    exit /b 1
)

if not exist data\banya.db (
    echo [!] data\banya.db 없습니다. USB 또는 다른 PC 에서 복사 필요.
    echo.
)

if not exist .env (
    echo [!] .env 파일 없습니다. .env.example 참고해 작성 필요.
    echo.
)

call .venv\Scripts\activate.bat
python main.py

REM 서버 종료 시 (Ctrl+C 등) 잠깐 대기
echo.
echo === 서버 종료됨 ===
pause
