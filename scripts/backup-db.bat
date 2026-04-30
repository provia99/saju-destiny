@echo off
chcp 65001 > nul
title banya_web - DB Backup
cd /d "%~dp0\.."

echo ============================================================
echo  data\banya.db 백업
echo ============================================================
echo.

if not exist data\banya.db (
    echo [!] data\banya.db 없음.
    pause
    exit /b 1
)

if not exist backups mkdir backups

REM 타임스탬프 (YYYYMMDD_HHMM)
for /f "tokens=2 delims==" %%I in ('"wmic os get localdatetime /value"') do set DT=%%I
set TS=%DT:~0,8%_%DT:~8,4%

set BACKUP_FILE=backups\banya_%TS%.db

copy /Y data\banya.db "%BACKUP_FILE%"
if errorlevel 1 (
    echo [!] 백업 실패
    pause
    exit /b 1
)

echo.
echo === 백업 완료 ===
echo 위치: %BACKUP_FILE%
echo.

echo [기존 백업 목록]
dir /B backups\banya_*.db

echo.
echo [용량 확인]
for %%F in ("%BACKUP_FILE%") do echo %%~zF bytes

echo.
echo TIP: 30일 이상 된 백업 정리는 cleanup-backups.bat 사용
pause
