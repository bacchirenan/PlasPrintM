-- ============================================================
-- LIMPEZA DE DUPLICADOS E ORGANIZAÇÃO DOS ITENS
-- ============================================================

-- 1. Remover todos os itens duplicados (mesmo nome na mesma categoria)
-- Mantemos o ID mais antigo de cada nome/categoria
DELETE FROM public.maintenance_items
WHERE id NOT IN (
    SELECT MIN(id)
    FROM public.maintenance_items
    GROUP BY category_id, name
);

-- 2. Remover itens específicos que foram criados por engano
-- (Como 'Limpeza da Máquina' no singular, já que o frontend trata isso)
DELETE FROM public.maintenance_items 
WHERE name = 'Limpeza da Máquina';

-- 3. Garantir que temos apenas os itens corretos na categoria SEMANAL
WITH weekly_cat AS (
    SELECT id FROM public.maintenance_categories WHERE frequency = 'weekly' LIMIT 1
)
INSERT INTO public.maintenance_items (category_id, name, display_order)
VALUES 
    ((SELECT id FROM weekly_cat), 'Limpeza das Máquinas', 1),
    ((SELECT id FROM weekly_cat), 'Limpeza dos Robôs', 2),
    ((SELECT id FROM weekly_cat), 'Limpeza das Esteiras', 3),
    ((SELECT id FROM weekly_cat), 'Limpeza dos Computadores', 4),
    ((SELECT id FROM weekly_cat), 'Limpeza do Reservatório de Tinta', 5),
    ((SELECT id FROM weekly_cat), 'Limpeza da Lâmpada', 6),
    ((SELECT id FROM weekly_cat), 'Verificar Mangueira de Ar', 7)
ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order;

-- 4. Criar uma restrição única para evitar que isso aconteça de novo
-- (Se já não existir)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'maintenance_items_category_id_name_key') THEN
        ALTER TABLE public.maintenance_items ADD CONSTRAINT maintenance_items_category_id_name_key UNIQUE (category_id, name);
    END IF;
END $$;
