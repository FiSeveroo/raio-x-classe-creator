import "server-only";
import { supabaseGravacao, supabaseLeitura } from "@/lib/supabase/server";
import type { ExemploAncora } from "./prompt";

/*
 * Banco da Lupa — porte de db.py (buscar_canal_validado, buscar_exemplos_ancora,
 * contar_uso_diario, buscar_canonica_video, calcular_peso_atualizacao,
 * pode_atualizar, descanonizar_anterior, registrar_lupa). Mesmas tabelas,
 * colunas, filtros e regras de versionamento.
 */

export const COOLDOWN_ATUALIZACAO_DIAS = 30;

// app.py: LIMITE_LUPA_POR_SESSAO e LIMITES_DIARIOS["lupa"]
export const LIMITE_LUPA_POR_SESSAO = 15;
export const LIMITE_DIARIO_LUPA = 80;

function db() {
  const c = supabaseLeitura();
  if (!c) throw new Error("Supabase não configurado.");
  return c;
}

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

/**
 * db.contar_uso_diario("lupa") — análises de hoje. O Streamlit Cloud roda em
 * UTC, então "hoje" é a data UTC. Em caso de erro, devolve 0 (não bloqueia).
 */
export async function contarUsoDiarioLupa(): Promise<number> {
  const hoje = new Date().toISOString().slice(0, 10);
  const { count, error } = await db()
    .from("classificacoes_video")
    .select("id", { count: "exact", head: true })
    .gte("data_classificacao", `${hoje}T00:00:00`)
    .lte("data_classificacao", `${hoje}T23:59:59`);
  return error ? 0 : (count ?? 0);
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

/** db.calcular_peso_atualizacao — v1: 1 slot; vN: 2^(N-1) slots. */
export function calcularPesoAtualizacao(versaoNumero: number): number {
  return versaoNumero <= 1 ? 1 : 2 ** (versaoNumero - 1);
}

/**
 * db.pode_atualizar — cooldown de 30 dias desde a versão canônica.
 * Data ilegível libera a atualização (como no Python).
 */
export function podeAtualizar(
  dataCanonicaIso: string | null,
  cooldownDias = COOLDOWN_ATUALIZACAO_DIAS,
): { pode: boolean; diasRestantes: number } {
  if (!dataCanonicaIso) return { pode: true, diasRestantes: 0 };
  // Sem fuso explícito, o Python trata como UTC (compara com utcnow()).
  const temFuso = /(Z|[+-]\d{2}:?\d{2})$/.test(dataCanonicaIso);
  const data = new Date(temFuso ? dataCanonicaIso : `${dataCanonicaIso}Z`);
  if (Number.isNaN(data.getTime())) return { pode: true, diasRestantes: 0 };
  const deltaMs = Date.now() - data.getTime();
  if (deltaMs >= cooldownDias * 86_400_000) return { pode: true, diasRestantes: 0 };
  const deltaDias = Math.floor(deltaMs / 86_400_000); // timedelta.days
  return { pode: false, diasRestantes: Math.max(1, cooldownDias - deltaDias) };
}

/** db.descanonizar_anterior */
async function descanonizarAnterior(registroId: number) {
  const { error } = await supabaseGravacao()!
    .from("classificacoes_video")
    .update({ canonica: false })
    .eq("id", registroId);
  if (error) throw new Error(error.message);
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
    await descanonizarAnterior(r.versao_anterior_id);
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
