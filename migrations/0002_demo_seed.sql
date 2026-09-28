-- Optional local/demo rows. Production users create these through onboarding.
INSERT OR IGNORE INTO users (id, name, email, password_hash, password_salt, email_verified_at)
VALUES ('usr_demo', 'Demo Owner', 'demo@approveflow.local', 'demo-not-loginable', 'demo', datetime('now'));
INSERT OR IGNORE INTO workspaces (id, owner_user_id, name, reply_to_email, plan_key, storage_quota_bytes)
VALUES ('ws_demo', 'usr_demo', 'Pixel Agency', 'demo@approveflow.local', 'freelancer', 53687091200);
INSERT OR IGNORE INTO clients (id, workspace_id, company_name, contact_name, email, notes)
VALUES ('cl_smilecraft', 'ws_demo', 'SmileCraft Dental', 'Dr. Priya Shah', 'priya@smilecraftdental.com', 'Demo client');
INSERT OR IGNORE INTO projects (id, workspace_id, client_id, name, description, due_at, status)
VALUES ('pr_october', 'ws_demo', 'cl_smilecraft', 'October Content', 'Monthly social content', '2026-10-12T18:00:00Z', 'in_review');
