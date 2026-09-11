-- ================================================================
-- EstoquePro (Verto) — Supabase SQL Migration
-- Cole este SQL no SQL Editor do seu projeto Supabase
-- ================================================================

-- 1. Tabela de dados do usuário
CREATE TABLE IF NOT EXISTS public.user_data (
  user_id  UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  data_json JSONB NOT NULL DEFAULT '{"products":[],"sales":[],"rentalProducts":[],"rentals":[],"loans":[]}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Habilitar Row Level Security (cada usuário só acessa seus próprios dados)
ALTER TABLE public.user_data ENABLE ROW LEVEL SECURITY;

-- 3. Política: usuário autenticado lê apenas seus dados
CREATE POLICY "Users can read own data"
  ON public.user_data
  FOR SELECT
  USING (auth.uid() = user_id);

-- 4. Política: usuário autenticado insere apenas seus dados
CREATE POLICY "Users can insert own data"
  ON public.user_data
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 5. Política: usuário autenticado atualiza apenas seus dados
CREATE POLICY "Users can update own data"
  ON public.user_data
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 6. Função que cria automaticamente a linha de dados ao registrar novo usuário
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_data (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- 7. Trigger: chama a função acima a cada novo usuário em auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
