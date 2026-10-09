-- One reader's vote for one Beijing day. The voter is an unreadable identifier (the same HMAC of client
-- address and browser family the engine's feedback uses), never an address: voting again the same day
-- replaces the earlier vote, so one reader counts once.
CREATE TABLE IF NOT EXISTS fomo_votes (
  day date NOT NULL,
  voter text NOT NULL,
  feeling text NOT NULL CHECK (feeling IN ('low', 'medium', 'high')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (day, voter)
)
