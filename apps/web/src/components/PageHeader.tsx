import type { ReactNode } from 'react';

export function PageHeader({ title, eyebrow, action }: { title: string; eyebrow?: string; action?: ReactNode }) {
  return (
    <div className="page-header">
      <div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h1>{title}</h1></div>
      {action}
    </div>
  );
}
