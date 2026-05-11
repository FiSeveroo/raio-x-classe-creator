"""
==============================================================================
RAIO-X CLASSE CREATOR — EXPORTADOR DE SNAPSHOT SEMANAL
==============================================================================

Script executado pelo GitHub Actions toda segunda-feira que:
  1. Conecta ao Supabase
  2. Exporta cada tabela do corpus para CSV em /dados-publicos/
  3. Inclui metadados de versão (data do export, contagens)

O repositório de dados é separado, public, e contém a história completa
dos exports — pesquisadores podem baixar diretamente, sem onerar o Supabase.
==============================================================================
"""

import csv
import json
import os
import sys
from datetime import datetime
from pathlib import Path

# Adiciona raiz ao path para importar db
sys.path.insert(0, str(Path(__file__).parent))

from supabase import create_client


def conectar_supabase():
    """Conexão usando a chave anon (leitura suficiente)."""
    url = os.environ.get("SUPABASE_URL")
    chave = os.environ.get("SUPABASE_PUBLISHABLE_KEY")
    if not url or not chave:
        raise RuntimeError("SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY são obrigatórias")
    return create_client(url, chave)


def exportar_tabela(cliente, tabela: str, output_dir: Path, max_registros: int = 50000) -> dict:
    """
    Exporta tabela inteira para CSV. Retorna metadados (n_registros, colunas).
    """
    print(f"Exportando {tabela}...")

    # Paginação para tabelas grandes
    PAGE_SIZE = 1000
    registros = []
    offset = 0
    while True:
        resp = (
            cliente.table(tabela)
            .select("*")
            .range(offset, offset + PAGE_SIZE - 1)
            .execute()
        )
        batch = resp.data
        if not batch:
            break
        registros.extend(batch)
        offset += PAGE_SIZE
        if len(registros) >= max_registros:
            print(f"  ⚠️  Atingido limite de {max_registros} registros — truncando")
            break

    if not registros:
        print(f"  (vazio)")
        return {"tabela": tabela, "n_registros": 0, "colunas": []}

    # CSV
    output_path = output_dir / f"{tabela}.csv"
    colunas = list(registros[0].keys())
    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=colunas, quoting=csv.QUOTE_ALL)
        writer.writeheader()
        for r in registros:
            # Serializa valores complexos (dicts, listas) como JSON
            row = {}
            for k, v in r.items():
                if isinstance(v, (dict, list)):
                    row[k] = json.dumps(v, ensure_ascii=False)
                else:
                    row[k] = v
            writer.writerow(row)

    print(f"  ✓ {len(registros)} registros → {output_path.name}")
    return {"tabela": tabela, "n_registros": len(registros), "colunas": colunas}


def gerar_manifesto(metadados: list[dict], output_dir: Path) -> None:
    """Gera arquivo MANIFEST.md descrevendo o snapshot."""
    agora = datetime.utcnow()
    total_registros = sum(m["n_registros"] for m in metadados)

    conteudo = f"""# 📚 Corpus Público do Observatório Classe Creator

## Snapshot gerado em {agora.strftime('%d/%m/%Y às %H:%M UTC')}

Este diretório contém o corpus completo do Raio-X Classe Creator em formato
CSV, atualizado semanalmente (segundas-feiras) via GitHub Actions.

**Total de registros neste snapshot:** {total_registros:,}

## Tabelas exportadas

| Tabela | Registros | Descrição |
|---|---:|---|
"""

    descricoes = {
        "snapshots": "Cabeçalho dos snapshots semanais do Termômetro",
        "videos_snapshot": "Vídeos do trending classificados (Termômetro)",
        "classificacoes_video": "Análises individuais de vídeos (Lupa)",
        "dossies_canal": "Investigações estruturais de canais (Dossiê)",
        "buscas_narrativa": "Cabeçalho de auditorias temáticas (Disputa)",
        "resultados_busca": "Resultados detalhados das auditorias temáticas",
        "analises_comentarios": "Análises qualitativas de comentários (Voz da Base)",
    }

    for m in metadados:
        tabela = m["tabela"]
        desc = descricoes.get(tabela, "—")
        conteudo += f"| `{tabela}.csv` | {m['n_registros']:,} | {desc} |\n"

    conteudo += f"""

## Como usar

Os arquivos seguem formato CSV padrão (UTF-8, quoted, separador vírgula).
Valores complexos (JSON aninhado) estão serializados como string JSON nas células.

```python
import pandas as pd
df = pd.read_csv('dossies_canal.csv')
print(df.head())
```

## Sobre o Raio-X Classe Creator

Ferramenta de auditoria algorítmica e pesquisa acadêmica do trabalho
plataformizado no YouTube, desenvolvida pelo Observatório Classe Creator
com metodologia ancorada em SEVERO (2026).

- **Ferramenta:** https://raio-x-classe-creator.streamlit.app
- **Tipologia dupla:** Eixo A (Produtor) × Eixo B (Conteúdo)
- **Citação:** SEVERO, Filipe Machado Leal. *O Novo "You" do YouTube*.
  Dissertação (Mestrado em Comunicação) — PUCRS/FAMECOS, 2026.

## Licença

Estes dados são disponibilizados publicamente para fins de pesquisa
acadêmica, jornalística e de organização da sociedade civil. Ao usar,
cite a fonte conforme as referências acima.
"""

    manifest_path = output_dir / "MANIFEST.md"
    manifest_path.write_text(conteudo, encoding="utf-8")
    print(f"\n✓ Manifesto: {manifest_path.name}")


def main() -> None:
    output_dir = Path("dados-publicos")
    output_dir.mkdir(parents=True, exist_ok=True)

    print("=" * 70)
    print("RAIO-X — Exportação semanal do corpus")
    print(f"Executado em {datetime.utcnow().isoformat()}Z")
    print("=" * 70)

    cliente = conectar_supabase()

    # Tabelas a exportar
    tabelas = [
        "snapshots",
        "videos_snapshot",
        "classificacoes_video",
        "dossies_canal",
        "buscas_narrativa",
        "resultados_busca",
        "analises_comentarios",
    ]

    metadados = []
    for tabela in tabelas:
        try:
            meta = exportar_tabela(cliente, tabela, output_dir)
            metadados.append(meta)
        except Exception as e:
            print(f"  ✗ Erro em {tabela}: {e}")
            metadados.append({"tabela": tabela, "n_registros": 0, "colunas": []})

    # Gera manifesto
    gerar_manifesto(metadados, output_dir)

    # Resumo final
    total = sum(m["n_registros"] for m in metadados)
    print("\n" + "=" * 70)
    print(f"✅ Exportação concluída: {total:,} registros em {len(metadados)} tabelas")
    print("=" * 70)


if __name__ == "__main__":
    main()
