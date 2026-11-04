import { useState } from "react";
import { AnswerOption, Button, Card, Icon, StatusBadge, Textarea, TextInput } from "../components/ui/index.ts";
import styles from "./UiPreviewPage.module.css";

export function UiPreviewPage() {
  const [notice, setNotice] = useState("Try a button to see its feedback.");
  const [choice, setChoice] = useState("observe");
  const [topics, setTopics] = useState<string[]>(["patterns"]);
  return <><header className={styles.header}><p className={styles.eyebrow}>DESIGN WORKSHOP</p><h1>Good ideas, in good company.</h1><p>A shared set of building blocks for the teacher and student experience. Everything on this page is a local demonstration.</p></header>
    <div className={styles.stack}>
      <Card><div className={styles.sectionTitle}><span>01</span><h2>Buttons</h2></div><p className={styles.description}>Rounded, tactile, and ready for a little momentum.</p>
        <div className={styles.row}><Button onClick={() => setNotice("Changes saved in this preview only.")}>Save changes <Icon name="check" /></Button><Button variant="secondary" onClick={() => setNotice("There is always another idea to explore.")}>Keep exploring</Button><Button variant="dark" onClick={() => setNotice("You are ready for the next step.")}>Continue <Icon name="arrow" /></Button></div>
        <div className={styles.row}><Button disabled>Primary disabled</Button><Button variant="secondary" disabled>Secondary disabled</Button><Button variant="dark" disabled>Dark disabled</Button></div>
        <div className={styles.row}><Button loading loadingLabel="Saving…">Save</Button><Button variant="secondary" loading loadingLabel="Preparing…">Prepare</Button><Button variant="dark" loading loadingLabel="Loading…">Continue</Button></div>
        <p role="status" aria-live="polite" className={styles.feedback}>{notice}</p>
      </Card>
      <Card><div className={styles.sectionTitle}><span>02</span><h2>Words & fields</h2></div><div className={styles.fieldGrid}>
        <TextInput name="preview-title" label="Quiz title" hint="A few words that invite a closer look." placeholder="Give your quiz a name" />
        <TextInput label="Title with an error" defaultValue="" hint="This field demonstrates validation feedback." error="Please add a title before continuing." required />
        <TextInput label="Disabled field" value="Not available yet" disabled />
        <Textarea label="A little context" placeholder="What would you like your students to think about?" hint="A sentence or two is plenty." />
        <Textarea label="Description with an error" error="Please add a short description." hint="An example error state." />
        <Textarea label="Disabled notes" defaultValue="These notes cannot be edited." disabled />
      </div></Card>
      <Card><div className={styles.sectionTitle}><span>03</span><h2>Room to choose</h2></div><div className={styles.fieldGrid}>
        <fieldset className={styles.choices}><legend>Where would you begin?</legend><p>Choose one answer.</p>
          <AnswerOption type="radio" name="preview-single" value="observe" label="Look a little closer" description="Notice what is already there." checked={choice === "observe"} onChange={() => setChoice("observe")} />
          <AnswerOption type="radio" name="preview-single" value="ask" label="Ask a new question" checked={choice === "ask"} onChange={() => setChoice("ask")} />
          <AnswerOption type="radio" name="preview-single" value="later" label="A disabled option" disabled />
        </fieldset>
        <fieldset className={styles.choices}><legend>What catches your interest?</legend><p>Choose any that feel right.</p>
          {[{ value: "patterns", label: "Finding patterns", description: "A connection you had not seen before." }, { value: "ideas", label: "Trying new ideas" }].map(({ value, ...option }) => <AnswerOption key={value} {...option} type="checkbox" name="preview-multiple" value={value} checked={topics.includes(value)} onChange={(event) => setTopics((previous) => event.target.checked ? [...previous, value] : previous.filter((item) => item !== value))} />)}
          <AnswerOption type="checkbox" label="A disabled selected option" defaultChecked disabled />
        </fieldset>
      </div></Card>
      <Card><div className={styles.sectionTitle}><span>04</span><h2>A clear sense of progress</h2></div><p className={styles.description}>Every status uses both a symbol and a label.</p>
        <div className={styles.row}><StatusBadge status="success">Saved successfully</StatusBadge><StatusBadge status="warning">Needs attention</StatusBadge><StatusBadge status="error">Could not save</StatusBadge><StatusBadge status="neutral">Not started</StatusBadge></div>
      </Card>
      <section><div className={styles.sectionTitle}><span>05</span><h2>Space to focus</h2></div><div className={styles.samples}>
        <Card><Icon name="book" /><h3>A card with a purpose.</h3><p className={styles.description}>A quiet surface for questions, instructions, or the next small step.</p></Card>
        <div className={styles.sageSample}><p className={styles.eyebrow}>A NOTE ON TYPE</p><h2>A little room to think.</h2><p>Source Serif 4 gives headings a warm voice. Figtree keeps the details clear.</p></div>
      </div><p className={styles.description}>The page shell and capsule navigation above are shared across every route.</p></section>
    </div></>;
}
