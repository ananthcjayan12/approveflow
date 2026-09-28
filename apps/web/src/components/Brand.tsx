import { Check } from 'lucide-react';

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand-lockup" aria-label="ApproveFlow">
      <span className="brand-mark"><Check size={compact ? 14 : 18} strokeWidth={3} /></span>
      <span className={compact ? 'brand-name compact' : 'brand-name'}>Approve<span>Flow</span></span>
    </div>
  );
}
