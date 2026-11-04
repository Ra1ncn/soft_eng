import type { HTMLAttributes } from "react";
import { Icon, type IconName } from "./Icon.tsx";
import styles from "./StatusBadge.module.css";
type Status = "success" | "warning" | "error" | "neutral";
const icons: Record<Status, IconName> = { success: "check", warning: "alert", error: "error", neutral: "info" };
const labels: Record<Status, string> = { success: "Saved", warning: "Needs attention", error: "Error", neutral: "Not started" };
export function StatusBadge({ status, children, className = "", ...props }: HTMLAttributes<HTMLSpanElement> & { status: Status }) {
  return <span {...props} className={`${styles.badge} ${styles[status]} ${className}`}><Icon name={icons[status]} />{children ?? labels[status]}</span>;
}
