import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

/** Live content-box size of an element. Use the returned callback as its `ref`. */
export function useElementSize<T extends HTMLElement = HTMLDivElement>() {
  const [node, setNode] = useState<T | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    if (!node) return;
    const measure = () => setSize({ w: node.clientWidth, h: node.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);
  return [setNode, size, node] as const;
}

export function useMediaQuery(query: string) {
  const get = () => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia(query).matches : false);
  const [matches, setMatches] = useState(get);
  useEffect(() => {
    const list = window.matchMedia(query);
    const on = () => setMatches(list.matches);
    on();
    list.addEventListener("change", on);
    return () => list.removeEventListener("change", on);
  }, [query]);
  return matches;
}

/** True when the user is typing somewhere a shortcut must not fire. */
export function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el || !el.tagName) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
}

// Did focus most recently arrive by Tab (keyboard) rather than by a click/tap?
// `:focus-visible` can't tell us: browsers flip it on for the focused element the
// moment any key is pressed, including the Space we are trying to classify.
let focusFromKeyboard = false;
if (typeof window !== "undefined") {
  window.addEventListener("keydown", (e) => e.key === "Tab" && (focusFromKeyboard = true), true);
  window.addEventListener("pointerdown", () => (focusFromKeyboard = false), true);
}

/**
 * True when a keyboard-navigated control should keep Space/Enter for itself.
 * A button you merely *clicked* keeps focus, but Space should still reach the
 * player shortcut; a button you Tabbed to must stay operable from the keyboard.
 */
export function keyboardOwnsControl(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el?.closest) return false;
  if (el.closest("[role='dialog']")) return true;
  return focusFromKeyboard && !!el.closest("button, a, summary, [role='slider'], [role='radio']");
}

/** Runs the latest handler on window keydown without re-subscribing every render. */
export function useWindowKey(handler: (e: KeyboardEvent) => void, enabled = true) {
  const latest = useRef(handler);
  latest.current = handler;
  useEffect(() => {
    if (!enabled) return;
    const on = (e: KeyboardEvent) => latest.current(e);
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [enabled]);
}

/** Closes a popover when the user clicks elsewhere or presses Escape. */
export function useDismiss(open: boolean, onClose: () => void, ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("pointerdown", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("keydown", key);
    };
  }, [open, onClose, ref]);
}

/**
 * Publishes how much of the screen the on-screen keyboard covers as `--kb`,
 * so bottom sheets can sit above it (iOS Safari does not resize the layout).
 */
export function useKeyboardInset() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;
    const update = () => {
      const covered = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      root.style.setProperty("--kb", `${Math.round(covered)}px`);
      // Small changes are just browser chrome resizing; only a real keyboard counts.
      if (covered > 120) root.dataset.kb = "open";
      else delete root.dataset.kb;
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      root.style.removeProperty("--kb");
      delete root.dataset.kb;
    };
  }, []);
}

export const useStableCallback = <A extends unknown[], R>(fn: (...args: A) => R) => {
  const ref = useRef(fn);
  ref.current = fn;
  return useCallback((...args: A) => ref.current(...args), []);
};
