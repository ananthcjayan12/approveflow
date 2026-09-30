import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parse } from "jsonc-parser";
const state = await mkdtemp(join(tmpdir(), "approveflow-trial-"));
const cli = resolve("node_modules/wrangler/bin/wrangler.js");
const base = "http://localhost:8791";
let server;
let output = "";
try {
  const config = parse(await readFile("wrangler.jsonc", "utf8"));
  config.main = resolve(config.main);
  config.assets.directory = resolve(config.assets.directory);
  config.d1_databases[0].migrations_dir = resolve("migrations");
  config.vars = {
    ...config.vars,
    APP_ORIGIN: base,
    R2_ACCESS_KEY_ID: "",
    R2_SECRET_ACCESS_KEY: "",
    RESEND_API_KEY: "",
    RAZORPAY_KEY_ID: "",
  };
  const configPath = join(state, "wrangler.json");
  await writeFile(configPath, JSON.stringify(config));
  // Keep local credentials out of this isolated test environment.
  await writeFile(join(state, ".dev.vars"), "");
  execFileSync(
    process.execPath,
    [
      cli,
      "d1",
      "migrations",
      "apply",
      "DB",
      "--local",
      "--persist-to",
      state,
      "--config",
      configPath,
    ],
    { stdio: "pipe" },
  );
  server = spawn(
    process.execPath,
    [
      cli,
      "dev",
      "--config",
      configPath,
      "--port",
      "8791",
      "--persist-to",
      state,
      "--var",
      `APP_ORIGIN:${base}`,
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  server.stdout.on("data", (d) => (output += d));
  server.stderr.on("data", (d) => (output += d));
  let ready = false;
  for (let n = 0; n < 80; n++) {
    try {
      if ((await fetch(`${base}/health`)).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  assert.ok(ready, `Local Worker did not start: ${output}`);
  async function request(
    path,
    {
      cookie = "",
      body,
      method = body ? "POST" : "GET",
      status = 200,
      headers = {},
    } = {},
  ) {
    const response = await fetch(base + path, {
      method,
      headers: {
        ...(cookie ? { cookie } : {}),
        ...(body ? { "content-type": "application/json" } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await response.json();
    assert.equal(
      response.status,
      status,
      `${method} ${path}: ${JSON.stringify(data)}`,
    );
    return { data, cookie: response.headers.get("set-cookie")?.split(";")[0] };
  }
  const email = `trial-${Date.now()}@example.test`;
  const password = "Trial-test-8492";
  const owner = await request("/api/auth/signup", {
    body: { name: "Test Designer", email, password },
    status: 201,
  });
  const other = await request("/api/auth/signup", {
    body: { name: "Other Designer", email: `other-${email}`, password },
    status: 201,
  });
  const cookie = owner.cookie;
  await request("/api/clients", { status: 401 });
  await request("/api/auth/login", {
    body: { email, password: "wrong-password" },
    status: 401,
  });
  const login = await request("/api/auth/login", { body: { email, password } });
  assert.ok(login.cookie);
  await request("/api/clients", {
    cookie,
    body: { companyName: "Blocked" },
    headers: { origin: "https://unrelated.test" },
    status: 403,
  });
  const client = (
    await request("/api/clients", {
      cookie,
      body: {
        companyName: "Trial Client",
        contactName: "Reviewer",
        email: "reviewer@example.test",
      },
      status: 201,
    })
  ).data;
  assert.equal(
    (await request("/api/clients", { cookie: other.cookie })).data.length,
    0,
  );
  await request("/api/projects", {
    cookie: other.cookie,
    body: { clientId: client.id, name: "Unauthorized" },
    status: 404,
  });
  const project = (
    await request("/api/projects", {
      cookie,
      body: { clientId: client.id, name: "Trial Campaign" },
      status: 201,
    })
  ).data;
  const image = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==",
    "base64",
  );
  async function upload(assetId) {
    const signed = (
      await request("/api/uploads/single/presign", {
        cookie,
        body: {
          filename: "creative.png",
          contentType: "image/png",
          size: image.length,
        },
      })
    ).data;
    const response = await fetch(new URL(signed.url, base), {
      method: "PUT",
      headers: { cookie, "content-type": "image/png" },
      body: image,
    });
    assert.equal(response.status, 200);
    const payload = {
      projectId: project.id,
      assetId,
      name: "Creative",
      kind: "image",
      r2Key: signed.key,
      mimeType: "image/png",
      size: image.length,
    };
    const asset = (
      await request("/api/assets/finalize-upload", {
        cookie,
        body: payload,
        status: 201,
      })
    ).data;
    await request("/api/assets/finalize-upload", {
      cookie,
      body: payload,
      status: 409,
    });
    return asset;
  }
  const asset = await upload();
  await request("/api/approvals", {
    cookie: other.cookie,
    body: {
      projectId: project.id,
      assetIds: [asset.assetId],
      reviewerEmail: "reviewer@example.test",
    },
    status: 404,
  });
  const approval = (
    await request("/api/approvals", {
      cookie,
      body: {
        projectId: project.id,
        assetIds: [asset.assetId],
        reviewerEmail: "reviewer@example.test",
        reviewerName: "Reviewer",
      },
      status: 201,
    })
  ).data;
  const token = approval.reviewUrl.split("/").pop();
  const review = (await request(`/api/review/${token}`)).data;
  assert.equal(review.assets.length, 1);
  assert.equal(review.assets[0].status, "waiting");
  await request("/api/review/invalid", { status: 404 });
  await request(`/api/media/${asset.versionId}`, { status: 401 });
  await request(`/api/media/${asset.versionId}`, {
    cookie: other.cookie,
    status: 401,
  });
  const media = await fetch(
    `${base}/api/media/${asset.versionId}?token=${token}`,
  );
  assert.equal(media.status, 200);
  assert.equal((await media.arrayBuffer()).byteLength, image.length);
  await request(`/api/review/${token}/comments`, {
    body: {
      assetId: asset.assetId,
      assetVersionId: asset.versionId,
      body: "Make the heading larger",
      annotation: { kind: "point", x: 0.25, y: 0.5 },
    },
    status: 201,
  });
  await request(`/api/review/${token}/decision`, {
    body: {
      assetId: "unrelated",
      assetVersionId: asset.versionId,
      decision: "approved",
    },
    status: 403,
  });
  await request(`/api/review/${token}/decision`, {
    body: {
      assetId: asset.assetId,
      assetVersionId: asset.versionId,
      decision: "changes_requested",
    },
  });
  assert.equal(
    (await request("/api/assets", { cookie })).data[0].status,
    "changes_requested",
  );
  assert.equal(
    (await request(`/api/assets/${asset.assetId}/comments`, { cookie })).data[0]
      .body,
    "Make the heading larger",
  );
  await request(`/api/assets/${asset.assetId}/comments`, {
    cookie,
    body: { body: "Updated in version 2" },
  });
  const revision = await upload(asset.assetId);
  assert.equal(revision.version, 2);
  await request(`/api/review/${token}/decision`, {
    body: {
      assetId: asset.assetId,
      assetVersionId: asset.versionId,
      decision: "approved",
    },
    status: 409,
  });
  await request(`/api/review/${token}/decision`, {
    body: {
      assetId: asset.assetId,
      assetVersionId: revision.versionId,
      decision: "approved",
    },
  });
  assert.equal(
    (await request("/api/assets", { cookie })).data[0].status,
    "approved",
  );
  const saved = (await request(`/api/review/${token}`)).data;
  assert.equal(saved.comments.length, 2);
  assert.equal(saved.status, "approved");
  await request("/api/workspace", {
    cookie,
    method: "PATCH",
    body: {
      name: "Trial Studio",
      replyToEmail: email,
      timezone: "UTC",
      brandColor: "#ffcc00",
    },
  });
  const workspace = (await request("/api/workspace", { cookie })).data;
  assert.equal(workspace.name, "Trial Studio");
  assert.equal(workspace.storage_used_bytes, image.length * 2);
  await request("/api/auth/logout", { cookie, method: "POST" });
  await request("/api/auth/me", { cookie, status: 401 });
  console.log(
    "Trial checks passed: authentication, isolation, upload/download, feedback, revisions, approvals, settings, storage, logout.",
  );
} catch (error) {
  console.error(output.slice(-4000));
  throw error;
} finally {
  if (server && server.exitCode === null) {
    server.kill("SIGTERM");
    await new Promise((r) => server.once("exit", r));
  }
  await rm(state, { recursive: true, force: true });
}
