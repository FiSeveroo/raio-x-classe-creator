import "server-only";

/*
 * Base da YouTube Data API v3, compartilhada pelos módulos — porte de
 * app.py (duracao_iso_para_segundos, _detectar_short e o padrão requests.get).
 */

const API = "https://www.googleapis.com/youtube/v3";

/** Erro previsto de um módulo, com código para a mensagem traduzida na interface. */
export class ErroPrevisto extends Error {
  constructor(
    public codigo: string,
    mensagem: string,
  ) {
    super(mensagem);
  }
}

function chave(): string {
  const k = process.env.YOUTUBE_API_KEY;
  if (!k) throw new Error("YOUTUBE_API_KEY não configurada.");
  return k;
}

/** GET na API (equivalente a requests.get + raise_for_status). timeoutMs = timeout do Python. */
export async function youtubeGet<T = Record<string, unknown>>(
  caminho: string,
  params: Record<string, string | number>,
  timeoutMs = 10_000,
): Promise<T> {
  const url = new URL(`${API}/${caminho}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  url.searchParams.set("key", chave());
  const resp = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), cache: "no-store" });
  if (!resp.ok) {
    let detalhe = "";
    try {
      detalhe = ((await resp.json()) as { error?: { message?: string } }).error?.message ?? "";
    } catch {
      // corpo não-JSON
    }
    throw new Error(`YouTube API respondeu ${resp.status}${detalhe ? `: ${detalhe}` : ""}`);
  }
  return resp.json() as Promise<T>;
}

export { detectarShort, duracaoIsoParaSegundos, type ItemVideoApi } from "./youtube-util.ts";
