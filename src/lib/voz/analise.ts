/*
 * Leitura de uma análise da Voz da Base — porte dos cálculos de
 * renderizar_voz_completa (app.py). Puro: testável e reproduzível.
 */

/** Mínimo de análises no corpus para rotular o IPP por percentis (app.py). */
export const MIN_CORPUS_PARA_PERCENTIS = 15;

export type FaixaIpp =
  | { estado: "insuficiente"; nCorpus: number }
  | { estado: "ok"; faixa: "alta" | "tipica" | "baixa"; percentil: number; nCorpus: number };

/** bisect.bisect_left */
function bisectEsquerda(xs: number[], x: number): number {
  let lo = 0;
  let hi = xs.length;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    if (xs[m] < x) lo = m + 1;
    else hi = m;
  }
  return lo;
}

/**
 * Calibração empírica do IPP pelos quartis do próprio corpus:
 * ≥ P75 alta, ≥ P25 típica, abaixo baixa. P25/P75 = ordenados[int(n·q)].
 */
export function faixaIpp(indice: number, corpus: number[]): FaixaIpp {
  if (corpus.length < MIN_CORPUS_PARA_PERCENTIS) return { estado: "insuficiente", nCorpus: corpus.length };
  const ord = [...corpus].sort((a, b) => a - b);
  const n = ord.length;
  const percentil = (bisectEsquerda(ord, indice) / n) * 100;
  const p25 = ord[Math.trunc(n * 0.25)];
  const p75 = ord[Math.trunc(n * 0.75)];
  const faixa = indice >= p75 ? "alta" : indice >= p25 ? "tipica" : "baixa";
  return { estado: "ok", faixa, percentil, nCorpus: n };
}
