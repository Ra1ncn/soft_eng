import { useEffect, useState } from "react";
import type { QuizListResponse } from "@quiz/shared";
import {
  Button,
  ButtonLink,
  Card,
  Icon,
  StatusBadge,
  TextInput,
} from "../../components/ui/index.ts";
import { studentApi, studentErrorMessage } from "./studentApi.ts";
import entryStyles from "../EntryPage.module.css";
import styles from "./StudentPage.module.css";

export function formatSubmittedAt(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export const demoFooter = (
  <p className={entryStyles.detail}>
    Demo space · Real sign-in is not connected yet.
  </p>
);

export function StudentPage() {
  const [data, setData] = useState<QuizListResponse | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => { window.scrollTo({ top: 0 }); }, []);

  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError("");
    studentApi
      .list(controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setData(result);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setError(studentErrorMessage(error));
      });
    return () => controller.abort();
  }, [refresh]);

  const filtered = data?.quizzes.filter((quiz) =>
    quiz.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  );

  return (
    <>
      <header className={entryStyles.header}>
        <p className={entryStyles.eyebrow}>Student space</p>
        <h1>
          A fresh question.
          <br />A new perspective.
        </h1>
        <p className={entryStyles.lead}>
          Choose a quiz, explore the questions, and send your answers when
          you’re ready.
        </p>
      </header>
      <section className={styles.stack} aria-labelledby="student-quizzes-title">
        <div className={styles.listToolbar}>
          <div>
            <h2 id="student-quizzes-title" className={styles.sectionTitle}>
              Your quizzes
            </h2>
            <p className={styles.hint}>
              {data
                ? `${data.quizzes.length} ${data.quizzes.length === 1 ? "quiz" : "quizzes"} available in your workspace.`
                : "A little room for learning."}
            </p>
          </div>
          <Button
            variant="secondary"
            onClick={() => setRefresh((value) => value + 1)}
            loading={!data && !error}
            loadingLabel="Loading quizzes…"
          >
            Refresh quizzes
          </Button>
        </div>
        {data && data.quizzes.length > 0 && (
          <div className={styles.search}>
            <TextInput
              type="search"
              label="Find a quiz"
              placeholder="Search by title"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        )}
        {error ? (
          <Card className={styles.stateCard} role="alert">
            <StatusBadge status="error">Unable to load quizzes</StatusBadge>
            <h2>Let’s try that again.</h2>
            <p>{error}</p>
            <div>
              <Button onClick={() => setRefresh((value) => value + 1)}>
                Try again
              </Button>
            </div>
          </Card>
        ) : !data ? (
          <Card className={styles.loading} role="status">
            <Icon name="book" />
            <p>Finding your quizzes…</p>
          </Card>
        ) : data.quizzes.length === 0 ? (
          <Card className={styles.stateCard}>
            <span className={styles.symbol}>
              <Icon name="book" />
            </span>
            <h2>A little space for what’s next.</h2>
            <p>Your teacher’s quizzes will appear here when they are saved.</p>
          </Card>
        ) : filtered?.length === 0 ? (
          <Card className={styles.stateCard}>
            <h2>No quizzes found.</h2>
            <p>Try another title or clear your search.</p>
            <div>
              <Button variant="secondary" onClick={() => setQuery("")}>
                Clear search
              </Button>
            </div>
          </Card>
        ) : (
          <div className={styles.stack}>
            {filtered?.map((quiz) => (
              <Card className={styles.quizCard} key={quiz.id}>
                <span className={styles.symbol}>
                  <Icon name="book" />
                </span>
                <div className={styles.quizCopy}>
                  <h2>{quiz.title}</h2>
                  <p className={styles.hint}>
                    {quiz.questionCount}{" "}
                    {quiz.questionCount === 1 ? "question" : "questions"}
                    {quiz.submittedAt && (
                      <> · Submitted {formatSubmittedAt(quiz.submittedAt)}</>
                    )}
                  </p>
                  <StatusBadge
                    status={quiz.submittedAt ? "success" : "neutral"}
                  >
                    {quiz.submittedAt ? "Submitted" : "Ready to start"}
                  </StatusBadge>
                </div>
                <ButtonLink
                  variant={quiz.submittedAt ? "secondary" : "primary"}
                  to={`/student/quizzes/${encodeURIComponent(quiz.id)}`}
                >
                  {quiz.submittedAt ? "View submission" : "Open quiz"}
                  <Icon name="arrow" />
                </ButtonLink>
              </Card>
            ))}
          </div>
        )}
      </section>
      {demoFooter}
    </>
  );
}
