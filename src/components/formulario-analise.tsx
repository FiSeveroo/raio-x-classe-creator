"use client";

import { ArrowRight, Loader2 } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { Eyebrow } from "@/components/brand/Brand";
import { rico } from "@/components/rico";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link, useRouter } from "@/i18n/navigation";
import type { ResultadoModulo } from "@/lib/versionamento";

/**
 * Formulário comum aos módulos de análise (Lupa, Dossiê, Disputa, Voz):
 * entrada → ação de servidor → resultado no corpus, oferta da versão
 * existente (ver / gerar vN, com cooldown e peso) ou erro traduzido.
 *
 * Textos vêm do namespace do módulo (mesmas chaves em todos).
 */
export function FormularioAnalise({
  namespace,
  acao,
  destino,
  restantesIniciais,
  limiteSessao,
  limiteDiario,
  tipoEntrada = "url",
  sugestoes,
}: {
  namespace: "Lupa" | "Dossie" | "Disputa" | "Voz";
  acao: (entrada: { valor: string; atualizar?: { versaoAnteriorId: number } }) => Promise<ResultadoModulo>;
  /** Prefixo da página do resultado no corpus, ex.: "/biblioteca/video/". */
  destino: string;
  restantesIniciais: number;
  limiteSessao: number;
  limiteDiario: number;
  tipoEntrada?: "url" | "text";
  /** Termos clicáveis que preenchem o campo (Disputa). Textos: sugestoesTitulo, sugestoesTexto. */
  sugestoes?: { grupo: string; termos: string[] }[];
}) {
  const t = useTranslations(namespace);
  const format = useFormatter();
  const router = useRouter();
  const [valor, setValor] = useState("");
  const [resultado, setResultado] = useState<ResultadoModulo | null>(null);
  const [pendente, iniciar] = useTransition();
  const [passo, setPasso] = useState(0);
  const passos = t.raw("passos") as string[];

  // Mensagens de etapa enquanto a análise roda (o servidor não transmite progresso).
  // Para na penúltima (a etapa longa, de IA): a última ("salvando") só seria
  // verdadeira no fim, e o tempo da IA varia demais para cronometrar.
  useEffect(() => {
    if (!pendente) return;
    const id = setInterval(() => setPasso((p) => Math.min(p + 1, Math.max(0, passos.length - 2))), 4000);
    return () => clearInterval(id);
  }, [pendente, passos.length]);

  function enviar(atualizar?: { versaoAnteriorId: number }) {
    setResultado(null);
    setPasso(0);
    iniciar(async () => {
      const r = await acao({ valor, atualizar });
      if (r.estado === "ok") {
        router.push(`${destino}${r.id}?nova=1`);
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
          if (valor.trim()) enviar();
        }}
        className="flex flex-col gap-3 sm:flex-row"
      >
        <label className="flex-1">
          <span className="sr-only">{t("rotuloUrl")}</span>
          <Input
            type={tipoEntrada}
            inputMode={tipoEntrada === "url" ? "url" : "text"}
            required
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder={t("placeholder")}
            disabled={pendente || bloqueado}
            className="h-12 text-base"
          />
        </label>
        <Button type="submit" size="lg" font="display" disabled={pendente || bloqueado || !valor.trim()}>
          {pendente ? <Loader2 aria-hidden className="animate-spin" /> : <ArrowRight aria-hidden />}
          {t("botao")}
        </Button>
      </form>

      {sugestoes && (
        <details className="group mt-4 rounded-lg border border-cc-line bg-cc-surface px-4 py-3">
          <summary className="cursor-pointer text-sm font-medium marker:text-cc-green">{t("sugestoesTitulo")}</summary>
          <p className="mt-3 text-sm text-muted-foreground">{t("sugestoesTexto")}</p>
          <div className="mt-4 space-y-4">
            {sugestoes.map((g) => (
              <div key={g.grupo}>
                <p className="label-caps text-cc-purple-text">{g.grupo}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {g.termos.map((termo) => (
                    <button
                      key={termo}
                      type="button"
                      onClick={() => setValor(termo)}
                      disabled={pendente || bloqueado}
                      className="rounded-full border border-cc-line px-3 py-1 text-sm transition-colors hover:border-cc-green hover:text-cc-green disabled:opacity-50"
                    >
                      {termo}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </details>
      )}

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
            {t.has(`erros.${resultado.codigo}`)
              ? t(`erros.${resultado.codigo}`, {
                  limite: resultado.codigo === "limite_diario" ? limiteDiario : limiteSessao,
                  uso: resultado.uso ?? 0,
                  peso: resultado.peso ?? 0,
                  restantes: resultado.restantes ?? 0,
                  detalhe: resultado.detalhe ?? "",
                })
              : t("erros.falha", { detalhe: resultado.detalhe ?? resultado.codigo })}
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
                <Link href={`${destino}${resultado.id}`}>{t("verExistente")}</Link>
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
