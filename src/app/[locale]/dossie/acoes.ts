"use server";

import {
  buscarCanaisRelacionados,
  buscarUploadsRecentes,
  extrairCanalId,
  resolverCanalId,
} from "@/lib/dossie/canal";
import { classificarCanalHaiku, classificarLoteEixoB, emitirVereditoSonnet } from "@/lib/dossie/classificar";
import { aparicoesNoTermometro, buscarCanonicaDossie, registrarDossie } from "@/lib/dossie/registro";
import { calcularSintomasEstruturais, type Sintomas } from "@/lib/dossie/sintomas";
import { pyInt } from "@/lib/py";
import {
  calcularPesoAtualizacao,
  consumirSlots,
  contarUsoDiario,
  descreverExistente,
  LIMITES,
  slotsUsados,
  type ResultadoModulo,
} from "@/lib/versionamento";
import { humanoVerificado } from "@/lib/turnstile";
import { ErroPrevisto } from "@/lib/youtube";

/*
 * Fluxo do Dossiê — porte de renderizar_dossie_canal (app.py):
 *   limite diário → identificar canal → resolver no YouTube → versão canônica?
 *   → 50 uploads → rede declarada → sintomas → classificação (Haiku)
 *   → aparições no Termômetro → leitura final (Sonnet) → Eixo B em lote (Haiku)
 *   → registro versionado.
 *
 * Diferença deliberada: o Streamlit descontava o slot ANTES do pipeline (gastava
 * mesmo quando falhava); aqui o slot só é descontado quando o dossiê é gravado.
 */
export async function gerarDossie(entrada: {
  valor: string;
  atualizar?: { versaoAnteriorId: number };
}): Promise<ResultadoModulo> {
  // Portão anti-robô (Turnstile) — antes de qualquer custo de API.
  if (!(await humanoVerificado())) return { estado: "erro", codigo: "verificacao" };
  const restantes = LIMITES.dossie.sessao - (await slotsUsados("dossie"));
  if (restantes <= 0) return { estado: "erro", codigo: "limite_sessao" };

  try {
    const uso = await contarUsoDiario("dossie");
    if (uso >= LIMITES.dossie.diario) return { estado: "erro", codigo: "limite_diario", uso };

    const ident = extrairCanalId(entrada.valor);
    if (!ident) return { estado: "erro", codigo: "canal_invalido" };

    const canal = await resolverCanalId(ident);
    if (!canal) return { estado: "erro", codigo: "canal_nao_encontrado" };
    const canalId = canal.id;

    const canonica = await buscarCanonicaDossie(canalId);
    let proximaVersao = 1;
    let versaoAnteriorId: number | null = null;
    if (canonica) {
      const existente = descreverExistente(canonica, canonica.data_dossie);
      if (entrada.atualizar?.versaoAnteriorId !== canonica.id || !existente.pode) return existente;
      proximaVersao = existente.proximaVersao;
      versaoAnteriorId = canonica.id;
    }

    const peso = calcularPesoAtualizacao(proximaVersao);
    if (peso > restantes) return { estado: "erro", codigo: "slots_insuficientes", peso, restantes };

    const videos = await buscarUploadsRecentes(canalId, 50);
    if (!videos.length) return { estado: "erro", codigo: "sem_videos" };

    const relacionados = await buscarCanaisRelacionados(canalId);
    const sintomas = calcularSintomasEstruturais(videos, canal) as Sintomas;
    const classif = await classificarCanalHaiku(canal, videos, sintomas);
    const aparicoes = await aparicoesNoTermometro(canalId);
    const veredito = await emitirVereditoSonnet(canal, classif, sintomas, relacionados, aparicoes.length);
    const lote = await classificarLoteEixoB(videos);

    // Counter(...) → dict: ordem de primeira aparição.
    const composicao: Record<string, number> = {};
    for (const c of lote) composicao[c.tipo_conteudo] = (composicao[c.tipo_conteudo] ?? 0) + 1;

    const rede = relacionados.map((c) => ({
      id: c.id,
      nome: c.snippet.title,
      inscritos: pyInt(c.statistics?.subscriberCount),
      total_videos: pyInt(c.statistics?.videoCount),
    }));

    const id = await registrarDossie({
      canal_id: canalId,
      canal_nome: canal.snippet?.title ?? "",
      canal_descricao: canal.snippet?.description ?? "",
      inscritos: pyInt(canal.statistics?.subscriberCount),
      total_videos_canal: pyInt(canal.statistics?.videoCount),
      total_videos_analisados: videos.length,
      sintomas_estruturais: JSON.stringify(sintomas),
      auto_classificacao: classif.auto_classificacao ?? "",
      classificacao_sociologica: classif.tipo_produtor,
      tipo_conteudo_predominante: classif.tipo_conteudo_predominante,
      veredito_sonnet: veredito,
      rede_canais_json: JSON.stringify(rede),
      composicao_videos_json: JSON.stringify(composicao),
      versao_numero: proximaVersao,
      versao_anterior_id: versaoAnteriorId,
    });

    await consumirSlots("dossie", peso);
    return { estado: "ok", id };
  } catch (e) {
    if (e instanceof ErroPrevisto) return { estado: "erro", codigo: e.codigo, detalhe: e.message };
    console.error("[dossie]", e);
    return { estado: "erro", codigo: "falha", detalhe: e instanceof Error ? e.message : String(e) };
  }
}
