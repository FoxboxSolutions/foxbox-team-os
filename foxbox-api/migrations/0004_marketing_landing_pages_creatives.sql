-- 0004: Marketing — Landing Pages + Creative Generation.
-- Non-destructive: new tables only. No existing data touched.

-- ============================================
-- LANDING PAGES
-- ============================================

CREATE TABLE IF NOT EXISTS landing_pages (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    product_name TEXT,
    product_description TEXT,
    product_price TEXT,
    promotional_price TEXT,
    main_benefits TEXT DEFAULT '[]',
    product_features TEXT DEFAULT '[]',
    target_audience TEXT,
    target_market TEXT DEFAULT 'Algeria',
    language TEXT NOT NULL DEFAULT 'darija',
    brand_name TEXT,
    brand_colors TEXT DEFAULT '{}',
    payment_method TEXT DEFAULT 'COD',
    delivery_info TEXT,
    guarantee_info TEXT,
    marketing_notes TEXT,
    product_image_url TEXT,
    additional_images TEXT DEFAULT '[]',
    visual_style TEXT NOT NULL DEFAULT 'luxury',
    custom_colors TEXT DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','generating','ready','published')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_landing_pages_user ON landing_pages(user_id);
CREATE INDEX IF NOT EXISTS idx_landing_pages_status ON landing_pages(status);

-- ============================================
-- LANDING PAGE SECTIONS
-- ============================================

CREATE TABLE IF NOT EXISTS landing_page_sections (
    id TEXT PRIMARY KEY,
    page_id TEXT NOT NULL,
    section_type TEXT NOT NULL CHECK(section_type IN (
        'hero','trust_bar','problem','benefits','how_it_works',
        'social_proof','offer','faq','final_cta','footer'
    )),
    sort_order INTEGER NOT NULL DEFAULT 0,
    enabled INTEGER NOT NULL DEFAULT 1,
    content TEXT DEFAULT '{}',
    visual_config TEXT DEFAULT '{}',
    text_layers TEXT DEFAULT '[]',
    generation_status TEXT NOT NULL DEFAULT 'idle' CHECK(generation_status IN (
        'idle','generating','completed','failed'
    )),
    asset_url TEXT,
    error_message TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (page_id) REFERENCES landing_pages(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_landing_page_sections_page ON landing_page_sections(page_id);

-- ============================================
-- CREATIVE GENERATIONS (audit log for AI calls)
-- ============================================

CREATE TABLE IF NOT EXISTS creative_generations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    page_id TEXT,
    provider TEXT NOT NULL DEFAULT 'openai',
    model TEXT,
    type TEXT NOT NULL CHECK(type IN ('landing_image','creative_image','creative_video')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','completed','failed')),
    prompt TEXT,
    error TEXT,
    asset_url TEXT,
    metadata TEXT DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT,
    FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_creative_generations_user ON creative_generations(user_id);
CREATE INDEX IF NOT EXISTS idx_creative_generations_page ON creative_generations(page_id);
CREATE INDEX IF NOT EXISTS idx_creative_generations_status ON creative_generations(status);

-- ============================================
-- CREATIVE ASSETS (generated or uploaded)
-- ============================================

CREATE TABLE IF NOT EXISTS creative_assets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    generation_id TEXT,
    project_type TEXT NOT NULL CHECK(project_type IN ('landing_page','marketing_image','marketing_video')),
    project_id TEXT,
    category TEXT,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    thumbnail_url TEXT,
    width INTEGER,
    height INTEGER,
    file_size INTEGER,
    provider TEXT,
    model TEXT,
    prompt_version TEXT,
    language TEXT,
    style TEXT,
    metadata TEXT DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_creative_assets_user ON creative_assets(user_id);
CREATE INDEX IF NOT EXISTS idx_creative_assets_project ON creative_assets(project_type, project_id);
