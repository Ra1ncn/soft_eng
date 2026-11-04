import { SubmitRequest, type QuizDetailResponse } from "@quiz/shared";

export type Answers = Record<string, string[]>;
type Question = QuizDetailResponse["questions"][number];

function validSelection(question: Question, raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const available = new Set(question.options.map((option) => option.id));
  const unique = [
    ...new Set(
      raw.filter(
        (id): id is string => typeof id === "string" && available.has(id),
      ),
    ),
  ];
  return question.type === "SINGLE_CHOICE" ? unique.slice(0, 1) : unique;
}

export function toggleAnswer(
  current: Answers,
  question: Question,
  optionId: string,
): Answers {
  if (!question.options.some((option) => option.id === optionId))
    return current;
  const existing = validSelection(question, current[question.id]);
  const next =
    question.type === "SINGLE_CHOICE"
      ? [optionId]
      : existing.includes(optionId)
        ? existing.filter((id) => id !== optionId)
        : [...existing, optionId];
  return { ...current, [question.id]: next };
}

/** Only the current quiz's valid IDs survive a stale or malformed stored draft. */
export function restoreAnswers(
  quiz: QuizDetailResponse,
  raw: unknown,
): Answers {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const stored = raw as Record<string, unknown>;
  return Object.fromEntries(
    quiz.questions.flatMap((question) => {
      const selected = validSelection(
        question,
        Object.hasOwn(stored, question.id) ? stored[question.id] : undefined,
      );
      return selected.length ? [[question.id, selected]] : [];
    }),
  );
}

export function toSubmitRequest(
  quiz: QuizDetailResponse,
  answers: Answers,
): SubmitRequest {
  const valid = restoreAnswers(quiz, answers);
  return SubmitRequest.parse({
    answers: quiz.questions.map((question) => ({
      questionId: question.id,
      optionIds: valid[question.id] ?? [],
    })),
  });
}

export function answeredCount(
  quiz: QuizDetailResponse,
  answers: Answers,
): number {
  return Object.keys(restoreAnswers(quiz, answers)).length;
}
