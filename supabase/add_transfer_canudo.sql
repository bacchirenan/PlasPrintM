-- Adicionar Nova Máquina: Transfer Canudo
INSERT INTO public.machines (name, number)
VALUES ('Transfer Canudo', 'TRANSFER_CANUDO')
ON CONFLICT (number) DO NOTHING;

-- Adicionar Item de Manutenção: Verificar Rolo de Silicone
-- Na categoria Semanal
INSERT INTO public.maintenance_items (category_id, name, display_order)
VALUES (
    (SELECT id FROM public.maintenance_categories WHERE frequency = 'weekly' LIMIT 1),
    'Verificar Rolo de Silicone',
    3
)
ON CONFLICT DO NOTHING;
