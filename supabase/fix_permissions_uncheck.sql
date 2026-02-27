-- ============================================================
-- 1. Habilitar Permissão de Exclusão (Uncheck) na tabela maintenance_logs
-- ============================================================

-- Remover política de DELETE antiga se existir (para evitar duplicatas)
DROP POLICY IF EXISTS "Usuários podem apagar seus próprios logs" ON public.maintenance_logs;
DROP POLICY IF EXISTS "Masters podem apagar qualquer log" ON public.maintenance_logs;

-- Permitir que usuários comuns apaguem apenas os logs que eles mesmos criaram
CREATE POLICY "Usuários podem apagar seus próprios logs"
  ON public.maintenance_logs FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Permitir que Masters e Admins apaguem qualquer log
CREATE POLICY "Masters podem apagar qualquer log"
  ON public.maintenance_logs FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('master', 'admin')
    )
  );

-- ============================================================
-- 2. Corrigir permissão de UPDATE para permitir que o dono também atualize
-- ============================================================
DROP POLICY IF EXISTS "Usuários podem atualizar seus próprios logs" ON public.maintenance_logs;

CREATE POLICY "Usuários podem atualizar seus próprios logs"
  ON public.maintenance_logs FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
