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

Image marker coordinates are normalized between 0 and 1 so the same annotation appears correctly at any viewport size.

Video annotations store either:

- `timestamp_ms`
- `start_ms` and `end_ms`
- optional normalized frame `x` / `y`

No duplicate video is generated when a reviewer comments.
