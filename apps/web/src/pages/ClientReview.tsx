import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  ExternalLink,
  MousePointerClick,
  PartyPopper,
  Pencil,
  ThumbsUp,
} from "lucide-react";
import { Brand } from "../components/Brand";
import { FeedbackPanel } from "../components/FeedbackPanel";
import { ThemeToggle } from "../components/ThemeToggle";
import { Modal, Notice, ProgressBar, Thumb } from "../components/ui";
import { api } from "../lib/api";
import { formatDate, kindLabel } from "../lib/format";
import { AssetRow, CommentRow, mediaUrl } from "../lib/workspace";

type ReviewData = {
  project_name: string;
  company_name: string;
  workspace_name?: string;
  brand_color?: string | null;
  message?: string | null;
  due_at?: string | null;
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

const firstName = (full: string) => (full || "").split(/\s+/).find((w) => w && !w.endsWith(".")) ?? "";

function Welcome({ data, onStart }: { data: ReviewData; onStart: () => void }) {
  const name = firstName(data.reviewer_name);
  const n = data.assets.length;
  const hasVideo = data.assets.some((a) => a.kind === "video");
  return (
    <Modal title="How to review" onClose={onStart} wide>
      <div className="welcome">
        <h2>{name ? `Hi ${name}!` : "Hi there!"}</h2>
        <p>
          {n} {n === 1 ? "item" : "items"} from <b>{data.workspace_name || data.project_name}</b> {n === 1 ? "is" : "are"} ready for your
          review{data.due_at ? <> — a decision is needed by <b>{formatDate(data.due_at)}</b></> : ""}. It only takes a minute.
        </p>
        {data.message?.trim() && (
          <div className="welcome-note">
            <small>A note from {data.workspace_name || "your designer"}</small>
            {data.message.trim()}
          </div>
        )}
        <ol className="how-steps">
          <li>
            <span className="stat-icon tone-blue"><MousePointerClick size={18} /></span>
            <div>
              <b>Point at what you mean</b>
              <span>Tap the image to drop a pin. {hasVideo ? "On videos, drag along the timeline to select a portion." : "You can also zoom in for detail."}</span>
            </div>
          </li>
          <li>
            <span className="stat-icon tone-amber"><Pencil size={18} /></span>
            <div>
              <b>Draw, highlight or circle it</b>
              <span>Pick the pen, highlighter, box or arrow from the toolbar, then write what should change.</span>
            </div>
          </li>
          <li>
            <span className="stat-icon tone-green"><ThumbsUp size={18} /></span>
            <div>
              <b>Approve or request changes</b>
              <span>Use the buttons for each item. You can change your mind later.</span>
            </div>
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
      <div className="done-inner">
        <span className="success-icon big">
          <PartyPopper size={40} />
        </span>
        <h1>All done — thank you!</h1>
        <p>Your feedback has been sent to {data.workspace_name || "the team"}. You can close this page now.</p>
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
    </div>
  );
}

function DecisionButtons({
  asset,
  busy,
  onApprove,
  onRequest,
}: {
  asset: AssetRow;
  busy: boolean;
  onApprove: () => void;
  onRequest: () => void;
}) {
  return (
    <>
      <button className="button button-danger-outline" disabled={busy} onClick={onRequest}>
        Request changes
      </button>
      <button className="button button-success" disabled={busy || asset.status === "approved"} onClick={onApprove}>
        <Check size={17} strokeWidth={3} /> {asset.status === "approved" ? "Approved" : "Approve"}
      </button>
    </>
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
  useEffect(() => {
    if (data) document.title = `Review · ${data.project_name}`;
  }, [data]);

  const assets = data?.assets ?? [];
  const asset = assets.length ? assets[Math.min(index, assets.length - 1)] : null;
  const comments = useMemo(() => (data && asset ? data.comments.filter((c) => c.asset_id === asset.id) : []), [data, asset]);

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

  if (!asset)
    return (
      <div className="center-page">
        <div className="card center-card">
          <h2>Nothing to review</h2>
          <p className="muted">This link doesn’t contain any files right now.</p>
        </div>
      </div>
    );

  const doneCount = assets.filter(decided).length;
  const allDone = doneCount === assets.length;
  const mineOnThis = comments.filter((c) => c.asset_version_id === asset.version_id).length;

  const go = (i: number) => {
    setIndex(Math.max(0, Math.min(assets.length - 1, i)));
    setError("");
  };
  const nextPending = (fresh: AssetRow[]) => {
    for (let step = 1; step <= fresh.length; step++) {
      const i = (index + step) % fresh.length;
      if (!decided(fresh[i])) return i;
    }
    return -1;
  };

  async function decide(decision: "approved" | "changes_requested", note = "") {
    if (!asset) return;
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

  const decisionButtons = (
    <DecisionButtons asset={asset} busy={busy} onApprove={() => void decide("approved")} onRequest={() => setAsking(true)} />
  );

  return (
    <div className="rv">
      <header className="rv-header">
        <div className="rv-id">
          <Brand compact />
          <div className="rv-title">
            <h1>{data.project_name}</h1>
            <span>
              {data.workspace_name ? `${data.workspace_name} · ` : ""}for {data.company_name}
            </span>
          </div>
        </div>
        <div className="rv-progress" aria-label="Review progress">
          <span className="rv-progress-full">
            <b>{doneCount}</b> of {assets.length} reviewed
          </span>
          <span className="rv-progress-short" aria-hidden>
            <b>{doneCount}</b>/{assets.length}
          </span>
          <ProgressBar value={(doneCount / assets.length) * 100} tone="green" label="Review progress" />
        </div>
        <div className="rv-actions">
          <ThemeToggle className="icon-button ghost theme-hide" />
          <button className="icon-button ghost" aria-label="How to review" data-tip="How to review" onClick={() => setWelcome(true)}>
            <CircleHelp size={18} />
          </button>
          <div className="decision-buttons">{decisionButtons}</div>
        </div>
      </header>

      {allDone && showDone ? (
        <AllDone data={data} onBack={() => setShowDone(false)} />
      ) : (
        <>
          <div className={`rv-body${assets.length > 1 ? "" : " single"}`}>
            {assets.length > 1 && (
              <nav className="rv-rail" aria-label="Items to review">
                {assets.map((a, i) => (
                  <button
                    key={a.id}
                    className={`film ${i === index ? "current" : ""}`}
                    onClick={() => go(i)}
                    aria-label={`Item ${i + 1}: ${a.name}`}
                    aria-current={i === index}
                  >
                    <Thumb asset={a} token={token} />
                    <span className="film-num">{i + 1}</span>
                    {decided(a) && (
                      <span className={`film-mark tone-${a.status === "approved" ? "green" : "red"}`}>
                        {a.status === "approved" ? <Check size={11} strokeWidth={3.4} /> : <AlertCircle size={11} strokeWidth={3} />}
                      </span>
                    )}
                  </button>
                ))}
              </nav>
            )}

            <main className="rv-main">
              <Notice message={error} tone="error" />
              <FeedbackPanel
                key={asset.version_id}
                asset={asset}
                token={token}
                comments={comments}
                onSave={load}
                stageHeader={
                  <div className="stage-top">
                    {assets.length > 1 && (
                      <div className="pager">
                        <button aria-label="Previous item" disabled={index === 0} onClick={() => go(index - 1)}>
                          <ChevronLeft size={17} />
                        </button>
                        <span>
                          {index + 1} / {assets.length}
                        </span>
                        <button aria-label="Next item" disabled={index === assets.length - 1} onClick={() => go(index + 1)}>
                          <ChevronRight size={17} />
                        </button>
                      </div>
                    )}
                    <div className="stage-title">
                      <b>{asset.name}</b>
                      <span>
                        {kindLabel[asset.kind] ?? asset.kind}
                        {asset.latest_version_no > 1 && ` · Version ${asset.latest_version_no}`}
                      </span>
                    </div>
                    <div className="stage-actions">
                      {status && (
                        <span className={`badge tone-${status.tone}`}>{status.label}</span>
                      )}
                      <a className="icon-button" href={mediaUrl(asset, token)} target="_blank" rel="noreferrer" aria-label="Open original file" data-tip="Open original">
                        <ExternalLink size={16} />
                      </a>
                    </div>
                  </div>
                }
              />
            </main>
          </div>

          <footer className="rv-decision">{decisionButtons}</footer>
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
