@echo off
REM TermMax Monitor - 启动脚本 (Windows)

echo 启动 TermMax Monitor...

cd /d "%~dp0..\backend"

REM 检查是否安装了 PM2
where pm2 >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo 使用 PM2 启动...
    pm2 start src/index.js --name termmax-backend
    pm2 logs termmax-backend --lines 20
) else (
    echo 使用 Node.js 直接启动...
    node src/index.js
)

pause
