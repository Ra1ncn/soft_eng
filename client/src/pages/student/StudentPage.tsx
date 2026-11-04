import { ButtonLink, Card, Icon, StatusBadge } from "../../components/ui/index.ts";
import styles from "../EntryPage.module.css";

export function StudentPage() {
  return <><header className={styles.header}><p className={styles.eyebrow}>Student space</p><h1>A fresh question.<br />A new perspective.</h1><p className={styles.lead}>Take your time. There is always something new to discover.</p></header>
    <Card className={styles.panel}><span className={styles.symbol}><Icon name="book" /></span><div className={styles.copy}><h2>A place for your curiosity.</h2><p>This space is being prepared for exploring and answering quizzes. Team C will build the student experience, with submissions connected by Team D.</p><ButtonLink to="/" variant="secondary">Back to home</ButtonLink></div><StatusBadge status="neutral">Coming together</StatusBadge></Card>
    <p className={styles.detail}>Demo space · Real sign-in is not connected yet.</p></>;
}
