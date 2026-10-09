-- One reader's community signal: a short piece of text about what they are seeing, shown on the anxiety
-- page. `hidden` is set by the readers' reports reaching the threshold, or by the admin; `hidden_reason`
-- says which, so the admin page can tell a taken-down signal from one waiting to be looked at.
CREATE TABLE IF NOT EXISTS fomo_signals (
  id text PRIMARY KEY,
  day date NOT NULL,
  voter text NOT NULL,
  body text NOT NULL,
  author text,
  hidden boolean NOT NULL DEFAULT false,
  hidden_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
)
