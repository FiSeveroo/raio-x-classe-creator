"""
Relatório da sobreposição entre o mostPopular geral e os filtros por categoria.

Lê as tabelas consultas_coleta e consultas_coleta_videos (chave publicável, só
leitura) e gera CSVs + relatorio.txt em relatorio-sobreposicao/. Roda pelo
workflow manual "Relatório de Sobreposição". Sem IA e sem cota da YouTube.
"""

import csv
import os
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path
from statistics import mean

from supabase import create_client

SAIDA = Path("relatorio-sobreposicao")
PAGINA = 1000


def ler_tudo(cliente, tabela: str, colunas: str) -> list[dict]:
    linhas, ultimo = [], 0
    while True:
        lote = (
            cliente.table(tabela).select(colunas).gt("id", ultimo).order("id").limit(PAGINA).execute().data
        )
        if not lote:
            return linhas
        linhas.extend(lote)
        ultimo = lote[-1]["id"]
        if len(lote) < PAGINA:
            return linhas


def gravar_csv(nome: str, cabecalho: list[str], linhas: list[list]) -> None:
    with open(SAIDA / nome, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow(cabecalho)
        w.writerows(linhas)


def pct(a: int, b: int):
    return round(100 * a / b, 2) if b else ""


def semana(iso: str) -> str:
    ano, sem, _ = datetime.fromisoformat(iso.replace("Z", "+00:00")).isocalendar()
    return f"{ano}-S{sem:02d}"


def main() -> None:
    SAIDA.mkdir(exist_ok=True)
    cliente = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_PUBLISHABLE_KEY"])
    consultas = ler_tudo(
        cliente, "consultas_coleta",
        "id,coleta_uuid,coletado_em,snapshot_id,endpoint,http_status,erro_motivo,itens_devolvidos",
    )
    videos = ler_tudo(cliente, "consultas_coleta_videos", "id,consulta_id,posicao,video_id,category_id,visualizacoes,topic_categories")

    por_consulta = defaultdict(list)
    for v in videos:
        por_consulta[v["consulta_id"]].append(v)
    coletas = defaultdict(dict)
    for c in consultas:
        coletas[c["coleta_uuid"]][c["endpoint"]] = c
    ordem = sorted(coletas, key=lambda u: next(iter(coletas[u].values()))["coletado_em"])

    checagem, por_endpoint, sobrepos, composicao = [], [], [], []
    acumulado = defaultdict(list)
    divergentes = 0
    for uuid_coleta in ordem:
        c_col = coletas[uuid_coleta]
        qualquer = next(iter(c_col.values()))
        quando = qualquer["coletado_em"]
        soma = sum(c["itens_devolvidos"] for c in c_col.values())
        linhas_video = sum(len(por_consulta[c["id"]]) for c in c_col.values())
        confere = soma == linhas_video
        divergentes += not confere
        erros = [e for e, c in c_col.items() if c["http_status"] != 200]
        checagem.append([uuid_coleta, quando, qualquer["snapshot_id"], len(c_col), soma, linhas_video, int(confere), " ".join(erros)])

        geral = c_col.get("geral")
        ids_geral = None
        if geral and geral["http_status"] == 200:
            ids_geral = {v["video_id"] for v in por_consulta[geral["id"]]}
            cont = Counter(v["category_id"] for v in por_consulta[geral["id"]])
            for cat, n in cont.most_common():
                composicao.append([uuid_coleta, quando, cat, n, pct(n, geral["itens_devolvidos"])])

        for endpoint, c in sorted(c_col.items()):
            por_endpoint.append([uuid_coleta, quando, endpoint, c["http_status"], c["erro_motivo"] or "", c["itens_devolvidos"]])
            if endpoint == "geral" or c["http_status"] != 200 or ids_geral is None:
                continue
            itens = por_consulta[c["id"]]
            comum = sum(1 for v in itens if v["video_id"] in ids_geral)
            proprios = sum(1 for v in itens if v["category_id"] == endpoint)
            p = pct(comum, len(itens))
            sobrepos.append([uuid_coleta, quando, endpoint, len(itens), comum, p, proprios, pct(proprios, len(itens))])
            if p != "":
                acumulado[(semana(quando), endpoint)].append(p)

    gravar_csv("checagem_por_coleta.csv", ["coleta_uuid", "coletado_em", "snapshot_id", "consultas", "soma_itens_devolvidos", "linhas_gravadas", "confere", "endpoints_com_erro"], checagem)
    gravar_csv("consultas_por_coleta.csv", ["coleta_uuid", "coletado_em", "endpoint", "http_status", "erro_motivo", "itens_devolvidos"], por_endpoint)
    gravar_csv("sobreposicao_por_coleta.csv", ["coleta_uuid", "coletado_em", "filtro", "itens", "em_comum_com_geral", "pct_em_comum", "itens_com_category_id_do_filtro", "pct_category_id_do_filtro"], sobrepos)
    gravar_csv("composicao_geral_por_coleta.csv", ["coleta_uuid", "coletado_em", "category_id", "videos", "pct"], composicao)
    semanal = [[s, e, len(v), round(mean(v), 2), min(v), max(v)] for (s, e), v in sorted(acumulado.items())]
    gravar_csv("estabilidade_semanal.csv", ["semana_iso", "filtro", "coletas", "pct_em_comum_media", "minimo", "maximo"], semanal)

    # Tópicos declarados pela API na data da coleta, por aparição em cada consulta
    topicos, com_topico = defaultdict(Counter), Counter()
    for c in consultas:
        for v in por_consulta[c["id"]]:
            if v.get("topic_categories"):
                com_topico[c["endpoint"]] += 1
                for t in set(v["topic_categories"]):
                    topicos[c["endpoint"]][t.rsplit("/", 1)[-1]] += 1
    gravar_csv("topicos_por_endpoint.csv", ["endpoint", "topico", "aparicoes", "pct_das_aparicoes_com_topico"], [
        [e, t, n, pct(n, com_topico[e])] for e in sorted(topicos) for t, n in topicos[e].most_common()
    ])

    filtros = defaultdict(list)
    for linha in sobrepos:
        if linha[5] != "":
            filtros[linha[2]].append(linha[5])
    erros_por = Counter((l[2], l[3], l[4]) for l in por_endpoint if l[3] != 200)

    texto = [
        "RELATÓRIO DE SOBREPOSIÇÃO — mostPopular BR (geral × filtros)",
        f"Coletas: {len(ordem)}. Consultas: {len(consultas)}. Vídeos registrados: {len(videos)}.",
        f"Conferência (linhas gravadas = soma do que cada consulta devolveu): {len(ordem) - divergentes} de {len(ordem)} coletas conferem.",
        "",
        "Todos os números abaixo são medição direta das respostas da API.",
        "",
        "Filtro  coletas  % em comum com o geral (média, mínimo, máximo)",
    ]
    for f in sorted(filtros, key=int):
        v = filtros[f]
        texto.append(f"{f:>5}  {len(v):>6}  {mean(v):6.2f}  {min(v):6.2f}  {max(v):6.2f}")
    texto += ["", "Erros por endpoint (endpoint, http, motivo, coletas):"]
    texto += [f"  {e}, {s}, {m}: {n}" for (e, s, m), n in sorted(erros_por.items())] or ["  nenhum"]
    texto += ["", "Detalhes: sobreposicao_por_coleta.csv, composicao_geral_por_coleta.csv, estabilidade_semanal.csv, consultas_por_coleta.csv, checagem_por_coleta.csv, topicos_por_endpoint.csv."]
    (SAIDA / "relatorio.txt").write_text("\n".join(texto) + "\n", encoding="utf-8", newline="\n")
    print("\n".join(texto))


if __name__ == "__main__":
    main()
