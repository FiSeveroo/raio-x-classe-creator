"use client";

import { Menu } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ConteudoMenu } from "./menu-lateral";

/** Barra superior + gaveta de navegação, visível só abaixo de lg. */
export function BarraMobile() {
  const t = useTranslations("Nav");
  const [aberto, setAberto] = useState(false);

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-sidebar-border bg-sidebar/95 px-4 backdrop-blur lg:hidden">
      <Link href="/" className="font-heading text-xl font-black tracking-wider text-verde">
        {t("marca")}
      </Link>
      <Sheet open={aberto} onOpenChange={setAberto}>
        <SheetTrigger
          aria-label={t("abrirMenu")}
          className="inline-flex size-10 items-center justify-center rounded-md text-foreground hover:bg-superficie-2"
        >
          <Menu className="size-5" aria-hidden />
        </SheetTrigger>
        <SheetContent side="left" className="w-72 bg-sidebar p-0 pt-6 pb-6">
          <SheetTitle className="sr-only">{t("secaoModulos")}</SheetTitle>
          <div className="h-full overflow-y-auto px-3">
            <ConteudoMenu aoNavegar={() => setAberto(false)} />
          </div>
        </SheetContent>
      </Sheet>
    </header>
  );
}
