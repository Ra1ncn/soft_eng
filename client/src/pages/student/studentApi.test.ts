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

it("preserves backend errors and explains that a missing quiz keeps the answers", async () => {
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
  expect(studentErrorMessage(failure, "submit")).toBe(
    "This quiz is no longer available. Your answers are still here.",
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

const openQuiz = {
  id: "quiz-1",
  title: "Latest quiz title",
  submittedAt: null,
  questions: [],
};
const savedReceipt = {
  submissionId: "submission-1",
  submittedAt: "2026-11-04T18:00:00.000Z",
};

it("returns the latest submitted detail without posting stale answers", async () => {
  const quiz = { ...openQuiz, submittedAt: savedReceipt.submittedAt };
  const fetchMock = vi.fn().mockResolvedValue(response(quiz));
  vi.stubGlobal("fetch", fetchMock);

  await expect(
    studentApi.submitIfUnsubmitted("quiz-1", { answers: [] }),
  ).resolves.toEqual({ kind: "already-submitted", quiz });
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/quizzes/quiz-1");
  expect(fetchMock.mock.calls[0]?.[1].method).toBeUndefined();
});

it("checks the latest detail before posting and returns the validated receipt", async () => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(response(openQuiz))
    .mockResolvedValueOnce(response(savedReceipt, 201));
  vi.stubGlobal("fetch", fetchMock);
  const payload = { answers: [{ questionId: "q1", optionIds: ["o1"] }] };

  await expect(
    studentApi.submitIfUnsubmitted("quiz-1", payload),
  ).resolves.toEqual({ kind: "saved", receipt: savedReceipt });
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/quizzes/quiz-1");
  expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/quizzes/quiz-1/submissions");
  const options = fetchMock.mock.calls[1]?.[1];
  expect(options.method).toBe("POST");
  expect(JSON.parse(options.body)).toEqual(payload);
  expect((options.headers as Headers).get("X-Demo-Role")).toBe("STUDENT");
});

it.each(["network", "404", "invalid detail"])(
  "does not post when the precheck fails: %s",
  async (failure) => {
    const fetchMock = vi.fn();
    if (failure === "network") fetchMock.mockRejectedValue(new TypeError("offline"));
    else if (failure === "404") fetchMock.mockResolvedValue(response({
      error: { code: "NOT_FOUND", message: "Quiz not found" },
    }, 404));
    else fetchMock.mockResolvedValue(response({ ...openQuiz, id: "another-quiz" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      studentApi.submitIfUnsubmitted("quiz-1", { answers: [] }),
    ).rejects.toBeInstanceOf(Error);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[1].method).toBeUndefined();
  },
);

it("does not precheck or post an already canceled submission", async () => {
  const controller = new AbortController();
  controller.abort();
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  await expect(
    studentApi.submitIfUnsubmitted("quiz-1", { answers: [] }, controller.signal),
  ).rejects.toMatchObject({ name: "AbortError" });
  expect(fetchMock).not.toHaveBeenCalled();
});

it.each(["precheck", "post"])(
  "cancels the %s stage and clears its deadline",
  async (stage) => {
    vi.useFakeTimers();
    const controller = new AbortController();
    let markStarted!: () => void;
    const started = new Promise<void>((resolve) => { markStarted = resolve; });
    const fetchMock = vi.fn();
    if (stage === "post") fetchMock.mockResolvedValueOnce(response(openQuiz));
    fetchMock.mockImplementationOnce(() => {
      markStarted();
      return new Promise(() => {});
    });
    vi.stubGlobal("fetch", fetchMock);
    const expectation = expect(
      studentApi.submitIfUnsubmitted("quiz-1", { answers: [] }, controller.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
    await started;
    controller.abort();
    await expectation;
    const calls = fetchMock.mock.calls;
    expect(calls).toHaveLength(stage === "precheck" ? 1 : 2);
    expect(calls.at(-1)?.[1].signal.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  },
);

it.each(["precheck", "post"])(
  "bounds %s response-body reads and stops subsequent work",
  async (stage) => {
    vi.useFakeTimers();
    const fetchMock = vi.fn();
    if (stage === "post") fetchMock.mockResolvedValueOnce(response(openQuiz));
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: stage === "precheck" ? 200 : 201,
      text: () => new Promise(() => {}),
    });
    vi.stubGlobal("fetch", fetchMock);
    const expectation = expect(
      studentApi.submitIfUnsubmitted("quiz-1", { answers: [] }),
    ).rejects.toThrow(stage === "precheck" ? "too long to respond" : "may already have been received");
    await vi.advanceTimersByTimeAsync(15_000);
    await expectation;
    const calls = fetchMock.mock.calls;
    expect(calls).toHaveLength(stage === "precheck" ? 1 : 2);
    expect(calls.at(-1)?.[1].signal.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  },
);
