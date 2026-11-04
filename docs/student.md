# C：学生列表与作答模块

C 负责学生页面及测验查询接口。本模块沿用公共主题、设计 tokens 和 UI 组件，并参考 B 的教师页面布局；没有修改共享契约、数据库 schema 或其他成员的业务实现。

## 当前可用范围

| 路径或功能 | 当前行为 |
| --- | --- |
| `/student` | 从真实数据库加载测验列表，显示题目数量和当前演示学生的提交时间；支持按标题搜索、清空搜索和刷新 |
| `/student/quizzes/:quizId` | 读取测验详情，按题目与选项的 `position` 顺序显示；支持单选和多选 |
| 答题进度 | 按已作答的题目数显示进度；题号导航可跳转并聚焦题目；可以清除某题选择 |
| 草稿 | 在当前标签页的 `sessionStorage` 中保存；重新打开或刷新时按最新题目、选项 ID 校验后恢复 |
| 提交确认 | 提示已答数量、未答数量和一次提交规则；取消后继续作答，不发送 POST |
| 已提交状态 | 以查询接口返回的 `submittedAt` 为准；清除旧草稿并显示提交时间，不再提供作答表单 |
| 提交结果 | 只有收到符合共享 `SubmitResponse` 的真实成功响应，才显示成功页面；失败保留答案并提示 |

读取接口已经实现：

- `GET /api/quizzes`：共享 `QuizListResponse`。
- `GET /api/quizzes/:quizId`：共享 `QuizDetailResponse`。

两个接口只允许 `STUDENT` 演示身份，教师访问返回 403；不存在的测验返回 404。数据库查询显式选择学生需要的字段，不读取或返回 `isCorrect`。列表和详情中的 `submittedAt` 都只取当前演示学生的记录。

身份沿用 A 的固定演示用户及 `X-Demo-Role`，尚未接入真实登录。当前不含评分、成绩分析、截止时间、发布状态、访问码或 AI。

## 启动与操作

先按根目录 [README](../README.md#环境与首次启动) 安装依赖、启动数据库、执行 migration 和 seed，再运行 `npm run dev`。标准配置保持前端 5173、后端 3001、数据库 5432；本模块不要求修改这些默认端口。

1. 打开 `/student`，确认能看到 seed 中的测验。
2. 搜索标题，或点击 **Open quiz** 进入详情。
3. 使用单选圆点或多选复选框填写答案；题号导航可快速定位题目。
4. 刷新页面，确认当前标签页中的草稿可以恢复。
5. 点击 **Submit answers**，检查确认框；**Keep reviewing** 或 Escape 取消，不提交数据。
6. 确认后客户端调用 D 的提交接口。当前 D 的路由为空，真实请求会返回 404，页面保留答案并提示提交服务尚未就绪。

未答题会以空 `optionIds` 发送，符合共享契约。草稿不是数据库提交记录，不用于推断提交成功，也不会伪造 `submittedAt`。本模块没有用 `localStorage` 或样例回退代替真实提交。

## 提交边界与恢复

请求通过公共 `apiFetch` 发送，使用 `STUDENT` 演示身份；客户端不发送学生 ID。提交格式保持为：

```json
{
  "answers": [
    { "questionId": "question-id", "optionIds": ["option-id"] },
    { "questionId": "unanswered-question-id", "optionIds": [] }
  ]
}
```

成功响应保持为共享 `SubmitResponse`：

```json
{
  "submissionId": "submission-id",
  "submittedAt": "2026-11-04T18:00:00.000Z"
}
```

- 提交期间禁用确认按钮，另有同步锁阻止重复点击。
- 所有学生请求都有 15 秒上限，覆盖响应体读取；离开详情页会取消该页面的请求。
- 超时或异常提交响应会提示“答案可能已经收到”，不会宣称成功；应先返回列表刷新，核对服务端的提交状态。
- 400、403、404、其他服务故障及空列表都有相应的英文提示；错误后保留当前答案。
- 恢复草稿时丢弃已不存在的题目和选项，去除重复选项，并限制单选题只保留一项。草稿只在本标签页保存，关闭标签页或清理浏览器会话数据后不保证保留。
- 原有 `submittedAt` 或经校验的提交回执会进入已提交页面；当前页面只显示提交确认信息，不提供答案回放或评分结果。

## B、D 交接

**B：** 创建接口与教师页面已通过 PR #4 合并进 main，C 分支已同步并保留其实现，包括 Data Router 和未保存内容的离开保护。C 按共享数据结构和 `position` 规则读取 B 创建的记录。

**D：** 实现 `POST /api/quizzes/:quizId/submissions`。现有客户端已使用 `optionIds`，并处理共享回执、失败、超时和重复点击；D 仍须按 [API 约定](api.md#post-apiquizzesquizidsubmissions) 完成身份与归属检查、事务写入、每题答案记录和重复提交返回原记录。前端锁和已提交页面不能代替这些服务端保证。

D 完成后，需要重新验证“真实 POST → 数据库记录 → 返回回执 → 成功页面 → 刷新后仍显示已提交”的完整闭环。当前成功响应只在客户端契约测试中使用 mock 验证，尚未完成真实提交持久化验收。

## 文件位置

| 文件 | 用途 |
| --- | --- |
| `client/src/pages/student/StudentPage.tsx` | 列表、搜索、提交状态 |
| `client/src/pages/student/StudentQuizPage.tsx` | 答题、草稿、确认框与提交结果 |
| `client/src/pages/student/StudentPage.module.css` | 复用主题 tokens 的页面布局与移动端样式 |
| `client/src/pages/student/quizAnswers.ts` | 单选／多选切换、草稿校验和提交格式 |
| `client/src/pages/student/studentApi.ts` | 共享响应校验、请求超时和错误提示 |
| `server/src/modules/quizzes/routes.ts` | C 的两个真实查询接口，保留 B 的创建接口位置 |

## 当前验证记录

- 独立 C 实现首次通过 94 项自动测试；同步最新 main 中的 B 功能并解决冲突后，当前分支 132 项测试、所有 workspace 的 TypeScript 检查和生产构建全部通过。
- 使用 PostgreSQL 18.6 完成 22 项真实 GET 集成检查，验证后清理了临时测试记录。
- 已在浏览器验证列表与搜索、两种题型、未答题提示、取消确认、刷新恢复草稿，以及 D 当前返回 404 时保留答案。
- 本次 Windows 验证使用临时隔离的 Node.js 26.13.0 和本地 `.env`：前端 5174、后端 3001、数据库 55432。仓库标准启动流程和 Docker 默认配置未改变。

- `npm run build` 成功；前端、后端和共享包类型检查通过。构建保留仓库现有 React Router 的非阻塞 `use client` 警告。
- 浏览器实测 1280×900、390×844 的列表与答题页，无横向溢出。正文使用 Figtree，标题使用 Source Serif 4；没有新增调色板或修改 B 的公共组件。
- Escape 取消确认后，焦点回到提交按钮；提交失败后焦点进入错误提示，已选单选和多选答案仍保留。

| 页面 | 桌面 | 手机 |
| --- | --- | --- |
| 学生列表 | [1280px](validation/student-c/list-1280.jpg) | [390px](validation/student-c/list-390.jpg) |
| 学生作答 | [1280px](validation/student-c/answer-1280.jpg) | [390px](validation/student-c/answer-390.jpg) |

首先在独立副本中组合 B 的 `feat/create-quiz` 与 C 的实现：保留 B 的创建路由和 Data Router，补入 C 的读取路由与学生详情页，132 项测试、workspace 类型检查和生产构建均通过。浏览器实际完成“B 老师页创建并保存 → C 列表显示新记录 → 打开新题目并选择答案”。[教师页面](validation/student-c/b-teacher-comparison.jpg)、[学生打开新建测验](validation/student-c/b-to-c-created-quiz.jpg)。随后发现 B 已由组员合并进 main，因此在 C 分支同步最新 main，并保留已验证的组合逻辑；没有修改远程 main 或 B 分支，也没有实现 D 的提交保存。

## Report 可准确描述的进展

可以写：C 已实现读取真实数据库的测验列表、详情与学生作答界面，支持单选／多选、草稿恢复、提交确认、错误处理及共享回执成功状态，并通过上述查询和客户端验证。

需要保留的限制：真实登录未接入；D 的提交持久化尚未实现；当前已验证教师创建到学生读取和作答，但不能声称已经完成学生答案入库的完整流程，也没有评分或 AI 功能。
