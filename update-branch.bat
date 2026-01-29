@echo off
setlocal EnableExtensions EnableDelayedExpansion

cd /d "%~dp0"

git rev-parse --is-inside-work-tree >nul 2>nul
if errorlevel 1 (
  echo Not a git repository: %cd%
  pause
  exit /b 1
)

for /f "delims=" %%b in ('git rev-parse --abbrev-ref HEAD 2^>nul') do set "BRANCH=%%b"
if "%BRANCH%"=="" (
  echo Failed to detect current branch.
  pause
  exit /b 1
)

if /i "%BRANCH%"=="HEAD" (
  echo Detached HEAD state. Please checkout a branch first.
  pause
  exit /b 1
)

echo Repo: %cd%
echo Branch: %BRANCH%
echo.

git fetch origin
if errorlevel 1 (
  echo git fetch failed.
  pause
  exit /b 1
)

git pull --rebase --autostash origin "%BRANCH%"
if errorlevel 1 (
  echo.
  echo git pull --rebase --autostash failed. Trying manual stash flow...
  echo.
  set "STASH_CREATED="
  for /f "delims=" %%s in ('git stash push -u -m "auto-stash(update-branch.bat)" 2^>nul') do (
    echo %%s | findstr /i /c:"Saved working directory" >nul && set "STASH_CREATED=1"
  )
  git pull --rebase origin "%BRANCH%"
  if errorlevel 1 (
    echo git pull --rebase failed. Resolve conflicts then run again.
    pause
    exit /b 1
  )
  if defined STASH_CREATED (
    git stash pop
    if errorlevel 1 (
      echo git stash pop had conflicts. Resolve and continue.
      pause
      exit /b 1
    )
  )
)

echo.
git status -sb
echo.
echo Done.
pause
exit /b 0
