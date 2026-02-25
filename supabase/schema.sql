-- ============================================================
-- PlasPrint Manutenção - Schema do Banco de Dados Supabase
-- Compatível com PlasPrint IA
-- ============================================================

-- Habilitar extensão UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABELA: profiles (extensão do auth.users do Supabase)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'master', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS para profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários autenticados podem ver perfis" ON public.profiles;

CREATE POLICY "Usuários autenticados podem ver perfis"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "Usuários podem atualizar seus próprios perfis"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- ============================================================
-- TABELA: machines (máquinas)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.machines (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  number TEXT NOT NULL UNIQUE,
  description TEXT,
  active BOOLEAN DEFAULT TRUE,
  type TEXT NOT NULL DEFAULT 'machine' CHECK (type IN ('machine', 'room')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS para machines
ALTER TABLE public.machines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos os usuários autenticados podem ver máquinas"
  ON public.machines FOR SELECT
  TO authenticated USING (TRUE);

-- Seeds: 6 máquinas + 1 Sala
INSERT INTO public.machines (name, number) VALUES
  ('Máquina 28', '28'),
  ('Máquina 29', '29'),
  ('Máquina 180', '180'),
  ('Máquina 181', '181'),
  ('Máquina 182', '182'),
  ('Encabeçadora de Canudos', 'ENCAB_CANUDOS'),
  ('Sala de Impressão', 'SALA') -- Tipo atualizado no on conflict
ON CONFLICT (number) DO UPDATE SET type = EXCLUDED.type;

-- ============================================================
-- TABELA: maintenance_categories (categorias de manutenção)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.maintenance_categories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  frequency TEXT NOT NULL CHECK (frequency IN ('weekly', 'biweekly', 'quarterly', 'semiannual')),
  frequency_days INTEGER NOT NULL, -- dias para alerta de email
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.maintenance_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos os usuários autenticados podem ver categorias"
  ON public.maintenance_categories FOR SELECT
  TO authenticated USING (TRUE);

-- Seeds: categorias
INSERT INTO public.maintenance_categories (name, frequency, frequency_days, display_order) VALUES
  ('Semanal', 'weekly', 7, 1),
  ('Quinzenal', 'biweekly', 15, 2),
  ('Trimestral', 'quarterly', 90, 3),
  ('Semestral', 'semiannual', 180, 4)
ON CONFLICT DO NOTHING;

-- ============================================================
-- TABELA: maintenance_items (itens de manutenção)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.maintenance_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  category_id UUID REFERENCES public.maintenance_categories(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN DEFAULT TRUE,
  target_type TEXT NOT NULL DEFAULT 'machine' CHECK (target_type IN ('machine', 'room', 'both')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.maintenance_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos os usuários autenticados podem ver itens"
  ON public.maintenance_items FOR SELECT
  TO authenticated USING (TRUE);

-- Seeds: itens de manutenção
-- Semanal
WITH cat AS (SELECT id FROM public.maintenance_categories WHERE frequency = 'weekly' LIMIT 1)
INSERT INTO public.maintenance_items (category_id, name, display_order) VALUES
  ((SELECT id FROM cat), 'Limpeza das Máquinas', 1),
  ((SELECT id FROM cat), 'Limpeza dos Robôs', 2),
  ((SELECT id FROM cat), 'Limpeza das Esteiras', 3),
  ((SELECT id FROM cat), 'Limpeza dos Computadores', 4),
  ((SELECT id FROM cat), 'Limpeza do Reservatório de Tinta', 5),
  ((SELECT id FROM cat), 'Limpeza da Lâmpada', 6)
ON CONFLICT DO NOTHING;

-- Quinzenal
WITH cat AS (SELECT id FROM public.maintenance_categories WHERE frequency = 'biweekly' LIMIT 1)
INSERT INTO public.maintenance_items (category_id, name, display_order) VALUES
  ((SELECT id FROM cat), 'Limpeza da Garra do Hold', 1),
  ((SELECT id FROM cat), 'Limpeza do Trilho do Push', 2),
  ((SELECT id FROM cat), 'Checar Mangueiras das Printheads', 3),
  ((SELECT id FROM cat), 'Checar Mangueiras do Subtanque', 4),
  ((SELECT id FROM cat), 'Checar Mangueiras do Tanque', 5)
ON CONFLICT DO NOTHING;

-- Trimestral
WITH cat AS (SELECT id FROM public.maintenance_categories WHERE frequency = 'quarterly' LIMIT 1)
INSERT INTO public.maintenance_items (category_id, name, display_order) VALUES
  ((SELECT id FROM cat), 'Lubrificar Trilho do Carro', 1),
  ((SELECT id FROM cat), 'Limpar Grelha das Ventoinhas', 2)
ON CONFLICT DO NOTHING;

-- Semestral
WITH cat AS (SELECT id FROM public.maintenance_categories WHERE frequency = 'semiannual' LIMIT 1)
INSERT INTO public.maintenance_items (category_id, name, display_order) VALUES
  ((SELECT id FROM cat), 'Trocar Filtros de Tinta', 1)
ON CONFLICT DO NOTHING;

-- Item específico da Sala (Semanal)
WITH cat AS (SELECT id FROM public.maintenance_categories WHERE frequency = 'weekly' LIMIT 1)
INSERT INTO public.maintenance_items (category_id, name, display_order, target_type) VALUES
  ((SELECT id FROM cat), 'Organização e Limpeza da Sala', 10, 'room')
ON CONFLICT DO NOTHING;

-- ============================================================
-- TABELA: maintenance_logs (registros de manutenção)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.maintenance_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  machine_id UUID REFERENCES public.machines(id) ON DELETE CASCADE NOT NULL,
  item_id UUID REFERENCES public.maintenance_items(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  -- Campos exclusivos do master
  rating TEXT CHECK (rating IN ('ruim', 'bom', 'otimo')),
  observation TEXT,
  -- Metadados
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance e consultas do PlasPrint IA
CREATE INDEX IF NOT EXISTS idx_maintenance_logs_machine_id ON public.maintenance_logs(machine_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_logs_item_id ON public.maintenance_logs(item_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_logs_user_id ON public.maintenance_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_logs_completed_at ON public.maintenance_logs(completed_at);

ALTER TABLE public.maintenance_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários autenticados podem ver logs"
  ON public.maintenance_logs FOR SELECT
  TO authenticated USING (TRUE);

CREATE POLICY "Usuários autenticados podem inserir logs"
  ON public.maintenance_logs FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Masters podem atualizar logs"
  ON public.maintenance_logs FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('master', 'admin')
    )
  );

-- ============================================================
-- TABELA: email_alerts (controle de alertas enviados)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.email_alerts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  machine_id UUID REFERENCES public.machines(id) ON DELETE CASCADE NOT NULL,
  item_id UUID REFERENCES public.maintenance_items(id) ON DELETE CASCADE NOT NULL,
  alert_type TEXT NOT NULL DEFAULT 'overdue',
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  recipient_email TEXT NOT NULL DEFAULT 'renan.projeto@plasutil.com.br'
);

ALTER TABLE public.email_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Masters podem ver alertas de email"
  ON public.email_alerts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('master', 'admin')
    )
  );

-- ============================================================
-- TABELA: machine_events (ocorrências e eventos manuais)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.machine_events (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  machine_id UUID REFERENCES public.machines(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('occurrence', 'part_change', 'maintenance', 'error')),
  description TEXT NOT NULL,
  image_url TEXT,
  inventory_item_id UUID REFERENCES public.inventory_items(id) ON DELETE SET NULL,
  quantity_used INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS para machine_events
ALTER TABLE public.machine_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários autenticados podem ver eventos"
  ON public.machine_events FOR SELECT
  TO authenticated USING (TRUE);

CREATE POLICY "Usuários autenticados podem inserir eventos"
  ON public.machine_events FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Administradores podem atualizar eventos"
  ON public.machine_events FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role IN ('master', 'admin')
  ));

CREATE POLICY "Administradores podem apagar eventos"
  ON public.machine_events FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role IN ('master', 'admin')
  ));

-- ============================================================
-- VIEW: maintenance_status (para PlasPrint IA e consultas)
-- ============================================================
-- View robusta que cruza todas as máquinas com todos os itens e busca o último status
DROP VIEW IF EXISTS public.maintenance_status;
CREATE OR REPLACE VIEW public.maintenance_status AS
WITH all_machine_items AS (
  SELECT 
    m.id as machine_id, 
    m.name as machine_name, 
    m.number as machine_number,
    m.type as machine_type,
    mi.id as item_id, 
    mi.name as item_name,
    mi.target_type as item_target_type,
    mc.id as category_id,
    mc.name as category_name,
    mc.frequency,
    mc.frequency_days
  FROM public.machines m
  CROSS JOIN public.maintenance_items mi
  JOIN public.maintenance_categories mc ON mi.category_id = mc.id
  WHERE m.active = true AND mi.active = true
),
latest_logs AS (
  SELECT DISTINCT ON (machine_id, item_id)
    id as log_id,
    machine_id,
    item_id,
    completed_at,
    rating,
    observation,
    user_id
  FROM public.maintenance_logs
  ORDER BY machine_id, item_id, completed_at DESC
)
SELECT
  l.log_id,
  ami.machine_id,
  ami.machine_number,
  ami.machine_name,
  ami.machine_type,
  ami.item_id,
  ami.item_name,
  ami.item_target_type,
  ami.category_id,
  ami.category_name,
  ami.frequency,
  ami.frequency_days,
  l.completed_at,
  l.rating,
  l.observation,
  p.full_name AS user_name,
  p.email AS user_email,
  CASE 
    WHEN l.completed_at IS NULL THEN INTERVAL '999 years'
    ELSE NOW() - l.completed_at 
  END AS time_since_completion,
  CASE
    WHEN l.completed_at IS NULL THEN TRUE -- Nunca feito = Atrasado
    WHEN NOW() - l.completed_at > (ami.frequency_days || ' days')::INTERVAL THEN TRUE
    ELSE FALSE
  END AS is_overdue
FROM all_machine_items ami
LEFT JOIN latest_logs l ON ami.machine_id = l.machine_id AND ami.item_id = l.item_id
LEFT JOIN public.profiles p ON l.user_id = p.id;

-- ============================================================
-- FUNCTION: trigger para criar perfil automaticamente
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'user')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- FUNCTION: get_latest_maintenance (última manutenção por item/máquina)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_latest_maintenance(
  p_machine_id UUID DEFAULT NULL,
  p_item_id UUID DEFAULT NULL
)
RETURNS TABLE (
  machine_id UUID,
  item_id UUID,
  last_completed_at TIMESTAMPTZ,
  last_user_name TEXT,
  last_rating TEXT,
  last_observation TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (ml.machine_id, ml.item_id)
    ml.machine_id,
    ml.item_id,
    ml.completed_at AS last_completed_at,
    p.full_name AS last_user_name,
    ml.rating AS last_rating,
    ml.observation AS last_observation
  FROM public.maintenance_logs ml
  LEFT JOIN public.profiles p ON ml.user_id = p.id
  WHERE
    (p_machine_id IS NULL OR ml.machine_id = p_machine_id)
    AND (p_item_id IS NULL OR ml.item_id = p_item_id)
  ORDER BY ml.machine_id, ml.item_id, ml.completed_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- CONFIGURAÇÕES EXTRAS
-- ============================================================

-- Habilitar Realtime para maintenance_logs
ALTER PUBLICATION supabase_realtime ADD TABLE public.maintenance_logs;
