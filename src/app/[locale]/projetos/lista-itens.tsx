"use client";

import { ArrowRightLeft, Copy, RefreshCw, Trash2 } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { acaoMoverOuCopiar, acaoNota, acaoRemoverItem, acaoTrocarVersao } from "./acoes";

export type ItemTela = {
  id: number;
  modulo: "lupa" | "dossie" | "disputa" | "voz";
  analiseId: number;
  nota: string;
  rotulo: string;
  data: string | null;
  versao: number | null;
  versaoMaisNovaId: number | null;
  eixoA: string | null;
  eixoB: string | null;
  canal: string | null;
  href: string;
};

function Nota({ item, editavel }: { item: ItemTela; editavel: boolean }) {
  const t = useTranslations("Projetos");
  const [texto, setTexto] = useState(item.nota);
  const [salvo, setSalvo] = useState(item.nota);
  const [pendente, iniciar] = useTransition();
  if (!editavel) return item.nota ? <p className="mt-3 border-l-2 border-cc-purple-text pl-3 text-sm whitespace-pre-line">{item.nota}</p> : null;
  return (
    <label className="mt-3 block">
      <span className="sr-only">{t("nota")}</span>
      <Textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={() => {
          if (texto === salvo) return;
          iniciar(async () => {
            const r = await acaoNota(item.id, texto);
            if (r.ok) setSalvo(texto);
          });
        }}
        placeholder={t("notaPlaceholder")}
        maxLength={4000}
        rows={texto ? 3 : 1}
        className="min-h-9 text-sm"
      />
      <span className="mt-1 block h-4 text-xs text-muted-foreground" aria-live="polite">
        {pendente ? t("salvando") : texto !== salvo ? t("naoSalvo") : ""}
      </span>
    </label>
  );
}

function Acoes({ item, outros }: { item: ItemTela; outros: { id: number; nome: string }[] }) {
  const t = useTranslations("Projetos");
  const router = useRouter();
  const [destino, setDestino] = useState<string>("");
  const [pendente, iniciar] = useTransition();
  const rodar = (fn: () => Promise<{ ok: boolean }>) =>
    iniciar(async () => {
      await fn();
      router.refresh();
    });
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {outros.length > 0 && (
        <>
          <label>
            <span className="sr-only">{t("destino")}</span>
            <select
              value={destino}
              onChange={(e) => setDestino(e.target.value)}
              className="h-8 rounded-md border border-input bg-input/30 px-2 text-xs text-foreground"
            >
              <option value="">{t("outroProjeto")}</option>
              {outros.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </label>
          <Button size="sm" variant="outline" disabled={!destino || pendente} onClick={() => rodar(() => acaoMoverOuCopiar(item.id, Number(destino), false))}>
            <ArrowRightLeft aria-hidden /> {t("mover")}
          </Button>
          <Button size="sm" variant="outline" disabled={!destino || pendente} onClick={() => rodar(() => acaoMoverOuCopiar(item.id, Number(destino), true))}>
            <Copy aria-hidden /> {t("copiar")}
          </Button>
        </>
      )}
      <Button size="sm" variant="ghost" disabled={pendente} onClick={() => rodar(() => acaoRemoverItem(item.id))} className="text-muted-foreground hover:text-cc-orange">
        <Trash2 aria-hidden /> {t("remover")}
      </Button>
    </div>
  );
}

export function ListaItens({
  itens,
  editavel,
  outrosProjetos,
}: {
  itens: ItemTela[];
  editavel: boolean;
  projetoId: number;
  outrosProjetos: { id: number; nome: string }[];
}) {
  const t = useTranslations("Projetos");
  const tm = useTranslations("Modulos");
  const format = useFormatter();
  const router = useRouter();
  const [modulo, setModulo] = useState<string>("");
  const [busca, setBusca] = useState("");
  const [pendente, iniciar] = useTransition();

  const q = busca.trim().toLowerCase();
  const filtrados = itens.filter(
    (i) => (!modulo || i.modulo === modulo) && (!q || `${i.rotulo} ${i.canal ?? ""} ${i.nota}`.toLowerCase().includes(q)),
  );
  const presentes = [...new Set(itens.map((i) => i.modulo))];

  return (
    <div>
      <div className="mb-5 grid gap-3 sm:grid-cols-[1fr_16rem]">
        <label>
          <span className="sr-only">{t("buscar")}</span>
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={t("buscar")} className="h-10" />
        </label>
        <label>
          <span className="sr-only">{t("filtroModulo")}</span>
          <select
            value={modulo}
            onChange={(e) => setModulo(e.target.value)}
            className="h-10 w-full rounded-lg border border-input bg-input/30 px-3 text-sm text-foreground"
          >
            <option value="">{t("todosModulos")}</option>
            {presentes.map((m) => (
              <option key={m} value={m}>
                {tm(`${m}.nome`)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <ol className="space-y-3">
        {filtrados.map((i) => (
          <li key={i.id} className="rounded-lg border border-cc-line bg-cc-surface px-4 py-4">
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className={cn("label-caps rounded-sm px-1.5 py-0.5 text-[0.65rem] text-foreground", i.modulo === "voz" || i.modulo === "disputa" ? "bg-cc-purple/50" : "bg-cc-green/20")}>
                {tm(`${i.modulo}.nome`)}
              </span>
              {i.data && <span>{format.dateTime(new Date(i.data), { dateStyle: "medium" })}</span>}
              {i.versao && <span>v{i.versao}</span>}
              {i.canal && <span className="truncate">{i.canal}</span>}
            </p>
            <Link href={i.href} className="mt-1.5 block font-medium [overflow-wrap:anywhere] hover:text-cc-green hover:underline">
              {i.rotulo}
            </Link>
            {(i.eixoA || i.eixoB) && (
              <p className="mt-1 text-xs text-muted-foreground">
                {i.eixoA} · {i.eixoB}
              </p>
            )}
            {i.versaoMaisNovaId && (
              <div className="mt-3 flex flex-wrap items-center gap-3 rounded-md border-l-2 border-cc-orange bg-cc-bg px-3 py-2 text-sm">
                <span>{t("versaoNova")}</span>
                <Link href={`${i.href.replace(/\d+$/, "")}${i.versaoMaisNovaId}`} className="text-cc-green underline-offset-4 hover:underline">
                  {t("verVersaoNova")}
                </Link>
                {editavel && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pendente}
                    onClick={() =>
                      iniciar(async () => {
                        await acaoTrocarVersao(i.id, i.versaoMaisNovaId!);
                        router.refresh();
                      })
                    }
                  >
                    <RefreshCw aria-hidden /> {t("atualizarVersao")}
                  </Button>
                )}
              </div>
            )}
            <Nota item={i} editavel={editavel} />
            {editavel && <Acoes item={i} outros={outrosProjetos} />}
          </li>
        ))}
      </ol>
      {filtrados.length === 0 && <p className="text-sm text-muted-foreground">{t("nadaEncontrado")}</p>}
    </div>
  );
}
