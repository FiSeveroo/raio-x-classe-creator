import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Pagina } from "@/components/pagina";

export default function NaoEncontrada() {
  const t = useTranslations("Comum");
  const nav = useTranslations("Nav");
  return (
    <Pagina>
      <p className="rotulo text-laranja">404</p>
      <h1 className="mt-4 text-4xl font-black uppercase">{t("paginaNaoEncontrada")}</h1>
      <Link href="/" className="mt-8 inline-block font-mono text-xs uppercase tracking-wider text-verde hover:underline">
        ← {nav("home")}
      </Link>
    </Pagina>
  );
}
