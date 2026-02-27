-- Renomear o item de limpeza para o singular em todo o sistema
UPDATE public.maintenance_items 
SET name = 'Limpeza da Máquina' 
WHERE name = 'Limpeza das Máquinas';
