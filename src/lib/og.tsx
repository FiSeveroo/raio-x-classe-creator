import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { CORES_MARCA } from "./marca";

export const TAMANHO_OG = { width: 1200, height: 630 };

// ImageResponse não lê CSS: cores vêm do espelho central dos tokens da marca.
const COR = {
  fundo: CORES_MARCA.fundo,
  texto: CORES_MARCA.texto,
  suave: CORES_MARCA.suave,
  verde: CORES_MARCA.verde,
  roxo: CORES_MARCA.roxoTexto,
  chip: CORES_MARCA.superficie2,
};

let gunterz: Promise<Buffer> | undefined;
const fonteTitulo = () =>
  (gunterz ??= readFile(join(process.cwd(), "public/Gunterz-Black.otf")));

/**
 * Card de compartilhamento (Open Graph) na identidade Classe Creator.
 * `eixos` mostra a classificação dupla quando a página é uma análise.
 */
export async function cardOg({
  rotulo,
  titulo,
  subtitulo,
  eixos,
}: {
  rotulo: string;
  titulo: string;
  subtitulo?: string;
  eixos?: { produtor: string; conteudo: string };
}) {
  const tituloCurto = titulo.length > 110 ? `${titulo.slice(0, 109)}…` : titulo;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: COR.fundo,
          color: COR.texto,
          padding: "64px 72px",
          borderLeft: `16px solid ${COR.verde}`,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 24, letterSpacing: 6, color: COR.suave }}>{rotulo}</div>
          <div
            style={{
              marginTop: 28,
              fontSize: tituloCurto.length > 60 ? 52 : 68,
              lineHeight: 1.1,
              fontFamily: "Gunterz",
            }}
          >
            {tituloCurto}
          </div>
          {subtitulo && (
            <div style={{ marginTop: 20, fontSize: 28, color: COR.suave }}>{subtitulo}</div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          {eixos ? (
            <div style={{ display: "flex", gap: 16 }}>
              <div style={{ display: "flex", fontSize: 30, color: COR.verde, background: COR.chip, padding: "10px 20px" }}>
                {eixos.produtor}
              </div>
              <div style={{ display: "flex", fontSize: 30, color: COR.roxo, background: COR.chip, padding: "10px 20px" }}>
                {eixos.conteudo}
              </div>
            </div>
          ) : (
            <div style={{ display: "flex" }} />
          )}
          <div style={{ display: "flex", fontFamily: "Gunterz", fontSize: 44, color: COR.verde, letterSpacing: 4 }}>
            RAIO-X
          </div>
        </div>
      </div>
    ),
    {
      ...TAMANHO_OG,
      fonts: [{ name: "Gunterz", data: await fonteTitulo(), weight: 900, style: "normal" }],
    },
  );
}
