-- ===========================================
-- REPARO E EXPANSÃO DO BANCO DE DADOS
-- Execute este script no SQL Editor do Supabase
-- ===========================================

-- 1. Corrige a constraint de tipos de eventos para aceitar 'maintenance' e 'error'
-- Isso resolve o erro {} ao salvar registros dessas categorias no Histórico.
ALTER TABLE public.machine_events DROP CONSTRAINT IF EXISTS machine_events_event_type_check;

ALTER TABLE public.machine_events 
ADD CONSTRAINT machine_events_event_type_check 
CHECK (event_type IN ('occurrence', 'part_change', 'maintenance', 'error'));

-- 2. Adiciona suporte a categorias no inventário
-- Permite distinguir entre 'Peças' e 'Tintas'
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'inventory_items' AND COLUMN_NAME = 'category') THEN
        ALTER TABLE public.inventory_items ADD COLUMN category TEXT DEFAULT 'peca';
    END IF;
END $$;
