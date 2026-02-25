-- Atualização de Tabela para controle preciso de Consumo de Cores
ALTER TABLE public.ink_withdrawals 
ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS consumption_per_day_ml NUMERIC;

-- Nova tabela para salvar as exclusões/feriados de faturamento se precisar no futuro (opcional, por ora vamos tratar via código)

-- Atualiza a foreign key de ink_withdrawals para InventoryItems caso não exista um ON DELETE CASCADE, mas isso já existe.
-- Comentários:
COMMENT ON COLUMN public.ink_withdrawals.closed_at IS 'Data da PRÓXIMA retirada da mesma tinta, fechando este ciclo de consumo.';
COMMENT ON COLUMN public.ink_withdrawals.consumption_per_day_ml IS 'Média diária (ml) consumida neste ciclo (Excluindo Domingos/Feriados).';
