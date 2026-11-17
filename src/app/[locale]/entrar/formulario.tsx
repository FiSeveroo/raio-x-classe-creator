"use client";

import { ArrowRight, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VerificacaoHumana } from "@/components/verificacao-humana";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { criarConta, enviarLink, entrarComSenha, esqueciSenha, type ResultadoEntrar } from "./acoes";

type Modo = "link" | "senha" | "criar" | "esqueci";
const PRECISA_VERIFICAR: Modo[] = ["link", "criar", "esqueci"];

export function FormularioEntrar({
  modoInicial,
  siteKeyTurnstile,
  verificadoInicial,
}: {
  modoInicial: Modo;
  siteKeyTurnstile: string | null;
  verificadoInicial: boolean;
}) {
  const t = useTranslations("Entrar");
  const router = useRouter();
  const [modo, setModo] = useState<Modo>(modoInicial);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [resultado, setResultado] = useState<ResultadoEntrar | null>(null);
  const [pendente, iniciar] = useTransition();
  const [verificado, setVerificado] = useState(verificadoInicial || !siteKeyTurnstile);
  const aoVerificar = useCallback(() => setVerificado(true), []);

  const precisaVerificar = PRECISA_VERIFICAR.includes(modo) && !verificado && !!siteKeyTurnstile;

  function trocar(m: Modo) {
    setModo(m);
    setResultado(null);
  }

  function enviar() {
    setResultado(null);
    iniciar(async () => {
      const r =
        modo === "link"
          ? await enviarLink(email)
          : modo === "senha"
            ? await entrarComSenha(email, senha)
            : modo === "criar"
              ? await criarConta(email, senha)
              : await esqueciSenha(email);
      if (r.ok && !r.aviso) {
        router.push("/conta");
        router.refresh();
        return;
      }
      if (!r.ok && r.codigo === "verificacao") setVerificado(false);
      setResultado(r);
    });
  }

  const abas: Modo[] = ["link", "senha", "criar"];

  return (
    <div className="max-w-md">
      <div role="tablist" aria-label={t("titulo")} className="mb-6 flex border-b border-cc-line">
        {abas.map((m) => (
          <button
            key={m}
            role="tab"
            type="button"
            aria-selected={modo === m || (m === "senha" && modo === "esqueci")}
            onClick={() => trocar(m)}
            className={cn(
              "label-caps -mb-px border-b-2 px-3 py-3 transition-colors",
              modo === m || (m === "senha" && modo === "esqueci")
                ? "border-cc-green text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t(`abas.${m}`)}
          </button>
        ))}
      </div>

      <p className="mb-5 text-sm text-muted-foreground">{t(`explicacao.${modo}`)}</p>

      {precisaVerificar && <VerificacaoHumana siteKey={siteKeyTurnstile!} aoVerificar={aoVerificar} />}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!precisaVerificar) enviar();
        }}
        className="space-y-3"
      >
        <label className="block">
          <span className="label-caps mb-1.5 block text-muted-foreground">{t("email")}</span>
          <Input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" />
        </label>
        {(modo === "senha" || modo === "criar") && (
          <label className="block">
            <span className="label-caps mb-1.5 block text-muted-foreground">{t("senha")}</span>
            <Input
              type="password"
              required
              minLength={modo === "criar" ? 10 : undefined}
              autoComplete={modo === "criar" ? "new-password" : "current-password"}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="h-11"
            />
            {modo === "criar" && <span className="mt-1 block text-xs text-muted-foreground">{t("senhaRegra")}</span>}
          </label>
        )}
        <Button type="submit" size="lg" className="w-full" disabled={pendente || precisaVerificar}>
          {pendente ? <Loader2 aria-hidden className="animate-spin" /> : <ArrowRight aria-hidden />}
          {t(`botao.${modo}`)}
        </Button>
      </form>

      {modo === "senha" && (
        <button type="button" onClick={() => trocar("esqueci")} className="mt-4 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
          {t("esqueci")}
        </button>
      )}
      {modo === "esqueci" && (
        <button type="button" onClick={() => trocar("senha")} className="mt-4 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
          {t("voltarSenha")}
        </button>
      )}

      <div aria-live="polite" className="mt-5">
        {resultado?.ok && resultado.aviso && (
          <p className="rounded-lg border-l-2 border-cc-green bg-cc-surface px-4 py-3 text-sm">{t(`avisos.${resultado.aviso}`)}</p>
        )}
        {resultado && !resultado.ok && (
          <p role="alert" className="rounded-lg border-l-2 border-cc-orange bg-cc-surface px-4 py-3 text-sm">
            {t.has(`erros.${resultado.codigo}`) ? t(`erros.${resultado.codigo}`) : t("erros.falha")}
          </p>
        )}
      </div>
    </div>
  );
}
