import "server-only";
import { pyCorte, pyInt } from "@/lib/py";
import { supabaseGravacao } from "@/lib/supabase/server";
import { db, descanonizarAnterior } from "@/lib/versionamento";
import { ErroHttpYoutube, ErroPrevisto, youtubeGet } from "@/lib/youtube";
import type { Comentario, DossieContexto } from "./prompts";

/*
 * YouTube e banco da Voz da Base — porte de buscar_comentarios_video (app.py)
 * e de db.py (buscar_canonica_comentarios, buscar_dossie_canal_existente,
 * registrar_analise_comentarios, buscar_distribuicao_ipps).
 */

type ThreadApi = {
  id: string;
  snippet: {
    totalReplyCount?: number;
    topLevelComment: { snippet: { authorDisplayName?: string; textOriginal?: string; likeCount?: number; publishedAt?: string } };
  };
};

/**
 * commentThreads.list — 1 unidade por página de 100. A ordem "relevance" do
 * YouTube é editorial (likes + datas), não amostra estatística.
 */
export async function buscarComentariosVideo(videoId: string, max = 100): Promise<Comentario[]> {
  let data: { items?: ThreadApi[] };
  try {
    data = await youtubeGet("commentThreads", {
      videoId,
      part: "snippet",
      maxResults: Math.min(max, 100),
      order: "relevance",
      textFormat: "plainText",
    }, 20_000);
  } catch (e) {
    // 403 = comentários desativados pelo criador (mesma leitura do Python)
    if (e instanceof ErroHttpYoutube && e.status === 403) {
      throw new ErroPrevisto("comentarios_desativados", "Os comentários estão desativados neste vídeo.");
    }
    throw e;
  }
  return (data.items ?? []).map((item) => {
    const s = item.snippet.topLevelComment.snippet;
    return {
      id: item.id,
      autor: s.authorDisplayName ?? "",
      texto: s.textOriginal ?? "",
      likes: pyInt(s.likeCount ?? 0),
      data: s.publishedAt ?? "",
      respostas: item.snippet.totalReplyCount ?? 0,
    };
  });
}

export type CanonicaComentarios = { id: number; versao_numero: number | null; data_analise: string | null };

/** db.buscar_canonica_comentarios */
export async function buscarCanonicaComentarios(videoId: string): Promise<CanonicaComentarios | null> {
  const { data, error } = await db()
    .from("analises_comentarios")
    .select("id, versao_numero, data_analise")
    .eq("video_id", videoId)
    .eq("canonica", true)
    .limit(1);
  if (error) throw new Error(error.message);
  return (data?.[0] as CanonicaComentarios) ?? null;
}

/** db.buscar_dossie_canal_existente — dossiê mais recente do canal (qualquer versão). */
export async function buscarDossieCanalExistente(canalId: string): Promise<DossieContexto | null> {
  const { data, error } = await db()
    .from("dossies_canal")
    .select("classificacao_sociologica, tipo_conteudo_predominante, sintomas_estruturais")
    .eq("canal_id", canalId)
    .order("data_dossie", { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  return (data?.[0] as DossieContexto) ?? null;
}

/**
 * db.buscar_distribuicao_ipps — TODOS os IPPs já calculados (inclusive de
 * versões não canônicas, como no Python), para calibrar os percentis.
 */
export async function buscarDistribuicaoIpps(): Promise<number[]> {
  const { data, error } = await db().from("analises_comentarios").select("indice_pressao_produtiva");
  if (error) return [];
  return (data ?? [])
    .map((r) => (r as { indice_pressao_produtiva: unknown }).indice_pressao_produtiva)
    .filter((v) => v !== null && v !== undefined)
    .map(Number);
}

/** db.registrar_analise_comentarios */
export async function registrarAnaliseComentarios(r: {
  video_id: string;
  titulo_video: string;
  canal_id: string;
  canal_nome: string;
  total: number;
  indice_pressao_produtiva: unknown;
  distribuicao_dimensoes_json: string;
  sintese_qualitativa: unknown;
  contradicao_estrutural: unknown;
  comentarios_brutos_json: string;
  versao_numero: number;
  versao_anterior_id: number | null;
}): Promise<number> {
  if (r.versao_numero > 1 && r.versao_anterior_id) {
    await descanonizarAnterior("analises_comentarios", r.versao_anterior_id);
  }
  const { data, error } = await supabaseGravacao()!
    .from("analises_comentarios")
    .insert({
      video_id: r.video_id,
      titulo_video: pyCorte(r.titulo_video, 500),
      canal_id: r.canal_id,
      canal_nome: pyCorte(r.canal_nome, 200),
      total_analisados: r.total,
      indice_pressao_produtiva: r.indice_pressao_produtiva,
      distribuicao_dimensoes: r.distribuicao_dimensoes_json,
      sintese_qualitativa: r.sintese_qualitativa,
      contradicao_estrutural: r.contradicao_estrutural,
      comentarios_brutos: r.comentarios_brutos_json,
      versao_numero: r.versao_numero,
      versao_anterior_id: r.versao_anterior_id,
      canonica: true,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as number;
}
