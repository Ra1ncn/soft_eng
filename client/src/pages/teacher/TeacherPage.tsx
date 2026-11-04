import { useEffect, useRef, useState, type FormEvent } from "react";
import { useBlocker } from "react-router";
import type { CreateQuizRequest, CreateQuizResponse, QuestionType } from "@quiz/shared";
import { AnswerOption, Button, ButtonLink, Card, ConfirmDialog, Icon, QuestionNav, Select, StatusBadge, TextInput, Textarea, type SelectOption } from "../../components/ui/index.ts";
import { apiFetch, ApiFetchError } from "../../lib/apiFetch.ts";
import { scrollAndFocus } from "../../lib/scrollAndFocus.ts";
import entryStyles from "../EntryPage.module.css";
import styles from "./TeacherPage.module.css";
import {
  addOption, addQuestion, createDraft, describeFields, draftHasContent, MIN_OPTIONS, MIN_QUESTIONS, optionHasContent, questionHasContent, questionHasError, removeOption, removeQuestion,
  setOptionCorrect, setOptionText, setPrompt, setQuestionType, toCreateRequest, validateDraft,
  type FieldErrors, type OptionDraft, type QuestionDraft, type QuizDraft,
} from "./quizDraft.ts";

const questionTypes: SelectOption<QuestionType>[] = [
  { value: "SINGLE_CHOICE", label: "Single choice" },
  { value: "MULTIPLE_SELECT", label: "Multiple select" },
];

const questionTargetId = (question: QuestionDraft) => `question-${question.key}`;

const saveQuiz = (body: CreateQuizRequest) =>
  apiFetch<CreateQuizResponse>("/api/quizzes", "TEACHER", { method: "POST", body: JSON.stringify(body) });

type PendingDelete = { title: string; message: string; remove: (draft: QuizDraft) => QuizDraft };

type QuestionCardProps = {
  question: QuestionDraft;
  index: number;
  canRemove: boolean;
  errors: FieldErrors;
  onChange: (change: (draft: QuizDraft) => QuizDraft) => void;
  onConfirmDelete: (request: PendingDelete) => void;
};

function QuestionCard({ question, index, canRemove, errors, onChange, onConfirmDelete }: QuestionCardProps) {
  const number = index + 1;
  // Blank rows hold nothing worth protecting, so they delete straight away.
  function deleteQuestion() {
    const remove = (draft: QuizDraft) => removeQuestion(draft, question.key);
    if (questionHasContent(question)) onConfirmDelete({ title: `Delete question ${number}?`, message: "Its text and options will be removed. This can’t be undone.", remove });
    else onChange(remove);
  }
  function deleteOption(option: OptionDraft, optionNumber: number) {
    const remove = (draft: QuizDraft) => removeOption(draft, question.key, option.key);
    if (optionHasContent(option)) onConfirmDelete({ title: `Delete option ${optionNumber}?`, message: `It will be removed from question ${number}. This can’t be undone.`, remove });
    else onChange(remove);
  }
  const optionsError = errors[`questions.${index}.options`];
  const optionsErrorId = `${question.key}-options-error`;
  return <Card id={questionTargetId(question)} tabIndex={-1} className={`${styles.stack} ${styles.questionCard}`}>
    <div className={styles.cardHeading}>
      <h2><span className={styles.visuallyHidden}>Question </span>{number}.</h2>
      <Button className={styles.iconButton} variant="secondary" disabled={!canRemove} aria-label={`Remove question ${number}`} onClick={deleteQuestion}><Icon name="trash" className={styles.removeIcon} /></Button>
    </div>
    <Textarea label="Question text" rows={2} required value={question.prompt} error={errors[`questions.${index}.prompt`]} onChange={(event) => { const { value } = event.target; onChange((draft) => setPrompt(draft, question.key, value)); }} />
    <fieldset className={styles.group} aria-describedby={optionsError ? optionsErrorId : undefined}>
      <legend>Options</legend>
      <p className={styles.hint}>{question.type === "SINGLE_CHOICE" ? "Mark the one correct option." : "Mark every correct option."}</p>
      {question.options.map((option, optionIndex) => {
        const optionNumber = optionIndex + 1;
        return <div key={option.key} className={styles.optionRow}>
          <TextInput label={`Option ${optionNumber}`} required value={option.text} error={errors[`questions.${index}.options.${optionIndex}.text`]} onChange={(event) => { const { value } = event.target; onChange((draft) => setOptionText(draft, question.key, option.key, value)); }} />
          <AnswerOption className={styles.correct} type={question.type === "SINGLE_CHOICE" ? "radio" : "checkbox"} name={`${question.key}-correct`} label={<>Correct<span className={styles.visuallyHidden}> answer: option {optionNumber}</span></>} checked={option.isCorrect} onChange={(event) => { const { checked } = event.target; onChange((draft) => setOptionCorrect(draft, question.key, option.key, checked)); }} />
          <Button className={`${styles.iconButton} ${styles.removeOption}`} variant="secondary" disabled={question.options.length <= MIN_OPTIONS} aria-label={`Remove option ${optionNumber} from question ${number}`} onClick={() => deleteOption(option, optionNumber)}><Icon name="trash" className={styles.removeIcon} /></Button>
        </div>;
      })}
      {optionsError && <p id={optionsErrorId} className={styles.error} tabIndex={-1} data-field-error>{optionsError}</p>}
      <div className={styles.optionActions}>
        <Button variant="secondary" onClick={() => onChange((draft) => addOption(draft, question.key))}><Icon name="plus" /> Add option</Button>
        <Select aria-label={`Type of question ${number}`} value={question.type} options={questionTypes} onChange={(type) => onChange((draft) => setQuestionType(draft, question.key, type))} />
      </div>
    </fieldset>
  </Card>;
}

export function TeacherPage() {
  const [draft, setDraft] = useState(createDraft);
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serverErrors, setServerErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [saved, setSaved] = useState<CreateQuizResponse | null>(null);
  const [errorJumps, setErrorJumps] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);

  const hasUnsavedWork = !saved && draftHasContent(draft);
  // In-app navigation, including the browser back button.
  const blocker = useBlocker(({ currentLocation, nextLocation }) => hasUnsavedWork && currentLocation.pathname !== nextLocation.pathname);
  // Refreshing or closing the tab. The browser draws this prompt and sets its wording.
  useEffect(() => {
    if (!hasUnsavedWork) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasUnsavedWork]);

  // Runs after the errors render, because the first invalid field is found in the DOM.
  useEffect(() => {
    if (errorJumps === 0) return;
    const firstError = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"], [data-field-error]');
    if (firstError) scrollAndFocus(firstError, "center");
  }, [errorJumps]);

  // Errors come from the current draft, so removing a question can never leave one on the wrong row.
  const errors = { ...serverErrors, ...(attempted ? validateDraft(draft) : {}) };
  const hasErrors = Object.keys(errors).length > 0;

  function change(update: (current: QuizDraft) => QuizDraft) {
    setDraft(update);
    setServerErrors({});
    setFormError("");
  }

  function startAgain() {
    setDraft(createDraft());
    setAttempted(false);
    setSaved(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setAttempted(true);
    setServerErrors({});
    setFormError("");
    if (Object.keys(validateDraft(draft)).length > 0) {
      setErrorJumps((count) => count + 1);
      return;
    }
    setSaving(true);
    try {
      setSaved(await saveQuiz(toCreateRequest(draft)));
    } catch (error) {
      if (error instanceof ApiFetchError && error.error.fields) {
        setServerErrors(describeFields(Object.keys(error.error.fields), draft));
        setErrorJumps((count) => count + 1);
      } else if (error instanceof ApiFetchError) setFormError("We couldn’t save your quiz. Your work is still here, so please try again.");
      else setFormError("We couldn’t reach the server. Your work is still here, so please try again.");
    } finally {
      setSaving(false);
    }
  }

  const header = (title: string, lead: string) => <header className={entryStyles.header}>
    <p className={entryStyles.eyebrow}>Teacher space</p>
    <h1>{title}</h1>
    <p className={entryStyles.lead}>{lead}</p>
  </header>;
  const footer = <p className={entryStyles.detail}>Demo space · Real sign-in is not connected yet.</p>;

  if (saved) {
    return <>{header("Your quiz is saved.", "Students can find it once the student pages are connected.")}
      <Card className={styles.stack} role="status">
        <div><StatusBadge status="success">Saved successfully</StatusBadge></div>
        <div className={styles.savedCopy}>
          <h2>{saved.title}</h2>
          <p>Quiz ID: <code>{saved.id}</code></p>
        </div>
        <div className={styles.actions}>
          <Button onClick={startAgain}>Create another quiz <Icon name="arrow" /></Button>
          <ButtonLink to="/" variant="secondary">Back to home</ButtonLink>
        </div>
      </Card>
      {footer}</>;
  }

  return <>{header("Create a quiz.", "Add your questions, mark the correct answers, and save when you’re ready.")}
    <div className={styles.layout}>
    <QuestionNav items={draft.questions.map((question, index) => ({ targetId: questionTargetId(question), hasError: questionHasError(errors, index) }))} />
    <form ref={formRef} className={styles.form} onSubmit={handleSubmit} noValidate>
      <Card>
        <TextInput label="Quiz title" required placeholder="Give your quiz a name" value={draft.title} error={errors.title} onChange={(event) => { const title = event.target.value; change((current) => ({ ...current, title })); }} />
      </Card>
      {draft.questions.map((question, index) => <QuestionCard key={question.key} question={question} index={index} canRemove={draft.questions.length > MIN_QUESTIONS} errors={errors} onChange={change} onConfirmDelete={setPendingDelete} />)}
      <div className={styles.footer}>
        <div role="alert">
          {formError && <p className={styles.error}>{formError}</p>}
          {!formError && hasErrors && <p className={styles.error}>Please fix the highlighted fields before saving.</p>}
        </div>
        <div className={`${styles.actions} ${styles.formActions}`}>
          <Button variant="secondary" onClick={() => change(addQuestion)}><Icon name="plus" /> Add question</Button>
          <Button type="submit" aria-label={saving ? undefined : "Save quiz"} loading={saving} loadingLabel="Saving quiz…">Save</Button>
        </div>
      </div>
    </form>
    </div>
    <ConfirmDialog
      open={pendingDelete !== null}
      title={pendingDelete?.title ?? ""}
      message={pendingDelete?.message ?? ""}
      confirmLabel="Delete"
      cancelLabel="Keep"
      onConfirm={() => { if (pendingDelete) change(pendingDelete.remove); setPendingDelete(null); }}
      onCancel={() => setPendingDelete(null)}
    />
    <ConfirmDialog
      open={blocker.state === "blocked"}
      title="Leave without saving?"
      message="Your quiz hasn’t been saved. If you leave now, your work will be lost."
      confirmLabel="Leave"
      cancelLabel="Keep editing"
      onConfirm={() => blocker.proceed?.()}
      onCancel={() => blocker.reset?.()}
    />
    {footer}</>;
}
