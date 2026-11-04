import { describe, expect, it } from "vitest";
import type { QuizDetailResponse } from "@quiz/shared";
import {
  answeredCount,
  restoreAnswers,
  toggleAnswer,
  toSubmitRequest,
} from "./quizAnswers.ts";

const quiz: QuizDetailResponse = {
  id: "quiz-demo",
  title: "Practice",
  submittedAt: null,
  questions: [
    {
      id: "single",
      prompt: "Choose one",
      type: "SINGLE_CHOICE",
      options: [
        { id: "a", text: "A" },
        { id: "b", text: "B" },
      ],
    },
    {
      id: "multiple",
      prompt: "Choose several",
      type: "MULTIPLE_SELECT",
      options: [
        { id: "c", text: "C" },
        { id: "d", text: "D" },
      ],
    },
  ],
};

describe("quiz answer selection", () => {
  it("replaces the previous radio selection without mutating other answers", () => {
    const before = { single: ["a"], multiple: ["c"] };
    expect(toggleAnswer(before, quiz.questions[0]!, "b")).toEqual({
      single: ["b"],
      multiple: ["c"],
    });
    expect(before).toEqual({ single: ["a"], multiple: ["c"] });
  });
  it("adds and removes multiple-select choices independently", () => {
    const both = toggleAnswer({ multiple: ["c"] }, quiz.questions[1]!, "d");
    expect(both.multiple).toEqual(["c", "d"]);
    expect(toggleAnswer(both, quiz.questions[1]!, "c").multiple).toEqual(["d"]);
  });
  it("ignores an option belonging to another question", () => {
    const before = { single: ["a"] };
    expect(toggleAnswer(before, quiz.questions[0]!, "c")).toBe(before);
  });
  it("restores only known questions/options, removing duplicates and extra radio choices", () => {
    expect(
      restoreAnswers(quiz, {
        single: ["missing", "b", "a", "b"],
        multiple: ["c", "d", "c", "a", 42],
        stale: ["old"],
      }),
    ).toEqual({ single: ["b"], multiple: ["c", "d"] });
  });
  it.each([null, "not JSON data", [], { single: "a", multiple: ["unknown"] }])(
    "ignores malformed stored draft %#",
    (raw) => {
      expect(restoreAnswers(quiz, raw)).toEqual({});
    },
  );
  it("does not restore inherited prototype entries", () => {
    expect(restoreAnswers(quiz, Object.create({ single: ["a"] }))).toEqual({});
  });
  it("uses optionIds from the shared contract and includes unanswered questions", () => {
    expect(toSubmitRequest(quiz, { single: ["a"], stale: ["c"] })).toEqual({
      answers: [
        { questionId: "single", optionIds: ["a"] },
        { questionId: "multiple", optionIds: [] },
      ],
    });
  });
  it("counts answered questions rather than options or stale entries", () => {
    expect(
      answeredCount(quiz, {
        single: ["foreign"],
        multiple: ["c", "d"],
        stale: ["a"],
      }),
    ).toBe(1);
  });
});
