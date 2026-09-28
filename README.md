# ApproveFlow

ApproveFlow is a lightweight client-approval platform for social-media managers and small creative agencies. The client can review images, carousels and video from a secure link without creating an account, approve content, request changes, place visual pins on images, and attach comments to video timestamps/ranges.

This repository is a Cloudflare-first starter designed to stay very inexpensive at small and medium scale:

- **React + TypeScript + Vite** for the PWA/web UI
- **One Cloudflare Worker + Hono** for APIs and static delivery
- **Cloudflare D1** for relational metadata, approvals, comments, audit history and billing state
- **Private Cloudflare R2** for originals, versions and thumbnails
- **Direct browser → R2 uploads** using S3-compatible presigned URLs; large videos use multipart upload
- **Razorpay only** for SaaS subscription billing
- **Resend** for approval/reminder emails when configured
- **Cron Trigger every 30 minutes** for reminders

## Theme

The interface intentionally follows the selected Srshti Creative Studio direction: charcoal/black surfaces, warm cream cards, golden-yellow primary actions, rust/orange accents, bold editorial serif headings and clean sans-serif UI copy.

## Quick start

```bash
npm install
npm run db:migrate:local
npm run dev
```

The web app runs on Vite and the Worker runs via Wrangler. For the quickest visual review, `npm run dev -w apps/web` is enough; the app contains demo data and local interactive flows.

## Cloudflare production setup

1. Create a D1 database named `approveflow-db`.
2. Create a **private** R2 bucket named `approveflow-media`.
3. Replace the D1 database ID in `wrangler.jsonc` or let CI inject your production config.
4. Configure R2 CORS to allow `PUT`, `GET`, `HEAD` from your production app origin and expose `ETag`.
5. Add Worker secrets:

```bash
npx wrangler secret put SESSION_SECRET
npx wrangler secret put R2_ACCOUNT_ID
npx wrangler secret put R2_ACCESS_KEY_ID
npx wrangler secret put R2_SECRET_ACCESS_KEY
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put RAZORPAY_KEY_ID
npx wrangler secret put RAZORPAY_KEY_SECRET
npx wrangler secret put RAZORPAY_WEBHOOK_SECRET
npx wrangler secret put RAZORPAY_PLAN_SOLO
npx wrangler secret put RAZORPAY_PLAN_FREELANCER
npx wrangler secret put RAZORPAY_PLAN_AGENCY
```

6. Apply migrations and deploy:

```bash
npm run deploy
```

## Important production notes

- The included Worker has a low-cost custom email/password session implementation so the starter does not require Clerk/Auth0. Add email verification and password-reset delivery before public launch.
- Review links are generated as random tokens; only a SHA-256 hash is persisted.
- Billing state must be driven by verified Razorpay webhooks, not by the browser callback.
- The direct-upload API supports single PUTs for smaller media and multipart uploads for large files. The browser never sends GB-sized video bodies through the Worker.
- Storage quotas are enforced before upload initiation. Keep plan limits server-side.
- Do not market unlimited video storage. Use plan storage limits and retention rules for old revisions.

See `docs/ARCHITECTURE.md` for the deployment/data-flow design.
