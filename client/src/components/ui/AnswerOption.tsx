import { useId, type ComponentPropsWithRef, type ReactNode } from "react";
import { Icon } from "./Icon.tsx";
import styles from "./AnswerOption.module.css";

export type AnswerOptionProps = Omit<ComponentPropsWithRef<"input">, "type" | "children"> & {
  type: "radio" | "checkbox";
  label: ReactNode;
  description?: string;
};
export function AnswerOption({ type, label, description, className = "", id, "aria-describedby": describedBy, ...props }: AnswerOptionProps) {
  const generatedId = useId(); const fieldId = id ?? generatedId;
  return <label className={`${styles.option} ${className}`} htmlFor={fieldId}>
    <input {...props} id={fieldId} type={type} className={styles.native} aria-labelledby={props["aria-labelledby"] ?? `${fieldId}-label`} aria-describedby={[describedBy, description && `${fieldId}-description`].filter(Boolean).join(" ") || undefined} />
    <span className={`${styles.indicator} ${type === "radio" ? styles.radio : ""}`} aria-hidden="true"><Icon name="check" /></span>
    <span className={styles.copy}><span id={`${fieldId}-label`} className={styles.label}>{label}</span>{description && <span id={`${fieldId}-description`} className={styles.description}>{description}</span>}</span>
  </label>;
}
