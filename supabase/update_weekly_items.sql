-- ============================================================
-- 1. Ajustar Itens da Categoria Semanal
-- ============================================================

-- Primeiro, desativamos (ou removemos) os itens que não serão mais usados na categoria Semanal
-- Vamos manter apenas 'Limpeza das Máquinas' (ou 'Limpeza da Máquina')

DELETE FROM public.maintenance_items 
WHERE category_id IN (SELECT id FROM public.maintenance_categories WHERE frequency = 'weekly')
AND name NOT ILIKE '%Limpeza das Máquinas%'
AND name NOT ILIKE '%Limpeza da Máquina%';

-- Segundo, garantimos que o nome seja 'Limpeza da Máquina' (singular como solicitado)
UPDATE public.maintenance_items
SET name = 'Limpeza da Máquina'
WHERE category_id IN (SELECT id FROM public.maintenance_categories WHERE frequency = 'weekly')
AND (name ILIKE '%Limpeza das Máquinas%' OR name ILIKE '%Limpeza da Máquina%');

-- Terceiro, adicionamos o novo item 'Verificar Mangueira de Ar'
INSERT INTO public.maintenance_items (category_id, name, display_order)
VALUES (
    (SELECT id FROM public.maintenance_categories WHERE frequency = 'weekly' LIMIT 1),
    'Verificar Mangueira de Ar',
    2
);
