import { ArrowUpRight } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { SectionTitle } from "@/components/brand/Brand";
import { Metricas } from "@/components/metricas";
import { Aviso } from "@/components/pagina";
import { Button } from "@/components/ui/button";
import { LIMITE_PADRAO_CONTA, listarContas, usoDoSite } from "@/lib/contas-admin";
import { definirLimitesConta } from "./acoes";

/*
 * Abas "Uso" e "Contas" do painel interno (decisões do Filipe em 17/nov/2026).
 * Visitas ficam no Vercel Analytics; aqui, o que o banco sabe.
 */

const MODULOS_PAINEL = ["lupa", "dossie", "disputa", "voz"] as const;

export async function AbaUso() {
  const t = await getTranslations("Termometro");
  const tm = await getTranslations("Modulos");
  const format = await getFormatter();
  const uso = await usoDoSite();
  if (!uso) return <Aviso>{t("usoIndisponivel")}</Aviso>;
  const totalDia = uso.dias.map((_, i) => MODULOS_PAINEL.reduce((s, m) => s + uso.analises[m][i], 0));
  const max = Math.max(1, ...totalDia);
  return (
    <section className="space-y-10">
      <div>
        <SectionTitle as="h3">{t("usoTitulo")}</SectionTitle>
        <p className="-mt-2 mb-6 max-w-prose text-sm text-muted-foreground">{t("usoLegenda")}</p>
        <Metricas
          colunas={4}
          itens={[
            ...MODULOS_PAINEL.map((m) => ({ rotulo: tm(`${m}.nome`), valor: format.number(uso.totaisModulo[m]) })),
            { rotulo: t("usoContas"), valor: uso.contas === null ? null : format.number(uso.contas) },
            { rotulo: t("usoContasNovas"), valor: uso.contasNovas30 === null ? null : format.number(uso.contasNovas30) },
            { rotulo: t("usoProjetos"), valor: uso.projetos === null ? null : format.number(uso.projetos) },
          ]}
        />
      </div>
      <div>
        <h4 className="label-caps mb-3 text-muted-foreground">{t("usoPorDia")}</h4>
        <ol className="flex h-36 items-end gap-0.5" aria-label={t("usoPorDia")}>
          {uso.dias.map((d, i) => (
            <li key={d} className="flex h-full flex-1 flex-col justify-end" title={`${d}: ${totalDia[i]}`}>
              <span className="block rounded-t-sm bg-cc-green" style={{ height: `${(totalDia[i] / max) * 100}%`, minHeight: totalDia[i] ? 2 : 0 }} />
            </li>
          ))}
        </ol>
        <p className="mt-2 flex justify-between text-xs text-muted-foreground">
          <span>{format.dateTime(new Date(`${uso.dias[0]}T12:00:00Z`), { dateStyle: "short" })}</span>
          <span>{format.dateTime(new Date(`${uso.dias.at(-1)}T12:00:00Z`), { dateStyle: "short" })}</span>
        </p>
      </div>
      <p className="max-w-prose text-sm text-muted-foreground">
        {t("usoVisitas")}{" "}
        <a href="https://vercel.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-cc-green underline-offset-4 hover:underline">
          Vercel Analytics <ArrowUpRight aria-hidden className="inline size-3.5" />
        </a>
      </p>
    </section>
  );
}

export async function AbaContas({ busca }: { busca: string }) {
  const t = await getTranslations("Termometro");
  const tm = await getTranslations("Modulos");
  const format = await getFormatter();
  if (!process.env.SENHA_PAINEL_INTERNO) return <Aviso>{t("contasSemSenha")}</Aviso>;
  const contas = await listarContas(busca);
  if (contas === null) return <Aviso>{t("contasIndisponivel")}</Aviso>;
  const voltar = `/termometro?aba=contas${busca ? `&busca=${encodeURIComponent(busca)}` : ""}`;
  return (
    <section>
      <SectionTitle as="h3">{t("contasTitulo")}</SectionTitle>
      <p className="-mt-2 mb-6 max-w-prose text-sm text-muted-foreground">{t("contasLegenda")}</p>
      <form method="get" className="mb-8 flex max-w-md gap-2">
        <input type="hidden" name="aba" value="contas" />
        <input
          name="busca"
          defaultValue={busca}
          placeholder={t("contasBusca")}
          aria-label={t("contasBusca")}
          className="h-10 flex-1 rounded-lg border border-input bg-input/30 px-3 text-sm text-foreground"
        />
        <Button type="submit" variant="outline">
          {t("contasBuscar")}
        </Button>
      </form>
      {!contas.length ? (
        <p className="text-muted-foreground">{t("contasNenhuma")}</p>
      ) : (
        <ul className="space-y-4">
          {contas.map((c) => (
            <li key={c.id} className="rounded-xl border border-cc-line bg-cc-surface p-4">
              <p className="font-medium [overflow-wrap:anywhere]">{c.email}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("contasDesde", { data: format.dateTime(new Date(c.criadaEm), { dateStyle: "short" }) })}
                {c.ultimoAcesso && <> · {t("contasUltimo", { data: format.dateTime(new Date(c.ultimoAcesso), { dateStyle: "short" }) })}</>}
                {" · "}
                {t("contasProjetos", { n: c.projetos })}
              </p>
              <form action={definirLimitesConta} className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-[repeat(4,minmax(0,1fr))_auto] sm:items-end">
                <input type="hidden" name="user_id" value={c.id} />
                <input type="hidden" name="voltar" value={voltar} />
                {MODULOS_PAINEL.map((m) => (
                  <label key={m} className="block text-xs">
                    <span className="label-caps mb-1 block text-muted-foreground">
                      {tm(`${m}.nome`)} · {t("contasHoje", { n: c.usoHoje[m] ?? 0 })}
                    </span>
                    <input
                      type="number"
                      min={0}
                      name={m}
                      defaultValue={c.limites[m] ?? ""}
                      placeholder={String(LIMITE_PADRAO_CONTA[m])}
                      className="h-9 w-full rounded-md border border-input bg-input/30 px-2 text-sm text-foreground"
                    />
                  </label>
                ))}
                <Button type="submit" size="sm">
                  {t("contasSalvar")}
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
