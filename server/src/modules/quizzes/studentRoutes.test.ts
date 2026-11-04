import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QuizDetailResponse, QuizListResponse } from "@quiz/shared";

const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  list: vi.fn(),
  detail: vi.fn(),
}));
vi.mock("../../lib/prisma.ts", () => ({
  prisma: {
    user: { findUnique: mocks.user },
    quiz: { findMany: mocks.list, findUnique: mocks.detail },
  },
}));
import { app } from "../../app.ts";

const submittedAt = new Date("2026-11-04T18:00:00.000Z");
function sampleQuiz() {
  return {
    id: "quiz-demo",
    title: "Database basics",
    submissions: [],
    questions: [
      {
        id: "question-single",
        prompt: "Choose one option",
        type: "SINGLE_CHOICE",
        options: [
          { id: "single-a", text: "First" },
          { id: "single-b", text: "Second" },
        ],
      },
      {
        id: "question-multi",
        prompt: "Choose all matching options",
        type: "MULTIPLE_SELECT",
        options: [
          { id: "multi-a", text: "One" },
          { id: "multi-b", text: "Two" },
        ],
      },
    ],
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.user.mockImplementation(({ where }: { where: { id: string } }) =>
    Promise.resolve({
      id: where.id,
      role: where.id === "teacher-demo" ? "TEACHER" : "STUDENT",
    }),
  );
  mocks.list.mockResolvedValue([]);
  mocks.detail.mockResolvedValue(sampleQuiz());
});
afterEach(() => vi.restoreAllMocks());

describe.each(["/api/quizzes", "/api/quizzes/quiz-demo"])(
  "Student read %s",
  (path) => {
    it.each([undefined, "", "student", "ADMIN"])(
      "rejects a missing or invalid demo identity %s before querying quiz data",
      async (role) => {
        const call = request(app).get(path);
        if (role !== undefined) call.set("X-Demo-Role", role);
        const response = await call;
        expect(response.status).toBe(403);
        expect(response.body.error.code).toBe("FORBIDDEN");
        expect(mocks.user).not.toHaveBeenCalled();
        expect(mocks.list).not.toHaveBeenCalled();
        expect(mocks.detail).not.toHaveBeenCalled();
      },
    );

    it("rejects a teacher without reading quiz data", async () => {
      const response = await request(app)
        .get(path)
        .set("X-Demo-Role", "TEACHER");
      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("FORBIDDEN");
      expect(mocks.list).not.toHaveBeenCalled();
      expect(mocks.detail).not.toHaveBeenCalled();
    });

    it("returns a generic 500 if the seeded student is absent", async () => {
      mocks.user.mockResolvedValue(null);
      const response = await request(app)
        .get(path)
        .set("X-Demo-Role", "STUDENT");
      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        error: { code: "INTERNAL_ERROR", message: "服务器内部错误" },
      });
      expect(mocks.list).not.toHaveBeenCalled();
      expect(mocks.detail).not.toHaveBeenCalled();
    });

    it("hides database failure details", async () => {
      const failure = new Error("database host/password should remain private");
      mocks.list.mockRejectedValue(failure);
      mocks.detail.mockRejectedValue(failure);
      const response = await request(app)
        .get(path)
        .set("X-Demo-Role", "STUDENT");
      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        error: { code: "INTERNAL_ERROR", message: "服务器内部错误" },
      });
      expect(console.error).toHaveBeenCalledWith(failure);
    });
  },
);

describe("GET /api/quizzes", () => {
  it("returns a valid empty list", async () => {
    const response = await request(app)
      .get("/api/quizzes")
      .set("X-Demo-Role", "STUDENT");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ quizzes: [] });
    expect(QuizListResponse.safeParse(response.body).success).toBe(true);
  });

  it("returns question counts and only the current student's submission status", async () => {
    mocks.list.mockResolvedValue([
      {
        id: "quiz-new",
        title: "New quiz",
        _count: { questions: 3 },
        submissions: [],
      },
      {
        id: "quiz-done",
        title: "Done quiz",
        _count: { questions: 2 },
        submissions: [{ submittedAt }],
      },
    ]);
    const response = await request(app)
      .get("/api/quizzes")
      .set("X-Demo-Role", "STUDENT");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      quizzes: [
        {
          id: "quiz-new",
          title: "New quiz",
          questionCount: 3,
          submittedAt: null,
        },
        {
          id: "quiz-done",
          title: "Done quiz",
          questionCount: 2,
          submittedAt: submittedAt.toISOString(),
        },
      ],
    });
    expect(QuizListResponse.safeParse(response.body).success).toBe(true);
    const query = mocks.list.mock.calls[0]?.[0];
    expect(query.orderBy).toEqual([{ createdAt: "desc" }, { id: "asc" }]);
    expect(query.select.submissions.where).toEqual({
      studentId: "student-demo",
    });
    expect(query.select.submissions.select).toEqual({ submittedAt: true });
    expect(query.select).not.toHaveProperty("questions");
  });
});

describe("GET /api/quizzes/:quizId", () => {
  it("returns single/multiple choice questions without reading or exposing answer keys", async () => {
    // The mock includes extra fields to check output projection as well as Prisma select.
    const quiz = sampleQuiz();
    Object.assign(quiz.questions[0]!.options[0]!, { isCorrect: true });
    mocks.detail.mockResolvedValue(quiz);
    const response = await request(app)
      .get("/api/quizzes/quiz-demo")
      .set("X-Demo-Role", "STUDENT");
    expect(response.status).toBe(200);
    expect(QuizDetailResponse.safeParse(response.body).success).toBe(true);
    expect(response.body).toMatchObject({ id: "quiz-demo", submittedAt: null });
    expect(
      response.body.questions.map(
        (question: { type: string }) => question.type,
      ),
    ).toEqual(["SINGLE_CHOICE", "MULTIPLE_SELECT"]);
    expect(response.text).not.toContain("isCorrect");
    const query = mocks.detail.mock.calls[0]?.[0];
    expect(query.where).toEqual({ id: "quiz-demo" });
    expect(query.select.questions.orderBy).toEqual({ position: "asc" });
    expect(query.select.questions.select.options.orderBy).toEqual({
      position: "asc",
    });
    expect(query.select.questions.select.options.select).toEqual({
      id: true,
      text: true,
    });
    expect(query.select.submissions.where).toEqual({
      studentId: "student-demo",
    });
    expect(query.select.submissions.select).toEqual({ submittedAt: true });
  });

  it("returns the current student's committed submission time", async () => {
    mocks.detail.mockResolvedValue({
      ...sampleQuiz(),
      submissions: [{ submittedAt }],
    });
    const response = await request(app)
      .get("/api/quizzes/quiz-demo")
      .set("X-Demo-Role", "STUDENT");
    expect(response.status).toBe(200);
    expect(response.body.submittedAt).toBe(submittedAt.toISOString());
  });

  it("returns a standardized 404 for a nonexistent quiz", async () => {
    mocks.detail.mockResolvedValue(null);
    const response = await request(app)
      .get("/api/quizzes/missing")
      .set("X-Demo-Role", "STUDENT");
    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: { code: "NOT_FOUND", message: "Quiz not found" },
    });
    expect(mocks.detail.mock.calls[0]?.[0].where).toEqual({ id: "missing" });
    expect(console.error).not.toHaveBeenCalled();
  });
});
