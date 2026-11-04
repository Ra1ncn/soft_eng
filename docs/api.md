# 第一阶段 API 约定

本文件是 B、C、D 的接口标准，与 `shared/contracts.ts` 同步维护。
Implemented so far: `GET /api/health` and `POST /api/quizzes`. The other three business endpoints are not built yet and return the shared 404.

## 通用规则

- 路径以 `/api` 开头；请求/响应均为 JSON，请求体上限 1MB。
- ID 是非空字符串；日期序列化为 ISO 8601 UTC，例如 `2026-11-03T18:00:00.000Z`。
- `X-Demo-Role` 必须恰为 `TEACHER` 或 `STUDENT`，大小写敏感。头名不区分大小写。
- 缺失、空值、其他值、多个值合并后的非法值：403 `FORBIDDEN`。
- 合法身份但对应 seed 用户不存在或角色不匹配：500 `INTERNAL_ERROR`。
- 这是可伪造的演示身份。接入真实登录时必须删除演示身份函数及前端请求头，不满足真实身份认证要求。
- 四个业务接口先验证身份及角色；B/C/D 调用 `getCurrentUser(req)` 后自行限制角色。健康检查不要求身份。
- 标题、题干、选项文本及提交 ID 会 trim；Zod 普通对象会去除未声明字段，调用方不应发送这些字段。
- 题目和选项 `position` 从 0 开始，按创建请求数组顺序生成；读取按 `position` 升序。

| 方法与路径 | 负责人 | 允许身份 | 成功状态 | 共享响应 |
| --- | --- | --- | --- | --- |
| `GET /api/health` | A，已实现 | 无需身份 | 200 | `HealthResponse` |
| `POST /api/quizzes` | B, implemented | TEACHER | 201 | `CreateQuizResponse` |
| `GET /api/quizzes` | C | STUDENT（老师返回 403） | 200 | `QuizListResponse` |
| `GET /api/quizzes/:quizId` | C | STUDENT（老师返回 403） | 200 | `QuizDetailResponse` |
| `POST /api/quizzes/:quizId/submissions` | D | STUDENT（老师返回 403） | 首次 201，重复 200 | `SubmitResponse` |

## 统一错误

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "请求字段不合法",
    "fields": { "questions.0.options": "正确选项数量不符合题型要求" }
  }
}
```

| HTTP | code | 用途 |
| --- | --- | --- |
| 400 | VALIDATION_ERROR | Zod 字段校验、非法 JSON、超大请求体、业务校验 |
| 403 | FORBIDDEN | 身份头缺失/非法、角色不允许 |
| 404 | NOT_FOUND | 未知 API 路由或 quiz 不存在 |
| 500 | INTERNAL_ERROR | 数据库不可用、演示用户缺失、其他内部故障 |

`fields` 仅在字段校验失败时出现，键为点分路径，例如 `title`、`questions.0.options`、`answers.1.questionId`、`answers.0.optionIds.1`；同一路径保留第一条错误。根字段用 `body`。非法 JSON 无 `fields`。500 固定返回 `服务器内部错误`，不返回堆栈、SQL 或数据库连接信息。Express 5 异步 handler 抛错会进入统一中间件。

## GET /api/health

实际查询数据库（`SELECT 1` 和查找 `quiz-demo`），无需身份头：

```json
{ "status": "ok", "database": "ok", "demoQuizFound": true }
```

数据库可达但未 seed 时 `demoQuizFound` 为 false，仍返回 200；正常初始化后必须为 true。数据库连接或查询失败：500，使用统一错误格式。

## POST /api/quizzes

请求类型/校验器：`CreateQuizRequest`。

```json
{
  "title": "数据库小测",
  "questions": [{
    "prompt": "主键必须满足哪些条件？",
    "type": "MULTIPLE_SELECT",
    "options": [
      { "text": "值唯一", "isCorrect": true },
      { "text": "不能为 NULL", "isCorrect": true },
      { "text": "值可以重复", "isCorrect": false }
    ]
  }]
}
```

- title、prompt、text trim 后非空；至少 1 道题，每题至少 2 个选项。
- type 仅 `SINGLE_CHOICE`、`MULTIPLE_SELECT`。
- 单选正确选项恰为 1，多选正确选项至少为 1；`isCorrect` 必须为 boolean。
- `teacherId` 取当前演示老师，不能信任请求中的身份或 position。
- B 用共享校验器解析请求，按数组顺序持久化，不合法返回 400。

201 `CreateQuizResponse`：

```json
{ "id": "quiz1", "title": "数据库小测", "createdAt": "2026-11-03T18:00:00.000Z" }
```

## GET /api/quizzes

200 `QuizListResponse`：

```json
{ "quizzes": [{ "id": "quiz1", "title": "数据库小测", "questionCount": 2, "submittedAt": null }] }
```

无 quiz 返回 `{ "quizzes": [] }`。questionCount 为非负整数；submittedAt 是**当前学生**的提交时间，未提交为 null，已提交为 UTC 时间字符串。仅学生可访问，老师返回 403。

## GET /api/quizzes/:quizId

200 `QuizDetailResponse`：

```json
{
  "id": "quiz1",
  "title": "数据库小测",
  "submittedAt": null,
  "questions": [{
    "id": "q1", "prompt": "主键必须满足哪些条件？", "type": "MULTIPLE_SELECT",
    "options": [{ "id": "o1", "text": "值唯一" }, { "id": "o2", "text": "不能为 NULL" }]
  }]
}
```

仅学生可访问，老师返回 403。quiz 不存在返回 404。submittedAt 含义同列表。题目、选项按 position 升序。响应绝不能含 `isCorrect`；查询必须显式 `select` 字段，不能把整条 Prisma 记录返回。共享响应校验器拒绝选项多出的字段；仍须在数据库查询处避免取出答案。

## POST /api/quizzes/:quizId/submissions

请求类型/校验器：`SubmitRequest`。

```json
{ "answers": [{ "questionId": "q1", "optionIds": ["o1", "o3"] }] }
```

- answers 可为空数组：`{ "answers": [] }` 表示所有题未作答。
- 某题可不传，或传 `optionIds: []`；后端均需给 quiz 的每一道题存一行 SubmissionAnswer，空答案不关联选项。
- 同一请求重复 questionId、同题重复 optionIds：400。trim 后重复也拒绝。共享校验器已覆盖。
- D 从数据库确认：题目属于当前 quiz；每个选项属于对应题目；单选最多选 1 个选项。违反时 400，整个请求不落库。这些规则依赖数据库，不能只靠共享校验器验证。
- 仅学生可访问，老师返回 403；quiz 不存在返回 404。
- Submission 和全部 SubmissionAnswer 在一个事务内写入。
- 一个学生对同一 quiz 只允许一份提交，数据库 `@@unique([quizId, studentId])` 保证。已提交返回 200 原有记录，不覆盖答案。
- D 先验证请求格式及归属/题型规则，再处理重复提交；并发写入遇 `P2002` 时捕获**该提交唯一约束**冲突，查询并返回原有记录，其他错误交统一中间件，不能把所有 P2002 都当作成功。

首次 201；重复 200。两者都为 `SubmitResponse`：

```json
{ "submissionId": "s1", "submittedAt": "2026-11-03T18:05:00.000Z" }
```

## 固定 seed ID（mock / 测试共用）

| ID | 含义 |
| --- | --- |
| teacher-demo | TEACHER，示例 quiz 的老师 |
| student-demo | STUDENT |
| quiz-demo | 数据库基础小测 |
| quiz-demo-q1 | position 0，SINGLE_CHOICE |
| quiz-demo-q1-o1 | position 0，主键，正确 |
| quiz-demo-q1-o2 | position 1，普通索引，错误 |
| quiz-demo-q2 | position 1，MULTIPLE_SELECT |
| quiz-demo-q2-o1 | position 0，值唯一，正确 |
| quiz-demo-q2-o2 | position 1，不能为 NULL，正确 |
| quiz-demo-q2-o3 | position 2，值可以重复，错误 |

seed 使用固定 ID 的事务 upsert，不删除学生提交，也不创建重复数据。重跑会恢复示例记录的标题、题目、选项与演示身份字段；不要把演示 quiz 作为可随意修改的个人测试数据。

## 协作约定

接口变动在同一 PR 同步更新本文件、`shared/contracts.ts` 和受影响测试，并请相关负责人 review。migration 由 A 完成或 review；已合并的 migration 不修改，变更新增 migration。生成前先获取最新 main。
