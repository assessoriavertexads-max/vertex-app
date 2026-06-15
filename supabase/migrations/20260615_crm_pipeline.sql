-- Adiciona colunas ao pipeline de CRM
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS loss_reason  TEXT,
  ADD COLUMN IF NOT EXISTS won_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lost_at      TIMESTAMPTZ;

-- Migra estágios antigos para o novo pipeline
UPDATE leads SET funnel_stage = 'won'         WHERE funnel_stage = 'closed';
UPDATE leads SET funnel_stage = 'negotiation' WHERE funnel_stage = 'legal';
