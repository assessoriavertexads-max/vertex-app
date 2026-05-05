-- Cron: importar assinaturas Asaas automaticamente todo dia 1 do mês às 06h UTC
-- Requer extensões pg_cron e pg_net habilitadas no projeto Supabase

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove job anterior se existir (idempotente)
SELECT cron.unschedule('monthly-asaas-import') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'monthly-asaas-import'
);

-- Agenda: 1º dia de cada mês às 06:00 UTC
SELECT cron.schedule(
  'monthly-asaas-import',
  '0 6 1 * *',
  $$
  SELECT net.http_post(
    url    := 'https://zfufkschpimuiedstxyl.supabase.co/functions/v1/asaas-import-subscriptions',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body   := '{"all": true}'::jsonb
  ) AS request_id;
  $$
);
