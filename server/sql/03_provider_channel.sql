-- 03_provider_channel.sql
CREATE TABLE IF NOT EXISTS provider_channel (
  id UUID PRIMARY KEY,
  provider_id UUID NOT NULL REFERENCES provider(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('email','api','portal')),
  value TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE
);