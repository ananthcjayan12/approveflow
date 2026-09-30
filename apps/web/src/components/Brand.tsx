import { Check } from "lucide-react";

export function Brand({ compact = false, iconOnly = false }: { compact?: boolean; iconOnly?: boolean }) {
  return (
    <span className={`brand ${compact ? "brand-compact" : ""}`} role="img" aria-label="ApproveFlow">
      <span className="brand-mark">
        <Check size={compact ? 15 : 18} strokeWidth={3.2} />
      </span>
      {!iconOnly && (
        <span className="brand-name">
          Approve<i>Flow</i>
        </span>
      )}
    </span>
  );
}
