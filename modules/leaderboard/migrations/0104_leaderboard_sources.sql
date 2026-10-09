-- Every source this module reads, with what its last run brought in and what went wrong, so the page can
-- credit it and the alerts can say when one stops working.
CREATE TABLE IF NOT EXISTS leaderboard_sources (
  key text PRIMARY KEY,
  label text NOT NULL,
  url text NOT NULL,
  licence text,
  snapshot text,
  fetched_at timestamptz,
  last_ok_at timestamptz,
  last_error text,
  models integer NOT NULL DEFAULT 0,
  scores integer NOT NULL DEFAULT 0
)
