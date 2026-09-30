import { Check } from "lucide-react";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`brand ${compact ? "brand-compact" : ""}`} aria-label="ApproveFlow">
      <span className="brand-mark">
        <Check size={compact ? 15 : 18} strokeWidth={3.2} />
      </span>
      <span className="brand-name">ApproveFlow</span>
    </span>
  );
}
