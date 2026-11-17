-- =============================================================================
-- RAIO-X — Contas de pesquisador e projetos (aprovado pelo Filipe em 17/nov/2026)
-- =============================================================================
-- Tabelas NOVAS; nenhuma tabela do corpus é alterada. Fora do export semanal.
--
-- O login é o do próprio Supabase (auth.users): só o e-mail, nunca exposto no
-- site, no corpus nem no export (princípio 5, reescrito em 17/nov/2026). O
-- corpus NÃO registra quem rodou cada análise: o vínculo análise <-> conta
-- existe só dentro de projeto_itens, que é privado.
--
-- Segurança por linha (RLS): cada conta só lê e altera os próprios projetos.
-- Limites e uso diário só são gravados pelo servidor (chave secreta), para a
-- pessoa não poder mexer na própria cota.
--
-- Uso: SQL Editor do Supabase, uma vez. Inclui os GRANTs explícitos que o
-- Supabase deixou de dar sozinho a tabelas novas desde 30/out/2026.
-- =============================================================================

BEGIN;

-- Projetos de pesquisa -------------------------------------------------------
CREATE TABLE public.projetos (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  dono          uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  nome          text NOT NULL CHECK (char_length(nome) BETWEEN 1 AND 120),
  descricao     text NOT NULL DEFAULT '' CHECK (char_length(descricao) <= 4000),
  token_leitura text UNIQUE CHECK (token_leitura IS NULL OR char_length(token_leitura) >= 24),
  criado_em     timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX projetos_dono_idx ON public.projetos (dono);

-- Análises dentro de um projeto: aponta para a VERSÃO EXATA (id da linha) ---
CREATE TABLE public.projeto_itens (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  projeto_id    bigint NOT NULL REFERENCES public.projetos (id) ON DELETE CASCADE,
  modulo        text NOT NULL CHECK (modulo IN ('lupa', 'dossie', 'disputa', 'voz')),
  analise_id    bigint NOT NULL,
  nota          text NOT NULL DEFAULT '' CHECK (char_length(nota) <= 4000),
  adicionado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (projeto_id, modulo, analise_id)
);
CREATE INDEX projeto_itens_projeto_idx ON public.projeto_itens (projeto_id);

-- Preferências da conta (projeto ativo) -------------------------------------
CREATE TABLE public.perfis (
  id               uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  projeto_ativo_id bigint REFERENCES public.projetos (id) ON DELETE SET NULL,
  criado_em        timestamptz NOT NULL DEFAULT now()
);

-- Limites personalizados (definidos pelo Observatório no painel) ------------
CREATE TABLE public.limites_conta (
  user_id   uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  lupa      integer CHECK (lupa >= 0),
  disputa   integer CHECK (disputa >= 0),
  dossie    integer CHECK (dossie >= 0),
  voz       integer CHECK (voz >= 0),
  alterado_em timestamptz NOT NULL DEFAULT now()
);

-- Uso por conta e por dia (UTC) ----------------------------------------------
CREATE TABLE public.uso_conta (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  dia     date NOT NULL,
  modulo  text NOT NULL CHECK (modulo IN ('lupa', 'dossie', 'disputa', 'voz')),
  slots   integer NOT NULL DEFAULT 0 CHECK (slots >= 0),
  PRIMARY KEY (user_id, dia, modulo)
);

-- RLS -------------------------------------------------------------------------
ALTER TABLE public.projetos      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projeto_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfis        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.limites_conta ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uso_conta     ENABLE ROW LEVEL SECURITY;

CREATE POLICY "projetos do dono" ON public.projetos
  FOR ALL TO authenticated
  USING (dono = auth.uid()) WITH CHECK (dono = auth.uid());

CREATE POLICY "itens dos projetos do dono" ON public.projeto_itens
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projetos p WHERE p.id = projeto_id AND p.dono = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.projetos p WHERE p.id = projeto_id AND p.dono = auth.uid()));

CREATE POLICY "perfil próprio" ON public.perfis
  FOR ALL TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- Limites e uso: a pessoa só LÊ os seus; quem grava é o servidor (service_role).
CREATE POLICY "limites próprios (leitura)" ON public.limites_conta
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "uso próprio (leitura)" ON public.uso_conta
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- GRANTs (nada para anon) -----------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projetos, public.projeto_itens, public.perfis TO authenticated;
GRANT SELECT ON public.limites_conta, public.uso_conta TO authenticated;
GRANT ALL ON public.projetos, public.projeto_itens, public.perfis, public.limites_conta, public.uso_conta TO service_role;

-- Soma atômica do uso diário (chamada só pelo servidor) ----------------------
CREATE FUNCTION public.somar_uso_conta(p_user uuid, p_modulo text, p_slots integer)
RETURNS integer
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  INSERT INTO public.uso_conta (user_id, dia, modulo, slots)
  VALUES (p_user, (now() AT TIME ZONE 'utc')::date, p_modulo, p_slots)
  ON CONFLICT (user_id, dia, modulo) DO UPDATE SET slots = public.uso_conta.slots + EXCLUDED.slots
  RETURNING slots;
$$;
REVOKE ALL ON FUNCTION public.somar_uso_conta(uuid, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.somar_uso_conta(uuid, text, integer) TO service_role;

COMMIT;

-- Conferência: as cinco tabelas devem aparecer.
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public' AND table_name IN ('projetos','projeto_itens','perfis','limites_conta','uso_conta');
