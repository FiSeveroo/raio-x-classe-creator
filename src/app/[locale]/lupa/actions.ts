"use server";

import { cookies } from "next/headers";
import { classificarComClaude } from "@/lib/lupa/classificar";
import {
  buscarCanonicaVideo,
  calcularPesoAtualizacao,
  contarUsoDiarioLupa,
  LIMITE_DIARIO_LUPA,
  LIMITE_LUPA_POR_SESSAO,
  podeAtualizar,
  registrarLupa,
} from "@/lib/lupa/registro";
import { buscarMetadadosCanal, buscarMetadadosVideo, ErroLupa, extrairVideoId } from "@/lib/lupa/youtube";

/*
 * Fluxo da Lupa — porte de renderizar_lupa (app.py):
 *   URL → limite diário → versão canônica existente? (ver / gerar nova versão)
 *   → YouTube (vídeo + canal) → classificação → registro versionado.
 *
 * Diferenças deliberadas em relação ao Streamlit:
 *   - Sem o cache SQLite local (era efêmero no Streamlit Cloud); o corpus no
 *     Supabase já é o cache.
 *   - Atualizar consome o peso da versão (1, 2, 4, 8…) do limite da sessão,
 *     como a interface do Streamlit anunciava (lá a Lupa só descontava 1).
 *   - Turnstile entra na Fase 3 (no Streamlit, sem chave configurada, o gate
 *     também ficava aberto).
 */

const COOKIE_SESSAO = "raiox_lupa_usadas";

/** Slots usados nesta sessão do navegador. Cookie de sessão, sem dado pessoal. */
export async function slotsUsadosLupa(): Promise<number> {
  const n = Number((await cookies()).get(COOKIE_SESSAO)?.value ?? 0);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

async function consumirSlots(peso: number) {
  const usados = await slotsUsadosLupa();
  (await cookies()).set(COOKIE_SESSAO, String(usados + peso), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    // sem maxAge: cookie de sessão, some quando o navegador fecha
  });
}

export type ResultadoLupa =
  | { estado: "ok"; id: number }
  | {
      estado: "existente";
      id: number;
      versao: number;
      data: string | null;
      pode: boolean;
      diasRestantes: number;
      proximaVersao: number;
      peso: number;
    }
  | { estado: "erro"; codigo: CodigoErro; detalhe?: string; peso?: number; restantes?: number; uso?: number };

type CodigoErro =
  | "url_invalida"
  | "limite_sessao"
  | "slots_insuficientes"
  | "limite_diario"
  | "video_nao_encontrado"
  | "codigo_invalido"
  | "falha";

export async function analisarVideo(entrada: {
  url: string;
  /** Presente quando o usuário escolheu "Gerar vN" sobre uma canônica existente. */
  atualizar?: { versaoAnteriorId: number };
}): Promise<ResultadoLupa> {
  const videoId = extrairVideoId(entrada.url.trim());
  if (!videoId) return { estado: "erro", codigo: "url_invalida" };

  const usados = await slotsUsadosLupa();
  const restantes = LIMITE_LUPA_POR_SESSAO - usados;
  if (restantes <= 0) return { estado: "erro", codigo: "limite_sessao" };

  try {
    // Limite diário global (verificar_limite_diario). Falha ao contar não bloqueia.
    const uso = await contarUsoDiarioLupa();
    if (uso >= LIMITE_DIARIO_LUPA) return { estado: "erro", codigo: "limite_diario", uso };

    // Versão canônica no corpus?
    const canonica = await buscarCanonicaVideo(videoId);
    let proximaVersao = 1;
    let versaoAnteriorId: number | null = null;

    if (canonica) {
      const versao = canonica.versao_numero ?? 1;
      const { pode, diasRestantes } = podeAtualizar(canonica.data_classificacao);
      const proxima = versao + 1;
      const pesoProxima = calcularPesoAtualizacao(proxima);

      const pediuAtualizacao = entrada.atualizar?.versaoAnteriorId === canonica.id;
      if (!pediuAtualizacao || !pode) {
        return {
          estado: "existente",
          id: canonica.id,
          versao,
          data: canonica.data_classificacao,
          pode,
          diasRestantes,
          proximaVersao: proxima,
          peso: pesoProxima,
        };
      }
      proximaVersao = proxima;
      versaoAnteriorId = canonica.id;
    }

    const peso = calcularPesoAtualizacao(proximaVersao);
    if (peso > restantes) return { estado: "erro", codigo: "slots_insuficientes", peso, restantes };

    // Pipeline (mesma ordem do Python).
    const metaVideo = await buscarMetadadosVideo(videoId);
    const metaCanal = await buscarMetadadosCanal(metaVideo.canal_id);
    const resultado = await classificarComClaude(metaVideo, metaCanal);

    // {**meta_video, **meta_canal}: mesma ordem de chaves do Python.
    const metadados = { ...metaVideo, ...metaCanal };

    const id = await registrarLupa({
      video_id: videoId,
      titulo: metaVideo.titulo,
      canal_id: metaVideo.canal_id,
      canal_nome: metaVideo.canal_nome,
      tipo_produtor: resultado.tipo_produtor,
      tipo_conteudo: resultado.tipo_conteudo,
      justificativa: resultado.justificativa,
      metadados_json: JSON.stringify(metadados),
      versao_numero: proximaVersao,
      versao_anterior_id: versaoAnteriorId,
      is_short: metaVideo.is_short,
    });

    await consumirSlots(peso);
    return { estado: "ok", id };
  } catch (e) {
    if (e instanceof ErroLupa) return { estado: "erro", codigo: e.codigo, detalhe: e.message };
    console.error("[lupa]", e);
    return { estado: "erro", codigo: "falha", detalhe: e instanceof Error ? e.message : String(e) };
  }
}
