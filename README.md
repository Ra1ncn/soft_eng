# AI 辅助测验平台 · 第一阶段 A

React / TypeScript / Vite + Express / Zod + PostgreSQL / Prisma，使用 npm workspaces。A 提供平台基础、数据库和接口契约，方便 B、C、D 在同一仓库并行开发。

Implemented so far: the database health check, the home and student placeholder pages, and quiz creation (the `/teacher` page and `POST /api/quizzes`). The list, detail, and submission endpoints are still empty and return the shared 404; see [docs/api.md](docs/api.md). There is no login, grading, deadline, publication state, access code, or AI feature yet.

## 环境与首次启动

需要 Git、Node.js **26.13.0 LTS**（`.nvmrc`）、随 Node 的 npm，以及已运行的 Docker Engine 和 Docker Compose。macOS 可用 Docker Desktop，或自行安装 Colima；本次实际验证使用 Colima 独立 profile。先确认 `node -v`、`npm -v`、`docker info`、`docker compose version` 成功。

```bash
git clone https://github.com/Ra1ncn/soft_eng.git
cd soft_eng
# 基础和主题合并后，组员统一从 main 开始。
git switch main
nvm install
nvm use
npm ci
cp .env.example .env
docker compose up -d
npx prisma migrate dev
npx prisma db seed
npm run dev
```

`nvm` 是可选的 Node 版本管理器，未安装时自行安装匹配版本的 Node。依赖安装与复制 `.env` 后，所有 Prisma 命令都从**根目录**运行；无需进入 server。首次等待数据库就绪，可运行 `docker compose ps`（db 为 healthy）或 `docker compose up -d --wait`。迁移失败应先确认 Docker 和端口，不要删除数据卷。

- 首页：<http://localhost:5173/>；教师入口：<http://localhost:5173/teacher>；学生入口：<http://localhost:5173/student>。
- 后端：<http://localhost:3001/api/health>。Vite 把 `/api` 代理到后端；无需跨域配置。
- `npm run dev` 同时运行前后端，Ctrl+C 停止两者。
- 默认前端 5173、后端 3001、数据库 5432，均通过根目录 `.env` 配置。
- 修改 POSTGRES_PORT 时，DATABASE_URL 中端口也需同步；修改 SERVER_PORT 时，VITE_API_TARGET 也需同步。数据库用户名、密码、库名同理。
- `.env.example` 仅含本地演示值，实际 `.env` 被忽略，不提交实际密码或密钥。容器仅绑定本机回环地址。

```bash
curl http://localhost:3001/api/health
# {"status":"ok","database":"ok","demoQuizFound":true}
npm run typecheck
npm test
npm run build
npx prisma studio --port 5555
```

Prisma Studio 打开其终端给出的地址，选择 `Quiz` 表并筛选 `id = quiz-demo`。数据库不可用时健康检查返回统一 500；未 seed 时 demoQuizFound 为 false。

## 目录与公共基础

```text
client/src/pages/teacher/           B：教师页面占位
client/src/pages/student/           C：学生页面占位；D：提交成功状态
client/src/lib/apiFetch.ts          演示身份请求封装
server/src/modules/quizzes/         B：创建接口；C：列表和详情（空路由）
server/src/modules/submissions/     D：提交接口（空路由，mergeParams 已启用）
server/src/auth/getCurrentUser.ts   从 X-Demo-Role 获取 seed 用户
server/src/lib/prisma.ts            Prisma Client 单例
server/src/lib/errors.ts            AppError 和统一错误中间件
server/prisma/                     schema、migration、seed
shared/contracts.ts                @quiz/shared：Zod 请求与响应、推导类型
docs/api.md                        接口唯一标准，改动须同步共享契约
prisma.config.ts                   根目录 Prisma 路径与 seed 配置
```

`@quiz/shared` 直接导出 TypeScript 源码，本地由 Vite/tsx 处理，无需单独构建共享包。Prisma 7 用 `prisma-client` 生成器及 PostgreSQL adapter，客户端生成至忽略的 `server/src/generated/prisma/`，不要提交生成代码。Prisma 7 的 `migrate dev` 不自动生成客户端，因此 seed 命令先执行 `prisma generate`；`npm run typecheck`、`npm test`、`npm run dev` 也会先生成客户端。

后端在 Express 5 异步路由中调用 `getCurrentUser(req)`，检查 user.role，不允许的角色抛出 `new AppError("FORBIDDEN", "身份没有权限")`。再使用 `CreateQuizRequest.parse(req.body)` 或 `SubmitRequest.parse(req.body)`；Zod 错误会转为 400，fields 使用点分路径。数据库错误只向客户端返回通用 500。500 的原始错误只写入服务端日志，不返回客户端；400、403、404 不写入错误日志。

前端示例（供 B/C/D 接入业务页面，不代表接口已实现）：

```ts
import type { QuizListResponse } from "@quiz/shared";
import { apiFetch } from "../../lib/apiFetch";
const result = await apiFetch<QuizListResponse>("/api/quizzes", "STUDENT");
// 创建请求：options = { method: "POST", body: JSON.stringify(body) }
```

`apiFetch` 自动设置 X-Demo-Role 和带 body 的 JSON Content-Type，只能请求本项目 `/api/` 路径。响应处理规则：

- 先读取响应文本；2xx 空响应（包括 204）返回 `undefined`，合法 JSON 返回解析后的数据。
- 2xx 非合法 JSON 抛 `ApiFetchError`，保留真实 HTTP status，使用通用 `INTERNAL_ERROR` 说明。
- 非 2xx 且符合共享 `ApiErrorResponse` 时，抛 `ApiFetchError` 并保留后端 code、message、fields 和真实 status。
- 其他非 2xx（空响应、HTML、纯文本或不符合契约的 JSON）也抛 `ApiFetchError`，保留真实 status，code 为 `INTERNAL_ERROR`，message 为通用说明，不透传原始响应内容。
- `fetch` 本身的网络失败原样抛出，本封装不转换。

**演示身份可以被任意伪造。接入真实登录时必须删除此身份实现及前端演示请求头。** 本阶段没有 session，不符合真实登录要求。

## 数据库与 seed

保留附件六个模型及约束，Prisma 自动生成选项与作答的多对多中间表。每学生每 quiz 一份 Submission，每题一行 SubmissionAnswer；空答案行由 D 的提交事务创建。已有提交的 quiz 不能直接删除。题目归属、选项归属、单选最多选一项由 D 验证，数据库约束不能代替这些检查。

```bash
npx prisma migrate dev
npx prisma db seed
npx prisma db seed
```

seed 是事务 upsert，固定 2 个用户、1 个 quiz、2 道题、5 个选项；不清空其他数据或学生提交。所有固定 ID 与正确答案见 [docs/api.md](docs/api.md#固定-seed-idmock--测试共用)。重复运行恢复演示内容，不要用 seed quiz 做手动编辑测试。

schema 变更统一请 A 完成或 review。拉取最新 main 后再生成新 migration；已合并的 migration 不修改。默认 `docker compose down` 保留数据库卷；不要运行带删除数据卷选项的命令，除非确认要丢弃本地数据。

## B、C、D 接手

- **B**：在 `client/src/pages/teacher/` 完成创建页；在 quizzes 路由添加 POST `/`。使用 TEACHER、共享请求校验，服务端按数组生成 position，并保存正确答案。
- **C**：在 `client/src/pages/student/` 完成列表和作答页；在 quizzes 路由添加 GET `/`、GET `/:quizId`。只允许 STUDENT；显式 select 不含 isCorrect，按 position 排序。
- **D**：在 submissions 路由添加 POST `/`，`req.params.quizId` 来自 mergeParams。只允许 STUDENT；验证归属、重复和单选限制，在事务中存所有题的答案（含未答），处理提交唯一约束并返回原有记录；接入提交成功状态。

三位各自从最新 main 创建功能分支，不在共享工作分支同时提交。C 可先用 docs 中的固定 ID 写 mock，D 可基于 seed 测试事务。共享契约或 schema 修改请与 A 对齐。另需组长邀请余下成员、设置 main 保护、分配 PR review，并让至少一位组员从零实际启动；这些人工验收尚不能由 A 代替。

## 实际验证与附件修正

完整命令、实际结果、版本、局限及附件修正见 [docs/validation.md](docs/validation.md)。附件原稿备份位于 [docs/reference/A_Task_Guide_ZH.md](docs/reference/A_Task_Guide_ZH.md)，它是未运行草稿；冲突时以本次用户要求及最终接口契约为准。

## 前端视觉系统

统一主题、组件接口、B/C 使用示例和实际验证见 [docs/ui-theme.md](docs/ui-theme.md)。运行前端后访问 `/ui-preview` 查看所有组件、表单及状态。界面默认使用英文，字体通过 Fontsource 自托管。
