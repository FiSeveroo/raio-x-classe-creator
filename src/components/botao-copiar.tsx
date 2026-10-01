"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

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
    <Button type="button" variant="ghost" size="sm" font="caps" onClick={copiar}>
      {copiado ? <Check aria-hidden className="text-cc-green" /> : <Copy aria-hidden />}
      <span aria-live="polite">{copiado ? rotuloCopiado : rotulo}</span>
    </Button>
  );
}
