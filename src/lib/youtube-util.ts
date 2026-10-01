/*
 * Funções puras sobre dados da YouTube Data API (sem rede, sem Next).
 * Importáveis pelos scripts de verificação. Porte de app.py.
 */

/** app.py: duracao_iso_para_segundos — ISO 8601 (PT1H30M45S) → segundos. */
export function duracaoIsoParaSegundos(duracaoIso: string | undefined | null): number {
  const m = (duracaoIso || "").match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  const [h, min, s] = m.slice(1).map((g) => (g ? Number(g) : 0));
  return h * 3600 + min * 60 + s;
}

/** Item de videos.list com os `part`s usados pelo Raio-X. */
export type ItemVideoApi = {
  id: string;
  snippet: {
    title: string;
    description?: string;
    tags?: string[];
    channelId: string;
    channelTitle: string;
    publishedAt: string;
    categoryId?: string;
  };
  statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
  contentDetails?: { duration?: string };
  player?: { embedWidth?: string | number; embedHeight?: string | number };
};

/**
 * app.py: _detectar_short. Regra validada: duração ≤ 180s + player vertical.
 * true = Short, false = longo, null = inconclusivo (sem dimensões).
 */
export function detectarShort(item: Pick<ItemVideoApi, "player">, duracaoSegundos: number): boolean | null {
  if (duracaoSegundos > 180) return false;
  const w = item.player?.embedWidth;
  const h = item.player?.embedHeight;
  if (w == null || h == null) return null;
  const nw = Number(w);
  const nh = Number(h);
  if (!Number.isFinite(nw) || !Number.isFinite(nh)) return null;
  return Math.trunc(nh) > Math.trunc(nw);
}
