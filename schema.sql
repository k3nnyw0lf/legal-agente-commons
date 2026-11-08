-- D1 tables used by src/index.js.

-- Who did what, when (sign-ins, opened cases and files, uploads, admin changes).
CREATE TABLE IF NOT EXISTS access_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL,
  email TEXT,
  ip TEXT,
  action TEXT NOT NULL,
  detail TEXT
);

-- File fingerprints: append-only, each row chained to the one before.
-- row = SHA-256 of prev|slug|h|name|size|sha256|ts|by. Changing or deleting any row breaks every row after it.
CREATE TABLE IF NOT EXISTS evidence (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL,
  h TEXT NOT NULL,
  name TEXT,
  size INTEGER,
  sha256 TEXT NOT NULL,
  ts TEXT NOT NULL,
  by TEXT,
  prev TEXT NOT NULL,
  row TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS evidence_slug_h ON evidence (slug, h);
