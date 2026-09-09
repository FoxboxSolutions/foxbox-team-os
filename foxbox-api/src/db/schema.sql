-- ============================================
-- FOXBOX TEAM OS — D1 Schema (SQLite)
-- ============================================

PRAGMA foreign_keys = ON;

-- ============================================
-- AUTH TABLES
-- ============================================

CREATE TABLE IF NOT EXISTS auth_users (
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

CREATE INDEX IF NOT EXISTS idx_auth_users_email ON auth_users(email);
CREATE INDEX IF NOT EXISTS idx_auth_users_status ON auth_users(status);

-- ============================================
-- AUTH SESSIONS
-- ============================================

CREATE TABLE IF NOT EXISTS auth_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires ON auth_sessions(expires_at);

-- ============================================
-- REGISTRATION REQUESTS
-- ============================================

CREATE TABLE IF NOT EXISTS registration_requests (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    requested_role TEXT NOT NULL,
    auth_provider TEXT NOT NULL DEFAULT 'email',
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    reviewed_at TEXT,
    reviewed_by TEXT,
    review_notes TEXT
);

-- ============================================
-- OAUTH STATES (CSRF protection)
-- ============================================

CREATE TABLE IF NOT EXISTS oauth_states (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    state TEXT NOT NULL UNIQUE,
    code_verifier TEXT,
    redirect_url TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_oauth_states_state ON oauth_states(state);
CREATE INDEX IF NOT EXISTS idx_oauth_states_expires ON oauth_states(expires_at);

-- ============================================
-- USERS (team members display)
-- ============================================

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    avatar TEXT,
    role TEXT NOT NULL DEFAULT 'OPERATIONS',
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================
-- PRODUCTS (research)
-- ============================================

CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    source_url TEXT NOT NULL,
    source_platform TEXT NOT NULL,
    source_product_id TEXT,
    description TEXT,
    category TEXT,
    status TEXT NOT NULL DEFAULT 'IDEA' CHECK(status IN ('IDEA','RESEARCH','STANDBY','TESTING','APPROVED','PURCHASE','SCALING','REJECTED')),
    score INTEGER,
    notes TEXT,
    image_url TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_analyzed_at TEXT,
    is_winner INTEGER DEFAULT 0,
    fields TEXT DEFAULT '[]',
    variants TEXT DEFAULT '[]',
    product_creatives TEXT DEFAULT '[]',
    links TEXT DEFAULT '[]',
    supplier TEXT,
    shipping_profile TEXT,
    cost_scenario TEXT,
    cod_scenario TEXT,
    offers TEXT DEFAULT '[]',
    tests TEXT DEFAULT '[]',
    decision_history TEXT DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);

-- ============================================
-- SELLING PRODUCTS
-- ============================================

CREATE TABLE IF NOT EXISTS selling_products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    sku TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    selling_price_dzd INTEGER NOT NULL DEFAULT 0,
    cost_price_dzd INTEGER NOT NULL DEFAULT 0,
    stock INTEGER NOT NULL DEFAULT 0,
    available_stock INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','INACTIVE')),
    weight REAL,
    supplier TEXT,
    supplier_ref TEXT,
    notes TEXT,
    research_product_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================
-- ORDERS (FoxBox orders)
-- ============================================

CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    order_number TEXT NOT NULL UNIQUE,
    customer TEXT NOT NULL,
    product_id TEXT,
    quantity INTEGER NOT NULL DEFAULT 1,
    selling_price_dzd INTEGER NOT NULL DEFAULT 0,
    delivery_fee_dzd INTEGER NOT NULL DEFAULT 0,
    payment_method TEXT NOT NULL DEFAULT 'COD' CHECK(payment_method IN ('COD','CCP','BARIDIMOB')),
    carrier_id TEXT,
    tracking_number TEXT,
    status TEXT NOT NULL DEFAULT 'NEW' CHECK(status IN ('NEW','PENDING_CONFIRMATION','CONFIRMED','CANCELLED','PREPARING','SHIPPED','IN_TRANSIT','OUT_FOR_DELIVERY','DELIVERED','RETURNED')),
    confirmation_status TEXT NOT NULL DEFAULT 'PENDING' CHECK(confirmation_status IN ('PENDING','CONFIRMED','NO_ANSWER','CALL_BACK','WRONG_NUMBER','CANCELLED')),
    confirmed_at TEXT,
    shipped_at TEXT,
    delivered_at TEXT,
    returned_at TEXT,
    notes TEXT,
    created_by TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_confirmation ON orders(confirmation_status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);

-- ============================================
-- DELIVERY PROVIDERS
-- ============================================

CREATE TABLE IF NOT EXISTS delivery_providers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    tracking_url TEXT,
    services TEXT NOT NULL DEFAULT '[]',
    price_per_kg REAL,
    price_per_order REAL,
    is_active INTEGER NOT NULL DEFAULT 1,
    notes TEXT
);

-- ============================================
-- SHIPMENTS
-- ============================================

CREATE TABLE IF NOT EXISTS shipments (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    tracking_number TEXT NOT NULL,
    service_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PICKED_UP' CHECK(status IN ('PICKED_UP','IN_TRANSIT','AT_HUB','OUT_FOR_DELIVERY','DELIVERED','RETURNED','LOST')),
    shipped_at TEXT NOT NULL,
    estimated_delivery TEXT,
    delivered_at TEXT,
    return_reason TEXT,
    cost REAL NOT NULL DEFAULT 0,
    weight_kg REAL,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

-- ============================================
-- E-COM DELIVERIES
-- ============================================

CREATE TABLE IF NOT EXISTS ecom_deliveries (
    id TEXT PRIMARY KEY,
    order_id TEXT,
    foxbox_order_number TEXT,
    provider TEXT NOT NULL DEFAULT 'ecom_delivery',
    ecom_tracking TEXT NOT NULL,
    ecom_id_colis INTEGER,
    ecom_id_externe TEXT,
    ecom_situation TEXT NOT NULL DEFAULT '',
    ecom_situation_id INTEGER DEFAULT 0,
    ecom_etat_logistique TEXT NOT NULL DEFAULT '',
    ecom_etat_logistique_id INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'PREPARING',
    status_label TEXT NOT NULL DEFAULT '',
    customer_name TEXT NOT NULL DEFAULT '',
    customer_phone TEXT NOT NULL DEFAULT '',
    customer_phone_alt TEXT,
    wilaya_code TEXT NOT NULL DEFAULT '',
    wilaya_name TEXT NOT NULL DEFAULT '',
    commune TEXT NOT NULL DEFAULT '',
    delivery_mode TEXT NOT NULL DEFAULT 'HOME' CHECK(delivery_mode IN ('HOME','STOP_DESK')),
    address TEXT,
    stopdesk_code TEXT,
    stopdesk_name TEXT,
    product TEXT NOT NULL DEFAULT '',
    quantity INTEGER NOT NULL DEFAULT 1,
    total INTEGER NOT NULL DEFAULT 0,
    ecom_tarif_livraison REAL,
    ecom_tarif_annulation REAL,
    ecom_encaisser REAL,
    ecom_recouvert REAL,
    ecom_last_action_at TEXT,
    ecom_last_sync_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ecom_tracking ON ecom_deliveries(ecom_tracking);
CREATE INDEX IF NOT EXISTS idx_ecom_status ON ecom_deliveries(status);

-- ============================================
-- DELIVERY HISTORY
-- ============================================

CREATE TABLE IF NOT EXISTS delivery_history (
    id TEXT PRIMARY KEY,
    delivery_id TEXT NOT NULL,
    ecom_event_id TEXT,
    situation TEXT NOT NULL,
    situation_id INTEGER,
    etat_logistique TEXT,
    etat_logistique_id INTEGER,
    commentaire TEXT NOT NULL DEFAULT '',
    wilaya_code TEXT,
    received_at TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'webhook' CHECK(source IN ('webhook','sync','manual')),
    FOREIGN KEY (delivery_id) REFERENCES ecom_deliveries(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_delivery_history_delivery ON delivery_history(delivery_id);

-- ============================================
-- YOUCAN CONNECTION
-- ============================================

CREATE TABLE IF NOT EXISTS youcan_connections (
    id TEXT PRIMARY KEY,
    store_name TEXT NOT NULL DEFAULT '',
    store_identifier TEXT,
    client_id TEXT,
    client_secret TEXT,
    access_token TEXT,
    refresh_token TEXT,
    expires_at TEXT,
    token_type TEXT DEFAULT 'Bearer',
    scopes TEXT DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'DISCONNECTED' CHECK(status IN ('CONNECTED','DISCONNECTED','ERROR','NEEDS_AUTH')),
    connected_at TEXT,
    last_sync_at TEXT,
    last_webhook_at TEXT,
    orders_synced_count INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================
-- YOUCAN ORDERS
-- ============================================

CREATE TABLE IF NOT EXISTS youcan_orders (
    id TEXT PRIMARY KEY,
    external_order_id TEXT NOT NULL,
    order_ref TEXT,
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
    stopdesk_code TEXT,
    total_to_collect INTEGER NOT NULL DEFAULT 0,
    note TEXT,
    exchange INTEGER NOT NULL DEFAULT 0,
    order_items TEXT NOT NULL DEFAULT '[]',
    quantity INTEGER NOT NULL DEFAULT 0,
    subtotal INTEGER NOT NULL DEFAULT 0,
    shipping_cost INTEGER NOT NULL DEFAULT 0,
    delivery_fee INTEGER NOT NULL DEFAULT 0,
    total INTEGER NOT NULL DEFAULT 0,
    total_to_collect INTEGER NOT NULL DEFAULT 0,
    note TEXT,
    exchange INTEGER NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'DZD',
    payment_status TEXT NOT NULL DEFAULT 'pending',
    shipping_status TEXT NOT NULL DEFAULT 'unfulfilled',
    order_status TEXT NOT NULL DEFAULT 'open',
    youcan_created_at TEXT,
    youcan_updated_at TEXT,
    raw_payload TEXT,
    ecom_push_status TEXT NOT NULL DEFAULT 'not_sent' CHECK(ecom_push_status IN ('not_sent','sent','failed')),
    ecom_pushed_at TEXT,
    ecom_push_tracking TEXT,
    ecom_push_error TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_youcan_external ON youcan_orders(external_order_id);
CREATE INDEX IF NOT EXISTS idx_youcan_status ON youcan_orders(order_status);
CREATE INDEX IF NOT EXISTS idx_youcan_wilaya ON youcan_orders(wilaya_code);

-- ============================================
-- YOUCAN WEBHOOK LOGS
-- ============================================

CREATE TABLE IF NOT EXISTS youcan_webhook_logs (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    received_at TEXT NOT NULL,
    order_id TEXT,
    status TEXT NOT NULL CHECK(status IN ('RECEIVED','PROCESSED','DUPLICATE','FAILED')),
    error TEXT,
    processing_time_ms INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_youcan_wh_event ON youcan_webhook_logs(event_id);
CREATE INDEX IF NOT EXISTS idx_youcan_wh_status ON youcan_webhook_logs(status);

-- ============================================
-- DELETED YOUCAN ORDERS (Tombstone Registry)
-- ============================================

CREATE TABLE IF NOT EXISTS deleted_youcan_orders (
    youcan_order_id TEXT NOT NULL,
    deleted_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_by TEXT,
    reason TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_deleted_youcan_order_id ON deleted_youcan_orders(youcan_order_id);

-- ============================================
-- CONFIRMATIONS
-- ============================================

CREATE TABLE IF NOT EXISTS confirmations (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    wilaya_code TEXT NOT NULL,
    wilaya_name TEXT NOT NULL,
    baladiya TEXT NOT NULL,
    shipping_method TEXT NOT NULL DEFAULT 'HOME' CHECK(shipping_method IN ('HOME','OFFICE')),
    delivery_price INTEGER NOT NULL DEFAULT 0,
    address TEXT,
    office_ref TEXT,
    office_name TEXT,
    office_address TEXT,
    office_phone TEXT,
    transporter TEXT,
    product_id TEXT,
    product_price INTEGER NOT NULL DEFAULT 0,
    quantity INTEGER NOT NULL DEFAULT 1,
    total INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('CONFIRMED','PENDING','CANCELLED')),
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    delivery_provider TEXT,
    ecom_tracking TEXT,
    ecom_parcel_id INTEGER,
    ecom_id_externe TEXT,
    ecom_status TEXT,
    ecom_status_id INTEGER,
    ecom_status_text TEXT,
    ecom_logistics_state TEXT,
    ecom_logistics_state_id INTEGER,
    ecom_created_at TEXT,
    ecom_last_sync_at TEXT,
    ecom_sent_at TEXT,
    ecom_error TEXT
);

CREATE INDEX IF NOT EXISTS idx_confirmations_status ON confirmations(status);
CREATE INDEX IF NOT EXISTS idx_confirmations_phone ON confirmations(phone);

-- ============================================
-- TASKS
-- ============================================

CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    assignee_id TEXT NOT NULL,
    creator_id TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'MEDIUM' CHECK(priority IN ('LOW','MEDIUM','HIGH','URGENT')),
    status TEXT NOT NULL DEFAULT 'TODO' CHECK(status IN ('TODO','IN_PROGRESS','REVIEW','DONE')),
    due_date TEXT,
    tags TEXT NOT NULL DEFAULT '[]',
    product_id TEXT,
    attachments TEXT NOT NULL DEFAULT '[]',
    comments TEXT NOT NULL DEFAULT '[]',
    activity TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

-- ============================================
-- POSTS (Team Hub)
-- ============================================

CREATE TABLE IF NOT EXISTS posts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'GENERAL',
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    images TEXT DEFAULT '[]',
    links TEXT DEFAULT '[]',
    product_id TEXT,
    task_id TEXT,
    reactions TEXT NOT NULL DEFAULT '[]',
    post_comments TEXT NOT NULL DEFAULT '[]',
    bookmarks TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT
);

-- ============================================
-- DISCUSSION CHANNELS
-- ============================================

CREATE TABLE IF NOT EXISTS channels (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    icon TEXT NOT NULL DEFAULT 'Hash',
    unread_count INTEGER DEFAULT 0,
    is_product_linked INTEGER DEFAULT 0,
    product_id TEXT
);

-- ============================================
-- DISCUSSION MESSAGES
-- ============================================

CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    channel_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    content TEXT NOT NULL,
    mentions TEXT NOT NULL DEFAULT '[]',
    replies_to TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT,
    FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel_id);

-- ============================================
-- FILES
-- ============================================

CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    original_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size INTEGER NOT NULL,
    url TEXT NOT NULL,
    thumbnail_url TEXT,
    folder TEXT NOT NULL DEFAULT 'DOCUMENTS',
    tags TEXT NOT NULL DEFAULT '[]',
    product_id TEXT,
    uploaded_by TEXT NOT NULL,
    storage_key TEXT,
    category TEXT NOT NULL DEFAULT 'other',
    source TEXT NOT NULL DEFAULT 'upload',
    width INTEGER,
    height INTEGER,
    duration_seconds REAL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_files_storage_key ON files(storage_key);
CREATE INDEX IF NOT EXISTS idx_files_category ON files(category);
CREATE INDEX IF NOT EXISTS idx_files_uploaded_by ON files(uploaded_by);

-- ============================================
-- CREATIVES
-- ============================================

CREATE TABLE IF NOT EXISTS creatives (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    name TEXT NOT NULL,
    hook TEXT,
    script TEXT,
    angle TEXT,
    platform TEXT NOT NULL DEFAULT 'META' CHECK(platform IN ('META','TIKTOK','OTHER')),
    type TEXT NOT NULL DEFAULT 'video' CHECK(type IN ('image','video','carousel')),
    status TEXT NOT NULL DEFAULT 'IDEA' CHECK(status IN ('IDEA','IN_PRODUCTION','READY','TESTING','WINNER','ARCHIVED')),
    file_url TEXT,
    thumbnail_url TEXT,
    performance TEXT,
    is_winner INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_creatives_product ON creatives(product_id);

-- ============================================
-- WILAYAS
-- ============================================

CREATE TABLE IF NOT EXISTS wilayas (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    name_ar TEXT,
    communes TEXT NOT NULL DEFAULT '[]'
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_wilayas_code ON wilayas(code);

-- ============================================
-- DELIVERY PRICES
-- ============================================

CREATE TABLE IF NOT EXISTS delivery_prices (
    wilaya_code TEXT PRIMARY KEY,
    home_price INTEGER NOT NULL DEFAULT 0,
    office_price INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (wilaya_code) REFERENCES wilayas(code) ON DELETE CASCADE
);

-- ============================================
-- BUREAUX (Stop Desk)
-- ============================================

CREATE TABLE IF NOT EXISTS bureaux (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL,
    wilaya_code TEXT NOT NULL,
    lieu TEXT NOT NULL,
    address TEXT NOT NULL,
    phone TEXT NOT NULL,
    carrier TEXT NOT NULL,
    FOREIGN KEY (wilaya_code) REFERENCES wilayas(code) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_bureaux_wilaya ON bureaux(wilaya_code);
CREATE INDEX IF NOT EXISTS idx_bureaux_code ON bureaux(code);

-- ============================================
-- EXPENSES
-- ============================================

CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL CHECK(category IN ('PRODUCT','SHIPPING','DELIVERY','ADVERTISING','PACKAGING','OPERATIONS','TOOLS','OTHER')),
    description TEXT NOT NULL,
    amount_dzd INTEGER NOT NULL DEFAULT 0,
    amount_usd REAL,
    product_id TEXT,
    order_id TEXT,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);

-- ============================================
-- REVENUES
-- ============================================

CREATE TABLE IF NOT EXISTS revenues (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL DEFAULT 'ORDER' CHECK(source IN ('ORDER','REFUND','OTHER')),
    amount_dzd INTEGER NOT NULL DEFAULT 0,
    order_id TEXT,
    product_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================
-- NOTIFICATIONS
-- ============================================

CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    link TEXT,
    is_read INTEGER NOT NULL DEFAULT 0,
    user_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);

-- ============================================
-- ACTIVITY LOG
-- ============================================

CREATE TABLE IF NOT EXISTS activity_logs (
    id TEXT PRIMARY KEY,
    action TEXT NOT NULL,
    user_id TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    entity_name TEXT NOT NULL,
    details TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_entity ON activity_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_logs(created_at);

-- ============================================
-- SETTINGS
-- ============================================

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
