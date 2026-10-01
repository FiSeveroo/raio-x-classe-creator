import "server-only";
import { youtubeGet } from "@/lib/youtube";
import type { DadosExtras, ItemBusca } from "./prompts";

/*
 * YouTube da Disputa — porte de buscar_no_youtube, enriquecer_metadados_video
 * e enriquecer_metadados_canais (app.py). Mesmos parâmetros e timeouts (15 s).
 */

/** search.list — 100 unidades de cota. Vídeos, canais e playlists por relevância. */
export async function buscarNoYoutube(termo: string, maxResultados = 50): Promise<ItemBusca[]> {
  const r = await youtubeGet<{ items?: ItemBusca[] }>(
    "search",
    {
      q: termo,
      part: "snippet",
      type: "video,channel,playlist",
      regionCode: "BR",
      relevanceLanguage: "pt",
      maxResults: maxResultados,
    },
    15_000,
  );
  return r.items ?? [];
}

type ItemComId = { id: string } & NonNullable<DadosExtras["video"]> & Record<string, unknown>;

async function porId(caminho: string, ids: string[], part: string, extra: Record<string, string | number> = {}) {
  if (!ids.length) return {} as Record<string, ItemComId>;
  const r = await youtubeGet<{ items?: ItemComId[] }>(caminho, { id: ids.slice(0, 50).join(","), part, ...extra }, 15_000);
  return Object.fromEntries((r.items ?? []).map((i) => [i.id, i]));
}

/** videos.list — estatísticas e duração (1 unidade por lote de 50). */
export const enriquecerVideos = (ids: string[]) =>
  porId("videos", ids, "snippet,statistics,contentDetails,player", { maxWidth: 1920 });

/** channels.list — descrição e contagens (1 unidade por lote de 50). */
export const enriquecerCanais = (ids: string[]) => porId("channels", ids, "snippet,statistics");
