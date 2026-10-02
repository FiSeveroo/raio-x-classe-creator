-- =============================================================================
-- RESET DO CORPUS DE TESTE — rodar UMA vez, no SQL Editor do Supabase,
-- na virada para o lançamento. Preparado em 1/out/2026.
--
-- ANTES DE RODAR (obrigatório, ver CLAUDE.md):
--   1. Backup completo do Supabase (schema + dados) feito e conferido pelo Filipe.
--   2. Confirmação explícita do Filipe na hora.
--
-- O QUE APAGA: as análises feitas pelos módulos (Lupa, Dossiê, Disputa, Voz).
-- O QUE NÃO APAGA (nunca): Termômetro — snapshots, videos_snapshot — e
-- arquivo_bruto (importação histórica do coletor).
--
-- Os IDs NÃO são reiniciados (sem RESTART IDENTITY): assim um link antigo
-- (ex.: /biblioteca/video/5) dá "não encontrado" em vez de abrir uma análise
-- nova que reaproveitasse o número.
--
-- Roda dentro de uma transação: confira as contagens do SELECT final e só
-- então troque ROLLBACK por COMMIT (ou rode de novo com COMMIT).
-- =============================================================================

BEGIN;

-- Contagens antes
SELECT 'antes' AS momento,
  (SELECT count(*) FROM classificacoes_video)  AS lupa,
  (SELECT count(*) FROM dossies_canal)         AS dossie,
  (SELECT count(*) FROM buscas_narrativa)      AS disputa_buscas,
  (SELECT count(*) FROM resultados_busca)      AS disputa_itens,
  (SELECT count(*) FROM analises_comentarios)  AS voz,
  (SELECT count(*) FROM snapshots)             AS termometro_snapshots,
  (SELECT count(*) FROM videos_snapshot)       AS termometro_videos;

-- Disputa: itens antes do cabeçalho (resultados_busca aponta para buscas_narrativa)
DELETE FROM resultados_busca;
DELETE FROM buscas_narrativa;

-- Lupa, Dossiê, Voz da Base
DELETE FROM classificacoes_video;
DELETE FROM dossies_canal;
DELETE FROM analises_comentarios;

-- Validações manuais de canais (âncoras da classificação).
-- DECISÃO PENDENTE DO FILIPE: manter (recomendado) ou apagar.
-- DELETE FROM canais_validados;

-- Contagens depois: os 5 do corpus devem ser 0; o Termômetro, IGUAL ao "antes".
SELECT 'depois' AS momento,
  (SELECT count(*) FROM classificacoes_video)  AS lupa,
  (SELECT count(*) FROM dossies_canal)         AS dossie,
  (SELECT count(*) FROM buscas_narrativa)      AS disputa_buscas,
  (SELECT count(*) FROM resultados_busca)      AS disputa_itens,
  (SELECT count(*) FROM analises_comentarios)  AS voz,
  (SELECT count(*) FROM snapshots)             AS termometro_snapshots,
  (SELECT count(*) FROM videos_snapshot)       AS termometro_videos;

ROLLBACK;  -- trocar por COMMIT depois de conferir
