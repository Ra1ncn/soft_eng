# 测验平台第一阶段：A 的任务说明

本文写给负责“平台基础和数据库”的同学（A）。技术选型沿用项目提案。

> 状态：起草稿。文中的表结构和代码尚未实际运行，建好后需要跑一遍迁移和类型检查。

## 1. 背景和目标

本阶段要跑通的流程：

**打开平台 → 老师创建并保存 quiz → 学生打开 quiz → 填写答案 → 点击提交 → 数据库保存答案，页面显示提交成功**

| 角色 | 负责内容 |
|---|---|
| A | 平台基础、数据库、接口约定 |
| B | 老师创建 quiz 的页面和接口 |
| C | 学生查看、填写 quiz 的页面和读取接口 |
| D | 提交保存接口、“提交成功”状态、workflow |

A 的目标是**让 B、C、D 能在同一个项目上并行开发**。

**A 的交付物：**

- 可启动的项目骨架
- 数据库表结构、migration 和 seed 数据
- 接口约定 `docs/api.md`
- 共享类型 `shared/contracts.ts`
- 固定身份 `getCurrentUser(req)`
- 教师端和学生端入口
- 启动说明 `README.md`

## 2. 第一步：搭好项目

1. **建仓库：** 在 GitHub 创建仓库，邀请组员，保护 `main` 分支。
2. **添加基础文件：** `.gitignore`（忽略 `.env` 和 `node_modules`）和 `.env.example`。
3. **统一包管理器：** 用 npm workspaces 管理前后端和共享代码，并提交 lockfile。
4. **搭前端：** Vite + React + TypeScript，配置路由。
5. **搭后端：** Express + TypeScript，提供 `GET /api/health`。
6. **接数据库：** 用 Docker Compose 启动 PostgreSQL，并初始化 Prisma。
7. **做入口：** 做一个简单首页，能进入教师端和学生端，具体页面由 B、C 填充。

建议的目录结构，每个人有自己的位置，可以减少合并冲突：

```text
client/src/pages/teacher/        ← B
client/src/pages/student/        ← C
server/src/modules/quizzes/      ← B（创建）、C（读取）
server/src/modules/submissions/  ← D
shared/                          ← 共享类型，A 维护
docs/api.md                      ← 接口约定，A 维护
```

## 3. 第二步：设计数据库

### 3.1 表之间的关系

```text
User(老师) 1─N Quiz 1─N Question 1─N Option
User(学生) 1─N Submission N─1 Quiz
Submission 1─N SubmissionAnswer N─1 Question
SubmissionAnswer N─N Option（这道题选了哪些选项）
```

| 表 | 作用 |
|---|---|
| `User` | 老师和学生 |
| `Quiz` | 一份测验 |
| `Question` | 测验中的一道题 |
| `Option` | 题目的一个选项，包含是否正确 |
| `Submission` | 一名学生对一份测验的一次提交 |
| `SubmissionAnswer` | 一次提交中一道题的作答 |

### 3.2 Prisma 模型

以下只列模型，`generator` 和 `datasource` 保留 `prisma init` 生成的内容。

```prisma
enum Role {
  TEACHER
  STUDENT
}

enum QuestionType {
  SINGLE_CHOICE
  MULTIPLE_SELECT
}

model User {
  id          String       @id @default(cuid())
  name        String
  email       String       @unique
  role        Role
  createdAt   DateTime     @default(now())
  quizzes     Quiz[]
  submissions Submission[]
}

model Quiz {
  id          String       @id @default(cuid())
  title       String
  teacherId   String
  teacher     User         @relation(fields: [teacherId], references: [id])
  createdAt   DateTime     @default(now())
  questions   Question[]
  submissions Submission[]
}

model Question {
  id       String             @id @default(cuid())
  quizId   String
  quiz     Quiz               @relation(fields: [quizId], references: [id], onDelete: Cascade)
  position Int
  prompt   String
  type     QuestionType
  options  Option[]
  answers  SubmissionAnswer[]

  @@unique([quizId, position])
}

model Option {
  id         String             @id @default(cuid())
  questionId String
  question   Question           @relation(fields: [questionId], references: [id], onDelete: Cascade)
  position   Int
  text       String
  isCorrect  Boolean            @default(false)
  selectedIn SubmissionAnswer[]

  @@unique([questionId, position])
}

model Submission {
  id          String             @id @default(cuid())
  quizId      String
  quiz        Quiz               @relation(fields: [quizId], references: [id])
  studentId   String
  student     User               @relation(fields: [studentId], references: [id])
  submittedAt DateTime           @default(now())
  answers     SubmissionAnswer[]

  @@unique([quizId, studentId])
}

model SubmissionAnswer {
  id              String     @id @default(cuid())
  submissionId    String
  submission      Submission @relation(fields: [submissionId], references: [id], onDelete: Cascade)
  questionId      String
  question        Question   @relation(fields: [questionId], references: [id])
  selectedOptions Option[]

  @@unique([submissionId, questionId])
}
```

### 3.3 关键设计

- **`SubmissionAnswer` 每题一行：** 没答的题也存一行，只是选项为空。以后的单题得分和 AI 讲解都能直接挂在这一行上。
- **`selectedOptions` 是多对多关系：** Prisma 会自动生成中间表，单选和多选可以用同一种结构。
- **`@@unique([quizId, studentId])`：** 由数据库保证每名学生对同一 quiz 只有一份提交，并发请求也不会重复。
- **`position`：** 保证题目和选项的显示顺序稳定。
- **`isCorrect`：** 本阶段不评分，但现在就保存正确答案，后续加入评分时不必返工。
- **已有提交的 quiz 删不掉：** `Submission` 到 `Quiz` 的关系没有设置级联删除，Prisma 默认会阻止删除。

### 3.4 本阶段先不加的内容

以下内容等到做相应功能时，再用新的 migration 添加：

- 截止时间、发布状态、访问码
- 分数、迟交状态
- 密码哈希、登录 session
- `QuizParticipation`、`AIExplanation`

### 3.5 数据库管不到的规则

下面这些要在代码里校验：

- 单选题恰好有 1 个正确选项，多选题至少有 1 个。
- 单选题最多只能选 1 个选项。
- 提交的选项必须属于对应的题目，题目必须属于这个 quiz。

### 3.6 迁移规则

- 表结构改动统一由 A 完成或 review。
- 已合并的 migration 不能修改，需要变更就新建一个。
- 生成 migration 前先拉取最新的 `main`。

## 4. 第三步：写接口约定

把本节内容写到 `docs/api.md`，合并后它就是唯一标准。

### 4.1 通用规则

- 路径都以 `/api` 开头，数据格式为 JSON。
- 时间使用 ISO 8601 UTC，例如 `2026-11-03T18:00:00.000Z`。
- ID 都是字符串。
- 题型只能取 `SINGLE_CHOICE` 或 `MULTIPLE_SELECT`。
- 错误统一返回以下格式，`fields` 只在字段校验失败时出现：

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "可读的说明",
    "fields": { "title": "标题不能为空" }
  }
}
```

| 状态码 | `code` | 含义 |
|---|---|---|
| 400 | `VALIDATION_ERROR` | 请求内容不合法 |
| 403 | `FORBIDDEN` | 身份没有权限 |
| 404 | `NOT_FOUND` | 资源不存在 |
| 500 | `INTERNAL_ERROR` | 服务器内部错误 |

### 4.2 接口总览

| 接口 | 负责人 | 身份 | 用途 |
|---|---|---|---|
| `POST /api/quizzes` | B | 老师 | 创建 quiz |
| `GET /api/quizzes` | C | 学生 | quiz 列表 |
| `GET /api/quizzes/:quizId` | C | 学生 | 作答页，不含答案 |
| `POST /api/quizzes/:quizId/submissions` | D | 学生 | 提交答案 |

### 4.3 创建 quiz：`POST /api/quizzes`

请求：

```json
{
  "title": "数据库小测",
  "questions": [
    {
      "prompt": "主键必须满足哪些条件？",
      "type": "MULTIPLE_SELECT",
      "options": [
        { "text": "值唯一", "isCorrect": true },
        { "text": "不能为 NULL", "isCorrect": true },
        { "text": "值可以重复", "isCorrect": false }
      ]
    }
  ]
}
```

成功（201）：

```json
{
  "id": "quiz1",
  "title": "数据库小测",
  "createdAt": "2026-11-03T18:00:00.000Z"
}
```

规则：

- `position` 由后端按数组顺序生成，从 0 开始。
- 标题不能为空，至少有 1 道题。
- 每题题干不能为空，至少有 2 个非空选项。
- 正确选项数量要符合 3.5 的规则。
- 校验失败返回 400；非老师身份返回 403。

### 4.4 quiz 列表：`GET /api/quizzes`

成功（200），没有 quiz 时返回空数组：

```json
{
  "quizzes": [
    {
      "id": "quiz1",
      "title": "数据库小测",
      "questionCount": 2,
      "submittedAt": null
    }
  ]
}
```

`submittedAt` 指当前学生的提交时间，未提交时为 `null`。

### 4.5 读取 quiz：`GET /api/quizzes/:quizId`

成功（200）：

```json
{
  "id": "quiz1",
  "title": "数据库小测",
  "submittedAt": null,
  "questions": [
    {
      "id": "q1",
      "prompt": "主键必须满足哪些条件？",
      "type": "MULTIPLE_SELECT",
      "options": [
        { "id": "o1", "text": "值唯一" },
        { "id": "o2", "text": "不能为 NULL" },
        { "id": "o3", "text": "值可以重复" }
      ]
    }
  ]
}
```

规则：

- **响应中绝不能包含 `isCorrect`。** 查询时要用 `select` 明确列出字段，不能直接返回整条记录。
- 题目和选项都按 `position` 排序。
- quiz 不存在时返回 404。

### 4.6 提交答案：`POST /api/quizzes/:quizId/submissions`

请求：

```json
{
  "answers": [
    { "questionId": "q1", "optionIds": ["o1", "o3"] }
  ]
}
```

首次提交返回 201；已提交过返回 200 和原有记录：

```json
{
  "submissionId": "s1",
  "submittedAt": "2026-11-03T18:05:00.000Z"
}
```

规则：

- **未作答：** 这道题可以不传，或传空数组。后端都要为它存一行空答案。
- **校验失败（400）：** 题目重复、题目或选项不属于该 quiz、单选题选了多个，都返回 400，且不保存任何内容。
- **quiz 不存在：** 返回 404。
- **事务：** `Submission` 和所有 `SubmissionAnswer` 要在同一个事务里写入。
- **重复提交：** 捕获唯一约束错误（Prisma 的 `P2002`），然后查出并返回原有记录，不覆盖答案。

## 5. 第四步：写共享类型

在 `shared/contracts.ts` 里用 Zod 定义，后端用它校验请求，前端用它的类型：

```ts
import { z } from "zod";

export const QuestionType = z.enum(["SINGLE_CHOICE", "MULTIPLE_SELECT"]);

const CreateQuestion = z
  .object({
    prompt: z.string().trim().min(1),
    type: QuestionType,
    options: z
      .array(z.object({ text: z.string().trim().min(1), isCorrect: z.boolean() }))
      .min(2),
  })
  .refine(
    (q) => {
      const correct = q.options.filter((o) => o.isCorrect).length;
      return q.type === "SINGLE_CHOICE" ? correct === 1 : correct >= 1;
    },
    { message: "正确选项数量不符合题型要求", path: ["options"] },
  );

export const CreateQuizRequest = z.object({
  title: z.string().trim().min(1),
  questions: z.array(CreateQuestion).min(1),
});

export const SubmitRequest = z.object({
  answers: z.array(
    z.object({ questionId: z.string(), optionIds: z.array(z.string()) }),
  ),
});

export type CreateQuizRequest = z.infer<typeof CreateQuizRequest>;
export type SubmitRequest = z.infer<typeof SubmitRequest>;
```

四个接口的返回类型也按同样方式写在这个文件里。

## 6. 第五步：准备 seed 数据和固定身份

### 6.1 seed 数据

使用固定 ID，方便 C 写 mock、D 写测试：

| 数据 | ID | 说明 |
|---|---|---|
| 老师 | `teacher-demo` | `role` 为 `TEACHER` |
| 学生 | `student-demo` | `role` 为 `STUDENT` |
| 示例 quiz | `quiz-demo` | 属于 `teacher-demo`，包含一道单选题和一道多选题 |

seed 用 `upsert` 编写，多次运行也不会报错。

### 6.2 固定身份

本阶段还没有登录功能，后端用统一函数获取当前用户：

- `getCurrentUser(req)` 读取请求头 `X-Demo-Role: TEACHER | STUDENT`，返回对应的 seed 用户。
- 教师端和学生端页面各自带上这个请求头。
- B、C、D 都通过这个函数获取身份，以后接入真实登录时只改这一处。

> **安全提醒：** 这个请求头可以随意伪造，只能用于当前演示。接入真实登录时必须删除，否则不满足提案 FR-01。

## 7. 第六步：确认并交付

### 7.1 提 PR 给组员确认

PR 内容包括表结构、`docs/api.md`、`shared/contracts.ts`、seed 和 README。每人只检查自己要用的部分：

- **B：** 创建请求和校验规则够不够用。
- **C：** 列表页和作答页需要的字段是否都有。
- **D：** 提交格式、重复提交和事务规则是否可行。

### 7.2 验收

README 写清依赖安装、`.env` 配置和启动步骤，然后找一位组员从零跑一遍：

```bash
docker compose up -d
npx prisma migrate dev
npx prisma db seed
npm run dev
```

全部满足才算完成：

- [ ] 组员按 README 操作，能启动前后端。
- [ ] 能打开首页，并进入教师端和学生端。
- [ ] 通过 `npx prisma studio` 能看到 `quiz-demo`。
- [ ] 后端能从数据库读到示例 quiz。
- [ ] 表结构、接口约定和共享类型已合并到 `main`。

## 8. 合并后的工作

- **审核修改：** 改接口要在同一个 PR 里同时更新 `docs/api.md` 和 `shared/contracts.ts`，并让受影响的人 review。
- **及时响应：** 约定一个时限，比如一天内回复；A 没空时，由 D 作为第二审核人。
- **支持组员：** 帮大家解决环境问题，并支持后期联调。
