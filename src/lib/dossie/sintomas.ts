/*
 * Sintomas estruturais do canal — porte LITERAL de calcular_sintomas_estruturais
 * (app.py). Indicadores objetivos que sustentam a classificação do Dossiê.
 *
 * Função pura (sem rede, sem Next): conferida por scripts/verificar-dossie.mts.
 */
import { pyInt, pyMedianaSuperior } from "../py.ts";
import { detectarShort, duracaoIsoParaSegundos, type ItemVideoApi } from "../youtube-util.ts";

export type CanalApi = {
  id: string;
  snippet?: {
    title?: string;
    description?: string;
    publishedAt?: string;
    country?: string;
  };
  statistics?: { subscriberCount?: string; videoCount?: string; viewCount?: string };
};

/** Mesma ordem de chaves do dict Python (é o JSON gravado em sintomas_estruturais). */
export type Sintomas = {
  frequencia_videos_por_dia: number | null;
  frequencia_shorts_por_dia: number | null;
  frequencia_longos_por_dia: number | null;
  duracao_mediana_segundos: number;
  duracao_mediana_geral_segundos: number;
  total_shorts: number;
  total_longos: number;
  total_inconclusivos: number;
  pct_shorts: number;
  link_externo_repetido: { dominio: string; n_aparicoes: number } | null;
  pct_titulos_padronizados: number;
  taxa_engajamento_mediana: number | null;
  inscritos: number;
  total_videos_canal: number;
  n_videos_analisados: number;
};

// Domínios esperados em qualquer canal — filtrados da heurística de link repetido.
const RUIDO = ["youtube.com", "youtu.be", "google.com", "instagram.com", "facebook.com", "twitter.com", "x.com", "tiktok.com"];

/** _freq: vídeos/dia entre o mais antigo e o mais recente; null se < 2 datas ou intervalo 0. */
function frequencia(lista: ItemVideoApi[]): number | null {
  const datas: number[] = [];
  for (const v of lista) {
    const t = Date.parse(v.snippet?.publishedAt ?? "");
    if (!Number.isNaN(t)) datas.push(t);
  }
  if (datas.length < 2) return null;
  const intervaloDias = (Math.max(...datas) - Math.min(...datas)) / 1000 / 86400;
  return intervaloDias > 0 ? datas.length / intervaloDias : null;
}

const duracao = (v: ItemVideoApi) => duracaoIsoParaSegundos(v.contentDetails?.duration ?? "");

// re.match(r"^\s*[\[【]") ou re.match(r"^[\U0001F300-\U0001F9FF☀-➿]")
const TITULO_TAG = /^\s*[[【]/u;
const TITULO_EMOJI = /^[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}]/u;

export function calcularSintomasEstruturais(videos: ItemVideoApi[], canal: CanalApi): Sintomas | Record<string, never> {
  if (!videos.length) return {};

  const shorts: ItemVideoApi[] = [];
  const longos: ItemVideoApi[] = [];
  const inconclusivos: ItemVideoApi[] = [];
  for (const v of videos) {
    const s = detectarShort(v, duracao(v));
    if (s === true) shorts.push(v);
    else if (s === false) longos.push(v);
    else inconclusivos.push(v);
  }

  const pctShorts = (shorts.length / videos.length) * 100;

  const freqGeral = frequencia(videos);
  const freqShorts = shorts.length ? frequencia(shorts) : null;
  const freqLongos = longos.length ? frequencia(longos) : null;

  // Duração mediana só de LONGOS (Shorts distorcem) e a geral (retrocompatibilidade).
  const duracaoMediana = pyMedianaSuperior(longos.map(duracao).filter((d) => d > 0)) ?? 0;
  const duracaoMedianaGeral = pyMedianaSuperior(videos.map(duracao).filter((d) => d > 0)) ?? 0;

  // Link externo repetido (domínio mais frequente nas descrições, ≥ 3 vezes).
  const contagem = new Map<string, number>();
  for (const v of videos) {
    const desc = v.snippet?.description ?? "";
    for (const m of desc.matchAll(/https?:\/\/(?:www\.)?([a-zA-Z0-9.-]+)/g)) {
      contagem.set(m[1], (contagem.get(m[1]) ?? 0) + 1);
    }
  }
  for (const d of RUIDO) contagem.delete(d);
  let linkRepetido: Sintomas["link_externo_repetido"] = null;
  if (contagem.size) {
    // Counter.most_common(1): em empate, vence o que apareceu primeiro.
    let topo: [string, number] | null = null;
    for (const par of contagem) if (!topo || par[1] > topo[1]) topo = par;
    if (topo && topo[1] >= 3) linkRepetido = { dominio: topo[0], n_aparicoes: topo[1] };
  }

  const padronizados = videos.filter((v) => {
    const t = v.snippet?.title ?? "";
    return TITULO_TAG.test(t) || TITULO_EMOJI.test(t);
  }).length;
  const pctPadronizados = (padronizados / videos.length) * 100;

  const inscritos = pyInt(canal.statistics?.subscriberCount);
  const totalVideos = pyInt(canal.statistics?.videoCount);

  // Engajamento mediano: (likes + comentários) / visualizações × 100
  const taxas: number[] = [];
  for (const v of videos) {
    const views = pyInt(v.statistics?.viewCount);
    if (views > 0) taxas.push(((pyInt(v.statistics?.likeCount) + pyInt(v.statistics?.commentCount)) / views) * 100);
  }

  return {
    frequencia_videos_por_dia: freqGeral,
    frequencia_shorts_por_dia: freqShorts,
    frequencia_longos_por_dia: freqLongos,
    duracao_mediana_segundos: duracaoMediana,
    duracao_mediana_geral_segundos: duracaoMedianaGeral,
    total_shorts: shorts.length,
    total_longos: longos.length,
    total_inconclusivos: inconclusivos.length,
    pct_shorts: pctShorts,
    link_externo_repetido: linkRepetido,
    pct_titulos_padronizados: pctPadronizados,
    taxa_engajamento_mediana: pyMedianaSuperior(taxas),
    inscritos,
    total_videos_canal: totalVideos,
    n_videos_analisados: videos.length,
  };
}
