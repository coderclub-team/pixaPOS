-- SaaS console tables (admin.pixapos.store). Idempotent.
CREATE TABLE IF NOT EXISTS saas_leads (
  id TEXT PRIMARY KEY,
  business_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  city TEXT,
  outlets_planned INTEGER NOT NULL DEFAULT 1,
  source TEXT NOT NULL DEFAULT 'website',
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  organization_id TEXT,
  converted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS saas_leads_status_idx ON saas_leads (status);
CREATE INDEX IF NOT EXISTS saas_leads_email_idx ON saas_leads (email);

CREATE TABLE IF NOT EXISTS org_profiles (
  organization_id TEXT PRIMARY KEY,
  lifecycle TEXT NOT NULL DEFAULT 'trial',
  plan TEXT NOT NULL DEFAULT 'starter',
  trial_ends_at TIMESTAMPTZ,
  mrr_paise INTEGER NOT NULL DEFAULT 0,
  owner_email TEXT,
  is_blocked BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS saas_audit (
  id TEXT PRIMARY KEY,
  actor_email TEXT,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  detail TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
