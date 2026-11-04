import express from "express";
import request from "supertest";
import { beforeEach, expect, it, vi } from "vitest";
import { CreateQuizRequest } from "@quiz/shared";
import { errorHandler } from "./lib/errors.ts";
const mocks = vi.hoisted(() => ({ query: vi.fn(), findQuiz: vi.fn() }));
vi.mock("./lib/prisma.ts", () => ({ prisma: { $queryRaw: mocks.query, quiz: { findUnique: mocks.findQuiz } } }));
import { app } from "./app.ts";
beforeEach(() => { vi.resetAllMocks(); mocks.query.mockResolvedValue([{}]); mocks.findQuiz.mockResolvedValue({ id: "quiz-demo" }); });
it("health 无身份头也查询数据库", async () => {
  const response = await request(app).get("/api/health");
  expect(response.status).toBe(200);
  expect(response.body).toEqual({ status: "ok", database: "ok", demoQuizFound: true });
  expect(mocks.query).toHaveBeenCalledOnce();
});
it("数据库故障只返回通用 500", async () => {
  mocks.query.mockRejectedValue(new Error("secret database connection details"));
  const response = await request(app).get("/api/health");
  expect(response.status).toBe(500);
  expect(response.body).toEqual({ error: { code: "INTERNAL_ERROR", message: "服务器内部错误" } });
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
});
it("四个业务接口保持未实现", async () => {
  for (const [method, path] of [["post", "/api/quizzes"], ["get", "/api/quizzes"], ["get", "/api/quizzes/quiz-demo"], ["post", "/api/quizzes/quiz-demo/submissions"]] as const) {
    expect((await request(app)[method](path)).status).toBe(404);
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
