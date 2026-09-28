import type { Status } from '../lib/types';

export function StatusPill({ status }: { status: Status }) {
  const cls = status.toLowerCase().replace(/\s+/g, '-');
  return <span className={`status-pill ${cls}`}>{status}</span>;
}
