"""
importador_historico.py
Importa CSVs do coletor-youtube (GitHub) para o Supabase arquivo_bruto.
Roda via GitHub Actions — só importa arquivos ainda não processados.
"""
import csv, io, os, sys, re, logging
from datetime import datetime
import requests
from supabase import create_client

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(message)s')

# ── Config ──────────────────────────────────────────────────────────────────
GITHUB_REPO   = "FiSeveroo/coletor-youtube"
GITHUB_BRANCH = "main"
GITHUB_TOKEN  = os.environ.get("GITHUB_TOKEN", "")  # opcional p/ rate limit
SUPABASE_URL  = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY  = os.environ.get("SUPABASE_SECRET_KEY", "")

HEADERS = {"Authorization": f"token {GITHUB_TOKEN}"} if GITHUB_TOKEN else {}

def listar_csvs_github() -> list[str]:
    """Lista todos os CSVs do repositório via GitHub API."""
    url = f"https://api.github.com/repos/{GITHUB_REPO}/git/trees/{GITHUB_BRANCH}?recursive=1"
    resp = requests.get(url, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    tree = resp.json().get("tree", [])
    return [
        item["path"] for item in tree
        if item["path"].endswith(".csv")
        and re.match(r"\d{4}-\d{2}-\d{2}_\d{2}h\d{2}m\.csv", item["path"])
    ]

def baixar_csv(filename: str) -> list[dict]:
    """Baixa e parseia um CSV do GitHub."""
    url = f"https://raw.githubusercontent.com/{GITHUB_REPO}/{GITHUB_BRANCH}/{filename}"
    resp = requests.get(url, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    reader = csv.DictReader(io.StringIO(resp.text))
    return list(reader)

def parsear_nome_arquivo(filename: str) -> tuple[str, str]:
    """Extrai data e horário do nome do arquivo. Ex: 2025-06-18_05h13m.csv"""
    m = re.match(r"(\d{4}-\d{2}-\d{2})_(\d{2})h", filename)
    if not m:
        raise ValueError(f"Nome inválido: {filename}")
    data = m.group(1)
    hora = int(m.group(2))
    horario = "05h" if hora < 12 else "17h"
    return data, horario

def normalizar_numero(val: str) -> int:
    try:
        return int(str(val).replace(",", "").strip())
    except:
        return 0

def normalizar_horas(val: str) -> float:
    try:
        return float(str(val).replace(" horas", "").strip())
    except:
        return 0.0

def importar_csv(supabase, filename: str, rows: list[dict]) -> int:
    data_coleta, horario = parsear_nome_arquivo(filename)
    registros = []
    for row in rows:
        registros.append({
            "data_coleta":          data_coleta,
            "horario_coleta":       horario,
            "posicao":              normalizar_numero(row.get("Posicao na coleta", 0)),
            "video_id":             row.get("Id do vídeo", "").strip(),
            "canal_id":             row.get("Id do canal", "").strip(),
            "canal_nome":           row.get("Canal", "").strip(),
            "titulo":               row.get("Título do vídeo", "").strip(),
            "categoria_youtube":    row.get("Categoria do vídeo", "").strip(),
            "guide_category":       row.get("guideCategory", "").strip(),
            "visualizacoes":        normalizar_numero(row.get("Visualizações", 0)),
            "likes":                normalizar_numero(row.get("Gostei", 0)),
            "comentarios":          normalizar_numero(row.get("Comentários", 0)),
            "taxa_engajamento":     row.get("Taxa de engajamento", "").strip(),
            "inscritos_canal":      normalizar_numero(row.get("Inscritos no canal", 0)),
            "duracao":              row.get("Duração do vídeo", "").strip(),
            "idioma":               row.get("Idioma", "").strip(),
            "pais_canal":           row.get("Pais", "").strip(),
            "descricao":            row.get("Descrição do vídeo", "")[:2000].strip(),
            "tags":                 row.get("Tags do video", "")[:500].strip(),
            "horas_desde_publicacao": normalizar_horas(row.get("Diferenca de horas entre postagem e coleta", 0)),
            "arquivo_origem":       filename,
        })

    if not registros:
        return 0

    # Upsert — ignora duplicatas (mesmo video_id + data + horario)
    resp = (
        supabase.table("arquivo_bruto")
        .upsert(registros, on_conflict="data_coleta,horario_coleta,video_id")
        .execute()
    )
    return len(registros)

def arquivos_ja_importados(supabase) -> set[str]:
    """Retorna nomes de arquivos já no banco."""
    resp = (
        supabase.table("arquivo_bruto")
        .select("arquivo_origem")
        .execute()
    )
    return {r["arquivo_origem"] for r in (resp.data or [])}

def main():
    if not SUPABASE_URL or not SUPABASE_KEY:
        logging.error("SUPABASE_URL e SUPABASE_SECRET_KEY são obrigatórias")
        sys.exit(1)

    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    logging.info("📋 Listando CSVs no GitHub...")
    todos = listar_csvs_github()
    logging.info(f"   → {len(todos)} CSVs encontrados")

    logging.info("📊 Verificando quais já foram importados...")
    ja_importados = arquivos_ja_importados(supabase)
    novos = [f for f in todos if f not in ja_importados]
    logging.info(f"   → {len(novos)} novos para importar")

    if not novos:
        logging.info("✅ Nada a importar — banco está atualizado")
        return

    total_registros = 0
    for i, filename in enumerate(sorted(novos), 1):
        try:
            rows = baixar_csv(filename)
            n = importar_csv(supabase, filename, rows)
            total_registros += n
            logging.info(f"  [{i:03d}/{len(novos)}] {filename} → {n} registros")
        except Exception as e:
            logging.warning(f"  ⚠️ Erro em {filename}: {e}")

    logging.info(f"\n✅ Importação concluída: {total_registros} registros em {len(novos)} arquivos")

if __name__ == "__main__":
    main()
