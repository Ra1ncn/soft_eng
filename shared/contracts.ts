import { z } from "zod";

export const DemoRole = z.enum(["TEACHER", "STUDENT"]);
export type DemoRole = z.infer<typeof DemoRole>;
export const QuestionType = z.enum(["SINGLE_CHOICE", "MULTIPLE_SELECT"]);
export type QuestionType = z.infer<typeof QuestionType>;

const NonEmptyString = z.string().trim().min(1, "不能为空");
const CreateQuestion = z.object({
  prompt: NonEmptyString,
  type: QuestionType,
  options: z.array(z.object({ text: NonEmptyString, isCorrect: z.boolean() })).min(2, "至少需要两个选项"),
}).refine((q) => {
  const count = q.options.filter((option) => option.isCorrect).length;
  return q.type === "SINGLE_CHOICE" ? count === 1 : count >= 1;
}, { message: "正确选项数量不符合题型要求", path: ["options"] });

export const CreateQuizRequest = z.object({
  title: NonEmptyString,
  questions: z.array(CreateQuestion).min(1, "至少需要一道题"),
});
export type CreateQuizRequest = z.infer<typeof CreateQuizRequest>;

export const SubmitRequest = z.object({
  answers: z.array(z.object({
    questionId: NonEmptyString,
    optionIds: z.array(NonEmptyString),
  })),
}).superRefine(({ answers }, ctx) => {
  const questions = new Set<string>();
  answers.forEach((answer, index) => {
    if (questions.has(answer.questionId)) {
      ctx.addIssue({ code: "custom", path: ["answers", index, "questionId"], message: "题目不能重复" });
    }
    questions.add(answer.questionId);
    const options = new Set<string>();
    answer.optionIds.forEach((id, optionIndex) => {
      if (options.has(id)) {
        ctx.addIssue({ code: "custom", path: ["answers", index, "optionIds", optionIndex], message: "选项不能重复" });
      }
      options.add(id);
    });
  });
});
export type SubmitRequest = z.infer<typeof SubmitRequest>;

// 归属关系和单选最多选一个需要数据库题型，交由 D 在事务写入前验证。
const Id = z.string().min(1);
const Timestamp = z.iso.datetime();
export const CreateQuizResponse = z.object({ id: Id, title: z.string(), createdAt: Timestamp });
export type CreateQuizResponse = z.infer<typeof CreateQuizResponse>;
export const QuizListResponse = z.object({ quizzes: z.array(z.object({
  id: Id, title: z.string(), questionCount: z.number().int().nonnegative(), submittedAt: Timestamp.nullable(),
})) });
export type QuizListResponse = z.infer<typeof QuizListResponse>;
export const QuizDetailResponse = z.object({
  id: Id, title: z.string(), submittedAt: Timestamp.nullable(),
  questions: z.array(z.object({
    id: Id, prompt: z.string(), type: QuestionType,
    // strict 拒绝意外暴露 isCorrect；C 仍必须在 Prisma 查询中显式 select。
    options: z.array(z.strictObject({ id: Id, text: z.string() })),
  })),
});
export type QuizDetailResponse = z.infer<typeof QuizDetailResponse>;
export const SubmitResponse = z.object({ submissionId: Id, submittedAt: Timestamp });
export type SubmitResponse = z.infer<typeof SubmitResponse>;
export const HealthResponse = z.object({ status: z.literal("ok"), database: z.literal("ok"), demoQuizFound: z.boolean() });
export type HealthResponse = z.infer<typeof HealthResponse>;

export const ErrorCode = z.enum(["VALIDATION_ERROR", "FORBIDDEN", "NOT_FOUND", "INTERNAL_ERROR"]);
export type ErrorCode = z.infer<typeof ErrorCode>;
export const ApiErrorResponse = z.object({ error: z.object({
  code: ErrorCode, message: z.string(), fields: z.record(z.string(), z.string()).optional(),
}) });
export type ApiErrorResponse = z.infer<typeof ApiErrorResponse>;
