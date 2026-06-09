@echo off
setlocal

REM Spoustej tenhle soubor z korenove slozky projektu.
REM Na plose si udelej pouze zastupce na tenhle .bat soubor.
set "PROJECT_DIR=%~dp0"

title GoPay Test Console

cd /d "%PROJECT_DIR%"

if not exist "package.json" (
  echo [ERROR] Tenhle .bat musi byt v korenove slozce projektu vedle package.json.
  echo Aktualni slozka:
  echo %PROJECT_DIR%
  echo.
  pause
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js neni dostupny v PATH.
  echo Nainstaluj Node.js a zkus to znovu.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm neni dostupne v PATH.
  echo Zkontroluj instalaci Node.js.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo node_modules neexistuje, spoustim npm install...
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo [ERROR] npm install selhal.
    pause
    exit /b 1
  )
)

echo Spoustim GoPay Test Console...
echo Backend:  http://localhost:3001
echo Frontend: http://localhost:5173
echo.

start "" cmd /c "timeout /t 4 /nobreak >nul && start http://localhost:5173"

call npm run dev

echo.
echo Aplikace byla ukoncena.
pause
