
-- Leads: add missing columns
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS funnel_stage TEXT DEFAULT 'prospect';
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS estimated_value NUMERIC DEFAULT 0;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS legal_status TEXT;

-- Companies: add missing columns
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS asaas_customer_id TEXT;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS meta_ad_account_id TEXT;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS google_ad_account_id TEXT;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS custom_data JSONB;

-- Financial transactions: add missing column
ALTER TABLE public.financial_transactions ADD COLUMN IF NOT EXISTS category TEXT;
