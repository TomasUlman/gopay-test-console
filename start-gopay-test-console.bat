@echo off
setlocal
cd /d "%~dp0"

title GoPay Test Console v1.0

echo.
echo ========================================
echo  GoPay Test Console v1.0
echo  Local PHP Testing Hub
echo ========================================
echo.

where php >nul 2>nul
if errorlevel 1 (
  echo [ERROR] PHP was not found in PATH.
  echo Install PHP 8.1+ or add php.exe to PATH.
  echo.
  pause
  exit /b 1
)

if not exist vendor\autoload.php (
  where composer >nul 2>nul
  if errorlevel 1 (
    echo [ERROR] Composer was not found in PATH.
    echo Run composer install manually first, or install Composer.
    echo.
    pause
    exit /b 1
  )

  echo [INFO] Vendor folder not found. Running composer install...
  composer install
  if errorlevel 1 (
    echo.
    echo [ERROR] composer install failed.
    echo.
    pause
    exit /b 1
  )
)

if not exist .env (
  echo [INFO] .env not found. Creating it from .env.example...
  copy .env.example .env >nul
  echo [INFO] Fill in your GoPay credentials in .env.
)

if not exist storage\history mkdir storage\history

echo [INFO] Starting local server on http://localhost:8080
echo [INFO] Keep this window open while using the app.
echo [INFO] Stop the server with Ctrl+C.
echo.

start "" "http://localhost:8080"
php -S localhost:8080 -t public

echo.
echo [INFO] Server stopped.
pause
