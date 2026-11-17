import type { Metadata } from "next";
import { ArrowRight, ChevronDown, FolderOpen, Settings } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Eyebrow, SectionTitle } from "@/components/brand/Brand";
import { Metricas } from "@/components/metricas";
import { Pagina } from "@/components/pagina";
import { Button } from "@/components/ui/button";
import { Link, redirect } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { listarProjetos, projetoAtivoId } from "@/lib/projetos";
import { usuarioAtual } from "@/lib/supabase/conta";
import { cotaAtual, type Modulo } from "@/lib/versionamento";
import { ApagarConta, BotaoSair, FormularioSenha } from "./formularios";

export async function generateMetadata({ params }: PageProps<"/[locale]/conta">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Conta" });
  return { title: t("titulo"), robots: { index: false } };
}

const MODULOS: Modulo[] = ["lupa", "dossie", "disputa", "voz"];

export default async function Conta({ params, searchParams }: PageProps<"/[locale]/conta">) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const usuario = await usuarioAtual();
  if (!usuario) redirect({ href: "/entrar", locale });
  const sp = await searchParams;
  const t = await getTranslations("Conta");
  const tm = await getTranslations("Modulos");
  const [cotas, projetos, ativo] = await Promise.all([
    Promise.all(MODULOS.map((m) => cotaAtual(m))),
    listarProjetos(),
    projetoAtivoId(),
  ]);
  const projetoAtivo = projetos.find((p) => p.id === ativo);

  return (
    <Pagina>
      <Eyebrow className="mb-6">{t("eyebrow")}</Eyebrow>
      <h1 className="font-display text-[clamp(2.25rem,8vw,5.5rem)] leading-[0.9]">{t("titulo")}</h1>
      <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
        <p className="text-muted-foreground">
          {t("logadoComo")} <span className="text-foreground">{usuario!.email}</span>
        </p>
        <BotaoSair />
      </div>

      <section className="mt-14" aria-labelledby="projetos">
        <SectionTitle>
          <span id="projetos">{t("projetosTitulo")}</span>
        </SectionTitle>
        <p className="-mt-2 mb-6 max-w-prose text-muted-foreground">
          {projetoAtivo ? t("ativoTexto", { nome: projetoAtivo.nome }) : t("semAtivoTexto")}
        </p>
        <div className="flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/projetos">
              <FolderOpen aria-hidden /> {t("verProjetos", { n: projetos.length })}
            </Link>
          </Button>
          {projetoAtivo && (
            <Button asChild size="lg" variant="outline">
              <Link href={`/projetos/${projetoAtivo.id}`}>
                {projetoAtivo.nome} <ArrowRight aria-hidden />
              </Link>
            </Button>
          )}
        </div>
      </section>

      <section className="mt-14" aria-labelledby="uso">
        <SectionTitle tone="secondary">
          <span id="uso">{t("usoTitulo")}</span>
        </SectionTitle>
        <p className="-mt-2 mb-6 max-w-prose text-muted-foreground">{t("usoTexto")}</p>
        <Metricas
          colunas={4}
          itens={MODULOS.map((m, i) => ({
            rotulo: tm(`${m}.nome`),
            valor: `${cotas[i].usados} / ${cotas[i].limite}`,
          }))}
        />
      </section>

      {/* Senha e apagar conta ficam recolhidos (pedido do Filipe em 17/nov/2026). */}
      <details id="senha" open={sp.senha === "1"} className="group mt-14 border-t border-cc-line pt-8">
        <summary className="label-caps inline-flex cursor-pointer list-none items-center gap-2 rounded-md border border-cc-line px-4 py-2.5 text-muted-foreground transition-colors hover:text-foreground [&::-webkit-details-marker]:hidden">
          <Settings aria-hidden className="size-4" /> {t("informacoes")}
          <ChevronDown aria-hidden className="size-4 transition-transform group-open:rotate-180" />
        </summary>
        <div className="mt-8 space-y-12">
          <section aria-labelledby="titulo-senha">
            <h2 id="titulo-senha" className="font-display text-xl">{t("senhaTitulo")}</h2>
            <div className="mt-4">
              <FormularioSenha destacar={sp.senha === "1"} />
            </div>
          </section>
          <section aria-labelledby="titulo-apagar">
            <h2 id="titulo-apagar" className="font-display text-xl">{t("apagarTitulo")}</h2>
            <div className="mt-4">
              <ApagarConta />
            </div>
          </section>
          <p className="text-sm text-muted-foreground">
            <Link href="/privacidade" className="underline-offset-4 hover:text-foreground hover:underline">
              {t("privacidadeLink")}
            </Link>
          </p>
        </div>
      </details>
    </Pagina>
  );
}
