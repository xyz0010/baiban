@echo off
:: Ensure we are in the script's directory
cd /d "%~dp0"

echo ==========================================
echo       Git Auto Update Script
echo ==========================================

echo.
echo [1/3] Adding changes...
git add .

echo.
echo [2/3] Committing changes...
:: Ask for commit message with a default
set "commit_msg="
set /p commit_msg="Enter commit message (Press Enter for default 'Auto update'): "
if "%commit_msg%"=="" set commit_msg=Auto update

git commit -m "%commit_msg%"

echo.
echo [3/3] Pushing to remote...
git push

echo.
echo ==========================================
echo       Update Complete!
echo ==========================================
pause
