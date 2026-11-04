import { describe, expect, it } from "vitest";
import { CreateQuizRequest } from "@quiz/shared";
import {
  addOption, addQuestion, createDraft, describeFields, questionHasError, removeOption, removeQuestion, setOptionCorrect,
  setOptionText, setPrompt, setQuestionType, toCreateRequest, validateDraft, type QuizDraft,
} from "./quizDraft.ts";

function validDraft(): QuizDraft {
  let draft = { ...createDraft(), title: "Database basics" };
  const question = draft.questions[0]!;
  draft = setPrompt(draft, question.key, "Which key identifies a row?");
  draft = setOptionText(draft, question.key, question.options[0]!.key, "Primary key");
  draft = setOptionText(draft, question.key, question.options[1]!.key, "Index");
  return setOptionCorrect(draft, question.key, question.options[0]!.key, true);
}
const correctFlags = (draft: QuizDraft, index = 0) => draft.questions[index]!.options.map((option) => option.isCorrect);

describe("draft structure", () => {
  it("starts with one single-choice question and two empty options", () => {
    const { questions } = createDraft();
    expect(questions).toHaveLength(1);
    expect(questions[0]).toMatchObject({ prompt: "", type: "SINGLE_CHOICE" });
    expect(questions[0]!.options).toHaveLength(2);
  });

  it("gives every row a unique key", () => {
    const draft = addQuestion(createDraft());
    const keys = draft.questions.flatMap((question) => [question.key, ...question.options.map((option) => option.key)]);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("removes questions but keeps the last one", () => {
    const draft = addQuestion(createDraft());
    const one = removeQuestion(draft, draft.questions[0]!.key);
    expect(one.questions).toEqual([draft.questions[1]]);
    expect(removeQuestion(one, one.questions[0]!.key)).toBe(one);
  });

  it("removes options but keeps at least two", () => {
    const draft = createDraft();
    const question = draft.questions[0]!;
    expect(removeOption(draft, question.key, question.options[0]!.key).questions[0]!.options).toHaveLength(2);
    const three = addOption(draft, question.key);
    const two = removeOption(three, question.key, question.options[0]!.key);
    expect(two.questions[0]!.options.map((option) => option.key)).not.toContain(question.options[0]!.key);
    expect(two.questions[0]!.options).toHaveLength(2);
  });

  it("only changes the targeted question", () => {
    const draft = addQuestion(createDraft());
    const next = setPrompt(draft, draft.questions[1]!.key, "Second");
    expect(next.questions[0]).toBe(draft.questions[0]);
    expect(next.questions[1]!.prompt).toBe("Second");
  });
});

describe("correct answers", () => {
  it("allows one correct option on single choice", () => {
    let draft = createDraft();
    const { key, options } = draft.questions[0]!;
    draft = setOptionCorrect(draft, key, options[0]!.key, true);
    draft = setOptionCorrect(draft, key, options[1]!.key, true);
    expect(correctFlags(draft)).toEqual([false, true]);
  });

  it("allows several correct options on multiple select and can unmark them", () => {
    let draft = createDraft();
    const { key, options } = draft.questions[0]!;
    draft = setQuestionType(draft, key, "MULTIPLE_SELECT");
    draft = setOptionCorrect(draft, key, options[0]!.key, true);
    draft = setOptionCorrect(draft, key, options[1]!.key, true);
    expect(correctFlags(draft)).toEqual([true, true]);
    expect(correctFlags(setOptionCorrect(draft, key, options[0]!.key, false))).toEqual([false, true]);
  });

  it("keeps only the first correct option when switching to single choice", () => {
    let draft = createDraft();
    const { key } = draft.questions[0]!;
    draft = addOption(setQuestionType(draft, key, "MULTIPLE_SELECT"), key);
    const options = draft.questions[0]!.options;
    draft = setOptionCorrect(draft, key, options[1]!.key, true);
    draft = setOptionCorrect(draft, key, options[2]!.key, true);
    expect(correctFlags(setQuestionType(draft, key, "SINGLE_CHOICE"))).toEqual([false, true, false]);
  });

  it("keeps correct options when switching to multiple select", () => {
    const draft = validDraft();
    expect(correctFlags(setQuestionType(draft, draft.questions[0]!.key, "MULTIPLE_SELECT"))).toEqual([true, false]);
  });
});

describe("validation", () => {
  it("accepts a complete draft", () => {
    expect(validateDraft(validDraft())).toEqual({});
  });

  it("reports every empty field on a new draft in English", () => {
    const draft = createDraft();
    expect(validateDraft(draft)).toEqual({
      title: "Add a quiz title.",
      "questions.0.prompt": "Add the question text.",
      "questions.0.options.0.text": "Add the option text.",
      "questions.0.options.1.text": "Add the option text.",
      "questions.0.options": "Mark exactly one correct option.",
    });
  });

  it("treats whitespace as empty", () => {
    expect(validateDraft({ ...validDraft(), title: "   " })).toEqual({ title: "Add a quiz title." });
  });

  it("asks multiple select for at least one correct option", () => {
    let draft = validDraft();
    const { key, options } = draft.questions[0]!;
    draft = setOptionCorrect(setQuestionType(draft, key, "MULTIPLE_SELECT"), key, options[0]!.key, false);
    expect(validateDraft(draft)).toEqual({ "questions.0.options": "Mark at least one correct option." });
  });

  it("uses the current position after a question is removed", () => {
    const draft = addQuestion(validDraft());
    expect(Object.keys(validateDraft(draft))).toContain("questions.1.prompt");
    const remaining = removeQuestion(draft, draft.questions[0]!.key);
    const errors = Object.keys(validateDraft(remaining));
    expect(errors).toContain("questions.0.prompt");
    expect(errors).not.toContain("questions.1.prompt");
  });

  it("keeps server field paths and replaces their wording", () => {
    expect(describeFields(["title", "questions.0.options", "questions.0.options.1.text", "unknown"], validDraft())).toEqual({
      title: "Add a quiz title.",
      "questions.0.options": "Mark exactly one correct option.",
      "questions.0.options.1.text": "Add the option text.",
      unknown: "Check this field and try again.",
    });
  });
});

describe("questionHasError", () => {
  it("matches errors on the question and its options only", () => {
    const errors = { title: "x", "questions.1.prompt": "x", "questions.2.options": "x", "questions.3.options.0.text": "x" };
    expect([0, 1, 2, 3].map((index) => questionHasError(errors, index))).toEqual([false, true, true, true]);
  });

  it("does not confuse question 1 with question 10", () => {
    expect(questionHasError({ "questions.10.prompt": "x" }, 1)).toBe(false);
  });

  it("ignores the title and the question list", () => {
    expect(questionHasError({ title: "x", questions: "x" }, 0)).toBe(false);
  });
});

describe("request body", () => {
  it("drops draft-only keys and matches the shared contract", () => {
    const body = toCreateRequest(validDraft());
    expect(CreateQuizRequest.parse(body)).toEqual({
      title: "Database basics",
      questions: [{
        prompt: "Which key identifies a row?",
        type: "SINGLE_CHOICE",
        options: [{ text: "Primary key", isCorrect: true }, { text: "Index", isCorrect: false }],
      }],
    });
    expect(JSON.stringify(body)).not.toContain("draft-");
  });
});
