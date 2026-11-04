import { useEffect, useId, useRef } from "react";
import { Button } from "./Button.tsx";
import styles from "./ConfirmDialog.module.css";

export type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
};

// The native dialog traps focus, handles Escape, and restores focus when it closes.
export function ConfirmDialog({ open, title, message, confirmLabel, cancelLabel, onConfirm, onCancel }: ConfirmDialogProps) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (open && !element?.open) element?.showModal();
    if (!open && element?.open) element.close();
  }, [open]);

  return <dialog
    ref={dialog}
    className={styles.dialog}
    aria-labelledby={`${id}-title`}
    aria-describedby={`${id}-message`}
    onCancel={(event) => { event.preventDefault(); onCancel(); }}
    // A click on the dialog element itself is a click on the backdrop.
    onClick={(event) => { if (event.target === event.currentTarget) onCancel(); }}
  >
    <div className={styles.content}>
      <h2 id={`${id}-title`}>{title}</h2>
      <p id={`${id}-message`}>{message}</p>
      <div className={styles.actions}>
        <Button variant="secondary" onClick={onCancel}>{cancelLabel}</Button>
        <Button variant="dark" onClick={onConfirm}>{confirmLabel}</Button>
      </div>
    </div>
  </dialog>;
}
