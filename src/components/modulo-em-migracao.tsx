import { ArrowUpRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { estiloBotao, Pagina } from "@/components/pagina";
import { MODULOS, urlLegado, type ChaveModulo } from "@/lib/navegacao";
import { cn } from "@/lib/utils";

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
      <p className="rotulo mb-6">
        {String(indice + 1).padStart(2, "0")} · {tm(`${chave}.escala`)}
      </p>
      <h1 className="text-[clamp(3rem,10vw,8rem)] leading-[0.85] font-black uppercase">{tm(`${chave}.nome`)}</h1>
      <p className="mt-10 max-w-3xl text-xl leading-relaxed text-foreground/85">{tm(`${chave}.frase`)}</p>

      <div className="mt-14 grid gap-px bg-border lg:grid-cols-2">
        <div className="border-l-4 border-laranja bg-superficie p-8">
          <p className="rotulo mb-3 text-laranja">{t("rotulo")}</p>
          <p className="text-lg font-semibold">{t("titulo")}</p>
          <p className="mt-2 text-foreground/70">{t("texto")}</p>
          <a href={urlLegado(modulo.codigoLegado)} className={cn(estiloBotao.base, estiloBotao.laranja, "mt-8")}>
            {t("botao")} <ArrowUpRight aria-hidden className="size-4" />
          </a>
        </div>
        <div className="space-y-6 bg-background p-8 text-foreground/80 lg:bg-superficie/40">
          <div>
            <p className="rotulo mb-2">{home("quandoUsar")}</p>
            <p className="leading-relaxed">{tm(`${chave}.quandoUsar`)}</p>
          </div>
          <div>
            <p className="rotulo mb-2">{home("casosDeUso")}</p>
            <ul className="space-y-2">
              {(tm.raw(`${chave}.casos`) as string[]).map((c) => (
                <li key={c} className="flex gap-3 leading-relaxed">
                  <span aria-hidden className="mt-2.5 size-1.5 shrink-0 bg-verde" />
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
