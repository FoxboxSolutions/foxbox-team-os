-- Migration: Add blocked/banned statuses to auth_users
-- The CHECK constraint in SQLite cannot be altered, so we need to recreate the table

-- Create new table with updated CHECK constraint
CREATE TABLE IF NOT EXISTS auth_users_new (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT,
    avatar TEXT,
    role TEXT NOT NULL DEFAULT 'mediabuyer' CHECK(role IN ('administrator','mediabuyer','confirmator')),
    requested_role TEXT NOT NULL DEFAULT 'mediabuyer',
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','suspended','blocked','banned')),
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

-- Copy existing data
INSERT INTO auth_users_new SELECT * FROM auth_users;

-- Drop old table
DROP TABLE auth_users;

-- Rename new table
ALTER TABLE auth_users_new RENAME TO auth_users;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_auth_users_email ON auth_users(email);
CREATE INDEX IF NOT EXISTS idx_auth_users_status ON auth_users(status);
