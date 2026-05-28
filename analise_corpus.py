"""
=============================================================================
ANÁLISE DO CORPUS HISTÓRICO — YouTube Black Box
Observatório Classe Creator / Filipe Severo (PUCRS/FAMECOS)
=============================================================================

Baixa os 893+ CSVs de github.com/FiSeveroo/coletor-youtube,
analisa a ruptura de categorias e gera figuras para o artigo.

Saída (em ./resultados-analise/):
    relatorio.txt
    presenca_mensal.csv
    distribuicao_semanal.csv
    composicao_pre_pos.csv
    fig_1_distribuicao_temporal.png/.pdf
    fig_2_ruptura_zoom.png/.pdf
    fig_3_heatmap_categorias.png/.pdf
    fig_4_composicao_barras.png/.pdf
=============================================================================
"""

import io, os, re, sys
from collections import defaultdict
from datetime import datetime, date
from pathlib import Path

import pandas as pd
import requests
from tqdm import tqdm

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import matplotlib.dates as mdates
import seaborn as sns
import numpy as np

# ─── Config ──────────────────────────────────────────────────────────────────

GITHUB_REPO   = "FiSeveroo/coletor-youtube"
GITHUB_BRANCH = "main"
TOKEN         = os.environ.get("GITHUB_TOKEN", "")
OUT           = Path("resultados-analise")
OUT.mkdir(exist_ok=True)

CATEGORIAS = {
    "1": "Film & Animation", "2": "Autos & Vehicles", "10": "Music",
    "15": "Pets & Animals",  "17": "Sports",          "19": "Travel & Events",
    "20": "Gaming",          "22": "People & Blogs",  "23": "Comedy",
    "24": "Entertainment",   "25": "News & Politics", "26": "Howto & Style",
    "27": "Education",       "28": "Science & Tech",
}

CAT_COLORS = {
    "17": "#E63946", "25": "#457B9D", "24": "#F4A261", "20": "#2A9D8F",
    "10": "#9B5DE5", "22": "#F72585", "1":  "#4CC9F0", "outros": "#BBBBBB",
}

# ─── GitHub helpers ───────────────────────────────────────────────────────────

def _headers():
    return {"Authorization": f"token {TOKEN}"} if TOKEN else {}

def listar_csvs() -> list[str]:
    url = f"https://api.github.com/repos/{GITHUB_REPO}/git/trees/{GITHUB_BRANCH}?recursive=1"
    r = requests.get(url, headers=_headers(), timeout=60)
    r.raise_for_status()
    return sorted([
        i["path"] for i in r.json().get("tree", [])
        if i["path"].endswith(".csv")
        and re.match(r"\d{4}-\d{2}-\d{2}_\d{2}h\d{2}m\.csv", i["path"])
    ])

def baixar_csv(path: str) -> pd.DataFrame:
    url = f"https://raw.githubusercontent.com/{GITHUB_REPO}/{GITHUB_BRANCH}/{path}"
    r = requests.get(url, headers=_headers(), timeout=30)
    r.raise_for_status()
    try:
        return pd.read_csv(io.StringIO(r.text))
    except Exception as e:
        print(f"    ⚠️  Parse error {path}: {e}", flush=True)
        return pd.DataFrame()

def parsear_data(filename: str) -> date | None:
    m = re.match(r"(\d{4}-\d{2}-\d{2})_", filename)
    return date.fromisoformat(m.group(1)) if m else None

def coluna_categoria(df: pd.DataFrame) -> pd.Series:
    for nome in ["Categoria do vídeo", "categoria_youtube", "categoryId"]:
        if nome in df.columns:
            return df[nome].astype(str).str.strip()
    return pd.Series([""] * len(df))

# ─── Carga ────────────────────────────────────────────────────────────────────

def carregar_corpus() -> pd.DataFrame:
    cache = OUT / "corpus_cache.parquet"
    if cache.exists():
        print(f"✅ Cache encontrado — carregando {cache}", flush=True)
        return pd.read_parquet(cache)

    print("📥 Listando CSVs no GitHub...", flush=True)
    csvs = listar_csvs()
    print(f"   → {len(csvs)} arquivos encontrados", flush=True)

    dfs = []
    for filename in tqdm(csvs, desc="Baixando", file=sys.stdout):
        d = parsear_data(filename)
        if not d:
            continue
        df = baixar_csv(filename)
        if df.empty:
            continue
        df["_data"]     = pd.Timestamp(d)
        df["_semana"]   = pd.Timestamp(d).to_period("W").start_time
        df["_mes"]      = pd.Timestamp(d).to_period("M")
        df["_arquivo"]  = filename
        df["_cat"]      = coluna_categoria(df)
        dfs.append(df[["_data", "_semana", "_mes", "_arquivo", "_cat"]])  # só o essencial

    corpus = pd.concat(dfs, ignore_index=True)
    corpus.to_parquet(cache, index=False)
    print(f"✅ {len(corpus):,} registros carregados e salvos em cache", flush=True)
    return corpus

# ─── Análises ────────────────────────────────────────────────────────────────

def analise_ruptura(df: pd.DataFrame) -> dict:
    resultado = {}

    for cat in ["17", "25"]:
        presentes = df[df["_cat"] == cat]["_data"].unique()
        if len(presentes) == 0:
            resultado[f"ultimo_{cat}"]  = "Nunca encontrada"
            resultado[f"ausencia_{cat}"] = "—"
            continue
        ultimo = pd.Timestamp(sorted(presentes)[-1])
        resultado[f"ultimo_{cat}"] = ultimo.date()

        # Primeiro dia após o último com coleta mas sem essa cat.
        dias_apos = sorted(d for d in df["_data"].unique() if pd.Timestamp(d) > ultimo)
        ausencia = "Não identificada (ainda presente no período)"
        for d in dias_apos:
            cats_dia = set(df[df["_data"] == d]["_cat"].unique())
            if cat not in cats_dia:
                ausencia = pd.Timestamp(d).date()
                break
        resultado[f"ausencia_{cat}"] = ausencia

    # Tabela mensal
    meses = sorted(df["_mes"].unique())
    rows = []
    for m in meses:
        sub = df[df["_mes"] == m]
        n = len(sub)
        row = {"mes": str(m), "n_total": n}
        for c in ["17", "25", "20", "10", "24", "22"]:
            cnt = (sub["_cat"] == c).sum()
            row[f"cat{c}_n"]   = int(cnt)
            row[f"cat{c}_pct"] = round(cnt / n * 100, 2) if n else 0
        rows.append(row)
    resultado["mensal"] = pd.DataFrame(rows)
    return resultado

def dist_semanal(df: pd.DataFrame) -> pd.DataFrame:
    semanas = df.groupby(["_semana", "_cat"]).size().reset_index(name="n")
    totais  = df.groupby("_semana").size().reset_index(name="total")
    out = semanas.merge(totais, on="_semana")
    out["pct"] = (out["n"] / out["total"] * 100).round(2)
    out["cat_nome"] = out["_cat"].map(lambda x: CATEGORIAS.get(x, f"Cat {x}"))
    return out.sort_values(["_semana", "n"], ascending=[True, False])

def composicao_pre_pos(df: pd.DataFrame) -> dict:
    corte = pd.Timestamp("2025-08-01")
    pre = df[df["_data"] < corte]
    pos = df[df["_data"] >= corte]

    def dist(subset, label):
        if subset.empty:
            return pd.DataFrame()
        total = len(subset)
        d = subset.groupby("_cat").size().reset_index(name="n")
        d["pct"]     = (d["n"] / total * 100).round(2)
        d["periodo"] = label
        d["cat_nome"] = d["_cat"].map(lambda x: CATEGORIAS.get(x, f"Cat {x}"))
        return d.sort_values("n", ascending=False)

    return {
        "pre":   dist(pre, f"Pré-ruptura (n={len(pre):,})"),
        "pos":   dist(pos, f"Pós-ruptura (n={len(pos):,})"),
        "n_pre": len(pre),
        "n_pos": len(pos),
    }

# ─── Figuras ─────────────────────────────────────────────────────────────────

def _estilo():
    plt.rcParams.update({
        "font.family": "serif", "font.size": 10,
        "axes.titlesize": 11, "axes.labelsize": 10,
        "xtick.labelsize": 9, "ytick.labelsize": 9,
        "legend.fontsize": 9, "figure.dpi": 150,
        "savefig.dpi": 300, "savefig.bbox": "tight",
        "axes.spines.top": False, "axes.spines.right": False,
        "axes.grid": True, "grid.alpha": 0.3, "grid.linestyle": "--",
    })

def salvar(fig, nome):
    fig.savefig(OUT / f"{nome}.png")
    fig.savefig(OUT / f"{nome}.pdf")
    plt.close(fig)
    print(f"   ✅ {nome}.png/.pdf", flush=True)

def fig1_area(semanal: pd.DataFrame):
    _estilo()
    cats = ["17", "25", "20", "10", "24", "22"]
    pivot = semanal[semanal["_cat"].isin(cats)].pivot_table(
        index="_semana", columns="_cat", values="pct", aggfunc="sum", fill_value=0
    )
    outros = semanal[~semanal["_cat"].isin(cats)].groupby("_semana")["pct"].sum()
    pivot["outros"] = outros.reindex(pivot.index, fill_value=0)

    fig, ax = plt.subplots(figsize=(10, 5))
    cols = [c for c in cats + ["outros"] if c in pivot.columns]
    pivot[cols].plot.area(
        ax=ax, stacked=True, alpha=0.85, linewidth=0,
        color=[CAT_COLORS.get(c, "#BBBBBB") for c in cols]
    )
    ruptura = pd.Timestamp("2025-08-01")
    ax.axvline(ruptura, color="#E63946", lw=2, ls="--", zorder=10)
    ax.text(ruptura + pd.Timedelta(days=10), 92,
            "Structural rupture\n(Aug 2025)", color="#E63946",
            fontsize=8, fontweight="bold", va="top")
    labels = {"17":"Sports (17)","25":"News & Politics (25)","20":"Gaming (20)",
              "10":"Music (10)","24":"Entertainment (24)","22":"People & Blogs (22)",
              "outros":"Other categories"}
    handles = [mpatches.Patch(color=CAT_COLORS.get(c,"#BBBBBB"), label=labels.get(c,c))
               for c in cols]
    ax.legend(handles=handles, loc="lower left", ncol=2, framealpha=0.9)
    ax.set_xlabel("Week"); ax.set_ylabel("Share of records (%)")
    ax.set_title(
        "Figure 1 — Weekly category distribution in mostPopular endpoint (Brazil)\n"
        "N ≈ 44,650 records · 893 daily CSV files · March 2025–May 2026", pad=12)
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%b\n%Y"))
    ax.xaxis.set_major_locator(mdates.MonthLocator(interval=2))
    salvar(fig, "fig_1_distribuicao_temporal")

def fig2_ruptura(semanal: pd.DataFrame):
    _estilo()
    fig, ax = plt.subplots(figsize=(9, 4))
    for cat, cor, label in [("17","#E63946","Sports (17)"),
                              ("25","#457B9D","News & Politics (25)")]:
        sub = semanal[
            (semanal["_cat"] == cat) &
            (semanal["_semana"] >= pd.Timestamp("2025-01-01")) &
            (semanal["_semana"] <= pd.Timestamp("2025-12-31"))
        ]
        if not sub.empty:
            ax.plot(sub["_semana"], sub["pct"], color=cor, lw=2.5,
                    marker="o", ms=4, label=label)
    ruptura = pd.Timestamp("2025-08-01")
    ax.axvline(ruptura, color="black", lw=1.5, ls="--")
    ax.axvspan(ruptura, pd.Timestamp("2025-12-31"), alpha=0.06, color="black")
    ax.set_xlabel("Week (2025)"); ax.set_ylabel("Share of weekly records (%)")
    ax.set_title(
        "Figure 2 — Structural rupture: disappearance of Sports & News\n"
        "from the mostPopular general endpoint (Jan–Dec 2025)", pad=10)
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%b"))
    ax.xaxis.set_major_locator(mdates.MonthLocator())
    ax.legend(framealpha=0.9); ax.set_ylim(bottom=0)
    salvar(fig, "fig_2_ruptura_zoom")

def fig3_heatmap(semanal: pd.DataFrame):
    _estilo()
    cats_hm = ["17","25","20","10","24","22","1","23","28","26"]
    sub = semanal[semanal["_cat"].isin(cats_hm)].copy()
    sub["_mes_str"] = sub["_semana"].dt.to_period("M").astype(str)
    pivot = sub.pivot_table(
        index="_mes_str", columns="_cat", values="pct",
        aggfunc="mean", fill_value=0
    )
    pivot.columns = [f"{CATEGORIAS.get(c,c)} ({c})" for c in pivot.columns]
    fig, ax = plt.subplots(figsize=(12, 6))
    sns.heatmap(pivot.T, ax=ax, cmap="YlOrRd", linewidths=0.5,
                linecolor="#EEEEEE", annot=True, fmt=".1f",
                annot_kws={"size": 7},
                cbar_kws={"label": "Avg. monthly share (%)", "shrink": 0.7})
    meses = list(pivot.index)
    if "2025-08" in meses:
        idx = meses.index("2025-08")
        ax.axvline(idx, color="#E63946", lw=2.5, ls="--")
        ax.text(idx + 0.1, -0.5, "Aug 2025\nrupture",
                color="#E63946", fontsize=8, va="bottom", fontweight="bold",
                transform=ax.get_xaxis_transform())
    ax.set_xlabel("Month"); ax.set_ylabel("")
    ax.set_title(
        "Figure 3 — Category presence by month (Brazil) · mostPopular endpoint\n"
        "Values: average weekly share (%) within each month", pad=12)
    plt.xticks(rotation=45, ha="right")
    salvar(fig, "fig_3_heatmap_categorias")

def fig4_barras(comp: dict):
    _estilo()
    pre = comp["pre"].set_index("_cat")["pct"].rename("pre")
    pos = comp["pos"].set_index("_cat")["pct"].rename("pos")
    m = pd.concat([pre, pos], axis=1).fillna(0)
    m = m[m.max(axis=1) > 0.3].sort_values("pre", ascending=False)
    m["label"] = m.index.map(lambda x: f"{CATEGORIAS.get(x,x)}\n({x})")

    x, w = np.arange(len(m)), 0.38
    fig, ax = plt.subplots(figsize=(11, 5))
    b_pre = ax.bar(x - w/2, m["pre"], w, label=f"Pre-rupture (n={comp['n_pre']:,})",
                   color="#457B9D", alpha=0.9, edgecolor="white")
    ax.bar(x + w/2, m["pos"], w, label=f"Post-rupture (n={comp['n_pos']:,})",
           color="#E63946", alpha=0.9, edgecolor="white")
    for bar, cat in zip(b_pre, m.index):
        if cat in ["17", "25"]:
            bar.set_edgecolor("#F4A261"); bar.set_linewidth(2.5)
    for i, cat in enumerate(m.index):
        if cat in ["17","25"] and m.loc[cat,"pre"] > 0 and m.loc[cat,"pos"] == 0:
            ax.annotate("→ 0%\npost-rupture",
                        xy=(i - w/2, m.loc[cat,"pre"]),
                        xytext=(i - w/2, m.loc[cat,"pre"] + 1.5),
                        ha="center", fontsize=7.5, color="#E63946", fontweight="bold",
                        arrowprops=dict(arrowstyle="->", color="#E63946", lw=1.2))
    ax.set_xticks(x); ax.set_xticklabels(m["label"], fontsize=8)
    ax.set_ylabel("Share of total records (%)")
    ax.set_title(
        "Figure 4 — Category composition before vs. after structural rupture (Aug 2025)\n"
        "mostPopular endpoint · regionCode=BR", pad=10)
    ax.legend(framealpha=0.9)
    salvar(fig, "fig_4_composicao_barras")

# ─── Relatório ────────────────────────────────────────────────────────────────

def relatorio(ruptura: dict, comp: dict, semanal: pd.DataFrame):
    L = []
    L += ["=" * 65,
          "YOUTUBE BLACK BOX — ANÁLISE DO CORPUS HISTÓRICO",
          "Observatório Classe Creator / Filipe Severo (PUCRS/FAMECOS)",
          f"Gerado: {datetime.now().strftime('%Y-%m-%d %H:%M UTC')}",
          "=" * 65, ""]

    L += ["1. DATA EXATA DA RUPTURA", "-" * 40]
    for cat in ["17","25"]:
        L.append(f"  Categoria {cat} — {CATEGORIAS.get(cat)}:")
        L.append(f"    Último registro no geral: {ruptura[f'ultimo_{cat}']}")
        L.append(f"    1ª ausência confirmada:   {ruptura[f'ausencia_{cat}']}")
    L.append("")

    L += ["  Presença mensal (cat. 17 e 25):"]
    tab = ruptura["mensal"]
    L.append(f"  {'Mês':<10} {'N total':>8} {'Cat17 N':>8} {'Cat17%':>7} {'Cat25 N':>8} {'Cat25%':>7}")
    L.append("  " + "-" * 55)
    for _, r in tab.iterrows():
        L.append(f"  {r['mes']:<10} {int(r['n_total']):>8} "
                 f"{int(r['cat17_n']):>8} {r['cat17_pct']:>6.1f}% "
                 f"{int(r['cat25_n']):>8} {r['cat25_pct']:>6.1f}%")
    L.append("")

    L += ["2. COMPOSIÇÃO PRÉ vs. PÓS RUPTURA (corte: 01/ago/2025)", "-" * 40,
          f"  Pré-ruptura: {comp['n_pre']:,} registros",
          f"  Pós-ruptura: {comp['n_pos']:,} registros", ""]

    pre = comp["pre"].set_index("_cat")["pct"].rename("pre")
    pos = comp["pos"].set_index("_cat")["pct"].rename("pos")
    mg  = pd.concat([pre, pos], axis=1).fillna(0).sort_values("pre", ascending=False)
    L.append(f"  {'Categoria':<28} {'Pré%':>6} {'Pós%':>6} {'Delta':>8}")
    L.append("  " + "-" * 54)
    for cat, row in mg.iterrows():
        delta = row["pos"] - row["pre"]
        seta  = "▲" if delta > 0 else "▼"
        L.append(f"  {CATEGORIAS.get(str(cat), cat):<28} "
                 f"{row['pre']:>5.1f}% {row['pos']:>5.1f}% "
                 f"{seta}{abs(delta):>5.1f}pp")
    L.append("")

    L += ["3. COBERTURA GERAL", "-" * 40,
          f"  Semanas cobertas: {semanal['_semana'].nunique()}",
          f"  Período: {semanal['_semana'].min().date()} → {semanal['_semana'].max().date()}",
          f"  Categorias distintas observadas: {semanal['_cat'].nunique()}", ""]

    texto = "\n".join(L)
    (OUT / "relatorio.txt").write_text(texto, encoding="utf-8")
    print("\n" + texto, flush=True)

# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    print("\n" + "=" * 55)
    print("  YOUTUBE BLACK BOX — ANÁLISE DO CORPUS HISTÓRICO")
    print("=" * 55 + "\n", flush=True)

    corpus  = carregar_corpus()

    print("\n📊 Ruptura...", flush=True)
    rupt = analise_ruptura(corpus)
    rupt["mensal"].to_csv(OUT / "presenca_mensal.csv", index=False)

    print("📊 Distribuição semanal...", flush=True)
    sem = dist_semanal(corpus)
    sem.to_csv(OUT / "distribuicao_semanal.csv", index=False)

    print("📊 Composição pré/pós...", flush=True)
    comp = composicao_pre_pos(corpus)
    pd.concat([comp["pre"], comp["pos"]]).to_csv(OUT / "composicao_pre_pos.csv", index=False)

    print("\n🎨 Figuras...", flush=True)
    fig1_area(sem)
    fig2_ruptura(sem)
    fig3_heatmap(sem)
    fig4_barras(comp)

    print("\n📝 Relatório...", flush=True)
    relatorio(rupt, comp, sem)

    print(f"\n✅ Tudo em: {OUT.resolve()}\n", flush=True)

if __name__ == "__main__":
    main()
