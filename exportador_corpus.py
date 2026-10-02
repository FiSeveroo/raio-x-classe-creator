"""
==============================================================================
RAIO-X CLASSE CREATOR — EXPORTADOR DE SNAPSHOT SEMANAL
==============================================================================

Script executado pelo GitHub Actions toda segunda-feira que:
  1. Conecta ao Supabase (chave publicável, só leitura)
  2. Exporta cada tabela do corpus para Parquet e CSV.gz em /export/
  3. Confere a contagem de cada tabela contra o banco (count=exact) e
     FALHA se não bater — o export nunca sai incompleto em silêncio
  4. Gera MANIFEST.md, manifest.json e SHA256SUMS

O workflow publica a pasta /export/ como um GitHub Release (tag
corpus-AAAA-MM-DD). Os arquivos não são mais commitados no repositório:
o corpus passou de 100 MB-limite do GitHub e cada commit inchava o histórico.

Corte consistente: no início, lê o maior id de cada tabela e exporta só
id <= esse máximo. Assim, se o coletor gravar durante o export, a contagem
conferida e as linhas exportadas continuam sendo o mesmo recorte.
==============================================================================
"""

import csv
import gzip
import hashlib
import io
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import pyarrow as pa
import pyarrow.parquet as pq
from supabase import create_client

FERRAMENTA_URL = "https://raiox.classecreator.com"
REPO_URL = "https://github.com/FiSeveroo/raio-x-classe-creator"
PAGE_SIZE = 1000  # teto do PostgREST no Supabase

# Esquema das tabelas (espelho do schema public, conferido no backup de
# 1/out/2026). Serve para tipar o Parquet e para exportar tabelas vazias com
# as colunas certas — a chave publicável não enxerga o esquema do banco.
TS = pa.timestamp("us", tz="UTC")
ESQUEMAS: dict[str, list[tuple[str, pa.DataType]]] = {
    "snapshots": [
        ("id", pa.int64()), ("data_coleta", TS), ("semana_ano", pa.int32()),
        ("dia_semana", pa.string()), ("horario_coleta", pa.string()),
        ("total_videos_coletados", pa.int32()), ("observacoes", pa.string()),
    ],
    "videos_snapshot": [
        ("id", pa.int64()), ("snapshot_id", pa.int64()), ("posicao_ranking", pa.int32()),
        ("video_id", pa.string()), ("titulo", pa.string()), ("canal_id", pa.string()),
        ("canal_nome", pa.string()), ("visualizacoes", pa.int64()), ("likes", pa.int64()),
        ("comentarios", pa.int64()), ("duracao_segundos", pa.int32()),
        ("tipo_produtor", pa.string()), ("tipo_conteudo", pa.string()),
        ("justificativa", pa.string()), ("classificado_com", pa.string()),
        ("data_publicacao", TS), ("categoria_coleta", pa.string()), ("is_short", pa.bool_()),
    ],
    "classificacoes_video": [
        ("id", pa.int64()), ("data_classificacao", TS), ("video_id", pa.string()),
        ("titulo", pa.string()), ("canal_id", pa.string()), ("canal_nome", pa.string()),
        ("tipo_produtor", pa.string()), ("tipo_conteudo", pa.string()),
        ("justificativa", pa.string()), ("metadados_json", pa.string()),
        ("versao_numero", pa.int32()), ("versao_anterior_id", pa.int64()),
        ("canonica", pa.bool_()), ("is_short", pa.bool_()),
    ],
    "dossies_canal": [
        ("id", pa.int64()), ("data_dossie", TS), ("canal_id", pa.string()),
        ("canal_nome", pa.string()), ("canal_descricao", pa.string()), ("inscritos", pa.int64()),
        ("total_videos_canal", pa.int32()), ("total_videos_analisados", pa.int32()),
        ("auto_classificacao", pa.string()), ("classificacao_sociologica", pa.string()),
        ("tipo_conteudo_predominante", pa.string()), ("sintomas_estruturais", pa.string()),
        ("rede_canais", pa.string()), ("composicao_videos", pa.string()),
        ("veredito_sonnet", pa.string()), ("versao_numero", pa.int32()),
        ("versao_anterior_id", pa.int64()), ("canonica", pa.bool_()),
    ],
    "buscas_narrativa": [
        ("id", pa.int64()), ("data_busca", TS), ("termo_buscado", pa.string()),
        ("tipo_resultado", pa.string()), ("total_analisados", pa.int32()),
        ("composicao_produtor", pa.string()), ("composicao_conteudo", pa.string()),
        ("versao_numero", pa.int32()), ("versao_anterior_id", pa.int64()), ("canonica", pa.bool_()),
    ],
    "resultados_busca": [
        ("id", pa.int64()), ("busca_id", pa.int64()), ("posicao_ranking", pa.int32()),
        ("tipo_item", pa.string()), ("item_id", pa.string()), ("titulo", pa.string()),
        ("canal_id", pa.string()), ("canal_nome", pa.string()), ("tipo_produtor", pa.string()),
        ("tipo_conteudo", pa.string()), ("justificativa", pa.string()),
        ("metadados_extras", pa.string()),
    ],
    "analises_comentarios": [
        ("id", pa.int64()), ("data_analise", TS), ("video_id", pa.string()),
        ("titulo_video", pa.string()), ("canal_id", pa.string()), ("canal_nome", pa.string()),
        ("total_analisados", pa.int32()), ("indice_pressao_produtiva", pa.float64()),
        ("distribuicao_dimensoes", pa.string()), ("sintese_qualitativa", pa.string()),
        ("contradicao_estrutural", pa.string()), ("comentarios_brutos", pa.string()),
        ("versao_numero", pa.int32()), ("versao_anterior_id", pa.int64()), ("canonica", pa.bool_()),
    ],
}

DESCRICOES = {
    "snapshots": "Cabeçalho das coletas do Termômetro (trending BR, 2x/dia)",
    "videos_snapshot": "Vídeos de cada coleta do Termômetro",
    "classificacoes_video": "Análises individuais de vídeos (Lupa)",
    "dossies_canal": "Investigações estruturais de canais (Dossiê)",
    "buscas_narrativa": "Cabeçalho de auditorias temáticas (Disputa)",
    "resultados_busca": "Resultados detalhados das auditorias temáticas",
    "analises_comentarios": "Análises qualitativas de comentários (Voz da Base)",
}


class ExportIncompleto(RuntimeError):
    pass


def conectar_supabase():
    """Conexão usando a chave publicável (leitura suficiente)."""
    url = os.environ.get("SUPABASE_URL")
    chave = os.environ.get("SUPABASE_PUBLISHABLE_KEY")
    if not url or not chave:
        raise RuntimeError("SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY são obrigatórias")
    return create_client(url, chave)


def _ts(valor):
    if valor is None:
        return None
    return datetime.fromisoformat(valor.replace("Z", "+00:00")).astimezone(timezone.utc)


def ler_tabela(cliente, tabela: str) -> tuple[list[dict], dict]:
    """
    Lê a tabela inteira, ordenada por id, até o maior id visto no início.
    Confere o total contra count=exact do mesmo recorte; levanta
    ExportIncompleto se não bater ou se houver id repetido.
    """
    colunas = [c for c, _ in ESQUEMAS[tabela]]
    print(f"Exportando {tabela}...")

    topo = cliente.table(tabela).select("id").order("id", desc=True).limit(1).execute().data
    if not topo:
        print("  (vazia)")
        return [], {"max_id": None, "n_esperado": 0}
    max_id = topo[0]["id"]

    n_esperado = (
        cliente.table(tabela).select("id", count="exact").lte("id", max_id).limit(1).execute().count
    )

    registros: list[dict] = []
    ultimo_id = None
    while True:
        consulta = cliente.table(tabela).select(",".join(colunas)).lte("id", max_id)
        if ultimo_id is not None:
            consulta = consulta.gt("id", ultimo_id)
        lote = consulta.order("id").limit(PAGE_SIZE).execute().data
        if not lote:
            break
        registros.extend(lote)
        ultimo_id = lote[-1]["id"]
        if len(lote) < PAGE_SIZE:
            break

    n_ids = len({r["id"] for r in registros})
    if len(registros) != n_esperado or n_ids != len(registros):
        raise ExportIncompleto(
            f"{tabela}: banco tem {n_esperado} linhas (id <= {max_id}), "
            f"export leu {len(registros)} ({n_ids} ids distintos)"
        )
    colunas_lidas = set(registros[0].keys())
    if colunas_lidas != set(colunas):
        raise ExportIncompleto(f"{tabela}: colunas diferentes do esquema esperado: {colunas_lidas ^ set(colunas)}")

    print(f"  ✓ {len(registros):,} linhas (id <= {max_id}), conferido com o banco")
    return registros, {"max_id": max_id, "n_esperado": n_esperado}


def gravar_parquet(tabela: str, registros: list[dict], destino: Path) -> None:
    esquema = pa.schema(ESQUEMAS[tabela])
    dados = {}
    for campo in esquema:
        valores = [r.get(campo.name) for r in registros]
        if campo.type == TS:
            valores = [_ts(v) for v in valores]
        dados[campo.name] = pa.array(valores, type=campo.type)
    pq.write_table(pa.table(dados, schema=esquema), destino, compression="zstd")

    # Relê o arquivo gravado: confere linhas, esquema e ids antes de publicar
    relido = pq.read_table(destino)
    if relido.num_rows != len(registros) or not relido.schema.equals(esquema):
        raise ExportIncompleto(f"{tabela}: Parquet relido não confere ({relido.num_rows} linhas)")
    if relido.column("id").to_pylist() != [r["id"] for r in registros]:
        raise ExportIncompleto(f"{tabela}: ids do Parquet relido não conferem")


def gravar_csv_gz(tabela: str, registros: list[dict], destino: Path) -> None:
    colunas = [c for c, _ in ESQUEMAS[tabela]]
    # mtime=0: o .gz sai idêntico byte a byte quando o conteúdo não muda
    with open(destino, "wb") as bruto, \
            gzip.GzipFile(filename="", fileobj=bruto, mode="wb", mtime=0) as gz, \
            io.TextIOWrapper(gz, encoding="utf-8", newline="") as texto:
        writer = csv.DictWriter(texto, fieldnames=colunas)
        writer.writeheader()
        for r in registros:
            writer.writerow({k: (json.dumps(v, ensure_ascii=False) if isinstance(v, (dict, list)) else v)
                             for k, v in r.items()})


def _milhar(n: int) -> str:
    return f"{n:,}".replace(",", ".")


def sha256(caminho: Path) -> str:
    h = hashlib.sha256()
    with open(caminho, "rb") as f:
        for bloco in iter(lambda: f.read(1 << 20), b""):
            h.update(bloco)
    return h.hexdigest()


def gerar_manifesto(metadados: list[dict], arquivos: list[Path], output_dir: Path, agora: datetime) -> None:
    """Gera MANIFEST.md (humano), manifest.json (máquina) e SHA256SUMS."""
    tag = os.environ.get("TAG_RELEASE", "")
    total = sum(m["n_registros"] for m in metadados)
    hashes = {p.name: sha256(p) for p in arquivos}

    (output_dir / "SHA256SUMS").write_text(
        "".join(f"{h}  {nome}\n" for nome, h in sorted(hashes.items())), encoding="utf-8", newline="\n"
    )
    (output_dir / "manifest.json").write_text(json.dumps({
        "gerado_em": agora.isoformat(),
        "tag": tag or None,
        "ferramenta": FERRAMENTA_URL,
        "total_registros": total,
        "tabelas": [
            {
                "tabela": m["tabela"],
                "n_registros": m["n_registros"],
                "max_id": m["max_id"],
                "contagem_conferida": True,
                "colunas": [{"nome": c, "tipo": str(t)} for c, t in ESQUEMAS[m["tabela"]]],
                "arquivos": {p: hashes[p] for p in (f"{m['tabela']}.parquet", f"{m['tabela']}.csv.gz")},
            }
            for m in metadados
        ],
    }, ensure_ascii=False, indent=2), encoding="utf-8", newline="\n")

    linhas = "".join(
        f"| `{m['tabela']}` | {_milhar(m['n_registros'])} | {m['max_id'] if m['max_id'] is not None else '—'} "
        f"| {DESCRICOES[m['tabela']]} |\n"
        for m in metadados
    )
    link_tag = f"{REPO_URL}/releases/tag/{tag}" if tag else f"{REPO_URL}/releases"
    conteudo = f"""# Corpus público do Raio-X Classe Creator

**Export de {agora.strftime('%d/%m/%Y às %H:%M UTC')}** · {link_tag}

Todas as tabelas públicas do corpus, **completas**. Antes de publicar, a
contagem de cada tabela foi conferida contra o banco (`count=exact`), no
recorte `id <= max_id` lido no início do export. Se não batesse, o export
falharia e nada seria publicado.

**Total de registros:** {_milhar(total)}

| Tabela | Registros | max_id | Descrição |
|---|---:|---:|---|
{linhas}
## Arquivos

Cada tabela vem em dois formatos:

- `<tabela>.parquet`: tipado (datas em UTC, inteiros, booleanos), compressão zstd. **Recomendado.**
- `<tabela>.csv.gz`: CSV UTF-8, separador vírgula, compactado. Célula vazia = nulo.
  Datas em ISO 8601 (UTC).

Campos que guardam JSON (ex.: `metadados_json`, `sintomas_estruturais`,
`composicao_produtor`) são texto: decodifique com `json.loads`.

`manifest.json` traz contagens, esquema e hashes; `SHA256SUMS` permite conferir
a integridade (`sha256sum -c SHA256SUMS`).

```python
import pandas as pd
base = "{REPO_URL}/releases/latest/download/"
videos = pd.read_parquet(base + "videos_snapshot.parquet")
snapshots = pd.read_parquet(base + "snapshots.parquet")
```

```r
library(arrow)
videos <- read_parquet("videos_snapshot.parquet")
```

O link `/releases/latest/download/<arquivo>` sempre aponta para o export
mais recente. Para reprodutibilidade, cite o export específico pela tag
(`{tag or 'corpus-AAAA-MM-DD'}`): os releases antigos são mantidos.

## Limitações

- Os vídeos do Termômetro estão, em sua maioria, com `tipo_produtor` e
  `tipo_conteudo` = `nao_classificado`: a classificação automática do
  coletor está pausada. Composições pela tipologia devem usar só os vídeos
  classificados.
- Lupa, Dossiê, Disputa e Voz da Base foram zerados em 01/10/2026 (fim da
  fase de testes da migração). Exports anteriores a essa data estão no
  histórico do repositório (pasta `dados-publicos/`, descontinuada e
  truncada em 50 mil linhas de `videos_snapshot`).
- O Raio-X está em fase de coleta: leituras feitas sobre o corpus são
  preliminares.

## Sobre o Raio-X Classe Creator

Ferramenta de auditoria algorítmica e pesquisa acadêmica do trabalho
plataformizado no YouTube, desenvolvida pelo Observatório Classe Creator
com metodologia ancorada em SEVERO (2026).

- **Ferramenta:** {FERRAMENTA_URL}
- **Código:** {REPO_URL}
- **Tipologia dupla:** Eixo A (Produtor) × Eixo B (Conteúdo)
- **Citação:** SEVERO, Filipe Machado Leal. *O Novo "You" do YouTube*.
  Dissertação (Mestrado em Comunicação) — PUCRS/FAMECOS, 2026.

## Licença

Estes dados são disponibilizados publicamente para fins de pesquisa
acadêmica, jornalística e de organização da sociedade civil. Ao usar,
cite a fonte conforme as referências acima.
"""
    (output_dir / "MANIFEST.md").write_text(conteudo, encoding="utf-8", newline="\n")
    print("\n✓ MANIFEST.md, manifest.json, SHA256SUMS")


def main() -> None:
    output_dir = Path(os.environ.get("EXPORT_DIR", "export"))
    output_dir.mkdir(parents=True, exist_ok=True)
    agora = datetime.now(timezone.utc)

    print("=" * 70)
    print("RAIO-X — Exportação semanal do corpus")
    print(f"Executado em {agora.isoformat()}")
    print("=" * 70)

    cliente = conectar_supabase()

    metadados = []
    arquivos: list[Path] = []
    for tabela in ESQUEMAS:
        # Sem try/except: qualquer erro derruba o job (antes, uma tabela com
        # erro saía como "0 registros" e o export era publicado assim mesmo).
        registros, info = ler_tabela(cliente, tabela)
        parquet = output_dir / f"{tabela}.parquet"
        csv_gz = output_dir / f"{tabela}.csv.gz"
        gravar_parquet(tabela, registros, parquet)
        gravar_csv_gz(tabela, registros, csv_gz)
        arquivos += [parquet, csv_gz]
        metadados.append({"tabela": tabela, "n_registros": len(registros), "max_id": info["max_id"]})
        print(f"  → {parquet.name} ({parquet.stat().st_size / 1e6:.1f} MB), "
              f"{csv_gz.name} ({csv_gz.stat().st_size / 1e6:.1f} MB)")

    gerar_manifesto(metadados, arquivos, output_dir, agora)

    total = sum(m["n_registros"] for m in metadados)
    print("\n" + "=" * 70)
    print(f"✅ Exportação concluída: {_milhar(total)} registros em {len(metadados)} tabelas")
    print("=" * 70)


if __name__ == "__main__":
    try:
        main()
    except ExportIncompleto as e:
        print(f"\n✗ EXPORT INCOMPLETO — nada será publicado: {e}")
        sys.exit(1)
