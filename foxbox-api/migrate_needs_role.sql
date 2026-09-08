CREATE TABLE IF NOT EXISTS auth_users_new (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  avatar TEXT,
  role TEXT NOT NULL DEFAULT 'mediabuyer' CHECK(role IN ('administrator','mediabuyer','confirmator')),
  requested_role TEXT NOT NULL DEFAULT 'mediabuyer',
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','suspended','blocked','banned','needs_role')),
  auth_provider TEXT NOT NULL DEFAULT 'email' CHECK(auth_provider IN ('email','google','facebook')),
  google_id TEXT,
  facebook_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  approved_at TEXT,
  approved_by TEXT,
  last_login_at TEXT,
  password_reset_token TEXT,
  password_reset_expires TEXT
);

INSERT OR IGNORE INTO auth_users_new SELECT * FROM auth_users;

DROP TABLE auth_users;

ALTER TABLE auth_users_new RENAME TO auth_users;

CREATE INDEX IF NOT EXISTS idx_auth_users_email ON auth_users(email);
CREATE INDEX IF NOT EXISTS idx_auth_users_status ON auth_users(status);
