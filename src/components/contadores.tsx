import { getFormatter, getTranslations } from "next-intl/server";
import type { Contadores as TipoContadores } from "@/lib/corpus";

const ORDEM: (keyof TipoContadores)[] = [
  "snapshots_termometro",
  "videos_no_termometro",
  "buscas_realizadas",
  "dossies_canais",
  "analises_voz_da_base",
];

/**
 * Faixa de números do corpus. `namespace` escolhe os rótulos (Home usa uns,
 * Biblioteca outros). null = "sem dados", nunca 0 (princípio 1).
 */
export async function Contadores({
  valores,
  namespace,
}: {
  valores: TipoContadores | null;
  namespace: "Home.contadores" | "Biblioteca.contadores";
}) {
  const t = await getTranslations(namespace);
  const tc = await getTranslations("Comum");
  const format = await getFormatter();

  return (
    // gap-px sobre fundo de linha = divisórias em qualquer quebra de grade.
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-cc-line bg-cc-line sm:grid-cols-3 lg:grid-cols-5">
      {ORDEM.map((chave) => {
        const v = valores?.[chave] ?? null;
        return (
          <div
            key={chave}
            // dt antes do dd no DOM (semântica); número aparece em cima via flex-col-reverse.
            className="flex flex-col-reverse justify-end gap-3 bg-cc-surface px-4 py-6 last:col-span-2 sm:px-5 lg:last:col-span-1"
          >
            <dt className="label-caps leading-snug text-muted-foreground">{t(chave)}</dt>
            <dd className="leading-none">
              {v === null ? (
                <span className="text-sm text-muted-foreground">{tc("semDados")}</span>
              ) : (
                <span className="font-display text-2xl tabular-nums break-all sm:text-3xl lg:text-4xl">{format.number(v)}</span>
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
