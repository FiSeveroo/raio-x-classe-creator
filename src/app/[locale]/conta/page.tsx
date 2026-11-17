import type { Metadata } from "next";
import { ArrowRight, FolderOpen } from "lucide-react";
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
      <p className="mt-6 text-muted-foreground">
        {t("logadoComo")} <span className="text-foreground">{usuario!.email}</span>
      </p>

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

      <section className="mt-14" aria-labelledby="senha">
        <SectionTitle tone="secondary">
          <span id="senha">{t("senhaTitulo")}</span>
        </SectionTitle>
        <FormularioSenha destacar={sp.senha === "1"} />
      </section>

      <section className="mt-14 flex flex-wrap items-start gap-6 border-t border-cc-line pt-10">
        <BotaoSair />
        <ApagarConta />
      </section>
      <p className="mt-8 text-sm text-muted-foreground">
        <Link href="/privacidade" className="underline-offset-4 hover:text-foreground hover:underline">
          {t("privacidadeLink")}
        </Link>
      </p>
    </Pagina>
  );
}
