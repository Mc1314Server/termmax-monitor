# TermMax Monitor - Windows 安装脚本
# 使用方法: 右键 -> 使用 PowerShell 运行
# 或在 PowerShell 中执行: .\install-windows.ps1

$ErrorActionPreference = "Stop"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  TermMax Monitor 安装脚本 (Windows)" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# 获取脚本目录
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectDir = Split-Path -Parent $ScriptDir

# 检查 Node.js
Write-Host "[1/5] 检查 Node.js..." -ForegroundColor Green
try {
    $nodeVersion = node --version
    Write-Host "Node.js 已安装: $nodeVersion"
} catch {
    Write-Host "错误: Node.js 未安装！" -ForegroundColor Red
    Write-Host "请先安装 Node.js: https://nodejs.org/" -ForegroundColor Yellow
    Write-Host "按任意键退出..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

# 安装后端依赖
Write-Host ""
Write-Host "[2/5] 安装后端依赖..." -ForegroundColor Green
Set-Location "$ProjectDir\backend"
npm install
Write-Host "后端依赖安装完成" -ForegroundColor Green

# 配置环境变量
Write-Host ""
Write-Host "[3/5] 配置环境变量..." -ForegroundColor Green
if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Host "已创建 .env 文件" -ForegroundColor Yellow
    Write-Host "请编辑配置文件: $ProjectDir\backend\.env" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "必须配置的项目:" -ForegroundColor Yellow
    Write-Host "  - TELEGRAM_BOT_TOKEN"
    Write-Host "  - TELEGRAM_CHAT_ID"
} else {
    Write-Host ".env 文件已存在"
}

# 安装前端依赖
Write-Host ""
Write-Host "[4/5] 安装前端依赖..." -ForegroundColor Green
Set-Location "$ProjectDir\frontend"
npm install
Write-Host "前端依赖安装完成" -ForegroundColor Green

# 构建前端
Write-Host ""
Write-Host "[5/5] 构建前端..." -ForegroundColor Green
npm run build
Write-Host "前端构建完成" -ForegroundColor Green

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "安装完成！" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "后续步骤:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. 编辑配置文件:"
Write-Host "   notepad $ProjectDir\backend\.env"
Write-Host ""
Write-Host "2. 启动后端服务:"
Write-Host "   cd $ProjectDir\backend"
Write-Host "   npm start"
Write-Host ""
Write-Host "3. (可选) 使用 PM2 管理进程:"
Write-Host "   npm install -g pm2"
Write-Host "   pm2 start src/index.js --name termmax-backend"
Write-Host ""
Write-Host "4. 访问前端界面:"
Write-Host "   http://localhost:3001 (后端API)"
Write-Host "   或部署 frontend/dist 目录到 Web 服务器"
Write-Host ""

# 返回项目目录
Set-Location $ProjectDir

Write-Host "按任意键退出..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
