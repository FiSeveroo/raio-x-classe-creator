import { cn } from "@/lib/utils";

/*
 * Gráficos leves em SVG/HTML, renderizados no servidor (sem biblioteca).
 * Regras da skill de dataviz: uma cor por gráfico (a categoria é o rótulo,
 * não a cor), eixo único, grade discreta, pontos ≥ 8px, tooltip nativo em
 * cada ponto e tabela com os valores para quem não enxerga o gráfico.
 */

type Ponto = { rotulo: string; valor: number | null; n?: number };

/** Abaixo disso o ponto é desenhado vazado: amostra pequena demais para ler como tendência. */
export const N_MINIMO = 10;

/**
 * Pequeno múltiplo: uma série de percentuais (0–100, escala fixa para todos os
 * múltiplos serem comparáveis) com o último valor escrito.
 */
export function MiniSerie({
  titulo,
  pontos,
  cor = "verde",
  sufixo = "%",
}: {
  titulo: string;
  pontos: Ponto[];
  cor?: "verde" | "roxo";
  sufixo?: string;
}) {
  const L = 300;
  const A = 90;
  const m = { t: 8, b: 8, l: 4, r: 4 };
  const validos = pontos.map((p, i) => ({ ...p, i })).filter((p) => p.valor !== null) as (Ponto & { i: number; valor: number })[];
  const x = (i: number) => m.l + (pontos.length > 1 ? (i / (pontos.length - 1)) * (L - m.l - m.r) : (L - m.l - m.r) / 2);
  const y = (v: number) => m.t + (1 - v / 100) * (A - m.t - m.b);
  const ultimo = validos.at(-1);
  const traco = cor === "verde" ? "stroke-cc-green" : "stroke-cc-purple-text";
  const preenche = cor === "verde" ? "fill-cc-green" : "fill-cc-purple-text";

  return (
    <figure className="rounded-xl border border-cc-line bg-cc-surface p-4">
      <figcaption className="flex items-baseline justify-between gap-3">
        <span className="truncate text-sm">{titulo}</span>
        <span className="text-sm tabular-nums text-muted-foreground">
          {ultimo ? `${ultimo.valor.toFixed(1)}${sufixo}` : "—"}
        </span>
      </figcaption>
      <svg viewBox={`0 0 ${L} ${A}`} className="mt-2 h-20 w-full overflow-visible" role="img" aria-label={`${titulo}: ${validos.map((p) => `${p.rotulo} ${p.valor.toFixed(1)}${sufixo}`).join("; ")}`}>
        {[0, 50, 100].map((g) => (
          <line key={g} x1={m.l} x2={L - m.r} y1={y(g)} y2={y(g)} className="stroke-cc-line" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        ))}
        {validos.length > 1 && (
          <polyline
            points={validos.map((p) => `${x(p.i)},${y(p.valor)}`).join(" ")}
            className={cn("fill-none", traco)}
            strokeWidth={2}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        )}
        {validos.map((p) => (
          <g key={p.i}>
            {/* alvo de hover maior que o ponto */}
            <circle cx={x(p.i)} cy={y(p.valor)} r={9} className="fill-transparent">
              <title>{`${p.rotulo}: ${p.valor.toFixed(1)}${sufixo}${p.n !== undefined ? ` (n=${p.n})` : ""}`}</title>
            </circle>
            {p.n !== undefined && p.n < N_MINIMO ? (
              <circle cx={x(p.i)} cy={y(p.valor)} r={3} className={cn("fill-cc-surface", traco)} strokeWidth={1.5} pointerEvents="none" />
            ) : (
              <circle cx={x(p.i)} cy={y(p.valor)} r={validos.length > 40 ? 1.5 : 3} className={cn(preenche, "stroke-cc-surface")} strokeWidth={1.5} pointerEvents="none" />
            )}
          </g>
        ))}
      </svg>
    </figure>
  );
}

/**
 * Mapa de calor em tabela (contagens). Sequencial de uma cor: mais verde =
 * mais vídeos. O número fica escrito em cada célula.
 */
export function MapaCalor({
  linhas,
  colunas,
  valores,
  rotuloCanto,
}: {
  linhas: { chave: string; rotulo: string }[];
  colunas: { chave: string; rotulo: string }[];
  valores: Record<string, Record<string, number>>;
  rotuloCanto?: string;
}) {
  const max = Math.max(1, ...linhas.flatMap((l) => colunas.map((c) => valores[l.chave]?.[c.chave] ?? 0)));
  return (
    <div className="overflow-x-auto rounded-xl border border-cc-line">
      <table className="w-full border-separate border-spacing-0.5 text-xs">
        <thead>
          <tr>
            <th className="label-caps sticky left-0 bg-cc-bg px-2 py-2 text-left text-muted-foreground">{rotuloCanto}</th>
            {colunas.map((c) => (
              <th key={c.chave} scope="col" className="min-w-16 px-1 py-2 text-center font-medium text-muted-foreground">
                {c.rotulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.chave}>
              <th scope="row" className="sticky left-0 bg-cc-bg px-2 py-1.5 text-left font-medium whitespace-nowrap">
                {l.rotulo}
              </th>
              {colunas.map((c) => {
                const v = valores[l.chave]?.[c.chave] ?? 0;
                const intensidade = v / max;
                return (
                  <td
                    key={c.chave}
                    title={`${l.rotulo} × ${c.rotulo}: ${v}`}
                    className={cn(
                      "rounded-sm py-1.5 text-center tabular-nums",
                      v === 0 ? "bg-cc-surface text-muted-foreground/50" : intensidade > 0.55 ? "text-primary-foreground" : "text-foreground",
                    )}
                    style={v ? { backgroundColor: `color-mix(in oklab, var(--cc-green) ${Math.round(15 + intensidade * 85)}%, var(--cc-surface))` } : undefined}
                  >
                    {v}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
