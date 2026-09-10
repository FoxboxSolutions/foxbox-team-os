-- ============================================
-- DELIVERY INTEGRATIONS
-- Tracks delivery company connections (no credentials stored here)
-- Credentials remain as Worker env secrets
-- ============================================

CREATE TABLE IF NOT EXISTS delivery_integrations (
    id TEXT PRIMARY KEY,
    provider_id TEXT NOT NULL,
    account_name TEXT NOT NULL DEFAULT 'Default',
    linked_store_id TEXT,
    status TEXT NOT NULL DEFAULT 'disconnected' CHECK(status IN ('disconnected','connected','error','testing')),
    error_message TEXT,
    connected_at TEXT,
    last_tested_at TEXT,
    last_test_status TEXT,
    created_by TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Unique constraint: only one active integration per provider+account+store
CREATE UNIQUE INDEX IF NOT EXISTS idx_delivery_integrations_unique
    ON delivery_integrations(provider_id, account_name, linked_store_id);
