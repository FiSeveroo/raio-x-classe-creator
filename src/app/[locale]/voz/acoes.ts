"use server";

import { chamarClaude } from "@/lib/llm";
import { parsearJsonLlm } from "@/lib/lupa/prompt";
import { buscarMetadadosVideo, extrairVideoId } from "@/lib/lupa/youtube";
import { pyJsonDumps } from "@/lib/py";
import {
  calcularPesoAtualizacao,
  consumirSlots,
  contarUsoDiario,
  descreverExistente,
  LIMITES,
  slotsUsados,
  type ResultadoModulo,
} from "@/lib/versionamento";
import { COMENTARIOS_POR_ANALISE, MAX_TOKENS_VOZ, MODELO_VOZ, montarPayloadVoz, montarPromptVoz } from "@/lib/voz/prompts";
import {
  buscarCanonicaComentarios,
  buscarComentariosVideo,
  buscarDossieCanalExistente,
  registrarAnaliseComentarios,
} from "@/lib/voz/registro";
import { ErroHttpYoutube, ErroPrevisto } from "@/lib/youtube";

/*
 * Fluxo da Voz da Base — porte de renderizar_voz_da_base (app.py):
 *   limite diário → ID do vídeo → versão canônica? → metadados → 100
 *   comentários (relevância) → dossiê do canal, se houver → Sonnet em
 *   chamada única → cruzamento das dimensões → registro versionado.
 *
 * Diferença deliberada: slot descontado só quando a análise é gravada
 * (o Python descontava antes do pipeline, mesmo se falhasse).
 */
export async function analisarComentarios(entrada: {
  valor: string;
  atualizar?: { versaoAnteriorId: number };
}): Promise<ResultadoModulo> {
  const restantes = LIMITES.voz.sessao - (await slotsUsados("voz"));
  if (restantes <= 0) return { estado: "erro", codigo: "limite_sessao" };

  try {
    const uso = await contarUsoDiario("voz");
    if (uso >= LIMITES.voz.diario) return { estado: "erro", codigo: "limite_diario", uso };

    const videoId = extrairVideoId(entrada.valor.trim());
    if (!videoId) return { estado: "erro", codigo: "url_invalida" };

    const canonica = await buscarCanonicaComentarios(videoId);
    let proximaVersao = 1;
    let versaoAnteriorId: number | null = null;
    if (canonica) {
      const existente = descreverExistente(canonica, canonica.data_analise);
      if (entrada.atualizar?.versaoAnteriorId !== canonica.id || !existente.pode) return existente;
      proximaVersao = existente.proximaVersao;
      versaoAnteriorId = canonica.id;
    }

    const peso = calcularPesoAtualizacao(proximaVersao);
    if (peso > restantes) return { estado: "erro", codigo: "slots_insuficientes", peso, restantes };

    let meta, comentarios;
    try {
      meta = await buscarMetadadosVideo(videoId);
      comentarios = await buscarComentariosVideo(videoId, COMENTARIOS_POR_ANALISE);
    } catch (e) {
      if (e instanceof ErroHttpYoutube) throw new ErroPrevisto("youtube", e.message);
      throw e;
    }
    if (!comentarios.length) return { estado: "erro", codigo: "sem_comentarios" };

    const dossie = await buscarDossieCanalExistente(meta.canal_id);

    const texto = await chamarClaude({
      model: MODELO_VOZ,
      max_tokens: MAX_TOKENS_VOZ,
      system: montarPromptVoz(),
      user: montarPayloadVoz(meta.titulo, meta.canal_nome, comentarios, dossie),
    });
    let resultado: Record<string, unknown>;
    try {
      resultado = parsearJsonLlm(texto);
    } catch (e) {
      throw new ErroPrevisto("resposta_malformada", e instanceof Error ? e.message : String(e));
    }
    // Como no Python: sem índice ou sem síntese, a análise não é gravada (KeyError).
    if (!("indice_pressao_produtiva" in resultado) || !("sintese_qualitativa" in resultado)) {
      throw new ErroPrevisto("resposta_malformada", "campos obrigatórios ausentes");
    }

    // Cruzar classificações com comentários (IDs do modelo são 1-indexados).
    const mapa = new Map<unknown, unknown>();
    for (const item of (resultado.classificacoes as { id?: unknown; dimensoes?: unknown }[] | undefined) ?? []) {
      mapa.set(item.id, item.dimensoes ?? []);
    }
    const contagem: Record<string, number> = {};
    const enriquecidos = comentarios.map((c, i) => {
      const dims = (mapa.get(i + 1) ?? []) as string[];
      for (const d of dims) contagem[d] = (contagem[d] ?? 0) + 1;
      return { ...c, dimensoes: dims };
    });

    const id = await registrarAnaliseComentarios({
      video_id: videoId,
      titulo_video: meta.titulo,
      canal_id: meta.canal_id,
      canal_nome: meta.canal_nome,
      total: comentarios.length,
      indice_pressao_produtiva: resultado.indice_pressao_produtiva,
      distribuicao_dimensoes_json: pyJsonDumps(contagem),
      sintese_qualitativa: resultado.sintese_qualitativa,
      contradicao_estrutural: "contradicao_estrutural" in resultado ? resultado.contradicao_estrutural : "",
      comentarios_brutos_json: pyJsonDumps(enriquecidos, false),
      versao_numero: proximaVersao,
      versao_anterior_id: versaoAnteriorId,
    });

    await consumirSlots("voz", peso);
    return { estado: "ok", id };
  } catch (e) {
    if (e instanceof ErroPrevisto) return { estado: "erro", codigo: e.codigo, detalhe: e.message };
    console.error("[voz]", e);
    return { estado: "erro", codigo: "falha", detalhe: e instanceof Error ? e.message : String(e) };
  }
}
