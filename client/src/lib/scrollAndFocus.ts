// The target must be focusable: a form control, or an element with tabIndex={-1}.
export function scrollAndFocus(target: HTMLElement, block: ScrollLogicalPosition = "start") {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block });
  target.focus({ preventScroll: true });
}
