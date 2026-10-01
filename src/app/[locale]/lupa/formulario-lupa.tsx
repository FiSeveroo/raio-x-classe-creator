"use client";

import { ArrowRight, Loader2 } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { Eyebrow } from "@/components/brand/Brand";
import { rico } from "@/components/rico";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link, useRouter } from "@/i18n/navigation";
import { analisarVideo, type ResultadoLupa } from "./actions";

export function FormularioLupa({
  restantesIniciais,
  limiteSessao,
  limiteDiario,
}: {
  restantesIniciais: number;
  limiteSessao: number;
  limiteDiario: number;
}) {
  const t = useTranslations("Lupa");
  const format = useFormatter();
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [resultado, setResultado] = useState<ResultadoLupa | null>(null);
  const [pendente, iniciar] = useTransition();
  const [passo, setPasso] = useState(0);
  const passos = t.raw("passos") as string[];

  // Mensagens de etapa enquanto a análise roda (o servidor não transmite progresso).
  useEffect(() => {
    if (!pendente) return;
    const id = setInterval(() => setPasso((p) => Math.min(p + 1, passos.length - 1)), 2500);
    return () => clearInterval(id);
  }, [pendente, passos.length]);

  function enviar(atualizar?: { versaoAnteriorId: number }) {
    setResultado(null);
    setPasso(0);
    iniciar(async () => {
      const r = await analisarVideo({ url, atualizar });
      if (r.estado === "ok") {
        router.push(`/biblioteca/video/${r.id}?nova=1`);
        return;
      }
      setResultado(r);
    });
  }

  const bloqueado = restantesIniciais <= 0;

  return (
    <div className="mt-12 max-w-3xl">
      <div className="mb-4 flex items-center gap-3 rounded-lg border-l-2 border-cc-green bg-cc-surface px-4 py-2.5 text-sm">
        <Eyebrow>{t("sessao")}</Eyebrow>
        <span className="text-cc-green">{t("restantes", { n: Math.max(0, restantesIniciais) })}</span>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (url.trim()) enviar();
        }}
        className="flex flex-col gap-3 sm:flex-row"
      >
        <label className="flex-1">
          <span className="sr-only">{t("rotuloUrl")}</span>
          <Input
            type="url"
            inputMode="url"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={t("placeholder")}
            disabled={pendente || bloqueado}
            className="h-12 text-base"
          />
        </label>
        <Button type="submit" size="lg" font="display" disabled={pendente || bloqueado || !url.trim()}>
          {pendente ? <Loader2 aria-hidden className="animate-spin" /> : <ArrowRight aria-hidden />}
          {t("botao")}
        </Button>
      </form>

      <div aria-live="polite" className="mt-6 space-y-4">
        {pendente && (
          <p className="flex items-center gap-2 text-muted-foreground">
            <Loader2 aria-hidden className="size-4 animate-spin text-cc-green" />
            {passos[passo]}
          </p>
        )}

        {bloqueado && !resultado && (
          <p role="alert" className="rounded-lg border-l-2 border-cc-orange bg-cc-surface px-4 py-3 text-sm">
            {t("erros.limite_sessao", { limite: limiteSessao })}
          </p>
        )}

        {resultado?.estado === "erro" && (
          <p role="alert" className="rounded-lg border-l-2 border-cc-orange bg-cc-surface px-4 py-3 text-sm">
            {t(`erros.${resultado.codigo}`, {
              limite: resultado.codigo === "limite_diario" ? limiteDiario : limiteSessao,
              uso: resultado.uso ?? 0,
              peso: resultado.peso ?? 0,
              restantes: resultado.restantes ?? 0,
              detalhe: resultado.detalhe ?? "",
            })}
          </p>
        )}

        {resultado?.estado === "existente" && (
          <div className="rounded-xl border border-cc-green/40 bg-cc-surface p-5 sm:p-6">
            <Eyebrow className="text-cc-green">{t("existenteRotulo")}</Eyebrow>
            <p className="mt-2 leading-relaxed">
              {rico(
                t("existenteTexto", {
                  versao: resultado.versao,
                  data: resultado.data ? format.dateTime(new Date(resultado.data), { dateStyle: "short" }) : "—",
                }),
              )}
            </p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href={`/biblioteca/video/${resultado.id}`}>{t("verExistente")}</Link>
              </Button>
              {resultado.pode ? (
                <Button
                  type="button"
                  size="lg"
                  variant="outline"
                  disabled={pendente}
                  onClick={() => enviar({ versaoAnteriorId: resultado.id })}
                >
                  {t("gerar", { versao: resultado.proximaVersao, peso: resultado.peso })}
                </Button>
              ) : (
                <Button type="button" size="lg" variant="outline" disabled>
                  {t("aguardar", { dias: resultado.diasRestantes })}
                </Button>
              )}
            </div>
            {resultado.pode && (
              <p className="mt-3 text-xs text-muted-foreground">
                {t("avisoCusto", { versao: resultado.proximaVersao, peso: resultado.peso })}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
