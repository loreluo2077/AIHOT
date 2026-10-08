-- What this module brought in from AIHOT's public API: one row per AIHOT item, holding the article it
-- became, the hash of the item as last imported, and whether the article is the module's to rewrite.
CREATE TABLE IF NOT EXISTS aihot_bridge_items (
  aihot_id text PRIMARY KEY,
  article_id text NOT NULL,
  source_name text NOT NULL,
  payload_hash text NOT NULL,
  selected boolean NOT NULL DEFAULT true,
  owned boolean NOT NULL DEFAULT true,
  imported_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
)
