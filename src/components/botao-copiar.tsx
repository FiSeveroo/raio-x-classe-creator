"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

export function BotaoCopiar({
  texto,
  rotulo,
  rotuloCopiado,
}: {
  texto: string;
  rotulo: string;
  rotuloCopiado: string;
}) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Sem permissão de clipboard: o texto continua visível para seleção manual.
    }
  }

  return (
    <button
      type="button"
      onClick={copiar}
      className="inline-flex items-center gap-1.5 rounded px-2 py-1 font-mono text-xs uppercase tracking-wider text-muted-foreground transition-colors hover:bg-superficie-2 hover:text-foreground"
    >
      {copiado ? <Check className="size-3.5 text-verde" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
      <span aria-live="polite">{copiado ? rotuloCopiado : rotulo}</span>
    </button>
  );
}
