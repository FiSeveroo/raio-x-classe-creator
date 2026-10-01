import "server-only";
import { supabaseGravacao } from "@/lib/supabase/server";
import { db, descanonizarAnterior, LIMITES } from "@/lib/versionamento";
import type { ExemploAncora } from "./prompt";

/*
 * Banco da Lupa — porte de db.py (buscar_canal_validado, buscar_exemplos_ancora,
 * buscar_canonica_video, registrar_lupa). Regras genéricas de versionamento
 * em src/lib/versionamento.ts.
 */

export const LIMITE_LUPA_POR_SESSAO = LIMITES.lupa.sessao;
export const LIMITE_DIARIO_LUPA = LIMITES.lupa.diario;

export type CanalValidado = {
  canal_id: string;
  canal_nome: string | null;
  tipo_produtor: string;
  tipo_conteudo: string | null;
  justificativa: string | null;
};

/** db.buscar_canal_validado — classificação humana do canal, se houver. */
export async function buscarCanalValidado(canalId: string): Promise<CanalValidado | null> {
  const { data, error } = await db().from("canais_validados").select("*").eq("canal_id", canalId).limit(1);
  if (error) return null;
  return (data?.[0] as CanalValidado) ?? null;
}

/** db.buscar_exemplos_ancora — validados mais recentes, para few-shot. */
export async function buscarExemplosAncora(limite = 20): Promise<ExemploAncora[]> {
  const { data, error } = await db()
    .from("canais_validados")
    .select("canal_nome, tipo_produtor, tipo_conteudo, justificativa")
    .order("atualizado_em", { ascending: false })
    .limit(limite);
  if (error) return [];
  return (data as ExemploAncora[]) ?? [];
}

export type CanonicaVideo = {
  id: number;
  versao_numero: number | null;
  data_classificacao: string | null;
};

/** db.buscar_canonica_video */
export async function buscarCanonicaVideo(videoId: string): Promise<CanonicaVideo | null> {
  const { data, error } = await db()
    .from("classificacoes_video")
    .select("id, versao_numero, data_classificacao")
    .eq("video_id", videoId)
    .eq("canonica", true)
    .limit(1);
  if (error) throw new Error(error.message);
  return (data?.[0] as CanonicaVideo) ?? null;
}

/**
 * db.registrar_lupa — grava a análise como canônica. Se versao_numero > 1,
 * descanoniza a versão anterior antes (mesma ordem do Python).
 */
export async function registrarLupa(r: {
  video_id: string;
  titulo: string;
  canal_id: string;
  canal_nome: string;
  tipo_produtor: string;
  tipo_conteudo: string;
  justificativa: string;
  metadados_json: string;
  versao_numero: number;
  versao_anterior_id: number | null;
  is_short: boolean | null;
}): Promise<number> {
  if (r.versao_numero > 1 && r.versao_anterior_id) {
    await descanonizarAnterior("classificacoes_video", r.versao_anterior_id);
  }
  const { data, error } = await supabaseGravacao()!
    .from("classificacoes_video")
    .insert({
      video_id: r.video_id,
      titulo: r.titulo ? Array.from(r.titulo).slice(0, 500).join("") : "",
      canal_id: r.canal_id,
      canal_nome: r.canal_nome ? Array.from(r.canal_nome).slice(0, 200).join("") : "",
      tipo_produtor: r.tipo_produtor,
      tipo_conteudo: r.tipo_conteudo,
      justificativa: r.justificativa,
      metadados_json: r.metadados_json,
      versao_numero: r.versao_numero,
      versao_anterior_id: r.versao_anterior_id,
      canonica: true,
      is_short: r.is_short,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as number;
}
