import { getTranslations } from "next-intl/server";
import { cn } from "@/lib/utils";

export type Metrica = { rotulo: string; valor: string | null; ajuda?: string };

/**
 * Grade de números (stat tiles). null = "sem dados" (princípio 1). A ajuda
 * aparece como texto pequeno abaixo do rótulo — legível também no celular,
 * onde não há hover.
 */
export async function Metricas({ itens, colunas = 3 }: { itens: Metrica[]; colunas?: 2 | 3 | 4 }) {
  const tc = await getTranslations("Comum");
  return (
    <dl
      className={cn(
        "grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-cc-line bg-cc-line",
        colunas === 3 && "sm:grid-cols-3",
        colunas === 4 && "lg:grid-cols-4",
      )}
    >
      {itens.map((m) => (
        <div key={m.rotulo} className="flex flex-col-reverse justify-end gap-2 bg-cc-surface px-4 py-5 last:odd:col-span-2 sm:last:odd:col-span-1">
          <dt>
            <span className="label-caps block text-muted-foreground">{m.rotulo}</span>
            {m.ajuda && <span className="mt-1.5 block text-xs leading-snug text-muted-foreground/80">{m.ajuda}</span>}
          </dt>
          <dd className="font-display text-xl tabular-nums break-all sm:text-2xl">
            {m.valor ?? <span className="font-sans text-sm font-normal normal-case text-muted-foreground">{tc("semDados")}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}
