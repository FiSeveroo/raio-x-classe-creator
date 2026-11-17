-- Acrescenta os tópicos do vídeo (topicDetails.topicCategories) ao registro bruto.
-- Só adiciona uma coluna à tabela nova; não mexe em tabelas do Termômetro.
-- Rodar no SQL Editor do Supabase ANTES do merge.

alter table public.consultas_coleta_videos
    add column if not exists topic_categories text[];
