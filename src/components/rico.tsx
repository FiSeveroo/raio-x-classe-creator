import { Fragment, type ReactNode } from "react";

/*
 * Renderiza o subconjunto de markdown usado nos textos do site (e na planilha
 * de traduções): **negrito**, *itálico* e `código`. Nada de HTML cru — o texto
 * vira nós React, então não há risco de injeção.
 */
const PADRAO = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;

export function rico(texto: string): ReactNode {
  return texto.split(PADRAO).map((parte, i) => {
    if (parte.startsWith("**") && parte.endsWith("**")) {
      return <strong key={i}>{parte.slice(2, -2)}</strong>;
    }
    if (parte.startsWith("`") && parte.endsWith("`")) {
      return (
        <code key={i} className="rounded bg-superficie-2 px-1 py-0.5 font-mono text-[0.9em]">
          {parte.slice(1, -1)}
        </code>
      );
    }
    if (parte.startsWith("*") && parte.endsWith("*") && parte.length > 2) {
      return <em key={i}>{parte.slice(1, -1)}</em>;
    }
    return <Fragment key={i}>{parte}</Fragment>;
  });
}

/** Lista de parágrafos (array de strings nas mensagens) com markdown-lite. */
export function Paragrafos({
  textos,
  className,
}: {
  textos: string[];
  className?: string;
}) {
  return (
    <div className={className ?? "prosa"}>
      {textos.map((t, i) => (
        <p key={i}>{rico(t)}</p>
      ))}
    </div>
  );
}
