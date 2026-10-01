/*
 * Formatação no estilo do Python, para reproduzir à risca os textos que o
 * app.py monta para os prompts (f-strings). Usado pelos módulos portados.
 *
 * Sem dependências de Next/aliases: importado também pelos scripts de
 * verificação (node --strip-types).
 */

/** f"{v}" — None vira "None", bool vira True/False. */
export function pyStr(v: unknown): string {
  if (v === null || v === undefined) return "None";
  if (v === true) return "True";
  if (v === false) return "False";
  if (typeof v === "object") return pyRepr(v);
  return String(v);
}

/** repr() de dict/list/str/número, como o Python imprime dentro de f-string. */
export function pyRepr(v: unknown): string {
  if (v === null || v === undefined) return "None";
  if (v === true) return "True";
  if (v === false) return "False";
  if (typeof v === "string") {
    // Python usa aspas simples, a menos que a string contenha ' e não ".
    if (v.includes("'") && !v.includes('"')) return `"${v.replace(/\\/g, "\\\\")}"`;
    return `'${v.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
  }
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : pyFloatRepr(v);
  if (Array.isArray(v)) return `[${v.map(pyRepr).join(", ")}]`;
  if (typeof v === "object") {
    return `{${Object.entries(v as Record<string, unknown>)
      .map(([k, val]) => `${pyRepr(k)}: ${pyRepr(val)}`)
      .join(", ")}}`;
  }
  return String(v);
}

/** repr(float): "2.0" em vez de "2"; demais casos coincidem com o JS. */
function pyFloatRepr(n: number): string {
  const s = String(n);
  return /[.e]/.test(s) || !Number.isFinite(n) ? s : `${s}.0`;
}

/** f"{n:,}" para inteiros. */
export function pyMilhar(n: number): string {
  return Math.trunc(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * f"{x:.Nf}". O Python arredonda o valor binário exato com empate para o par
 * (12.5 → "12"); o toFixed do JS desempata para cima (12.5 → "13").
 * Empates só existem quando o valor é exatamente representável na metade.
 */
export function pyFixed(x: number, casas: number): string {
  if (x === null || x === undefined || Number.isNaN(x)) {
    // Python: f"{None:.2f}" lança TypeError — quem chama decide o que fazer.
    throw new TypeError("unsupported format string passed to NoneType.__format__");
  }
  // O toFixed do V8 já arredonda o valor binário exato; só diverge nos empates.
  const empate = empateExato(x, casas);
  if (empate === null) return x.toFixed(casas);
  // empate = k tal que x·10^casas = k + 0,5 exatamente → vai para o par.
  const alvo = empate % 2n === 0n ? empate : empate + 1n;
  const negativo = x < 0;
  const abs = (negativo ? -alvo : alvo).toString().padStart(casas + 1, "0");
  const txt = casas ? `${abs.slice(0, -casas)}.${abs.slice(-casas)}` : abs;
  return negativo ? `-${txt}` : txt;
}

/**
 * Se x·10^casas é EXATAMENTE k + 0,5 (no valor binário do double, sem erro de
 * multiplicação), devolve k (com sinal); senão null.
 */
function empateExato(x: number, casas: number): bigint | null {
  if (!Number.isFinite(x) || x === 0) return null;
  // Decompõe o double em mantissa·2^expoente, exatamente.
  const buf = new DataView(new ArrayBuffer(8));
  buf.setFloat64(0, x);
  const bits = buf.getBigUint64(0);
  const expBruto = Number((bits >> 52n) & 0x7ffn);
  let mantissa = bits & 0xfffffffffffffn;
  let exp: number;
  if (expBruto === 0) exp = -1074;
  else {
    mantissa |= 1n << 52n;
    exp = expBruto - 1075;
  }
  if (exp >= 0) return null; // inteiro: nunca é empate
  // x·10^c·2 = mantissa·10^c·2 / 2^(-exp) precisa ser inteiro ímpar.
  const numerador = mantissa * 10n ** BigInt(casas) * 2n;
  const divisor = 1n << BigInt(-exp);
  if (numerador % divisor !== 0n) return null;
  const dobro = numerador / divisor;
  if (dobro % 2n === 0n) return null; // múltiplo inteiro: não é meio
  const k = (dobro - 1n) / 2n;
  return x < 0 ? -k : k;
}

/** s[:n] — corta por caractere Unicode (code point), não por unidade UTF-16. */
export function pyCorte(s: string, n: number): string {
  return Array.from(s ?? "").slice(0, n).join("");
}

/** int(str) tolerante, como int(stats.get("viewCount", 0)). */
export function pyInt(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

/** sorted(xs)[len(xs) // 2] — a "mediana superior" usada no app.py. */
export function pyMedianaSuperior(xs: number[]): number | null {
  if (!xs.length) return null;
  const ord = [...xs].sort((a, b) => a - b);
  return ord[Math.floor(ord.length / 2)];
}

/**
 * json.dumps(v, ensure_ascii=...) com os separadores padrão do Python
 * (", " e ": "). Números inteiros saem como inteiros (o JS não distingue 4 de 4.0).
 */
export function pyJsonDumps(v: unknown, ensureAscii = true): string {
  if (v === null || v === undefined) return "null";
  if (v === true) return "true";
  if (v === false) return "false";
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : pyFloatRepr(v);
  if (typeof v === "string") {
    const s = JSON.stringify(v);
    // ensure_ascii: tudo acima de 0x7F vira \uXXXX (emoji vira par de surrogates, como no Python)
    return ensureAscii ? s.replace(/[\u007f-￿]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0")) : s;
  }
  if (Array.isArray(v)) return `[${v.map((x) => pyJsonDumps(x, ensureAscii)).join(", ")}]`;
  return `{${Object.entries(v as Record<string, unknown>)
    .map(([k, x]) => `${pyJsonDumps(k, ensureAscii)}: ${pyJsonDumps(x, ensureAscii)}`)
    .join(", ")}}`;
}
