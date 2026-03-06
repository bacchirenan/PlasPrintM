-- ============================================================
-- FIX: Lógica de Atraso e Agendamento de Alertas
-- ============================================================

-- 1. Corrigir a VIEW maintenance_status (Especialmente a lógica Semanal)
CREATE OR REPLACE VIEW public.maintenance_status AS
WITH all_machine_items AS (
  SELECT 
    m.id as machine_id, 
    m.name as machine_name, 
    m.number as machine_number,
    m.type as machine_type,
    mi.id as item_id, 
    mi.name as item_name,
    mi.target_type as item_target_type,
    mc.id as category_id,
    mc.name as category_name,
    mc.frequency,
    mc.frequency_days
  FROM public.machines m
  CROSS JOIN public.maintenance_items mi
  JOIN public.maintenance_categories mc ON mi.category_id = mc.id
  WHERE m.active = true AND mi.active = true
  -- 1. Filtrar por target_type (Sala vs Máquina)
  AND (
    (mi.target_type = 'both') OR
    (mi.target_type = 'machine' AND m.type = 'machine') OR
    (mi.target_type = 'room' AND m.type = 'room')
  )
  -- 2. Filtrar itens específicos da Encabeçadora e Transfer Canudo
  AND (
    CASE 
      WHEN m.number = 'ENCAB_CANUDOS' THEN
        mc.frequency IN ('weekly', 'quarterly') AND
        (
          (mc.frequency = 'weekly' AND (mi.name ILIKE 'Limpeza da Máquina' OR mi.name ILIKE 'Verificar Mangueira de Ar')) OR
          (mc.frequency = 'quarterly' AND mi.name ILIKE 'Lubrificar Trilho do Carro')
        )
      WHEN m.number = 'TRANSFER_CANUDO' THEN
        mc.frequency = 'weekly' AND
        (mi.name ILIKE 'Limpeza da Máquina' OR mi.name ILIKE 'Verificar Rolo de Silicone')
      ELSE TRUE
    END
  )
  -- 3. Excluir itens exclusivos das outras máquinas
  AND (
    CASE
      WHEN mi.name ILIKE 'Verificar Mangueira de Ar' THEN m.number = 'ENCAB_CANUDOS'
      WHEN mi.name ILIKE 'Verificar Rolo de Silicone' THEN m.number = 'TRANSFER_CANUDO'
      ELSE TRUE
    END
  )
  -- 4. Excluir limpeza de sensores de máquinas que não são as principais (28, 29, 180, 181, 182)
  AND (
    CASE
      WHEN mi.name ILIKE 'Limpeza dos Sensores de Material' THEN 
        m.number IN ('28', '29', '180', '181', '182')
      ELSE TRUE
    END
  )
),
latest_logs AS (
  SELECT DISTINCT ON (machine_id, item_id)
    id as log_id,
    machine_id,
    item_id,
    completed_at,
    rating,
    observation,
    user_id
  FROM public.maintenance_logs
  ORDER BY machine_id, item_id, completed_at DESC
)
SELECT
  l.log_id,
  ami.machine_id,
  ami.machine_number,
  ami.machine_name,
  ami.machine_type,
  ami.item_id,
  ami.item_name,
  ami.item_target_type,
  ami.category_id,
  ami.category_name,
  ami.frequency,
  ami.frequency_days,
  l.completed_at,
  l.rating,
  l.observation,
  p.full_name AS user_name,
  p.email AS user_email,
  CASE 
    WHEN l.completed_at IS NULL THEN INTERVAL '999 years'
    ELSE NOW() - l.completed_at 
  END AS time_since_completion,
  CASE
    -- Lógica para frequencia SEMANAL (Reinicia Sexta 22:00)
    WHEN ami.frequency = 'weekly' THEN
      CASE
        WHEN l.completed_at IS NULL THEN TRUE
        WHEN l.completed_at < (
          CASE 
            WHEN extract(dow from now()) > 5 OR (extract(dow from now()) = 5 AND extract(hour from now()) >= 22)
            THEN (date_trunc('week', now()) + interval '4 days 22 hours')
            ELSE (date_trunc('week', now()) - interval '2 days 2 hours') -- CORRIGIDO: Sexta passada 22h
          END
        ) THEN TRUE
        ELSE FALSE
      END
    -- Lógica para frequencia QUINZENAL (1º e 3º Sábado)
    WHEN ami.frequency = 'biweekly' THEN
      CASE
        WHEN l.completed_at IS NULL THEN TRUE
        WHEN l.completed_at < (
          WITH RECURSIVE fridays AS (
            SELECT (date_trunc('month', now()) + (n || ' days')::interval + interval '22 hours') as fri_date
            FROM generate_series(-35, 31) n
            WHERE extract(dow from (date_trunc('month', now()) + (n || ' days')::interval)) = 5
          ),
          reference_fridays AS (
            SELECT fri_date FROM fridays
            WHERE ceil(extract(day from (fri_date + interval '1 day')) / 7) IN (1, 3)
          )
          SELECT MAX(fri_date) FROM reference_fridays WHERE fri_date <= now()
        ) THEN TRUE
        ELSE FALSE
      END
    -- Lógica para frequencia TRIMESTRAL (1º Sábado de Março, Junho e Novembro)
    WHEN ami.frequency = 'quarterly' THEN
      CASE
        WHEN l.completed_at IS NULL THEN TRUE
        WHEN l.completed_at < (
          WITH quarterly_dates AS (
            SELECT (date_trunc('year', d) + (extract(month from d) - 1 || ' months')::interval + (n || ' days')::interval + interval '22 hours') as fri_date
            FROM (SELECT date_trunc('year', now()) - interval '1 year' as d UNION SELECT date_trunc('year', now())) years
            CROSS JOIN generate_series(0, 6) n
            WHERE extract(month from (date_trunc('year', d) + (extract(month from d) - 1 || ' months')::interval + (n || ' days')::interval)) IN (3, 6, 11)
              AND extract(dow from (date_trunc('year', d) + (extract(month from d) - 1 || ' months')::interval + (n || ' days')::interval)) = 5
          ),
          reference_fridays AS (
            SELECT fri_date FROM quarterly_dates
            WHERE extract(day from (fri_date + interval '1 day')) <= 7
          )
          SELECT MAX(fri_date) FROM reference_fridays WHERE fri_date <= now()
        ) THEN TRUE
        ELSE FALSE
      END
    -- Lógica para frequencia SEMESTRAL (1º Sábado de Fevereiro e Agosto)
    WHEN ami.frequency = 'semiannual' THEN
      CASE
        WHEN l.completed_at IS NULL THEN TRUE
        WHEN l.completed_at < (
          WITH semiannual_dates AS (
            SELECT (date_trunc('year', d) + (extract(month from d) - 1 || ' months')::interval + (n || ' days')::interval + interval '22 hours') as fri_date
            FROM (SELECT date_trunc('year', now()) - interval '1 year' as d UNION SELECT date_trunc('year', now())) years
            CROSS JOIN generate_series(0, 6) n
            WHERE extract(month from (date_trunc('year', d) + (extract(month from d) - 1 || ' months')::interval + (n || ' days')::interval)) IN (2, 8)
              AND extract(dow from (date_trunc('year', d) + (extract(month from d) - 1 || ' months')::interval + (n || ' days')::interval)) = 5
          ),
          reference_fridays AS (
            SELECT fri_date FROM semiannual_dates
            WHERE extract(day from (fri_date + interval '1 day')) <= 7
          )
          SELECT MAX(fri_date) FROM reference_fridays WHERE fri_date <= now()
        ) THEN TRUE
        ELSE FALSE
      END
  END AS is_overdue
FROM all_machine_items ami
LEFT JOIN latest_logs l ON ami.machine_id = l.machine_id AND ami.item_id = l.item_id
LEFT JOIN public.profiles p ON l.user_id = p.id;

-- 2. Recriar o agendamento do pg_cron com segurança
-- Removemos apenas se existir, para não causar erro
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'enviar-alertas-manutencao-atraso-diario') THEN
        PERFORM cron.unschedule('enviar-alertas-manutencao-atraso-diario');
    END IF;
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'enviar-alertas-manutencao-diario') THEN
        PERFORM cron.unschedule('enviar-alertas-manutencao-diario');
    END IF;
END $$;

-- Agora agendamos com a URL e Authorization correta
SELECT cron.schedule(
  'enviar-alertas-manutencao-atraso-diario',
  '0 9 * * *',
  $$
  SELECT
    net.http_post(
      url:='https://fxnmlzhxdryinfwzxjaz.supabase.co/functions/v1/send-overdue-alerts',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4bm1semh4ZHJ5aW5md3p4amF6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTk1OTkxNCwiZXhwIjoyMDg3NTM1OTE0fQ.lkLHSDu2cHkqnSA32K4iF2A680PRPXMBtdCbymZVIVM"}'::jsonb,
      body:='{}'::jsonb
    ) as request_id;
  $$
);
