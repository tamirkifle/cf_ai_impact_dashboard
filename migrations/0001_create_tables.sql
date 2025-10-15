-- Migration: Create simulation metrics table and indexes
CREATE TABLE IF NOT EXISTS simulation_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  simulation_id TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  simulation_type TEXT CHECK(simulation_type IN ('normal', 'spike', 'ddos')) NOT NULL,

  -- Cloudflare protected metrics
  cf_latency_ms INTEGER NOT NULL,
  cf_success_rate REAL NOT NULL,
  cf_requests_handled INTEGER NOT NULL,
  cf_errors INTEGER NOT NULL DEFAULT 0,

  -- Unprotected origin metrics
  origin_latency_ms INTEGER NOT NULL,
  origin_success_rate REAL NOT NULL,
  origin_requests_handled INTEGER NOT NULL,
  origin_errors INTEGER NOT NULL DEFAULT 0,

  -- AI analysis
  ai_explanation TEXT,

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_simulation_id ON simulation_metrics(simulation_id);
CREATE INDEX IF NOT EXISTS idx_timestamp ON simulation_metrics(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_type_timestamp ON simulation_metrics(simulation_type, timestamp DESC);
