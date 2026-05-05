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
            "📋 Dossiê do Canal (em breve)",
            "⚔️ Disputa de Narrativa (em breve)",
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
# ROTEAMENTO
# ==============================================================================

if modulo.startswith("🔍"):
    renderizar_lupa()
elif modulo.startswith("🌡️"):
    renderizar_termometro()
else:
    st.markdown("# 🚧 Módulo em construção")
    st.info(
        "Este módulo será adicionado em breve. Por enquanto, use **A Lupa** "
        "(análise individual) ou o **Termômetro** (auditoria longitudinal)."
    )
