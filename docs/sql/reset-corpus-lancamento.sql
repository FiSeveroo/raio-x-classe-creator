-- =============================================================================
-- RESET DO CORPUS DE TESTE — rodar UMA vez, no SQL Editor do Supabase,
-- na virada para o lançamento. Preparado em 1/out/2026.
--
-- ANTES DE RODAR (obrigatório, ver CLAUDE.md):
--   1. Backup completo do Supabase (schema + dados) feito e conferido pelo Filipe.
--      FEITO em 1/out/2026: Desktop/backup-raiox-2026-10-01/supabase-completo.sql
--   2. Confirmação explícita do Filipe na hora.
--
-- O QUE APAGA: as análises feitas pelos módulos (Lupa, Dossiê, Disputa, Voz).
-- O QUE NÃO APAGA (nunca): Termômetro — snapshots, videos_snapshot —,
-- arquivo_bruto (importação histórica do coletor) e canais_validados.
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
  (SELECT count(*) FROM videos_snapshot)       AS termometro_videos,
  (SELECT count(*) FROM arquivo_bruto)         AS arquivo_bruto,
  (SELECT count(*) FROM canais_validados)      AS canais_validados;

-- Disputa: itens antes do cabeçalho (resultados_busca aponta para buscas_narrativa)
DELETE FROM resultados_busca;
DELETE FROM buscas_narrativa;

-- Lupa, Dossiê, Voz da Base
DELETE FROM classificacoes_video;
DELETE FROM dossies_canal;
DELETE FROM analises_comentarios;

-- canais_validados (validações manuais do Filipe) é MANTIDA — decidido em 1/out/2026.

-- Contagens depois: os 5 do corpus devem ser 0; Termômetro, arquivo_bruto e
-- canais_validados, IGUAIS ao "antes".
SELECT 'depois' AS momento,
  (SELECT count(*) FROM classificacoes_video)  AS lupa,
  (SELECT count(*) FROM dossies_canal)         AS dossie,
  (SELECT count(*) FROM buscas_narrativa)      AS disputa_buscas,
  (SELECT count(*) FROM resultados_busca)      AS disputa_itens,
  (SELECT count(*) FROM analises_comentarios)  AS voz,
  (SELECT count(*) FROM snapshots)             AS termometro_snapshots,
  (SELECT count(*) FROM videos_snapshot)       AS termometro_videos,
  (SELECT count(*) FROM arquivo_bruto)         AS arquivo_bruto,
  (SELECT count(*) FROM canais_validados)      AS canais_validados;

ROLLBACK;  -- trocar por COMMIT depois de conferir
