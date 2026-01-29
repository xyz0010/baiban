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

git rev-parse --verify origin >nul 2>nul
if errorlevel 1 (
  echo Remote "origin" not found. Please add remote first.
  pause
  exit /b 1
)

git fetch origin
if errorlevel 1 (
  echo git fetch failed.
  pause
  exit /b 1
)

git pull --rebase --autostash origin "%BRANCH%"
if errorlevel 1 (
  echo git pull --rebase --autostash failed.
  pause
  exit /b 1
)

for /f "delims=" %%u in ('git rev-parse --abbrev-ref --symbolic-full-name "@{u}" 2^>nul') do set "UPSTREAM=%%u"
if "%UPSTREAM%"=="" (
  echo No upstream set. Setting upstream to origin/%BRANCH% ...
  git push -u origin "%BRANCH%"
  if errorlevel 1 (
    echo git push failed.
    pause
    exit /b 1
  )
)

for /f "delims=" %%p in ('git status --porcelain 2^>nul') do set "HAS_CHANGES=1"
if defined HAS_CHANGES (
  for /f "delims=" %%t in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"') do set "TS=%%t"
  git add -A
  if errorlevel 1 (
    echo git add failed.
    pause
    exit /b 1
  )
  git commit -m "chore: auto sync !TS!"
  if errorlevel 1 (
    echo git commit failed.
    pause
    exit /b 1
  )
)

git push origin "%BRANCH%"
if errorlevel 1 (
  echo git push failed.
  pause
  exit /b 1
)

echo.
git status -sb
echo.
echo Done.
pause
exit /b 0
