-- Add Meta Ads Ad Account ID to companies
ALTER TABLE companies ADD COLUMN IF NOT EXISTS meta_ad_account_id TEXT;
