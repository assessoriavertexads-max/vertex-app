-- Add phone (WhatsApp) field to companies
ALTER TABLE companies ADD COLUMN IF NOT EXISTS phone TEXT;
