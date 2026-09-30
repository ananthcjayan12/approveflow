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
