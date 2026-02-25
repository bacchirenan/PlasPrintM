-- ============================================================
-- 1. Habilitar Extensões Necessárias (Execute Primeiro)
-- ============================================================
-- Execute estas linhas para garantir que o sistema de agendamento funcione.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ============================================================
-- 2. Agendar Alerta de Estoque Baixo
-- ============================================================
-- Este job verifica o estoque e envia e-mail se houver itens abaixo do mínimo.
-- Configurado para rodar de segunda a sexta às 09:00 AM.

SELECT cron.schedule(
  'enviar-alertas-estoque-baixo-diario', -- Nome do job
  '0 9 * * 1-5',                         -- Segunda a Sexta às 09:00 AM
  $$
  SELECT
    net.http_post(
      url:='https://fxnmlzhxdryinfwzxjaz.supabase.co/functions/v1/send-low-stock-alerts',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer SEU_SERVICE_ROLE_KEY"}'::jsonb,
      body:='{}'::jsonb
    ) as request_id;
  $$
);

-- ============================================================
-- 2. COMANDOS PARA DEPLOY (Terminal Local)
-- ============================================================
-- npx supabase functions deploy send-low-stock-alerts
--
-- NOTA: Os segredos de e-mail (GMAIL_USER, GMAIL_PASS) já estão configurados 
-- no seu Supabase da automação anterior, então não precisa repetir!
