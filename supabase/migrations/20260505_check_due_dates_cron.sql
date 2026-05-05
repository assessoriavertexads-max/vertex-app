-- Cron diário: verificar vencimentos de tarefas e cobranças e disparar automações
-- Requer extensões pg_cron e pg_net habilitadas no projeto Supabase

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove job anterior se existir (idempotente)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-check-due-dates') THEN
    PERFORM cron.unschedule('daily-check-due-dates');
  END IF;
END $$;

-- Agenda: todos os dias às 08:00 UTC
SELECT cron.schedule(
  'daily-check-due-dates',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://zfufkschpimuiedstxyl.supabase.co/functions/v1/check-due-dates',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body    := '{}'::jsonb
  ) AS request_id;
  $$
);
