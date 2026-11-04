import type { ComponentPropsWithRef } from "react";
import { Link, type LinkProps } from "react-router";
import styles from "./Button.module.css";

type Variant = "primary" | "secondary" | "dark";
export type ButtonProps = ComponentPropsWithRef<"button"> & {
  variant?: Variant;
  loading?: boolean;
  loadingLabel?: string;
};
export function Button({ variant = "primary", loading = false, loadingLabel = "Loading…", disabled, className = "", children, type = "button", ...props }: ButtonProps) {
  return <button {...props} type={type} className={`${styles.button} ${styles[variant]} ${className}`} disabled={disabled || loading} aria-busy={loading || undefined}>
    {loading && <span className={styles.spinner} aria-hidden="true" />}{loading ? loadingLabel : children}
  </button>;
}

// 导航使用真正的链接，避免把 <a> 嵌套在 button 中。
export function ButtonLink({ variant = "primary", className = "", children, ...props }: LinkProps & { variant?: Variant }) {
  return <Link {...props} className={`${styles.button} ${styles[variant]} ${className}`}>{children}</Link>;
}
