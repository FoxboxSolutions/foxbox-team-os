-- Drop and recreate youcan_orders without CHECK constraints
-- YouCan returns values that don't match our original CHECK constraints

DROP TABLE IF EXISTS youcan_orders;

CREATE TABLE youcan_orders (
    id TEXT PRIMARY KEY,
    external_order_id TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'YOUCAN',
    store_id TEXT,
    store_name TEXT,
    customer_name TEXT,
    customer_email TEXT,
    customer_phone TEXT,
    wilaya TEXT,
    wilaya_code TEXT,
    baladiya TEXT,
    address TEXT,
    shipping_method TEXT DEFAULT 'domicile',
    office_code TEXT,
    office_name TEXT,
    order_items TEXT NOT NULL DEFAULT '[]',
    quantity INTEGER NOT NULL DEFAULT 0,
    subtotal INTEGER NOT NULL DEFAULT 0,
    delivery_fee INTEGER NOT NULL DEFAULT 0,
    total INTEGER NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'DZD',
    payment_status TEXT NOT NULL DEFAULT 'pending',
    shipping_status TEXT NOT NULL DEFAULT 'unfulfilled',
    order_status TEXT NOT NULL DEFAULT 'open',
    youcan_created_at TEXT,
    youcan_updated_at TEXT,
    raw_payload TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_youcan_external ON youcan_orders(external_order_id);
CREATE INDEX IF NOT EXISTS idx_youcan_status ON youcan_orders(order_status);
CREATE INDEX IF NOT EXISTS idx_youcan_wilaya ON youcan_orders(wilaya_code);
