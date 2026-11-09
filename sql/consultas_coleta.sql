-- Registro bruto das consultas ao mostPopular (sem remoção de repetidos).
-- Só cria tabelas novas: não altera nenhuma tabela existente.
-- Rodar uma vez no SQL Editor do Supabase ANTES do merge.

begin;

create table public.consultas_coleta (
    id bigint generated always as identity primary key,
    coleta_uuid uuid not null,
    coletado_em timestamptz not null,
    snapshot_id bigint references public.snapshots(id) on delete set null,
    endpoint text not null,
    http_status integer,
    erro_motivo text,
    itens_devolvidos integer not null default 0,
    unique (coleta_uuid, endpoint)
);

create table public.consultas_coleta_videos (
    id bigint generated always as identity primary key,
    consulta_id bigint not null references public.consultas_coleta(id) on delete cascade,
    posicao integer not null,
    video_id text not null,
    category_id text,
    canal_id text,
    visualizacoes bigint,
    unique (consulta_id, posicao)
);

alter table public.consultas_coleta enable row level security;
alter table public.consultas_coleta_videos enable row level security;

create policy "Leitura publica de consultas_coleta" on public.consultas_coleta
    for select to anon, authenticated using (true);
create policy "Leitura publica de consultas_coleta_videos" on public.consultas_coleta_videos
    for select to anon, authenticated using (true);

grant select on public.consultas_coleta, public.consultas_coleta_videos to anon, authenticated;
grant all on public.consultas_coleta, public.consultas_coleta_videos to service_role;

commit;
