-- 1. Garantir que a Sala de Impressão tenha o tipo 'room'
UPDATE public.machines 
SET type = 'room' 
WHERE number = 'SALA';

-- 2. Adicionar o item de limpeza específico para a Sala de Impressão
WITH weekly_cat AS (
  SELECT id FROM public.maintenance_categories WHERE frequency = 'weekly' LIMIT 1
)
INSERT INTO public.maintenance_items (category_id, name, display_order, target_type)
VALUES 
  ((SELECT id FROM weekly_cat), 'Limpeza e Organização da Sala', 10, 'room')
ON CONFLICT (category_id, name) DO UPDATE SET target_type = 'room';

-- 3. Remover o nome antigo se existir
DELETE FROM public.maintenance_items WHERE name = 'Organização e Limpeza da Sala';
