import { CreateQuizRequest, type QuestionType } from "@quiz/shared";

export type OptionDraft = { key: string; text: string; isCorrect: boolean };
export type QuestionDraft = { key: string; prompt: string; type: QuestionType; options: OptionDraft[] };
export type QuizDraft = { title: string; questions: QuestionDraft[] };
export type FieldErrors = Record<string, string>;

export const MIN_OPTIONS = 2;
export const MIN_QUESTIONS = 1;

// Keys only identify rows for React, so they never reach the API.
let nextKey = 0;
const createKey = () => `draft-${nextKey++}`;
const createOption = (): OptionDraft => ({ key: createKey(), text: "", isCorrect: false });
const createQuestion = (): QuestionDraft => ({ key: createKey(), prompt: "", type: "SINGLE_CHOICE", options: [createOption(), createOption()] });
export const createDraft = (): QuizDraft => ({ title: "", questions: [createQuestion()] });

const updateQuestion = (draft: QuizDraft, questionKey: string, change: (question: QuestionDraft) => QuestionDraft): QuizDraft => ({
  ...draft,
  questions: draft.questions.map((question) => question.key === questionKey ? change(question) : question),
});

export const addQuestion = (draft: QuizDraft): QuizDraft => ({ ...draft, questions: [...draft.questions, createQuestion()] });

export function removeQuestion(draft: QuizDraft, questionKey: string): QuizDraft {
  if (draft.questions.length <= MIN_QUESTIONS) return draft;
  return { ...draft, questions: draft.questions.filter((question) => question.key !== questionKey) };
}

export const setPrompt = (draft: QuizDraft, questionKey: string, prompt: string) =>
  updateQuestion(draft, questionKey, (question) => ({ ...question, prompt }));

// A single-choice question can only keep one answer, so the first marked option wins.
export function setQuestionType(draft: QuizDraft, questionKey: string, type: QuestionType): QuizDraft {
  return updateQuestion(draft, questionKey, (question) => {
    if (type === "MULTIPLE_SELECT") return { ...question, type };
    const firstCorrect = question.options.find((option) => option.isCorrect)?.key;
    return { ...question, type, options: question.options.map((option) => ({ ...option, isCorrect: option.key === firstCorrect })) };
  });
}

export const addOption = (draft: QuizDraft, questionKey: string) =>
  updateQuestion(draft, questionKey, (question) => ({ ...question, options: [...question.options, createOption()] }));

export const removeOption = (draft: QuizDraft, questionKey: string, optionKey: string) =>
  updateQuestion(draft, questionKey, (question) => question.options.length <= MIN_OPTIONS
    ? question
    : { ...question, options: question.options.filter((option) => option.key !== optionKey) });

export const setOptionText = (draft: QuizDraft, questionKey: string, optionKey: string, text: string) =>
  updateQuestion(draft, questionKey, (question) => ({
    ...question,
    options: question.options.map((option) => option.key === optionKey ? { ...option, text } : option),
  }));

export const setOptionCorrect = (draft: QuizDraft, questionKey: string, optionKey: string, isCorrect: boolean) =>
  updateQuestion(draft, questionKey, (question) => ({
    ...question,
    options: question.options.map((option) => {
      if (option.key === optionKey) return { ...option, isCorrect };
      return question.type === "SINGLE_CHOICE" ? { ...option, isCorrect: false } : option;
    }),
  }));

export const toCreateRequest = (draft: QuizDraft): CreateQuizRequest => ({
  title: draft.title,
  questions: draft.questions.map(({ prompt, type, options }) => ({
    prompt,
    type,
    options: options.map(({ text, isCorrect }) => ({ text, isCorrect })),
  })),
});

// The API reports the same field paths as the shared schema, so one mapping covers
// both. Paths decide the wording, which keeps this page in English whatever the
// schema or server message says.
function describeField(path: string, draft: QuizDraft): string {
  if (path === "title") return "Add a quiz title.";
  if (path === "questions") return "Add at least one question.";
  const [, questionIndex, field, , optionField] = path.split(".");
  const question = draft.questions[Number(questionIndex)];
  if (field === "prompt") return "Add the question text.";
  if (field === "options" && optionField === "text") return "Add the option text.";
  if (field === "options" && question && question.options.length < MIN_OPTIONS) return "Add at least two options.";
  if (field === "options") return question?.type === "SINGLE_CHOICE" ? "Mark exactly one correct option." : "Mark at least one correct option.";
  return "Check this field and try again.";
}

export function describeFields(paths: string[], draft: QuizDraft): FieldErrors {
  return Object.fromEntries(paths.map((path) => [path, describeField(path, draft)]));
}

export function validateDraft(draft: QuizDraft): FieldErrors {
  const result = CreateQuizRequest.safeParse(toCreateRequest(draft));
  if (result.success) return {};
  return describeFields(result.error.issues.map((issue) => issue.path.join(".")), draft);
}
