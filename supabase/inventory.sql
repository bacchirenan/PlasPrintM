-- ============================================================
-- TABELA DE ESTOQUE DE PEÇAS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.inventory_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT, -- Código interno ou do fabricante
  quantity INTEGER DEFAULT 0 NOT NULL,
  min_quantity INTEGER DEFAULT 0, -- Alerta de estoque baixo
  location TEXT, -- Prateleira/Corredor
  image_url TEXT, -- URL da imagem da peça
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

-- Usuários autenticados podem ver o estoque
CREATE POLICY "Usuários autenticados podem ver estoque"
  ON public.inventory_items FOR SELECT
  TO authenticated
  USING (TRUE);

-- Apenas Admins/Masters podem alterar o estoque (para controle rígido)
-- Ou permitir que usuários comuns alterem se o USER quiser. 
-- Vou assumir que todos podem alterar para agilizar o uso.
CREATE POLICY "Usuários autenticados podem alterar estoque"
  ON public.inventory_items FOR ALL
  TO authenticated
  USING (TRUE)
  WITH CHECK (TRUE);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_inventory_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_inventory_updated_at
  BEFORE UPDATE ON public.inventory_items
  FOR EACH ROW
  EXECUTE FUNCTION update_inventory_updated_at();

-- Dados iniciais (Opcional - deixando vazio para o usuário preencher)
