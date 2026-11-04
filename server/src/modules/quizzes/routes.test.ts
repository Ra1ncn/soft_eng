import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ findUser: vi.fn(), createQuiz: vi.fn() }));
vi.mock("../../lib/prisma.ts", () => ({ prisma: { user: { findUnique: mocks.findUser }, quiz: { create: mocks.createQuiz } } }));
import { app } from "../../app.ts";

const createdAt = new Date("2026-11-04T18:00:00.000Z");
const validBody = {
  title: "  Database basics  ",
  questions: [
    { prompt: " Which key identifies a row? ", type: "SINGLE_CHOICE", options: [{ text: " Primary key ", isCorrect: true }, { text: "Index", isCorrect: false }] },
    { prompt: "A primary key must be:", type: "MULTIPLE_SELECT", options: [{ text: "Unique", isCorrect: true }, { text: "Not NULL", isCorrect: true }, { text: "Repeatable", isCorrect: false }] },
  ],
};
const post = (body: object, role?: string) => {
  const call = request(app).post("/api/quizzes");
  return (role ? call.set("X-Demo-Role", role) : call).send(body);
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.findUser.mockImplementation(async ({ where }: { where: { id: string } }) => ({ id: where.id, role: where.id === "teacher-demo" ? "TEACHER" : "STUDENT" }));
  mocks.createQuiz.mockResolvedValue({ id: "quiz1", title: "Database basics", createdAt });
});

describe("POST /api/quizzes", () => {
  it("creates the quiz and returns only the agreed fields", async () => {
    const response = await post(validBody, "TEACHER");
    expect(response.status).toBe(201);
    expect(response.body).toEqual({ id: "quiz1", title: "Database basics", createdAt: createdAt.toISOString() });
  });

  it("stores trimmed text, array order as position, and answer keys", async () => {
    await post(validBody, "TEACHER");
    const { data, select } = mocks.createQuiz.mock.calls[0]?.[0];
    expect(select).toEqual({ id: true, title: true, createdAt: true });
    expect(data.title).toBe("Database basics");
    expect(data.questions.create).toEqual([
      { position: 0, prompt: "Which key identifies a row?", type: "SINGLE_CHOICE", options: { create: [
        { position: 0, text: "Primary key", isCorrect: true },
        { position: 1, text: "Index", isCorrect: false },
      ] } },
      { position: 1, prompt: "A primary key must be:", type: "MULTIPLE_SELECT", options: { create: [
        { position: 0, text: "Unique", isCorrect: true },
        { position: 1, text: "Not NULL", isCorrect: true },
        { position: 2, text: "Repeatable", isCorrect: false },
      ] } },
    ]);
  });

  it("takes the teacher from the session identity and ignores client-sent ownership and positions", async () => {
    const [first, ...rest] = validBody.questions;
    await post({ ...validBody, teacherId: "someone-else", questions: [{ ...first, position: 9 }, ...rest] }, "TEACHER");
    const { data } = mocks.createQuiz.mock.calls[0]?.[0];
    expect(data.teacherId).toBe("teacher-demo");
    expect(data.questions.create[0].position).toBe(0);
  });

  it.each([["STUDENT"], [undefined], ["ADMIN"]])("rejects role %s with 403 and writes nothing", async (role) => {
    const response = await post(validBody, role);
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
    expect(mocks.createQuiz).not.toHaveBeenCalled();
  });

  it("checks the role before validating the body", async () => {
    const response = await post({}, "STUDENT");
    expect(response.status).toBe(403);
  });

  it.each([
    ["blank title", { ...validBody, title: "   " }, "title"],
    ["no questions", { ...validBody, questions: [] }, "questions"],
    ["blank prompt", { ...validBody, questions: [{ ...validBody.questions[0], prompt: " " }] }, "questions.0.prompt"],
    ["too few options", { ...validBody, questions: [{ ...validBody.questions[0], options: [{ text: "Only", isCorrect: true }] }] }, "questions.0.options"],
    ["blank option", { ...validBody, questions: [{ ...validBody.questions[0], options: [{ text: "A", isCorrect: true }, { text: " ", isCorrect: false }] }] }, "questions.0.options.1.text"],
    ["two correct on single choice", { ...validBody, questions: [{ ...validBody.questions[0], options: [{ text: "A", isCorrect: true }, { text: "B", isCorrect: true }] }] }, "questions.0.options"],
    ["no correct on multiple select", { ...validBody, questions: [{ ...validBody.questions[1], options: [{ text: "A", isCorrect: false }, { text: "B", isCorrect: false }] }] }, "questions.0.options"],
  ])("rejects %s with a field error and writes nothing", async (_name, body, field) => {
    const response = await post(body, "TEACHER");
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(response.body.error.fields[field]).toBeDefined();
    expect(mocks.createQuiz).not.toHaveBeenCalled();
  });

  it("hides database failures behind the generic 500", async () => {
    mocks.createQuiz.mockRejectedValue(new Error("secret database connection details"));
    const response = await post(validBody, "TEACHER");
    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe("INTERNAL_ERROR");
    expect(JSON.stringify(response.body)).not.toContain("secret");
  });
});
