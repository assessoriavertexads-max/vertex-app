-- Adiciona suporte a assinaturas recorrentes do Asaas
ALTER TABLE financial_transactions
  ADD COLUMN IF NOT EXISTS subscription_cycle TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS asaas_subscription_id TEXT DEFAULT NULL;

-- subscription_cycle: NULL = cobrança única | MONTHLY | WEEKLY | BIWEEKLY | QUARTERLY | SEMIANNUALLY | YEARLY
