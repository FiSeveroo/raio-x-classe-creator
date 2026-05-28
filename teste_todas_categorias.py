"""
Testa TODAS as categorias da YouTube API contra o mostPopular geral.
Identifica quais categorias são sistematicamente excluídas.
"""
import requests, json, os, sys
from collections import defaultdict

YOUTUBE_API_KEY = os.environ.get("YOUTUBE_API_KEY", "")
if not YOUTUBE_API_KEY:
    print("ERRO: defina YOUTUBE_API_KEY")
    sys.exit(1)

URL = "https://www.googleapis.com/youtube/v3/videos"

# Todas as categorias conhecidas da YouTube Data API
CATEGORIAS = {
    "1":  "Film & Animation",
    "2":  "Autos & Vehicles",
    "10": "Music",
    "15": "Pets & Animals",
    "17": "Sports",
    "18": "Short Movies",
    "19": "Travel & Events",
    "20": "Gaming",
    "21": "Videoblogging",
    "22": "People & Blogs",
    "23": "Comedy",
    "24": "Entertainment",
    "25": "News & Politics",
    "26": "Howto & Style",
    "27": "Education",
    "28": "Science & Technology",
    "29": "Nonprofits & Activism",
}

def coletar(categoria_id=None, max_results=50):
    params = {
        "part": "snippet,statistics",
        "chart": "mostPopular",
        "regionCode": "BR",
        "maxResults": max_results,
        "key": YOUTUBE_API_KEY,
    }
    if categoria_id:
        params["videoCategoryId"] = categoria_id
    resp = requests.get(URL, params=params, timeout=30)
    resp.raise_for_status()
    return resp.json().get("items", [])

print("🔬 INVESTIGAÇÃO COMPLETA — Todas as categorias YouTube API")
print("Testando exclusão sistemática do mostPopular geral BR\n")

# 1. Coleta geral
print("Coletando mostPopular geral...")
geral = coletar()
ids_geral = {i["id"] for i in geral}
canais_geral = {i["snippet"]["channelTitle"] for i in geral}
cats_no_geral = set(i["snippet"].get("categoryId") for i in geral)
print(f"→ {len(geral)} vídeos | categorias presentes: {sorted(cats_no_geral)}\n")

# 2. Testa cada categoria
resultados = {}
for cat_id, cat_nome in sorted(CATEGORIAS.items()):
    try:
        items = coletar(categoria_id=cat_id)
        ids_cat = {i["id"] for i in items}
        canais_cat = {i["snippet"]["channelTitle"] for i in items}
        
        ausentes_ids = ids_cat - ids_geral
        ausentes_canais = canais_cat - canais_geral
        presentes = ids_cat & ids_geral
        
        resultados[cat_id] = {
            "nome": cat_nome,
            "total": len(items),
            "ausentes": len(ausentes_ids),
            "presentes": len(presentes),
            "taxa_exclusao": len(ausentes_ids) / len(items) * 100 if items else 0,
            "canais_ausentes": sorted(ausentes_canais)[:10],
            "esta_no_geral": cat_id in cats_no_geral,
        }
        status = "🔴 EXCLUÍDA" if len(ausentes_ids) > len(items) * 0.5 else "✅ incluída"
        print(f"cat{cat_id:>2} {cat_nome:<25} {status} | {len(items)} vídeos | {len(ausentes_ids)} ausentes ({resultados[cat_id]['taxa_exclusao']:.0f}%)")
    except Exception as e:
        print(f"cat{cat_id:>2} {cat_nome:<25} ⚠️ ERRO: {e}")
        resultados[cat_id] = {"nome": cat_nome, "erro": str(e)}

# 3. Diagnóstico final
print(f"\n{'='*70}")
print("DIAGNÓSTICO FINAL")
print(f"{'='*70}")

excluidas = [(cid, r) for cid, r in resultados.items() 
             if "taxa_exclusao" in r and r["taxa_exclusao"] > 50]
inclusas = [(cid, r) for cid, r in resultados.items() 
            if "taxa_exclusao" in r and r["taxa_exclusao"] <= 50]

print(f"\n🔴 CATEGORIAS SISTEMATICAMENTE EXCLUÍDAS (>50% ausentes do geral):")
for cid, r in sorted(excluidas, key=lambda x: -x[1]["taxa_exclusao"]):
    print(f"   cat{cid} {r['nome']:<25} → {r['taxa_exclusao']:.0f}% excluídos")
    if r["canais_ausentes"]:
        print(f"        Ausentes: {', '.join(r['canais_ausentes'][:5])}")

print(f"\n✅ CATEGORIAS INCLUÍDAS NO GERAL (≤50% ausentes):")
for cid, r in sorted(inclusas, key=lambda x: x[1]["taxa_exclusao"]):
    print(f"   cat{cid} {r['nome']:<25} → {r['taxa_exclusao']:.0f}% ausentes")

print(f"\n{'='*70}")
print(f"Categorias presentes organicamente no geral: {sorted(cats_no_geral)}")
print(f"Categorias testadas: {len(CATEGORIAS)}")
print(f"Excluídas: {len(excluidas)} | Incluídas: {len(inclusas)}")
print(f"{'='*70}\n")
