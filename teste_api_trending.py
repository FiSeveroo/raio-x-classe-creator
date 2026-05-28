"""
Teste de investigação: compara mostPopular geral vs. com videoCategoryId=25 (News)
Roda manualmente — não afeta o coletor principal.
"""
import requests
import json
import os
import sys

YOUTUBE_API_KEY = os.environ.get("YOUTUBE_API_KEY", "")
if not YOUTUBE_API_KEY:
    print("ERRO: defina YOUTUBE_API_KEY como variável de ambiente")
    sys.exit(1)

URL = "https://www.googleapis.com/youtube/v3/videos"
BASE_PARAMS = {
    "part": "snippet,statistics",
    "chart": "mostPopular",
    "regionCode": "BR",
    "maxResults": 50,
    "key": YOUTUBE_API_KEY,
}

CATEGORIAS_NEWS = ["25"]  # News & Politics
CATEGORIAS_ENTERTAINMENT = ["24"]  # Entertainment
CATEGORIAS_SPORTS = ["17"]  # Sports

def coletar(label: str, extra_params: dict = {}) -> list:
    params = {**BASE_PARAMS, **extra_params}
    resp = requests.get(URL, params=params, timeout=30)
    resp.raise_for_status()
    items = resp.json().get("items", [])
    print(f"\n{'='*60}")
    print(f"📊 {label} — {len(items)} vídeos")
    print(f"{'='*60}")
    for i, item in enumerate(items, 1):
        canal = item["snippet"]["channelTitle"]
        titulo = item["snippet"]["title"][:50]
        cat = item["snippet"].get("categoryId", "?")
        views = int(item["statistics"].get("viewCount", 0))
        print(f"  [{i:02d}] {canal:<35} | cat:{cat} | {views:>10,} views")
        print(f"        {titulo}")
    return items

print("🔬 INVESTIGAÇÃO — YouTube API mostPopular BR")
print("Comparando trending geral vs. por categoria de news/esporte\n")

# Teste 1: geral (como está hoje)
geral = coletar("GERAL (sem filtro de categoria)")

# Teste 2: só News & Politics
news = coletar("CATEGORIA 25 — News & Politics", {"videoCategoryId": "25"})

# Teste 3: só Sports
sports = coletar("CATEGORIA 17 — Sports", {"videoCategoryId": "17"})

# Análise: canais do news/sports que NÃO aparecem no geral
ids_geral = {i["snippet"]["channelTitle"] for i in geral}
ids_news = {i["snippet"]["channelTitle"] for i in news}
ids_sports = {i["snippet"]["channelTitle"] for i in sports}

ausentes_news = ids_news - ids_geral
ausentes_sports = ids_sports - ids_geral

print(f"\n{'='*60}")
print(f"🔍 DIAGNÓSTICO")
print(f"{'='*60}")
print(f"\nCanais de News que aparecem por categoria mas NÃO no geral:")
if ausentes_news:
    for c in sorted(ausentes_news):
        print(f"  ⚠️  {c}")
else:
    print("  Nenhum — News está incluído no geral")

print(f"\nCanais de Sports que aparecem por categoria mas NÃO no geral:")
if ausentes_sports:
    for c in sorted(ausentes_sports):
        print(f"  ⚠️  {c}")
else:
    print("  Nenhum — Sports está incluído no geral")

print(f"\n{'='*60}")
print("CONCLUSÃO:")
if ausentes_news or ausentes_sports:
    print("✅ CONFIRMADO — API está excluindo canais de news/sports do mostPopular geral")
    print("   Isso explica a ausência de mídia tradicional nos snapshots.")
else:
    print("❌ Não confirmado — news/sports aparecem no geral também")
    print("   O problema pode ser que simplesmente não há conteúdo desses canais no trending hoje.")
print(f"{'='*60}\n")
