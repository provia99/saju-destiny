@echo off
chcp 65001 > nul
title banya_web - Initial Setup
cd /d "%~dp0\.."

echo ============================================================
echo  banya_web 초기 환경 셋업 (PC 처음 한 번)
echo ============================================================
echo.

echo [1/4] Python 버전 확인...
python --version
if errorlevel 1 (
    echo [!] Python 없음. winget install Python.Python.3.14
    pause
    exit /b 1
)

echo.
echo [2/4] Node.js 버전 확인...
node --version
if errorlevel 1 (
    echo [!] Node 없음. winget install OpenJS.NodeJS
    pause
    exit /b 1
)

echo.
echo [3/4] Python 가상환경(.venv) 만들기 + 의존성 설치...
if not exist .venv (
    python -m venv .venv
)
call .venv\Scripts\activate.bat
pip install --upgrade pip
pip install -r requirements.txt
if errorlevel 1 (
    echo [!] pip install 실패. 위 메시지 확인.
    pause
    exit /b 1
)

echo.
echo [4/4] Node 의존성 설치 (engine\)...
cd engine
call npm install
cd ..

echo.
echo ============================================================
echo  셋업 완료
echo ============================================================
echo.

echo [점검 — 누락 시 USB/다른 PC 에서 복사 필요]
if not exist .env (
    echo  [!] .env 없음 — 비밀키 파일 복사 필요
)
if not exist data\banya.db (
    echo  [!] data\banya.db 없음 — DB 파일 복사 필요
)
if not exist engine\fonts (
    echo  [!] engine\fonts 없음 — 폰트 자산 복사 필요
)
if not exist engine\images (
    echo  [!] engine\images 없음 — 이미지 자산 복사 필요
)
if not exist static\filler (
    echo  [!] static\filler 없음 — filler PDF 자산 복사 필요
)

echo.
echo [선택] Ollama + Gemma 4 (챗봇용):
echo   winget install Ollama.Ollama
echo   ollama pull gemma3:9b
echo.
echo [선택] cloudflared (외부 노출):
echo   winget install Cloudflare.cloudflared
echo.

echo 모든 누락 항목 채우면 start-server.bat 으로 실행 가능.
pause
