import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Contêiner padrão de página: largura de leitura, respiro lateral no mobile. */
export function Pagina({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("mx-auto w-full max-w-5xl px-4 pt-10 pb-20 sm:px-8 lg:pt-14", className)}>
      {children}
    </div>
  );
}

/** Seção numerada — "01 / O QUE ESTA FERRAMENTA FAZ". */
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
      className={cn("border-t border-border pt-10 mt-14 scroll-mt-20", className)}
    >
      {numero && <p className="rotulo mb-3 text-verde">{numero}</p>}
      <h2
        id={id ? `${id}-titulo` : undefined}
        className="mb-6 text-2xl font-bold uppercase sm:text-3xl"
      >
        {titulo}
      </h2>
      {children}
    </section>
  );
}

/** Aviso discreto (informativo, sem alarme). */
export function Aviso({ children, tom = "neutro" }: { children: ReactNode; tom?: "neutro" | "erro" }) {
  return (
    <div
      role={tom === "erro" ? "alert" : "status"}
      className={cn(
        "rounded-md border-l-2 bg-superficie px-4 py-3 text-sm",
        tom === "erro" ? "border-destructive text-foreground" : "border-muted-foreground/40 text-muted-foreground",
      )}
    >
      {children}
    </div>
  );
}
