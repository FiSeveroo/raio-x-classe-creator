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
    // gap-px sobre fundo de borda = linhas divisórias em qualquer quebra de grade.
    <dl className="grid grid-cols-2 gap-px border-y border-border bg-border sm:grid-cols-3 lg:grid-cols-5">
      {ORDEM.map((chave) => {
        const v = valores?.[chave] ?? null;
        return (
          <div
            key={chave}
            // dt antes do dd no DOM (semântica); número aparece em cima via flex-col-reverse.
            className="flex flex-col-reverse justify-end gap-3 bg-background px-4 py-6 sm:px-5"
          >
            <dt className="rotulo text-[0.62rem] leading-snug tracking-[0.12em]">{t(chave)}</dt>
            <dd className="leading-none">
              {v === null ? (
                <span className="font-mono text-sm text-muted-foreground">{tc("semDados")}</span>
              ) : (
                <span className="font-heading text-4xl font-black tabular-nums sm:text-5xl">{format.number(v)}</span>
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
