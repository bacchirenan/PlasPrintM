-- ===========================================
-- PLANEJAMENTO DE CONSUMO DE TINTAS
-- Execute este script no SQL Editor do Supabase
-- ===========================================

-- Adiciona colunas para controle de consumo e planejamento
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'inventory_items' AND COLUMN_NAME = 'daily_consumption') THEN
        ALTER TABLE public.inventory_items ADD COLUMN daily_consumption NUMERIC DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'inventory_items' AND COLUMN_NAME = 'lead_time_days') THEN
        ALTER TABLE public.inventory_items ADD COLUMN lead_time_days INTEGER DEFAULT 7;
    END IF;
END $$;
