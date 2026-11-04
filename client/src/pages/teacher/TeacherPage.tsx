import { ButtonLink, Card, Icon, StatusBadge } from "../../components/ui/index.ts";
import styles from "../EntryPage.module.css";

export function TeacherPage() {
  return <><header className={styles.header}><p className={styles.eyebrow}>Teacher space</p><h1>Make room for<br />a good question.</h1><p className={styles.lead}>A thoughtful quiz begins with an idea worth sharing.</p></header>
    <Card className={styles.panel}><span className={styles.symbol}><Icon name="layers" /></span><div className={styles.copy}><h2>Your next quiz starts here.</h2><p>This space is being prepared for creating and saving quizzes. Team B will continue building the teacher experience.</p><ButtonLink to="/" variant="secondary">Back to home</ButtonLink></div><StatusBadge status="neutral">Coming together</StatusBadge></Card>
    <p className={styles.detail}>Demo space · Real sign-in is not connected yet.</p></>;
}
