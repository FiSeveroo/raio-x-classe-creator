"use client";

import { Check, ShoppingBasket } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { adicionarNaSessao, naSessao, removerDaSessao, useSessao, type ModuloSessao } from "@/lib/sessao/carrinho";

/**
 * Botão "adicionar à exportação da sessão" das páginas de resultado.
 * `automatico`: análise recém-feita entra sozinha (como o auto_carrinho do
 * Streamlit); consultas ao corpus entram só se a pessoa clicar.
 */
export function BotaoSessao({
  modulo,
  id,
  rotulo,
  automatico = false,
}: {
  modulo: ModuloSessao;
  id: number;
  rotulo: string;
  automatico?: boolean;
}) {
  const t = useTranslations("Sessao");
  const itens = useSessao();
  const dentro = naSessao(itens, modulo, id);

  useEffect(() => {
    if (automatico) adicionarNaSessao({ modulo, id, rotulo });
  }, [automatico, modulo, id, rotulo]);

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-cc-line bg-cc-surface px-4 py-3 text-sm">
      {dentro ? (
        <>
          <span className="flex items-center gap-2 text-cc-green">
            <Check aria-hidden className="size-4" /> {t("naSessao")}
          </span>
          <Link href="/sessao" className="underline underline-offset-4 hover:text-cc-green">
            {t("verSessao", { n: itens.length })}
          </Link>
          <button type="button" onClick={() => removerDaSessao(modulo, id)} className="text-muted-foreground underline underline-offset-4 hover:text-foreground">
            {t("remover")}
          </button>
        </>
      ) : (
        <>
          <Button type="button" variant="outline" size="sm" onClick={() => adicionarNaSessao({ modulo, id, rotulo })}>
            <ShoppingBasket aria-hidden /> {t("adicionar")}
          </Button>
          <span className="text-xs text-muted-foreground">{t("explicacao")}</span>
        </>
      )}
    </div>
  );
}

/** Indicador do cabeçalho: aparece quando há itens na sessão. */
export function IndicadorSessao({ aoNavegar }: { aoNavegar?: () => void }) {
  const t = useTranslations("Sessao");
  const n = useSessao().length;
  if (!n) return null;
  return (
    <Link
      href="/sessao"
      onClick={aoNavegar}
      className="label-caps flex items-center gap-1.5 text-cc-green transition-colors hover:text-foreground"
      aria-label={t("indicador", { n })}
    >
      <ShoppingBasket aria-hidden className="size-4" />
      <span className="tabular-nums">{n}</span>
    </Link>
  );
}
