import { Link, NavLink } from "react-router";
import { Icon } from "./Icon.tsx";
import styles from "./TopNav.module.css";
export function TopNav() {
  return <nav className={styles.nav} aria-label="Main navigation">
    <Link to="/" className={styles.brand} aria-label="Quiz Studio home"><span className={styles.mark}><Icon name="layers" /></span>Quiz Studio</Link>
    <div className={styles.links}><NavLink to="/teacher" className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ""}`}>Teacher</NavLink>
      <NavLink to="/student" className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ""}`}>Student</NavLink></div>
  </nav>;
}
