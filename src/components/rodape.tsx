import { ArrowUpRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Eyebrow } from "@/components/brand/Brand";
import { Logo } from "@/components/brand/Logo";
import { Link } from "@/i18n/navigation";
import { MODULOS } from "@/lib/navegacao";

const EXTERNOS = [
  { rotulo: "classecreator.com", href: "https://classecreator.com/" },
  { rotulo: "Instagram", href: "https://www.instagram.com/classecreator/" },
  { rotulo: "YouTube", href: "https://www.youtube.com/@ClasseCreator" },
];

const estiloLink = "text-sm text-muted-foreground transition-colors hover:text-cc-green";

export async function Rodape() {
  const t = await getTranslations("Rodape");
  const nav = await getTranslations("Nav");
  const tm = await getTranslations("Modulos");
  const sobre = await getTranslations("Sobre");
  const comum = await getTranslations("Comum");

  return (
    <footer className="border-t border-cc-line">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo className="h-12" />
          <p className="mt-3 font-display text-lg">Raio-X</p>
          <Eyebrow className="mt-1">{nav("observatorio")}</Eyebrow>
          <p className="mt-6 max-w-xs font-display text-lg leading-tight text-cc-green">{sobre("tagline")}</p>
        </div>

        <div>
          <Eyebrow className="mb-4">{t("modulos")}</Eyebrow>
          <ul className="space-y-2">
            {MODULOS.map((m) => (
              <li key={m.chave}>
                <Link href={m.href} className={estiloLink}>
                  {tm(`${m.chave}.nome`)}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <Eyebrow className="mb-4">{t("projeto")}</Eyebrow>
          <ul className="space-y-2">
            <li><Link href="/biblioteca" className={estiloLink}>{nav("biblioteca")}</Link></li>
            <li><Link href="/sobre" className={estiloLink}>{nav("sobre")}</Link></li>
            <li>
              <a
                href="https://github.com/FiSeveroo/raio-x-classe-creator"
                target="_blank"
                rel="noopener noreferrer"
                className={`${estiloLink} inline-flex items-center gap-1`}
              >
                {t("codigo")} <ArrowUpRight aria-hidden className="size-3.5" />
              </a>
            </li>
          </ul>
        </div>

        <div>
          <Eyebrow className="mb-4">{t("classe")}</Eyebrow>
          <ul className="space-y-2">
            {EXTERNOS.map((e) => (
              <li key={e.href}>
                <a href={e.href} target="_blank" rel="noopener noreferrer" className={`${estiloLink} inline-flex items-center gap-1`}>
                  {e.rotulo} <ArrowUpRight aria-hidden className="size-3.5" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t border-cc-line">
        <p className="mx-auto max-w-7xl px-4 py-5 text-xs text-muted-foreground sm:px-8">{comum("rodape")}</p>
      </div>
    </footer>
  );
}
