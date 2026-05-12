-- =====================================================================
-- Portal do Cliente
-- 1. Tabela profiles (role: agencia | cliente)
-- 2. Funções SECURITY DEFINER (sem recursão de RLS)
-- 3. Trigger de auto-criação de perfil no signup
-- 4. RLS tightened — baseado no schema real de produção:
--    auth_user_id: companies, tasks
--    company_id:   company_metrics, financial_transactions, leads, tasks
--    sem colunas:  automation_rules, company_assets, lists, spaces
-- =====================================================================

-- ── 1. Tabela profiles ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.profiles (
  id              UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role            TEXT        NOT NULL DEFAULT 'agencia' CHECK (role IN ('agencia', 'cliente')),
  company_id      UUID        REFERENCES public.companies(id) ON DELETE SET NULL,
  agency_user_id  UUID        REFERENCES auth.users(id)       ON DELETE SET NULL,
  full_name       TEXT,
  whatsapp_phone  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "profiles_select_own" ON public.profiles
    FOR SELECT USING (id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "profiles_select_my_clients" ON public.profiles
    FOR SELECT USING (agency_user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "profiles_insert_own" ON public.profiles
    FOR INSERT WITH CHECK (id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "profiles_update_own" ON public.profiles
    FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "profiles_update_clients" ON public.profiles
    FOR UPDATE USING (agency_user_id = auth.uid())
    WITH CHECK (agency_user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 2. Funções SECURITY DEFINER ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT STABLE SECURITY DEFINER SET search_path = public
LANGUAGE sql AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_my_company_id()
RETURNS UUID STABLE SECURITY DEFINER SET search_path = public
LANGUAGE sql AS $$
  SELECT company_id FROM profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_my_agency_user_id()
RETURNS UUID STABLE SECURITY DEFINER SET search_path = public
LANGUAGE sql AS $$
  SELECT agency_user_id FROM profiles WHERE id = auth.uid();
$$;

-- Cliente pode ver o perfil da agência responsável (para obter WhatsApp)
DO $$ BEGIN
  CREATE POLICY "client_profiles_see_agency" ON public.profiles
    FOR SELECT USING (
      get_my_role() = 'cliente' AND id = get_my_agency_user_id()
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 3. Trigger: auto-criação de perfil no signup ──────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_create_profile_on_signup()
RETURNS TRIGGER SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.profiles (id, role, company_id, agency_user_id)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'role', ''), 'agencia'),
    NULLIF(NEW.raw_user_meta_data->>'company_id', '')::uuid,
    NULLIF(NEW.raw_user_meta_data->>'agency_user_id', '')::uuid
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_profile_on_signup ON auth.users;
CREATE TRIGGER trg_create_profile_on_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.fn_create_profile_on_signup();

-- ── 4. Backfill: perfis para usuários existentes ───────────────────────────────
INSERT INTO public.profiles (id, role)
SELECT id, 'agencia' FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- ── 5. RLS: companies (HAS auth_user_id) ──────────────────────────────────────

DO $$ BEGIN
  DROP POLICY IF EXISTS "auth_users_companies_all"             ON public.companies;
  DROP POLICY IF EXISTS "Anyone can view companies"            ON public.companies;
  DROP POLICY IF EXISTS "Anyone can insert companies"          ON public.companies;
  DROP POLICY IF EXISTS "Anyone can update companies"          ON public.companies;
  DROP POLICY IF EXISTS "Anyone can delete companies"          ON public.companies;
  DROP POLICY IF EXISTS "Users can view their own companies"   ON public.companies;
  DROP POLICY IF EXISTS "Users can insert their own companies" ON public.companies;
  DROP POLICY IF EXISTS "Users can update their own companies" ON public.companies;
  DROP POLICY IF EXISTS "Users can delete their own companies" ON public.companies;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "agency_companies_all" ON public.companies
    FOR ALL
    USING    (get_my_role() = 'agencia' AND auth_user_id = auth.uid())
    WITH CHECK (get_my_role() = 'agencia' AND auth_user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "client_companies_select" ON public.companies
    FOR SELECT USING (get_my_role() = 'cliente' AND id = get_my_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 6. RLS: financial_transactions (HAS company_id, NO auth_user_id) ──────────

DO $$ BEGIN
  DROP POLICY IF EXISTS "auth_users_financial_transactions_all"           ON public.financial_transactions;
  DROP POLICY IF EXISTS "Authenticated full access financial_transactions" ON public.financial_transactions;
  DROP POLICY IF EXISTS "Users can view their own transactions"            ON public.financial_transactions;
  DROP POLICY IF EXISTS "Users can insert their own transactions"          ON public.financial_transactions;
  DROP POLICY IF EXISTS "Users can update their own transactions"          ON public.financial_transactions;
  DROP POLICY IF EXISTS "Users can delete their own transactions"          ON public.financial_transactions;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "agency_transactions_all" ON public.financial_transactions
    FOR ALL
    USING    (get_my_role() = 'agencia')
    WITH CHECK (get_my_role() = 'agencia');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "client_transactions_select" ON public.financial_transactions
    FOR SELECT USING (get_my_role() = 'cliente' AND company_id = get_my_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 7. RLS: leads (HAS company_id, NO auth_user_id — agência apenas) ──────────

DO $$ BEGIN
  DROP POLICY IF EXISTS "auth_users_leads_all"    ON public.leads;
  DROP POLICY IF EXISTS "Anyone can view leads"   ON public.leads;
  DROP POLICY IF EXISTS "Anyone can insert leads" ON public.leads;
  DROP POLICY IF EXISTS "Anyone can update leads" ON public.leads;
  DROP POLICY IF EXISTS "Anyone can delete leads" ON public.leads;
  DROP POLICY IF EXISTS "Users can view their own leads"   ON public.leads;
  DROP POLICY IF EXISTS "Users can insert their own leads" ON public.leads;
  DROP POLICY IF EXISTS "Users can update their own leads" ON public.leads;
  DROP POLICY IF EXISTS "Users can delete their own leads" ON public.leads;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "agency_leads_all" ON public.leads
    FOR ALL
    USING    (get_my_role() = 'agencia')
    WITH CHECK (get_my_role() = 'agencia');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 8. RLS: tasks (HAS auth_user_id AND company_id — agência apenas) ──────────

DO $$ BEGIN
  DROP POLICY IF EXISTS "Authenticated full access tasks"  ON public.tasks;
  DROP POLICY IF EXISTS "Users can view their own tasks"   ON public.tasks;
  DROP POLICY IF EXISTS "Users can insert their own tasks" ON public.tasks;
  DROP POLICY IF EXISTS "Users can update their own tasks" ON public.tasks;
  DROP POLICY IF EXISTS "Users can delete their own tasks" ON public.tasks;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "agency_tasks_all" ON public.tasks
    FOR ALL
    USING    (get_my_role() = 'agencia' AND auth_user_id = auth.uid())
    WITH CHECK (get_my_role() = 'agencia' AND auth_user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 9. RLS: company_metrics (HAS company_id, NO auth_user_id) ─────────────────

DO $$ BEGIN
  DROP POLICY IF EXISTS "auth_users_company_metrics_all"      ON public.company_metrics;
  DROP POLICY IF EXISTS "Users can view their own metrics"    ON public.company_metrics;
  DROP POLICY IF EXISTS "Users can insert their own metrics"  ON public.company_metrics;
  DROP POLICY IF EXISTS "Users can update their own metrics"  ON public.company_metrics;
  DROP POLICY IF EXISTS "Users can delete their own metrics"  ON public.company_metrics;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "agency_company_metrics_all" ON public.company_metrics
    FOR ALL
    USING    (get_my_role() = 'agencia')
    WITH CHECK (get_my_role() = 'agencia');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "client_company_metrics_select" ON public.company_metrics
    FOR SELECT USING (get_my_role() = 'cliente' AND company_id = get_my_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 10. RLS: company_assets (NO auth_user_id, NO company_id — agência apenas) ─

DO $$ BEGIN
  DROP POLICY IF EXISTS "auth_users_company_assets_all"    ON public.company_assets;
  DROP POLICY IF EXISTS "Users can view their own assets"  ON public.company_assets;
  DROP POLICY IF EXISTS "Users can insert their own assets" ON public.company_assets;
  DROP POLICY IF EXISTS "Users can update their own assets" ON public.company_assets;
  DROP POLICY IF EXISTS "Users can delete their own assets" ON public.company_assets;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "agency_company_assets_all" ON public.company_assets
    FOR ALL
    USING    (get_my_role() = 'agencia')
    WITH CHECK (get_my_role() = 'agencia');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 11. RLS: lists e spaces (agência apenas) ──────────────────────────────────

DO $$ BEGIN
  DROP POLICY IF EXISTS "Authenticated full access lists" ON public.lists;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "agency_lists_all" ON public.lists
    FOR ALL
    USING    (get_my_role() = 'agencia')
    WITH CHECK (get_my_role() = 'agencia');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Authenticated full access spaces" ON public.spaces;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "agency_spaces_all" ON public.spaces
    FOR ALL
    USING    (get_my_role() = 'agencia')
    WITH CHECK (get_my_role() = 'agencia');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 12. RLS: automation_rules (agência apenas) ────────────────────────────────

DO $$ BEGIN
  DROP POLICY IF EXISTS "Authenticated full access automation_rules" ON public.automation_rules;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "agency_automation_rules_all" ON public.automation_rules
    FOR ALL
    USING    (get_my_role() = 'agencia')
    WITH CHECK (get_my_role() = 'agencia');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
