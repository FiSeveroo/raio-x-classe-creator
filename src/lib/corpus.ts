import "server-only";
import { supabaseLeitura } from "./supabase/server";

/*
 * Consultas de LEITURA ao corpus — porte fiel das funções equivalentes do
 * db.py legado (mesmas tabelas, mesmos filtros, mesma ordenação).
 * Nenhuma função aqui escreve no banco.
 */

// Mesmo teto do Streamlit (LIMITE_BIBLIOTECA_REGISTROS em app.py).
export const LIMITE_BIBLIOTECA = 500;

export type Contadores = {
  snapshots_termometro: number | null;
  videos_no_termometro: number | null;
  buscas_realizadas: number | null;
  dossies_canais: number | null;
  analises_voz_da_base: number | null;
};

const TABELAS_CONTADORES: Record<keyof Contadores, string> = {
  snapshots_termometro: "snapshots",
  videos_no_termometro: "videos_snapshot",
  buscas_realizadas: "buscas_narrativa",
  dossies_canais: "dossies_canal",
  analises_voz_da_base: "analises_comentarios",
};

/**
 * db.contadores_publicos. Diferença deliberada: o legado devolvia 0 quando
 * uma tabela falhava; aqui devolvemos null para a interface mostrar
 * "sem dados" em vez de um zero que parece medição real.
 */
export async function contadoresPublicos(): Promise<Contadores | null> {
  const db = supabaseLeitura();
  if (!db) return null;

  const chaves = Object.keys(TABELAS_CONTADORES) as (keyof Contadores)[];
  const valores = await Promise.all(
    chaves.map(async (chave) => {
      const { count, error } = await db
        .from(TABELAS_CONTADORES[chave])
        .select("id", { count: "exact", head: true });
      return error ? null : (count ?? null);
    }),
  );

  return Object.fromEntries(
    chaves.map((c, i) => [c, valores[i]]),
  ) as Contadores;
}

// ---------------------------------------------------------------------------
// Biblioteca
// ---------------------------------------------------------------------------

export type ClassificacaoVideo = {
  id: number;
  video_id: string;
  titulo: string | null;
  canal_id: string | null;
  canal_nome: string | null;
  tipo_produtor: string;
  tipo_conteudo: string;
  justificativa: string | null;
  data_classificacao: string | null;
  versao_numero: number | null;
  canonica: boolean | null;
  visualizacoes?: number | null;
  likes?: number | null;
  comentarios?: number | null;
  inscritos?: number | null;
  publicado_em?: string | null;
  metadados_json?: string | null;
  is_short?: boolean | null;
};

export type DossieResumo = {
  id: number;
  data_dossie: string | null;
  canal_id: string;
  canal_nome: string | null;
  inscritos: number | null;
  total_videos_canal: number | null;
  classificacao_sociologica: string;
  tipo_conteudo_predominante: string;
  versao_numero: number | null;
};

export type BuscaResumo = {
  id: number;
  data_busca: string | null;
  termo_buscado: string;
  total_analisados: number | null;
  versao_numero: number | null;
};

export type ComentariosResumo = {
  id: number;
  data_analise: string | null;
  video_id: string;
  titulo_video: string | null;
  canal_id: string | null;
  canal_nome: string | null;
  total_analisados: number | null;
  indice_pressao_produtiva: number | null;
  versao_numero: number | null;
};

export type ResultadoConsulta<T> =
  | { status: "ok"; dados: T }
  | { status: "sem_banco" }
  | { status: "erro"; mensagem: string };

async function consultar<T>(
  fn: (
    db: NonNullable<ReturnType<typeof supabaseLeitura>>,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
): Promise<ResultadoConsulta<T>> {
  const db = supabaseLeitura();
  if (!db) return { status: "sem_banco" };
  const { data, error } = await fn(db);
  if (error) return { status: "erro", mensagem: error.message };
  return { status: "ok", dados: data as T };
}

/** db.biblioteca_videos (apenas canônicas) */
export function bibliotecaVideos() {
  return consultar<ClassificacaoVideo[]>((db) =>
    db
      .from("classificacoes_video")
      .select("*")
      .eq("canonica", true)
      .order("data_classificacao", { ascending: false })
      .limit(LIMITE_BIBLIOTECA),
  );
}

/** db.biblioteca_dossies (apenas canônicas) */
export function bibliotecaDossies() {
  return consultar<DossieResumo[]>((db) =>
    db
      .from("dossies_canal")
      .select(
        "id, data_dossie, canal_id, canal_nome, inscritos, total_videos_canal," +
          " classificacao_sociologica, tipo_conteudo_predominante, versao_numero",
      )
      .eq("canonica", true)
      .order("data_dossie", { ascending: false })
      .limit(LIMITE_BIBLIOTECA),
  );
}

/** db.biblioteca_buscas (apenas canônicas) */
export function bibliotecaBuscas() {
  return consultar<BuscaResumo[]>((db) =>
    db
      .from("buscas_narrativa")
      .select("id, data_busca, termo_buscado, total_analisados, versao_numero")
      .eq("canonica", true)
      .order("data_busca", { ascending: false })
      .limit(LIMITE_BIBLIOTECA),
  );
}

/** db.biblioteca_comentarios (apenas canônicas) */
export function bibliotecaComentarios() {
  return consultar<ComentariosResumo[]>((db) =>
    db
      .from("analises_comentarios")
      .select(
        "id, data_analise, video_id, titulo_video, canal_id, canal_nome," +
          " total_analisados, indice_pressao_produtiva, versao_numero",
      )
      .eq("canonica", true)
      .order("data_analise", { ascending: false })
      .limit(LIMITE_BIBLIOTECA),
  );
}

/** db.buscar_analise_por_id para classificacoes_video */
export async function classificacaoVideoPorId(id: number) {
  const r = await consultar<ClassificacaoVideo[]>((db) =>
    db.from("classificacoes_video").select("*").eq("id", id).limit(1),
  );
  if (r.status !== "ok") return r;
  return { status: "ok" as const, dados: r.dados[0] ?? null };
}

export type VersaoVideo = Pick<
  ClassificacaoVideo,
  "id" | "data_classificacao" | "versao_numero" | "tipo_produtor" | "tipo_conteudo"
>;

/** db.historico_versoes_video */
export function historicoVersoesVideo(videoId: string) {
  return consultar<VersaoVideo[]>((db) =>
    db
      .from("classificacoes_video")
      .select("id, data_classificacao, versao_numero, tipo_produtor, tipo_conteudo")
      .eq("video_id", videoId)
      .order("versao_numero", { ascending: false }),
  );
}

// ---------------------------------------------------------------------------
// Dossiê
// ---------------------------------------------------------------------------

export type DossieCompleto = {
  id: number;
  canal_id: string;
  canal_nome: string | null;
  canal_descricao: string | null;
  inscritos: number | null;
  total_videos_canal: number | null;
  total_videos_analisados: number | null;
  sintomas_estruturais: string | null;
  auto_classificacao: string | null;
  classificacao_sociologica: string;
  tipo_conteudo_predominante: string;
  veredito_sonnet: string | null;
  rede_canais: string | null;
  composicao_videos: string | null;
  data_dossie: string | null;
  versao_numero: number | null;
  canonica: boolean | null;
};

/** db.buscar_analise_por_id para dossies_canal */
export async function dossiePorId(id: number) {
  const r = await consultar<DossieCompleto[]>((db) => db.from("dossies_canal").select("*").eq("id", id).limit(1));
  if (r.status !== "ok") return r;
  return { status: "ok" as const, dados: r.dados[0] ?? null };
}

export type VersaoDossie = Pick<
  DossieCompleto,
  "id" | "data_dossie" | "versao_numero" | "classificacao_sociologica" | "tipo_conteudo_predominante"
>;

/** db.historico_versoes_dossie */
export function historicoVersoesDossie(canalId: string) {
  return consultar<VersaoDossie[]>((db) =>
    db
      .from("dossies_canal")
      .select("id, data_dossie, versao_numero, classificacao_sociologica, tipo_conteudo_predominante")
      .eq("canal_id", canalId)
      .order("versao_numero", { ascending: false }),
  );
}
