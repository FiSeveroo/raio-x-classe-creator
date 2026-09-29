import { ExternalLink } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Pagina } from "@/components/pagina";
import { MODULOS, urlLegado, type ChaveModulo } from "@/lib/navegacao";

/**
 * Página provisória de um módulo ainda não portado (Fase 2). Mostra o que o
 * módulo faz e manda para a versão Streamlit, que segue no ar.
 */
export async function ModuloEmMigracao({ chave }: { chave: ChaveModulo }) {
  const t = await getTranslations("EmMigracao");
  const tm = await getTranslations("Modulos");
  const home = await getTranslations("Home");
  const modulo = MODULOS.find((m) => m.chave === chave)!;
  const Icone = modulo.icone;

  return (
    <Pagina>
      <header>
        <p className="rotulo mb-4 flex items-center gap-2">
          <Icone className="size-4" aria-hidden /> {tm(`${chave}.escala`)}
        </p>
        <h1 className="text-4xl leading-none font-black uppercase sm:text-6xl">{tm(`${chave}.nome`)}</h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-foreground/80">{tm(`${chave}.frase`)}</p>
      </header>

      <div className="mt-10 max-w-2xl rounded-md border-l-2 border-laranja bg-superficie p-6">
        <p className="rotulo mb-2 text-laranja">{t("rotulo")}</p>
        <p className="font-semibold">{t("titulo")}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t("texto")}</p>
        <a
          href={urlLegado(modulo.codigoLegado)}
          className="mt-5 inline-flex items-center gap-2 rounded-md border border-foreground/30 px-4 py-2 font-mono text-xs uppercase tracking-wider transition-colors hover:border-verde hover:text-verde"
        >
          {t("botao")} <ExternalLink className="size-3.5" aria-hidden />
        </a>
      </div>

      <div className="mt-12 max-w-2xl space-y-4 text-sm leading-relaxed text-foreground/80">
        <p>
          <strong className="text-foreground">{home("quandoUsar")}:</strong> {tm(`${chave}.quandoUsar`)}
        </p>
        <div>
          <p className="font-semibold text-foreground">{home("casosDeUso")}</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {(tm.raw(`${chave}.casos`) as string[]).map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      </div>
    </Pagina>
  );
}
