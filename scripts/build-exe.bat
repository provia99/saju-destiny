@echo off
chcp 65001 > nul
title banya_control - .exe 빌드
cd /d "%~dp0\.."

echo ============================================================
echo  banya_control.exe 빌드 (PyInstaller)
echo ============================================================
echo.

if not exist .venv (
    echo [!] 가상환경 없음. setup-env.bat 먼저 실행.
    pause
    exit /b 1
)

call .venv\Scripts\activate.bat

echo [1/3] PyInstaller 설치 점검...
python -m pip show pyinstaller > nul 2>&1
if errorlevel 1 (
    echo PyInstaller 설치 중...
    python -m pip install pyinstaller
    if errorlevel 1 (
        echo [!] PyInstaller 설치 실패
        pause
        exit /b 1
    )
)

echo.
echo [2/3] 이전 빌드 정리...
if exist build  rmdir /S /Q build
if exist dist   rmdir /S /Q dist
if exist banya_control.spec del /Q banya_control.spec

echo.
echo [3/3] .exe 빌드 (1~3분 소요)...
pyinstaller --onefile --noconsole --name banya_control banya_control.py
if errorlevel 1 (
    echo [!] 빌드 실패
    pause
    exit /b 1
)

echo.
echo ============================================================
echo  빌드 완료
echo ============================================================
echo.
echo 결과물: dist\banya_control.exe
echo 사용법: 더블클릭으로 실행
echo.
echo TIP: dist\banya_control.exe 를 프로젝트 루트로 복사하거나
echo      바탕화면에 바로가기 만들면 어디서든 더블클릭으로 실행 가능
echo.

REM 프로젝트 루트에 자동 복사 (편의)
set /p COPY="dist\banya_control.exe 를 프로젝트 루트로 복사? [Y/n]: "
if /i "%COPY%"=="" set COPY=Y
if /i "%COPY%"=="Y" (
    copy /Y dist\banya_control.exe banya_control.exe
    echo  → banya_control.exe 가 프로젝트 루트에 복사됨
)

echo.
pause
