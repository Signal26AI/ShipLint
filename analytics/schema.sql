-- ShipLint Analytics Schema
-- Run: wrangler d1 execute shiplint-analytics --file=schema.sql

CREATE TABLE IF NOT EXISTS pings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    version TEXT NOT NULL,
    findings INTEGER NOT NULL DEFAULT 0,
    errors INTEGER NOT NULL DEFAULT 0,
    warnings INTEGER NOT NULL DEFAULT 0,
    rules TEXT DEFAULT '[]',  -- JSON array of rule IDs
    timestamp INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index for time-based queries
CREATE INDEX IF NOT EXISTS idx_pings_timestamp ON pings(timestamp);

-- Index for version queries
CREATE INDEX IF NOT EXISTS idx_pings_version ON pings(version);
