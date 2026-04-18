-- Soft delete: add deleted_at column to companies and financial_transactions
ALTER TABLE companies ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE financial_transactions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- Indexes so filtering deleted rows is fast
CREATE INDEX IF NOT EXISTS idx_companies_deleted_at ON companies(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_financial_transactions_deleted_at ON financial_transactions(deleted_at) WHERE deleted_at IS NULL;
