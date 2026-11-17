import type { Instrumentation } from "next";

/*
 * Erros não tratados do servidor (páginas, rotas, ações) vão para erros_app,
 * como as falhas dos módulos (src/lib/erros.ts). Só o caminho da página, sem
 * query string nem cabeçalhos (nada de IP ou cookie).
 */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { gravarErro } = await import("@/lib/erros");
  const mensagem = err instanceof Error ? (err.stack ?? err.message) : String(err);
  const digest = typeof err === "object" && err !== null && "digest" in err ? ` (digest ${String(err.digest)})` : "";
  await gravarErro({
    modulo: "servidor",
    codigo: context.routeType,
    mensagem: `${context.routePath}${digest}: ${mensagem}`,
    entrada: request.path.split("?")[0],
  });
};
