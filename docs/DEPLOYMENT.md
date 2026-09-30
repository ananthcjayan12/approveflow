# Cloudflare deployment

ApproveFlow now uses the same self-provisioning deployment pattern as PostPilot. GitHub Actions is the source of truth for production deployment.

## What the workflow creates automatically

On the first deployment it creates or configures:

- the Cloudflare Worker;
- the D1 database;
- the private R2 media bucket;
- D1 and R2 Worker bindings;
- the R2 CORS rule used by presigned browser uploads/downloads;
- an R2 lifecycle rule that aborts abandoned multipart uploads after 48 hours;
- the Worker cron trigger from `wrangler.jsonc`;
- the Worker custom-domain binding when `APP_ORIGIN` is a custom HTTPS origin.

On later deployments, D1 and R2 are found by name and reused.

The provisioner refuses to continue if the configured R2 bucket has an enabled public `r2.dev` domain or enabled R2 custom public domain.

## GitHub secrets

All configuration lives in **GitHub → Settings → Secrets and variables → Actions → Secrets**. Create the Cloudflare account, enable R2, configure a Workers subdomain, and issue the credentials once. After that, there are no resources to create manually and no config files to edit: add or change a secret, then push to `main` (or run the workflow manually), and the workflow provisions and deploys everything.

Every non-sensitive setting below may alternatively be stored as a repository **variable** with the same name; a secret takes precedence when both exist.

### Required

```text
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
```

The API token must be able to manage the Worker, D1 and R2 resources in the selected Cloudflare account. Custom-domain deployment also requires the relevant custom-domain/zone permission.

### Required for direct R2 media uploads

```text
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
```

These are the R2 S3-compatible credentials used by the Worker only to create short-lived presigned URLs. They are never exposed as Worker variables or committed to the repository.

### Optional integrations

```text
RESEND_API_KEY

RAZORPAY_KEY_ID
RAZORPAY_KEY_SECRET
RAZORPAY_WEBHOOK_SECRET
RAZORPAY_PLAN_SOLO
RAZORPAY_PLAN_FREELANCER
RAZORPAY_PLAN_AGENCY
```

If Razorpay is enabled, all three plan IDs and the webhook secret are required.

### Optional settings

```text
APP_ORIGIN
WORKER_NAME
D1_DATABASE_NAME
R2_BUCKET_NAME

EMAIL_FROM
MAX_SINGLE_UPLOAD_BYTES
MAX_VIDEO_BYTES
DEFAULT_STORAGE_QUOTA_BYTES
```

Defaults:

```text
WORKER_NAME=approveflow
D1_DATABASE_NAME=<WORKER_NAME>-db
R2_BUCKET_NAME=<WORKER_NAME>-media
EMAIL_FROM=ApproveFlow <approvals@example.com>
MAX_SINGLE_UPLOAD_BYTES=104857600
MAX_VIDEO_BYTES=5368709120
DEFAULT_STORAGE_QUOTA_BYTES=10737418240
```

GitHub masks secret values in logs, so a setting such as `APP_ORIGIN` stored as a secret appears as `***` in the run output. Store it as a variable instead if you want it visible.

`APP_ORIGIN` is optional. If it is absent, the provisioner looks up the account's Workers subdomain and deploys to:

```text
https://<WORKER_NAME>.<workers-subdomain>.workers.dev
```

If `APP_ORIGIN` is set, it must be an HTTPS origin with no path or trailing slash, for example:

```text
https://approve.example.com
```

The generated Wrangler config binds that hostname as a Worker custom domain automatically. The hostname/zone must already belong to the Cloudflare account.

## Deployment flow

```text
push main / workflow_dispatch
        │
        ▼
npm ci
typecheck
tests
build
        │
        ▼
deploy:prepare
        │
        ├── validate settings
        ├── create/reuse D1
        ├── create/reuse private R2
        ├── configure CORS
        ├── configure multipart cleanup
        ├── resolve production origin
        └── generate wrangler.generated.json
        │
        ▼
apply D1 migrations using generated config
        │
        ▼
deploy Worker + React static assets + secrets
        │
        ▼
smoke test public deployment
```

The deploy is serialized with the `approveflow-production` concurrency group so two production database/deployment jobs do not race.

## Generated files

The workflow creates these temporarily:

- `wrangler.generated.json`
- `.cloudflare-state.json`

They are ignored by Git and contain resolved deployment metadata, not application source.

## R2 CORS

The workflow owns a single rule named `approveflow-direct-media`. It allows the deployed app origin to use:

- `GET`
- `HEAD`
- `PUT`
- the `content-type` request header
- the `ETag` response header

Other existing CORS rules are preserved.

## R2 lifecycle

The workflow owns a lifecycle rule named `approveflow-abort-incomplete-multipart`, which aborts abandoned multipart uploads after 48 hours. Other lifecycle rules are preserved.

## Razorpay webhook

Razorpay remains an external service, so its webhook endpoint must be configured in Razorpay:

```text
https://YOUR_APP_ORIGIN/api/webhooks/razorpay
```

Use the same secret value in the GitHub secret `RAZORPAY_WEBHOOK_SECRET`.

## Local development

Local development continues to use the checked-in `wrangler.jsonc`:

```bash
npm ci
npm run db:migrate:local
npm run dev
```

Production uses `wrangler.generated.json`; do not put a real production D1 database ID into the checked-in config.

## Trial deployment checklist

1. Commit the app, `package-lock.json`, and workflow to the GitHub repository.
2. Add the four required secrets: `CLOUDFLARE_API_TOKEN`,
   `CLOUDFLARE_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`.
   The S3 credentials must permit read/write access to the provisioned bucket.
3. Optionally add `RESEND_API_KEY` and a verified `EMAIL_FROM`. Validation rejects
   missing/example senders when email is enabled. Razorpay is optional.
4. Push to `main` or run **Deploy ApproveFlow to Cloudflare** on `main`.
5. Open the URL in the Actions summary, create your account, and run one review
   in a private browser window before giving the URL to your friend.

The workflow runs `npm ci`, checks/builds the app, and runs `npm run test:trial`
against isolated local storage before contacting Cloudflare. R2 credentials are
mandatory so successful deployment includes functional media uploads.
Sessions use random, hashed database tokens and HTTP-only cookies; no additional
`SESSION_SECRET` is needed. Credentials are uploaded as Worker secrets, never
bundled into browser JavaScript. Provider account creation, billing activation,
verified email senders and Razorpay webhook setup remain provider-side steps.
