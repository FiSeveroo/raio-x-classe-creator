import { cn } from "@/lib/utils";

/**
 * Barras horizontais de uma série só (composição por categoria).
 * Uma cor para todas as barras: a categoria é identificada pelo rótulo
 * escrito, não pela cor (ver skill de dataviz: nada de rampa/arco-íris em
 * categorias nominais). Valor e percentual sempre visíveis; tooltip nativo
 * com o mesmo conteúdo para quem passa o mouse.
 */
export function Barras({
  itens,
  total,
  cor = "verde",
  rotuloTotal,
}: {
  itens: { chave: string; rotulo: string; valor: number }[];
  /** Base do percentual (ex.: vídeos analisados). Padrão: soma dos valores. */
  total?: number;
  cor?: "verde" | "roxo";
  /** Ex.: "de 50 vídeos" — lido por leitores de tela no fim de cada item. */
  rotuloTotal?: string;
}) {
  const base = total ?? itens.reduce((s, i) => s + i.valor, 0);
  const max = Math.max(1, ...itens.map((i) => i.valor));
  const ordenados = [...itens].sort((a, b) => b.valor - a.valor);

  return (
    <ul className="space-y-3">
      {ordenados.map((i) => {
        const pct = base > 0 ? (i.valor / base) * 100 : 0;
        const titulo = `${i.rotulo}: ${i.valor}${rotuloTotal ? ` ${rotuloTotal}` : ""} (${pct.toFixed(0)}%)`;
        return (
          <li key={i.chave} title={titulo} className="grid grid-cols-[minmax(7rem,12rem)_1fr_auto] items-center gap-3 text-sm sm:gap-4">
            <span className="truncate text-foreground/85">{i.rotulo}</span>
            <span aria-hidden className="h-3 rounded-r-sm bg-cc-surface-2">
              <span
                className={cn("block h-full rounded-r-sm", cor === "verde" ? "bg-cc-green" : "bg-cc-purple-text")}
                style={{ width: `${(i.valor / max) * 100}%` }}
              />
            </span>
            <span className="min-w-16 whitespace-nowrap text-right tabular-nums text-muted-foreground">
              <span className="text-foreground">{i.valor}</span> · {pct.toFixed(0)}%
              <span className="sr-only"> {rotuloTotal}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
