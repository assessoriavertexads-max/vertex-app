-- Add email and Google Ads account ID to companies
ALTER TABLE companies ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS google_ad_account_id TEXT;
