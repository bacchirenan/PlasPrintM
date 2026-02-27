-- Adicionar o novo item 'Limpeza dos Sensores de Material' na categoria semanal
WITH weekly_cat AS (
    SELECT id FROM public.maintenance_categories WHERE frequency = 'weekly' LIMIT 1
)
INSERT INTO public.maintenance_items (category_id, name, display_order)
VALUES (
    (SELECT id FROM weekly_cat),
    'Limpeza dos Sensores de Material',
    8
)
ON CONFLICT (category_id, name) DO NOTHING;
