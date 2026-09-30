# ApproveFlow — how to log in and see every feature

This guide walks through the whole product: the agency workspace, the client review experience, and the backend features behind them.

> **Read this first — what's real today.**
> The web app is a **clickable, fully designed prototype** that runs on built-in demo data (Pixel Agency, SmileCraft Dental, "October Content", and so on). The backend API **is** real and is deployed with the app, but the screens are **not yet connected to it**. In practice:
>
> - **Log in / Sign up accept anything.** Any email and password take you straight into the demo workspace. No account is created and nothing is checked.
> - **Anything you create, approve or comment on in the UI is not saved.** Refreshing the page resets it.
> - **Upload** is the one screen that calls the real API. Because you are not really signed in, the API refuses it, and the page shows a simulated progress bar.
> - To see the **real** features (accounts, clients, projects, approval links, client comments and decisions, storage quota, uploads), use the API walkthrough in [Part 3](#part-3--exercise-the-real-backend).

---

## Part 1 — Open the app

### Production (deployed by GitHub Actions)

1. Open GitHub → **Actions** → the latest **Deploy ApproveFlow to Cloudflare** run on `main`.
2. The run summary shows **Application: https://…**. That is your app URL.
   - If you set `APP_ORIGIN`, it's that domain.
   - Otherwise it's `https://<WORKER_NAME>.<your-subdomain>.workers.dev` (default Worker name: `approveflow`).
   - If `APP_ORIGIN` is stored as a *secret*, GitHub shows it as `***`. Open your Cloudflare dashboard → **Workers & Pages** → `approveflow` to see the URL instead.
3. Check it's alive: open `https://YOUR-APP/health`. You should see `{"service":"approveflow-worker","ok":true,...}`.

### Local (optional)

```bash
npm install
npm run db:migrate:local
npm run dev
```

Open **http://localhost:5173**. The React app runs on 5173 and forwards `/api` to the Worker on 8787.

---

## Part 2 — Tour of the product (UI)

Follow these steps in order to see every screen. The path to each screen is shown in brackets.

### 1. Landing page (`/`)

- Hero: "Client approval without the chaos"
- Feature highlights: no client logins, visual annotations, automatic reminders
- "How it works": Upload once → Share one link → Get exact feedback → Move forward
- Buttons: **Get started**, **Log in**, **Pricing**, and **See client review** (jumps straight to the client experience, step 12)

### 2. Sign up (`/signup`)

- The form is pre-filled (`Ananth Jayan`, `hello@pixelagency.com`, `password123`). Click **Create account**.
- "Continue with Google" is a visual placeholder only.

### 3. Verify email (`/verify`)

- Shows the "Check your email" screen. Click **I verified my email**.

### 4. Onboarding (`/onboarding`)

The guided "get to your first approval fast" wizard:

1. Agency / freelancer name and brand colour
2. First client: company, contact name, email
3. First project: name and client
4. Upload files: PNG, JPG, WEBP, PDF, MP4, MOV
5. Reviewer email, message, and a **Send automatic reminders** toggle

Click through, or use **Skip setup** (top right) to go to the dashboard.

### 5. Log in (`/login`)

- Pre-filled with `hello@pixelagency.com` / `password123`. **Any values work.** Click **Log in** to open the dashboard.

### 6. Dashboard (`/app/dashboard`)

- Summary metrics across clients and projects
- **Recent projects**: October Content, Diwali Campaign, Summer Collection, Brand Refresh, each with approved / changes / waiting counts and a status
- **Recent activity**: approvals, change requests, reminders sent, new versions

The left sidebar gives you every section: Dashboard, Clients, Projects, Activity, Storage, Notifications, Billing, Settings.

### 7. Clients (`/app/clients`)

- Client cards for SmileCraft Dental, Milano Trips, Urban Brew and FitLife Gym, with project and asset counts, plus search
- **New client** (`/app/clients/new`): company name, contact, email, logo upload and notes
- Click **SmileCraft Dental** to open the **client detail** page: notes, projects, **Edit client** and **New project**

### 8. Projects (`/app/projects`)

- A table of all projects with filters (**All clients**, **All statuses**) and search
- **New project** (`/app/projects/new`): name, client, description, due date and **Approval mode** (*Approve each item* or *Approve entire campaign*)

### 9. Project detail (`/app/projects/october`)

Open **October Content**:

- An asset grid: Instagram posts, a *Myth vs Fact* carousel, *Smile Reel* (video), a story and a reel cover, each with a status pill
- Filter tabs: **All / Waiting / Approved / Changes**
- Tabs: **Comments**, **Activity**, **Settings**
- Buttons: **Add assets** (step 10), **Send for approval** (step 11), **Preview client view** (step 12)
- Click any asset to open the **agency asset review** (`/app/assets/:id`):
  - Version history (**V2 · current**, **V1 · changes requested**) and **Compare**
  - A threaded comment list tied to numbered markers ("Marker 1", "Marker 2"), with a reply box
  - **Mark approved**

### 10. Upload content (`/app/upload`)

- Drag files in, or click to browse (images, video, PDF). You can pick several at once.
- Click **Upload N files** to see per-file progress bars.
- Signed-in uploads go **directly from the browser to private R2**. Files up to 100 MB use one signed URL. Larger videos are split into 64 MB parts, four uploaded at a time, so a failed part can be retried without starting over.
- Because the UI isn't really signed in, you'll see the **simulated** progress fallback. See Part 3 for the real flow.

### 11. Send for approval (`/app/approvals/new`)

- Choose client, project and assets; enter reviewer email, message and "Review requested by"
- **Reminder schedule**: *24h, 72h, then creator* / *Every 3 days* / *Off*
- **Email the reviewer now** toggle
- Click **Send approval request** to get the "Ready for client review" screen, with a secure link to **Copy** and an **Open client review** button

### 12. Client review — what your client sees (`/review/demo`)

This is the no-login page your client opens from the link. Click **Open client review** or go to `/review/demo`. It shows *October Content for SmileCraft Dental*, "Reviewing as Dr. Priya", and lets you step through each asset.

Try each type of feedback:

| Asset type | What to try |
|---|---|
| **Image** | Choose **Mark on image**, **Rectangle** or **Draw**, then click on the creative. Type "What should change here?" and click **Add feedback**. A numbered marker appears. |
| **Carousel** | Switch slides in the strip, then leave slide-specific comments. |
| **Video** | Click **Select a portion** and set **From / To**, or pause and comment at the current timestamp ("Add a comment at this point…"). |

Then make a decision:

- **Approve**: a confirmation explains that this records approval for the *current version* of the creative and caption. Click **Confirm approval**.
- **Request changes**: all your markers and timestamp comments are sent to the agency together. Click **Send feedback**.

### 13. Activity (`/app/activity`)

The audit trail: approvals, change requests, views, reminders sent, new versions uploaded.

### 14. Storage (`/app/storage`)

- Usage meter (e.g. 37.4 GB of 50 GB) and an **Add 100 GB** button
- Storage policy: active work on R2 Standard, approved finals kept with their audit history, old revisions on a 90-day policy

### 15. Settings

- **Workspace** (`/app/settings/workspace`): agency name, reply-to email, timezone, branding (logo and colours), default reminder schedule
- **Notifications** (`/app/settings/notifications`): "Email me when…" preferences
- **Billing** (`/app/settings/billing`): Razorpay plans (Solo / Freelancer / Agency). Subscription state comes only from verified Razorpay webhooks, never from browser callbacks.
- **Pricing** (`/pricing`): the public pricing page

---

## Part 3 — Exercise the real backend

These commands create a real account and run the full approval loop against your deployed app: sign up, add a client, create a project, add an asset, send an approval, then leave a client comment and decision. Everything is stored in D1.

You need a terminal with `curl`. Replace the URL with yours.

```bash
APP=https://approveflow.YOUR-SUBDOMAIN.workers.dev
JAR=/tmp/approveflow-cookies.txt
```

### 1. Create an account (this also signs you in)

```bash
curl -s -c $JAR -X POST $APP/api/auth/signup \
  -H 'content-type: application/json' \
  -d '{"name":"Your Name","email":"you@example.com","password":"a-strong-password"}'
```

Returns `{"userId":"usr_…","workspaceId":"ws_…"}` and creates your personal workspace (10 GB quota by default). Passwords must be 8+ characters, and each email can register once.

Later, log in again with:

```bash
curl -s -c $JAR -X POST $APP/api/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"you@example.com","password":"a-strong-password"}'
```

### 2. Check who you are

```bash
curl -s -b $JAR $APP/api/auth/me
```

Shows your name, workspace, plan, and storage used vs quota.

### 3. Add a client and a project

```bash
curl -s -b $JAR -X POST $APP/api/clients -H 'content-type: application/json' \
  -d '{"companyName":"SmileCraft Dental","contactName":"Dr. Priya Shah","email":"priya@example.com"}'
# → {"id":"cl_…"}

CLIENT=cl_PASTE_ID_HERE
curl -s -b $JAR -X POST $APP/api/projects -H 'content-type: application/json' \
  -d "{\"clientId\":\"$CLIENT\",\"name\":\"October Content\",\"dueAt\":\"2026-10-31T18:00:00Z\"}"
# → {"id":"prj_…"}

curl -s -b $JAR $APP/api/clients
curl -s -b $JAR $APP/api/projects
```

### 4. Register an asset

This records an asset and its version 1, and counts its size against your storage quota:

```bash
PROJECT=prj_PASTE_ID_HERE
curl -s -b $JAR -X POST $APP/api/assets/finalize-upload -H 'content-type: application/json' \
  -d "{\"projectId\":\"$PROJECT\",\"name\":\"Instagram Post 1\",\"kind\":\"image\",\"r2Key\":\"workspaces/demo/post1.jpg\",\"mimeType\":\"image/jpeg\",\"size\":250000,\"caption\":\"Healthy smiles start here.\"}"
# → {"assetId":"ast_…","versionId":"ver_…","version":1}
```

Send the same request again with `"assetId":"ast_…"` added and it becomes **version 2**, and the asset's status changes to *revised*.

To upload a real file to R2 first, the `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY` GitHub secrets must be set. Call `POST /api/uploads/single/presign` with `{"filename","contentType","size"}`, `PUT` the file to the returned `url`, then use the returned `key` as `r2Key` above.

### 5. Send it for client approval

```bash
ASSET=ast_PASTE_ID_HERE
curl -s -b $JAR -X POST $APP/api/approvals -H 'content-type: application/json' \
  -d "{\"projectId\":\"$PROJECT\",\"assetIds\":[\"$ASSET\"],\"reviewerName\":\"Dr. Priya\",\"reviewerEmail\":\"priya@example.com\",\"message\":\"October posts are ready!\",\"reminders\":true}"
# → {"id":"apr_…","reviewUrl":"https://…/review/<TOKEN>"}
```

- If `RESEND_API_KEY` is set, the reviewer is **emailed** the link.
- With `"reminders": true`, a cron job runs **every 30 minutes** and emails a reminder once the request has waited 24 hours.
- Only a hash of the token is stored in D1. Possession of the link is what grants review access, and the client never needs an account.

### 6. Act as the client (no login)

```bash
TOKEN=PASTE_TOKEN_FROM_reviewUrl

# What the client sees
curl -s $APP/api/review/$TOKEN

# Pin a comment on the image (x/y are 0–1 fractions of width/height)
curl -s -X POST $APP/api/review/$TOKEN/comments -H 'content-type: application/json' \
  -d "{\"assetId\":\"$ASSET\",\"body\":\"Make the phone number larger\",\"annotation\":{\"kind\":\"point\",\"x\":0.42,\"y\":0.77}}"

# Decide
curl -s -X POST $APP/api/review/$TOKEN/decision -H 'content-type: application/json' \
  -d "{\"assetId\":\"$ASSET\",\"decision\":\"changes_requested\"}"   # or "approved"
```

Supported annotation kinds are `point`, `rectangle`, `drawing`, `video_timestamp`, `video_range`, `pdf_point` and `slide_point`. Every comment and decision is written to the audit log with the reviewer's name.

### 7. Billing (only if Razorpay secrets are set)

```bash
curl -s -b $JAR -X POST $APP/api/billing/subscription -H 'content-type: application/json' \
  -d '{"plan":"freelancer"}'
# → {"id":"sub_…","shortUrl":"https://rzp.io/…","status":"created"}
```

Open `shortUrl` to pay. Your plan is updated only when Razorpay calls `https://YOUR-APP/api/webhooks/razorpay` with a valid signature. Register that URL in the Razorpay dashboard using the same value as your `RAZORPAY_WEBHOOK_SECRET` secret.

### 8. Log out

```bash
curl -s -b $JAR -X POST $APP/api/auth/logout
```

---

## Feature map — what's live vs demo

| Feature | UI | Backend API |
|---|---|---|
| Sign up / log in / log out | Demo (accepts anything) | ✅ Real, password hashing and 30-day session cookie |
| Onboarding wizard | Demo | Uses the client and project APIs below |
| Clients (list, create) | Demo data | ✅ Real |
| Projects (list, create) | Demo data | ✅ Real |
| Assets and version history | Demo data | ✅ Real (new version on re-upload) |
| Direct browser → R2 upload (single and multipart) | Real call, simulated fallback | ✅ Real, needs R2 secrets and sign-in |
| Storage quota | Demo meter | ✅ Enforced on upload |
| Send for approval / secure link | Demo link `/review/demo` | ✅ Real tokenised link |
| Client review: pins, rectangles, drawing, slides, video ranges | ✅ Interactive (not saved) | ✅ Real comments and annotations |
| Approve / request changes | ✅ Interactive (not saved) | ✅ Real, recorded per version |
| Email notifications | — | ✅ Via Resend if `RESEND_API_KEY` is set |
| Automatic reminders | Settings UI (demo) | ✅ Cron every 30 min |
| Activity / audit trail | Demo data | ✅ Recorded (no read endpoint yet) |
| Billing / subscriptions | Demo plans | ✅ Razorpay, webhook-verified |
| Agency asset review, replies, compare versions | Demo | Not implemented yet |
| Workspace, notification and branding settings | Demo | Not implemented yet |
| Google sign-in, forgot password, email verification | Placeholder | Not implemented yet |

---

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Upload shows progress but nothing lands in R2 | Expected in the UI today (not signed in). Use Part 3, and check the R2 secrets are set. |
| `{"error":"Authentication required"}` from the API | Your cookie is missing. Re-run signup or login with `-c $JAR`, and use `-b $JAR` on later calls. |
| `Email already registered` | Use `/api/auth/login` instead, or pick another email. |
| `Storage quota exceeded` | The workspace quota (default 10 GB, set by `DEFAULT_STORAGE_QUOTA_BYTES`) is full. |
| `Razorpay is not configured` | Add the `RAZORPAY_*` GitHub secrets and redeploy. |
| No review emails | Add the `RESEND_API_KEY` secret and set `EMAIL_FROM` to a sender on a domain you've verified in Resend. |
| `Review link is invalid or expired` | The token was copied wrongly, or the link has expired or been revoked. |
| The seeded "Pixel Agency" demo user can't log in | Intentional. That seed row is display-only. Create your own account (Part 3, step 1). |
