-- 1. Cria a Tabela Base (Caso ainda não exista)
CREATE TABLE IF NOT EXISTS public.ink_withdrawals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
    quantity_liters NUMERIC NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Habilita RLS de segurança e permite o acesso para os usuários
ALTER TABLE public.ink_withdrawals ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE tablename = 'ink_withdrawals' AND policyname = 'Acesso total para usuários autenticados'
    ) THEN
        CREATE POLICY "Acesso total para usuários autenticados" 
        ON public.ink_withdrawals 
        FOR ALL 
        TO authenticated 
        USING (true) 
        WITH CHECK (true);
    END IF;
END
$$;

-- 3. Adiciona as Novas Colunas para Fechamento de Ciclo de Consumo (Caso ainda não existam)
ALTER TABLE public.ink_withdrawals 
ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS consumption_per_day_ml NUMERIC;

-- 4. Documentação de colunas da Tabela
COMMENT ON TABLE public.ink_withdrawals IS 'Log de retiradas de garrafas de tinta para cálculo de consumo médio.';
COMMENT ON COLUMN public.ink_withdrawals.closed_at IS 'Data da PRÓXIMA retirada da mesma tinta, fechando este ciclo de consumo.';
COMMENT ON COLUMN public.ink_withdrawals.consumption_per_day_ml IS 'Média diária (ml) consumida neste ciclo (Excluindo Domingos/Feriados).';
