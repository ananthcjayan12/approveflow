# ApproveFlow

ApproveFlow is a lightweight client-approval platform for social-media managers and small creative agencies. Clients can review images, carousels and video from a secure link without creating an account, approve content, request changes, place visual pins on images, and attach comments to video timestamps/ranges.

This repository is Cloudflare-first and designed to stay inexpensive:

- **React + TypeScript + Vite** for the PWA/web UI
- **One Cloudflare Worker + Hono** for APIs and static delivery
- **Cloudflare D1** for relational metadata, approvals, comments, audit history and billing state
- **Private Cloudflare R2** for originals, versions and thumbnails
- **Direct browser → R2 uploads** using S3-compatible presigned URLs; large videos use multipart upload
- **Razorpay only** for SaaS subscription billing
- **Resend** for approval/reminder emails when configured
- **Cron Trigger every 30 minutes** for reminders

## Design

A calm, modern SaaS look: cool neutral surfaces, one indigo brand colour, semantic status colours, and a dark
theme that follows the system (or the user's choice). Every colour is a design token in
`apps/web/src/styles/tokens.css`, and every text/background pairing was checked against WCAG AA. The media
stage used for reviewing is always dark, like a photo viewer. See [`docs/DESIGN.md`](docs/DESIGN.md).

The whole app is responsive: a sidebar on desktop, an icon rail on tablets, and a top bar with bottom tabs on
phones. Review and markup work with mouse, touch and pen.

## Reviewing: markup, zoom and video timelines

Clients (and you, when replying) can mark up work directly:

| On images | On video |
|---|---|
| Pin a comment to an exact spot | Comment on the current moment |
| Freehand pen and highlighter | Drag on the timeline to select a **portion** (or press `I` / `O`) |
| Boxes, circles and arrows | See only the comments inside a selected portion |
| 9 colours, 3 thicknesses, undo | Draw on the paused frame with the same tools |
| Pinch / scroll-wheel zoom, pan | Frame-step, speed, mute, fullscreen, comment markers on the timeline |

Keyboard shortcuts: `V` move, `C` pin, `D` draw, `H` highlight, `R` box, `E` circle, `A` arrow, `⌘/Ctrl+Z`
undo, `+` `-` `0` zoom, `Enter` write a comment, `Esc` cancel. On video: `Space` play/pause, `←` `→` step a
frame (`Shift` = 5 s), `I` / `O` set the portion start / end, `M` mute, `F` fullscreen.

Markup is stored as small, validated JSON with coordinates normalised to the media frame, so it lines up at any
screen size. See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md#review-annotations).

## Quick start

```bash
npm ci
npm run db:migrate:local
npm run dev
```

The web app runs on Vite and the Worker runs via Wrangler. Run both services for the functional trial. Local uploads up to 100 MiB use local R2 storage; production uploads go directly to R2.

## Zero-touch Cloudflare deployment

Production deployment now follows the same model as PostPilot.

**You do not manually create the D1 database, R2 bucket, Worker, CORS rules, lifecycle rule, D1 binding, R2 binding, or custom-domain Worker binding.**

On every production deployment the workflow:

1. validates the application;
2. creates the configured D1 database if it does not exist;
3. creates the configured private R2 bucket if it does not exist;
4. refuses to deploy if that bucket is publicly exposed;
5. configures R2 CORS for direct browser uploads/downloads;
6. configures automatic cleanup of abandoned multipart uploads;
7. generates `wrangler.generated.json` with the real D1 database ID and R2 bucket;
8. applies D1 migrations;
9. deploys the Worker and its static React assets;
10. runs production smoke tests.

Existing resources are detected and reused, so the workflow is safe to run repeatedly.

### GitHub secrets

Everything is configured through GitHub Actions secrets only — no manual Cloudflare setup and no config files to edit. Add or update secrets, then push to `main`.

Required for Cloudflare provisioning/deployment:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Required for direct R2 browser upload signing:

- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`

Optional application integrations:

- `RESEND_API_KEY`
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`

The Cloudflare API token needs permission to manage Workers, D1 and R2. If `APP_ORIGIN` is a custom domain, the token also needs the permissions required to bind that Worker custom domain.

### Optional settings

These are also read from GitHub secrets. Because they are not sensitive, you may store them as repository variables with the same name instead; a secret wins if both exist. All are optional unless the corresponding integration is enabled:

- `APP_ORIGIN` — e.g. `https://approve.example.com`. If omitted, the workflow uses `https://<WORKER_NAME>.<account>.workers.dev`.
- `WORKER_NAME` — defaults to `approveflow`
- `D1_DATABASE_NAME` — defaults to `<WORKER_NAME>-db`
- `R2_BUCKET_NAME` — defaults to `<WORKER_NAME>-media`
- `EMAIL_FROM` — defaults to `ApproveFlow <approvals@example.com>`
- `MAX_SINGLE_UPLOAD_BYTES` — defaults to 100 MiB
- `MAX_VIDEO_BYTES` — defaults to 5 GiB
- `DEFAULT_STORAGE_QUOTA_BYTES` — defaults to 10 GiB
- `RAZORPAY_PLAN_SOLO`
- `RAZORPAY_PLAN_FREELANCER`
- `RAZORPAY_PLAN_AGENCY`

If Razorpay credentials are supplied, all three Razorpay plan IDs and the webhook secret are required.

### Deploy

After the GitHub secrets above are configured, merge/push to `main`. The production workflow does the rest.

You can also trigger **Deploy ApproveFlow to Cloudflare** manually from GitHub Actions.

The generated config/state files are deployment artifacts only and are not committed:

```text
wrangler.generated.json
.cloudflare-state.json
```

## Important production notes

- Review links are generated as random tokens; only a SHA-256 hash is persisted.
- Billing state is driven by verified Razorpay webhooks, not the browser callback.
- Direct-upload APIs support a single PUT for smaller media and multipart upload for large files. GB-sized video bodies do not pass through the Worker.
- Storage quotas are enforced before upload initiation.
- Do not market unlimited video storage; use plan limits and retention rules for old revisions.
- R2 S3 credentials are still supplied as GitHub secrets because they are used to sign direct browser uploads. The bucket itself is created automatically.

See `docs/DEPLOYMENT.md` for the complete setup and `docs/ARCHITECTURE.md` for the data-flow design.

## Functional trial

Create an account at `/signup`, then add a client and project. Upload images,
PDFs or videos, select the assets in **Send for approval**, and copy the generated
link to another browser. Reviewers can save comments, pin feedback to images,
comment on video timestamps/ranges, and approve or request changes without an
account. The designer can read and reply to feedback and upload a new version.
The dashboard, activity and storage screens use saved workspace data.

Carousel slides are uploaded as individual images for this trial. PDFs support preview and text comments
(include the page number). Side-by-side version comparison, team management, password recovery and email
verification are not implemented. Unavailable demo controls have been removed. Email delivery requires Resend;
without it, copy/share links work normally. Billing remains unavailable unless Razorpay is configured.

Run `npm run build && npm run test:trial` to exercise the complete API workflow
against an isolated local Worker, D1 database and R2 bucket. This creates temporary
test accounts and storage, removes them afterwards, and never uses production data.
GitHub runs this check before provisioning or deploying.
