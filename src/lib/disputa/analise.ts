/*
 * Leitura de uma busca — porte dos cálculos de renderizar_resultados_disputa
 * (app.py). Puro (sem Next): testável e reproduzível.
 */
import { codigosProdutor } from "../tipologia.ts";
import { quiQuadrado } from "./estatistica.ts";

// Mínimo defensável: 10 coletas (no app.py, MIN_SNAPSHOTS_PARA_QUIQUADRADO)
export const MIN_SNAPSHOTS_PARA_QUIQUADRADO = 10;

/**
 * Prevalências do corpus da dissertação (Severo, 2026: 21 semanas, n=1.049).
 * Só categorias com prevalência > 0 no trending BR. Fixas no app.py — a
 * referência de "ausência improvável" é a da dissertação, não o corpus vivo.
 */
export const PREVALENCIA_CORPUS: Record<string, number> = {
  youtuber_profissional: 35.9,
  musico: 19.4,
  midia_tradicional: 17.9,
  produtora_digital: 17.0,
  marca: 7.5,
  instituicao: 2.1,
  reaproveitamento: 0.1,
};

/** Categorias ausentes de TODA a coleta da dissertação (achado estrutural). */
export const EXTINTAS_ESTRUTURALMENTE = ["usuario_comum", "criador_casual"] as const;

export function contar(tipos: string[]): Record<string, number> {
  const c: Record<string, number> = {};
  for (const t of tipos) c[t] = (c[t] ?? 0) + 1;
  return c;
}

export type LinhaDesvio = { codigo: string; pctBusca: number; pctCorpus: number; desvio: number };

/** Tabela de desvios: todas as categorias do Eixo A, ordenadas por |desvio| (maior primeiro). */
export function tabelaDesvios(contagem: Record<string, number>, n: number, baseline: Record<string, number>): LinhaDesvio[] {
  return codigosProdutor()
    .map((codigo) => {
      const pctBusca = n ? ((contagem[codigo] ?? 0) / n) * 100 : 0;
      const pctCorpus = baseline[codigo] ?? 0;
      return { codigo, pctBusca, pctCorpus, desvio: pctBusca - pctCorpus };
    })
    .sort((a, b) => Math.abs(b.desvio) - Math.abs(a.desvio));
}

export type ResultadoQui =
  | { estado: "ok"; chi2: number; gl: number; p: number; nivel: "altissimo" | "significativo" | "marginal" | "nenhum" }
  | { estado: "poucas_categorias" };

/**
 * Qui-quadrado de aderência: categorias com esperado ≥ 1,0; esperado
 * normalizado para somar o observado; mesmos cortes de p do app.py.
 */
export function testeAderencia(contagem: Record<string, number>, n: number, baseline: Record<string, number>): ResultadoQui {
  const observado: number[] = [];
  const esperado: number[] = [];
  for (const cat of codigosProdutor()) {
    const nEsp = ((baseline[cat] ?? 0) / 100) * n;
    if (nEsp >= 1.0) {
      observado.push(contagem[cat] ?? 0);
      esperado.push(nEsp);
    }
  }
  const somaEsp = esperado.reduce((s, x) => s + x, 0);
  if (observado.length < 2 || somaEsp <= 0) return { estado: "poucas_categorias" };
  const somaObs = observado.reduce((s, x) => s + x, 0);
  const { chi2, gl, p } = quiQuadrado(observado, esperado.map((e) => e * (somaObs / somaEsp)));
  const nivel = p < 0.001 ? "altissimo" : p < 0.01 ? "significativo" : p < 0.05 ? "marginal" : "nenhum";
  return { estado: "ok", chi2, gl, p, nivel };
}

export type Ausencia = { codigo: string; prevalencia: number; pZero: number };

/** Ausências pela prevalência da dissertação: P(zero em 50) = (1 − prev)^50. */
export function ausencias(presentes: Set<string>) {
  const relevantes: Ausencia[] = [];
  const esperaveis: Ausencia[] = [];
  for (const [codigo, prevalencia] of Object.entries(PREVALENCIA_CORPUS)) {
    if (presentes.has(codigo)) continue;
    const pZero = (1 - prevalencia / 100) ** 50;
    if (pZero < 0.1) relevantes.push({ codigo, prevalencia, pZero });
    else if (pZero < 0.5) esperaveis.push({ codigo, prevalencia, pZero });
  }
  const extintas = EXTINTAS_ESTRUTURALMENTE.filter((c) => !presentes.has(c));
  return { relevantes, esperaveis, extintas };
}
