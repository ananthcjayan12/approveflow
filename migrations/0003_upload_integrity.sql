-- Keep quota accounting in the same transaction as version creation, including
-- concurrent uploads. Earlier migrations updated the counter in application code.
CREATE TRIGGER IF NOT EXISTS enforce_version_quota
BEFORE INSERT ON asset_versions
BEGIN
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM workspaces w JOIN assets a ON a.workspace_id = w.id
    WHERE a.id = NEW.asset_id AND w.storage_used_bytes + NEW.size_bytes > w.storage_quota_bytes
  ) THEN RAISE(ABORT, 'Storage quota exceeded') END;
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM asset_versions WHERE r2_key = NEW.r2_key
  ) THEN RAISE(ABORT, 'Upload already finalized') END;
END;

CREATE TRIGGER IF NOT EXISTS account_version_storage
AFTER INSERT ON asset_versions
BEGIN
  UPDATE workspaces SET storage_used_bytes = storage_used_bytes + NEW.size_bytes
  WHERE id = (SELECT workspace_id FROM assets WHERE id = NEW.asset_id);
END;
