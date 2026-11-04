// Explicit, opt-in verification against the configured database; not part of npm test.
import assert from "node:assert/strict";
import request from "supertest";
import { QuizDetailResponse, SubmitResponse } from "@quiz/shared";
import { app } from "../src/app.ts";
import { prisma } from "../src/lib/prisma.ts";

const quizIds: string[] = [];
const client = request(app);

async function createQuiz() {
  const response = await client.post("/api/quizzes").set("X-Demo-Role", "TEACHER").send({
    title: `D verification ${crypto.randomUUID()}`,
    questions: [
      { prompt: "Single choice", type: "SINGLE_CHOICE", options: [
        { text: "A", isCorrect: true }, { text: "B", isCorrect: false },
      ] },
      { prompt: "Multiple select", type: "MULTIPLE_SELECT", options: [
        { text: "C", isCorrect: true }, { text: "D", isCorrect: true },
      ] },
    ],
  });
  assert.equal(response.status, 201, `B create failed: ${response.text}`);
  quizIds.push(response.body.id);
  const detail = await client.get(`/api/quizzes/${response.body.id}`).set("X-Demo-Role", "STUDENT");
  assert.equal(detail.status, 200);
  assert.ok(!detail.text.includes("isCorrect"));
  return QuizDetailResponse.parse(detail.body);
}

function submit(id: string, answers: { questionId: string; optionIds: string[] }[]) {
  return client.post(`/api/quizzes/${id}/submissions`).set("X-Demo-Role", "STUDENT").send({ answers });
}

async function stored(id: string) {
  return prisma.submission.findUniqueOrThrow({
    where: { quizId_studentId: { quizId: id, studentId: "student-demo" } },
    include: { answers: { include: { selectedOptions: { select: { id: true } } }, orderBy: { questionId: "asc" } } },
  });
}

try {
  await prisma.$queryRaw`SELECT 1`;
  const quiz = await createQuiz();
  const single = quiz.questions[0]!;
  const multi = quiz.questions[1]!;

  // Cross-question selections fail without leaving a partial submission.
  const invalid = await submit(quiz.id, [{ questionId: single.id, optionIds: [multi.options[0]!.id] }]);
  assert.equal(invalid.status, 400);
  assert.equal(await prisma.submission.count({ where: { quizId: quiz.id } }), 0);
  const tooMany = await submit(quiz.id, [{ questionId: single.id, optionIds: single.options.map((option) => option.id) }]);
  assert.equal(tooMany.status, 400);
  assert.equal(await prisma.submissionAnswer.count({ where: { questionId: { in: quiz.questions.map((question) => question.id) } } }), 0);

  const response = await submit(quiz.id, [{ questionId: multi.id, optionIds: multi.options.map((option) => option.id) }]);
  assert.equal(response.status, 201, response.text);
  const receipt = SubmitResponse.parse(response.body);
  const saved = await stored(quiz.id);
  assert.equal(saved.id, receipt.submissionId);
  assert.equal(saved.submittedAt.toISOString(), receipt.submittedAt);
  assert.equal(saved.answers.length, 2);
  assert.equal(saved.answers.find((answer) => answer.questionId === single.id)!.selectedOptions.length, 0);
  assert.deepEqual(saved.answers.find((answer) => answer.questionId === multi.id)!.selectedOptions.map((option) => option.id).sort(), multi.options.map((option) => option.id).sort());

  const retry = await submit(quiz.id, []);
  assert.equal(retry.status, 200);
  assert.deepEqual(retry.body, response.body);
  assert.deepEqual(await stored(quiz.id), saved, "Retry must not overwrite answers");
  const invalidRetry = await submit(quiz.id, [{ questionId: single.id, optionIds: [multi.options[0]!.id] }]);
  assert.equal(invalidRetry.status, 400);

  const detail = await client.get(`/api/quizzes/${quiz.id}`).set("X-Demo-Role", "STUDENT");
  assert.equal(detail.body.submittedAt, receipt.submittedAt);
  const list = await client.get("/api/quizzes").set("X-Demo-Role", "STUDENT");
  assert.equal(list.body.quizzes.find((item: { id: string }) => item.id === quiz.id).submittedAt, receipt.submittedAt);

  const concurrentQuiz = await createQuiz();
  const answers = concurrentQuiz.questions.map((question) => ({ questionId: question.id, optionIds: [question.options[0]!.id] }));
  const concurrent = await Promise.all(Array.from({ length: 8 }, () => submit(concurrentQuiz.id, answers)));
  assert.equal(concurrent.filter((item) => item.status === 201).length, 1, JSON.stringify(concurrent.map((item) => ({ status: item.status, body: item.body }))));
  assert.ok(concurrent.every((item) => item.status === 200 || item.status === 201));
  assert.ok(concurrent.every((item) => item.body.submissionId === concurrent[0]!.body.submissionId));
  assert.equal(await prisma.submission.count({ where: { quizId: concurrentQuiz.id } }), 1);
  assert.equal((await stored(concurrentQuiz.id)).answers.length, 2);

  const blankQuiz = await createQuiz();
  assert.equal((await submit(blankQuiz.id, [])).status, 201);
  assert.ok((await stored(blankQuiz.id)).answers.every((answer) => answer.selectedOptions.length === 0));
  console.log("PASS: B create → C read → D save; empty answers; validation; retries; 8 concurrent requests; persisted list/detail status.");
} catch (error) {
  console.error("Database verification failed. Start PostgreSQL and run migrations/seed first.");
  console.error(error);
  process.exitCode = 1;
} finally {
  try {
    if (quizIds.length) await prisma.$transaction(async (tx) => {
      // Only remove records created by this run; never touch the seed quiz or user submissions.
      await tx.submission.deleteMany({ where: { quizId: { in: quizIds } } });
      await tx.quiz.deleteMany({ where: { id: { in: quizIds } } });
    });
  } finally {
    await prisma.$disconnect();
  }
}
