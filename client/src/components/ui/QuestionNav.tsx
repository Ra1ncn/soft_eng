import styles from "./QuestionNav.module.css";

// targetId must belong to an element with tabIndex={-1}, so focus can move there too.
export type QuestionNavItem = { targetId: string; hasError?: boolean };

function goTo(targetId: string) {
  const target = document.getElementById(targetId);
  if (!target) return;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  target.focus({ preventScroll: true });
}

export function QuestionNav({ items }: { items: QuestionNavItem[] }) {
  return <nav className={styles.nav} aria-label="Questions">
    <ol className={styles.list}>
      {items.map(({ targetId, hasError }, index) => {
        const number = index + 1;
        return <li key={targetId}>
          <button type="button" className={`${styles.item} ${hasError ? styles.error : ""}`} aria-label={`Go to question ${number}${hasError ? ", has errors" : ""}`} onClick={() => goTo(targetId)}>
            {number}{hasError && <span className={styles.marker} aria-hidden="true" />}
          </button>
        </li>;
      })}
    </ol>
  </nav>;
}
