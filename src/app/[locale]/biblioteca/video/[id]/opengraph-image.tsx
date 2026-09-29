import { getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { classificacaoVideoPorId } from "@/lib/corpus";
import { cardOg, TAMANHO_OG } from "@/lib/og";
import { nomeConteudo, nomeProdutor } from "@/lib/tipologia";

export const size = TAMANHO_OG;
export const contentType = "image/png";
export const alt = "Raio-X da Classe Creator";

export default async function Image({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = (await params) as { locale: Locale; id: string };
  const t = await getTranslations({ locale, namespace: "Biblioteca" });
  const r = await classificacaoVideoPorId(Number(id));
  const v = r.status === "ok" ? r.dados : null;

  if (!v) {
    return cardOg({ rotulo: t("titulo").toUpperCase(), titulo: t("naoEncontrada") });
  }

  return cardOg({
    rotulo: t("analiseVideo", { versao: v.versao_numero ?? 1, data: "" }).replace(/ · $/, ""),
    titulo: v.titulo ?? `#${v.id}`,
    subtitulo: v.canal_nome ?? undefined,
    eixos: {
      produtor: nomeProdutor(v.tipo_produtor, locale),
      conteudo: nomeConteudo(v.tipo_conteudo, locale),
    },
  });
}
