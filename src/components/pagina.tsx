import type { ReactNode } from "react";
import { SectionTitle } from "@/components/brand/Brand";
import { cn } from "@/lib/utils";

/** Contêiner padrão: mesma largura do cabeçalho, respiro lateral no mobile. */
export function Pagina({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("mx-auto w-full max-w-7xl px-4 pt-12 pb-24 sm:px-8 lg:pt-20", className)}>
      {children}
    </div>
  );
}

/** Seção principal: `SectionTitle` da Escola (verde, Gunterz Black) com número como eyebrow. */
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
    <section id={id} className={cn("mt-20 scroll-mt-24 sm:mt-28", className)}>
      <SectionTitle eyebrow={numero} className="mb-8 border-b border-cc-line pb-4">
        {titulo}
      </SectionTitle>
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
        "rounded-lg border-l-2 bg-cc-surface px-4 py-3 text-sm",
        tom === "neutro" && "border-cc-line text-muted-foreground",
        tom !== "neutro" && "border-cc-orange text-foreground",
      )}
    >
      {children}
    </div>
  );
}
