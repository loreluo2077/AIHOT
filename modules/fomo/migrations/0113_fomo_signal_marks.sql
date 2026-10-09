-- What one reader did to one signal: agreed with it, or reported it. One row per reader per signal per
-- kind, so a reader counts once however many times they tap, and a signal's counts are row counts.
CREATE TABLE IF NOT EXISTS fomo_signal_marks (
  signal_id text NOT NULL REFERENCES fomo_signals (id) ON DELETE CASCADE,
  voter text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('agree', 'report')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (signal_id, voter, kind)
)
