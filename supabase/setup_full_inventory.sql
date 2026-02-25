-- =========================================================================
-- SCRIPT COMPLETO DE CRIAÇÃO (ESTOQUE + HISTÓRICO DE TINTAS)
-- =========================================================================

-- 1. Cria a Tabela Principal de Estoque (Se não existir)
CREATE TABLE IF NOT EXISTS public.inventory_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT, 
  quantity NUMERIC DEFAULT 0 NOT NULL,
  min_quantity INTEGER DEFAULT 0,
  location TEXT,
  image_url TEXT,
  category TEXT DEFAULT 'peca',
  daily_consumption NUMERIC DEFAULT 0,
  lead_time_days INTEGER DEFAULT 7,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ativa Segurança do Estoque
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'inventory_items' AND policyname = 'Acesso total para usuários autenticados'
    ) THEN
        CREATE POLICY "Acesso total para usuários autenticados" 
        ON public.inventory_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
END $$;


-- 2. Cria a Tabela Base do Histórico de Tintas (Se não existir, referenciando a tabela acima)
CREATE TABLE IF NOT EXISTS public.ink_withdrawals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
    quantity_liters NUMERIC NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Ativa Segurança do Histórico
ALTER TABLE public.ink_withdrawals ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'ink_withdrawals' AND policyname = 'Acesso total para usuários autenticados'
    ) THEN
        CREATE POLICY "Acesso total para usuários autenticados" 
        ON public.ink_withdrawals FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
END $$;


-- 3. Adiciona as Colunas para Fechamento de Ciclo de Consumo no Histórico
ALTER TABLE public.ink_withdrawals 
ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS consumption_per_day_ml NUMERIC;


-- 4. Adiciona ou garante que as colunas Extras de Tinta também existam no Inventory 
--    (Para o caso de a tabela inventory_items já existir e estar incompleta)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'inventory_items' AND COLUMN_NAME = 'category') THEN
        ALTER TABLE public.inventory_items ADD COLUMN category TEXT DEFAULT 'peca';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'inventory_items' AND COLUMN_NAME = 'daily_consumption') THEN
        ALTER TABLE public.inventory_items ADD COLUMN daily_consumption NUMERIC DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'inventory_items' AND COLUMN_NAME = 'lead_time_days') THEN
        ALTER TABLE public.inventory_items ADD COLUMN lead_time_days INTEGER DEFAULT 7;
    END IF;
END $$;
