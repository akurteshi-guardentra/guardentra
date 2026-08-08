-- Guardentra Phase 2 audit spine schema
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL UNIQUE,
  tenant_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  actor_id TEXT,
  actor_type TEXT NOT NULL DEFAULT 'user',
  object_type TEXT,
  object_id TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  schema_version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_events_tenant_created_idx
  ON audit_events (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_events_tenant_type_idx
  ON audit_events (tenant_id, event_type);
CREATE INDEX IF NOT EXISTS audit_events_object_idx
  ON audit_events (object_type, object_id);

CREATE TABLE IF NOT EXISTS audit_hash_chain (
  id BIGSERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  event_id UUID NOT NULL UNIQUE REFERENCES audit_events(event_id),
  seq BIGINT NOT NULL,
  hash TEXT NOT NULL,
  previous_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, seq)
);

CREATE TABLE IF NOT EXISTS audit_outbox (
  id BIGSERIAL PRIMARY KEY,
  event_id UUID NOT NULL UNIQUE,
  tenant_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'acked', 'dead')),
  attempts INT NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_outbox_poll_idx
  ON audit_outbox (status, next_attempt_at)
  WHERE status IN ('pending', 'processing');

CREATE TABLE IF NOT EXISTS audit_metadata (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS audit_metadata_tenant_key_idx
  ON audit_metadata (COALESCE(tenant_id, ''), key);
