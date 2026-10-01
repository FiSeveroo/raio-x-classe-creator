import "server-only";
import { supabaseGravacao } from "@/lib/supabase/server";
import { db, descanonizarAnterior } from "@/lib/versionamento";

/*
 * Banco do Dossiê — porte de db.py (buscar_canonica_dossie, registrar_dossie,
 * aparicoes_canal_no_termometro, aparicoes_canal_em_buscas).
 */

export type CanonicaDossie = { id: number; versao_numero: number | null; data_dossie: string | null };

/** db.buscar_canonica_dossie */
export async function buscarCanonicaDossie(canalId: string): Promise<CanonicaDossie | null> {
  const { data, error } = await db()
    .from("dossies_canal")
    .select("id, versao_numero, data_dossie")
    .eq("canal_id", canalId)
    .eq("canonica", true)
    .limit(1);
  if (error) throw new Error(error.message);
  return (data?.[0] as CanonicaDossie) ?? null;
}

/** db.aparicoes_canal_no_termometro — até 100 aparições no trending. */
export async function aparicoesNoTermometro(canalId: string) {
  const { data, error } = await db()
    .from("videos_snapshot")
    .select("posicao_ranking, titulo, snapshots(data_coleta, semana_ano)")
    .eq("canal_id", canalId)
    .order("snapshot_id", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export type AparicaoBusca = {
  posicao_ranking: number;
  titulo: string | null;
  busca_id: number;
  buscas_narrativa: { termo_buscado: string; data_busca: string } | null;
};

/** db.aparicoes_canal_em_buscas — até 50 aparições na Disputa. */
export async function aparicoesEmBuscas(canalId: string): Promise<AparicaoBusca[]> {
  const { data, error } = await db()
    .from("resultados_busca")
    .select("posicao_ranking, titulo, busca_id, buscas_narrativa(termo_buscado, data_busca)")
    .eq("canal_id", canalId)
    .order("busca_id", { ascending: false })
    .limit(50);
  if (error) return [];
  return (data as unknown as AparicaoBusca[]) ?? [];
}

const corte = (s: string, n: number) => Array.from(s ?? "").slice(0, n).join("");

/** db.registrar_dossie — descanoniza a anterior (se vN > 1) e grava a nova como canônica. */
export async function registrarDossie(r: {
  canal_id: string;
  canal_nome: string;
  canal_descricao: string;
  inscritos: number;
  total_videos_canal: number;
  total_videos_analisados: number;
  sintomas_estruturais: string;
  auto_classificacao: string;
  classificacao_sociologica: string;
  tipo_conteudo_predominante: string;
  veredito_sonnet: string;
  rede_canais_json: string;
  composicao_videos_json: string;
  versao_numero: number;
  versao_anterior_id: number | null;
}): Promise<number> {
  if (r.versao_numero > 1 && r.versao_anterior_id) {
    await descanonizarAnterior("dossies_canal", r.versao_anterior_id);
  }
  const { data, error } = await supabaseGravacao()!
    .from("dossies_canal")
    .insert({
      canal_id: r.canal_id,
      canal_nome: corte(r.canal_nome, 200),
      canal_descricao: r.canal_descricao ? corte(r.canal_descricao, 5000) : "",
      inscritos: r.inscritos,
      total_videos_canal: r.total_videos_canal,
      total_videos_analisados: r.total_videos_analisados,
      sintomas_estruturais: r.sintomas_estruturais,
      auto_classificacao: r.auto_classificacao,
      classificacao_sociologica: r.classificacao_sociologica,
      tipo_conteudo_predominante: r.tipo_conteudo_predominante,
      veredito_sonnet: r.veredito_sonnet,
      rede_canais: r.rede_canais_json,
      composicao_videos: r.composicao_videos_json,
      versao_numero: r.versao_numero,
      versao_anterior_id: r.versao_anterior_id,
      canonica: true,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as number;
}
