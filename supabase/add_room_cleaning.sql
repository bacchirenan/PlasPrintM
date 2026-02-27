-- Adicionar o item de limpeza específico para a Sala de Impressão
WITH weekly_cat AS (
  SELECT id FROM public.maintenance_categories WHERE frequency = 'weekly' LIMIT 1
)
INSERT INTO public.maintenance_items (category_id, name, display_order, target_type)
VALUES 
  ((SELECT id FROM weekly_cat), 'Limpeza e Organização da Sala', 10, 'room')
ON CONFLICT (category_id, name) DO UPDATE SET target_type = 'room';

-- Se existir o item com o nome antigo 'Organização e Limpeza da Sala', podemos removê-lo ou renomeá-lo
DELETE FROM public.maintenance_items WHERE name = 'Organização e Limpeza da Sala';
