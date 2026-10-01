import { ArrowUpRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { MODULOS } from "@/lib/navegacao";

const EXTERNOS = [
  { rotulo: "classecreator.com", href: "https://classecreator.com/" },
  { rotulo: "Instagram", href: "https://www.instagram.com/classecreator/" },
  { rotulo: "YouTube", href: "https://www.youtube.com/@ClasseCreator" },
];

export async function Rodape() {
  const t = await getTranslations("Rodape");
  const nav = await getTranslations("Nav");
  const tm = await getTranslations("Modulos");
  const sobre = await getTranslations("Sobre");
  const comum = await getTranslations("Comum");

  const titulo = "mb-4 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground";
  const link = "text-sm text-foreground/80 transition-colors hover:text-verde";

  return (
    <footer className="border-t border-border bg-superficie">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <p className="font-heading text-4xl font-black tracking-wider text-verde">{nav("marca")}</p>
          <p className="rotulo mt-2 text-[0.6rem]">{nav("observatorio")}</p>
          <p className="mt-6 max-w-xs font-heading text-lg font-black uppercase leading-tight">
            {sobre("tagline")}
          </p>
        </div>

        <div>
          <p className={titulo}>{t("modulos")}</p>
          <ul className="space-y-2">
            {MODULOS.map((m) => (
              <li key={m.chave}>
                <Link href={m.href} className={link}>
                  {tm(`${m.chave}.nome`)}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className={titulo}>{t("projeto")}</p>
          <ul className="space-y-2">
            <li><Link href="/biblioteca" className={link}>{nav("biblioteca")}</Link></li>
            <li><Link href="/sobre" className={link}>{nav("sobre")}</Link></li>
            <li>
              <a
                href="https://github.com/FiSeveroo/raio-x-classe-creator"
                target="_blank"
                rel="noopener noreferrer"
                className={`${link} inline-flex items-center gap-1`}
              >
                {t("codigo")} <ArrowUpRight aria-hidden className="size-3.5" />
              </a>
            </li>
          </ul>
        </div>

        <div>
          <p className={titulo}>{t("classe")}</p>
          <ul className="space-y-2">
            {EXTERNOS.map((e) => (
              <li key={e.href}>
                <a href={e.href} target="_blank" rel="noopener noreferrer" className={`${link} inline-flex items-center gap-1`}>
                  {e.rotulo} <ArrowUpRight aria-hidden className="size-3.5" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t border-border">
        <p className="mx-auto max-w-7xl px-4 py-5 font-mono text-[0.7rem] text-muted-foreground sm:px-8">
          {comum("rodape")}
        </p>
      </div>
    </footer>
  );
}
