import { useId, type ComponentPropsWithRef, type ReactNode } from "react";
import styles from "./Fields.module.css";

type FieldProps = { label: ReactNode; hint?: string; error?: string };
export type TextInputProps = ComponentPropsWithRef<"input"> & FieldProps;
export type TextareaProps = ComponentPropsWithRef<"textarea"> & FieldProps;

export function TextInput({ label, hint, error, id, className = "", "aria-describedby": describedBy, ...props }: TextInputProps) {
  const generatedId = useId(); const fieldId = id ?? generatedId;
  const description = [describedBy, hint && `${fieldId}-hint`, error && `${fieldId}-error`].filter(Boolean).join(" ") || undefined;
  return <div className={styles.field}><label htmlFor={fieldId} className={styles.label}>{label}{props.required && <span className={styles.required} aria-hidden="true">*</span>}</label>
    <input {...props} id={fieldId} className={`${styles.control} ${className}`} aria-describedby={description} aria-invalid={error ? true : props["aria-invalid"]} />
    {hint && <p id={`${fieldId}-hint`} className={styles.hint}>{hint}</p>}{error && <p id={`${fieldId}-error`} className={styles.error}>{error}</p>}
  </div>;
}
export function Textarea({ label, hint, error, id, className = "", rows = 4, "aria-describedby": describedBy, ...props }: TextareaProps) {
  const generatedId = useId(); const fieldId = id ?? generatedId;
  const description = [describedBy, hint && `${fieldId}-hint`, error && `${fieldId}-error`].filter(Boolean).join(" ") || undefined;
  return <div className={styles.field}><label htmlFor={fieldId} className={styles.label}>{label}{props.required && <span className={styles.required} aria-hidden="true">*</span>}</label>
    <textarea {...props} id={fieldId} rows={rows} className={`${styles.control} ${styles.textarea} ${className}`} aria-describedby={description} aria-invalid={error ? true : props["aria-invalid"]} />
    {hint && <p id={`${fieldId}-hint`} className={styles.hint}>{hint}</p>}{error && <p id={`${fieldId}-error`} className={styles.error}>{error}</p>}
  </div>;
}
