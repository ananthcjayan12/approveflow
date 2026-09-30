# ApproveFlow architecture

```text
Browser / PWA
  │
  ├── React + Vite static assets
  │
  ├── Agency APIs ───────────────┐
  ├── Public review link APIs ───┤
  └── Razorpay checkout ─────────┤
                                 ▼
                    One Cloudflare Worker (Hono)
                    ├── auth + sessions
                    ├── clients/projects/assets
                    ├── review-link authorization
                    ├── annotation/approval APIs
                    ├── R2 URL signing
                    ├── Razorpay webhook verification
                    └── reminder cron
                         │             │
                    ┌────▼────┐   ┌────▼─────┐
                    │   D1    │   │ private  │
                    │metadata │   │    R2    │
                    └─────────┘   └──────────┘
```

## Video cost control

Large video is kept cheap by separating **metadata** from **bytes**.

- Annotation comments are D1 rows: timestamp/range + optional normalized X/Y location.
- Video itself is a single R2 object per version.
- Upload is direct to R2, so Worker CPU/bandwidth is not proportional to file size.
- Smaller files use a presigned PUT.
- Large files use S3 multipart upload with 64 MiB parts and a few parallel requests.
- Exact object byte sizes are tracked in D1 so workspace quota checks do not need to list the bucket.
- Previous revisions can be deleted/archive-retained by plan after an age threshold; final approved versions can have longer retention.

## Suggested storage limits

- Free: 1 GB
- Solo: 10 GB
- Freelancer: 50 GB
- Agency: 150 GB

Keep values configurable server-side rather than hard-coding them into the frontend.

## Review annotations

All coordinates are normalised to the media frame (0..1), so the same markup appears correctly at any viewport
size and zoom level. Stroke widths are stored in per-mille of the media width for the same reason.

Each comment has at most one row in `annotations`:

| Column | Meaning |
|---|---|
| `kind` | `point`, `rectangle`, `drawing` (images) · `video_timestamp`, `video_range` (video) |
| `x` `y` `width` `height` | Bounding box of the markup (kept queryable; older readers still see an anchor) |
| `timestamp_ms` | A single moment in a video |
| `start_ms` `end_ms` | A selected portion of a video |
| `shape_json` | `{"v":1,"shapes":[...]}` — the actual markup (added in migration `0004`) |

Shapes are one of `pin`, `rect`, `ellipse`, `arrow`, `pen` and `highlight`, each with a colour (`c`, `#rrggbb`) and
a size (`s`). The Worker validates them strictly (points inside 0..1, at most 40 shapes, at most 600 points per
stroke, 64 KB of JSON) before storing anything, and derives the bounding box itself when a client omits it.
Comments made before this feature (a bare `x`/`y`) are still shown, as pins.

Video markup is attached to a frame: a `video_timestamp` keeps its markup on screen for about a second after the
moment, and a `video_range` shows it for the whole portion. No duplicate video is generated when a reviewer comments.

Both reviewers (`POST /api/review/:token/comments`) and the designer (`POST /api/assets/:id/comments`) can send
markup with a comment; replies from the designer are signed with the studio name.

## Sessions

Signing in sets an `approveflow_session` cookie (HttpOnly, Secure, SameSite=Lax, 30 days); only a SHA-256 hash of the
token is stored. Sessions are independent, so signing in on a second device, or again later, never disturbs another
session, and logging out ends only the current one.

- **Sliding expiry.** While the app is in use the session is extended (and its cookie re-issued) at most about once a
  day, on `GET /api/workspace`, which the app calls on every load and when the tab regains focus. An active person is
  never signed out; an idle session still ends after 30 days. Expired sessions are removed at the next login.
- **Session-aware public pages.** `/`, `/login` and `/signup` send an already-signed-in visitor to the dashboard (or to
  the `next` page), so typing the address or letting the browser autocomplete to `/login` never asks for a second login.
  Visit `/?site` to see the marketing page while signed in. A small `af-signed-in` hint in `localStorage` lets returning
  visitors skip the flash of the marketing page; the server remains the authority and a 401 clears the hint.
- **Deep links survive re-login.** A 401 inside the app redirects to `/login?next=<path>&reason=expired`; after signing in
  the person lands back where they were. `next` is only followed for `/app…` and `/onboarding…` paths, never other sites.

