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
SESSION_SECRET
RESEND_API_KEY

RAZORPAY_KEY_ID
RAZORPAY_KEY_SECRET
RAZORPAY_WEBHOOK_SECRET
```

If Razorpay is enabled, configure all three Razorpay plan IDs as repository variables too.

## GitHub variables

```text
APP_ORIGIN
WORKER_NAME
D1_DATABASE_NAME
R2_BUCKET_NAME

EMAIL_FROM
MAX_SINGLE_UPLOAD_BYTES
MAX_VIDEO_BYTES
DEFAULT_STORAGE_QUOTA_BYTES

RAZORPAY_PLAN_SOLO
RAZORPAY_PLAN_FREELANCER
RAZORPAY_PLAN_AGENCY
```

Defaults:

```text
WORKER_NAME=approveflow
D1_DATABASE_NAME=<WORKER_NAME>-db
R2_BUCKET_NAME=<WORKER_NAME>-media
MAX_SINGLE_UPLOAD_BYTES=104857600
MAX_VIDEO_BYTES=5368709120
DEFAULT_STORAGE_QUOTA_BYTES=10737418240
```

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
npm install
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
npm install
npm run db:migrate:local
npm run dev
```

Production uses `wrangler.generated.json`; do not put a real production D1 database ID into the checked-in config.
