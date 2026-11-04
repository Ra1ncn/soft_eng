import express from "express";
import type { HealthResponse } from "@quiz/shared";
import { prisma } from "./lib/prisma.ts";
import { AppError, errorHandler } from "./lib/errors.ts";
import { quizzesRouter } from "./modules/quizzes/routes.ts";
import { submissionsRouter } from "./modules/submissions/routes.ts";

export const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));
app.get("/api/health", async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  const quiz = await prisma.quiz.findUnique({ where: { id: "quiz-demo" }, select: { id: true } });
  const body: HealthResponse = { status: "ok", database: "ok", demoQuizFound: quiz !== null };
  res.json(body);
});
app.use("/api/quizzes/:quizId/submissions", submissionsRouter);
app.use("/api/quizzes", quizzesRouter);
app.use("/api", (_req, _res, next) => next(new AppError("NOT_FOUND", "API 路由不存在")));
app.use(errorHandler);
