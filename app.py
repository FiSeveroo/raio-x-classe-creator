"""
==============================================================================
RAIO-X CLASSE CREATOR — APP PRINCIPAL
==============================================================================

Este arquivo é o ponto de entrada do Streamlit. Implementa:
  - Navegação por sidebar entre módulos
  - Módulo 1 — A Lupa (análise de 1 vídeo)
  - Módulo 3 — Termômetro do Em Alta:
      • Página pública (status da coleta + metodologia)
      • Painel interno (com senha) com gráficos e série temporal

Fonte teórica: SEVERO, Filipe Machado Leal. Dissertação PUCRS/FAMECOS, 2026.
==============================================================================
"""

import json
import random
import re
import sqlite3
from datetime import datetime
from pathlib import Path

import anthropic
import pandas as pd
import plotly.express as px
import requests
import streamlit as st

from tipologia import (
    PRODUTORES,
    CONTEUDOS,
    buscar_produtor,
    buscar_conteudo,
    codigos_produtor,
    codigos_conteudo,
    tipologia_para_prompt,
)

# Tentamos importar o db.py (Supabase). Se falhar, o Termômetro mostra aviso.
try:
    from db import (
        conectar,
        listar_snapshots,
        buscar_snapshot_mais_recente,
        videos_do_snapshot,
        todos_videos_para_serie_temporal,
        registrar_busca,
        gravar_resultado_busca,
        buscar_cache_busca,
        resultados_de_busca,
        listar_buscas_recentes,
        composicao_media_termometro,
        registrar_dossie,
        buscar_cache_dossie,
        aparicoes_canal_no_termometro,
        aparicoes_canal_em_buscas,
    )
    SUPABASE_DISPONIVEL = True
except ImportError:
    SUPABASE_DISPONIVEL = False


# ==============================================================================
# CONFIGURAÇÃO GLOBAL
# ==============================================================================

st.set_page_config(
    page_title="Raio-X Classe Creator",
    page_icon="🔬",
    layout="wide",
    initial_sidebar_state="expanded",
)

# CSS — manifesto urbano-digital
st.markdown(
    """
    <style>
    .stApp { background-color: #0a0a0a; color: #f5f5f5; }
    [data-testid="stSidebar"] { background-color: #000000; border-right: 1px solid #1a1a1a; }
    h1, h2, h3 { color: #ffffff !important; font-weight: 700; letter-spacing: -0.02em; }

    .neon-verde { color: #39FF14; font-weight: 700; text-shadow: 0 0 8px rgba(57,255,20,0.4); }
    .neon-roxo { color: #b026ff; font-weight: 700; text-shadow: 0 0 8px rgba(176,38,255,0.4); }

    .stButton > button {
        background-color: #000000; color: #39FF14; border: 1px solid #39FF14;
        font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;
        transition: all 0.2s ease;
    }
    .stButton > button:hover {
        background-color: #39FF14; color: #000000;
        box-shadow: 0 0 20px rgba(57,255,20,0.5);
    }

    .stTextInput > div > div > input {
        background-color: #1a1a1a; color: #f5f5f5; border: 1px solid #2a2a2a;
    }

    .cartao-classificacao {
        background-color: #111111; border-left: 4px solid #39FF14;
        padding: 1.5rem; margin: 1rem 0; border-radius: 4px;
    }
    .cartao-classificacao.roxo { border-left-color: #b026ff; }

    #MainMenu, footer { visibility: hidden; }
    [data-testid="stSidebar"] * { color: #f5f5f5; }
    [data-testid="stDataFrame"] { background-color: #111; }
    </style>
    """,
    unsafe_allow_html=True,
)


# ==============================================================================
# CHAVES E ACESSO
# ==============================================================================

try:
    YOUTUBE_API_KEY = st.secrets["YOUTUBE_API_KEY"]
    ANTHROPIC_API_KEY = st.secrets["ANTHROPIC_API_KEY"]
except (FileNotFoundError, KeyError):
    st.error("⚠️ Chaves de API não configuradas em **App settings → Secrets**.")
    st.stop()

# Senha de acesso ao painel interno do Termômetro (opcional).
# Se vazia, o painel fica liberado (modo desenvolvimento/early access).
SENHA_PAINEL_INTERNO = st.secrets.get("SENHA_PAINEL_INTERNO", "")


# ==============================================================================
# BANCO LOCAL — cache do Módulo 1
# ==============================================================================

DB_LOCAL = Path("raio_x.db")


def init_db_local() -> None:
    conn = sqlite3.connect(DB_LOCAL)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS classificacoes_video (
            video_id TEXT PRIMARY KEY,
            titulo TEXT, canal_nome TEXT, canal_id TEXT,
            tipo_produtor TEXT, tipo_conteudo TEXT,
            justificativa TEXT, metadados_json TEXT,
            data_classificacao TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()


def buscar_cache_local(video_id: str) -> dict | None:
    conn = sqlite3.connect(DB_LOCAL)
    row = conn.execute(
        "SELECT * FROM classificacoes_video WHERE video_id = ?", (video_id,)
    ).fetchone()
    conn.close()
    if not row:
        return None
    return {
        "video_id": row[0], "titulo": row[1], "canal_nome": row[2], "canal_id": row[3],
        "tipo_produtor": row[4], "tipo_conteudo": row[5], "justificativa": row[6],
        "metadados": json.loads(row[7]), "data": row[8], "do_cache": True,
    }


def salvar_cache_local(dados: dict) -> None:
    conn = sqlite3.connect(DB_LOCAL)
    conn.execute(
        """INSERT OR REPLACE INTO classificacoes_video
           (video_id, titulo, canal_nome, canal_id, tipo_produtor, tipo_conteudo,
            justificativa, metadados_json, data_classificacao) VALUES (?,?,?,?,?,?,?,?,?)""",
        (dados["video_id"], dados["titulo"], dados["canal_nome"], dados["canal_id"],
         dados["tipo_produtor"], dados["tipo_conteudo"], dados["justificativa"],
         json.dumps(dados["metadados"], ensure_ascii=False), datetime.utcnow().isoformat()),
    )
    conn.commit()
    conn.close()


# ==============================================================================
# YOUTUBE API
# ==============================================================================

def extrair_video_id(url: str) -> str | None:
    padroes = [
        r"(?:v=|/)([0-9A-Za-z_-]{11}).*",
        r"youtu\.be/([0-9A-Za-z_-]{11})",
        r"shorts/([0-9A-Za-z_-]{11})",
        r"embed/([0-9A-Za-z_-]{11})",
    ]
    for p in padroes:
        m = re.search(p, url)
        if m:
            return m.group(1)
    if re.fullmatch(r"[0-9A-Za-z_-]{11}", url.strip()):
        return url.strip()
    return None


def duracao_iso_para_segundos(duracao_iso: str) -> int:
    """
    Converte ISO 8601 (PT1H30M45S) para segundos.
    Usada por vários módulos para análise de duração.
    """
    match = re.match(r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", duracao_iso or "")
    if not match:
        return 0
    h, m, s = (int(g) if g else 0 for g in match.groups())
    return h * 3600 + m * 60 + s


def buscar_metadados_video(video_id: str) -> dict:
    resp = requests.get(
        "https://www.googleapis.com/youtube/v3/videos",
        params={"id": video_id, "part": "snippet,statistics,contentDetails", "key": YOUTUBE_API_KEY},
        timeout=10,
    )
    resp.raise_for_status()
    data = resp.json()
    if not data.get("items"):
        raise ValueError("Vídeo não encontrado. Verifique se a URL está correta e se o vídeo é público.")
    item = data["items"][0]
    return {
        "video_id": video_id,
        "titulo": item["snippet"]["title"],
        "descricao": item["snippet"].get("description", ""),
        "tags": item["snippet"].get("tags", []),
        "canal_id": item["snippet"]["channelId"],
        "canal_nome": item["snippet"]["channelTitle"],
        "data_publicacao": item["snippet"]["publishedAt"],
        "duracao_iso": item["contentDetails"]["duration"],
        "visualizacoes": int(item["statistics"].get("viewCount", 0)),
        "likes": int(item["statistics"].get("likeCount", 0)),
        "comentarios": int(item["statistics"].get("commentCount", 0)),
    }


def buscar_metadados_canal(canal_id: str) -> dict:
    resp = requests.get(
        "https://www.googleapis.com/youtube/v3/channels",
        params={"id": canal_id, "part": "snippet,statistics", "key": YOUTUBE_API_KEY},
        timeout=10,
    )
    resp.raise_for_status()
    data = resp.json()
    if not data.get("items"):
        return {}
    item = data["items"][0]
    return {
        "canal_descricao": item["snippet"].get("description", ""),
        "inscritos": int(item["statistics"].get("subscriberCount", 0)),
        "total_videos": int(item["statistics"].get("videoCount", 0)),
        "total_views": int(item["statistics"].get("viewCount", 0)),
    }


# ==============================================================================
# CLASSIFICAÇÃO
# ==============================================================================

def classificar_com_claude(meta_video: dict, meta_canal: dict) -> dict:
    cliente = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    prompt_sistema = f"""Você é um pesquisador especialista em Estudos de Plataforma, \
trabalhando para o Observatório Classe Creator. Sua tarefa é classificar artefatos \
do YouTube usando uma TIPOLOGIA DUPLA específica, ancorada na pesquisa acadêmica \
de Filipe Severo (PUCRS/FAMECOS, 2026).

Esta tipologia NÃO usa as categorias comerciais do YouTube. Ela busca devolver \
a materialidade do trabalho ao artefato audiovisual e revelar a estrutura social \
de produção por trás do conteúdo.

==========
{tipologia_para_prompt()}
==========

REGRAS:
1. Você DEVE escolher exatamente UMA categoria do Eixo A e UMA do Eixo B.
2. As categorias são MUTUAMENTE EXCLUSIVAS.
3. Use "outros" SOMENTE se nenhuma outra categoria fizer sentido.
4. A justificativa deve ser SOCIOLÓGICA, não descritiva.
5. Considere SEMPRE o canal como pista primária do Eixo A, e o conteúdo como pista do Eixo B.
6. Atenção a "vlogs falsos" e estéticas de autenticidade roteirizada (Cunningham & Craig, 2017).

FORMATO: APENAS JSON válido, sem markdown:
{{
  "tipo_produtor": "<código exato do Eixo A>",
  "tipo_conteudo": "<código exato do Eixo B>",
  "justificativa": "<2 a 4 frases analíticas>"
}}

CÓDIGOS Eixo A: {", ".join(codigos_produtor())}
CÓDIGOS Eixo B: {", ".join(codigos_conteudo())}
"""

    payload = f"""DADOS DO VÍDEO:
- Título: {meta_video['titulo']}
- Canal: {meta_video['canal_nome']}
- Inscritos: {meta_canal.get('inscritos', 0):,}
- Total de vídeos do canal: {meta_canal.get('total_videos', 0):,}
- Visualizações: {meta_video['visualizacoes']:,}
- Tags: {', '.join(meta_video['tags'][:20]) if meta_video['tags'] else '(sem tags)'}

DESCRIÇÃO DO CANAL:
{meta_canal.get('canal_descricao', '(sem descrição)')[:1500]}

DESCRIÇÃO DO VÍDEO:
{meta_video['descricao'][:2000]}
"""

    resposta = cliente.messages.create(
        model="claude-haiku-4-5",
        max_tokens=600,
        system=prompt_sistema,
        messages=[{"role": "user", "content": payload}],
    )

    texto = resposta.content[0].text.strip()
    texto = re.sub(r"^```(?:json)?\s*|\s*```$", "", texto, flags=re.MULTILINE).strip()
    resultado = json.loads(texto)

    if resultado["tipo_produtor"] not in codigos_produtor():
        raise ValueError(f"Código de produtor inválido: {resultado['tipo_produtor']}")
    if resultado["tipo_conteudo"] not in codigos_conteudo():
        raise ValueError(f"Código de conteúdo inválido: {resultado['tipo_conteudo']}")

    return resultado


# ==============================================================================
# SIDEBAR
# ==============================================================================

with st.sidebar:
    st.markdown("# 🔬 RAIO-X")
    st.markdown("### Classe Creator")
    st.markdown("---")

    modulo = st.radio(
        "Módulos",
        options=[
            "🔍 A Lupa",
            "🌡️ Termômetro do Em Alta",
            "⚔️ Disputa de Narrativa",
            "📋 Dossiê do Canal",
            "💬 Voz da Base (em breve)",
        ],
        label_visibility="collapsed",
    )

    st.markdown("---")
    st.markdown("**Observatório Classe Creator**")
    st.markdown(
        '<small>Ferramenta de auditoria algorítmica e pesquisa acadêmica '
        'do trabalho plataformizado.</small>',
        unsafe_allow_html=True,
    )
    st.markdown("---")
    st.markdown('<small><i>"Criar é trabalho."</i></small>', unsafe_allow_html=True)


# ==============================================================================
# MÓDULO 1 — A LUPA
# ==============================================================================

def renderizar_lupa() -> None:
    st.markdown("# 🔍 A Lupa")
    st.markdown("##### Dissecação sociológica de um artefato audiovisual")
    st.markdown(
        "Cole abaixo o link de um vídeo do YouTube. A ferramenta extrairá os "
        "metadados via API oficial e classificará o artefato segundo a "
        "**tipologia dupla** (Produtor × Conteúdo) desenvolvida na pesquisa "
        "*O Novo 'You' do YouTube* (SEVERO, 2026)."
    )

    init_db_local()

    url_input = st.text_input(
        "URL do vídeo",
        placeholder="https://www.youtube.com/watch?v=...",
        label_visibility="collapsed",
    )
    col_a, _ = st.columns([1, 5])
    with col_a:
        botao = st.button("ANALISAR", use_container_width=True, key="btn_lupa")

    if not (botao and url_input):
        return

    video_id = extrair_video_id(url_input)
    if not video_id:
        st.error("URL inválida.")
        return

    cache = buscar_cache_local(video_id)
    if cache:
        st.info(f"⚡ Resultado recuperado do cache (analisado em {cache['data'][:10]}).")
        meta = cache["metadados"]
        meta["canal_nome"] = cache["canal_nome"]
        meta["titulo"] = cache["titulo"]
        resultado = {
            "tipo_produtor": cache["tipo_produtor"],
            "tipo_conteudo": cache["tipo_conteudo"],
            "justificativa": cache["justificativa"],
        }
    else:
        try:
            with st.spinner("Extraindo metadados do vídeo..."):
                meta_video = buscar_metadados_video(video_id)
            with st.spinner("Investigando o canal produtor..."):
                meta_canal = buscar_metadados_canal(meta_video["canal_id"])
            with st.spinner("Submetendo à análise sociológica..."):
                resultado = classificar_com_claude(meta_video, meta_canal)

            salvar_cache_local({
                "video_id": video_id,
                "titulo": meta_video["titulo"],
                "canal_nome": meta_video["canal_nome"],
                "canal_id": meta_video["canal_id"],
                "tipo_produtor": resultado["tipo_produtor"],
                "tipo_conteudo": resultado["tipo_conteudo"],
                "justificativa": resultado["justificativa"],
                "metadados": {**meta_video, **meta_canal},
            })
            meta = {**meta_video, **meta_canal}
        except (ValueError, requests.HTTPError) as e:
            st.error(f"Erro na análise: {e}")
            return

    # Resultados
    st.markdown("---")
    st.markdown(f"### 🎬 {meta['titulo']}")
    st.markdown(f"*Canal:* **{meta['canal_nome']}**")

    c1, c2, c3 = st.columns(3)
    c1.metric("Visualizações", f"{meta.get('visualizacoes', 0):,}".replace(",", "."))
    c2.metric("Inscritos do canal", f"{meta.get('inscritos', 0):,}".replace(",", "."))
    c3.metric("Total de vídeos do canal", f"{meta.get('total_videos', 0):,}".replace(",", "."))

    st.markdown("---")
    st.markdown("## DIAGNÓSTICO TIPOLÓGICO")

    produtor = buscar_produtor(resultado["tipo_produtor"])
    conteudo = buscar_conteudo(resultado["tipo_conteudo"])

    cA, cB = st.columns(2)
    with cA:
        st.markdown(
            f"""<div class="cartao-classificacao">
                <small style="color:#888; letter-spacing:0.1em;">EIXO A · PRODUTOR</small>
                <h2 class="neon-verde" style="margin:0.5rem 0;">{produtor.nome}</h2>
                <p style="color:#ccc; margin:0;"><small>{produtor.definicao}</small></p>
            </div>""",
            unsafe_allow_html=True,
        )
    with cB:
        st.markdown(
            f"""<div class="cartao-classificacao roxo">
                <small style="color:#888; letter-spacing:0.1em;">EIXO B · CONTEÚDO</small>
                <h2 class="neon-roxo" style="margin:0.5rem 0;">{conteudo.nome}</h2>
                <p style="color:#ccc; margin:0;"><small>{conteudo.definicao}</small></p>
            </div>""",
            unsafe_allow_html=True,
        )

    st.markdown("### Justificativa sociológica")
    st.markdown(
        f"""<div style="background:#111; padding:1.5rem; border-radius:4px;
                    border-left: 4px solid #ffffff;">{resultado['justificativa']}</div>""",
        unsafe_allow_html=True,
    )

    with st.expander("🔧 Metadados brutos (para auditoria)"):
        st.json(meta)


# ==============================================================================
# MÓDULO 3 — TERMÔMETRO DO EM ALTA
# ==============================================================================

CORES_PRODUTOR = {
    "midia_tradicional": "#39FF14",
    "produtora_digital": "#27D337",
    "youtuber_profissional": "#b026ff",
    "criador_casual": "#7e6bff",
    "usuario_comum": "#888888",
    "instituicao": "#FFD700",
    "musico": "#FF4FD8",
    "marca": "#FF8C00",
    "reaproveitamento": "#444444",
    "outros": "#666666",
}

CORES_CONTEUDO = {
    "informativo": "#39FF14",
    "entretenimento_roteirizado": "#b026ff",
    "jogos": "#FF4FD8",
    "esportivo": "#FFD700",
    "musical": "#FF8C00",
    "promocional": "#27D337",
    "vlog": "#7e6bff",
    "educativo": "#00CED1",
    "experimental": "#FF1493",
    "outros": "#666666",
}


def renderizar_termometro_publico() -> None:
    st.markdown("# 🌡️ Termômetro do Em Alta")
    st.markdown("##### Auditoria longitudinal da curadoria algorítmica do YouTube Brasil")

    if not SUPABASE_DISPONIVEL:
        st.error(
            "⚠️ A integração com o banco de dados ainda não está configurada. "
            "Esta é uma instalação parcial do Raio-X."
        )
        return

    try:
        cliente = conectar(modo="leitura")
        snapshot_recente = buscar_snapshot_mais_recente(cliente)
    except Exception as e:
        st.error(f"Não foi possível consultar o banco: {e}")
        return

    if not snapshot_recente:
        st.info(
            "📡 **Coleta ainda não iniciada.** O sistema automático começará a "
            "registrar snapshots semanais na próxima execução agendada. "
            "Volte em breve para acompanhar a evolução da composição do trending BR."
        )
    else:
        data_str = snapshot_recente["data_coleta"][:10]
        st.success(
            f"📊 **Última coleta:** {data_str} "
            f"(Semana {snapshot_recente['semana_ano']}, "
            f"{snapshot_recente['dia_semana']} às {snapshot_recente['horario_coleta']}) — "
            f"{snapshot_recente['total_videos_coletados']} vídeos analisados"
        )

    st.markdown("---")
    st.markdown("### Sobre este termômetro")
    st.markdown(
        """
        O Termômetro é um **sistema de coleta longitudinal** que tira uma "fotografia"
        semanal dos 50 vídeos em maior destaque no YouTube Brasil, classifica cada um
        deles segundo a tipologia dupla (Produtor × Conteúdo) desenvolvida na dissertação
        de mestrado de Filipe Severo (PUCRS/FAMECOS, 2026), e armazena o resultado em
        um corpus auditável.

        A frequência de coleta replica a metodologia da pesquisa original
        (**Tabela 02**, Severo, 2026): uma coleta semanal, alternando dias e horários
        ao longo de um ciclo de 14 semanas, para evitar viés temporal.

        **Por que não exibimos o trending em tempo real?** Porque a tese central da
        pesquisa demonstra que a vitrine "Em Alta" do YouTube é uma construção editorial
        corporativa, não um espelho neutro da audiência. Replicar essa vitrine sem
        contexto reproduziria a opacidade que a ferramenta busca desnaturalizar.
        O dado relevante é a **composição estrutural** acumulada ao longo do tempo —
        e isso só fica visível com séries longitudinais.
        """
    )

    st.markdown("---")
    st.markdown("### Acesso ao painel completo")
    st.info(
        "🔒 O painel completo de análise (gráficos, série temporal, busca por canal, "
        "exportação de dados) é restrito a pesquisadores autorizados."
    )

    senha = st.text_input("Senha de acesso", type="password", label_visibility="collapsed")
    if st.button("ACESSAR PAINEL", key="btn_termo_acesso"):
        if not SENHA_PAINEL_INTERNO:
            st.session_state["acesso_painel"] = True
            st.rerun()
        elif senha == SENHA_PAINEL_INTERNO:
            st.session_state["acesso_painel"] = True
            st.rerun()
        else:
            st.error("Senha inválida.")


def renderizar_termometro_painel() -> None:
    st.markdown("# 🌡️ Termômetro — Painel Interno")
    st.markdown("##### Análise sociológica da curadoria algorítmica do YouTube Brasil")

    col_voltar, _ = st.columns([1, 5])
    with col_voltar:
        if st.button("← VOLTAR", key="btn_termo_voltar"):
            st.session_state["acesso_painel"] = False
            st.rerun()

    try:
        cliente = conectar(modo="leitura")
        snapshots = listar_snapshots(cliente)
    except Exception as e:
        st.error(f"Erro ao conectar ao banco: {e}")
        return

    if not snapshots:
        st.warning(
            "📡 Nenhuma coleta encontrada. Execute o coletor pela primeira vez "
            "(GitHub → aba Actions → 'Coleta Semanal' → 'Run workflow') "
            "para popular o banco."
        )
        return

    st.success(f"📊 {len(snapshots)} snapshot(s) disponível(is) no corpus.")

    tab_atual, tab_serie, tab_canais, tab_exportar = st.tabs([
        "📸 Snapshot atual",
        "📈 Série temporal",
        "🏢 Canais",
        "💾 Exportar dados",
    ])

    # === ABA 1: SNAPSHOT ATUAL ===
    with tab_atual:
        opcoes = {
            f"#{s['id']} — {s['data_coleta'][:10]} ({s['dia_semana']} {s['horario_coleta']})": s["id"]
            for s in snapshots
        }
        escolha = st.selectbox("Snapshot a examinar", options=list(opcoes.keys()), index=0)
        snapshot_id = opcoes[escolha]
        videos = videos_do_snapshot(cliente, snapshot_id)

        if not videos:
            st.warning("Snapshot vazio.")
            return

        df = pd.DataFrame(videos)

        st.markdown("### Composição estrutural")

        codigos_elite = ["midia_tradicional", "produtora_digital", "youtuber_profissional", "musico"]
        elite_n = df[df["tipo_produtor"].isin(codigos_elite)].shape[0]
        elite_pct = (elite_n / len(df)) * 100
        usuario_comum_n = df[df["tipo_produtor"] == "usuario_comum"].shape[0]
        canais_unicos = df["canal_id"].nunique()

        c1, c2, c3, c4 = st.columns(4)
        c1.metric("Vídeos analisados", len(df))
        c2.metric("Canais únicos", canais_unicos)
        c3.metric("% Elite profissionalizada", f"{elite_pct:.1f}%")
        c4.metric("% Usuário comum", f"{(usuario_comum_n/len(df))*100:.1f}%")

        st.markdown("---")

        cA, cB = st.columns(2)
        with cA:
            st.markdown("#### Eixo A — Quem produz?")
            cont_a = df["tipo_produtor"].value_counts().reset_index()
            cont_a.columns = ["codigo", "n"]
            cont_a["nome"] = cont_a["codigo"].apply(
                lambda c: buscar_produtor(c).nome if buscar_produtor(c) else c
            )
            fig_a = px.bar(
                cont_a, x="n", y="nome", orientation="h",
                color="codigo", color_discrete_map=CORES_PRODUTOR,
                template="plotly_dark", labels={"n": "Vídeos", "nome": ""},
            )
            fig_a.update_layout(
                paper_bgcolor="#0a0a0a", plot_bgcolor="#0a0a0a",
                showlegend=False, height=400,
                yaxis={"categoryorder": "total ascending"},
            )
            st.plotly_chart(fig_a, use_container_width=True)

        with cB:
            st.markdown("#### Eixo B — Que gênero de trabalho?")
            cont_b = df["tipo_conteudo"].value_counts().reset_index()
            cont_b.columns = ["codigo", "n"]
            cont_b["nome"] = cont_b["codigo"].apply(
                lambda c: buscar_conteudo(c).nome if buscar_conteudo(c) else c
            )
            fig_b = px.bar(
                cont_b, x="n", y="nome", orientation="h",
                color="codigo", color_discrete_map=CORES_CONTEUDO,
                template="plotly_dark", labels={"n": "Vídeos", "nome": ""},
            )
            fig_b.update_layout(
                paper_bgcolor="#0a0a0a", plot_bgcolor="#0a0a0a",
                showlegend=False, height=400,
                yaxis={"categoryorder": "total ascending"},
            )
            st.plotly_chart(fig_b, use_container_width=True)

        st.markdown("#### Cruzamento Produtor × Conteúdo")
        st.caption("Replica metodologia do Gráfico 11 (Severo, 2026, p. 80).")
        cruzamento = pd.crosstab(df["tipo_produtor"], df["tipo_conteudo"])
        fig_heat = px.imshow(
            cruzamento, template="plotly_dark",
            color_continuous_scale=["#0a0a0a", "#39FF14"],
            aspect="auto", labels={"color": "Vídeos"},
        )
        fig_heat.update_layout(paper_bgcolor="#0a0a0a", plot_bgcolor="#0a0a0a", height=500)
        st.plotly_chart(fig_heat, use_container_width=True)

        st.markdown("#### Vídeos do snapshot")
        df_exibir = df[["posicao_ranking", "canal_nome", "titulo",
                        "tipo_produtor", "tipo_conteudo",
                        "visualizacoes", "duracao_segundos"]].copy()
        df_exibir.columns = ["#", "Canal", "Título", "Produtor", "Conteúdo", "Views", "Duração (s)"]
        st.dataframe(df_exibir, use_container_width=True, hide_index=True)

    # === ABA 2: SÉRIE TEMPORAL ===
    with tab_serie:
        st.markdown("### Evolução longitudinal do trending BR")

        if len(snapshots) < 2:
            st.info(
                f"📈 A série temporal precisa de pelo menos 2 snapshots. "
                f"Você tem {len(snapshots)}. Aguarde a próxima coleta automatizada "
                "ou execute manualmente pelo GitHub Actions."
            )
            return

        with st.spinner("Carregando corpus completo..."):
            todos = todos_videos_para_serie_temporal(cliente)

        df_t = pd.DataFrame(todos)
        df_t["data_coleta"] = df_t["snapshots"].apply(
            lambda s: s["data_coleta"][:10] if s else None
        )
        df_t = df_t.dropna(subset=["data_coleta"])

        st.markdown("#### Composição por Tipo de Produtor (% por snapshot)")
        comp_a = df_t.groupby(["data_coleta", "tipo_produtor"]).size().reset_index(name="n")
        total_a = comp_a.groupby("data_coleta")["n"].transform("sum")
        comp_a["percentual"] = (comp_a["n"] / total_a) * 100

        fig_serie_a = px.area(
            comp_a, x="data_coleta", y="percentual", color="tipo_produtor",
            color_discrete_map=CORES_PRODUTOR, template="plotly_dark",
            labels={"data_coleta": "Coleta", "percentual": "% do trending"},
        )
        fig_serie_a.update_layout(paper_bgcolor="#0a0a0a", plot_bgcolor="#0a0a0a", height=450)
        st.plotly_chart(fig_serie_a, use_container_width=True)

        st.markdown("#### Composição por Tipo de Conteúdo (% por snapshot)")
        comp_b = df_t.groupby(["data_coleta", "tipo_conteudo"]).size().reset_index(name="n")
        total_b = comp_b.groupby("data_coleta")["n"].transform("sum")
        comp_b["percentual"] = (comp_b["n"] / total_b) * 100

        fig_serie_b = px.area(
            comp_b, x="data_coleta", y="percentual", color="tipo_conteudo",
            color_discrete_map=CORES_CONTEUDO, template="plotly_dark",
            labels={"data_coleta": "Coleta", "percentual": "% do trending"},
        )
        fig_serie_b.update_layout(paper_bgcolor="#0a0a0a", plot_bgcolor="#0a0a0a", height=450)
        st.plotly_chart(fig_serie_b, use_container_width=True)

    # === ABA 3: CANAIS ===
    with tab_canais:
        st.markdown("### Canais que mais aparecem no trending")
        st.caption("Replica análise do Gráfico 03 (Severo, 2026, p. 69).")

        with st.spinner("Calculando recorrências..."):
            todos = todos_videos_para_serie_temporal(cliente)

        df_c = pd.DataFrame(todos)
        if df_c.empty:
            st.info("Sem dados ainda.")
            return

        recorrencia = (
            df_c.groupby(["canal_id", "canal_nome", "tipo_produtor"])
            .size().reset_index(name="aparicoes")
            .sort_values("aparicoes", ascending=False).head(30)
        )
        recorrencia["produtor_nome"] = recorrencia["tipo_produtor"].apply(
            lambda c: buscar_produtor(c).nome if buscar_produtor(c) else c
        )

        fig_canais = px.bar(
            recorrencia, x="aparicoes", y="canal_nome", orientation="h",
            color="tipo_produtor", color_discrete_map=CORES_PRODUTOR,
            template="plotly_dark", hover_data=["produtor_nome"],
            labels={"aparicoes": "Aparições no corpus", "canal_nome": ""},
        )
        fig_canais.update_layout(
            paper_bgcolor="#0a0a0a", plot_bgcolor="#0a0a0a", height=700,
            yaxis={"categoryorder": "total ascending"},
        )
        st.plotly_chart(fig_canais, use_container_width=True)

    # === ABA 4: EXPORTAR ===
    with tab_exportar:
        st.markdown("### Exportar corpus")
        st.markdown(
            "Baixe os dados completos em CSV para análise estatística avançada "
            "(SPSS, R, Python, Excel)."
        )

        with st.spinner("Preparando arquivo..."):
            todos = todos_videos_para_serie_temporal(cliente)

        df_exp = pd.DataFrame(todos)
        if df_exp.empty:
            st.info("Sem dados para exportar.")
            return

        df_exp["data_coleta"] = df_exp["snapshots"].apply(lambda s: s["data_coleta"] if s else None)
        df_exp["semana_ano"] = df_exp["snapshots"].apply(lambda s: s["semana_ano"] if s else None)
        df_exp = df_exp.drop(columns=["snapshots"])

        csv = df_exp.to_csv(index=False).encode("utf-8")
        st.download_button(
            label="📥 Baixar CSV completo",
            data=csv,
            file_name=f"raio-x-corpus-{datetime.now().strftime('%Y-%m-%d')}.csv",
            mime="text/csv",
        )

        st.markdown(f"**Total de registros:** {len(df_exp)}")


def renderizar_termometro() -> None:
    if st.session_state.get("acesso_painel", False):
        renderizar_termometro_painel()
    else:
        renderizar_termometro_publico()


# ==============================================================================
# MÓDULO 4 — DISPUTA DE NARRATIVA
# ==============================================================================
#
# Auditoria de autoridade algorítmica em temas sensíveis. Responde:
#   "Para quem o YouTube está dando o microfone neste tema?"
#
# Diferencial sociológico:
#   - Detecta DESVIO da composição em relação ao Termômetro (linha de base)
#   - Identifica VOZES AUSENTES (categorias estatisticamente apagadas)
#   - Acumula corpus longitudinal de termos auditados
#
# Custo: search.list = 100 unidades/cota. Cache de 7 dias é OBRIGATÓRIO.
# ==============================================================================

# Sugestões iniciais — termos editáveis, organizados por eixo de disputa
SUGESTOES_BUSCA = {
    "🔨 Mundo do trabalho": [
        "reforma trabalhista",
        "uberização do trabalho",
        "aplicativos de entrega",
        "direitos do trabalhador",
        "sindicato",
    ],
    "⚖️ Justiça e instituições": [
        "STF",
        "lava jato",
        "aborto legal",
        "segurança pública",
        "polícia militar",
    ],
    "🌎 Disputas socioambientais": [
        "demarcação terras indígenas",
        "garimpo ilegal",
        "agronegócio",
        "mudanças climáticas",
        "MST",
    ],
    "✊ Identidade e representação": [
        "cotas raciais",
        "racismo estrutural",
        "feminismo",
        "comunidade LGBT",
        "representatividade",
    ],
}

LIMITE_BUSCAS_POR_SESSAO = 3
DIAS_VALIDADE_CACHE = 7


def gerar_pergunta_humana() -> tuple[str, int]:
    """Gera uma pergunta matemática simples para barrar bots básicos."""
    a = random.randint(2, 9)
    b = random.randint(2, 9)
    return f"Para confirmar que você é humano, quanto é {a} + {b}?", a + b


def buscar_no_youtube(termo: str, max_resultados: int = 50) -> list[dict]:
    """
    Executa search.list — CUSTO: 100 unidades de cota da YouTube API.
    Retorna vídeos, canais e playlists misturados por relevância.
    """
    url = "https://www.googleapis.com/youtube/v3/search"
    params = {
        "q": termo,
        "part": "snippet",
        "type": "video,channel,playlist",
        "regionCode": "BR",
        "relevanceLanguage": "pt",
        "maxResults": max_resultados,
        "key": YOUTUBE_API_KEY,
    }
    resp = requests.get(url, params=params, timeout=15)
    resp.raise_for_status()
    return resp.json().get("items", [])


def enriquecer_metadados_video(video_ids: list[str]) -> dict[str, dict]:
    """Pega estatísticas e duração de uma lista de vídeos. Custo: 1 unidade/50."""
    if not video_ids:
        return {}
    resp = requests.get(
        "https://www.googleapis.com/youtube/v3/videos",
        params={
            "id": ",".join(video_ids[:50]),
            "part": "snippet,statistics,contentDetails",
            "key": YOUTUBE_API_KEY,
        },
        timeout=15,
    )
    resp.raise_for_status()
    return {item["id"]: item for item in resp.json().get("items", [])}


def enriquecer_metadados_canais(canal_ids: list[str]) -> dict[str, dict]:
    """Pega descrição e contagens de uma lista de canais. Custo: 1 unidade/50."""
    if not canal_ids:
        return {}
    resp = requests.get(
        "https://www.googleapis.com/youtube/v3/channels",
        params={
            "id": ",".join(canal_ids[:50]),
            "part": "snippet,statistics",
            "key": YOUTUBE_API_KEY,
        },
        timeout=15,
    )
    resp.raise_for_status()
    return {item["id"]: item for item in resp.json().get("items", [])}


def classificar_resultado_busca(item: dict, dados_extras: dict) -> dict:
    """
    Classifica um item da busca (vídeo, canal ou playlist) na tipologia dupla.
    Reusa o mesmo prompt sociológico dos outros módulos para consistência.
    """
    cliente = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    tipo_item = item["id"]["kind"].replace("youtube#", "")  # video, channel, playlist
    snippet = item["snippet"]

    # Constrói payload conforme o tipo
    if tipo_item == "video":
        meta_video = dados_extras.get("video", {})
        meta_canal = dados_extras.get("canal", {})
        stats_v = meta_video.get("statistics", {})
        stats_c = meta_canal.get("statistics", {})
        payload = f"""TIPO DE ITEM: VÍDEO
- Título: {snippet['title']}
- Canal: {snippet['channelTitle']}
- Inscritos do canal: {int(stats_c.get('subscriberCount', 0)):,}
- Total de vídeos do canal: {int(stats_c.get('videoCount', 0)):,}
- Visualizações: {int(stats_v.get('viewCount', 0)):,}
- Descrição do canal: {meta_canal.get('snippet', {}).get('description', '')[:1000]}
- Descrição do vídeo: {snippet.get('description', '')[:1500]}
"""
    elif tipo_item == "channel":
        stats_c = dados_extras.get("canal", {}).get("statistics", {})
        payload = f"""TIPO DE ITEM: CANAL
- Nome do canal: {snippet['title']}
- Inscritos: {int(stats_c.get('subscriberCount', 0)):,}
- Total de vídeos: {int(stats_c.get('videoCount', 0)):,}
- Descrição: {snippet.get('description', '')[:2000]}
"""
    else:  # playlist
        payload = f"""TIPO DE ITEM: PLAYLIST
- Título: {snippet['title']}
- Canal organizador: {snippet['channelTitle']}
- Descrição: {snippet.get('description', '')[:1500]}
"""

    prompt_sistema = f"""Você é um pesquisador especialista em Estudos de Plataforma, \
trabalhando para o Observatório Classe Creator. Classifique o ITEM abaixo \
(que pode ser um vídeo, canal ou playlist do YouTube) usando a tipologia dupla \
desenvolvida na pesquisa de Filipe Severo (PUCRS/FAMECOS, 2026).

==========
{tipologia_para_prompt()}
==========

REGRAS:
1. Escolha exatamente UMA categoria do Eixo A e UMA do Eixo B.
2. Categorias mutuamente exclusivas. Use "outros" só em último caso.
3. Para CANAIS e PLAYLISTS, classifique segundo a estrutura geral do produtor.
4. Justificativa SOCIOLÓGICA, não descritiva.
5. Se um canal tem nome de pessoa famosa de TV mas opera no YouTube como individual, \
prefira 'youtuber_profissional' apenas se há evidência de equipe e produção dedicada \
ao YouTube; caso contrário, 'midia_tradicional' se ainda mantém vínculo com emissora.

FORMATO: APENAS JSON válido, sem markdown:
{{
  "tipo_produtor": "<código exato do Eixo A>",
  "tipo_conteudo": "<código exato do Eixo B>",
  "justificativa": "<2 a 4 frases analíticas>"
}}

CÓDIGOS Eixo A: {", ".join(codigos_produtor())}
CÓDIGOS Eixo B: {", ".join(codigos_conteudo())}
"""

    resposta = cliente.messages.create(
        model="claude-haiku-4-5",
        max_tokens=600,
        system=prompt_sistema,
        messages=[{"role": "user", "content": payload}],
    )

    texto = resposta.content[0].text.strip()
    texto = re.sub(r"^```(?:json)?\s*|\s*```$", "", texto, flags=re.MULTILINE).strip()
    resultado = json.loads(texto)

    if resultado["tipo_produtor"] not in codigos_produtor():
        raise ValueError(f"Código de produtor inválido: {resultado['tipo_produtor']}")
    if resultado["tipo_conteudo"] not in codigos_conteudo():
        raise ValueError(f"Código de conteúdo inválido: {resultado['tipo_conteudo']}")

    return resultado


def executar_busca_completa(termo: str, cliente_db) -> dict | None:
    """
    Pipeline completo de uma busca: API → enriquecimento → classificação → persistência.
    Retorna o ID da busca registrada, ou None em caso de erro.
    """
    # 1. Busca na API do YouTube
    items = buscar_no_youtube(termo, max_resultados=50)
    if not items:
        st.warning("Nenhum resultado retornado pelo YouTube para este termo.")
        return None

    # 2. Separa IDs por tipo para enriquecimento eficiente
    video_ids = [it["id"]["videoId"] for it in items if it["id"]["kind"] == "youtube#video"]
    canal_ids_diretos = [it["id"]["channelId"] for it in items if it["id"]["kind"] == "youtube#channel"]
    canais_de_videos = list({it["snippet"]["channelId"] for it in items if it["id"]["kind"] == "youtube#video"})
    todos_canais = list(set(canal_ids_diretos + canais_de_videos))

    # 3. Enriquecimento em batch
    with st.spinner("Enriquecendo metadados (1/3)..."):
        videos_enriq = enriquecer_metadados_video(video_ids)
    with st.spinner("Enriquecendo metadados (2/3)..."):
        canais_enriq = enriquecer_metadados_canais(todos_canais)

    # 4. Classificação item a item
    classificacoes = []
    progresso = st.progress(0, text="Classificando resultados...")
    for i, item in enumerate(items):
        kind = item["id"]["kind"]
        if kind == "youtube#video":
            vid = item["id"]["videoId"]
            cid = item["snippet"]["channelId"]
            dados_extras = {
                "video": videos_enriq.get(vid, {}),
                "canal": canais_enriq.get(cid, {}),
            }
            tipo_item = "video"
            item_id = vid
        elif kind == "youtube#channel":
            cid = item["id"]["channelId"]
            dados_extras = {"canal": canais_enriq.get(cid, {})}
            tipo_item = "channel"
            item_id = cid
        else:
            dados_extras = {}
            tipo_item = "playlist"
            item_id = item["id"].get("playlistId", "")

        try:
            classif = classificar_resultado_busca(item, dados_extras)
        except Exception as e:
            classif = {
                "tipo_produtor": "outros",
                "tipo_conteudo": "outros",
                "justificativa": f"Falha na classificação automática: {e}",
            }

        canal_id_final = item["snippet"].get("channelId", "")
        canal_nome_final = item["snippet"].get("channelTitle", "")

        # Para canal direto, o "canal_id" é o próprio item
        if tipo_item == "channel":
            canal_id_final = item_id
            canal_nome_final = item["snippet"]["title"]

        classificacoes.append({
            "posicao": i + 1,
            "tipo_item": tipo_item,
            "item_id": item_id,
            "titulo": item["snippet"]["title"],
            "canal_id": canal_id_final,
            "canal_nome": canal_nome_final,
            "tipo_produtor": classif["tipo_produtor"],
            "tipo_conteudo": classif["tipo_conteudo"],
            "justificativa": classif["justificativa"],
        })

        progresso.progress((i + 1) / len(items), text=f"Classificando ({i+1}/{len(items)})...")

    progresso.empty()

    # 5. Calcular composições para registro agregado
    from collections import Counter
    contagem_p = Counter(c["tipo_produtor"] for c in classificacoes)
    contagem_c = Counter(c["tipo_conteudo"] for c in classificacoes)

    # 6. Persistir busca (cabeçalho)
    busca_id = registrar_busca(
        cliente_db,
        termo=termo,
        tipo_resultado="video,channel,playlist",
        total_resultados_analisados=len(classificacoes),
        composicao_produtor_json=json.dumps(dict(contagem_p)),
        composicao_conteudo_json=json.dumps(dict(contagem_c)),
    )

    # 7. Persistir resultados
    for c in classificacoes:
        gravar_resultado_busca(
            cliente_db,
            busca_id=busca_id,
            posicao=c["posicao"],
            tipo_item=c["tipo_item"],
            item_id=c["item_id"],
            titulo=c["titulo"],
            canal_id=c["canal_id"],
            canal_nome=c["canal_nome"],
            tipo_produtor=c["tipo_produtor"],
            tipo_conteudo=c["tipo_conteudo"],
            justificativa=c["justificativa"],
        )

    return busca_id


def renderizar_resultados_disputa(termo: str, busca_id: int, do_cache: bool, cliente_db) -> None:
    """Renderiza visualização sociológica completa de uma busca."""
    resultados = resultados_de_busca(cliente_db, busca_id)
    if not resultados:
        st.warning("Sem resultados para exibir.")
        return

    df = pd.DataFrame(resultados)

    if do_cache:
        st.info("⚡ Resultados recuperados do cache (busca recente). Zero custo de API.")

    st.markdown(f"## Diagnóstico: \"{termo}\"")
    st.caption(f"{len(df)} itens analisados | Busca #{busca_id}")

    # =========================================================================
    # MÉTRICAS-CHAVE — quem ganhou o microfone?
    # =========================================================================
    elite = ["midia_tradicional", "produtora_digital", "youtuber_profissional"]
    institucional = ["instituicao"]
    invisibilizado = ["usuario_comum", "criador_casual"]

    n = len(df)
    pct_elite = (df["tipo_produtor"].isin(elite).sum() / n) * 100
    pct_inst = (df["tipo_produtor"].isin(institucional).sum() / n) * 100
    pct_midia_trad = (df["tipo_produtor"] == "midia_tradicional").sum() / n * 100
    pct_invis = (df["tipo_produtor"].isin(invisibilizado).sum() / n) * 100

    st.markdown("### Quem ganhou o microfone?")
    c1, c2, c3, c4 = st.columns(4)
    c1.metric("% Mídia tradicional", f"{pct_midia_trad:.0f}%")
    c2.metric("% Elite profissionalizada", f"{pct_elite:.0f}%")
    c3.metric("% Instituições / sociedade civil", f"{pct_inst:.0f}%")
    c4.metric("% Vozes amadoras", f"{pct_invis:.0f}%")

    # =========================================================================
    # DESVIO EDITORIAL — comparação com linha de base do Termômetro
    # =========================================================================
    st.markdown("---")
    st.markdown("### Desvio em relação à linha de base do trending")
    st.caption(
        "Compara a composição desta busca com a composição MÉDIA dos snapshots do "
        "Termômetro. Desvios significativos indicam tratamento editorial diferenciado "
        "do algoritmo para este tema."
    )

    try:
        baseline = composicao_media_termometro(cliente_db)
    except Exception:
        baseline = {}

    if not baseline:
        st.info(
            "📊 A linha de base ainda está sendo construída (precisa de mais snapshots "
            "do Termômetro). Volte em algumas semanas para ver a comparação."
        )
    else:
        comp_atual = (df["tipo_produtor"].value_counts() / len(df) * 100).to_dict()

        linhas = []
        for codigo in codigos_produtor():
            base = baseline.get(codigo, 0)
            atual = comp_atual.get(codigo, 0)
            desvio = atual - base
            cat = buscar_produtor(codigo)
            if cat:
                linhas.append({
                    "Categoria": cat.nome,
                    "% nesta busca": atual,
                    "% médio (Termômetro)": base,
                    "Desvio (pontos %)": desvio,
                })

        df_desvio = pd.DataFrame(linhas).sort_values("Desvio (pontos %)", key=abs, ascending=False)

        # Sinaliza desvios fortes (> 15 pontos percentuais)
        desvios_relevantes = df_desvio[df_desvio["Desvio (pontos %)"].abs() > 15]
        if not desvios_relevantes.empty:
            for _, row in desvios_relevantes.iterrows():
                if row["Desvio (pontos %)"] > 0:
                    st.warning(
                        f"📈 **{row['Categoria']}** está SUPER-REPRESENTADA neste tema: "
                        f"+{row['Desvio (pontos %)']:.0f} pontos percentuais acima da média do trending."
                    )
                else:
                    st.info(
                        f"📉 **{row['Categoria']}** está SUB-REPRESENTADA neste tema: "
                        f"{row['Desvio (pontos %)']:.0f} pontos percentuais abaixo da média do trending."
                    )

        st.dataframe(
            df_desvio.style.format({
                "% nesta busca": "{:.1f}%",
                "% médio (Termômetro)": "{:.1f}%",
                "Desvio (pontos %)": "{:+.1f}",
            }),
            use_container_width=True, hide_index=True,
        )

    # =========================================================================
    # GRÁFICOS DE COMPOSIÇÃO
    # =========================================================================
    st.markdown("---")
    st.markdown("### Composição estrutural")

    cA, cB = st.columns(2)
    with cA:
        st.markdown("#### Por tipo de produtor")
        cont_a = df["tipo_produtor"].value_counts().reset_index()
        cont_a.columns = ["codigo", "n"]
        cont_a["nome"] = cont_a["codigo"].apply(
            lambda c: buscar_produtor(c).nome if buscar_produtor(c) else c
        )
        fig_a = px.bar(
            cont_a, x="n", y="nome", orientation="h",
            color="codigo", color_discrete_map=CORES_PRODUTOR,
            template="plotly_dark", labels={"n": "Itens", "nome": ""},
        )
        fig_a.update_layout(
            paper_bgcolor="#0a0a0a", plot_bgcolor="#0a0a0a",
            showlegend=False, height=400,
            yaxis={"categoryorder": "total ascending"},
        )
        st.plotly_chart(fig_a, use_container_width=True)

    with cB:
        st.markdown("#### Por tipo de conteúdo")
        cont_b = df["tipo_conteudo"].value_counts().reset_index()
        cont_b.columns = ["codigo", "n"]
        cont_b["nome"] = cont_b["codigo"].apply(
            lambda c: buscar_conteudo(c).nome if buscar_conteudo(c) else c
        )
        fig_b = px.bar(
            cont_b, x="n", y="nome", orientation="h",
            color="codigo", color_discrete_map=CORES_CONTEUDO,
            template="plotly_dark", labels={"n": "Itens", "nome": ""},
        )
        fig_b.update_layout(
            paper_bgcolor="#0a0a0a", plot_bgcolor="#0a0a0a",
            showlegend=False, height=400,
            yaxis={"categoryorder": "total ascending"},
        )
        st.plotly_chart(fig_b, use_container_width=True)

    # =========================================================================
    # VOZES AUSENTES
    # =========================================================================
    st.markdown("---")
    st.markdown("### 🔇 Vozes ausentes")
    st.caption(
        "Categorias com ZERO ou quase zero representação podem indicar "
        "invisibilização algorítmica neste tema."
    )

    presentes = set(df["tipo_produtor"].unique())
    ausentes_p = [
        buscar_produtor(c).nome
        for c in codigos_produtor()
        if c not in presentes and buscar_produtor(c) and c != "outros"
    ]
    if ausentes_p:
        st.markdown(
            f"**Tipos de produtor totalmente ausentes:** "
            f"{', '.join(ausentes_p)}"
        )
    else:
        st.info("Todas as categorias de produtor têm pelo menos uma representação.")

    # =========================================================================
    # RANKING POR POSIÇÃO
    # =========================================================================
    st.markdown("---")
    st.markdown("### Ranking dos resultados")

    # Filtros
    col_filtro_tipo, col_filtro_prod = st.columns(2)
    with col_filtro_tipo:
        filtro_item = st.multiselect(
            "Tipo de item",
            options=["video", "channel", "playlist"],
            default=["video", "channel", "playlist"],
        )
    with col_filtro_prod:
        opcoes_prod = sorted(df["tipo_produtor"].unique())
        filtro_prod = st.multiselect(
            "Tipo de produtor",
            options=opcoes_prod,
            default=opcoes_prod,
        )

    df_filtrado = df[df["tipo_item"].isin(filtro_item) & df["tipo_produtor"].isin(filtro_prod)]
    df_exibir = df_filtrado[[
        "posicao_ranking", "tipo_item", "canal_nome", "titulo",
        "tipo_produtor", "tipo_conteudo"
    ]].copy()
    df_exibir.columns = ["#", "Tipo", "Canal", "Título", "Produtor", "Conteúdo"]
    st.dataframe(df_exibir, use_container_width=True, hide_index=True)

    # =========================================================================
    # EXPORTAR
    # =========================================================================
    csv = df.to_csv(index=False).encode("utf-8")
    st.download_button(
        label="📥 Baixar CSV desta busca",
        data=csv,
        file_name=f"raio-x-disputa-{termo[:30].replace(' ', '_')}-{datetime.now().strftime('%Y-%m-%d')}.csv",
        mime="text/csv",
    )


def renderizar_disputa_narrativa() -> None:
    st.markdown("# ⚔️ Disputa de Narrativa")
    st.markdown("##### Para quem o YouTube está dando o microfone?")
    st.markdown(
        "Este módulo audita a **autoridade algorítmica** em temas sensíveis. "
        "Você fornece um termo de busca; a ferramenta extrai os 50 primeiros "
        "resultados retornados pela API do YouTube e classifica cada um na "
        "**tipologia dupla** desenvolvida na pesquisa *O Novo 'You' do YouTube* "
        "(SEVERO, 2026)."
    )

    if not SUPABASE_DISPONIVEL:
        st.error("⚠️ Banco de dados não configurado.")
        return

    try:
        cliente_db = conectar(modo="leitura")
    except Exception as e:
        st.error(f"Não foi possível conectar ao banco: {e}")
        return

    # Inicializar contador de buscas na sessão
    if "buscas_feitas" not in st.session_state:
        st.session_state["buscas_feitas"] = 0
    if "humano_validado" not in st.session_state:
        st.session_state["humano_validado"] = False
    if "pergunta_humana" not in st.session_state:
        pergunta, resposta = gerar_pergunta_humana()
        st.session_state["pergunta_humana"] = pergunta
        st.session_state["resposta_humana"] = resposta

    # =========================================================================
    # BARRA DE STATUS DA SESSÃO
    # =========================================================================
    restantes = LIMITE_BUSCAS_POR_SESSAO - st.session_state["buscas_feitas"]
    if restantes > 0:
        st.markdown(
            f"<div style='background:#111; padding:0.7rem; border-radius:4px; "
            f"border-left:3px solid #39FF14;'>"
            f"<small style='color:#888;'>SUA SESSÃO</small> · "
            f"<span class='neon-verde'>{restantes}</span> "
            f"busca(s) restante(s) nesta sessão</div>",
            unsafe_allow_html=True,
        )
    else:
        st.warning(
            f"⛔ Você atingiu o limite de {LIMITE_BUSCAS_POR_SESSAO} buscas por sessão. "
            "Recarregue a página para continuar (ou aguarde nossas atualizações de "
            "acesso institucional para pesquisadores)."
        )

    # =========================================================================
    # SUGESTÕES INICIAIS
    # =========================================================================
    with st.expander("💡 Sugestões de termos para começar (clique para expandir)"):
        st.markdown(
            "Termos curados pela equipe do Observatório, organizados por eixo de "
            "disputa social. Edite livremente antes de buscar."
        )
        for grupo, termos in SUGESTOES_BUSCA.items():
            st.markdown(f"**{grupo}**")
            cols = st.columns(len(termos))
            for col, termo in zip(cols, termos):
                if col.button(termo, key=f"sug_{termo}", use_container_width=True):
                    st.session_state["termo_sugerido"] = termo
                    st.rerun()

    # =========================================================================
    # FORMULÁRIO DE BUSCA
    # =========================================================================
    st.markdown("---")
    termo_inicial = st.session_state.pop("termo_sugerido", "")
    termo = st.text_input(
        "Termo de busca",
        value=termo_inicial,
        placeholder="Ex: reforma trabalhista, cotas raciais, MST...",
    )

    # Verificação humana (uma vez por sessão)
    if not st.session_state["humano_validado"]:
        col_p, col_r = st.columns([3, 1])
        with col_p:
            st.markdown(f"**{st.session_state['pergunta_humana']}**")
        with col_r:
            resposta_user = st.text_input(
                "Sua resposta", key="resp_humana", label_visibility="collapsed"
            )

    botao = st.button(
        "AUDITAR ESTE TEMA",
        disabled=(restantes <= 0),
        use_container_width=False,
        key="btn_disputa",
    )

    if not (botao and termo.strip()):
        return

    # Validação anti-bot
    if not st.session_state["humano_validado"]:
        try:
            if int(resposta_user.strip()) == st.session_state["resposta_humana"]:
                st.session_state["humano_validado"] = True
            else:
                st.error("Resposta incorreta à pergunta de verificação. Tente novamente.")
                return
        except (ValueError, AttributeError):
            st.error("Por favor, responda à pergunta de verificação humana.")
            return

    # =========================================================================
    # EXECUÇÃO DA BUSCA
    # =========================================================================
    termo_norm = termo.strip().lower()

    # Verifica cache primeiro
    cache = buscar_cache_busca(cliente_db, termo_norm, "video,channel,playlist", DIAS_VALIDADE_CACHE)

    if cache:
        renderizar_resultados_disputa(termo_norm, cache["id"], do_cache=True, cliente_db=cliente_db)
        # NÃO conta como busca consumida quando vem do cache
        return

    # Sem cache: executa busca real
    st.session_state["buscas_feitas"] += 1
    try:
        with st.spinner(f"Auditando '{termo_norm}'... Isso pode levar 1-2 minutos."):
            busca_id = executar_busca_completa(termo_norm, cliente_db)
    except requests.HTTPError as e:
        st.error(
            f"Erro na consulta ao YouTube: {e}. "
            "Pode ser cota diária esgotada (search.list custa 100 unidades)."
        )
        return
    except Exception as e:
        st.error(f"Erro inesperado: {e}")
        return

    if busca_id:
        st.success("✅ Auditoria concluída e adicionada ao corpus do Observatório.")
        renderizar_resultados_disputa(termo_norm, busca_id, do_cache=False, cliente_db=cliente_db)


# ==============================================================================
# MÓDULO 2 — DOSSIÊ DO CANAL
# ==============================================================================
#
# Investigação estrutural de produtores. Responde:
#   "Quem realmente está por trás deste canal?"
#
# Diferenciais sociológicos:
#   - Detecção de SINTOMAS ESTRUTURAIS objetivos (frequência, duração,
#     padronização, equipe, links de rede)
#   - Confronto AUTO-NARRATIVA (descrição) × REALIDADE (classificação LLM)
#   - Mapeamento da REDE DE CANAIS (channelSections — coligações de produtoras)
#   - Cruzamento com Termômetro e Disputa de Narrativa (presença histórica)
#   - Modelo híbrido: Haiku classifica, Sonnet emite veredito final
#
# Custo: ~5 unidades de cota YouTube + ~50 chamadas Haiku + 1 Sonnet ≈ R$ 1
# ==============================================================================

LIMITE_DOSSIES_POR_SESSAO = 5
DIAS_VALIDADE_DOSSIE = 14


def extrair_canal_id(url_ou_handle: str) -> tuple[str, str] | None:
    """
    Aceita variados formatos de identificador de canal:
      - URL: youtube.com/channel/UCxxxxx
      - URL: youtube.com/@handle
      - URL: youtube.com/c/CustomName  (legado)
      - URL: youtube.com/user/UserName  (legado)
      - Handle puro: @handle
      - ID puro: UCxxxxx (24 chars começando com UC)

    Retorna: (tipo, valor) onde tipo ∈ {'id', 'handle', 'username', 'custom'}
    ou None se não for possível identificar.
    """
    s = url_ou_handle.strip()

    # ID direto (UCxxxxx, 24 caracteres)
    if re.fullmatch(r"UC[A-Za-z0-9_-]{22}", s):
        return ("id", s)

    # Handle puro
    if s.startswith("@"):
        return ("handle", s[1:])

    # URL com /channel/UCxxxx
    m = re.search(r"youtube\.com/channel/(UC[A-Za-z0-9_-]{22})", s)
    if m:
        return ("id", m.group(1))

    # URL com @handle
    m = re.search(r"youtube\.com/@([A-Za-z0-9._-]+)", s)
    if m:
        return ("handle", m.group(1))

    # URL com /c/nome (custom URL legado)
    m = re.search(r"youtube\.com/c/([A-Za-z0-9._-]+)", s)
    if m:
        return ("custom", m.group(1))

    # URL com /user/nome (username legado)
    m = re.search(r"youtube\.com/user/([A-Za-z0-9._-]+)", s)
    if m:
        return ("username", m.group(1))

    return None


def resolver_canal_id(tipo: str, valor: str) -> dict | None:
    """
    Converte qualquer identificador em metadados completos do canal,
    incluindo channelId real (UCxxxx). Custo: 1 unidade.
    """
    base = "https://www.googleapis.com/youtube/v3/channels"

    if tipo == "id":
        params = {"id": valor, "part": "snippet,statistics,contentDetails", "key": YOUTUBE_API_KEY}
    elif tipo == "handle":
        params = {"forHandle": f"@{valor}", "part": "snippet,statistics,contentDetails", "key": YOUTUBE_API_KEY}
    elif tipo == "username":
        params = {"forUsername": valor, "part": "snippet,statistics,contentDetails", "key": YOUTUBE_API_KEY}
    else:
        # custom URL: precisamos buscar via search
        return resolver_canal_via_busca(valor)

    resp = requests.get(base, params=params, timeout=15)
    resp.raise_for_status()
    items = resp.json().get("items", [])
    return items[0] if items else None


def resolver_canal_via_busca(termo: str) -> dict | None:
    """Fallback para custom URLs antigas: busca pelo nome e pega o primeiro canal."""
    resp = requests.get(
        "https://www.googleapis.com/youtube/v3/search",
        params={"q": termo, "type": "channel", "part": "snippet", "maxResults": 1, "key": YOUTUBE_API_KEY},
        timeout=15,
    )
    resp.raise_for_status()
    items = resp.json().get("items", [])
    if not items:
        return None
    canal_id = items[0]["snippet"]["channelId"]
    return resolver_canal_id("id", canal_id)


def buscar_uploads_recentes(canal_id: str, max_videos: int = 50) -> list[dict]:
    """
    Pega os N vídeos mais recentes do canal via playlist de uploads.
    Custo: 1 unidade (playlistItems) + 1 unidade (videos.list em batch).
    """
    # 1. Pega o ID da playlist de uploads
    resp = requests.get(
        "https://www.googleapis.com/youtube/v3/channels",
        params={"id": canal_id, "part": "contentDetails", "key": YOUTUBE_API_KEY},
        timeout=15,
    )
    resp.raise_for_status()
    items = resp.json().get("items", [])
    if not items:
        return []
    uploads_playlist = items[0]["contentDetails"]["relatedPlaylists"]["uploads"]

    # 2. Pega os IDs dos N vídeos mais recentes
    resp = requests.get(
        "https://www.googleapis.com/youtube/v3/playlistItems",
        params={
            "playlistId": uploads_playlist,
            "part": "contentDetails",
            "maxResults": min(max_videos, 50),
            "key": YOUTUBE_API_KEY,
        },
        timeout=15,
    )
    resp.raise_for_status()
    video_ids = [it["contentDetails"]["videoId"] for it in resp.json().get("items", [])]

    if not video_ids:
        return []

    # 3. Pega metadados completos em batch (até 50 IDs por chamada)
    resp = requests.get(
        "https://www.googleapis.com/youtube/v3/videos",
        params={
            "id": ",".join(video_ids),
            "part": "snippet,statistics,contentDetails",
            "key": YOUTUBE_API_KEY,
        },
        timeout=20,
    )
    resp.raise_for_status()
    return resp.json().get("items", [])


def buscar_canais_relacionados(canal_id: str) -> list[dict]:
    """
    Tenta extrair canais 'recomendados' que o canal lista publicamente
    via channelSections (a seção 'Canais' do perfil).
    Custo: 1 unidade. Pode retornar lista vazia se o canal não tem essa seção.
    """
    try:
        resp = requests.get(
            "https://www.googleapis.com/youtube/v3/channelSections",
            params={
                "channelId": canal_id,
                "part": "snippet,contentDetails",
                "key": YOUTUBE_API_KEY,
            },
            timeout=15,
        )
        resp.raise_for_status()
        secoes = resp.json().get("items", [])

        # Filtra só seções do tipo 'singleChannel' ou 'multipleChannels'
        canais_ids = []
        for sec in secoes:
            tipo = sec.get("snippet", {}).get("type", "")
            conteudo = sec.get("contentDetails", {})
            if tipo in ("singleChannel", "multipleChannels"):
                canais_ids.extend(conteudo.get("channels", []))

        if not canais_ids:
            return []

        # Enriquece os canais relacionados (até 50 IDs por batch)
        resp = requests.get(
            "https://www.googleapis.com/youtube/v3/channels",
            params={
                "id": ",".join(canais_ids[:50]),
                "part": "snippet,statistics",
                "key": YOUTUBE_API_KEY,
            },
            timeout=15,
        )
        resp.raise_for_status()
        return resp.json().get("items", [])
    except requests.HTTPError:
        return []  # Falha silenciosa: não é dado essencial


def calcular_sintomas_estruturais(videos: list[dict], canal_meta: dict) -> dict:
    """
    Calcula indicadores OBJETIVOS sobre a estrutura de produção do canal.
    Esses sintomas justificam empiricamente a classificação sociológica.
    """
    if not videos:
        return {}

    # Frequência de postagem (vídeos por dia, com base nos N mais recentes)
    datas = []
    for v in videos:
        try:
            datas.append(datetime.fromisoformat(v["snippet"]["publishedAt"].replace("Z", "+00:00")))
        except (KeyError, ValueError):
            pass

    freq_videos_dia = None
    if len(datas) >= 2:
        intervalo = (max(datas) - min(datas)).total_seconds() / 86400
        if intervalo > 0:
            freq_videos_dia = len(datas) / intervalo

    # Duração mediana
    duracoes = []
    for v in videos:
        d = duracao_iso_para_segundos(v.get("contentDetails", {}).get("duration", ""))
        if d > 0:
            duracoes.append(d)
    duracao_mediana = sorted(duracoes)[len(duracoes) // 2] if duracoes else 0

    # Heurística: equipe creditada (descrições mencionam crédito de produção)
    palavras_equipe = [
        "edição:", "edição por", "editor:", "editado por",
        "câmera:", "produção:", "produzido por", "diretor:",
        "produtor executivo", "redação:", "roteiro:", "trilha:",
        "@equipe", "nossa equipe", "nosso time"
    ]
    com_equipe = sum(
        1 for v in videos
        if any(p in v["snippet"].get("description", "").lower() for p in palavras_equipe)
    )
    pct_com_equipe = (com_equipe / len(videos)) * 100 if videos else 0

    # Heurística: links monetizados consistentes (mesma loja/marca em várias descrições)
    import re as _re
    todos_links = []
    for v in videos:
        desc = v["snippet"].get("description", "")
        # Pega domínios de links http(s)://dominio.com
        links = _re.findall(r"https?://(?:www\.)?([a-zA-Z0-9.-]+)", desc)
        todos_links.extend(links)

    from collections import Counter
    link_mais_repetido = None
    if todos_links:
        domain_counter = Counter(todos_links)
        # Filtra ruído: youtube/youtu.be são esperados em qualquer canal
        for dom in ("youtube.com", "youtu.be", "google.com", "instagram.com",
                    "facebook.com", "twitter.com", "x.com", "tiktok.com"):
            domain_counter.pop(dom, None)
        if domain_counter:
            top = domain_counter.most_common(1)[0]
            if top[1] >= 3:  # repetido em ao menos 3 descrições
                link_mais_repetido = {"dominio": top[0], "n_aparicoes": top[1]}

    # Heurística: padronização de títulos (uso de [TAGS], emojis no início)
    titulos_padronizados = sum(
        1 for v in videos
        if _re.match(r"^\s*[\[【]", v["snippet"]["title"]) or
           _re.match(r"^[\U0001F300-\U0001F9FF\u2600-\u27BF]", v["snippet"]["title"])
    )
    pct_padronizados = (titulos_padronizados / len(videos)) * 100 if videos else 0

    # Idade do canal vs. volume (canal velho com pouco vídeo = perfil amador;
    # canal jovem com muito vídeo = profissional desde o nascimento)
    inscritos = int(canal_meta.get("statistics", {}).get("subscriberCount", 0))
    total_videos = int(canal_meta.get("statistics", {}).get("videoCount", 0))

    return {
        "frequencia_videos_por_dia": freq_videos_dia,
        "duracao_mediana_segundos": duracao_mediana,
        "pct_descricoes_com_equipe": pct_com_equipe,
        "link_externo_repetido": link_mais_repetido,
        "pct_titulos_padronizados": pct_padronizados,
        "inscritos": inscritos,
        "total_videos_canal": total_videos,
        "n_videos_analisados": len(videos),
    }


def classificar_canal_haiku(canal_meta: dict, videos: list[dict], sintomas: dict) -> dict:
    """
    Classificação básica do canal usando Haiku — Eixo A (produtor) e
    tipo predominante de conteúdo. Reusa a mesma tipologia.
    """
    cliente = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    snippet = canal_meta.get("snippet", {})
    stats = canal_meta.get("statistics", {})

    # Lista os 10 vídeos mais recentes para o LLM ter amostra
    amostra = []
    for v in videos[:10]:
        amostra.append(
            f"  - [{duracao_iso_para_segundos(v['contentDetails']['duration'])}s] "
            f"{v['snippet']['title'][:120]}"
        )
    amostra_txt = "\n".join(amostra)

    payload = f"""DADOS DO CANAL:
- Nome: {snippet.get('title', '')}
- Inscritos: {int(stats.get('subscriberCount', 0)):,}
- Total de vídeos: {int(stats.get('videoCount', 0)):,}
- Visualizações totais do canal: {int(stats.get('viewCount', 0)):,}
- Data de criação: {snippet.get('publishedAt', '')[:10]}
- País declarado: {snippet.get('country', 'não declarado')}

DESCRIÇÃO DO CANAL (auto-narrativa):
{snippet.get('description', '(sem descrição)')[:2500]}

SINTOMAS ESTRUTURAIS DETECTADOS NOS ÚLTIMOS {len(videos)} VÍDEOS:
- Frequência: {sintomas['frequencia_videos_por_dia']:.2f} vídeos/dia (se profissional, espera-se >0.5)
- Duração mediana: {sintomas['duracao_mediana_segundos']}s ({sintomas['duracao_mediana_segundos']/60:.1f}min)
- % descrições com créditos de equipe: {sintomas['pct_descricoes_com_equipe']:.0f}%
- % títulos padronizados (com [TAG] ou emoji inicial): {sintomas['pct_titulos_padronizados']:.0f}%
- Link externo repetido nas descrições: {sintomas['link_externo_repetido'] or 'nenhum'}

AMOSTRA DOS 10 VÍDEOS MAIS RECENTES:
{amostra_txt}
"""

    prompt_sistema = f"""Você é um pesquisador especialista em Estudos de Plataforma, \
trabalhando para o Observatório Classe Creator. Classifique o CANAL abaixo \
usando a tipologia desenvolvida na pesquisa de Filipe Severo (PUCRS/FAMECOS, 2026).

==========
{tipologia_para_prompt()}
==========

REGRAS ESPECIAIS PARA DOSSIÊ DE CANAL:
1. NÃO confie cegamente na auto-descrição do canal. Use os SINTOMAS ESTRUTURAIS
   como evidência primária da estrutura real de produção.
2. Canal com >0.5 vídeo/dia + descrições com equipe + links monetizados repetidos
   sugere PROFISSIONALIZAÇÃO mesmo que se apresente como "criador independente".
3. Se descrição cita CNPJ, agência, manager, "produzido por X" — é sinal forte
   de Produtora Digital ou MCN, não YouTuber Profissional individual.
4. Distinga: 'youtuber_profissional' = persona individual com equipe;
   'produtora_digital' = empresa/marca com múltiplos canais coordenados.
5. Determine TAMBÉM qual tipo de conteúdo (Eixo B) é PREDOMINANTE no canal.

FORMATO: APENAS JSON válido:
{{
  "tipo_produtor": "<código exato do Eixo A>",
  "tipo_conteudo_predominante": "<código exato do Eixo B>",
  "auto_classificacao": "<como o CANAL se apresenta (1 frase)>",
  "justificativa_tecnica": "<por que classificou assim, citando sintomas estruturais>"
}}

CÓDIGOS Eixo A: {", ".join(codigos_produtor())}
CÓDIGOS Eixo B: {", ".join(codigos_conteudo())}
"""

    resposta = cliente.messages.create(
        model="claude-haiku-4-5",
        max_tokens=800,
        system=prompt_sistema,
        messages=[{"role": "user", "content": payload}],
    )

    texto = resposta.content[0].text.strip()
    texto = re.sub(r"^```(?:json)?\s*|\s*```$", "", texto, flags=re.MULTILINE).strip()
    resultado = json.loads(texto)

    if resultado["tipo_produtor"] not in codigos_produtor():
        raise ValueError(f"Código de produtor inválido: {resultado['tipo_produtor']}")
    if resultado["tipo_conteudo_predominante"] not in codigos_conteudo():
        raise ValueError(f"Código de conteúdo inválido: {resultado['tipo_conteudo_predominante']}")

    return resultado


def emitir_veredito_sonnet(
    canal_meta: dict,
    classificacao_haiku: dict,
    sintomas: dict,
    canais_relacionados: list[dict],
    aparicoes_termometro: int,
) -> str:
    """
    Análise SOCIOLÓGICA NARRATIVA do canal usando Sonnet.
    Diferente da classificação técnica, o veredito é prosa interpretativa
    que conecta os achados à tese política da dissertação.
    """
    cliente = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    snippet = canal_meta.get("snippet", {})
    stats = canal_meta.get("statistics", {})

    # Resumo de canais relacionados (coligações detectadas)
    rede_resumo = "Nenhum canal relacionado declarado publicamente."
    if canais_relacionados:
        nomes = [c["snippet"]["title"] for c in canais_relacionados[:10]]
        rede_resumo = f"Canais que este canal recomenda publicamente: {', '.join(nomes)}"

    payload = f"""ANÁLISE DE CANAL DO YOUTUBE — VEREDITO SOCIOLÓGICO

NOME: {snippet.get('title', '')}
AUTO-DESCRIÇÃO (como o canal SE APRESENTA):
{snippet.get('description', '')[:2000]}

CLASSIFICAÇÃO TÉCNICA INFERIDA:
- Tipo de produtor: {classificacao_haiku['tipo_produtor']}
- Tipo de conteúdo predominante: {classificacao_haiku['tipo_conteudo_predominante']}
- Como o canal se posiciona (auto-classificação): {classificacao_haiku.get('auto_classificacao', '')}

EVIDÊNCIAS ESTRUTURAIS:
- {int(stats.get('subscriberCount', 0)):,} inscritos | {int(stats.get('videoCount', 0)):,} vídeos totais
- Frequência: {sintomas['frequencia_videos_por_dia']:.2f} vídeos/dia
- Duração mediana: {sintomas['duracao_mediana_segundos']/60:.1f} minutos
- {sintomas['pct_descricoes_com_equipe']:.0f}% das descrições creditam equipe
- {sintomas['pct_titulos_padronizados']:.0f}% dos títulos têm formatação padronizada
- Link externo repetido: {sintomas['link_externo_repetido'] or 'nenhum identificado'}

REDE DECLARADA:
{rede_resumo}

PRESENÇA HISTÓRICA NO TRENDING BRASIL:
Este canal apareceu {aparicoes_termometro} vez(es) nos snapshots do Termômetro do Observatório.
"""

    prompt_sistema = """Você é Filipe Severo, autor da dissertação 'O Novo "You" do YouTube: \
a ascensão dos produtores plataformizados e a falência da promessa participativa no Brasil' \
(PUCRS/FAMECOS, 2026). Sua missão é emitir um VEREDITO SOCIOLÓGICO sobre o canal investigado.

O veredito deve:
1. Ser PROSA ANALÍTICA, não bullets nem JSON.
2. Ter 3 a 5 parágrafos curtos.
3. CONFRONTAR a auto-narrativa do canal com a realidade estrutural detectada.
4. Quando aplicável, IDENTIFICAR a "fachada" — quando o canal se apresenta como uma coisa
   mas as evidências mostram outra (ex: "criador independente" que opera como produtora).
5. Conectar à TESE da dissertação: a profissionalização da plataforma, a extinção do
   "amador" no topo, o trabalho invisível das equipes, a "broadcast to you" no lugar
   do "broadcast yourself".
6. Usar tom DIRETO mas RIGOROSO — você está produzindo conhecimento, não opinião.
7. NÃO repetir fatos numéricos que o leitor já viu nos cards anteriores.
   Em vez disso, INTERPRETÁ-LOS sociologicamente.
8. Encerrar com uma frase-síntese que sintetize a posição do canal no campo de produção.

NÃO use markdown. NÃO use bullets. NÃO use cabeçalhos. Apenas parágrafos.
"""

    resposta = cliente.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1200,
        system=prompt_sistema,
        messages=[{"role": "user", "content": payload}],
    )

    return resposta.content[0].text.strip()


def renderizar_dossie_completo(dossie: dict, do_cache: bool, cliente_db) -> None:
    """
    Apresenta o dossiê completo: identidade, sintomas, classificação dupla,
    confronto auto×real, rede, presença histórica e veredito narrativo.
    """
    if do_cache:
        st.info(
            f"⚡ Dossiê recuperado do cache (gerado em "
            f"{dossie.get('data_dossie', '')[:10]}). Zero custo de API."
        )

    sintomas = json.loads(dossie["sintomas_estruturais"])
    rede = json.loads(dossie["rede_canais"])
    composicao = json.loads(dossie["composicao_videos"])

    produtor_real = buscar_produtor(dossie["classificacao_sociologica"])
    conteudo_pred = buscar_conteudo(dossie["tipo_conteudo_predominante"])

    # =========================================================================
    # CABEÇALHO — IDENTIDADE DO CANAL
    # =========================================================================
    st.markdown(f"## 📋 Dossiê: **{dossie['canal_nome']}**")

    c1, c2, c3 = st.columns(3)
    c1.metric("Inscritos", f"{dossie['inscritos']:,}".replace(",", "."))
    c2.metric("Total de vídeos do canal", f"{dossie['total_videos_canal']:,}".replace(",", "."))
    c3.metric("Vídeos analisados", dossie["total_videos_analisados"])

    # =========================================================================
    # CONFRONTO: AUTO-NARRATIVA × REALIDADE ESTRUTURAL
    # =========================================================================
    st.markdown("---")
    st.markdown("### 🪞 Auto-narrativa × Realidade estrutural")
    st.caption(
        "Comparação entre como o canal se APRESENTA publicamente "
        "e como sua estrutura de produção se REVELA aos sintomas."
    )

    col_auto, col_real = st.columns(2)

    with col_auto:
        st.markdown(
            f"""<div class="cartao-classificacao roxo">
                <small style="color:#888; letter-spacing:0.1em;">COMO O CANAL SE APRESENTA</small>
                <p style="color:#fff; margin: 0.7rem 0 0 0; font-size: 1rem;">
                    "{dossie['auto_classificacao']}"
                </p>
            </div>""",
            unsafe_allow_html=True,
        )

    with col_real:
        st.markdown(
            f"""<div class="cartao-classificacao">
                <small style="color:#888; letter-spacing:0.1em;">CLASSE REAL (EVIDÊNCIA ESTRUTURAL)</small>
                <h3 class="neon-verde" style="margin: 0.5rem 0;">{produtor_real.nome}</h3>
                <p style="color:#ccc; margin:0;"><small>{produtor_real.definicao}</small></p>
            </div>""",
            unsafe_allow_html=True,
        )

    st.markdown(
        f"<small><b>Tipo de conteúdo predominante:</b> "
        f"<span class='neon-roxo'>{conteudo_pred.nome}</span></small>",
        unsafe_allow_html=True,
    )

    # =========================================================================
    # SINTOMAS ESTRUTURAIS — cards visuais com evidências
    # =========================================================================
    st.markdown("---")
    st.markdown("### 🔬 Sintomas estruturais")
    st.caption(
        "Indicadores OBJETIVOS extraídos dos vídeos analisados. "
        "Estes são os fatos que sustentam a classificação."
    )

    sin_cols = st.columns(4)

    freq = sintomas.get("frequencia_videos_por_dia") or 0
    if freq >= 1:
        freq_label = "🏭 Industrial"
    elif freq >= 0.3:
        freq_label = "💼 Profissional"
    elif freq >= 0.05:
        freq_label = "🌱 Casual"
    else:
        freq_label = "🐢 Esporádico"

    sin_cols[0].metric(
        "Frequência",
        f"{freq:.2f} vídeos/dia",
        freq_label,
    )

    dur_min = sintomas.get("duracao_mediana_segundos", 0) / 60
    sin_cols[1].metric("Duração mediana", f"{dur_min:.1f} min")
    sin_cols[2].metric(
        "% descrições com equipe",
        f"{sintomas.get('pct_descricoes_com_equipe', 0):.0f}%",
    )
    sin_cols[3].metric(
        "% títulos padronizados",
        f"{sintomas.get('pct_titulos_padronizados', 0):.0f}%",
    )

    if sintomas.get("link_externo_repetido"):
        link_info = sintomas["link_externo_repetido"]
        st.markdown(
            f"🔗 **Link externo repetido detectado:** `{link_info['dominio']}` "
            f"aparece em **{link_info['n_aparicoes']}** das descrições — "
            f"sugere fluxo de monetização ou rede de marca consistente."
        )

    # =========================================================================
    # COMPOSIÇÃO DO CONTEÚDO DO CANAL
    # =========================================================================
    st.markdown("---")
    st.markdown("### 🎭 Que tipo de trabalho este canal produz?")

    if composicao:
        df_comp = pd.DataFrame(
            [{"codigo": k, "n": v, "nome": buscar_conteudo(k).nome if buscar_conteudo(k) else k}
             for k, v in composicao.items()]
        )
        fig = px.bar(
            df_comp, x="n", y="nome", orientation="h",
            color="codigo", color_discrete_map=CORES_CONTEUDO,
            template="plotly_dark",
            labels={"n": f"Vídeos (de {dossie['total_videos_analisados']})", "nome": ""},
        )
        fig.update_layout(
            paper_bgcolor="#0a0a0a", plot_bgcolor="#0a0a0a",
            showlegend=False, height=350,
            yaxis={"categoryorder": "total ascending"},
        )
        st.plotly_chart(fig, use_container_width=True)

    # =========================================================================
    # REDE DE CANAIS DECLARADA
    # =========================================================================
    st.markdown("---")
    st.markdown("### 🕸️ Rede declarada")
    st.caption(
        "Canais que este canal recomenda publicamente em sua aba 'Canais'. "
        "Mapeamento de coligações de produtoras e marcas associadas."
    )

    if not rede:
        st.info(
            "Este canal não declara publicamente outros canais associados. "
            "Isso NÃO significa ausência de rede — pode indicar canal individual "
            "ou canal que prefere não expor coligações."
        )
    else:
        st.markdown(f"**{len(rede)} canal(is) declarado(s) na rede deste produtor:**")
        df_rede = pd.DataFrame(rede)
        st.dataframe(
            df_rede[["nome", "inscritos", "total_videos"]] if "nome" in df_rede.columns else df_rede,
            use_container_width=True, hide_index=True,
        )

    # =========================================================================
    # PRESENÇA HISTÓRICA — cruzamento com Termômetro e Disputa
    # =========================================================================
    st.markdown("---")
    st.markdown("### 📈 Presença histórica nos outros módulos")

    aparicoes_termo = aparicoes_canal_no_termometro(cliente_db, dossie["canal_id"])
    aparicoes_busca = aparicoes_canal_em_buscas(cliente_db, dossie["canal_id"])

    cT, cD = st.columns(2)
    with cT:
        st.markdown(
            f"<div class='cartao-classificacao'>"
            f"<small style='color:#888;'>NO TERMÔMETRO</small>"
            f"<h2 class='neon-verde' style='margin:0.5rem 0;'>{len(aparicoes_termo)}</h2>"
            f"<small>aparição(ões) no trending BR</small></div>",
            unsafe_allow_html=True,
        )
    with cD:
        st.markdown(
            f"<div class='cartao-classificacao roxo'>"
            f"<small style='color:#888;'>NA DISPUTA DE NARRATIVA</small>"
            f"<h2 class='neon-roxo' style='margin:0.5rem 0;'>{len(aparicoes_busca)}</h2>"
            f"<small>aparição(ões) em buscas auditadas</small></div>",
            unsafe_allow_html=True,
        )

    if aparicoes_busca:
        with st.expander("Ver em quais buscas este canal apareceu"):
            for ap in aparicoes_busca[:20]:
                bn = ap.get("buscas_narrativa", {})
                if bn:
                    st.markdown(
                        f"- **\"{bn['termo_buscado']}\"** "
                        f"(posição #{ap['posicao_ranking']}, "
                        f"em {bn['data_busca'][:10]})"
                    )

    # =========================================================================
    # VEREDITO SOCIOLÓGICO (gerado por Sonnet)
    # =========================================================================
    st.markdown("---")
    st.markdown("### ⚖️ Veredito sociológico")
    st.caption(
        "Análise narrativa interpretativa, gerada por Claude Sonnet 4.6, "
        "ancorada na tese da dissertação."
    )
    st.markdown(
        f"<div style='background:#111; padding:1.5rem; border-radius:4px; "
        f"border-left: 4px solid #ffffff; line-height:1.7;'>"
        f"{dossie['veredito_sonnet']}</div>",
        unsafe_allow_html=True,
    )


def renderizar_dossie_canal() -> None:
    st.markdown("# 📋 Dossiê do Canal")
    st.markdown("##### Quem realmente está por trás deste canal?")
    st.markdown(
        "Este módulo investiga a **estrutura real de produção** de um canal "
        "do YouTube. Cole abaixo o link, handle (@) ou ID de qualquer canal — "
        "a ferramenta extrairá os 50 vídeos mais recentes, calculará sintomas "
        "estruturais objetivos, mapeará a rede de canais declarados, e emitirá "
        "um veredito sociológico ancorado na tipologia de SEVERO (2026)."
    )

    if not SUPABASE_DISPONIVEL:
        st.error("⚠️ Banco de dados não configurado.")
        return

    try:
        cliente_db = conectar(modo="leitura")
    except Exception as e:
        st.error(f"Não foi possível conectar ao banco: {e}")
        return

    # Inicializar contadores de sessão
    if "dossies_feitos" not in st.session_state:
        st.session_state["dossies_feitos"] = 0

    restantes = LIMITE_DOSSIES_POR_SESSAO - st.session_state["dossies_feitos"]
    if restantes > 0:
        st.markdown(
            f"<div style='background:#111; padding:0.7rem; border-radius:4px; "
            f"border-left:3px solid #39FF14;'>"
            f"<small style='color:#888;'>SUA SESSÃO</small> · "
            f"<span class='neon-verde'>{restantes}</span> "
            f"dossiê(s) restante(s) nesta sessão</div>",
            unsafe_allow_html=True,
        )
    else:
        st.warning(
            f"⛔ Limite de {LIMITE_DOSSIES_POR_SESSAO} dossiês por sessão atingido. "
            "Recarregue a página para continuar."
        )

    # =========================================================================
    # FORMULÁRIO
    # =========================================================================
    st.markdown("---")
    entrada = st.text_input(
        "Canal a investigar",
        placeholder="Ex: @manualdomundo, youtube.com/@cazeTV, UCxxxx...",
    )

    botao = st.button(
        "GERAR DOSSIÊ",
        disabled=(restantes <= 0),
        use_container_width=False,
        key="btn_dossie",
    )

    if not (botao and entrada.strip()):
        return

    # =========================================================================
    # PIPELINE DE EXECUÇÃO
    # =========================================================================
    parsed = extrair_canal_id(entrada)
    if not parsed:
        st.error(
            "Não foi possível identificar o canal. Tente colar a URL completa "
            "(ex: youtube.com/@nomedocanal ou youtube.com/channel/UCxxxx)."
        )
        return

    tipo_id, valor_id = parsed

    try:
        with st.spinner("Resolvendo identidade do canal..."):
            canal_meta = resolver_canal_id(tipo_id, valor_id)
    except requests.HTTPError as e:
        st.error(f"Erro consultando YouTube: {e}")
        return

    if not canal_meta:
        st.error("Canal não encontrado. Verifique o identificador e tente novamente.")
        return

    canal_id_real = canal_meta["id"]

    # Verifica cache (14 dias)
    cache = buscar_cache_dossie(cliente_db, canal_id_real, DIAS_VALIDADE_DOSSIE)
    if cache:
        renderizar_dossie_completo(cache, do_cache=True, cliente_db=cliente_db)
        return

    # Sem cache: pipeline completo
    st.session_state["dossies_feitos"] += 1

    try:
        with st.spinner("Extraindo histórico recente de vídeos..."):
            videos = buscar_uploads_recentes(canal_id_real, max_videos=50)

        if not videos:
            st.warning("Não foi possível obter vídeos recentes deste canal.")
            return

        with st.spinner("Mapeando rede de canais declarados..."):
            canais_relacionados = buscar_canais_relacionados(canal_id_real)

        with st.spinner("Calculando sintomas estruturais..."):
            sintomas = calcular_sintomas_estruturais(videos, canal_meta)

        with st.spinner("Submetendo a Claude Haiku para classificação técnica..."):
            classif = classificar_canal_haiku(canal_meta, videos, sintomas)

        with st.spinner("Cruzando com corpus do Observatório..."):
            aparicoes_termo = aparicoes_canal_no_termometro(cliente_db, canal_id_real)

        with st.spinner("Submetendo a Claude Sonnet para veredito sociológico..."):
            veredito = emitir_veredito_sonnet(
                canal_meta, classif, sintomas,
                canais_relacionados, len(aparicoes_termo),
            )

        # Composição: classifica RAPIDAMENTE cada um dos 50 vídeos para distribuição
        # de tipo_conteudo. Não pede tipo_produtor (já sabemos pelo dossiê do canal).
        # Para economizar custo, usa heurística simples baseada no que Haiku já analisou.
        from collections import Counter
        composicao_videos = Counter()
        # Marca todos com o tipo predominante (simplificação para v1 do módulo)
        # Versão futura: classificar individualmente cada vídeo (custaria mais 50× Haiku)
        composicao_videos[classif["tipo_conteudo_predominante"]] = len(videos)

        # Prepara dados serializáveis para persistência
        rede_para_salvar = [
            {
                "id": c["id"],
                "nome": c["snippet"]["title"],
                "inscritos": int(c["statistics"].get("subscriberCount", 0)),
                "total_videos": int(c["statistics"].get("videoCount", 0)),
            }
            for c in canais_relacionados
        ]

        with st.spinner("Salvando dossiê no corpus do Observatório..."):
            dossie_id = registrar_dossie(
                cliente_db,
                canal_id=canal_id_real,
                canal_nome=canal_meta["snippet"]["title"],
                canal_descricao=canal_meta["snippet"].get("description", ""),
                inscritos=int(canal_meta["statistics"].get("subscriberCount", 0)),
                total_videos_canal=int(canal_meta["statistics"].get("videoCount", 0)),
                total_videos_analisados=len(videos),
                sintomas_estruturais=json.dumps(sintomas, ensure_ascii=False),
                auto_classificacao=classif.get("auto_classificacao", ""),
                classificacao_sociologica=classif["tipo_produtor"],
                tipo_conteudo_predominante=classif["tipo_conteudo_predominante"],
                veredito_sonnet=veredito,
                rede_canais_json=json.dumps(rede_para_salvar, ensure_ascii=False),
                composicao_videos_json=json.dumps(dict(composicao_videos), ensure_ascii=False),
            )
    except requests.HTTPError as e:
        st.error(f"Erro na consulta ao YouTube: {e}")
        return
    except Exception as e:
        st.error(f"Erro inesperado: {type(e).__name__}: {e}")
        return

    # Recupera o registro completo recém-salvo e renderiza
    dossie_completo = buscar_cache_dossie(cliente_db, canal_id_real, dias_validade=1)
    if dossie_completo:
        st.success("✅ Dossiê concluído e adicionado ao corpus do Observatório.")
        renderizar_dossie_completo(dossie_completo, do_cache=False, cliente_db=cliente_db)


# ==============================================================================
# ROTEAMENTO
# ==============================================================================

if modulo.startswith("🔍"):
    renderizar_lupa()
elif modulo.startswith("🌡️"):
    renderizar_termometro()
elif modulo.startswith("⚔️"):
    renderizar_disputa_narrativa()
elif modulo.startswith("📋"):
    renderizar_dossie_canal()
else:
    st.markdown("# 🚧 Módulo em construção")
    st.info(
        "Este módulo será adicionado em breve. Por enquanto, use os outros 4 módulos."
    )
