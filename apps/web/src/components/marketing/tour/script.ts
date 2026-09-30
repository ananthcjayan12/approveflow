/**
 * The landing-page product tour, as a pure function of time.
 *
 * `frame(t)` returns everything both devices need to draw themselves at time
 * `t` (milliseconds into the loop). There is no hidden state, so the tour can be
 * paused, scrubbed, jumped to a scene or rendered statically for reduced motion.
 */

export const LOOP = 35000;

export const SCENES = [
  {
    id: "upload",
    label: "Upload",
    at: 0,
    title: "Drop in the work",
    body: "Posts, carousels, reels and PDFs. Everything stays in private storage.",
  },
  {
    id: "send",
    label: "Send",
    at: 5900,
    title: "Send one private link",
    body: "Email it or paste it into WhatsApp. Reminders go out for you.",
  },
  {
    id: "review",
    label: "Review",
    at: 13000,
    title: "They point, draw and comment",
    body: "On a phone, with no login. You watch the feedback arrive, pinned to the exact spot.",
  },
  {
    id: "approve",
    label: "Approve",
    at: 26500,
    title: "Fix it, then it’s approved",
    body: "New versions land on the same link. One tap to approve, and your dashboard updates.",
  },
] as const;

/** A moment that shows each scene at its best, for reduced-motion and static previews. */
export const SCENE_POSTER = [4400, 11200, 25000, 32600];

export function sceneAt(t: number) {
  let i = 0;
  SCENES.forEach((s, n) => {
    if (t >= s.at) i = n;
  });
  return i;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
/** 0 before `a`, 1 after `b`, linear between. */
export const ramp = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
const typed = (s: string, t: number, a: number, b: number) => s.slice(0, Math.round(s.length * ramp(t, a, b)));

/** Where the offer line and button sit on the post, as percentages of the picture. */
export const SPOTS = {
  pin: { x: 37, y: 70 },
  boxA: { x: 7, y: 75 },
  boxB: { x: 37, y: 90 },
  range: { a: 4 / 12, b: 9 / 12 },
};

export const COMMENT_TEXT = ["Make the offer text bigger", "Make this button pop", "Trim this part"] as const;

export type Composer = { kind: "Pin" | "Box" | "Portion"; label: string; text: string; color: string } | null;

export function frame(t: number) {
  const scene = sceneAt(t);
  const start = SCENES[scene].at;
  const end = SCENES[scene + 1]?.at ?? LOOP;

  // ---- Upload
  const files = [0, 1, 2].map((i) => {
    const appear = 500 + i * 300;
    const pct = ramp(t, appear + 250, appear + 2000);
    return { shown: t >= appear, pct };
  });
  const uploadClick = 4300;

  // ---- Send
  const picks = [6400, 6550, 6700].map((a) => t >= a);
  const reminders = t >= 8450;
  const sending = t >= 9850 && t < 10500;
  const linkReady = t >= 10500;
  const copied = t >= 11650;

  // ---- Phone
  const phone: "lock" | "app" | "done" = t < 12900 ? "lock" : t < 30700 ? "app" : "done";
  const item: 0 | 2 = t < 22350 ? 0 : t < 27300 ? 2 : t < 29400 ? 0 : 2;
  const v2 = t >= 27300;

  const tool: "pin" | "box" | "hand" = t < 17850 ? "pin" : t < 22350 ? "box" : "hand";

  const pinPlaced = t >= 14200;
  const pinPosted = t >= 17050;
  const boxGrow = ramp(t, 18650, 19550);
  const boxPosted = t >= 21550;
  const range = ramp(t, 23100, 23900);
  const rangePosted = t >= 25550;
  const comments = (pinPosted ? 1 : 0) + (boxPosted ? 1 : 0) + (rangePosted ? 1 : 0);

  let composer: Composer = null;
  if (pinPlaced && !pinPosted) {
    composer = { kind: "Pin", label: "Pin", color: "#ef4444", text: typed(COMMENT_TEXT[0], t, 14600, 16200) };
  } else if (boxGrow >= 1 && !boxPosted) {
    composer = { kind: "Box", label: "Box", color: "#facc15", text: typed(COMMENT_TEXT[1], t, 19750, 20950) };
  } else if (range >= 1 && !rangePosted) {
    composer = { kind: "Portion", label: "0:04 – 0:09", color: "#9a9af8", text: typed(COMMENT_TEXT[2], t, 24100, 24900) };
  }

  const changesSent = t >= 26250 && t < 27300;
  const approved0 = t >= 28950;
  const approved2 = t >= 30050;

  // ---- Laptop
  const laptop: "upload" | "send" | "live" | "dash" = t < 5900 ? "upload" : t < 13000 ? "send" : t < 30700 ? "live" : "dash";
  const liveStatus: "waiting" | "changes" | "v2" | "approved" = t >= 28950 ? "approved" : t >= 27000 ? "v2" : t >= 26250 ? "changes" : "waiting";

  // ---- Dashboard
  const count = ramp(t, 31000, 32000);

  return {
    t,
    scene,
    sceneProgress: clamp01((t - start) / (end - start)),

    files,
    uploadClick,
    uploaded: t >= uploadClick,
    nextShown: t >= 4500,
    dragGhost: ramp(t, 150, 900),

    picks,
    reviewerGlow: t >= 7200 && t < 8300,
    reminders,
    sending,
    linkReady,
    copied,

    phone,
    notif: t >= 11900 && t < 12900,
    notifTap: t >= 12650,
    item,
    v2,
    tool,
    pinPlaced,
    pinPosted,
    boxGrow,
    boxPosted,
    range,
    rangePosted,
    comments,
    composer,
    changesSent,
    approved0,
    approved2,
    filmMarks: [
      approved0 ? "approved" : v2 ? "revised" : t >= 26250 ? "changes" : null,
      t >= 12900 ? "approved" : null,
      approved2 ? "approved" : v2 ? "revised" : t >= 26250 ? "changes" : null,
    ] as Array<"approved" | "changes" | "revised" | null>,
    timeLapse: t >= 26500 && t < 28100,

    laptop,
    viewing: t >= 13800,
    liveStatus,
    liveV2: t >= 27000,
    toast3: t >= 25550 && t < 27000,
    changesBadge: t >= 26250,

    count,
    dashToast: t >= 31100,
    dashEvents: [31100, 31500, 31900, 32300].map((a) => t >= a),

    /** Fades the picture out and back in around the loop point. */
    veil: Math.max(ramp(t, LOOP - 600, LOOP), 1 - ramp(t, 0, 400)),
  };
}

export type Frame = ReturnType<typeof frame>;

// ---- Pointers ---------------------------------------------------------------

export type Waypoint = {
  t: number;
  /** `data-cur` value of the element to move to. Omit to hide the pointer. */
  to?: string;
  /** Travel time in ms. The click happens when it arrives. */
  dur?: number;
  click?: boolean;
  /** Finger held down while travelling (drags). */
  down?: boolean;
};

export const CURSOR: Waypoint[] = [
  { t: 0, to: "dropzone-in", dur: 0 },
  { t: 150, to: "dropzone", dur: 750 },
  { t: 3300, to: "upload-btn", dur: 900, click: true },
  { t: 4900, to: "next-btn", dur: 700, click: true },
  { t: 7700, to: "toggle", dur: 700, click: true },
  { t: 9000, to: "submit", dur: 800, click: true },
  { t: 11000, to: "copy", dur: 600, click: true },
  { t: 12400 },
];

export const FINGER: Waypoint[] = [
  { t: 0 },
  { t: 12050, to: "notif", dur: 600, click: true },
  { t: 13300, to: "pin-spot", dur: 800, click: true },
  { t: 16300, to: "send-comment", dur: 600, click: true },
  { t: 17300, to: "tool-box", dur: 500, click: true },
  { t: 18100, to: "box-a", dur: 500 },
  { t: 18650, to: "box-b", dur: 900, down: true },
  { t: 20700, to: "send-comment", dur: 700, click: true },
  { t: 21800, to: "film-3", dur: 500, click: true },
  { t: 22600, to: "track-a", dur: 450 },
  { t: 23100, to: "track-b", dur: 800, down: true },
  { t: 24950, to: "send-comment", dur: 500, click: true },
  { t: 25700, to: "req-btn", dur: 500, click: true },
  { t: 26800 },
  { t: 28300, to: "approve-btn", dur: 600, click: true },
  { t: 29500, to: "approve-btn", dur: 500, click: true },
  { t: 30200 },
];

/** Index of the waypoint in force at time `t`, or -1 before the first. */
export function waypointAt(list: Waypoint[], t: number) {
  let i = -1;
  list.forEach((w, n) => {
    if (t >= w.t) i = n;
  });
  return i;
}
