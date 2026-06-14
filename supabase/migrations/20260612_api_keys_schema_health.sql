-- ─────────────────────────────────────────────────────────────────────────────
-- 1. API Keys — integração com n8n, Make, Zapier e parceiros externos
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.api_keys (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id  UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          TEXT        NOT NULL,
  key_hash      TEXT        NOT NULL UNIQUE,
  key_prefix    TEXT        NOT NULL,
  permissions   TEXT[]      NOT NULL DEFAULT ARRAY['read'],
  last_used_at  TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ,
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "api_keys_select" ON public.api_keys
  FOR SELECT USING (auth.uid() = auth_user_id);
CREATE POLICY "api_keys_insert" ON public.api_keys
  FOR INSERT WITH CHECK (auth.uid() = auth_user_id);
CREATE POLICY "api_keys_update" ON public.api_keys
  FOR UPDATE USING (auth.uid() = auth_user_id);
CREATE POLICY "api_keys_delete" ON public.api_keys
  FOR DELETE USING (auth.uid() = auth_user_id);

CREATE INDEX IF NOT EXISTS idx_api_keys_user ON public.api_keys(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON public.api_keys(key_hash);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Schema health — garantir colunas essenciais
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS meta_ad_account_id   TEXT,
  ADD COLUMN IF NOT EXISTS google_ad_account_id TEXT,
  ADD COLUMN IF NOT EXISTS asaas_customer_id    TEXT,
  ADD COLUMN IF NOT EXISTS document             TEXT,
  ADD COLUMN IF NOT EXISTS phone                TEXT,
  ADD COLUMN IF NOT EXISTS email                TEXT,
  ADD COLUMN IF NOT EXISTS deleted_at           TIMESTAMPTZ;

ALTER TABLE public.financial_transactions
  ADD COLUMN IF NOT EXISTS asaas_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS asaas_payment_id       TEXT,
  ADD COLUMN IF NOT EXISTS asaas_payment_url      TEXT,
  ADD COLUMN IF NOT EXISTS subscription_cycle     TEXT,
  ADD COLUMN IF NOT EXISTS deleted_at             TIMESTAMPTZ;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS recurrence TEXT;

ALTER TABLE public.automation_rules
  ADD COLUMN IF NOT EXISTS last_run_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_error  TEXT,
  ADD COLUMN IF NOT EXISTS run_count   INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS enabled     BOOLEAN DEFAULT TRUE;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS whatsapp_phone TEXT;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Índices de performance
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_transactions_status      ON public.financial_transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_due_date    ON public.financial_transactions(due_date);
CREATE INDEX IF NOT EXISTS idx_transactions_company     ON public.financial_transactions(company_id);
CREATE INDEX IF NOT EXISTS idx_transactions_asaas_sub   ON public.financial_transactions(asaas_subscription_id);
CREATE INDEX IF NOT EXISTS idx_transactions_asaas_pay   ON public.financial_transactions(asaas_payment_id);
CREATE INDEX IF NOT EXISTS idx_companies_asaas_customer ON public.companies(asaas_customer_id);
CREATE INDEX IF NOT EXISTS idx_leads_company            ON public.leads(company_id);
CREATE INDEX IF NOT EXISTS idx_tasks_company            ON public.tasks(company_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date           ON public.tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_automation_rules_enabled ON public.automation_rules(enabled, trigger_event);
