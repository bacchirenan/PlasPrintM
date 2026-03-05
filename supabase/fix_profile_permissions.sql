-- 1. Garante que a coluna avatar_url existe
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 2. Remove as políticas antigas para recriá-las com permissões de Admin/Master
DROP POLICY IF EXISTS "Usuários podem atualizar seus próprios perfis" ON public.profiles;

-- 3. Nova política: Usuário pode atualizar o próprio perfil OU ser um Admin/Master
CREATE POLICY "Usuários e Admins podem atualizar perfis"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  auth.uid() = id OR 
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('admin', 'master')
  )
)
WITH CHECK (
  auth.uid() = id OR 
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('admin', 'master')
  )
);

-- 4. Garante que todos os usuários autenticados continuam podendo ver as fotos
DROP POLICY IF EXISTS "Usuários autenticados podem ver perfis" ON public.profiles;
CREATE POLICY "Usuários autenticados podem ver perfis"
ON public.profiles FOR SELECT
TO authenticated
USING (TRUE);
