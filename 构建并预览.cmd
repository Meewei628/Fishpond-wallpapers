@echo off
chcp 65001 >nul
cd /d "%~dp0"
node build-standalone.cjs
if errorlevel 1 (
  echo 构建失败。
  pause
  exit /b 1
)
start "" "%~dp0index.html"
