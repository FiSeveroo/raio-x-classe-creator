"use server";

import { buscarNoYoutube, enriquecerCanais, enriquecerVideos } from "@/lib/disputa/busca";
import { classificarItem, emParalelo, type ClassificacaoItem } from "@/lib/disputa/classificar";
import { montarExemplosItem, pyJsonDict, type DadosExtras } from "@/lib/disputa/prompts";
import { buscarCanonicaBusca, registrarBusca, type ItemClassificado } from "@/lib/disputa/registro";
import { buscarExemplosAncora } from "@/lib/lupa/registro";
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

/** Classificações simultâneas ao Claude (o Python fazia uma por vez). */
const PARALELO = 8;

/*
 * Fluxo da Disputa — porte de renderizar_disputa_narrativa + executar_busca_completa:
 *   limite diário → termo normalizado (strip + lower) → versão canônica?
 *   → search.list (50) → enriquecimento de vídeos e canais → classificação
 *   item a item (Haiku) → composições → registro versionado.
 *
 * Diferenças deliberadas:
 *  - slot descontado só quando a busca é gravada (o Python descontava antes);
 *  - item que falha é tentado de novo uma vez antes de virar "outros"
 *    (justificativa "Falha na classificação automática: ..." como no Python);
 *  - se TODOS os itens falharem (ex.: chave da Anthropic fora), nada é gravado
 *    — o Python gravaria 50 itens "outros", inventando uma composição.
 */
export async function auditarTema(entrada: {
  valor: string;
  atualizar?: { versaoAnteriorId: number };
}): Promise<ResultadoModulo> {
  // Portão anti-robô (Turnstile) — antes de qualquer custo de API.
  if (!(await humanoVerificado())) return { estado: "erro", codigo: "verificacao" };
  const restantes = LIMITES.disputa.sessao - (await slotsUsados("disputa"));
  if (restantes <= 0) return { estado: "erro", codigo: "limite_sessao" };

  const termo = entrada.valor.trim().toLowerCase();
  if (!termo) return { estado: "erro", codigo: "termo_vazio" };

  try {
    const uso = await contarUsoDiario("disputa");
    if (uso >= LIMITES.disputa.diario) return { estado: "erro", codigo: "limite_diario", uso };

    const canonica = await buscarCanonicaBusca(termo);
    let proximaVersao = 1;
    let versaoAnteriorId: number | null = null;
    if (canonica) {
      const existente = descreverExistente(canonica, canonica.data_busca);
      if (entrada.atualizar?.versaoAnteriorId !== canonica.id || !existente.pode) return existente;
      proximaVersao = existente.proximaVersao;
      versaoAnteriorId = canonica.id;
    }

    const peso = calcularPesoAtualizacao(proximaVersao);
    if (peso > restantes) return { estado: "erro", codigo: "slots_insuficientes", peso, restantes };

    // 1–3. Busca e enriquecimento (erros HTTP viram mensagem de cota, como no Python)
    let items, videosEnriq, canaisEnriq;
    try {
      items = await buscarNoYoutube(termo, 50);
      if (!items.length) return { estado: "erro", codigo: "sem_resultados" };
      const videoIds = items.filter((it) => it.id.kind === "youtube#video").map((it) => it.id.videoId!);
      const canaisDiretos = items.filter((it) => it.id.kind === "youtube#channel").map((it) => it.id.channelId!);
      const canaisDeVideos = items.filter((it) => it.id.kind === "youtube#video").map((it) => it.snippet.channelId!);
      const todosCanais = [...new Set([...canaisDiretos, ...canaisDeVideos])];
      [videosEnriq, canaisEnriq] = await Promise.all([enriquecerVideos(videoIds), enriquecerCanais(todosCanais)]);
    } catch (e) {
      throw new ErroPrevisto("youtube", e instanceof Error ? e.message : String(e));
    }

    // 4. Classificação item a item
    const exemplos = montarExemplosItem(await buscarExemplosAncora(15).catch(() => []));
    let falhas = 0;
    const classificacoes = await emParalelo(items, PARALELO, async (item, i): Promise<ItemClassificado> => {
      const kind = item.id.kind;
      let extras: DadosExtras;
      let tipoItem: string;
      let itemId: string;
      if (kind === "youtube#video") {
        itemId = item.id.videoId!;
        extras = { video: videosEnriq[itemId] ?? {}, canal: canaisEnriq[item.snippet.channelId!] ?? {} };
        tipoItem = "video";
      } else if (kind === "youtube#channel") {
        itemId = item.id.channelId!;
        extras = { canal: canaisEnriq[itemId] ?? {} };
        tipoItem = "channel";
      } else {
        itemId = item.id.playlistId ?? "";
        extras = {};
        tipoItem = "playlist";
      }

      let classif: ClassificacaoItem;
      try {
        classif = await classificarItem(item, extras, exemplos).catch(() => classificarItem(item, extras, exemplos));
      } catch (e) {
        falhas++;
        console.error("[disputa] item", i + 1, e);
        classif = {
          tipo_produtor: "outros",
          tipo_conteudo: "outros",
          justificativa: `Falha na classificação automática: ${e instanceof Error ? e.message : String(e)}`,
        };
      }

      // Para canal direto, o "canal" é o próprio item.
      const ehCanal = tipoItem === "channel";
      return {
        posicao: i + 1,
        tipo_item: tipoItem,
        item_id: itemId,
        titulo: item.snippet.title,
        canal_id: ehCanal ? itemId : (item.snippet.channelId ?? ""),
        canal_nome: ehCanal ? item.snippet.title : (item.snippet.channelTitle ?? ""),
        tipo_produtor: classif.tipo_produtor,
        tipo_conteudo: classif.tipo_conteudo,
        justificativa: classif.justificativa,
      };
    });
    if (falhas === classificacoes.length) return { estado: "erro", codigo: "classificacao_falhou" };

    // 5. Composições (Counter → dict: ordem de primeira aparição)
    const contar = (chave: "tipo_produtor" | "tipo_conteudo") => {
      const c: Record<string, number> = {};
      for (const x of classificacoes) c[x[chave]] = (c[x[chave]] ?? 0) + 1;
      return c;
    };

    // 6–7. Registro
    const id = await registrarBusca({
      termo,
      total: classificacoes.length,
      composicao_produtor_json: pyJsonDict(contar("tipo_produtor")),
      composicao_conteudo_json: pyJsonDict(contar("tipo_conteudo")),
      versao_numero: proximaVersao,
      versao_anterior_id: versaoAnteriorId,
      itens: classificacoes,
    });

    await consumirSlots("disputa", peso);
    return { estado: "ok", id };
  } catch (e) {
    if (e instanceof ErroPrevisto) return { estado: "erro", codigo: e.codigo, detalhe: e.message };
    console.error("[disputa]", e);
    return { estado: "erro", codigo: "falha", detalhe: e instanceof Error ? e.message : String(e) };
  }
}
