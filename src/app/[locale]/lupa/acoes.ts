"use server";

import { classificarComClaude } from "@/lib/lupa/classificar";
import { buscarCanonicaVideo, registrarLupa } from "@/lib/lupa/registro";
import { buscarMetadadosCanal, buscarMetadadosVideo, extrairVideoId } from "@/lib/lupa/youtube";
import {
  calcularPesoAtualizacao,
  consumirSlots,
  contarUsoDiario,
  descreverExistente,
  LIMITES,
  slotsUsados,
  type ResultadoModulo,
} from "@/lib/versionamento";
import { ErroPrevisto } from "@/lib/youtube";

/*
 * Fluxo da Lupa — porte de renderizar_lupa (app.py):
 *   URL → limite diário → versão canônica existente? (ver / gerar nova versão)
 *   → YouTube (vídeo + canal) → classificação → registro versionado.
 *
 * Diferenças deliberadas em relação ao Streamlit (ver messages/REVISAO.md):
 *   - Sem o cache SQLite local; o corpus no Supabase já é o cache.
 *   - Atualizar consome o peso da versão (1, 2, 4, 8…) do limite da sessão.
 *   - Slot só é descontado quando a análise é gravada.
 *   - Turnstile entra na Fase 3.
 */

export async function analisarVideo(entrada: {
  valor: string;
  /** Presente quando o usuário escolheu "Gerar vN" sobre uma canônica existente. */
  atualizar?: { versaoAnteriorId: number };
}): Promise<ResultadoModulo> {
  const videoId = extrairVideoId(entrada.valor.trim());
  if (!videoId) return { estado: "erro", codigo: "url_invalida" };

  const restantes = LIMITES.lupa.sessao - (await slotsUsados("lupa"));
  if (restantes <= 0) return { estado: "erro", codigo: "limite_sessao" };

  try {
    // Limite diário global (verificar_limite_diario). Falha ao contar não bloqueia.
    const uso = await contarUsoDiario("lupa");
    if (uso >= LIMITES.lupa.diario) return { estado: "erro", codigo: "limite_diario", uso };

    // Versão canônica no corpus?
    const canonica = await buscarCanonicaVideo(videoId);
    let proximaVersao = 1;
    let versaoAnteriorId: number | null = null;

    if (canonica) {
      const existente = descreverExistente(canonica, canonica.data_classificacao);
      const pediuAtualizacao = entrada.atualizar?.versaoAnteriorId === canonica.id;
      if (!pediuAtualizacao || !existente.pode) return existente;
      proximaVersao = existente.proximaVersao;
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

    await consumirSlots("lupa", peso);
    return { estado: "ok", id };
  } catch (e) {
    if (e instanceof ErroPrevisto) return { estado: "erro", codigo: e.codigo, detalhe: e.message };
    console.error("[lupa]", e);
    return { estado: "erro", codigo: "falha", detalhe: e instanceof Error ? e.message : String(e) };
  }
}
