import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

export default function NaoEncontrada() {
  const t = useTranslations("Comum");
  const nav = useTranslations("Nav");
  return (
    <div className="relative isolate grid min-h-[70dvh] place-items-center overflow-hidden px-4 py-24 text-center">
      <div aria-hidden className="bg-textura absolute inset-0 -z-10 opacity-20" />
      <div>
        <p className="font-display text-[clamp(5rem,20vw,12rem)] leading-none text-cc-green">404</p>
        <h1 className="mt-4 font-display text-2xl sm:text-3xl">{t("paginaNaoEncontrada")}</h1>
        <Button asChild size="lg" className="mt-10">
          <Link href="/">← {nav("home")}</Link>
        </Button>
      </div>
    </div>
  );
}
