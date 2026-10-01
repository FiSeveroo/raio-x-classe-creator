import "server-only";
import { youtubeGet, type ItemVideoApi } from "@/lib/youtube";
import type { CanalApi } from "./sintomas";

/*
 * YouTube no Dossiê — porte de app.py (extrair_canal_id, resolver_canal_id,
 * resolver_canal_via_busca, buscar_uploads_recentes, buscar_canais_relacionados).
 * Mesmos endpoints, parâmetros e timeouts.
 */

export type IdentificadorCanal = ["id" | "handle" | "username" | "custom", string];

/** app.py: extrair_canal_id — mesma ordem de tentativas. */
export function extrairCanalId(entrada: string): IdentificadorCanal | null {
  const s = entrada.trim();
  if (/^UC[A-Za-z0-9_-]{22}$/.test(s)) return ["id", s];
  if (s.startsWith("@")) return ["handle", s.slice(1)];
  let m = s.match(/youtube\.com\/channel\/(UC[A-Za-z0-9_-]{22})/);
  if (m) return ["id", m[1]];
  m = s.match(/youtube\.com\/@([A-Za-z0-9._-]+)/);
  if (m) return ["handle", m[1]];
  m = s.match(/youtube\.com\/c\/([A-Za-z0-9._-]+)/);
  if (m) return ["custom", m[1]];
  m = s.match(/youtube\.com\/user\/([A-Za-z0-9._-]+)/);
  if (m) return ["username", m[1]];
  return null;
}

type ItemCanalCompleto = CanalApi & {
  contentDetails?: { relatedPlaylists?: { uploads?: string } };
};

/** app.py: resolver_canal_id — identificador → metadados completos do canal. */
export async function resolverCanalId([tipo, valor]: IdentificadorCanal): Promise<ItemCanalCompleto | null> {
  const part = "snippet,statistics,contentDetails";
  let params: Record<string, string>;
  if (tipo === "id") params = { id: valor, part };
  else if (tipo === "handle") params = { forHandle: `@${valor}`, part };
  else if (tipo === "username") params = { forUsername: valor, part };
  else return resolverCanalViaBusca(valor);

  const data = await youtubeGet<{ items?: ItemCanalCompleto[] }>("channels", params, 15_000);
  return data.items?.[0] ?? null;
}

/** app.py: resolver_canal_via_busca — custom URL antiga: busca pelo nome, pega o 1º canal. */
async function resolverCanalViaBusca(termo: string): Promise<ItemCanalCompleto | null> {
  const data = await youtubeGet<{ items?: { snippet: { channelId: string } }[] }>(
    "search",
    { q: termo, type: "channel", part: "snippet", maxResults: 1 },
    15_000,
  );
  const canalId = data.items?.[0]?.snippet.channelId;
  return canalId ? resolverCanalId(["id", canalId]) : null;
}

/** app.py: buscar_uploads_recentes — N vídeos mais recentes via playlist de uploads. */
export async function buscarUploadsRecentes(canalId: string, maxVideos = 50): Promise<ItemVideoApi[]> {
  const canais = await youtubeGet<{ items?: ItemCanalCompleto[] }>(
    "channels",
    { id: canalId, part: "contentDetails" },
    15_000,
  );
  const uploads = canais.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploads) return [];

  const lista = await youtubeGet<{ items?: { contentDetails: { videoId: string } }[] }>(
    "playlistItems",
    { playlistId: uploads, part: "contentDetails", maxResults: Math.min(maxVideos, 50) },
    15_000,
  );
  const ids = (lista.items ?? []).map((it) => it.contentDetails.videoId);
  if (!ids.length) return [];

  // part=player + maxWidth para detectar Shorts via aspecto do embed
  const videos = await youtubeGet<{ items?: ItemVideoApi[] }>(
    "videos",
    { id: ids.join(","), part: "snippet,statistics,contentDetails,player", maxWidth: 1920 },
    20_000,
  );
  return videos.items ?? [];
}

export type CanalRelacionado = CanalApi & { snippet: { title: string } };

/**
 * app.py: buscar_canais_relacionados — canais da seção "Canais" do perfil
 * (channelSections). Falha silenciosa: não é dado essencial.
 */
export async function buscarCanaisRelacionados(canalId: string): Promise<CanalRelacionado[]> {
  try {
    type Secao = { snippet?: { type?: string }; contentDetails?: { channels?: string[] } };
    const secoes = await youtubeGet<{ items?: Secao[] }>(
      "channelSections",
      { channelId: canalId, part: "snippet,contentDetails" },
      15_000,
    );
    const ids: string[] = [];
    for (const sec of secoes.items ?? []) {
      const tipo = sec.snippet?.type ?? "";
      if (tipo === "singleChannel" || tipo === "multipleChannels") ids.push(...(sec.contentDetails?.channels ?? []));
    }
    if (!ids.length) return [];
    const canais = await youtubeGet<{ items?: CanalRelacionado[] }>(
      "channels",
      { id: ids.slice(0, 50).join(","), part: "snippet,statistics" },
      15_000,
    );
    return canais.items ?? [];
  } catch {
    return [];
  }
}
