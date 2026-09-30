import { ReactNode, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  FileText,
  Film,
  Image as ImageIcon,
  RefreshCw,
  X,
} from "lucide-react";
import { readableOn } from "../lib/color";
import { initials, statusInfo } from "../lib/format";
import { AssetRow, mediaUrl } from "../lib/workspace";

const statusIcons = {
  gray: Clock3,
  amber: Clock3,
  blue: RefreshCw,
  red: AlertCircle,
  green: CheckCircle2,
};

export function StatusBadge({ status }: { status: string }) {
  const { label, tone } = statusInfo(status);
  const Icon = statusIcons[tone];
  return (
    <span className={`badge tone-${tone}`}>
      <Icon size={13} strokeWidth={2.4} />
      {label}
    </span>
  );
}

/** A stable hue per name, so lists of clients get distinct, recognisable avatars. */
const tintFor = (name: string) => {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `linear-gradient(135deg, hsl(${h} 72% 58%), hsl(${(h + 38) % 360} 70% 44%))`;
};

export function Avatar({
  name,
  size = "md",
  color,
  tint = false,
}: {
  name: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  color?: string;
  /** Derive a colour from the name instead of using the brand gradient. */
  tint?: boolean;
}) {
  return (
    <span
      className={`avatar avatar-${size}`}
      style={color ? { background: color, color: readableOn(color) } : tint ? { background: tintFor(name) } : undefined}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

export function PageHeader({
  title,
  description,
  back,
  action,
}: {
  title: ReactNode;
  description?: ReactNode;
  back?: { to: string; label: string };
  action?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div className="page-header-text">
        {back && (
          <Link className="back-link" to={back.to}>
            <ArrowLeft size={15} /> {back.label}
          </Link>
        )}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action && <div className="page-header-actions">{action}</div>}
    </header>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <h2>{title}</h2>
      <p>{body}</p>
      {action}
    </div>
  );
}

export function Notice({
  message,
  tone = "info",
}: {
  message: string;
  tone?: "info" | "error" | "success";
}) {
  if (!message) return null;
  return (
    <p role={tone === "error" ? "alert" : "status"} className={`notice notice-${tone}`}>
      {tone === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
      {message}
    </p>
  );
}

export function ProgressBar({
  value,
  tone = "primary",
  label,
}: {
  value: number;
  tone?: "primary" | "green";
  label?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      className={`progress progress-${tone}`}
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

/**
 * Dialog. Locks page scroll while open, closes on Escape or backdrop click,
 * and hands focus back to whatever opened it. Becomes a bottom sheet on phones.
 */
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    if (!dialog.current?.contains(document.activeElement)) dialog.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
      opener?.focus?.();
    };
  }, [onClose]);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        ref={dialog}
        tabIndex={-1}
        className={`modal${wide ? " wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="modal-close" aria-label="Close" onClick={onClose}>
          <X size={18} />
        </button>
        {children}
      </div>
    </div>
  );
}

const kindIcons = { video: Film, pdf: FileText };

/** Visual preview of an asset: images render, video/PDF get a labelled tile. */
export function Thumb({ asset, token, badge = false }: { asset: AssetRow; token?: string; badge?: boolean }) {
  if (asset.kind === "image" || asset.kind === "carousel")
    return <img className="thumb-media" src={mediaUrl(asset, token)} alt="" loading="lazy" />;
  if (asset.kind === "video")
    return (
      <>
        <span className="thumb-placeholder thumb-behind" aria-hidden>
          <Film size={22} />
        </span>
        <video
          className="thumb-media thumb-video"
          src={`${mediaUrl(asset, token)}#t=0.5`}
          preload="metadata"
          muted
          playsInline
        />
        {badge && (
          <span className="thumb-kind">
            <Film size={11} /> Video
          </span>
        )}
      </>
    );
  const Icon = kindIcons[asset.kind as keyof typeof kindIcons] ?? ImageIcon;
  return (
    <div className="thumb-placeholder">
      <Icon size={26} />
      <span>{asset.kind.toUpperCase()}</span>
    </div>
  );
}

export function Field({
  label,
  hint,
  optional,
  children,
}: {
  label: string;
  hint?: string;
  optional?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span className="field-label">
        {label}
        {optional && <em>Optional</em>}
      </span>
      {children}
      {hint && <small className="field-hint">{hint}</small>}
    </label>
  );
}
