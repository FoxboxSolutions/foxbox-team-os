-- 0002: extend files table for R2-backed storage.
-- Non-destructive: additive columns/indexes only. Existing rows untouched.
-- storage_key  -> unique R2 object key (files/YYYY/MM/<id>-<safe-name>)
-- category     -> image | video | document | audio | other (UI filters image/video)
-- source       -> upload | generated (future AI asset pipeline)
-- width/height/duration_seconds -> media dimensions when known, else NULL
ALTER TABLE files ADD COLUMN storage_key TEXT;
ALTER TABLE files ADD COLUMN category TEXT NOT NULL DEFAULT 'other';
ALTER TABLE files ADD COLUMN source TEXT NOT NULL DEFAULT 'upload';
ALTER TABLE files ADD COLUMN width INTEGER;
ALTER TABLE files ADD COLUMN height INTEGER;
ALTER TABLE files ADD COLUMN duration_seconds REAL;
ALTER TABLE files ADD COLUMN updated_at TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_files_storage_key ON files(storage_key);
CREATE INDEX IF NOT EXISTS idx_files_category ON files(category);
CREATE INDEX IF NOT EXISTS idx_files_uploaded_by ON files(uploaded_by);
