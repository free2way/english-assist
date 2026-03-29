# Vercel + Turso 部署指南

这份文档面向当前项目的实际上线流程，目标是把本地可运行的 `English Learning AI Assistant` 部署到 Vercel，并把数据库切到 Turso。

## 1. 部署前确认

本项目已经具备以下结构：

- 前端：Vite + React
- 后端：Express
- API 入口：`api/[...path].ts`
- 数据库：`@libsql/client`
- 本地模式：`file:data/app.db`
- 云端模式：`Turso`

上线到 Vercel 时，不再使用本地 `data/app.db`，而是通过环境变量连接 Turso。

## 2. 创建 Turso 数据库

先在本地安装并登录 Turso CLI：

```bash
brew install tursodatabase/tap/turso
turso auth login
```

创建数据库：

```bash
turso db create english-learning-ai-assistant
```

获取数据库 URL：

```bash
turso db show english-learning-ai-assistant
```

创建访问令牌：

```bash
turso db tokens create english-learning-ai-assistant
```

你最终会得到两项关键配置：

- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`

## 3. 本地切换到 Turso 验证

先把 `.env.local` 改成：

```env
PORT=3001
TURSO_DATABASE_URL=libsql://your-database-name-your-org.turso.io
TURSO_AUTH_TOKEN=your_turso_auth_token
```

然后执行：

```bash
npm run db:check
```

如果输出里看到：

```text
Driver: turso-remote
```

说明本地已经切到 Turso。

## 4. 初始化线上数据库

当前项目的表结构会在服务启动时自动初始化，因此不需要单独跑 migration。

如果你要导入教材样板，可以在本地连接 Turso 后执行：

```bash
npm run db:import-samples
```

这一步会把当前仓库里的教材样板写入 Turso。

## 5. 部署到 Vercel

在 Vercel 中导入这个 GitHub 仓库后，建议配置：

- Framework Preset: `Vite`
- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: `npm install`

环境变量中至少要加：

- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`

可选：

- `PORT=3001`

说明：

- `api/[...path].ts` 会作为 Vercel Serverless Function 提供后端能力
- `vercel.json` 已经处理好了 `/api/*` 与前端 SPA 路由的分流

## 6. 部署后验证

部署完成后先访问：

```text
https://your-domain.vercel.app/api/health
```

期望返回：

```json
{
  "ok": true,
  "driver": "turso-libsql"
}
```

然后验证：

1. 登录页能正常打开
2. `admin / admin1234` 能正常登录
3. 教材列表能正常加载
4. 管理页能正常新增用户
5. 教材导入接口可用

## 7. 推荐上线顺序

建议按这个顺序走：

1. 本地先接 Turso 并验证 `db:check`
2. 本地执行 `npm run db:import-samples`
3. 把代码推到 GitHub
4. 在 Vercel 配置环境变量并部署
5. 部署完成后验证 `/api/health`
6. 再用真实浏览器从手机 / iPad / PC 访问一遍

## 8. 当前已知边界

这套方案已经适合小规模教学场景，但有几个现实边界要知道：

- 当前还是单后端服务，不是多服务拆分架构
- 教材导入仍以项目内样板和后台导入为主，不是完整 CMS
- Turso 解决了 Vercel 无本地磁盘数据库的问题，但不等于自动具备复杂权限系统

如果后续用户量继续增长，下一步建议考虑：

- 增加数据库 migration 管理
- 增加教材导入后台的审核状态
- 把学习记录从浏览器本地迁到服务端
