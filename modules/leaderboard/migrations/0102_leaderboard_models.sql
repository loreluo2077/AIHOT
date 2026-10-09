-- What this module knows about a model: its catalogue row. Scores live in leaderboard_scores; a model
-- a benchmark names but no catalogue lists simply has no row here.
CREATE TABLE IF NOT EXISTS leaderboard_models (
  model_key text PRIMARY KEY,
  name text NOT NULL,
  vendor text,
  released_at timestamptz,
  context_length integer,
  price_in numeric(12, 6),
  price_out numeric(12, 6),
  modality text,
  catalogue_url text,
  updated_at timestamptz NOT NULL DEFAULT now()
)
