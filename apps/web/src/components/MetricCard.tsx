import type { ReactNode } from 'react';

export function MetricCard({ value, label, icon }: { value: string | number; label: string; icon?: ReactNode }) {
  return <div className="metric-card"><div className="metric-top"><span>{icon}</span><strong>{value}</strong></div><span>{label}</span></div>;
}
