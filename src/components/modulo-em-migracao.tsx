import { ArrowUpRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Eyebrow } from "@/components/brand/Brand";
import { Pagina } from "@/components/pagina";
import { Button } from "@/components/ui/button";
import { MODULOS, urlLegado, type ChaveModulo } from "@/lib/navegacao";

/**
 * Página provisória de um módulo ainda não portado (Fase 2). Mostra o que o
 * módulo faz e manda para a versão Streamlit, que segue no ar.
 */
export async function ModuloEmMigracao({ chave }: { chave: ChaveModulo }) {
  const t = await getTranslations("EmMigracao");
  const tm = await getTranslations("Modulos");
  const home = await getTranslations("Home");
  const indice = MODULOS.findIndex((m) => m.chave === chave);
  const modulo = MODULOS[indice];

  return (
    <Pagina>
      <Eyebrow className="mb-6">
        {String(indice + 1).padStart(2, "0")} · {tm(`${chave}.escala`)}
      </Eyebrow>
      <h1 className="font-display text-[clamp(2.25rem,10vw,8rem)] leading-[0.9] [overflow-wrap:anywhere] hyphens-auto">{tm(`${chave}.nome`)}</h1>
      <p className="mt-10 max-w-3xl text-xl leading-relaxed text-foreground/85">{tm(`${chave}.frase`)}</p>

      <div className="mt-14 grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        {/* Aviso importante → laranja (diretriz) */}
        <div className="rounded-2xl border border-cc-orange/60 bg-cc-surface p-8">
          <p className="label-caps mb-3 text-cc-orange">{t("rotulo")}</p>
          <p className="text-lg font-semibold">{t("titulo")}</p>
          <p className="mt-2 text-muted-foreground">{t("texto")}</p>
          <Button asChild variant="cta" size="lg" font="display" className="mt-8 h-auto min-h-12 py-3 whitespace-normal">
            <a href={urlLegado(modulo.codigoLegado)}>
              {t("botao")} <ArrowUpRight aria-hidden />
            </a>
          </Button>
        </div>
        <div className="space-y-6 rounded-2xl border border-cc-line p-8">
          <div>
            <Eyebrow className="mb-2">{home("quandoUsar")}</Eyebrow>
            <p className="leading-relaxed text-foreground/85">{tm(`${chave}.quandoUsar`)}</p>
          </div>
          <div>
            <Eyebrow className="mb-2">{home("casosDeUso")}</Eyebrow>
            <ul className="space-y-2">
              {(tm.raw(`${chave}.casos`) as string[]).map((c) => (
                <li key={c} className="flex gap-3 leading-relaxed text-foreground/85">
                  <span aria-hidden className="mt-2.5 size-1.5 shrink-0 rounded-full bg-cc-green" />
                  {c}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </Pagina>
  );
}
