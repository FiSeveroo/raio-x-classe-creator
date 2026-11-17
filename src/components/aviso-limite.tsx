"use client";

import { MessageCircle, UserPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Link } from "@/i18n/navigation";

/*
 * Aviso de limite (decisão do Filipe em 17/nov/2026): a partir de 80% do
 * limite usado, aparece ao lado do contador e, uma vez por dia, como pop-up.
 * Sem conta: convida a criar conta (limite dobra). Com conta: WhatsApp do
 * Observatório para pedir limite maior — o número só aparece para quem tem conta.
 */

const CHAVE_DIA = "raiox_aviso_limite";

export function precisaAviso(limite: number, restantes: number) {
  return limite > 0 && restantes <= limite * 0.2;
}

function linkWhatsapp(numero: string, mensagem: string) {
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;
}

function Conteudo({ whatsapp, email, modulo }: { whatsapp?: string | null; email?: string | null; modulo: string }) {
  const comConta = Boolean(whatsapp);
  const t = useTranslations("Limite");
  return (
    <>
      <p className="text-sm leading-relaxed">{t("coletivo")}</p>
      <p className="text-sm leading-relaxed">{comConta ? t("comConta") : t("semConta")}</p>
      {comConta ? (
        <Button asChild variant="cta" className="mt-1 w-fit">
          <a href={linkWhatsapp(whatsapp!, t("mensagemWhatsapp", { email: email ?? "", modulo }))} target="_blank" rel="noopener noreferrer">
            <MessageCircle aria-hidden /> {t("botaoWhatsapp")}
          </a>
        </Button>
      ) : (
        <Button asChild variant="cta" className="mt-1 w-fit">
          <Link href="/entrar?criar=1">
            <UserPlus aria-hidden /> {t("botaoCriarConta")}
          </Link>
        </Button>
      )}
    </>
  );
}

export function AvisoLimite({
  limite,
  restantes,
  whatsapp,
  email,
  modulo,
}: {
  limite: number;
  restantes: number;
  /** Só vem preenchido para quem tem conta (o servidor decide). */
  whatsapp?: string | null;
  email?: string | null;
  /** Nome do módulo, já traduzido (vai na mensagem do WhatsApp). */
  modulo: string;
}) {
  const t = useTranslations("Limite");
  const mostrar = precisaAviso(limite, restantes);
  const [aberto, setAberto] = useState(false);

  // Pop-up uma vez por dia (navegador; sem servidor, sem dado pessoal).
  useEffect(() => {
    if (!mostrar) return;
    const hoje = new Date().toISOString().slice(0, 10);
    try {
      if (localStorage.getItem(CHAVE_DIA) === hoje) return;
    } catch {
      return;
    }
    // Marca "mostrado hoje" só quando abre de fato (o efeito pode rodar 2x).
    const id = setTimeout(() => {
      try {
        localStorage.setItem(CHAVE_DIA, hoje);
      } catch {
        // sem armazenamento: abre mesmo assim
      }
      setAberto(true);
    }, 0);
    return () => clearTimeout(id);
  }, [mostrar]);

  if (!mostrar) return null;

  return (
    <>
      <aside className="mb-4 space-y-3 rounded-lg border-l-2 border-cc-orange bg-cc-surface px-4 py-4">
        <p className="font-display text-lg text-cc-orange">{t("titulo")}</p>
        <Conteudo whatsapp={whatsapp} email={email} modulo={modulo} />
      </aside>
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent closeLabel={t("fechar")} className="border border-cc-line bg-cc-surface">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-cc-orange">{t("titulo")}</DialogTitle>
            <DialogDescription className="sr-only">{t("coletivo")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Conteudo whatsapp={whatsapp} email={email} modulo={modulo} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
