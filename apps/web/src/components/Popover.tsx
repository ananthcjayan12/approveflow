import { ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Props = {
  /** The element the popover hangs off. */
  anchor: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  /** Preferred side; flips automatically when there is no room. */
  side?: "bottom" | "top";
  align?: "start" | "end";
  className?: string;
  label?: string;
  children: ReactNode;
};

/**
 * A menu/popover rendered in a portal with fixed positioning, so it can never
 * be clipped by a scrolling toolbar or an overflow:hidden card.
 */
export function Popover({ anchor, open, onClose, side = "bottom", align = "start", className = "", label, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || !anchor) return;
    const place = () => {
      const el = ref.current;
      if (!el) return;
      const a = anchor.getBoundingClientRect();
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const below = vh - a.bottom - 8;
      const above = a.top - 8;
      const useTop = side === "top" ? above >= h || above > below : below < h && above > below;
      const top = useTop ? Math.max(8, a.top - h - 8) : Math.min(vh - h - 8, a.bottom + 8);
      const left = Math.max(8, Math.min(vw - w - 8, align === "start" ? a.left : a.right - w));
      setPos({ left, top });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, anchor, side, align]);

  useEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const down = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!ref.current?.contains(t) && !anchor?.contains(t)) onClose();
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("pointerdown", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("keydown", key);
    };
  }, [open, anchor, onClose]);

  if (!open) return null;
  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-label={label}
      className={`popover ${className}`}
      style={{ position: "fixed", left: pos?.left ?? 0, top: pos?.top ?? 0, visibility: pos ? "visible" : "hidden" }}
    >
      {children}
    </div>,
    document.body,
  );
}
