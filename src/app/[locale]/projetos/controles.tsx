"use client";

import { Check, Download, Link2, Link2Off, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { BotaoCopiar } from "@/components/botao-copiar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "@/i18n/navigation";
import { acaoApagarProjeto, acaoCriarProjeto, acaoDefinirAtivo, acaoEditarProjeto, acaoLinkLeitura } from "./acoes";

export function NovoProjeto() {
  const t = useTranslations("Projetos");
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState(false);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        iniciar(async () => {
          const r = await acaoCriarProjeto(nome, descricao, true);
          if (r.ok && r.dados) router.push(`/projetos/${r.dados}`);
          else setErro(true);
        });
      }}
      className="max-w-xl space-y-3 rounded-xl border border-cc-line bg-cc-surface p-5"
    >
      <p className="font-display text-xl">{t("novoTitulo")}</p>
      <label className="block">
        <span className="label-caps mb-1.5 block text-muted-foreground">{t("nome")}</span>
        <Input required maxLength={120} value={nome} onChange={(e) => setNome(e.target.value)} placeholder={t("nomeExemplo")} className="h-11" />
      </label>
      <label className="block">
        <span className="label-caps mb-1.5 block text-muted-foreground">{t("descricao")}</span>
        <Textarea maxLength={4000} value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} />
      </label>
      <p className="text-xs text-muted-foreground">{t("novoAtivo")}</p>
      <Button type="submit" disabled={pendente || !nome.trim()}>
        <Plus aria-hidden /> {t("criar")}
      </Button>
      {erro && <p role="alert" className="text-sm text-cc-orange">{t("erro")}</p>}
    </form>
  );
}

export function CabecalhoEditavel({ id, nome, descricao }: { id: number; nome: string; descricao: string }) {
  const t = useTranslations("Projetos");
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [n, setN] = useState(nome);
  const [d, setD] = useState(descricao);
  const [pendente, iniciar] = useTransition();
  if (!editando)
    return (
      <div>
        <h1 className="font-display text-[clamp(2.25rem,7vw,5rem)] leading-[0.95] [overflow-wrap:anywhere]">{nome}</h1>
        {descricao && <p className="prosa mt-5 max-w-prose text-lg whitespace-pre-line">{descricao}</p>}
        <Button variant="ghost" size="sm" className="mt-3 text-muted-foreground" onClick={() => setEditando(true)}>
          <Pencil aria-hidden /> {t("editar")}
        </Button>
      </div>
    );
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        iniciar(async () => {
          const r = await acaoEditarProjeto(id, n, d);
          if (r.ok) {
            setEditando(false);
            router.refresh();
          }
        });
      }}
      className="max-w-2xl space-y-3"
    >
      <Input required maxLength={120} value={n} onChange={(e) => setN(e.target.value)} className="h-12 font-display text-2xl" aria-label={t("nome")} />
      <Textarea maxLength={4000} value={d} onChange={(e) => setD(e.target.value)} rows={4} aria-label={t("descricao")} />
      <div className="flex gap-2">
        <Button type="submit" disabled={pendente || !n.trim()}>
          <Check aria-hidden /> {t("salvar")}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setEditando(false)}>
          {t("cancelar")}
        </Button>
      </div>
    </form>
  );
}

export function BarraProjeto({
  id,
  ativo,
  token,
  origem,
  itens,
  nomeArquivo,
}: {
  id: number;
  ativo: boolean;
  token: string | null;
  origem: string;
  itens: { modulo: string; id: number }[];
  nomeArquivo: string;
}) {
  const t = useTranslations("Projetos");
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [confirmarApagar, setConfirmarApagar] = useState(false);
  const [baixando, setBaixando] = useState(false);
  const linkLeitura = token ? `${origem}/p/${token}` : null;

  const rodar = (fn: () => Promise<unknown>, depois?: () => void) =>
    iniciar(async () => {
      await fn();
      if (depois) depois();
      else router.refresh();
    });

  async function exportar() {
    setBaixando(true);
    try {
      const r = await fetch("/api/sessao/xlsx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itens }),
      });
      if (!r.ok) return;
      const blob = await r.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = nomeArquivo;
      a.click();
      URL.revokeObjectURL(a.href);
    } finally {
      setBaixando(false);
    }
  }

  return (
    <div className="mt-8 space-y-4">
      <div className="flex flex-wrap gap-2">
        {ativo ? (
          <span className="label-caps inline-flex items-center gap-1.5 rounded-md border border-cc-green px-3 py-2 text-cc-green">
            <Star aria-hidden className="size-3.5 fill-current" /> {t("ativo")}
          </span>
        ) : (
          <Button variant="outline" disabled={pendente} onClick={() => rodar(() => acaoDefinirAtivo(id))}>
            <Star aria-hidden /> {t("tornarAtivo")}
          </Button>
        )}
        <Button variant="outline" disabled={baixando || !itens.length} onClick={exportar}>
          <Download aria-hidden /> {t("exportar")}
        </Button>
        {token ? (
          <Button variant="outline" disabled={pendente} onClick={() => rodar(() => acaoLinkLeitura(id, false))}>
            <Link2Off aria-hidden /> {t("desligarLink")}
          </Button>
        ) : (
          <Button variant="outline" disabled={pendente} onClick={() => rodar(() => acaoLinkLeitura(id, true))}>
            <Link2 aria-hidden /> {t("gerarLink")}
          </Button>
        )}
        <Button variant="ghost" className="text-muted-foreground hover:text-cc-orange" onClick={() => setConfirmarApagar(true)}>
          <Trash2 aria-hidden /> {t("apagar")}
        </Button>
      </div>

      {!token && <p className="text-xs text-muted-foreground">{t("linkAviso")}</p>}
      {linkLeitura && (
        <div className="flex max-w-2xl flex-wrap items-center gap-2 rounded-lg border border-cc-line bg-cc-surface px-3 py-2 text-sm">
          <span className="text-muted-foreground">{t("linkLeitura")}</span>
          <code className="min-w-0 flex-1 truncate">{linkLeitura}</code>
          <BotaoCopiar texto={linkLeitura} rotulo={t("copiarLink")} rotuloCopiado={t("copiado")} />
          <span className="basis-full text-xs text-muted-foreground">{t("linkAviso")}</span>
        </div>
      )}

      {confirmarApagar && (
        <div className="flex max-w-xl flex-wrap items-center gap-3 rounded-lg border border-cc-orange p-4 text-sm">
          <span>{t("apagarConfirmacao")}</span>
          <Button variant="cta" size="sm" disabled={pendente} onClick={() => rodar(() => acaoApagarProjeto(id), () => router.push("/projetos"))}>
            {t("apagar")}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setConfirmarApagar(false)}>
            {t("cancelar")}
          </Button>
        </div>
      )}
    </div>
  );
}
