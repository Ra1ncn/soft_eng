import { Router } from "express";
import { CreateQuizRequest, type CreateQuizResponse, type QuizDetailResponse, type QuizListResponse } from "@quiz/shared";
import { getCurrentUser } from "../../auth/getCurrentUser.ts";
import { AppError } from "../../lib/errors.ts";
import { prisma } from "../../lib/prisma.ts";

// Combined B POST and C GET routes for isolated compatibility validation.
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

quizzesRouter.get("/", async (req, res) => {
  const user = await getCurrentUser(req);
  if (user.role !== "STUDENT") throw new AppError("FORBIDDEN", "Only students can view quizzes");

  const quizzes = await prisma.quiz.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    select: {
      id: true,
      title: true,
      _count: { select: { questions: true } },
      submissions: {
        where: { studentId: user.id },
        select: { submittedAt: true },
        take: 1,
      },
    },
  });
  const body: QuizListResponse = {
    quizzes: quizzes.map((quiz) => ({
      id: quiz.id,
      title: quiz.title,
      questionCount: quiz._count.questions,
      submittedAt: quiz.submissions[0]?.submittedAt.toISOString() ?? null,
    })),
  };
  res.json(body);
});

quizzesRouter.get("/:quizId", async (req, res) => {
  const user = await getCurrentUser(req);
  if (user.role !== "STUDENT") throw new AppError("FORBIDDEN", "Only students can view quizzes");

  const quiz = await prisma.quiz.findUnique({
    where: { id: req.params.quizId },
    select: {
      id: true,
      title: true,
      submissions: {
        where: { studentId: user.id },
        select: { submittedAt: true },
        take: 1,
      },
      questions: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          prompt: true,
          type: true,
          options: {
            orderBy: { position: "asc" },
            // Never read the answer key into the student response path.
            select: { id: true, text: true },
          },
        },
      },
    },
  });
  if (!quiz) throw new AppError("NOT_FOUND", "Quiz not found");

  const body: QuizDetailResponse = {
    id: quiz.id,
    title: quiz.title,
    submittedAt: quiz.submissions[0]?.submittedAt.toISOString() ?? null,
    questions: quiz.questions.map((question) => ({
      id: question.id,
      prompt: question.prompt,
      type: question.type,
      options: question.options.map((option) => ({ id: option.id, text: option.text })),
    })),
  };
  res.json(body);
});
