"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { confirmarHumano } from "@/lib/turnstile-acoes";

type Turnstile = {
  render: (el: HTMLElement, opcoes: Record<string, unknown>) => string;
  remove: (id: string) => void;
  reset: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

function carregarScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  return new Promise((ok, erro) => {
    let s = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT}"]`);
    if (!s) {
      s = document.createElement("script");
      s.src = SCRIPT;
      s.async = true;
      document.head.appendChild(s);
    }
    s.addEventListener("load", () => ok());
    s.addEventListener("error", () => erro(new Error("turnstile")));
  });
}

/**
 * Widget Cloudflare Turnstile (modo managed). Ao resolver, o token vai para
 * o servidor, que valida e grava o cookie de 24 h; aí `aoVerificar` é chamado.
 */
export function VerificacaoHumana({ siteKey, aoVerificar }: { siteKey: string; aoVerificar: () => void }) {
  const t = useTranslations("Comum");
  const locale = useLocale();
  const caixa = useRef<HTMLDivElement>(null);
  const [estado, setEstado] = useState<"aguardando" | "validando" | "falhou">("aguardando");

  useEffect(() => {
    let id: string | null = null;
    let vivo = true;
    carregarScript()
      .then(() => {
        if (!vivo || !caixa.current || !window.turnstile) return;
        id = window.turnstile.render(caixa.current, {
          sitekey: siteKey,
          theme: "dark",
          language: locale === "pt" ? "pt-br" : locale,
          callback: async (token: string) => {
            setEstado("validando");
            if (await confirmarHumano(token)) aoVerificar();
            else {
              setEstado("falhou");
              if (id) window.turnstile?.reset(id);
            }
          },
          "error-callback": () => setEstado("falhou"),
          "expired-callback": () => setEstado("aguardando"),
        });
      })
      .catch(() => setEstado("falhou"));
    return () => {
      vivo = false;
      if (id) window.turnstile?.remove(id);
    };
  }, [siteKey, locale, aoVerificar]);

  return (
    <div className="mb-4 rounded-lg border border-cc-line bg-cc-surface px-4 py-3">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {estado === "falhou" ? t("verificacaoFalhou") : t("verificando")}
      </p>
      <div ref={caixa} className="mt-2 min-h-[65px]" />
    </div>
  );
}
