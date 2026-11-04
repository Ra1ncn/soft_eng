import {
  QuizDetailResponse,
  QuizListResponse,
  SubmitRequest,
  SubmitResponse,
} from "@quiz/shared";
import { apiFetch, ApiFetchError } from "../../lib/apiFetch.ts";

const REQUEST_TIMEOUT_MS = 15_000;

class StudentRequestError extends Error {}

function canceled(signal: AbortSignal): Error {
  return signal.reason instanceof Error
    ? signal.reason
    : new DOMException("The request was canceled.", "AbortError");
}

/** The deadline also covers reading the response body inside apiFetch. */
async function bounded<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  caller?: AbortSignal,
  submitting = false,
): Promise<T> {
  if (caller?.aborted) throw canceled(caller);

  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let abort: (() => void) | undefined;
  const interrupted = new Promise<never>((_resolve, reject) => {
    abort = () => {
      controller.abort(caller?.reason);
      reject(canceled(caller!));
    };
    caller?.addEventListener("abort", abort, { once: true });
    timeout = setTimeout(() => {
      const failure = new StudentRequestError(
        submitting
          ? "Your submission response was not confirmed in time. Your answers may already have been received; check before submitting again."
          : "The quiz service took too long to respond. Please try again.",
      );
      // Reject first so a fetch AbortError cannot hide the useful timeout message.
      reject(failure);
      controller.abort(failure);
    }, REQUEST_TIMEOUT_MS);
  });

  try {
    return await Promise.race([operation(controller.signal), interrupted]);
  } finally {
    clearTimeout(timeout);
    if (abort) caller?.removeEventListener("abort", abort);
  }
}

function invalidResponse(submitting = false) {
  return new StudentRequestError(
    submitting
      ? "The service returned an unexpected submission receipt. Your answers may already have been saved; check before submitting again."
      : "The quiz service returned unexpected data. Please try again.",
  );
}

export const studentApi = {
  list(signal?: AbortSignal): Promise<QuizListResponse> {
    return bounded(async (requestSignal) => {
      const raw = await apiFetch<unknown>("/api/quizzes", "STUDENT", {
        signal: requestSignal,
      });
      const parsed = QuizListResponse.safeParse(raw);
      if (!parsed.success) throw invalidResponse();
      return parsed.data;
    }, signal);
  },

  detail(id: string, signal?: AbortSignal): Promise<QuizDetailResponse> {
    return bounded(async (requestSignal) => {
      const raw = await apiFetch<unknown>(
        `/api/quizzes/${encodeURIComponent(id)}`,
        "STUDENT",
        { signal: requestSignal },
      );
      const parsed = QuizDetailResponse.safeParse(raw);
      if (!parsed.success || parsed.data.id !== id) throw invalidResponse();
      return parsed.data;
    }, signal);
  },

  submit(
    id: string,
    body: SubmitRequest,
    signal?: AbortSignal,
  ): Promise<SubmitResponse> {
    const payload = SubmitRequest.parse(body);
    return bounded(
      async (requestSignal) => {
        const raw = await apiFetch<unknown>(
          `/api/quizzes/${encodeURIComponent(id)}/submissions`,
          "STUDENT",
          {
            method: "POST",
            body: JSON.stringify(payload),
            signal: requestSignal,
          },
        );
        const parsed = SubmitResponse.safeParse(raw);
        if (!parsed.success) throw invalidResponse(true);
        return parsed.data;
      },
      signal,
      true,
    );
  },
};

/** Keep technical or backend-language errors out of the English student interface. */
export function studentErrorMessage(
  error: unknown,
  action: "load" | "submit" = "load",
): string {
  if (error instanceof ApiFetchError) {
    if (error.status === 403)
      return "Student access is unavailable. Please check the demo student setup and try again.";
    if (error.status === 404)
      return action === "submit"
        ? "The submission service is not available yet. Your answers are still here. Please try again later."
        : "This quiz is not available. Return to your quizzes or try again.";
    if (error.status === 400)
      return "Some answers could not be accepted. Review your selections and try again.";
    return "The quiz service is unavailable. Please try again in a moment.";
  }
  if (error instanceof StudentRequestError) return error.message;
  return action === "submit"
    ? "We could not confirm your submission. Your answers are still here; check your connection and try again."
    : "We could not load your quizzes. Check your connection and try again.";
}
