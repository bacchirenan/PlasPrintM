-- Tabela para registrar retiradas de tintas (garrafas de 1L)
CREATE TABLE IF NOT EXISTS public.ink_withdrawals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
    quantity_liters NUMERIC NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.ink_withdrawals ENABLE ROW LEVEL SECURITY;

-- Política de acesso total para usuários autenticados (simplificando para o contexto atual do projeto)
CREATE POLICY "Acesso total para usuários autenticados" 
ON public.ink_withdrawals 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- Comentário para documentar a tabela
COMMENT ON TABLE public.ink_withdrawals IS 'Log de retiradas de garrafas de tinta para cálculo de consumo médio.';
