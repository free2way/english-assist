
# English Learning AI Assistant

这是一个面向初高中英语听口练习的教材同步学习应用，前端使用 Vite + React，后端使用 Express，数据库层已经切换到 Turso/libSQL 架构。

## Local Development

**Prerequisites:** Node.js

1. 安装依赖
   `npm install`
2. 复制环境变量模板
   `cp .env.example .env.local`
3. 本地开发如果不填写 `TURSO_DATABASE_URL`，后端会自动使用本地 `data/app.db`
4. 启动前端
   `npm run dev`
5. 启动后端
   `npm run server:dev`

## Turso / Vercel Deployment

部署到 Vercel 时，建议在项目环境变量中配置：

- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`
- `PORT` 可选，默认 `3001`
- Vercel Root Directory 保持当前项目根目录
- Build Command 使用 `npm run build`
- Output Directory 使用 `dist`

说明：

- 本地开发：默认走 `file:` 模式的 libSQL，本地数据库文件仍在 `data/app.db`
- 线上部署：只要配置 `TURSO_DATABASE_URL` 和 `TURSO_AUTH_TOKEN`，同一套代码会直接切到 Turso
- `/api/health` 会返回当前数据库驱动，便于确认是否已经切到 `turso-libsql`

## Vercel Structure

- `api/[...path].ts`
  复用同一套 Express 路由，供 Vercel Serverless Functions 使用
- `vercel.json`
  负责把 `/api/*` 保留给后端函数，并把其他路由回退到前端 SPA

## Database Scripts

- `npm run db:check`
  检查当前数据库是否可连接，并输出当前驱动模式
- `npm run db:import-samples`
  一键导入教材样板，适合初始化 Turso 数据库

## Deployment Guide

完整部署说明见：

- [docs/DEPLOY_VERCEL_TURSO.md](/Users/vincent/LAB/claudecode/learn-eng/english-assist/docs/DEPLOY_VERCEL_TURSO.md)
