-- Reagenda o cron de vencimentos com header de autorização correto
-- (sem o Bearer token a Edge Function retorna 401 e não executa)

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-check-due-dates') THEN
    PERFORM cron.unschedule('daily-check-due-dates');
  END IF;
END $$;

-- Agenda: todos os dias às 12:00 UTC (09:00 BRT)
SELECT cron.schedule(
  'daily-check-due-dates',
  '0 12 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://zfufkschpimuiedstxyl.supabase.co/functions/v1/check-due-dates',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpmdWZrc2NocGltdWllZHN0eHlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0ODcxODMsImV4cCI6MjA5MTA2MzE4M30.DtxT9AXtGW2yWdpX6jF6bvggFRkzwbbPwWBNfRWsYK4'
    ),
    body    := '{}'::jsonb
  ) AS request_id;
  $$
);
