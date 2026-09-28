# Deployment checklist

The GitHub Actions files intentionally mirror the deployment philosophy used by the referenced PostPilot project: validate on PRs, serialize production deployments, run migrations before deploy, then smoke-test the public app.

## GitHub secrets

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Worker application secrets should be configured with Wrangler / Cloudflare once and are retained across deployments:

- `SESSION_SECRET`
- `RESEND_API_KEY`
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`
- `RAZORPAY_PLAN_SOLO`
- `RAZORPAY_PLAN_FREELANCER`
- `RAZORPAY_PLAN_AGENCY`

## GitHub variable

- `APP_ORIGIN` e.g. `https://approveflow.example.com`

## R2 CORS

Because browsers upload directly to presigned R2 URLs, configure CORS on the private bucket for your app origin. Allow `PUT`, `GET`, `HEAD`; allow `content-type`; expose `ETag` so multipart uploads can be completed.

## Razorpay webhook

Configure Razorpay to send subscription/payment events to:

`https://YOUR_DOMAIN/api/webhooks/razorpay`

Use the same webhook secret in `RAZORPAY_WEBHOOK_SECRET`.
