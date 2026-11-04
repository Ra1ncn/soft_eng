import { useEffect, useRef, useState, type FormEvent } from "react";
import { useParams } from "react-router";
import type { QuizDetailResponse, SubmitResponse } from "@quiz/shared";
import {
  AnswerOption,
  Button,
  ButtonLink,
  Card,
  Icon,
  StatusBadge,
} from "../../components/ui/index.ts";
import { studentApi, studentErrorMessage } from "./studentApi.ts";
import {
  answeredCount,
  restoreAnswers,
  toSubmitRequest,
  toggleAnswer,
  type Answers,
} from "./quizAnswers.ts";
import { demoFooter, formatSubmittedAt } from "./StudentPage.tsx";
import entryStyles from "../EntryPage.module.css";
import styles from "./StudentPage.module.css";

// The foundation has one fixed demo student. Keep drafts per tab and validate them
// against fresh question/option IDs; this is not a server submission record.
const draftKey = (id: string) => `quiz-studio:student-demo:draft:v1:${id}`;

function moveToQuestion(index: number) {
  const target = document.getElementById(`student-question-${index}`);
  target?.scrollIntoView({
    block: "start",
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth",
  });
  target?.focus({ preventScroll: true });
}

function SubmitDialog({
  count,
  total,
  submitting,
  onCancel,
  onSubmit,
}: {
  count: number;
  total: number;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-labelledby="student-submit-title"
      aria-describedby="student-submit-description"
      onCancel={(event) => {
        event.preventDefault();
        if (!submitting) onCancel();
      }}
    >
      <div className={styles.stack}>
        <span className={styles.symbol}>
          <Icon name="arrow" />
        </span>
        <h2 id="student-submit-title">Ready to send your answers?</h2>
        <p id="student-submit-description" className={styles.hint}>
          You’ve answered {count} of {total} questions. Each quiz accepts one
          submission, so take a moment to review.
        </p>
        {count < total && (
          <StatusBadge status="warning">
            {total - count}{" "}
            {total - count === 1 ? "question is" : "questions are"} unanswered
          </StatusBadge>
        )}
        <div className={styles.actions}>
          <Button
            variant="secondary"
            onClick={onCancel}
            disabled={submitting}
            autoFocus
          >
            Keep reviewing
          </Button>
          <Button
            onClick={onSubmit}
            loading={submitting}
            loadingLabel="Submitting…"
            disabled={submitting}
          >
            Submit answers <Icon name="arrow" />
          </Button>
        </div>
      </div>
    </dialog>
  );
}

function SubmittedState({
  quiz,
  receipt,
}: {
  quiz: QuizDetailResponse;
  receipt?: SubmitResponse;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
    window.scrollTo({ top: 0 });
  }, []);
  const submittedAt = receipt?.submittedAt ?? quiz.submittedAt!;
  return (
    <>
      <header className={entryStyles.header}>
        <p className={entryStyles.eyebrow}>Student space</p>
        <h1 ref={heading} tabIndex={-1}>
          {receipt ? "Your answers are in." : "You’ve done this one."}
        </h1>
        <p className={entryStyles.lead}>
          {receipt
            ? "A little progress, safely saved. Thanks for taking the time."
            : "Your submission is saved. Each quiz accepts one submission."}
        </p>
      </header>
      <Card className={styles.stateCard}>
        <div>
          <StatusBadge status="success">Submitted successfully</StatusBadge>
        </div>
        <h2>{quiz.title}</h2>
        <dl className={styles.receipt}>
          <div>
            <dt>Submitted</dt>
            <dd>{formatSubmittedAt(submittedAt)}</dd>
          </div>
          {receipt && (
            <div>
              <dt>Submission ID</dt>
              <dd>
                <code>{receipt.submissionId}</code>
              </dd>
            </div>
          )}
        </dl>
        <div className={styles.actions}>
          <ButtonLink to="/student">
            Back to quizzes <Icon name="arrow" />
          </ButtonLink>
        </div>
      </Card>
      {demoFooter}
    </>
  );
}

function QuizSession({ id }: { id: string }) {
  const [quiz, setQuiz] = useState<QuizDetailResponse | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [loadError, setLoadError] = useState("");
  const [draftAvailable, setDraftAvailable] = useState(true);
  const [submitError, setSubmitError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<SubmitResponse | null>(null);
  const [refresh, setRefresh] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const submitButton = useRef<HTMLButtonElement>(null);
  const inFlight = useRef(false);
  const submitController = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoadError("");
    setQuiz(null);
    studentApi
      .detail(id, controller.signal)
      .then((loaded) => {
        if (controller.signal.aborted) return;
        let restored: Answers = {};
        try {
          if (loaded.submittedAt) sessionStorage.removeItem(draftKey(id));
          else
            restored = restoreAnswers(
              loaded,
              JSON.parse(sessionStorage.getItem(draftKey(id)) || "{}"),
            );
        } catch {
          setDraftAvailable(false);
        }
        setAnswers(restored);
        setQuiz(loaded);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setLoadError(studentErrorMessage(error));
      });
    return () => controller.abort();
  }, [id, refresh]);

  useEffect(() => {
    if (quiz && !quiz.submittedAt) {
      window.scrollTo({ top: 0 });
      heading.current?.focus({ preventScroll: true });
    }
  }, [quiz]);
  useEffect(() => {
    if (!quiz || quiz.submittedAt || receipt) return;
    try {
      sessionStorage.setItem(draftKey(id), JSON.stringify(answers));
    } catch {
      setDraftAvailable(false);
    }
  }, [answers, id, quiz, receipt]);
  useEffect(() => {
    if (submitError && !confirming) errorRef.current?.focus();
  }, [submitError, confirming]);
  useEffect(() => () => submitController.current?.abort(), []);

  async function submit() {
    if (!quiz || inFlight.current || quiz.submittedAt) return;
    const controller = new AbortController();
    submitController.current = controller;
    inFlight.current = true;
    setSubmitting(true);
    setSubmitError("");
    try {
      const saved = await studentApi.submit(
        id,
        toSubmitRequest(quiz, answers),
        controller.signal,
      );
      if (controller.signal.aborted) return;
      setReceipt(saved);
      try {
        sessionStorage.removeItem(draftKey(id));
      } catch {
        /* Server receipt already confirmed. */
      }
    } catch (error) {
      if (!controller.signal.aborted)
        setSubmitError(studentErrorMessage(error, "submit"));
    } finally {
      if (!controller.signal.aborted) {
        setSubmitting(false);
        setConfirming(false);
      }
      inFlight.current = false;
    }
  }

  if (loadError)
    return (
      <>
        <header className={entryStyles.header}>
          <p className={entryStyles.eyebrow}>Student space</p>
          <h1>A small pause.</h1>
          <p className={entryStyles.lead}>{loadError}</p>
        </header>
        <Card className={styles.stateCard} role="alert">
          <StatusBadge status="error">Unable to load quiz</StatusBadge>
          <div className={styles.actions}>
            <Button onClick={() => setRefresh((value) => value + 1)}>
              Try again
            </Button>
            <ButtonLink to="/student" variant="secondary">
              Back to quizzes
            </ButtonLink>
          </div>
        </Card>
        {demoFooter}
      </>
    );
  if (!quiz)
    return (
      <Card className={styles.loading} role="status">
        <Icon name="book" />
        <p>Opening your quiz…</p>
      </Card>
    );
  if (receipt || quiz.submittedAt)
    return <SubmittedState quiz={quiz} receipt={receipt ?? undefined} />;

  const count = answeredCount(quiz, answers);
  function requestConfirmation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!submitting) setConfirming(true);
  }

  return (
    <>
      <header className={entryStyles.header}>
        <p className={entryStyles.eyebrow}>Student space</p>
        <h1 ref={heading} tabIndex={-1}>
          {quiz.title}
        </h1>
        <p className={entryStyles.lead}>
          Take your time. Choose one answer for single-choice questions, or
          every option that applies for multiple-select questions.
        </p>
      </header>
      {quiz.questions.length === 0 ? (
        <Card className={styles.stateCard}>
          <h2>No questions here yet.</h2>
          <p>This quiz doesn’t contain any questions to answer.</p>
          <div>
            <ButtonLink to="/student" variant="secondary">
              Back to quizzes
            </ButtonLink>
          </div>
        </Card>
      ) : (
        <div className={styles.answerLayout}>
          <nav className={styles.questionNav} aria-label="Quiz questions">
            <p>Questions</p>
            <div>
              {quiz.questions.map((question, index) => (
                <button
                  type="button"
                  key={question.id}
                  onClick={() => moveToQuestion(index)}
                  className={
                    answers[question.id]?.length ? styles.answered : ""
                  }
                  aria-label={`Question ${index + 1}, ${answers[question.id]?.length ? "answered" : "unanswered"}`}
                >
                  {index + 1}
                  {!!answers[question.id]?.length && <Icon name="check" />}
                </button>
              ))}
            </div>
          </nav>
          <form className={styles.stack} onSubmit={requestConfirmation}>
            <Card className={styles.progressCard}>
              <div>
                <h2>Your progress</h2>
                <p className={styles.hint} aria-live="polite">
                  {count} of {quiz.questions.length} questions answered
                </p>
              </div>
              <div
                className={styles.progress}
                role="progressbar"
                aria-label="Questions answered"
                aria-valuenow={count}
                aria-valuemin={0}
                aria-valuemax={quiz.questions.length}
              >
                <span
                  style={{ width: `${(count / quiz.questions.length) * 100}%` }}
                />
              </div>
            </Card>
            {quiz.questions.map((question, index) => (
              <Card
                className={styles.questionCard}
                id={`student-question-${index}`}
                key={question.id}
                tabIndex={-1}
              >
                <fieldset className={styles.group} disabled={submitting}>
                  <legend className={styles.visuallyHidden}>
                    Question {index + 1}: {question.prompt}
                  </legend>
                  <div className={styles.cardHeading}>
                    <h2>{index + 1}.</h2>
                    <StatusBadge status="neutral">
                      {question.type === "SINGLE_CHOICE"
                        ? "Single choice"
                        : "Multiple select"}
                    </StatusBadge>
                  </div>
                  <h3 className={styles.prompt}>{question.prompt}</h3>
                  <p className={styles.hint}>
                    {question.type === "SINGLE_CHOICE"
                      ? "Choose one answer."
                      : "Choose all that apply."}
                  </p>
                  <div className={styles.options}>
                    {question.options.map((option) => (
                      <AnswerOption
                        key={option.id}
                        type={
                          question.type === "SINGLE_CHOICE"
                            ? "radio"
                            : "checkbox"
                        }
                        name={`student-${question.id}`}
                        value={option.id}
                        label={option.text}
                        checked={
                          answers[question.id]?.includes(option.id) ?? false
                        }
                        onChange={() => {
                          setSubmitError("");
                          setAnswers((current) =>
                            toggleAnswer(current, question, option.id),
                          );
                        }}
                      />
                    ))}
                  </div>
                  {!!answers[question.id]?.length && (
                    <div>
                      <Button
                        variant="secondary"
                        aria-label={`Clear answer for question ${index + 1}`}
                        onClick={() =>
                          setAnswers((current) => ({
                            ...current,
                            [question.id]: [],
                          }))
                        }
                      >
                        Clear selection
                      </Button>
                    </div>
                  )}
                </fieldset>
              </Card>
            ))}
            <div className={styles.formFooter}>
              {submitError && (
                <div
                  ref={errorRef}
                  className={styles.error}
                  role="alert"
                  tabIndex={-1}
                >
                  {submitError}
                </div>
              )}
              <p className={styles.hint}>
                {draftAvailable
                  ? "Your draft is kept in this tab until you submit. Each quiz accepts one submission."
                  : "Draft saving is unavailable. Keep this page open until you submit."}
              </p>
              <div className={`${styles.actions} ${styles.formActions}`}>
                <ButtonLink to="/student" variant="secondary">
                  Back to quizzes
                </ButtonLink>
                <Button
                  ref={submitButton}
                  type="submit"
                  loading={submitting}
                  loadingLabel="Submitting…"
                >
                  Submit answers <Icon name="arrow" />
                </Button>
              </div>
            </div>
          </form>
        </div>
      )}
      {confirming && (
        <SubmitDialog
          count={count}
          total={quiz.questions.length}
          submitting={submitting}
          onCancel={() => {
            setConfirming(false);
            requestAnimationFrame(() => submitButton.current?.focus());
          }}
          onSubmit={() => void submit()}
        />
      )}
      {demoFooter}
    </>
  );
}

export function StudentQuizPage() {
  const { quizId } = useParams<{ quizId: string }>();
  return <QuizSession key={quizId} id={quizId ?? ""} />;
}
