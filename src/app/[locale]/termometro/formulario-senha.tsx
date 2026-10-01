"use client";

import { Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { entrarPainel } from "./acoes";

export function FormularioSenha({ voltar }: { voltar: string }) {
  const t = useTranslations("Termometro");
  const [estado, acao, pendente] = useActionState(entrarPainel, { erro: false });

  return (
    <form action={acao} className="flex max-w-md flex-col gap-3 sm:flex-row">
      <input type="hidden" name="voltar" value={voltar} />
      <label className="flex-1">
        <span className="sr-only">{t("senha")}</span>
        <Input type="password" name="senha" required placeholder={t("senha")} autoComplete="current-password" className="h-11" />
      </label>
      <Button type="submit" size="lg" disabled={pendente}>
        <Lock aria-hidden /> {t("acessar")}
      </Button>
      {estado.erro && (
        <p role="alert" className="text-sm text-cc-orange sm:basis-full">
          {t("senhaInvalida")}
        </p>
      )}
    </form>
  );
}
