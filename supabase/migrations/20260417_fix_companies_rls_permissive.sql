-- Fix: make companies (and related tables) RLS permissive for authenticated users
-- Mirrors the approach used in 20260414 for spaces/lists/tasks
-- Without this, the tasks query joining companies(name) can fail due to RLS blocking

-- ── Companies ─────────────────────────────────────────────────────────────────
DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can view their own companies" ON companies;
  DROP POLICY IF EXISTS "Users can insert their own companies" ON companies;
  DROP POLICY IF EXISTS "Users can update their own companies" ON companies;
  DROP POLICY IF EXISTS "Users can delete their own companies" ON companies;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "auth_users_companies_all" ON companies
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Company Assets ────────────────────────────────────────────────────────────
DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can view their own assets" ON company_assets;
  DROP POLICY IF EXISTS "Users can insert their own assets" ON company_assets;
  DROP POLICY IF EXISTS "Users can update their own assets" ON company_assets;
  DROP POLICY IF EXISTS "Users can delete their own assets" ON company_assets;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE company_assets ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "auth_users_company_assets_all" ON company_assets
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Company Metrics ───────────────────────────────────────────────────────────
DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can view their own metrics" ON company_metrics;
  DROP POLICY IF EXISTS "Users can insert their own metrics" ON company_metrics;
  DROP POLICY IF EXISTS "Users can update their own metrics" ON company_metrics;
  DROP POLICY IF EXISTS "Users can delete their own metrics" ON company_metrics;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE company_metrics ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "auth_users_company_metrics_all" ON company_metrics
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Financial Transactions ────────────────────────────────────────────────────
DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can view their own transactions" ON financial_transactions;
  DROP POLICY IF EXISTS "Users can insert their own transactions" ON financial_transactions;
  DROP POLICY IF EXISTS "Users can update their own transactions" ON financial_transactions;
  DROP POLICY IF EXISTS "Users can delete their own transactions" ON financial_transactions;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE financial_transactions ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "auth_users_financial_transactions_all" ON financial_transactions
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Leads ─────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can view their own leads" ON leads;
  DROP POLICY IF EXISTS "Users can insert their own leads" ON leads;
  DROP POLICY IF EXISTS "Users can update their own leads" ON leads;
  DROP POLICY IF EXISTS "Users can delete their own leads" ON leads;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "auth_users_leads_all" ON leads
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
