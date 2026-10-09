-- One row per AIHOT feed this module follows (items, changes, daily, weekly, monthly): the conditional
-- request and paging cursors it left off at, and what the last run did, for the admin and the alerts.
CREATE TABLE IF NOT EXISTS aihot_bridge_sync (
  feed text PRIMARY KEY,
  cursor text,
  etag text,
  last_run_at timestamptz,
  last_ok_at timestamptz,
  last_error text,
  imported integer NOT NULL DEFAULT 0,
  detail jsonb
)
