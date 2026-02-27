-- Limpar duplicatas na tabela de estoque de tintas e peças
-- Mantemos apenas o registro mais antigo para cada combinação de Nome e Código
DELETE FROM public.inventory_items
WHERE id NOT IN (
    SELECT MIN(id::text)::uuid
    FROM public.inventory_items
    GROUP BY name, COALESCE(code, '')
);

-- Garantir restrição única para evitar novos duplicados no estoque
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_items_name_code_key') THEN
        ALTER TABLE public.inventory_items ADD CONSTRAINT inventory_items_name_code_key UNIQUE (name, code);
    END IF;
END $$;
