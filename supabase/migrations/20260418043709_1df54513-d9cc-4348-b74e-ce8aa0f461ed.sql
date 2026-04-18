-- Add auth_user_id to companies and leads (missing ownership column)
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS auth_user_id uuid DEFAULT auth.uid();
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS auth_user_id uuid DEFAULT auth.uid();

CREATE INDEX IF NOT EXISTS idx_companies_auth_user_id ON public.companies(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_leads_auth_user_id ON public.leads(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_auth_user_id ON public.financial_transactions(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_auth_user_id ON public.tasks(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_lists_auth_user_id ON public.lists(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_spaces_auth_user_id ON public.spaces(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_automation_rules_auth_user_id ON public.automation_rules(auth_user_id);

-- COMPANIES
DROP POLICY IF EXISTS "Auth read companies" ON public.companies;
DROP POLICY IF EXISTS "Auth insert companies" ON public.companies;
DROP POLICY IF EXISTS "Auth update companies" ON public.companies;
DROP POLICY IF EXISTS "Auth delete companies" ON public.companies;

CREATE POLICY "Users read own companies" ON public.companies FOR SELECT TO authenticated USING (auth_user_id = auth.uid());
CREATE POLICY "Users insert own companies" ON public.companies FOR INSERT TO authenticated WITH CHECK (auth_user_id = auth.uid());
CREATE POLICY "Users update own companies" ON public.companies FOR UPDATE TO authenticated USING (auth_user_id = auth.uid()) WITH CHECK (auth_user_id = auth.uid());
CREATE POLICY "Users delete own companies" ON public.companies FOR DELETE TO authenticated USING (auth_user_id = auth.uid());

-- LEADS
DROP POLICY IF EXISTS "Auth read leads" ON public.leads;
DROP POLICY IF EXISTS "Auth insert leads" ON public.leads;
DROP POLICY IF EXISTS "Auth update leads" ON public.leads;
DROP POLICY IF EXISTS "Auth delete leads" ON public.leads;

CREATE POLICY "Users read own leads" ON public.leads FOR SELECT TO authenticated USING (auth_user_id = auth.uid());
CREATE POLICY "Users insert own leads" ON public.leads FOR INSERT TO authenticated WITH CHECK (auth_user_id = auth.uid());
CREATE POLICY "Users update own leads" ON public.leads FOR UPDATE TO authenticated USING (auth_user_id = auth.uid()) WITH CHECK (auth_user_id = auth.uid());
CREATE POLICY "Users delete own leads" ON public.leads FOR DELETE TO authenticated USING (auth_user_id = auth.uid());

-- FINANCIAL TRANSACTIONS
DROP POLICY IF EXISTS "Authenticated full access financial_transactions" ON public.financial_transactions;
CREATE POLICY "Users read own financial_transactions" ON public.financial_transactions FOR SELECT TO authenticated USING (auth_user_id = auth.uid());
CREATE POLICY "Users insert own financial_transactions" ON public.financial_transactions FOR INSERT TO authenticated WITH CHECK (auth_user_id = auth.uid());
CREATE POLICY "Users update own financial_transactions" ON public.financial_transactions FOR UPDATE TO authenticated USING (auth_user_id = auth.uid()) WITH CHECK (auth_user_id = auth.uid());
CREATE POLICY "Users delete own financial_transactions" ON public.financial_transactions FOR DELETE TO authenticated USING (auth_user_id = auth.uid());

-- TASKS
DROP POLICY IF EXISTS "Authenticated full access tasks" ON public.tasks;
CREATE POLICY "Users read own tasks" ON public.tasks FOR SELECT TO authenticated USING (auth_user_id = auth.uid());
CREATE POLICY "Users insert own tasks" ON public.tasks FOR INSERT TO authenticated WITH CHECK (auth_user_id = auth.uid());
CREATE POLICY "Users update own tasks" ON public.tasks FOR UPDATE TO authenticated USING (auth_user_id = auth.uid()) WITH CHECK (auth_user_id = auth.uid());
CREATE POLICY "Users delete own tasks" ON public.tasks FOR DELETE TO authenticated USING (auth_user_id = auth.uid());

-- LISTS
DROP POLICY IF EXISTS "Authenticated full access lists" ON public.lists;
CREATE POLICY "Users read own lists" ON public.lists FOR SELECT TO authenticated USING (auth_user_id = auth.uid());
CREATE POLICY "Users insert own lists" ON public.lists FOR INSERT TO authenticated WITH CHECK (auth_user_id = auth.uid());
CREATE POLICY "Users update own lists" ON public.lists FOR UPDATE TO authenticated USING (auth_user_id = auth.uid()) WITH CHECK (auth_user_id = auth.uid());
CREATE POLICY "Users delete own lists" ON public.lists FOR DELETE TO authenticated USING (auth_user_id = auth.uid());

-- SPACES
DROP POLICY IF EXISTS "Authenticated full access spaces" ON public.spaces;
CREATE POLICY "Users read own spaces" ON public.spaces FOR SELECT TO authenticated USING (auth_user_id = auth.uid());
CREATE POLICY "Users insert own spaces" ON public.spaces FOR INSERT TO authenticated WITH CHECK (auth_user_id = auth.uid());
CREATE POLICY "Users update own spaces" ON public.spaces FOR UPDATE TO authenticated USING (auth_user_id = auth.uid()) WITH CHECK (auth_user_id = auth.uid());
CREATE POLICY "Users delete own spaces" ON public.spaces FOR DELETE TO authenticated USING (auth_user_id = auth.uid());

-- AUTOMATION RULES
DROP POLICY IF EXISTS "Authenticated full access automation_rules" ON public.automation_rules;
CREATE POLICY "Users read own automation_rules" ON public.automation_rules FOR SELECT TO authenticated USING (auth_user_id = auth.uid());
CREATE POLICY "Users insert own automation_rules" ON public.automation_rules FOR INSERT TO authenticated WITH CHECK (auth_user_id = auth.uid());
CREATE POLICY "Users update own automation_rules" ON public.automation_rules FOR UPDATE TO authenticated USING (auth_user_id = auth.uid()) WITH CHECK (auth_user_id = auth.uid());
CREATE POLICY "Users delete own automation_rules" ON public.automation_rules FOR DELETE TO authenticated USING (auth_user_id = auth.uid());