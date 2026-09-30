import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Eye,
  MessageSquare,
  PartyPopper,
  ThumbsUp,
} from "lucide-react";
import { Brand } from "../components/Brand";
import { FeedbackPanel } from "../components/FeedbackPanel";
import { Modal, Notice, ProgressBar, Thumb } from "../components/ui";
import { api } from "../lib/api";
import { AssetRow, CommentRow } from "../lib/workspace";

type ReviewData = {
  project_name: string;
  company_name: string;
  reviewer_name: string;
  reviewer_email: string;
  assets: AssetRow[];
  comments: CommentRow[];
};

/** Labels written from the reviewer's point of view. */
const clientStatus: Record<string, { label: string; tone: string }> = {
  approved: { label: "You approved this", tone: "green" },
  changes_requested: { label: "You asked for changes", tone: "red" },
  revised: { label: "Updated — please check again", tone: "blue" },
};
const decided = (a: AssetRow) => a.status === "approved" || a.status === "changes_requested";

const storage = {
  get: (key: string) => {
    try {
      return sessionStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set: (key: string) => {
    try {
      sessionStorage.setItem(key, "1");
    } catch {
      /* private mode — welcome shows again next time, which is fine */
    }
  },
};

function Welcome({ data, onStart }: { data: ReviewData; onStart: () => void }) {
  // "Dr. Priya Shah" → "Priya"; skip titles so the greeting sounds natural.
  const name = (data.reviewer_name || "").split(/\s+/).find((w) => w && !w.endsWith(".")) ?? "";
  const n = data.assets.length;
  return (
    <Modal title="How to review" onClose={onStart}>
      <div className="welcome">
        <h2>{name ? `Hi ${name}!` : "Hi there!"}</h2>
        <p>
          {n} {n === 1 ? "item" : "items"} from <b>{data.project_name}</b> {n === 1 ? "is" : "are"} ready for your
          review. It only takes a minute.
        </p>
        <ol className="how-steps">
          <li>
            <span className="stat-icon tone-blue"><Eye size={18} /></span>
            <div><b>Look at each item</b><span>Use the arrows or the pictures at the top to move between them.</span></div>
          </li>
          <li>
            <span className="stat-icon tone-amber"><MessageSquare size={18} /></span>
            <div><b>Comment if something should change</b><span>Tap directly on an image to point at the exact spot.</span></div>
          </li>
          <li>
            <span className="stat-icon tone-green"><ThumbsUp size={18} /></span>
            <div><b>Approve or request changes</b><span>Use the big buttons at the bottom. You can change your mind later.</span></div>
          </li>
        </ol>
        <button className="button button-primary large full" onClick={onStart} autoFocus>
          Start reviewing
        </button>
        <p className="muted small center">No account or password needed.</p>
      </div>
    </Modal>
  );
}

function AllDone({ data, onBack }: { data: ReviewData; onBack: () => void }) {
  const approved = data.assets.filter((a) => a.status === "approved").length;
  const changes = data.assets.filter((a) => a.status === "changes_requested").length;
  return (
    <div className="done-screen">
      <span className="success-icon big">
        <PartyPopper size={40} />
      </span>
      <h1>All done — thank you!</h1>
      <p>Your feedback has been sent to the team. You can close this page now.</p>
      <div className="done-summary">
        <span className="tag tone-green">
          <CheckCircle2 size={15} /> {approved} approved
        </span>
        {changes > 0 && (
          <span className="tag tone-red">
            <AlertCircle size={15} /> {changes} need changes
          </span>
        )}
      </div>
      <button className="button button-secondary" onClick={onBack}>
        Look at them again
      </button>
    </div>
  );
}

export default function ClientReview() {
  const { token = "" } = useParams();
  const [data, setData] = useState<ReviewData | null>(null);
  const [loadError, setLoadError] = useState("");
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [asking, setAsking] = useState(false);
  const [changeText, setChangeText] = useState("");
  const [welcome, setWelcome] = useState(() => !storage.get(`af-welcomed-${token}`));
  const [showDone, setShowDone] = useState(true);

  const load = useCallback(async () => {
    setData(await api<ReviewData>(`/api/review/${token}`));
  }, [token]);
  useEffect(() => {
    void load().catch((e) => setLoadError(e.message));
  }, [load]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  if (!data)
    return (
      <div className="center-page">
        {loadError ? (
          <div className="card center-card">
            <Brand compact />
            <h2>This review link isn’t working</h2>
            <p className="muted">It may have expired or been replaced. Please ask the sender for a new link.</p>
          </div>
        ) : (
          <div className="loading" role="status">
            <span className="spinner" /> Loading your review…
          </div>
        )}
      </div>
    );

  if (!data.assets.length)
    return (
      <div className="center-page">
        <div className="card center-card">
          <h2>Nothing to review</h2>
          <p className="muted">This link doesn’t contain any files right now.</p>
        </div>
      </div>
    );

  const assets = data.assets;
  const asset = assets[Math.min(index, assets.length - 1)];
  const doneCount = assets.filter(decided).length;
  const allDone = doneCount === assets.length;
  const mineOnThis = data.comments.filter(
    (c) => c.asset_id === asset.id && c.asset_version_id === asset.version_id,
  ).length;

  const go = (i: number) => {
    setIndex(Math.max(0, Math.min(assets.length - 1, i)));
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const nextPending = (fresh: AssetRow[]) => {
    for (let step = 1; step <= fresh.length; step++) {
      const i = (index + step) % fresh.length;
      if (!decided(fresh[i])) return i;
    }
    return -1;
  };

  async function decide(decision: "approved" | "changes_requested", note = "") {
    setBusy(true);
    setError("");
    try {
      if (note.trim())
        await api(`/api/review/${token}/comments`, {
          method: "POST",
          body: JSON.stringify({ assetId: asset.id, assetVersionId: asset.version_id, body: note.trim() }),
        });
      await api(`/api/review/${token}/decision`, {
        method: "POST",
        body: JSON.stringify({ assetId: asset.id, assetVersionId: asset.version_id, decision }),
      });
      const fresh = await api<ReviewData>(`/api/review/${token}`);
      setData(fresh);
      setAsking(false);
      setChangeText("");
      setToast(decision === "approved" ? "Approved — thank you!" : "Got it — your changes were sent.");
      const next = nextPending(fresh.assets);
      if (next >= 0) setTimeout(() => go(next), 500);
      else setShowDone(true);
    } catch (err) {
      setError((err as Error).message);
      if (/new version/i.test((err as Error).message)) void load();
    } finally {
      setBusy(false);
    }
  }

  const status = clientStatus[asset.status];

  return (
    <div className="review-page">
      <header className="review-header">
        <Brand compact />
        <div className="review-title">
          <b>{data.project_name}</b>
          <span>for {data.company_name}</span>
        </div>
        <button className="icon-button" aria-label="How to review" title="How to review" onClick={() => setWelcome(true)}>
          <CircleHelp size={19} />
        </button>
      </header>

      {allDone && showDone ? (
        <AllDone data={data} onBack={() => setShowDone(false)} />
      ) : (
        <>
          <div className="review-progress">
            <span>
              <b>{doneCount}</b> of {assets.length} reviewed
            </span>
            <ProgressBar value={(doneCount / assets.length) * 100} tone="green" label="Review progress" />
          </div>

          {assets.length > 1 && (
            <nav className="filmstrip" aria-label="Items to review">
              {assets.map((a, i) => (
                <button
                  key={a.id}
                  className={`film ${i === index ? "current" : ""}`}
                  onClick={() => go(i)}
                  aria-label={`Item ${i + 1}: ${a.name}`}
                  aria-current={i === index}
                >
                  <Thumb asset={a} token={token} />
                  {decided(a) && (
                    <span className={`film-mark tone-${a.status === "approved" ? "green" : "red"}`}>
                      {a.status === "approved" ? <Check size={12} strokeWidth={3} /> : <AlertCircle size={12} />}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          )}

          <main className="review-main">
            <div className="review-item-head">
              <div>
                <span className="muted small">
                  Item {index + 1} of {assets.length}
                  {asset.latest_version_no > 1 && ` · Version ${asset.latest_version_no}`}
                </span>
                <h1>{asset.name}</h1>
              </div>
              {status && <span className={`badge tone-${status.tone}`}>{status.label}</span>}
            </div>
            <Notice message={error} tone="error" />
            <FeedbackPanel
              key={asset.version_id}
              asset={asset}
              token={token}
              comments={data.comments.filter((c) => c.asset_id === asset.id)}
              onSave={load}
            />
          </main>

          <footer className="decision-bar">
            <div className="decision-inner">
              <div className="pager">
                <button className="icon-button" disabled={index === 0} onClick={() => go(index - 1)} aria-label="Previous item">
                  <ChevronLeft size={20} />
                </button>
                <button
                  className="icon-button"
                  disabled={index === assets.length - 1}
                  onClick={() => go(index + 1)}
                  aria-label="Next item"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
              <div className="decision-buttons">
                <button className="button button-danger-outline large" disabled={busy} onClick={() => setAsking(true)}>
                  Request changes
                </button>
                <button
                  className="button button-success large"
                  disabled={busy || asset.status === "approved"}
                  onClick={() => void decide("approved")}
                >
                  <Check size={18} strokeWidth={3} /> {asset.status === "approved" ? "Approved" : "Approve"}
                </button>
              </div>
            </div>
          </footer>
        </>
      )}

      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} /> {toast}
        </div>
      )}

      {asking && (
        <Modal title="Request changes" onClose={() => !busy && setAsking(false)}>
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault();
              void decide("changes_requested", changeText);
            }}
          >
            <h2>What should be changed?</h2>
            <p className="muted">
              {mineOnThis
                ? `You’ve already left ${mineOnThis} ${mineOnThis === 1 ? "comment" : "comments"} on this item. Add anything else below, or just send.`
                : "Be as specific as you can — it helps the team get it right the first time."}
            </p>
            <textarea
              autoFocus
              rows={4}
              value={changeText}
              onChange={(e) => setChangeText(e.target.value)}
              placeholder="e.g. Please make the logo bigger and change the text to ‘Book now’."
              required={!mineOnThis}
            />
            <Notice message={error} tone="error" />
            <div className="form-actions">
              <button type="button" className="button button-ghost" disabled={busy} onClick={() => setAsking(false)}>
                Cancel
              </button>
              <button className="button button-danger large" disabled={busy || (!mineOnThis && !changeText.trim())}>
                {busy ? "Sending…" : "Send change request"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {welcome && (
        <Welcome
          data={data}
          onStart={() => {
            storage.set(`af-welcomed-${token}`);
            setWelcome(false);
          }}
        />
      )}
    </div>
  );
}
