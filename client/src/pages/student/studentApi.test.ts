import { afterEach, expect, it, vi } from "vitest";
import { ApiFetchError } from "../../lib/apiFetch.ts";
import { studentApi, studentErrorMessage } from "./studentApi.ts";

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it("loads the list with the shared STUDENT header and list envelope", async () => {
  const body = {
    quizzes: [
      { id: "quiz-1", title: "Quiz", questionCount: 2, submittedAt: null },
    ],
  };
  const fetchMock = vi.fn().mockResolvedValue(response(body));
  vi.stubGlobal("fetch", fetchMock);
  await expect(studentApi.list()).resolves.toEqual(body);
  expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/quizzes");
  const headers = fetchMock.mock.calls[0]?.[1].headers as Headers;
  expect(headers.get("X-Demo-Role")).toBe("STUDENT");
});

it("reads a flat detail response and URL-encodes the quiz ID", async () => {
  const body = {
    id: "quiz / one",
    title: "Quiz",
    submittedAt: null,
    questions: [],
  };
  const fetchMock = vi.fn().mockResolvedValue(response(body));
  vi.stubGlobal("fetch", fetchMock);
  await expect(studentApi.detail(body.id)).resolves.toEqual(body);
  expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/quizzes/quiz%20%2F%20one");
});

it("posts optionIds and accepts the shared flat submission receipt", async () => {
  const receipt = {
    submissionId: "submission-1",
    submittedAt: "2026-11-04T18:00:00.000Z",
  };
  const fetchMock = vi.fn().mockResolvedValue(response(receipt, 201));
  vi.stubGlobal("fetch", fetchMock);
  const payload = {
    answers: [{ questionId: "question-1", optionIds: ["option-1"] }],
  };
  await expect(studentApi.submit("quiz-1", payload)).resolves.toEqual(receipt);
  expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/quizzes/quiz-1/submissions");
  const options = fetchMock.mock.calls[0]?.[1];
  expect(options.method).toBe("POST");
  expect(JSON.parse(options.body)).toEqual(payload);
  expect((options.headers as Headers).get("X-Demo-Role")).toBe("STUDENT");
});

it("rejects malformed list responses instead of showing fabricated data", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        response({ quizzes: [{ id: "quiz-1", title: "Quiz" }] }),
      ),
  );
  await expect(studentApi.list()).rejects.toThrow("unexpected data");
});

it("rejects another quiz's data and options containing answer-key fields", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(
      response({
        id: "other",
        title: "Quiz",
        submittedAt: null,
        questions: [],
      }),
    )
    .mockResolvedValueOnce(
      response({
        id: "quiz-1",
        title: "Quiz",
        submittedAt: null,
        questions: [
          {
            id: "q",
            prompt: "Q",
            type: "SINGLE_CHOICE",
            options: [{ id: "o", text: "O", isCorrect: true }],
          },
        ],
      }),
    );
  vi.stubGlobal("fetch", fetchMock);
  await expect(studentApi.detail("quiz-1")).rejects.toThrow("unexpected data");
  await expect(studentApi.detail("quiz-1")).rejects.toThrow("unexpected data");
});

it("does not confirm success for an unexpected submission response", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(response({ success: true })),
  );
  await expect(studentApi.submit("quiz-1", { answers: [] })).rejects.toThrow(
    "unexpected submission receipt",
  );
});

it("preserves backend errors and provides an English submission-unavailable message", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        response(
          { error: { code: "NOT_FOUND", message: "API 路由不存在" } },
          404,
        ),
      ),
  );
  const failure = await studentApi
    .submit("quiz-1", { answers: [] })
    .catch((error: unknown) => error);
  expect(failure).toBeInstanceOf(ApiFetchError);
  expect(studentErrorMessage(failure, "submit")).toContain(
    "submission service is not available yet",
  );
});

it("bounds an unresponsive request and releases the timer", async () => {
  vi.useFakeTimers();
  const fetchMock = vi.fn().mockReturnValue(new Promise(() => {}));
  vi.stubGlobal("fetch", fetchMock);
  const expectation = expect(studentApi.list()).rejects.toThrow(
    "too long to respond",
  );
  await vi.advanceTimersByTimeAsync(15_000);
  await expectation;
  expect(fetchMock.mock.calls[0]?.[1].signal.aborted).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
});

it("also bounds response-body reads and explains an uncertain submission", async () => {
  vi.useFakeTimers();
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue({
        ok: true,
        status: 201,
        text: () => new Promise(() => {}),
      }),
  );
  const expectation = expect(
    studentApi.submit("quiz-1", { answers: [] }),
  ).rejects.toThrow("may already have been received");
  await vi.advanceTimersByTimeAsync(15_000);
  await expectation;
  expect(vi.getTimerCount()).toBe(0);
});

it("preserves caller cancellation and clears the deadline", async () => {
  vi.useFakeTimers();
  const controller = new AbortController();
  const fetchMock = vi.fn().mockReturnValue(new Promise(() => {}));
  vi.stubGlobal("fetch", fetchMock);
  const expectation = expect(
    studentApi.list(controller.signal),
  ).rejects.toMatchObject({ name: "AbortError" });
  controller.abort();
  await expectation;
  expect(fetchMock.mock.calls[0]?.[1].signal.aborted).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
});

it("does not start an already canceled request", async () => {
  const controller = new AbortController();
  controller.abort();
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  await expect(studentApi.list(controller.signal)).rejects.toMatchObject({
    name: "AbortError",
  });
  expect(fetchMock).not.toHaveBeenCalled();
});
