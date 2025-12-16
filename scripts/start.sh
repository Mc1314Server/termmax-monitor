#!/bin/bash

# TermMax Monitor - 启动脚本 (Linux)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "启动 TermMax Monitor..."

cd "$PROJECT_DIR/backend"

# 检查是否安装了 PM2
if command -v pm2 &> /dev/null; then
    # 检查是否已经运行
    if pm2 list | grep -q "termmax-backend"; then
        echo "服务已在运行，正在重启..."
        pm2 restart termmax-backend
    else
        echo "使用 PM2 启动服务..."
        pm2 start src/index.js --name termmax-backend
    fi
    pm2 logs termmax-backend --lines 20
else
    echo "使用 Node.js 直接启动..."
    node src/index.js
fi
