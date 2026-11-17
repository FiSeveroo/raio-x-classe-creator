-- =============================================================================
-- RAIO-X — Registro de erros do site (tabela nova, aprovada pelo Filipe em 17/nov/2026)
-- =============================================================================
-- O site grava aqui as falhas do SISTEMA (resposta quebrada da IA, erro da API
-- do YouTube, erro inesperado do servidor), para o painel interno do Termômetro
-- mostrar o volume toda semana. Erros de quem usa (link inválido, limite de uso,
-- vídeo sem comentários) NÃO entram.
--
-- Sem dado pessoal (princípio 5): nada de IP, cookie, cabeçalho ou e-mail.
-- "entrada" guarda só o que foi analisado (link do vídeo/canal ou tema).
--
-- Leitura pública, como as demais tabelas do corpus: o painel usa a chave
-- publicável. Fora do export semanal (o exportador só exporta as tabelas que
-- lista em ESQUEMAS).
--
-- Uso: SQL Editor do Supabase, uma vez. Inclui os GRANTs explícitos que o
-- Supabase deixou de dar sozinho a tabelas novas desde 30/out/2026.
-- =============================================================================

BEGIN;

CREATE TABLE public.erros_app (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  criado_em  timestamptz NOT NULL DEFAULT now(),
  modulo     text NOT NULL CHECK (char_length(modulo) <= 40),
  codigo     text NOT NULL CHECK (char_length(codigo) <= 60),
  mensagem   text NOT NULL DEFAULT '' CHECK (char_length(mensagem) <= 2000),
  entrada    text CHECK (char_length(entrada) <= 500)
);

CREATE INDEX erros_app_criado_em_idx ON public.erros_app (criado_em DESC);

ALTER TABLE public.erros_app ENABLE ROW LEVEL SECURITY;

CREATE POLICY "erros_app leitura pública" ON public.erros_app
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "erros_app gravação pelo site" ON public.erros_app
  FOR INSERT TO anon, authenticated WITH CHECK (true);

GRANT SELECT, INSERT ON TABLE public.erros_app TO anon, authenticated;
GRANT ALL ON TABLE public.erros_app TO service_role;

COMMIT;

-- Conferência: deve devolver 0 linhas e nenhum erro.
-- SELECT * FROM public.erros_app LIMIT 1;
