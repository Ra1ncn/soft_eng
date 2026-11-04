import express from "express";
import request from "supertest";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CreateQuizRequest } from "@quiz/shared";
import { AppError, errorHandler } from "./lib/errors.ts";
const mocks = vi.hoisted(() => ({ query: vi.fn(), findQuiz: vi.fn() }));
vi.mock("./lib/prisma.ts", () => ({ prisma: { $queryRaw: mocks.query, quiz: { findUnique: mocks.findQuiz } } }));
import { app } from "./app.ts";
beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.query.mockResolvedValue([{}]);
  mocks.findQuiz.mockResolvedValue({ id: "quiz-demo" });
});
afterEach(() => vi.restoreAllMocks());
it("health 无身份头也查询数据库", async () => {
  const response = await request(app).get("/api/health");
  expect(response.status).toBe(200);
  expect(response.body).toEqual({ status: "ok", database: "ok", demoQuizFound: true });
  expect(mocks.query).toHaveBeenCalledOnce();
});
it("数据库故障只返回通用 500", async () => {
  const originalError = new Error("secret database connection details");
  mocks.query.mockRejectedValue(originalError);
  const response = await request(app).get("/api/health");
  expect(response.status).toBe(500);
  expect(response.body).toEqual({ error: { code: "INTERNAL_ERROR", message: "服务器内部错误" } });
  expect(console.error).toHaveBeenCalledTimes(1);
  expect(vi.mocked(console.error).mock.calls[0]?.[0]).toBe(originalError);
});
it("未 seed 时健康检查明确返回 false", async () => {
  mocks.findQuiz.mockResolvedValue(null);
  expect((await request(app).get("/api/health")).body.demoQuizFound).toBe(false);
});
it("非法 JSON 返回 400", async () => {
  const response = await request(app).post("/api/quizzes").set("Content-Type", "application/json").send('{"title":');
  expect(response.status).toBe(400); expect(response.body.error.code).toBe("VALIDATION_ERROR");
});
it("未知 API 路由返回统一 404", async () => {
  const response = await request(app).get("/api/unknown");
  expect(response.status).toBe(404); expect(response.body.error.code).toBe("NOT_FOUND");
  expect(console.error).not.toHaveBeenCalled();
});
it("D submission endpoint requires a student identity", async () => {
  const response = await request(app).post("/api/quizzes/quiz-demo/submissions").send({ answers: [] });
  expect(response.status).toBe(403);
  expect(response.body.error.code).toBe("FORBIDDEN");
});
it("C read routes enforce the student role before querying", async () => {
  for (const path of ["/api/quizzes", "/api/quizzes/quiz-demo"]) {
    const response = await request(app).get(path);
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
  }
});
it("Zod 字段错误使用点分路径", async () => {
  const testApp = express(); testApp.use(express.json());
  // 仅测试内存应用，不在实际业务路由中实现接口。
  testApp.post("/validate", (req, res) => { CreateQuizRequest.parse(req.body); res.sendStatus(204); });
  testApp.use(errorHandler);
  const response = await request(testApp).post("/validate").send({ title: "test", questions: [{ prompt: "p", type: "SINGLE_CHOICE", options: [
    { text: "a", isCorrect: true }, { text: "b", isCorrect: true },
  ] }] });
  expect(response.status).toBe(400);
  expect(response.body.error.fields["questions.0.options"]).toBeDefined();
});

it.each([
  ["VALIDATION_ERROR", 400], ["FORBIDDEN", 403], ["NOT_FOUND", 404],
] as const)("预期 %s 错误不写服务端错误日志", async (code, status) => {
  const testApp = express();
  testApp.get("/error", () => { throw new AppError(code, "预期错误"); });
  testApp.use(errorHandler);
  expect((await request(testApp).get("/error")).status).toBe(status);
  expect(console.error).not.toHaveBeenCalled();
});
