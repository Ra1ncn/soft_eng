import { Router } from "express";
import { CreateQuizRequest, type CreateQuizResponse } from "@quiz/shared";
import { getCurrentUser } from "../../auth/getCurrentUser.ts";
import { AppError } from "../../lib/errors.ts";
import { prisma } from "../../lib/prisma.ts";

// C adds GET / and GET /:quizId here.
export const quizzesRouter = Router();

quizzesRouter.post("/", async (req, res) => {
  const user = await getCurrentUser(req);
  if (user.role !== "TEACHER") throw new AppError("FORBIDDEN", "Only teachers can create quizzes");
  const { title, questions } = CreateQuizRequest.parse(req.body);
  // A nested create runs in one transaction, so a failure leaves no partial quiz.
  const quiz = await prisma.quiz.create({
    data: {
      title,
      teacherId: user.id,
      questions: {
        create: questions.map(({ prompt, type, options }, position) => ({
          position,
          prompt,
          type,
          options: { create: options.map(({ text, isCorrect }, position) => ({ position, text, isCorrect })) },
        })),
      },
    },
    select: { id: true, title: true, createdAt: true },
  });
  const body: CreateQuizResponse = { id: quiz.id, title: quiz.title, createdAt: quiz.createdAt.toISOString() };
  res.status(201).json(body);
});
