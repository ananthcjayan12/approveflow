import { useSyncExternalStore } from "react";

export type ThemeChoice = "light" | "dark" | "system";
const KEY = "af-theme";

function read(): ThemeChoice {
  try {
    const value = localStorage.getItem(KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}

/** Applies the choice to <html>. "system" removes the override so the OS decides. */
export function applyTheme(choice: ThemeChoice) {
  const root = document.documentElement;
  if (choice === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", choice);
  const dark = choice === "dark" || (choice === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#0a0c11" : "#ffffff");
}

// One store for the whole app, so every toggle and picker stays in sync.
let current: ThemeChoice = "system";
const listeners = new Set<() => void>();

if (typeof window !== "undefined") {
  current = read();
  applyTheme(current);
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => current === "system" && applyTheme("system"));
}

export function setTheme(next: ThemeChoice) {
  current = next;
  try {
    if (next === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, next);
  } catch {
    /* private mode: the choice still applies for this visit */
  }
  applyTheme(next);
  listeners.forEach((notify) => notify());
}

const subscribe = (notify: () => void) => {
  listeners.add(notify);
  return () => listeners.delete(notify);
};

export function useTheme() {
  const choice = useSyncExternalStore(subscribe, () => current, () => "system" as ThemeChoice);
  return [choice, setTheme] as const;
}
