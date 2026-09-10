-- 0003: team invitations + canonical commission ledger.
-- Non-destructive: new tables + additive columns only. No existing data touched.
-- Invitation role reuses auth_users.role (Agent -> confirmator, Admin -> administrator).
-- Commission attribution reuses confirmations.created_by / confirmed_by (no parallel system).

CREATE TABLE IF NOT EXISTS team_invitations (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    role TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    invited_by TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','revoked')),
    expires_at TEXT NOT NULL,
    accepted_at TEXT,
    accepted_user_id TEXT,
    revoked_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_team_invitations_email ON team_invitations(email);
CREATE INDEX IF NOT EXISTS idx_team_invitations_status ON team_invitations(status);

CREATE TABLE IF NOT EXISTS commissions (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    confirmation_id TEXT NOT NULL UNIQUE,
    order_id TEXT,
    amount INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'DZD',
    trigger TEXT NOT NULL DEFAULT 'CONFIRMED',
    status TEXT NOT NULL DEFAULT 'earned',
    earned_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_commissions_agent ON commissions(agent_id);

ALTER TABLE confirmations ADD COLUMN confirmed_by TEXT;
ALTER TABLE confirmations ADD COLUMN confirmed_at TEXT;

INSERT OR IGNORE INTO settings (key, value) VALUES ('commission_per_order', '150');
INSERT OR IGNORE INTO settings (key, value) VALUES ('commission_currency', 'DZD');
