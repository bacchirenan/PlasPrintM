-- ============================================================
-- 1. Habilitar a extensão pg_cron (Execute no SQL Editor)
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ============================================================
-- 2. Agendar a Edge Function (Exemplo: Todo dia às 08:00)
-- ============================================================
-- Substitua 'SUA_URL_DA_FUNCTION' pela URL gerada após o deploy
-- E 'SEU_ANON_KEY' por uma chave válida (ou use Service Role)

SELECT cron.schedule(
  'enviar-alertas-manutencao-diario', -- Nome do job
  '0 8 * * *',                       -- Cron syntax (08:00 AM)
  $$
  SELECT
    net.http_post(
      url:='https://fxnmlzhxdryinfwzxjaz.supabase.co/functions/v1/send-overdue-alerts',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer SEU_SERVICE_ROLE_KEY"}'::jsonb,
      body:='{}'::jsonb
    ) as request_id;
  $$
);

-- ============================================================
-- 3. COMANDOS PARA DEPLOY (Copie e cole no seu terminal local)
-- ============================================================
-- npx supabase secrets set GMAIL_USER=impressaoplasutil@gmail.com
-- npx supabase secrets set GMAIL_PASS="vlny khbs hrpo aino"
-- npx supabase secrets set ALERT_EMAIL=renan.projeto@plasutil.com.br
-- npx supabase functions deploy send-overdue-alerts
