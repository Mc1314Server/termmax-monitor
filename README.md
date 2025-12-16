# TermMax Monitor

TermMax 双币投资池监控系统 - 实时监控 BSC 链上的双币投资产品，支持 Telegram 机器人推送告警。

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-green.svg)

## 功能特性

### 核心功能
- **实时池监控**: 自动获取 TermMax Alpha 收益池数据（TVL、APY、利用率等）
- **价格追踪**: 实时监控标的资产价格与行权价距离
- **新池上线检测**: 检测到新收益池上线后自动 TG 推送通知
- **自定义告警规则**: 支持 APY、价格距离、TVL、利用率等多维度告警
- **投资追踪**: 记录投资金额，自动计算预期收益和每日利润
- **每日报告**: 每天早上 8 点自动发送投资盈利报告

### Telegram 机器人命令
| 命令 | 说明 |
|------|------|
| `/start` | 启动机器人，获取 Chat ID |
| `/status` | 查看监控状态和系统摘要 |
| `/pools` | 列出所有池子详情 |
| `/prices` | 查看代币价格（24h 变化） |
| `/tvl` | 查看 TVL 信息 |
| `/alerts` | 查看最近告警 |
| `/watchlist` | 查看自定义监控列表 |
| `/calc <token> <amount>` | 计算预期收益 |
| `/invest <token> <amount>` | 追踪投资 |
| `/report` | 查看投资报告 |
| `/help` | 显示帮助信息 |

### 自动告警类型
- 🆕 新收益池上线通知
- 🚨 价格接近行权价告警（<5%）
- 📊 TVL 大幅变化告警（>20%）
- 📈 APY 显著变化告警
- 📊 利用率飙升告警
- ⏰ 池子到期通知

## 项目结构

```
termmax/
├── backend/                    # 后端服务
│   ├── src/
│   │   ├── index.js           # 主入口，Express + WebSocket 服务器
│   │   ├── config/
│   │   │   └── index.js       # 配置文件
│   │   └── services/
│   │       ├── termmaxService.js      # TermMax API 数据获取
│   │       ├── telegramService.js     # Telegram 机器人服务
│   │       ├── monitorService.js      # 监控调度服务
│   │       ├── alertService.js        # 告警服务
│   │       ├── watchlistService.js    # 自定义监控规则服务
│   │       ├── poolDetectionService.js # 新池检测服务
│   │       ├── priceService.js        # 价格缓存服务
│   │       └── tvlService.js          # TVL 数据服务
│   ├── data/                  # 数据存储目录
│   │   ├── watchlist.json     # 监控规则持久化
│   │   └── known_pools.json   # 已知池子记录
│   ├── .env                   # 环境变量配置
│   ├── .env.example           # 环境变量示例
│   └── package.json
│
└── frontend/                   # 前端界面
    ├── src/
    │   ├── App.jsx            # 主应用组件
    │   ├── main.jsx           # 入口文件
    │   └── index.css          # 全局样式
    ├── index.html
    ├── vite.config.js         # Vite 配置
    ├── tailwind.config.js     # Tailwind CSS 配置
    └── package.json
```

## 技术栈

### 后端
- **Node.js** (>= 18.0.0)
- **Express** - Web 服务器
- **WebSocket (ws)** - 实时数据推送
- **node-telegram-bot-api** - Telegram 机器人
- **axios** - HTTP 请求
- **ethers** - 以太坊交互

### 前端
- **React 18** - UI 框架
- **Vite** - 构建工具
- **Tailwind CSS** - 样式框架
- **Recharts** - 图表库
- **Axios** - HTTP 客户端

---

# 部署教程

## 前置要求

### 1. 创建 Telegram 机器人

1. 在 Telegram 中搜索 `@BotFather`
2. 发送 `/newbot` 创建新机器人
3. 按提示设置机器人名称和用户名
4. 获取 **Bot Token**（格式：`123456789:ABCdefGHIjklMNOpqrsTUVwxyz`）
5. 保存好 Token，后续配置需要

### 2. 获取 Chat ID

启动机器人后，向机器人发送 `/start`，机器人会返回你的 Chat ID。

---

## Linux 系统部署（Ubuntu/Debian）

### 步骤 1：安装系统依赖

```bash
# 更新系统包
sudo apt update && sudo apt upgrade -y

# 安装必要工具
sudo apt install -y curl git build-essential
```

### 步骤 2：安装 Node.js

```bash
# 安装 Node.js 20.x (LTS)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 验证安装
node --version  # 应显示 v20.x.x
npm --version   # 应显示 10.x.x
```

### 步骤 3：创建项目目录并上传代码

```bash
# 创建项目目录
sudo mkdir -p /opt/termmax
sudo chown $USER:$USER /opt/termmax
cd /opt/termmax

# 方式1：如果有 Git 仓库
git clone <your-repo-url> .

# 方式2：手动上传
# 使用 scp 或 sftp 上传项目文件到 /opt/termmax
```

### 步骤 4：配置后端

```bash
cd /opt/termmax/backend

# 安装依赖
npm install

# 创建环境变量配置
cp .env.example .env

# 编辑配置文件
nano .env
```

编辑 `.env` 文件内容：

```env
# Telegram 配置（必填）
TELEGRAM_BOT_TOKEN=你的机器人Token
TELEGRAM_CHAT_ID=你的ChatID

# RPC 节点（可选，使用默认值即可）
BSC_RPC_URL=https://bsc-dataseed1.binance.org

# 监控设置
MONITOR_INTERVAL=60000      # 监控间隔（毫秒），默认1分钟
TVL_CHANGE_THRESHOLD=20     # TVL变化告警阈值（%）
PRICE_ALERT_THRESHOLD=5     # 价格告警阈值（%）

# 服务器端口
PORT=3001
```

### 步骤 5：构建前端

```bash
cd /opt/termmax/frontend

# 安装依赖
npm install

# 构建生产版本
npm run build

# 构建完成后，静态文件在 dist/ 目录
```

### 步骤 6：安装 Nginx（可选，用于前端静态托管）

```bash
# 安装 Nginx
sudo apt install -y nginx

# 创建 Nginx 配置
sudo nano /etc/nginx/sites-available/termmax
```

Nginx 配置文件内容：

```nginx
server {
    listen 80;
    server_name your-domain.com;  # 替换为你的域名或IP

    # 前端静态文件
    location / {
        root /opt/termmax/frontend/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # 后端 API 代理
    location /api {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket 代理
    location /ws {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

启用配置：

```bash
# 创建软链接
sudo ln -s /etc/nginx/sites-available/termmax /etc/nginx/sites-enabled/

# 删除默认配置（可选）
sudo rm /etc/nginx/sites-enabled/default

# 测试配置
sudo nginx -t

# 重启 Nginx
sudo systemctl restart nginx
sudo systemctl enable nginx
```

### 步骤 7：使用 PM2 管理后端进程

```bash
# 全局安装 PM2
sudo npm install -g pm2

# 启动后端服务
cd /opt/termmax/backend
pm2 start src/index.js --name termmax-backend

# 保存 PM2 进程列表
pm2 save

# 设置开机自启
pm2 startup
# 执行输出的命令，例如：
# sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu

# 查看运行状态
pm2 status
pm2 logs termmax-backend
```

### 步骤 8：配置防火墙（可选）

```bash
# 使用 UFW
sudo ufw allow 80/tcp      # HTTP
sudo ufw allow 443/tcp     # HTTPS（如果配置了SSL）
sudo ufw allow 3001/tcp    # 后端端口（如果不使用Nginx代理）
sudo ufw enable
```

### PM2 常用命令

```bash
pm2 status                 # 查看进程状态
pm2 logs termmax-backend   # 查看日志
pm2 restart termmax-backend # 重启服务
pm2 stop termmax-backend   # 停止服务
pm2 delete termmax-backend # 删除进程
```

---

## Windows 系统部署

### 步骤 1：安装 Node.js

1. 访问 [Node.js 官网](https://nodejs.org/)
2. 下载 **LTS 版本**（推荐 20.x）
3. 运行安装程序，一路 Next
4. 安装完成后，打开 **PowerShell** 或 **CMD** 验证：

```powershell
node --version
npm --version
```

### 步骤 2：准备项目文件

1. 将项目文件夹解压到你想要的位置，例如：`C:\termmax`
2. 确保目录结构如下：
```
C:\termmax\
├── backend\
└── frontend\
```

### 步骤 3：配置后端

打开 **PowerShell**（管理员模式），执行：

```powershell
# 进入后端目录
cd C:\termmax\backend

# 安装依赖
npm install

# 复制配置文件
copy .env.example .env

# 用记事本编辑配置
notepad .env
```

编辑 `.env` 文件（参考 Linux 部分的配置说明）。

### 步骤 4：构建前端

```powershell
# 进入前端目录
cd C:\termmax\frontend

# 安装依赖
npm install

# 构建
npm run build
```

### 步骤 5：启动服务

#### 方式 1：直接运行（开发/测试用）

```powershell
# 启动后端
cd C:\termmax\backend
npm start

# 新开一个 PowerShell 窗口，启动前端开发服务器（可选）
cd C:\termmax\frontend
npm run dev
```

#### 方式 2：使用 PM2（推荐生产环境）

```powershell
# 全局安装 PM2
npm install -g pm2

# 安装 Windows 服务支持
npm install -g pm2-windows-startup

# 启动后端
cd C:\termmax\backend
pm2 start src/index.js --name termmax-backend

# 保存并设置开机自启
pm2 save
pm2-startup install
```

#### 方式 3：使用 NSSM 创建 Windows 服务（最稳定）

1. 下载 [NSSM](https://nssm.cc/download)
2. 解压到 `C:\nssm`
3. 打开 **管理员 PowerShell**：

```powershell
# 安装服务
C:\nssm\win64\nssm.exe install TermMaxMonitor

# 在弹出的界面中配置：
# Path: C:\Program Files\nodejs\node.exe
# Startup directory: C:\termmax\backend
# Arguments: src/index.js

# 或者使用命令行配置
C:\nssm\win64\nssm.exe set TermMaxMonitor Application "C:\Program Files\nodejs\node.exe"
C:\nssm\win64\nssm.exe set TermMaxMonitor AppDirectory "C:\termmax\backend"
C:\nssm\win64\nssm.exe set TermMaxMonitor AppParameters "src/index.js"

# 启动服务
C:\nssm\win64\nssm.exe start TermMaxMonitor
```

### 步骤 6：配置 IIS 托管前端（可选）

如果需要在 Windows 上托管前端静态文件：

1. 安装 IIS：
   - 打开 **控制面板** > **程序和功能** > **启用或关闭 Windows 功能**
   - 勾选 **Internet Information Services**

2. 配置网站：
   - 打开 **IIS 管理器**
   - 右键 **网站** > **添加网站**
   - 网站名称：`TermMax`
   - 物理路径：`C:\termmax\frontend\dist`
   - 端口：`80`（或其他端口）

3. 安装 URL Rewrite 模块（支持 SPA 路由）：
   - 下载并安装 [URL Rewrite](https://www.iis.net/downloads/microsoft/url-rewrite)
   - 在 `C:\termmax\frontend\dist` 创建 `web.config`：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <rule name="SPA Routes" stopProcessing="true">
          <match url=".*" />
          <conditions logicalGrouping="MatchAll">
            <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
            <add input="{REQUEST_FILENAME}" matchType="IsDirectory" negate="true" />
          </conditions>
          <action type="Rewrite" url="/index.html" />
        </rule>
      </rules>
    </rewrite>
  </system.webServer>
</configuration>
```

### 步骤 7：配置防火墙

```powershell
# 允许后端端口
New-NetFirewallRule -DisplayName "TermMax Backend" -Direction Inbound -Port 3001 -Protocol TCP -Action Allow

# 允许 HTTP
New-NetFirewallRule -DisplayName "HTTP" -Direction Inbound -Port 80 -Protocol TCP -Action Allow
```

---

## 验证部署

### 1. 检查后端运行

```bash
# Linux
curl http://localhost:3001/api/health

# Windows PowerShell
Invoke-WebRequest http://localhost:3001/api/health
```

应返回：`{"status":"ok","timestamp":...}`

### 2. 检查前端

浏览器访问：
- 开发模式：`http://localhost:3000`
- 生产模式：`http://your-server-ip` 或 `http://your-domain.com`

### 3. 测试 Telegram 机器人

向你的机器人发送 `/start`，应收到欢迎消息和 Chat ID。

---

## 常见问题

### Q: Telegram 机器人没有响应？
A: 检查以下几点：
1. `.env` 中的 `TELEGRAM_BOT_TOKEN` 是否正确
2. 后端服务是否正常运行
3. 服务器是否能访问 Telegram API（可能需要代理）

### Q: 前端连不上后端？
A: 
1. 检查后端是否运行在 3001 端口
2. 检查防火墙是否开放端口
3. 如果跨域访问，检查 CORS 配置

### Q: 监控数据不更新？
A:
1. 检查 `MONITOR_INTERVAL` 配置
2. 查看后端日志是否有报错
3. 确认能访问 TermMax API

### Q: 新池上线没有收到通知？
A:
1. 确认 Telegram 配置正确
2. 检查 `data/known_pools.json` 是否正常写入
3. 首次运行会记录当前所有池子，之后才会检测新池

---

## API 接口文档

### 健康检查
```
GET /api/health
```

### 获取所有数据
```
GET /api/data
```

### 获取池列表
```
GET /api/pools
```

### 监控列表管理
```
GET    /api/watchlist           # 获取所有监控
POST   /api/watchlist           # 添加监控
PATCH  /api/watchlist/:poolId   # 更新监控
DELETE /api/watchlist/:poolId   # 删除监控
```

### 计算收益
```
POST /api/calculate-return
Body: { "poolId": "...", "investedAmount": 1000 }
```

---

## License

MIT License
