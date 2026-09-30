export type Tone = "gray" | "amber" | "red" | "green" | "blue";

const statuses: Record<string, { label: string; tone: Tone }> = {
  draft: { label: "Not sent yet", tone: "gray" },
  waiting: { label: "Waiting for client", tone: "amber" },
  revised: { label: "New version sent", tone: "blue" },
  changes_requested: { label: "Changes needed", tone: "red" },
  approved: { label: "Approved", tone: "green" },
};

export const statusInfo = (status: string) =>
  statuses[status] ?? { label: status.replaceAll("_", " "), tone: "gray" as Tone };

/** Statuses where the ball is in the client's court. */
export const isWaiting = (status: string) =>
  status === "waiting" || status === "revised";

const events: Record<string, { verb: string; tone: Tone }> = {
  "client.created": { verb: "added a new client", tone: "blue" },
  "project.created": { verb: "created a project", tone: "blue" },
  "asset.version_uploaded": { verb: "uploaded content", tone: "gray" },
  "approval.sent": { verb: "sent content for approval", tone: "amber" },
  "asset.approved": { verb: "approved content", tone: "green" },
  "asset.changes_requested": { verb: "asked for changes", tone: "red" },
  "review.comment": { verb: "left a comment", tone: "blue" },
  "reminder.sent": { verb: "sent a reminder", tone: "gray" },
};

export const eventInfo = (type: string) =>
  events[type] ?? { verb: type.replaceAll(/[._]/g, " "), tone: "gray" as Tone };

/** D1 timestamps are UTC without a zone marker ("2026-09-30 10:15:00"). */
export const parseDate = (value: string) =>
  new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(value) ? value : `${value.replace(" ", "T")}Z`);

export function timeAgo(value: string) {
  const date = parseDate(value);
  if (Number.isNaN(date.getTime())) return value;
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return days === 1 ? "yesterday" : `${days} days ago`;
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export function dayLabel(value: string) {
  const date = parseDate(value);
  if (Number.isNaN(date.getTime())) return "Earlier";
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function formatDate(value?: string) {
  if (!value) return "";
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

export function formatSeconds(seconds: number) {
  const s = Math.max(0, seconds);
  const m = Math.floor(s / 60);
  const rest = s - m * 60;
  return `${m}:${rest < 10 ? "0" : ""}${rest.toFixed(rest % 1 ? 1 : 0)}`;
}

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter((word) => /^[\p{L}\p{N}]/u.test(word))
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "?";

export const kindLabel: Record<string, string> = {
  image: "Image",
  video: "Video",
  pdf: "PDF",
  carousel: "Carousel",
};
