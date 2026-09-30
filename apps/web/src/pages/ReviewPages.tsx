import { FormEvent, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Brand } from "../components/Brand";
import { api } from "../lib/api";
import {
  AssetRow,
  CommentRow,
  mediaUrl,
  statusLabel,
  useWorkspace,
} from "../lib/workspace";
import { Feedback, Frame } from "./TrialPages";

type ReviewData = {
  project_name: string;
  company_name: string;
  reviewer_name: string;
  reviewer_email: string;
  assets: AssetRow[];
  comments: CommentRow[];
};
function FeedbackPanel({
  asset,
  comments,
  token,
  onSave,
}: {
  asset: AssetRow;
  comments: CommentRow[];
  token?: string;
  onSave: () => Promise<void>;
}) {
  const [text, setText] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null);
  const [marking, setMarking] = useState(false);
  const [time, setTime] = useState(0);
  const [range, setRange] = useState(false);
  const [end, setEnd] = useState(0);
  const video = useRef<HTMLVideoElement>(null);
  const current = comments.filter(
    (c) => c.asset_version_id === asset.version_id,
  );
  const old = comments.filter((c) => c.asset_version_id !== asset.version_id);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    setMessage("");
    try {
      if (
        range &&
        (end <= time ||
          !Number.isFinite(end) ||
          end > (video.current?.duration || Infinity))
      )
        throw new Error(
          "Choose an end time after the start and within the video.",
        );
      const annotation = point
        ? { kind: "point", ...point }
        : asset.kind === "video"
          ? range
            ? {
                kind: "video_range",
                startMs: Math.round(time * 1000),
                endMs: Math.round(end * 1000),
              }
            : { kind: "video_timestamp", timestampMs: Math.round(time * 1000) }
          : undefined;
      await api(
        token
          ? `/api/review/${token}/comments`
          : `/api/assets/${asset.id}/comments`,
        {
          method: "POST",
          body: JSON.stringify({
            assetId: asset.id,
            assetVersionId: asset.version_id,
            body: text.trim(),
            annotation,
          }),
        },
      );
      setText("");
      setPoint(null);
      await onSave();
      setMessage("Feedback saved.");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const src = mediaUrl(asset, token);
  return (
    <div className="client-review-grid">
      <section>
        {asset.kind === "video" ? (
          <>
            <video
              ref={video}
              src={src}
              controls
              playsInline
              className="trial-video"
              onPause={() => setTime(video.current?.currentTime || 0)}
              onSeeked={() => setTime(video.current?.currentTime || 0)}
            />
            {token && (
              <div className="range-tools">
                <label>
                  From / timestamp (seconds)
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={time}
                    onChange={(e) => setTime(Number(e.target.value))}
                  />
                </label>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={range}
                    onChange={(e) => setRange(e.target.checked)}
                  />
                  Select a range
                </label>
                {range && (
                  <label>
                    To (seconds)
                    <input
                      type="number"
                      min={time}
                      step="0.1"
                      value={end}
                      onChange={(e) => setEnd(Number(e.target.value))}
                    />
                  </label>
                )}
              </div>
            )}
          </>
        ) : asset.kind === "pdf" ? (
          <iframe className="trial-pdf" title={asset.name} src={src} />
        ) : (
          <>
            <div
              className={`annotatable-media ${marking ? "marking" : ""}`}
              onClick={(e) => {
                if (!marking) return;
                const bounds = e.currentTarget.getBoundingClientRect();
                setPoint({
                  x: (e.clientX - bounds.left) / bounds.width,
                  y: (e.clientY - bounds.top) / bounds.height,
                });
                setMarking(false);
              }}
            >
              <img src={src} alt={asset.name} />
              {current
                .filter((c) => c.x !== null && c.y !== null)
                .map((c, i) => (
                  <span
                    title={c.body}
                    key={c.id}
                    className="annotation-pin"
                    style={{ left: `${c.x! * 100}%`, top: `${c.y! * 100}%` }}
                  >
                    {i + 1}
                  </span>
                ))}
              {point && (
                <span
                  className="annotation-pin pending"
                  style={{
                    left: `${point.x * 100}%`,
                    top: `${point.y * 100}%`,
                  }}
                >
                  +
                </span>
              )}
            </div>
            {token && (
              <div className="annotation-toolbar">
                <button
                  className={marking ? "active" : ""}
                  onClick={() => setMarking(!marking)}
                >
                  {marking ? "Click on the image…" : "Mark on image"}
                </button>
                {point && (
                  <button onClick={() => setPoint(null)}>Remove marker</button>
                )}
              </div>
            )}
          </>
        )}
        <p>{asset.caption}</p>
        <a href={src} target="_blank" rel="noreferrer">
          Open original file
        </a>
      </section>
      <aside className="client-comments">
        <h3>Feedback · version {asset.latest_version_no}</h3>
        {current.map((c, i) => (
          <div className="feedback-item" key={c.id}>
            <span>{i + 1}</span>
            <div>
              <b>{c.author_name}</b>
              <p>{c.body}</p>
              {(c.timestamp_ms !== null || c.start_ms !== null) && (
                <button
                  onClick={() => {
                    if (video.current)
                      video.current.currentTime =
                        (c.timestamp_ms ?? c.start_ms ?? 0) / 1000;
                  }}
                >
                  {((c.timestamp_ms ?? c.start_ms ?? 0) / 1000).toFixed(1)}s
                  {c.end_ms !== null
                    ? ` – ${(c.end_ms / 1000).toFixed(1)}s`
                    : ""}
                </button>
              )}
            </div>
          </div>
        ))}
        {!current.length && <p>No feedback on this version yet.</p>}
        {old.length > 0 && (
          <details>
            <summary>Earlier feedback ({old.length})</summary>
            {old.map((c) => (
              <p key={c.id}>
                <b>{c.author_name}</b>: {c.body}
              </p>
            ))}
          </details>
        )}
        <form className="annotation-draft" onSubmit={submit}>
          <label>
            {point ? "Feedback for your marker" : "Add feedback"}
            <textarea
              required
              maxLength={10000}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={
                asset.kind === "pdf"
                  ? "Mention the page number with your feedback…"
                  : "What would you like to say?"
              }
            />
          </label>
          <Feedback message={message} />
          <button
            className="button button-primary"
            disabled={busy || !text.trim()}
          >
            {busy ? "Saving…" : "Save feedback"}
          </button>
        </form>
      </aside>
    </div>
  );
}
export function ClientReview() {
  const { token } = useParams();
  const [data, setData] = useState<ReviewData | null>(null);
  const [message, setMessage] = useState("");
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState("");
  const load = async () => {
    const result = await api<ReviewData>(`/api/review/${token}`);
    setData(result);
  };
  useEffect(() => {
    void load().catch((e) => setMessage(e.message));
  }, [token]);
  if (!data)
    return (
      <div className="center-page">
        <div className="panel">
          <Brand />
          <h1>{message ? "Review unavailable" : "Loading review…"}</h1>
          <p role="alert">{message}</p>
        </div>
      </div>
    );
  const asset = data.assets[index];
  if (!asset)
    return <div className="center-page">No assets in this review.</div>;
  async function decide() {
    setBusy(true);
    try {
      await api(`/api/review/${token}/decision`, {
        method: "POST",
        body: JSON.stringify({
          assetId: asset.id,
          assetVersionId: asset.version_id,
          decision: confirm,
        }),
      });
      await load();
      setMessage(
        confirm === "approved"
          ? "Approval saved. Thank you!"
          : "Changes requested. Your feedback is saved.",
      );
      setConfirm("");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="client-review-page">
      <header>
        <Brand compact />
        <div className="review-brand-info">
          <b>{data.project_name}</b>
          <span>for {data.company_name}</span>
        </div>
        <div className="reviewer-chip">
          Reviewing as {data.reviewer_name || data.reviewer_email}
        </div>
      </header>
      <div className="review-progress">
        <span
          style={{
            width: `${(data.assets.filter((a) => a.status === "approved").length / data.assets.length) * 100}%`,
          }}
        />
      </div>
      <main>
        <div className="client-review-title">
          <div>
            <div className="eyebrow">
              {asset.kind} · Version {asset.latest_version_no}
            </div>
            <h1>{asset.name}</h1>
            <p>{statusLabel(asset.status)}</p>
          </div>
          <div className="nav-arrows">
            <button
              disabled={index === 0}
              onClick={() => {
                setIndex(index - 1);
                setMessage("");
              }}
            >
              Previous
            </button>
            <span>
              {index + 1} / {data.assets.length}
            </span>
            <button
              disabled={index === data.assets.length - 1}
              onClick={() => {
                setIndex(index + 1);
                setMessage("");
              }}
            >
              Next
            </button>
          </div>
        </div>
        <Feedback message={message} />
        {data.assets.every((a) => a.status === "approved") && (
          <div className="panel">
            <h2>All content approved.</h2>
            <p>Your decisions have been saved and shared with the designer.</p>
          </div>
        )}
        <FeedbackPanel
          key={asset.version_id}
          asset={asset}
          token={token}
          comments={data.comments.filter((c) => c.asset_id === asset.id)}
          onSave={load}
        />
      </main>
      <footer className="client-review-actions">
        <span>Save your comments before submitting a decision.</span>
        <div>
          <button
            className="button request"
            disabled={busy}
            onClick={() => setConfirm("changes_requested")}
          >
            Request changes
          </button>
          <button
            className="button approve"
            disabled={busy || asset.status === "approved"}
            onClick={() => setConfirm("approved")}
          >
            {asset.status === "approved" ? "Approved" : "Approve"}
          </button>
        </div>
      </footer>
      {confirm && (
        <div className="decision-modal">
          <div className="decision-card">
            <h2>
              {confirm === "approved"
                ? "Approve this version?"
                : "Request changes?"}
            </h2>
            <p>
              Your decision will be saved for version {asset.latest_version_no}.
            </p>
            <button
              className="button button-primary"
              disabled={busy}
              onClick={() => void decide()}
            >
              {busy ? "Saving…" : "Confirm"}
            </button>
            <button
              className="button button-ghost"
              disabled={busy}
              onClick={() => setConfirm("")}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
export function AgencyAssetReview() {
  const { id } = useParams();
  const { assets } = useWorkspace();
  const asset = assets.find((a) => a.id === id);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [message, setMessage] = useState("");
  const load = async () =>
    setComments(await api<CommentRow[]>(`/api/assets/${id}/comments`));
  useEffect(() => {
    void load().catch((e) => setMessage(e.message));
  }, [id]);
  if (!asset)
    return (
      <Frame title="Asset not found">
        <Link to="/app/projects">Back to projects</Link>
      </Frame>
    );
  return (
    <Frame
      title={asset.name}
      eyebrow={`${statusLabel(asset.status)} · VERSION ${asset.latest_version_no}`}
      action={
        <Link className="button button-primary" to={`/app/upload?asset=${id}`}>
          Upload new version
        </Link>
      }
    >
      <p>
        <Link to={`/app/projects/${asset.project_id}`}>Back to project</Link>
      </p>
      <Feedback message={message} />
      <FeedbackPanel
        key={asset.version_id}
        asset={asset}
        comments={comments}
        onSave={load}
      />
    </Frame>
  );
}
