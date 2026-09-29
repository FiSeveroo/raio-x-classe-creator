import { getFormatter, getTranslations } from "next-intl/server";
import type { Contadores as TipoContadores } from "@/lib/corpus";
import { cn } from "@/lib/utils";

const ORDEM: (keyof TipoContadores)[] = [
  "snapshots_termometro",
  "videos_no_termometro",
  "buscas_realizadas",
  "dossies_canais",
  "analises_voz_da_base",
];

// Cores da identidade, em rotação (o legado usava 5 cores soltas; aqui só a paleta).
const CORES = [
  "border-verde text-verde",
  "border-roxo text-roxo-texto",
  "border-laranja text-laranja",
  "border-foreground/60 text-foreground",
  "border-verde text-verde",
];

/**
 * Faixa de números do corpus. `namespace` escolhe os rótulos (Home usa uns,
 * Biblioteca outros — como no Streamlit). null = "sem dados", nunca 0.
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
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {ORDEM.map((chave, i) => {
        const v = valores?.[chave] ?? null;
        return (
          <div
            key={chave}
            // dt antes do dd no DOM (semântica); número aparece em cima via flex-col-reverse.
            className={cn(
              "flex flex-col-reverse justify-end gap-2 rounded-sm border-l-2 bg-superficie px-4 py-4",
              CORES[i].split(" ")[0],
            )}
          >
            <dt className="rotulo text-[0.65rem] leading-snug tracking-[0.12em]">{t(chave)}</dt>
            <dd
              className={cn(
                "font-mono text-3xl font-bold leading-none tabular-nums",
                v === null ? "text-base font-normal text-muted-foreground" : CORES[i].split(" ")[1],
              )}
            >
              {v === null ? tc("semDados") : format.number(v)}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
