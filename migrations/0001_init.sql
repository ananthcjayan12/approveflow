PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  email_verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sessions_hash ON sessions(token_hash);

CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  logo_url TEXT,
  brand_color TEXT NOT NULL DEFAULT '#FFC53D',
  reply_to_email TEXT,
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  plan_key TEXT NOT NULL DEFAULT 'free',
  storage_used_bytes INTEGER NOT NULL DEFAULT 0,
  storage_quota_bytes INTEGER NOT NULL DEFAULT 1073741824,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  logo_url TEXT,
  notes TEXT,
  archived_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_clients_workspace ON clients(workspace_id, archived_at);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  due_at TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  archived_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_projects_workspace ON projects(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_projects_client ON projects(client_id, archived_at);

CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  caption TEXT,
  publishing_at TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  latest_version_no INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_assets_project ON assets(project_id, status);

CREATE TABLE IF NOT EXISTS asset_versions (
  id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  version_no INTEGER NOT NULL,
  r2_key TEXT NOT NULL,
  mime_type TEXT,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  width INTEGER,
  height INTEGER,
  duration_ms INTEGER,
  poster_r2_key TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(asset_id, version_no)
);
CREATE INDEX IF NOT EXISTS idx_versions_asset ON asset_versions(asset_id, version_no DESC);

CREATE TABLE IF NOT EXISTS approval_requests (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  reviewer_name TEXT,
  reviewer_email TEXT,
  message TEXT,
  requested_by TEXT,
  reminder_enabled INTEGER NOT NULL DEFAULT 1,
  next_reminder_at TEXT,
  reminder_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'waiting',
  due_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_approval_reminders ON approval_requests(status, next_reminder_at);

CREATE TABLE IF NOT EXISTS approval_request_assets (
  approval_request_id TEXT NOT NULL REFERENCES approval_requests(id) ON DELETE CASCADE,
  asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  PRIMARY KEY(approval_request_id, asset_id)
);

CREATE TABLE IF NOT EXISTS review_links (
  id TEXT PRIMARY KEY,
  approval_request_id TEXT NOT NULL REFERENCES approval_requests(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_review_links_hash ON review_links(token_hash);

CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  approval_request_id TEXT NOT NULL REFERENCES approval_requests(id) ON DELETE CASCADE,
  asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  asset_version_id TEXT REFERENCES asset_versions(id) ON DELETE SET NULL,
  author_type TEXT NOT NULL,
  author_name TEXT,
  body TEXT NOT NULL,
  parent_comment_id TEXT REFERENCES comments(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_comments_request_asset ON comments(approval_request_id, asset_id, created_at);

CREATE TABLE IF NOT EXISTS annotations (
  id TEXT PRIMARY KEY,
  comment_id TEXT NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  page_no INTEGER,
  slide_no INTEGER,
  x REAL,
  y REAL,
  width REAL,
  height REAL,
  timestamp_ms INTEGER,
  start_ms INTEGER,
  end_ms INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS approval_decisions (
  id TEXT PRIMARY KEY,
  approval_request_id TEXT NOT NULL REFERENCES approval_requests(id) ON DELETE CASCADE,
  asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  asset_version_id TEXT REFERENCES asset_versions(id) ON DELETE SET NULL,
  decision TEXT NOT NULL,
  reviewer_name TEXT,
  reviewer_email TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_decisions_request ON approval_decisions(approval_request_id, created_at);

CREATE TABLE IF NOT EXISTS activity_events (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id TEXT,
  asset_id TEXT,
  approval_request_id TEXT,
  event_type TEXT NOT NULL,
  actor_name TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_activity_workspace ON activity_events(workspace_id, created_at DESC);

CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL UNIQUE REFERENCES workspaces(id) ON DELETE CASCADE,
  razorpay_customer_id TEXT,
  razorpay_subscription_id TEXT UNIQUE,
  plan_key TEXT NOT NULL,
  status TEXT NOT NULL,
  current_period_start TEXT,
  current_period_end TEXT,
  cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS payment_events (
  id TEXT PRIMARY KEY,
  event_id TEXT UNIQUE,
  event_type TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  processed_at TEXT NOT NULL DEFAULT (datetime('now'))
);
