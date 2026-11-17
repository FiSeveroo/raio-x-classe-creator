"use client";

import { FolderPlus, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import { acaoAdicionarAoProjeto, acaoMeusProjetos } from "@/app/[locale]/projetos/acoes";

type Ref = { modulo: "lupa" | "dossie" | "disputa" | "voz"; id: number };

/** Logado = existe cookie de sessão do Supabase (o servidor revalida em cada ação). */
function temSessao() {
  try {
    return document.cookie.split(";").some((c) => c.trim().startsWith("sb-"));
  } catch {
    return false;
  }
}

/**
 * "Adicionar ao projeto" (decisão do Filipe em 17/nov/2026): aparece só para
 * quem tem conta. Escolhe um projeto existente (o ativo vem marcado) ou cria
 * um novo na hora.
 */
export function AdicionarAoProjeto({ itens, compacto = false }: { itens: Ref[]; compacto?: boolean }) {
  const t = useTranslations("Projetos");
  const [logado, setLogado] = useState(false);
  const [aberto, setAberto] = useState(false);
  const [projetos, setProjetos] = useState<{ id: number; nome: string }[] | null>(null);
  const [escolha, setEscolha] = useState<string>("");
  const [novo, setNovo] = useState("");
  const [feito, setFeito] = useState<number | null>(null);
  const [erro, setErro] = useState(false);
  const [pendente, iniciar] = useTransition();

  useEffect(() => {
    const id = setTimeout(() => setLogado(temSessao()), 0);
    return () => clearTimeout(id);
  }, []);

  if (!logado || !itens.length) return null;

  function abrir() {
    setAberto(true);
    setFeito(null);
    setErro(false);
    iniciar(async () => {
      const r = await acaoMeusProjetos();
      if (!r.ok || !r.dados) {
        setErro(true);
        return;
      }
      setProjetos(r.dados.projetos);
      setEscolha(r.dados.ativo ? String(r.dados.ativo) : r.dados.projetos[0] ? String(r.dados.projetos[0].id) : "novo");
    });
  }

  function adicionar() {
    iniciar(async () => {
      const r = await acaoAdicionarAoProjeto(escolha === "novo" ? { novo } : Number(escolha), itens);
      if (r.ok && r.dados) setFeito(r.dados);
      else setErro(true);
    });
  }

  if (!aberto)
    return (
      <Button variant="outline" size={compacto ? "sm" : "default"} onClick={abrir}>
        <FolderPlus aria-hidden /> {itens.length > 1 ? t("salvarNoProjeto", { n: itens.length }) : t("adicionarAoProjeto")}
      </Button>
    );

  return (
    <div className="w-full max-w-xl space-y-3 rounded-lg border border-cc-line bg-cc-surface p-4">
      {projetos === null ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 aria-hidden className="size-4 animate-spin" /> {t("carregando")}
        </p>
      ) : feito ? (
        <p className="text-sm">
          {t("adicionado")}{" "}
          <Link href={`/projetos/${feito}`} className="text-cc-green underline-offset-4 hover:underline">
            {t("abrirProjeto")}
          </Link>
        </p>
      ) : (
        <>
          <label className="block">
            <span className="label-caps mb-1.5 block text-muted-foreground">{t("destino")}</span>
            <select
              value={escolha}
              onChange={(e) => setEscolha(e.target.value)}
              className="h-10 w-full rounded-lg border border-input bg-input/30 px-3 text-sm text-foreground"
            >
              {projetos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
              <option value="novo">{t("novoProjetoOpcao")}</option>
            </select>
          </label>
          {escolha === "novo" && (
            <Input value={novo} onChange={(e) => setNovo(e.target.value)} maxLength={120} placeholder={t("nomeExemplo")} aria-label={t("nome")} className="h-10" />
          )}
          <div className="flex gap-2">
            <Button size="sm" disabled={pendente || (escolha === "novo" && !novo.trim())} onClick={adicionar}>
              <FolderPlus aria-hidden /> {t("adicionar")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAberto(false)}>
              {t("cancelar")}
            </Button>
          </div>
        </>
      )}
      {erro && <p role="alert" className="text-sm text-cc-orange">{t("erro")}</p>}
    </div>
  );
}
