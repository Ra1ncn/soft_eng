import type { ReactNode } from "react";
import { Link } from "react-router";
import { TopNav } from "./TopNav.tsx";
import styles from "./PageShell.module.css";
export function PageShell({ children }: { children: ReactNode }) {
  return <div className={styles.shell}><a className={styles.skip} href="#main-content">Skip to content</a>
    <header className={styles.header}><TopNav /></header><main id="main-content" tabIndex={-1} className={styles.main}>{children}</main>
    <footer className={styles.footer}><span>A classroom project, built together.</span>{import.meta.env.DEV && <Link to="/ui-preview">UI preview <span aria-hidden="true">↗</span></Link>}</footer>
  </div>;
}
