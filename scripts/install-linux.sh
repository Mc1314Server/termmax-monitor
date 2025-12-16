#!/bin/bash

# TermMax Monitor - Linux 一键安装脚本
# 使用方法: chmod +x install-linux.sh && ./install-linux.sh

set -e

echo "=========================================="
echo "  TermMax Monitor 安装脚本 (Linux)"
echo "=========================================="

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 检查是否为 root
if [ "$EUID" -eq 0 ]; then
    echo -e "${YELLOW}警告: 建议不要以 root 用户运行${NC}"
fi

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo -e "\n${GREEN}[1/6] 检查 Node.js...${NC}"
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo "Node.js 已安装: $NODE_VERSION"
else
    echo -e "${YELLOW}Node.js 未安装，正在安装...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
    echo "Node.js 安装完成: $(node --version)"
fi

echo -e "\n${GREEN}[2/6] 安装后端依赖...${NC}"
cd "$PROJECT_DIR/backend"
npm install
echo "后端依赖安装完成"

echo -e "\n${GREEN}[3/6] 配置环境变量...${NC}"
if [ ! -f .env ]; then
    cp .env.example .env
    echo -e "${YELLOW}已创建 .env 文件，请编辑配置:${NC}"
    echo "  nano $PROJECT_DIR/backend/.env"
    echo ""
    echo "必须配置的项目:"
    echo "  - TELEGRAM_BOT_TOKEN"
    echo "  - TELEGRAM_CHAT_ID"
else
    echo ".env 文件已存在"
fi

echo -e "\n${GREEN}[4/6] 安装前端依赖...${NC}"
cd "$PROJECT_DIR/frontend"
npm install
echo "前端依赖安装完成"

echo -e "\n${GREEN}[5/6] 构建前端...${NC}"
npm run build
echo "前端构建完成"

echo -e "\n${GREEN}[6/6] 安装 PM2...${NC}"
if command -v pm2 &> /dev/null; then
    echo "PM2 已安装"
else
    sudo npm install -g pm2
    echo "PM2 安装完成"
fi

echo ""
echo "=========================================="
echo -e "${GREEN}安装完成！${NC}"
echo "=========================================="
echo ""
echo "后续步骤:"
echo "1. 编辑配置文件:"
echo "   nano $PROJECT_DIR/backend/.env"
echo ""
echo "2. 启动服务:"
echo "   cd $PROJECT_DIR/backend"
echo "   pm2 start src/index.js --name termmax-backend"
echo ""
echo "3. 设置开机自启:"
echo "   pm2 save"
echo "   pm2 startup"
echo ""
echo "4. 查看日志:"
echo "   pm2 logs termmax-backend"
echo ""
