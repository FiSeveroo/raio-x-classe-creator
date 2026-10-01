/*
 * Estatística da Disputa — substitui scipy.stats.chisquare (app.py,
 * renderizar_resultados_disputa). p-valor = Q(gl/2, χ²/2), função gama
 * incompleta superior regularizada (Numerical Recipes: série + fração contínua).
 */

function lnGama(x: number): number {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x;
  const tmp = x + 5.5 - (x + 0.5) * Math.log(x + 5.5);
  let ser = 1.000000000190015;
  for (const ci of c) ser += ci / ++y;
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
}

/** Q(a, x) = 1 − P(a, x). */
export function gamaQ(a: number, x: number): number {
  if (x <= 0) return 1;
  const gln = lnGama(a);
  if (x < a + 1) {
    let ap = a;
    let soma = 1 / a;
    let del = soma;
    for (let n = 0; n < 1000; n++) {
      del *= x / ++ap;
      soma += del;
      if (Math.abs(del) < Math.abs(soma) * 1e-15) break;
    }
    return 1 - soma * Math.exp(-x + a * Math.log(x) - gln);
  }
  const MIN = 1e-300;
  let b = x + 1 - a;
  let c = 1 / MIN;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i < 1000; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < MIN) d = MIN;
    c = b + an / c;
    if (Math.abs(c) < MIN) c = MIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-15) break;
  }
  return Math.exp(-x + a * Math.log(x) - gln) * h;
}

/** scipy.stats.chisquare(observado, esperado) → { chi2, p, gl }. */
export function quiQuadrado(observado: number[], esperado: number[]) {
  let chi2 = 0;
  for (let i = 0; i < observado.length; i++) chi2 += (observado[i] - esperado[i]) ** 2 / esperado[i];
  const gl = observado.length - 1;
  return { chi2, gl, p: gamaQ(gl / 2, chi2 / 2) };
}
