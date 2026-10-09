-- One benchmark score: a metric of a model, from one source. The model's name as the benchmark writes it
-- is kept beside the key, so the table reads the way the benchmark publishes it. No foreign key to
-- leaderboard_models on purpose — a benchmark may name a model no catalogue lists, and it still ranks.
CREATE TABLE IF NOT EXISTS leaderboard_scores (
  model_key text NOT NULL,
  model_label text NOT NULL,
  metric_key text NOT NULL,
  metric_label text NOT NULL,
  metric_group text NOT NULL,
  value numeric NOT NULL,
  is_overall boolean NOT NULL DEFAULT false,
  source_key text NOT NULL,
  source_url text NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (model_key, metric_key, source_key)
)
