-- Enable RLS and Add auth_user_id Column to Companies Table
ALTER TABLE companies ADD COLUMN auth_user_id UUID DEFAULT auth.uid();
ALTER TABLE companies ALTER COLUMN auth_user_id SET NOT NULL;

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own companies"
ON companies
FOR SELECT
USING (auth_user_id = auth.uid());

CREATE POLICY "Users can insert their own companies"
ON companies
FOR INSERT
WITH CHECK (auth_user_id = auth.uid());

CREATE POLICY "Users can update their own companies"
ON companies
FOR UPDATE
USING (auth_user_id = auth.uid())
WITH CHECK (auth_user_id = auth.uid());

CREATE POLICY "Users can delete their own companies"
ON companies
FOR DELETE
USING (auth_user_id = auth.uid());

-- Enable RLS and Add auth_user_id Column to Company Assets Table
ALTER TABLE company_assets ADD COLUMN auth_user_id UUID DEFAULT auth.uid();
ALTER TABLE company_assets ALTER COLUMN auth_user_id SET NOT NULL;

ALTER TABLE company_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own assets"
ON company_assets
FOR SELECT
USING (auth_user_id = auth.uid());

CREATE POLICY "Users can insert their own assets"
ON company_assets
FOR INSERT
WITH CHECK (auth_user_id = auth.uid());

CREATE POLICY "Users can update their own assets"
ON company_assets
FOR UPDATE
USING (auth_user_id = auth.uid())
WITH CHECK (auth_user_id = auth.uid());

CREATE POLICY "Users can delete their own assets"
ON company_assets
FOR DELETE
USING (auth_user_id = auth.uid());

-- Enable RLS and Add auth_user_id Column to Company Metrics Table
ALTER TABLE company_metrics ADD COLUMN auth_user_id UUID DEFAULT auth.uid();
ALTER TABLE company_metrics ALTER COLUMN auth_user_id SET NOT NULL;

ALTER TABLE company_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own metrics"
ON company_metrics
FOR SELECT
USING (auth_user_id = auth.uid());

CREATE POLICY "Users can insert their own metrics"
ON company_metrics
FOR INSERT
WITH CHECK (auth_user_id = auth.uid());

CREATE POLICY "Users can update their own metrics"
ON company_metrics
FOR UPDATE
USING (auth_user_id = auth.uid())
WITH CHECK (auth_user_id = auth.uid());

CREATE POLICY "Users can delete their own metrics"
ON company_metrics
FOR DELETE
USING (auth_user_id = auth.uid());

-- Enable RLS and Add auth_user_id Column to Financial Transactions Table
ALTER TABLE financial_transactions ADD COLUMN auth_user_id UUID DEFAULT auth.uid();
ALTER TABLE financial_transactions ALTER COLUMN auth_user_id SET NOT NULL;

ALTER TABLE financial_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own transactions"
ON financial_transactions
FOR SELECT
USING (auth_user_id = auth.uid());

CREATE POLICY "Users can insert their own transactions"
ON financial_transactions
FOR INSERT
WITH CHECK (auth_user_id = auth.uid());

CREATE POLICY "Users can update their own transactions"
ON financial_transactions
FOR UPDATE
USING (auth_user_id = auth.uid())
WITH CHECK (auth_user_id = auth.uid());

CREATE POLICY "Users can delete their own transactions"
ON financial_transactions
FOR DELETE
USING (auth_user_id = auth.uid());

-- Enable RLS and Add auth_user_id Column to Leads Table (if exists)
ALTER TABLE leads ADD COLUMN auth_user_id UUID DEFAULT auth.uid();
ALTER TABLE leads ALTER COLUMN auth_user_id SET NOT NULL;

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own leads"
ON leads
FOR SELECT
USING (auth_user_id = auth.uid());

CREATE POLICY "Users can insert their own leads"
ON leads
FOR INSERT
WITH CHECK (auth_user_id = auth.uid());

CREATE POLICY "Users can update their own leads"
ON leads
FOR UPDATE
USING (auth_user_id = auth.uid())
WITH CHECK (auth_user_id = auth.uid());

CREATE POLICY "Users can delete their own leads"
ON leads
FOR DELETE
USING (auth_user_id = auth.uid());

-- Enable RLS and Add auth_user_id Column to Tasks Table (if exists)
ALTER TABLE tasks ADD COLUMN auth_user_id UUID DEFAULT auth.uid();
ALTER TABLE tasks ALTER COLUMN auth_user_id SET NOT NULL;

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own tasks"
ON tasks
FOR SELECT
USING (auth_user_id = auth.uid());

CREATE POLICY "Users can insert their own tasks"
ON tasks
FOR INSERT
WITH CHECK (auth_user_id = auth.uid());

CREATE POLICY "Users can update their own tasks"
ON tasks
FOR UPDATE
USING (auth_user_id = auth.uid())
WITH CHECK (auth_user_id = auth.uid());

CREATE POLICY "Users can delete their own tasks"
ON tasks
FOR DELETE
USING (auth_user_id = auth.uid());
