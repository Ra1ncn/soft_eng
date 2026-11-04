import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Button } from "./Button.tsx";
import { Icon } from "./Icon.tsx";
import styles from "./Select.module.css";

export type SelectOption<T extends string> = { value: T; label: string };
export type SelectProps<T extends string> = {
  "aria-label": string;
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
};

// Roughly two options plus padding; below this the list opens upward instead.
const MIN_SPACE_BELOW = 140;

// A themed replacement for <select>, following the WAI-ARIA select-only combobox pattern.
export function Select<T extends string>({ "aria-label": ariaLabel, value, options, onChange }: SelectProps<T>) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [openUp, setOpenUp] = useState(false);
  const [active, setActive] = useState(0);
  const selectedIndex = options.findIndex((option) => option.value === value);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePress);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePress);
  }, [open]);

  function show(index = Math.max(selectedIndex, 0)) {
    const box = root.current?.getBoundingClientRect();
    setOpenUp(box !== undefined && window.innerHeight - box.bottom < MIN_SPACE_BELOW && box.top > MIN_SPACE_BELOW);
    setActive(index);
    setOpen(true);
  }

  function choose(index: number) {
    const option = options[index];
    if (option) onChange(option.value);
    setOpen(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const last = options.length - 1;
    const closedTargets: Record<string, number | undefined> = { ArrowDown: undefined, ArrowUp: undefined, Enter: undefined, " ": undefined, Home: 0, End: last };
    if (!open) {
      if (!(event.key in closedTargets)) return;
      event.preventDefault();
      show(closedTargets[event.key]);
      return;
    }
    if (event.key === "Tab") { setOpen(false); return; }
    const moves: Record<string, () => void> = {
      ArrowDown: () => setActive((index) => Math.min(index + 1, last)),
      ArrowUp: () => setActive((index) => Math.max(index - 1, 0)),
      Home: () => setActive(0),
      End: () => setActive(last),
      Enter: () => choose(active),
      " ": () => choose(active),
      Escape: () => setOpen(false),
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    move();
  }

  return <div ref={root} className={styles.root}>
    <Button
      className={styles.trigger}
      variant="secondary"
      role="combobox"
      aria-label={ariaLabel}
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-controls={open ? `${id}-list` : undefined}
      aria-activedescendant={open ? `${id}-${active}` : undefined}
      onClick={() => open ? setOpen(false) : show()}
      onKeyDown={handleKeyDown}
      // Some browsers click a button on Space keyup, which would reopen the list.
      onKeyUp={(event) => { if (event.key === " ") event.preventDefault(); }}
      onBlur={() => setOpen(false)}
    >
      {options[selectedIndex]?.label}
      <Icon name="chevron" className={`${styles.chevron} ${open ? styles.chevronOpen : ""}`} />
    </Button>
    {open && <ul id={`${id}-list`} role="listbox" aria-label={ariaLabel} className={`${styles.list} ${openUp ? styles.up : ""}`}>
      {options.map((option, index) => <li
        key={option.value}
        id={`${id}-${index}`}
        role="option"
        aria-selected={index === selectedIndex}
        className={`${styles.option} ${index === active ? styles.active : ""}`}
        // Keeps focus on the trigger, so its blur doesn't close the list before the click lands.
        onMouseDown={(event) => event.preventDefault()}
        onPointerMove={() => setActive(index)}
        onClick={() => choose(index)}
      >
        <Icon name="check" className={index === selectedIndex ? styles.check : styles.checkHidden} />
        {option.label}
      </li>)}
    </ul>}
  </div>;
}
