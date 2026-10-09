-- Words readers added to a day's hot list. One row per reader per word per day: the page counts rows, so
-- a word two readers named counts twice, and the same reader adding it again changes nothing.
CREATE TABLE IF NOT EXISTS fomo_hotwords (
  day date NOT NULL,
  word text NOT NULL,
  voter text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (day, word, voter)
)
