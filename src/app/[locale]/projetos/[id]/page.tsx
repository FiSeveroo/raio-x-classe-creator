import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Eyebrow } from "@/components/brand/Brand";
import { Pagina } from "@/components/pagina";
import { Link, redirect } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { buscarProjeto, listarProjetos, projetoAtivoId } from "@/lib/projetos";
import { usuarioAtual } from "@/lib/supabase/conta";
import { BarraProjeto, CabecalhoEditavel } from "../controles";
import { PainelProjeto } from "../painel-projeto";

export const maxDuration = 60;

export async function generateMetadata({ params }: PageProps<"/[locale]/projetos/[id]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Projetos" });
  return { title: t("titulo"), robots: { index: false } };
}

export default async function ProjetoPagina({ params }: PageProps<"/[locale]/projetos/[id]">) {
  const { locale, id } = (await params) as { locale: Locale; id: string };
  setRequestLocale(locale);
  if (!(await usuarioAtual())) redirect({ href: "/entrar", locale });
  const t = await getTranslations("Projetos");
  const n = Number(id);
  const dados = Number.isInteger(n) && n > 0 ? await buscarProjeto(n) : null;
  if (!dados) notFound();
  const [todos, ativo] = await Promise.all([listarProjetos(), projetoAtivoId()]);
  const h = await headers();
  const origem = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const { projeto, itens } = dados;

  return (
    <Pagina>
      <Eyebrow className="mb-6">
        <Link href="/projetos" className="hover:text-foreground">
          {t("titulo")}
        </Link>
      </Eyebrow>
      <CabecalhoEditavel id={projeto.id} nome={projeto.nome} descricao={projeto.descricao} />
      <BarraProjeto
        id={projeto.id}
        ativo={ativo === projeto.id}
        token={projeto.token_leitura}
        origem={origem}
        itens={itens.map((i) => ({ modulo: i.modulo, id: i.analise_id }))}
        nomeArquivo={`raio-x-projeto-${projeto.id}.xlsx`}
      />
      <PainelProjeto
        projeto={projeto}
        itens={itens}
        locale={locale}
        editavel
        outrosProjetos={todos.filter((p) => p.id !== projeto.id).map((p) => ({ id: p.id, nome: p.nome }))}
      />
    </Pagina>
  );
}
