import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Contêiner padrão: mesma largura do cabeçalho, respiro lateral no mobile. */
export function Pagina({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("mx-auto w-full max-w-7xl px-4 pt-12 pb-24 sm:px-8 lg:pt-20", className)}>
      {children}
    </div>
  );
}

/** Seção principal: número em rótulo técnico + título verde (diretriz Classe Creator). */
export function Secao({
  numero,
  titulo,
  id,
  children,
  className,
}: {
  numero?: string;
  titulo: string;
  id?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      aria-labelledby={id ? `${id}-titulo` : undefined}
      className={cn("mt-24 scroll-mt-24 sm:mt-32", className)}
    >
      <div className="mb-10 flex items-baseline gap-4 border-b border-border pb-4">
        {numero && <span className="font-mono text-sm text-muted-foreground tabular-nums">{numero}</span>}
        <h2
          id={id ? `${id}-titulo` : undefined}
          className="text-3xl leading-none font-black uppercase text-verde sm:text-5xl"
        >
          {titulo}
        </h2>
      </div>
      {children}
    </section>
  );
}

/** Aviso. "importante" usa o laranja (diretriz: avisos importantes). */
export function Aviso({
  children,
  tom = "neutro",
}: {
  children: ReactNode;
  tom?: "neutro" | "importante" | "erro";
}) {
  return (
    <div
      role={tom === "neutro" ? "status" : "alert"}
      className={cn(
        "border-l-2 bg-superficie px-4 py-3 text-sm",
        tom === "neutro" && "border-muted-foreground/40 text-muted-foreground",
        tom === "importante" && "border-laranja text-foreground",
        tom === "erro" && "border-destructive text-foreground",
      )}
    >
      {children}
    </div>
  );
}

/** Botões-link da identidade: verde (padrão), laranja (CTA de impacto), contorno. */
export const estiloBotao = {
  base: "inline-flex items-center justify-center gap-2 px-5 py-3 font-mono text-xs font-bold uppercase tracking-[0.14em] transition-[opacity,background-color,color] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
  verde: "bg-verde text-background hover:opacity-85",
  laranja: "bg-laranja text-background hover:opacity-85",
  contorno: "border border-foreground/30 text-foreground hover:border-verde hover:text-verde",
};
