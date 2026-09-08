-- Unified YouCan Order Model Migration
-- Adds canonical fields for Ecom Delivery export

ALTER TABLE youcan_orders ADD COLUMN stopdesk_code TEXT;
ALTER TABLE youcan_orders ADD COLUMN shipping_cost INTEGER NOT NULL DEFAULT 0;
ALTER TABLE youcan_orders ADD COLUMN total_to_collect INTEGER NOT NULL DEFAULT 0;
ALTER TABLE youcan_orders ADD COLUMN note TEXT;
ALTER TABLE youcan_orders ADD COLUMN exchange INTEGER NOT NULL DEFAULT 0;
