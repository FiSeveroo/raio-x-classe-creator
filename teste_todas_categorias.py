"""
Investiga sistematicamente quais categorias da YouTube API existem para BR
e quais são excluídas do mostPopular geral.
"""
import requests, os, sys
from collections import defaultdict

YOUTUBE_API_KEY = os.environ.get("YOUTUBE_API_KEY", "")
if not YOUTUBE_API_KEY:
    print("ERRO: defina YOUTUBE_API_KEY")
    sys.exit(1)

BASE = "https://www.googleapis.com/youtube/v3"

def get(endpoint, params):
    params["key"] = YOUTUBE_API_KEY
    resp = requests.get(f"{BASE}/{endpoint}", params=params, timeout=30)
    resp.raise_for_status()
    return resp.json()

# ── 1. Categorias válidas para BR ──────────────────────────────────────────
print("📋 Consultando categorias válidas para regionCode=BR...\n")
cat_data = get("videoCategories", {"part": "snippet", "regionCode": "BR", "hl": "pt_BR"})
categorias_br = {
    item["id"]: item["snippet"]["title"]
    for item in cat_data.get("items", [])
    if item["snippet"].get("assignable", False)
}
print(f"Categorias assignable para BR: {len(categorias_br)}")
for cid, nome in sorted(categorias_br.items(), key=lambda x: int(x[0])):
    print(f"  cat{cid:>2} {nome}")

# ── 2. mostPopular geral ───────────────────────────────────────────────────
print("\n\nColetando mostPopular geral...")
geral_items = get("videos", {
    "part": "snippet,statistics",
    "chart": "mostPopular",
    "regionCode": "BR",
    "maxResults": 50,
})["items"]

ids_geral = {i["id"] for i in geral_items}
canais_geral = {i["snippet"]["channelTitle"] for i in geral_items}
cats_no_geral = sorted(set(i["snippet"].get("categoryId") for i in geral_items))
print(f"→ {len(geral_items)} vídeos | categorias presentes: {cats_no_geral}")

# ── 3. Testa cada categoria válida ────────────────────────────────────────
print(f"\n\n{'='*70}")
print("TESTANDO CADA CATEGORIA VÁLIDA")
print(f"{'='*70}\n")

resultados = {}
for cat_id, cat_nome in sorted(categorias_br.items(), key=lambda x: int(x[0])):
    try:
        items = get("videos", {
            "part": "snippet,statistics",
            "chart": "mostPopular",
            "regionCode": "BR",
            "maxResults": 50,
            "videoCategoryId": cat_id,
        })["items"]

        ids_cat = {i["id"] for i in items}
        canais_cat = {i["snippet"]["channelTitle"] for i in items}
        ausentes = ids_cat - ids_geral
        presentes = ids_cat & ids_geral
        taxa = len(ausentes) / len(items) * 100 if items else 0

        resultados[cat_id] = {
            "nome": cat_nome,
            "total": len(items),
            "ausentes": len(ausentes),
            "presentes": len(presentes),
            "taxa_exclusao": taxa,
            "canais_ausentes": sorted(canais_cat - canais_geral)[:8],
        }

        status = "🔴 EXCLUÍDA" if taxa > 50 else ("⚠️  PARCIAL " if taxa > 0 else "✅ incluída")
        print(f"cat{cat_id:>2} {cat_nome:<30} {status} | {len(items)} vídeos | {len(ausentes)} ausentes ({taxa:.0f}%)")

    except requests.HTTPError as e:
        print(f"cat{cat_id:>2} {cat_nome:<30} ❌ ERRO HTTP {e.response.status_code}")
        resultados[cat_id] = {"nome": cat_nome, "erro": str(e.response.status_code)}
    except Exception as e:
        print(f"cat{cat_id:>2} {cat_nome:<30} ❌ ERRO: {e}")

# ── 4. Diagnóstico final ──────────────────────────────────────────────────
print(f"\n\n{'='*70}")
print("DIAGNÓSTICO FINAL")
print(f"{'='*70}")

excluidas = [(cid, r) for cid, r in resultados.items()
             if "taxa_exclusao" in r and r["taxa_exclusao"] > 50]
parciais  = [(cid, r) for cid, r in resultados.items()
             if "taxa_exclusao" in r and 0 < r["taxa_exclusao"] <= 50]
inclusas  = [(cid, r) for cid, r in resultados.items()
             if "taxa_exclusao" in r and r["taxa_exclusao"] == 0]

print(f"\n🔴 SISTEMATICAMENTE EXCLUÍDAS (>50%):")
for cid, r in sorted(excluidas, key=lambda x: -x[1]["taxa_exclusao"]):
    print(f"   cat{cid:>2} {r['nome']:<30} → {r['taxa_exclusao']:.0f}% excluídos")
    if r["canais_ausentes"]:
        print(f"          Ex: {', '.join(r['canais_ausentes'][:4])}")

print(f"\n⚠️  PARCIALMENTE EXCLUÍDAS (1–50%):")
for cid, r in sorted(parciais, key=lambda x: -x[1]["taxa_exclusao"]):
    print(f"   cat{cid:>2} {r['nome']:<30} → {r['taxa_exclusao']:.0f}% excluídos")

print(f"\n✅ INCLUÍDAS NO GERAL (0% excluídos):")
for cid, r in sorted(inclusas):
    print(f"   cat{cid:>2} {r['nome']}")

print(f"\n{'='*70}")
print(f"Categorias válidas para BR:  {len(categorias_br)}")
print(f"Testadas com sucesso:        {len(resultados)}")
print(f"Excluídas (>50%):            {len(excluidas)}")
print(f"Parciais  (1–50%):           {len(parciais)}")
print(f"Incluídas (0%):              {len(inclusas)}")
print(f"Categorias presentes no geral organicamente: {cats_no_geral}")
print(f"{'='*70}\n")
