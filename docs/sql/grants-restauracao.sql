-- =============================================================================
-- RAIO-X — Permissões da Data API para usar DEPOIS de restaurar o backup
-- =============================================================================
-- Por quê: o backup de 1/out/2026 (pg_dump, Desktop/backup-raiox-2026-10-01)
-- foi feito SEM privilégios (nenhum GRANT no arquivo). Até 30/out/2026 o
-- Supabase dava esses GRANTs sozinho a toda tabela nova em "public"; a partir
-- daí, não dá mais. Restaurar o backup num projeto (novo ou zerado) sem rodar
-- este arquivo deixa o site, o coletor e o exportador com "permission denied".
--
-- Quem pode ler/gravar o quê continua sendo decidido pelas políticas de RLS,
-- que ESTÃO no backup (9 tabelas com RLS, 16 políticas). Estes GRANTs só
-- reproduzem o padrão antigo do Supabase, que é o que as tabelas têm hoje.
--
-- Uso: SQL Editor do Supabase, logo depois de restaurar o backup.
-- NÃO rodar no projeto atual (as tabelas de hoje já têm as permissões).
-- =============================================================================

BEGIN;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT ALL ON TABLE
  public.analises_comentarios,
  public.arquivo_bruto,
  public.buscas_narrativa,
  public.canais_validados,
  public.classificacoes_video,
  public.dossies_canal,
  public.resultados_busca,
  public.snapshots,
  public.videos_snapshot
TO anon, authenticated, service_role;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public
TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.atualizar_timestamp()
TO anon, authenticated, service_role;

COMMIT;

-- Conferência (deve listar as 9 tabelas para anon, authenticated e service_role):
-- SELECT table_name, grantee, string_agg(privilege_type, ', ' ORDER BY privilege_type)
-- FROM information_schema.role_table_grants
-- WHERE table_schema = 'public' AND grantee IN ('anon', 'authenticated', 'service_role')
-- GROUP BY 1, 2 ORDER BY 1, 2;
