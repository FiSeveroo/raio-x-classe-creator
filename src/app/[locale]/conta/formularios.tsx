"use client";

import { KeyRound, LogOut, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter } from "@/i18n/navigation";
import { apagarMinhaConta, mudarSenha, sair, type ResConta } from "./acoes";

function Mensagem({ r, okTexto }: { r: ResConta | null; okTexto: string }) {
  const t = useTranslations("Conta");
  if (!r) return null;
  return r.ok ? (
    <p className="text-sm text-cc-green">{okTexto}</p>
  ) : (
    <p role="alert" className="text-sm text-cc-orange">
      {t.has(`erros.${r.codigo}`) ? t(`erros.${r.codigo}`) : t("erros.falha")}
    </p>
  );
}

export function BotaoSair() {
  const t = useTranslations("Conta");
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={pendente}
      onClick={() =>
        iniciar(async () => {
          await sair();
          router.push("/");
          router.refresh();
        })
      }
    >
      <LogOut aria-hidden /> {t("sair")}
    </Button>
  );
}

export function FormularioSenha({ destacar }: { destacar: boolean }) {
  const t = useTranslations("Conta");
  const [senha, setSenha] = useState("");
  const [r, setR] = useState<ResConta | null>(null);
  const [pendente, iniciar] = useTransition();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        iniciar(async () => {
          const res = await mudarSenha(senha);
          setR(res);
          if (res.ok) setSenha("");
        });
      }}
      className={destacar ? "space-y-3 rounded-lg border border-cc-green p-4" : "space-y-3"}
    >
      {destacar && <p className="text-sm">{t("senhaRecuperacao")}</p>}
      <label className="block max-w-sm">
        <span className="label-caps mb-1.5 block text-muted-foreground">{t("novaSenha")}</span>
        <Input type="password" minLength={10} required autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} className="h-11" autoFocus={destacar} />
        <span className="mt-1 block text-xs text-muted-foreground">{t("senhaRegra")}</span>
      </label>
      <Button type="submit" disabled={pendente || senha.length < 10}>
        <KeyRound aria-hidden /> {t("salvarSenha")}
      </Button>
      <Mensagem r={r} okTexto={t("senhaSalva")} />
    </form>
  );
}

export function ApagarConta() {
  const t = useTranslations("Conta");
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const [r, setR] = useState<ResConta | null>(null);
  const [pendente, iniciar] = useTransition();
  if (!aberto)
    return (
      <Button variant="outline" onClick={() => setAberto(true)} className="border-cc-orange text-cc-orange hover:bg-cc-orange/10">
        <Trash2 aria-hidden /> {t("apagarConta")}
      </Button>
    );
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        iniciar(async () => {
          const res = await apagarMinhaConta(texto);
          setR(res);
          if (res.ok) {
            router.push("/");
            router.refresh();
          }
        });
      }}
      className="max-w-md space-y-3 rounded-lg border border-cc-orange p-4"
    >
      <p className="text-sm">{t("apagarExplicacao")}</p>
      <label className="block">
        <span className="mb-1.5 block text-sm text-muted-foreground">{t("apagarDigite")}</span>
        <Input value={texto} onChange={(e) => setTexto(e.target.value)} className="h-11" autoComplete="off" />
      </label>
      <div className="flex gap-2">
        <Button type="submit" variant="cta" disabled={pendente}>
          <Trash2 aria-hidden /> {t("apagarConfirmar")}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setAberto(false)}>
          {t("cancelar")}
        </Button>
      </div>
      <Mensagem r={r} okTexto="" />
    </form>
  );
}
