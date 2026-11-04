import { Router } from "express";
import { SubmitRequest, type SubmitResponse } from "@quiz/shared";
import { Prisma } from "../../generated/prisma/client.ts";
import { getCurrentUser } from "../../auth/getCurrentUser.ts";
import { AppError } from "../../lib/errors.ts";
import { prisma } from "../../lib/prisma.ts";

export const submissionsRouter = Router({ mergeParams: true });

const receiptSelect = { id: true, submittedAt: true } as const;

// Only the per-student submission constraint can be treated as a successful retry.
function isSubmissionConflict(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return false;
  const target = error.meta?.target;
  if (error.meta?.modelName === "Submission" && (
    (Array.isArray(target) && target.length === 2 && target.includes("quizId") && target.includes("studentId")) ||
    target === "Submission_quizId_studentId_key"
  )) return true;
  // Prisma 7's PostgreSQL adapter reports the index in the underlying driver error.
  const adapter = error.meta?.driverAdapterError as {
    cause?: { kind?: string; constraint?: { index?: string; fields?: string[] } };
  } | undefined;
  return error.meta?.modelName === "Submission" &&
    adapter?.cause?.kind === "UniqueConstraintViolation" &&
    adapter.cause.constraint?.index === "Submission_quizId_studentId_key";
}

submissionsRouter.post<{ quizId: string }>("/", async (req, res) => {
  const user = await getCurrentUser(req);
  if (user.role !== "STUDENT") throw new AppError("FORBIDDEN", "Only students can submit answers");
  const { answers } = SubmitRequest.parse(req.body);
  const quizId = req.params.quizId;
  const where = { quizId_studentId: { quizId, studentId: user.id } };

  let result;
  try {
    result = await prisma.$transaction(async (tx) => {
      const quiz = await tx.quiz.findUnique({
        where: { id: quizId },
        select: { questions: { select: { id: true, type: true, options: { select: { id: true } } } } },
      });
      if (!quiz) throw new AppError("NOT_FOUND", "Quiz not found");
      const questions = new Map(quiz.questions.map((question) => [question.id, question]));
      answers.forEach((answer, index) => {
        const question = questions.get(answer.questionId);
        if (!question) throw new AppError("VALIDATION_ERROR", "Question does not belong to this quiz", {
          [`answers.${index}.questionId`]: "Question does not belong to this quiz",
        });
        const available = new Set(question.options.map((option) => option.id));
        answer.optionIds.forEach((id, optionIndex) => {
          if (!available.has(id)) throw new AppError("VALIDATION_ERROR", "Option does not belong to this question", {
            [`answers.${index}.optionIds.${optionIndex}`]: "Option does not belong to this question",
          });
        });
        if (question.type === "SINGLE_CHOICE" && answer.optionIds.length > 1) {
          throw new AppError("VALIDATION_ERROR", "Single choice accepts at most one option", {
            [`answers.${index}.optionIds`]: "Single choice accepts at most one option",
          });
        }
      });

      // Validate even retries before returning the original, immutable receipt.
      const existing = await tx.submission.findUnique({ where, select: receiptSelect });
      if (existing) return { receipt: existing, created: false };
      const selected = new Map(answers.map((answer) => [answer.questionId, answer.optionIds]));
      const receipt = await tx.submission.create({
        data: {
          quizId,
          studentId: user.id,
          answers: { create: quiz.questions.map((question) => ({
            questionId: question.id,
            selectedOptions: { connect: (selected.get(question.id) ?? []).map((id) => ({ id })) },
          })) },
        },
        select: receiptSelect,
      });
      return { receipt, created: true };
    });
  } catch (error) {
    // A failed PostgreSQL transaction must finish rolling back before reading the winner.
    if (!isSubmissionConflict(error)) throw error;
    const receipt = await prisma.submission.findUnique({ where, select: receiptSelect });
    if (!receipt) throw error;
    result = { receipt, created: false };
  }
  const body: SubmitResponse = {
    submissionId: result.receipt.id,
    submittedAt: result.receipt.submittedAt.toISOString(),
  };
  res.status(result.created ? 201 : 200).json(body);
});
