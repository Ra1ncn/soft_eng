import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SubmitResponse } from "@quiz/shared";
import { Prisma } from "../../generated/prisma/client.ts";

const mocks = vi.hoisted(() => ({
  user: vi.fn(), quiz: vi.fn(), existing: vi.fn(), create: vi.fn(),
  transaction: vi.fn(), winner: vi.fn(),
}));
vi.mock("../../lib/prisma.ts", () => ({ prisma: {
  user: { findUnique: mocks.user },
  $transaction: mocks.transaction,
  submission: { findUnique: mocks.winner },
} }));
import { app } from "../../app.ts";

const receipt = { id: "submission-1", submittedAt: new Date("2026-11-04T18:00:00.000Z") };
const body = { answers: [
  { questionId: "q1", optionIds: ["o1"] },
  { questionId: "q2", optionIds: ["o3", "o4"] },
] };
const post = (payload: object = body, role: string | undefined = "STUDENT") => {
  const call = request(app).post("/api/quizzes/quiz-demo/submissions");
  if (role !== undefined) call.set("X-Demo-Role", role);
  return call.send(payload);
};
const conflict = (meta: Record<string, unknown>) => new Prisma.PrismaClientKnownRequestError(
  "unique constraint", { code: "P2002", clientVersion: "7.10.1", meta },
);

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.user.mockImplementation(async ({ where }) => ({
    id: where.id, role: where.id === "teacher-demo" ? "TEACHER" : "STUDENT",
  }));
  mocks.quiz.mockResolvedValue({ questions: [
    { id: "q1", type: "SINGLE_CHOICE", options: [{ id: "o1" }, { id: "o2" }] },
    { id: "q2", type: "MULTIPLE_SELECT", options: [{ id: "o3" }, { id: "o4" }] },
  ] });
  mocks.existing.mockResolvedValue(null);
  mocks.create.mockResolvedValue(receipt);
  mocks.winner.mockResolvedValue(receipt);
  mocks.transaction.mockImplementation(async (operation) => operation({
    quiz: { findUnique: mocks.quiz },
    submission: { findUnique: mocks.existing, create: mocks.create },
  }));
});
afterEach(() => vi.restoreAllMocks());

describe("POST /api/quizzes/:quizId/submissions", () => {
  it("saves single/multiple selections in a transaction and returns the C receipt", async () => {
    const response = await post({ ...body, studentId: "forged-student" });
    expect(response.status).toBe(201);
    expect(response.body).toEqual({ submissionId: receipt.id, submittedAt: receipt.submittedAt.toISOString() });
    expect(SubmitResponse.safeParse(response.body).success).toBe(true);
    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.quiz.mock.calls[0]![0].where).toEqual({ id: "quiz-demo" });
    expect(mocks.create.mock.calls[0]![0].data).toEqual({
      quizId: "quiz-demo", studentId: "student-demo", answers: { create: [
        { questionId: "q1", selectedOptions: { connect: [{ id: "o1" }] } },
        { questionId: "q2", selectedOptions: { connect: [{ id: "o3" }, { id: "o4" }] } },
      ] },
    });
  });

  it.each([
    { answers: [] },
    { answers: [{ questionId: "q1", optionIds: [] }] },
  ])("persists every unanswered question for %j", async (payload) => {
    expect((await post(payload)).status).toBe(201);
    expect(mocks.create.mock.calls[0]![0].data.answers.create).toEqual([
      { questionId: "q1", selectedOptions: { connect: [] } },
      { questionId: "q2", selectedOptions: { connect: [] } },
    ]);
  });

  it("fills omitted questions without dropping supplied selections", async () => {
    expect((await post({ answers: [body.answers[0]] })).status).toBe(201);
    expect(mocks.create.mock.calls[0]![0].data.answers.create[1]).toEqual({
      questionId: "q2", selectedOptions: { connect: [] },
    });
  });

  it.each(["", "ADMIN", "student", "TEACHER"])("rejects identity %s before opening a transaction", async (role) => {
    expect((await post({}, role)).status).toBe(403);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rejects missing identity", async () => {
    expect((await request(app).post("/api/quizzes/quiz-demo/submissions").send(body)).status).toBe(403);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("handles an absent seed student without writing", async () => {
    mocks.user.mockResolvedValue(null);
    expect((await post()).status).toBe(500);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it.each([
    [{}, "answers"],
    [{ answers: [{ questionId: " ", optionIds: [] }] }, "answers.0.questionId"],
    [{ answers: [{ questionId: "q1", optionIds: "o1" }] }, "answers.0.optionIds"],
    [{ answers: [{ questionId: "q1", optionIds: [] }, { questionId: " q1 ", optionIds: [] }] }, "answers.1.questionId"],
    [{ answers: [{ questionId: "q1", optionIds: ["o1", " o1 "] }] }, "answers.0.optionIds.1"],
  ])("rejects malformed or duplicate answers before a transaction: %j", async (payload, field) => {
    const response = await post(payload);
    expect(response.status).toBe(400);
    expect(response.body.error.fields[field as string]).toBeDefined();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("returns 404 for a nonexistent quiz", async () => {
    mocks.quiz.mockResolvedValue(null);
    expect((await post()).status).toBe(404);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it.each([
    [{ answers: [{ questionId: "foreign-question", optionIds: [] }] }, "answers.0.questionId"],
    [{ answers: [{ questionId: "q1", optionIds: ["o3"] }] }, "answers.0.optionIds.0"],
    [{ answers: [{ questionId: "q2", optionIds: ["missing-option"] }] }, "answers.0.optionIds.0"],
    [{ answers: [{ questionId: "q1", optionIds: ["o1", "o2"] }] }, "answers.0.optionIds"],
  ])("validates ownership and type even on retries: %j", async (payload, field) => {
    mocks.existing.mockResolvedValue(receipt);
    const response = await post(payload);
    expect(response.status).toBe(400);
    expect(response.body.error.fields[field as string]).toBeDefined();
    expect(mocks.existing).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("returns the original receipt without replacing answers", async () => {
    mocks.existing.mockResolvedValue(receipt);
    const response = await post({ answers: [] });
    expect(response.status).toBe(200);
    expect(response.body.submissionId).toBe(receipt.id);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it.each([
    { modelName: "Submission", target: ["quizId", "studentId"] },
    { modelName: "Submission", target: "Submission_quizId_studentId_key" },
    { modelName: "Submission", driverAdapterError: { cause: {
      kind: "UniqueConstraintViolation", constraint: { index: "Submission_quizId_studentId_key" },
    } } },
  ])("recovers only a matching concurrent submission conflict: %j", async (meta) => {
    mocks.create.mockRejectedValue(conflict(meta));
    const response = await post();
    expect(response.status).toBe(200);
    expect(response.body.submissionId).toBe(receipt.id);
    expect(mocks.winner).toHaveBeenCalledWith({
      where: { quizId_studentId: { quizId: "quiz-demo", studentId: "student-demo" } },
      select: { id: true, submittedAt: true },
    });
  });

  it.each([
    { modelName: "SubmissionAnswer", target: ["submissionId", "questionId"] },
    { modelName: "Submission", target: ["id"] },
    { modelName: "Submission", driverAdapterError: { cause: {
      kind: "UniqueConstraintViolation", constraint: { index: "Submission_pkey" },
    } } },
    {},
  ])("does not disguise other unique errors as successful retries: %j", async (meta) => {
    mocks.create.mockRejectedValue(conflict(meta));
    expect((await post()).status).toBe(500);
    expect(mocks.winner).not.toHaveBeenCalled();
  });

  it("does not claim success when the concurrent winning record is missing", async () => {
    mocks.create.mockRejectedValue(conflict({ modelName: "Submission", target: ["quizId", "studentId"] }));
    mocks.winner.mockResolvedValue(null);
    expect((await post()).status).toBe(500);
  });

  it("returns a generic failure when writing any answer fails", async () => {
    mocks.create.mockRejectedValue(new Error("private database details"));
    const response = await post();
    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: { code: "INTERNAL_ERROR", message: "服务器内部错误" } });
    expect(mocks.winner).not.toHaveBeenCalled();
  });
});
