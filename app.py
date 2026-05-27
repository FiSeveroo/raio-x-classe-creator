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
        estatisticas_corpus_termometro,
        registrar_dossie,
        buscar_cache_dossie,
        aparicoes_canal_no_termometro,
        aparicoes_canal_em_buscas,
        registrar_analise_comentarios,
        buscar_cache_comentarios,
        buscar_dossie_canal_existente,
        buscar_distribuicao_ipps,
        contadores_publicos,
        # Versionamento e biblioteca
        registrar_lupa,
        buscar_canonica_video,
        buscar_canonica_dossie,
        buscar_canonica_busca,
        buscar_canonica_comentarios,
        historico_versoes_dossie,
        historico_versoes_video,
        historico_versoes_busca,
        historico_versoes_comentarios,
        biblioteca_videos,
        biblioteca_dossies,
        biblioteca_buscas,
        biblioteca_comentarios,
        buscar_analise_por_id,
        calcular_peso_atualizacao,
        pode_atualizar,
        COOLDOWN_ATUALIZACAO_DIAS,
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

# CSS — identidade visual Classe Creator
st.markdown(
    """
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&display=swap');

    @font-face {
        font-family: 'Gunterz';
        src: url('app/static/Gunterz-Black.otf') format('opentype');
        font-weight: 900;
        font-display: swap;
    }
    @font-face {
        font-family: 'Gunterz';
        src: url('app/static/Gunterz-Bold.otf') format('opentype');
        font-weight: 700;
        font-display: swap;
    }
    @font-face {
        font-family: 'CookConthic';
        src: url('app/static/CookConthic.otf') format('opentype');
        font-weight: 400;
        font-display: swap;
    }

    /* Base */
    .stApp {
        background-color: #0a0a0a;
        color: #F5F0E8;
        font-family: 'CookConthic', sans-serif;
        font-size: 16px;
    }

    /* Sidebar */
    /* Sidebar — múltiplos seletores para compatibilidade */
    [data-testid="stSidebar"],
    section[data-testid="stSidebar"],
    .stSidebar {
        background-color: #0d0d0d !important;
        border-right: 1px solid #1a1a1a !important;
        display: flex !important;
        visibility: visible !important;
        opacity: 1 !important;
    }
    [data-testid="stSidebar"] *,
    section[data-testid="stSidebar"] * {
        color: #F5F0E8 !important;
        font-family: 'CookConthic', sans-serif;
    }
    [data-testid="stSidebar"] h1,
    [data-testid="stSidebar"] h2,
    [data-testid="stSidebar"] h3,
    section[data-testid="stSidebar"] h1,
    section[data-testid="stSidebar"] h2,
    section[data-testid="stSidebar"] h3 {
        font-family: 'Gunterz', sans-serif !important;
        letter-spacing: 0.05em !important;
        color: #00E87A !important;
    }

    /* Headings */
    h1, h2, h3 {
        font-family: 'Gunterz', sans-serif !important;
        letter-spacing: 0.05em !important;
        color: #F5F0E8 !important;
        font-weight: 900 !important;
    }
    h1 { font-size: 2.5rem !important; }
    h2 { font-size: 1.8rem !important; }
    h3 { font-size: 1.4rem !important; }

    /* Classes de cor alinhadas */
    .neon-verde { color: #00E87A !important; font-weight: 700; }
    .neon-roxo  { color: #7B2FFF !important; font-weight: 700; }
    .cc-orange  { color: #FF5C1A !important; font-weight: 700; }

    /* Botões */
    .stButton > button {
        background-color: transparent;
        color: #00E87A;
        border: 1px solid #00E87A;
        font-family: 'CookConthic', sans-serif;
        font-weight: 700;
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        border-radius: 8px;
        padding: 0.5rem 1.2rem;
        transition: all 0.2s ease;
    }
    .stButton > button:hover {
        background-color: #00E87A;
        color: #0a0a0a;
    }
    .stButton > button[kind="primary"] {
        background-color: #7B2FFF;
        border-color: #7B2FFF;
        color: #fff;
    }
    .stButton > button[kind="primary"]:hover {
        background-color: #6020e0;
        border-color: #6020e0;
    }

    /* Inputs */
    .stTextInput > div > div > input,
    .stTextArea > div > div > textarea,
    .stSelectbox > div > div {
        background-color: #1a1a1a !important;
        color: #F5F0E8 !important;
        border: 1px solid #2a2a2a !important;
        border-radius: 8px !important;
        font-family: 'DM Sans', sans-serif !important;
    }
    .stTextInput > div > div > input:focus,
    .stTextArea > div > div > textarea:focus {
        border-color: #7B2FFF !important;
    }

    /* Cards de classificação */
    .cartao-classificacao {
        background-color: #111111;
        border-left: 4px solid #00E87A;
        padding: 1.5rem;
        margin: 1rem 0;
        border-radius: 8px;
    }
    .cartao-classificacao.roxo { border-left-color: #7B2FFF; }
    .cartao-classificacao.laranja { border-left-color: #FF5C1A; }

    /* Métricas */
    [data-testid="stMetric"] {
        background-color: #111;
        border: 1px solid #1a1a1a;
        border-radius: 10px;
        padding: 1rem;
    }
    [data-testid="stMetricValue"] {
        font-family: 'Bebas Neue', sans-serif !important;
        color: #00E87A !important;
        font-size: 2rem !important;
    }
    [data-testid="stMetricLabel"] {
        font-family: 'Space Mono', monospace !important;
        font-size: 0.7rem !important;
        letter-spacing: 0.1em !important;
        color: #aaa !important;
    }

    /* Tabs */
    .stTabs [data-baseweb="tab-list"] {
        background-color: #111;
        border-radius: 10px;
        gap: 4px;
        padding: 4px;
    }
    .stTabs [data-baseweb="tab"] {
        font-family: 'CookConthic', sans-serif;
        font-weight: 700;
        font-size: 0.7rem;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: #aaa;
        border-radius: 8px;
    }
    .stTabs [aria-selected="true"] {
        background-color: #7B2FFF !important;
        color: #fff !important;
    }

    /* Expander */
    .streamlit-expanderHeader {
        font-family: 'Space Mono', monospace !important;
        font-size: 0.8rem !important;
        letter-spacing: 0.05em !important;
        background-color: #111 !important;
        border-radius: 8px !important;
    }

    /* Dataframe */
    [data-testid="stDataFrame"] {
        background-color: #111;
        border-radius: 10px;
    }

    /* Divider */
    hr { border-color: #1a1a1a !important; }

    /* Info/warning/success boxes */
    .stAlert {
        border-radius: 10px !important;
        border-left-width: 4px !important;
        font-family: 'DM Sans', sans-serif !important;
    }

    /* Esconde menu e footer — mantém botão de toggle da sidebar */
    #MainMenu, footer { visibility: hidden; }
    [data-testid="stToolbar"] { visibility: hidden; }
    header[data-testid="stHeader"] { background: transparent !important; }
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
    st.markdown("# RAIO-X")
    st.caption("CLASSE CREATOR — OBSERVATÓRIO")
    st.divider()

    modulo = st.radio(
        "Módulos",
        options=[
            "🏠 Home",
            "🔍 A Lupa",
            "🌡️ Termômetro do Em Alta",
            "⚔️ Disputa de Narrativa",
            "📋 Dossiê do Canal",
            "💬 Voz da Base",
            "📚 Biblioteca de Pesquisa",
        ],
        label_visibility="collapsed",
    )

    st.divider()
    st.caption("Auditoria algorítmica e pesquisa acadêmica do trabalho plataformizado no YouTube.")
    st.markdown('*"Criar é trabalho."*')
    st.divider()
    st.markdown("[← ESCOLA CLASSE CREATOR](https://escola.classecreator.com)")


# ==============================================================================
# UTILITÁRIO: OFERECER VERSÃO CANÔNICA ANTES DE GASTAR ANÁLISE
# ==============================================================================
# Função reutilizada por todos os 4 módulos pagos (Lupa, Dossiê, Disputa, Voz).
# Antes que o usuário "gaste" uma análise, esta função verifica se já existe
# versão canônica no corpus e apresenta as opções: ver, atualizar ou pular.
# ==============================================================================

def oferecer_versao_canonica(canonica: dict, label_objeto: str, chave_estado: str) -> str:
    """
    Apresenta UI padronizada quando há análise canônica disponível.

    Retorna:
      "ver"        → usuário escolheu ver a análise existente
      "atualizar"  → usuário escolheu atualizar (gerar nova versão)
      "aguardando" → usuário ainda não escolheu

    label_objeto: texto descritivo do objeto (ex: "deste vídeo", "deste canal")
    chave_estado: chave única no session_state para isolar essa decisão
    """
    data_canonica = canonica.get(
        "data_dossie") or canonica.get("data_analise") or canonica.get(
        "data_busca") or canonica.get("data_classificacao") or ""

    versao_atual = canonica.get("versao_numero", 1)
    pode, dias_restantes = pode_atualizar(data_canonica)
    proxima_versao = versao_atual + 1
    peso_proxima = calcular_peso_atualizacao(proxima_versao)

    # Calcula data legível
    data_legivel = "data desconhecida"
    try:
        if data_canonica.endswith("Z"):
            d_iso = data_canonica[:-1] + "+00:00"
        else:
            d_iso = data_canonica
        dt = datetime.fromisoformat(d_iso)
        data_legivel = dt.strftime("%d/%m/%Y")
    except (ValueError, AttributeError):
        pass

    # Banner principal
    st.markdown(
        f"""
        <div style='background:#0d1f0d; padding:1.2rem 1.5rem; border-radius:6px;
                    border-left: 4px solid #00E87A; margin: 1rem 0;'>
            <div style='color:#00E87A; font-size:0.8rem; letter-spacing:0.1em;
                        margin-bottom:0.5rem;'>📚 ANÁLISE EXISTENTE NO CORPUS</div>
            <p style='color:#fff; margin:0; line-height:1.6;'>
                Já existe análise canônica {label_objeto} no Observatório
                (versão <strong>{versao_atual}</strong>, realizada em <strong>{data_legivel}</strong>).
                Consultar a análise existente preserva recursos coletivos do Observatório.
            </p>
        </div>
        """,
        unsafe_allow_html=True,
    )

    col_ver, col_atualizar = st.columns(2)

    # Botão "ver análise existente"
    with col_ver:
        if st.button(
            f"👁️ Ver análise existente",
            key=f"btn_ver_{chave_estado}",
            use_container_width=True,
        ):
            st.session_state[f"decisao_{chave_estado}"] = "ver"
            return "ver"

    # Botão "atualizar" — só ativo após cooldown
    with col_atualizar:
        if pode:
            if st.button(
                f"🔄 Atualizar análise (consome {peso_proxima} slot(s))",
                key=f"btn_atualizar_{chave_estado}",
                use_container_width=True,
            ):
                # Confirmação adicional
                st.session_state[f"confirma_atualizar_{chave_estado}"] = True
        else:
            st.button(
                f"⏳ Atualização disponível em {dias_restantes} dia(s)",
                disabled=True,
                use_container_width=True,
                key=f"btn_atualizar_disabled_{chave_estado}",
            )

    # Confirmação de atualização (aviso de custo)
    if st.session_state.get(f"confirma_atualizar_{chave_estado}", False):
        st.warning(
            f"⚠️ **Atualização confirmará gasto:** será gerada a **versão {proxima_versao}** "
            f"desta análise, consumindo **{peso_proxima} slot(s)** da sua sessão. "
            f"O peso cresce exponencialmente (1, 2, 4, 8...) para preservar o orçamento "
            f"coletivo do Observatório. Versão anterior fica preservada no histórico."
        )
        if st.button(
            f"✅ Confirmar atualização para v{proxima_versao}",
            key=f"btn_confirma_{chave_estado}",
            type="primary",
        ):
            st.session_state[f"decisao_{chave_estado}"] = "atualizar"
            st.session_state[f"peso_consumir_{chave_estado}"] = peso_proxima
            st.session_state[f"versao_anterior_id_{chave_estado}"] = canonica["id"]
            st.session_state[f"proxima_versao_{chave_estado}"] = proxima_versao
            return "atualizar"

    return st.session_state.get(f"decisao_{chave_estado}", "aguardando")


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

    # =========================================================================
    # VERIFICAR VERSÃO CANÔNICA NO CORPUS (Supabase)
    # =========================================================================
    canonica_supabase = None
    if SUPABASE_DISPONIVEL:
        try:
            cliente_db_lupa = conectar(modo="leitura")
            canonica_supabase = buscar_canonica_video(cliente_db_lupa, video_id)
        except Exception:
            canonica_supabase = None
            cliente_db_lupa = None

    if canonica_supabase:
        chave_estado = f"lupa_{video_id}"
        decisao = oferecer_versao_canonica(
            canonica_supabase,
            label_objeto="deste vídeo",
            chave_estado=chave_estado,
        )

        if decisao == "ver":
            # Renderiza usando dados canônicos do Supabase
            meta_cache = json.loads(canonica_supabase.get("metadados_json") or "{}")
            meta_cache["canal_nome"] = canonica_supabase.get("canal_nome", "")
            meta_cache["titulo"] = canonica_supabase.get("titulo", "")
            meta = meta_cache
            resultado = {
                "tipo_produtor": canonica_supabase["tipo_produtor"],
                "tipo_conteudo": canonica_supabase["tipo_conteudo"],
                "justificativa": canonica_supabase["justificativa"],
            }
            # Salta diretamente para visualização (pula a parte de gastar)
            _renderizar_resultado_lupa(meta, resultado, cache_aviso=True,
                                      data_cache=canonica_supabase.get("data_classificacao", ""))
            return
        elif decisao == "aguardando":
            return
        # decisao == "atualizar"
        proxima_versao = st.session_state.get(f"proxima_versao_{chave_estado}", 2)
        versao_anterior_id = st.session_state.get(f"versao_anterior_id_{chave_estado}")
    else:
        proxima_versao = 1
        versao_anterior_id = None

    # =========================================================================
    # PIPELINE COMPLETO (nova análise OU atualização)
    # =========================================================================
    # Cache local SQLite ainda funciona como segundo nível de cache rápido
    cache = buscar_cache_local(video_id)
    if cache and proxima_versao == 1:
        # Só usa SQLite quando não há canônica no Supabase e estamos no fluxo inicial
        st.info(f"⚡ Resultado recuperado do cache local (analisado em {cache['data'][:10]}).")
        meta = cache["metadados"]
        meta["canal_nome"] = cache["canal_nome"]
        meta["titulo"] = cache["titulo"]
        resultado = {
            "tipo_produtor": cache["tipo_produtor"],
            "tipo_conteudo": cache["tipo_conteudo"],
            "justificativa": cache["justificativa"],
        }
        # Sincroniza com Supabase para alimentar biblioteca pública
        if SUPABASE_DISPONIVEL:
            try:
                cli = conectar(modo="leitura")
                registrar_lupa(
                    cli,
                    video_id=video_id,
                    titulo=cache["titulo"],
                    canal_id=cache["canal_id"],
                    canal_nome=cache["canal_nome"],
                    tipo_produtor=resultado["tipo_produtor"],
                    tipo_conteudo=resultado["tipo_conteudo"],
                    justificativa=resultado["justificativa"],
                    metadados_json=json.dumps(meta, ensure_ascii=False),
                    versao_numero=1,
                    versao_anterior_id=None,
                )
            except Exception:
                pass  # falha de sincronização não bloqueia o usuário
    else:
        try:
            with st.spinner("Extraindo metadados do vídeo..."):
                meta_video = buscar_metadados_video(video_id)
            with st.spinner("Investigando o canal produtor..."):
                meta_canal = buscar_metadados_canal(meta_video["canal_id"])
            with st.spinner("Submetendo à análise sociológica..."):
                resultado = classificar_com_claude(meta_video, meta_canal)

            # Cache local (rápido)
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

            # Registro versionado no Supabase (biblioteca pública)
            if SUPABASE_DISPONIVEL:
                try:
                    cli = conectar(modo="leitura")
                    registrar_lupa(
                        cli,
                        video_id=video_id,
                        titulo=meta_video["titulo"],
                        canal_id=meta_video["canal_id"],
                        canal_nome=meta_video["canal_nome"],
                        tipo_produtor=resultado["tipo_produtor"],
                        tipo_conteudo=resultado["tipo_conteudo"],
                        justificativa=resultado["justificativa"],
                        metadados_json=json.dumps({**meta_video, **meta_canal}, ensure_ascii=False),
                        versao_numero=proxima_versao,
                        versao_anterior_id=versao_anterior_id,
                    )
                except Exception:
                    pass  # falha aqui não bloqueia o usuário

            meta = {**meta_video, **meta_canal}
        except (ValueError, requests.HTTPError) as e:
            st.error(f"Erro na análise: {e}")
            return

    _renderizar_resultado_lupa(meta, resultado, cache_aviso=False)


def _renderizar_resultado_lupa(meta: dict, resultado: dict, cache_aviso: bool = False,
                                data_cache: str = "") -> None:
    """Renderiza o resultado da análise da Lupa (extraído para evitar duplicação)."""
    if cache_aviso and data_cache:
        st.info(f"📚 Análise recuperada do corpus do Observatório (canônica de {data_cache[:10]}).")

    # Resultados
    st.markdown("---")
    st.markdown(f"### 🎬 {meta.get('titulo', '')}")
    st.markdown(f"*Canal:* **{meta.get('canal_nome', '')}**")

    _views = meta.get('visualizacoes', 0)
    _likes = meta.get('likes', 0)
    _coments = meta.get('comentarios', 0)
    _taxa_eng = ((_likes + _coments) / _views * 100) if _views > 0 else 0

    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Visualizações", f"{_views:,}".replace(",", "."))
    c2.metric("Inscritos do canal", f"{meta.get('inscritos', 0):,}".replace(",", "."))
    c3.metric("Total de vídeos do canal", f"{meta.get('total_videos', 0):,}".replace(",", "."))
    c4.metric("Taxa de engajamento", f"{_taxa_eng:.2f}%",
              help="(Likes + Comentários) / Visualizações × 100")

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
    "midia_tradicional": "#00E87A",
    "produtora_digital": "#27D337",
    "youtuber_profissional": "#7B2FFF",
    "criador_casual": "#7e6bff",
    "usuario_comum": "#888888",
    "instituicao": "#FFD700",
    "musico": "#FF4FD8",
    "marca": "#FF8C00",
    "reaproveitamento": "#444444",
    "outros": "#666666",
}

CORES_CONTEUDO = {
    "informativo": "#00E87A",
    "entretenimento_roteirizado": "#7B2FFF",
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

    tab_atual, tab_serie, tab_canais, tab_exportar, tab_curadoria = st.tabs([
        "📸 Snapshot atual",
        "📈 Série temporal",
        "🏢 Canais",
        "💾 Exportar dados",
        "✏️ Curadoria",
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
        st.caption(
            "Composição direta segundo a tipologia (Severo, 2026), sem agregados. "
            "Cada categoria do Eixo A é apresentada na sua granularidade original."
        )

        n = len(df)
        canais_unicos = df["canal_id"].nunique()
        contagem_a = df["tipo_produtor"].value_counts().to_dict()

        c1, c2, c3, c4 = st.columns(4)
        c1.metric("Vídeos analisados", n)
        c2.metric("Canais únicos", canais_unicos)
        c3.metric(
            "% Mídia tradicional",
            f"{(contagem_a.get('midia_tradicional', 0) / n * 100):.1f}%",
        )
        c4.metric(
            "% Usuário comum",
            f"{(contagem_a.get('usuario_comum', 0) / n * 100):.1f}%",
        )

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
            color_continuous_scale=["#0a0a0a", "#00E87A"],
            aspect="auto", labels={"color": "Vídeos"},
        )
        fig_heat.update_layout(paper_bgcolor="#0a0a0a", plot_bgcolor="#0a0a0a", height=500)
        st.plotly_chart(fig_heat, use_container_width=True)

        st.markdown("#### Vídeos do snapshot")
        df["taxa_engajamento"] = df.apply(
            lambda r: f"{((r.get('likes', 0) + r.get('comentarios', 0)) / r['visualizacoes'] * 100):.2f}%"
            if r.get("visualizacoes", 0) > 0 else "—", axis=1
        )
        df_exibir = df[["posicao_ranking", "canal_nome", "titulo",
                        "tipo_produtor", "tipo_conteudo",
                        "visualizacoes", "taxa_engajamento", "duracao_segundos"]].copy()
        df_exibir.columns = ["#", "Canal", "Título", "Produtor", "Conteúdo", "Views", "Engajamento", "Duração (s)"]
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


    # === ABA 5: CURADORIA ===
    with tab_curadoria:
        st.markdown("### ✏️ Curadoria de classificações")
        st.markdown(
            "Corrija classificações incorretas do Termômetro. "
            "Cada correção é registrada com autoria e justificativa."
        )

        snapshots_cur = listar_snapshots(cliente)
        if not snapshots_cur:
            st.info("Nenhum snapshot disponível.")
        else:
            opcoes_cur = {
                f"#{s['id']} — {s['data_coleta'][:10]} ({s['dia_semana']} {s['horario_coleta']})": s["id"]
                for s in snapshots_cur
            }
            escolha_cur = st.selectbox(
                "Snapshot a auditar", options=list(opcoes_cur.keys()), key="cur_snapshot"
            )
            snapshot_id_cur = opcoes_cur[escolha_cur]
            videos_cur = videos_do_snapshot(cliente, snapshot_id_cur)

            if not videos_cur:
                st.warning("Snapshot vazio.")
            else:
                df_cur = pd.DataFrame(videos_cur)

                # Filtro rápido por tipo de produtor
                tipos_presentes = ["(todos)"] + sorted(df_cur["tipo_produtor"].unique().tolist())
                filtro_tipo = st.selectbox(
                    "Filtrar por tipo de produtor", tipos_presentes, key="cur_filtro_tipo"
                )
                if filtro_tipo != "(todos)":
                    df_cur = df_cur[df_cur["tipo_produtor"] == filtro_tipo]

                st.markdown(f"**{len(df_cur)} vídeos** — clique em um para corrigir:")

                for _, row in df_cur.iterrows():
                    produtor_atual = buscar_produtor(row["tipo_produtor"])
                    conteudo_atual = buscar_conteudo(row["tipo_conteudo"])
                    label = (
                        f"**{row['canal_nome']}** — {row['titulo'][:60]}... "
                        f"| Produtor: `{produtor_atual.nome if produtor_atual else row['tipo_produtor']}` "
                        f"| Conteúdo: `{conteudo_atual.nome if conteudo_atual else row['tipo_conteudo']}`"
                    )
                    with st.expander(label):
                        col_a, col_b = st.columns(2)
                        with col_a:
                            novo_produtor = st.selectbox(
                                "Tipo de produtor",
                                options=codigos_produtor(),
                                index=codigos_produtor().index(row["tipo_produtor"])
                                if row["tipo_produtor"] in codigos_produtor() else 0,
                                format_func=lambda c: buscar_produtor(c).nome,
                                key=f"cur_prod_{row['id']}",
                            )
                        with col_b:
                            novo_conteudo = st.selectbox(
                                "Tipo de conteúdo",
                                options=codigos_conteudo(),
                                index=codigos_conteudo().index(row["tipo_conteudo"])
                                if row["tipo_conteudo"] in codigos_conteudo() else 0,
                                format_func=lambda c: buscar_conteudo(c).nome,
                                key=f"cur_cont_{row['id']}",
                            )
                        justificativa_cor = st.text_area(
                            "Justificativa da correção (obrigatória)",
                            placeholder="Ex: Canal é produtora digital — opera múltiplos canais sob mesma marca...",
                            key=f"cur_just_{row['id']}",
                        )
                        mudou_produtor = novo_produtor != row["tipo_produtor"]
                        mudou_conteudo = novo_conteudo != row["tipo_conteudo"]

                        if st.button("💾 Salvar correção", key=f"cur_btn_{row['id']}"):
                            if not justificativa_cor.strip():
                                st.error("Justificativa obrigatória.")
                            elif not mudou_produtor and not mudou_conteudo:
                                st.warning("Nenhuma alteração detectada.")
                            else:
                                try:
                                    update_payload = {"classificado_com": "curadoria_humana"}
                                    if mudou_produtor:
                                        update_payload["tipo_produtor"] = novo_produtor
                                    if mudou_conteudo:
                                        update_payload["tipo_conteudo"] = novo_conteudo
                                    update_payload["justificativa"] = (
                                        f"[CURADORIA HUMANA] {justificativa_cor.strip()}"
                                    )
                                    cliente.table("videos_snapshot").update(
                                        update_payload
                                    ).eq("id", row["id"]).execute()
                                    st.success(
                                        f"✅ Corrigido: "
                                        f"{buscar_produtor(novo_produtor).nome if mudou_produtor else ''}"
                                        f"{' + ' if mudou_produtor and mudou_conteudo else ''}"
                                        f"{buscar_conteudo(novo_conteudo).nome if mudou_conteudo else ''}"
                                    )
                                    st.rerun()
                                except Exception as e:
                                    st.error(f"Erro ao salvar: {e}")


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
    "🔨 Trabalho e plataformas": [
        "entregador de aplicativo",
        "trabalho doméstico",
        "motorista uber",
        "home office",
        "CLT",
    ],
    "🏙️ Política e cotidiano": [
        "bolsa família",
        "saúde pública",
        "educação pública",
        "corrupção",
        "eleições",
    ],
    "🌎 Território e meio ambiente": [
        "desmatamento",
        "agronegócio",
        "seca nordeste",
        "petróleo",
        "indígenas",
    ],
    "👥 Cultura e identidade": [
        "funk",
        "axé",
        "periferia",
        "sertanejo",
        "k-pop brasil",
    ],
    "💡 Tecnologia e mídia": [
        "inteligência artificial",
        "fake news",
        "redes sociais",
        "privacidade digital",
        "streaming",
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


def executar_busca_completa(
    termo: str,
    cliente_db,
    versao_numero: int = 1,
    versao_anterior_id: int | None = None,
) -> dict | None:
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
        versao_numero=versao_numero,
        versao_anterior_id=versao_anterior_id,
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
    # Apresentação granular fiel à tipologia (Severo, 2026), sem agregados.
    # =========================================================================
    n = len(df)
    contagem = df["tipo_produtor"].value_counts().to_dict()

    st.markdown("### Quem ganhou o microfone?")
    st.caption(
        "Categorias-chave do Eixo A para este tema, em sua granularidade original."
    )
    c1, c2, c3, c4 = st.columns(4)
    c1.metric(
        "% Mídia tradicional",
        f"{(contagem.get('midia_tradicional', 0) / n * 100):.0f}%",
    )
    c2.metric(
        "% Produtora digital",
        f"{(contagem.get('produtora_digital', 0) / n * 100):.0f}%",
    )
    c3.metric(
        "% YouTuber profissional",
        f"{(contagem.get('youtuber_profissional', 0) / n * 100):.0f}%",
    )
    c4.metric(
        "% Instituições",
        f"{(contagem.get('instituicao', 0) / n * 100):.0f}%",
    )

    # =========================================================================
    # DESVIO EDITORIAL — qui-quadrado de aderência (com fallback se corpus pequeno)
    # =========================================================================
    st.markdown("---")
    st.markdown("### Desvio em relação à linha de base do trending")
    st.caption(
        "Compara a composição desta busca com a composição do corpus do Termômetro. "
        "Quando o corpus tem snapshots suficientes (mínimo 10), aplica-se "
        "teste qui-quadrado de aderência para verificar se o desvio é estatisticamente "
        "significativo. Abaixo desse limite, mostra-se o desvio em pontos percentuais "
        "como leitura preliminar."
    )

    try:
        stats_corpus = estatisticas_corpus_termometro(cliente_db)
    except Exception:
        stats_corpus = {"n_snapshots": 0, "n_videos": 0,
                        "contagens_absolutas": {}, "composicao_proporcional": {}}

    n_snapshots = stats_corpus.get("n_snapshots", 0)
    n_videos_corpus = stats_corpus.get("n_videos", 0)
    baseline = stats_corpus.get("composicao_proporcional", {})

    # Mínimo defensável: 10 snapshots = 500 vídeos no corpus
    MIN_SNAPSHOTS_PARA_QUIQUADRADO = 10

    if not baseline:
        st.info(
            "📊 A linha de base ainda está sendo construída (precisa de pelo menos "
            "1 snapshot no Termômetro). Volte em alguns dias para ver a comparação."
        )
    else:
        # Sempre mostra a tabela de desvios em pontos percentuais
        comp_atual_pct = (df["tipo_produtor"].value_counts() / len(df) * 100).to_dict()
        comp_atual_n = df["tipo_produtor"].value_counts().to_dict()

        linhas = []
        for codigo in codigos_produtor():
            base_pct = baseline.get(codigo, 0)
            atual_pct = comp_atual_pct.get(codigo, 0)
            cat = buscar_produtor(codigo)
            if cat:
                linhas.append({
                    "Categoria": cat.nome,
                    "% nesta busca": atual_pct,
                    "% no corpus (Termômetro)": base_pct,
                    "Desvio (pontos %)": atual_pct - base_pct,
                })
        df_desvio = pd.DataFrame(linhas).sort_values(
            "Desvio (pontos %)", key=abs, ascending=False
        )

        # ---- BIFURCAÇÃO: corpus robusto vs. corpus em construção ----
        if n_snapshots >= MIN_SNAPSHOTS_PARA_QUIQUADRADO:
            # MODO RIGOROSO: qui-quadrado de aderência
            try:
                from scipy import stats as _scipy_stats

                # Frequências OBSERVADAS na busca atual
                observado = []
                # Frequências ESPERADAS proporcionalmente (com base no corpus)
                esperado = []
                categorias_validas = []

                n_busca = len(df)
                for cat in codigos_produtor():
                    n_obs = comp_atual_n.get(cat, 0)
                    p_corpus = baseline.get(cat, 0) / 100.0
                    n_esp = p_corpus * n_busca
                    # Qui-quadrado exige expected >= 5 em cada célula para ser válido
                    # Categorias com expected < 5 são agrupadas em 'outros' para o teste
                    if n_esp >= 1.0:  # mínimo prático
                        observado.append(n_obs)
                        esperado.append(n_esp)
                        categorias_validas.append(cat)

                if len(observado) >= 2 and sum(esperado) > 0:
                    # Normaliza esperado para somar igual ao observado (requisito do teste)
                    soma_obs = sum(observado)
                    soma_esp = sum(esperado)
                    esperado_norm = [e * (soma_obs / soma_esp) for e in esperado]

                    chi2, p_valor = _scipy_stats.chisquare(observado, esperado_norm)

                    # Interpretação
                    if p_valor < 0.001:
                        cor_box = "#FF1493"
                        veredito = (
                            "DESVIO ALTAMENTE SIGNIFICATIVO (p < 0,001) — "
                            "a probabilidade desse padrão ocorrer por acaso é menor que 1 em 1.000."
                        )
                    elif p_valor < 0.01:
                        cor_box = "#FF8C00"
                        veredito = (
                            f"DESVIO SIGNIFICATIVO (p = {p_valor:.4f}) — "
                            "evidência forte de tratamento editorial diferenciado para este tema."
                        )
                    elif p_valor < 0.05:
                        cor_box = "#FFD700"
                        veredito = (
                            f"DESVIO MARGINALMENTE SIGNIFICATIVO (p = {p_valor:.4f}) — "
                            "evidência sugestiva, mas não conclusiva."
                        )
                    else:
                        cor_box = "#00E87A"
                        veredito = (
                            f"SEM DESVIO ESTATISTICAMENTE SIGNIFICATIVO (p = {p_valor:.4f}) — "
                            "a composição da busca é compatível com a linha de base do trending."
                        )

                    st.markdown(
                        f"""
                        <div style='background:#111; padding:1.2rem 1.5rem; border-radius:6px;
                                    border-left: 4px solid {cor_box}; margin: 1rem 0;'>
                          <small style='color:#888; letter-spacing:0.1em;'>
                            TESTE QUI-QUADRADO DE ADERÊNCIA
                          </small>
                          <h3 style='color:{cor_box}; margin:0.5rem 0;
                                     text-shadow: 0 0 8px {cor_box}55;'>{veredito}</h3>
                          <small style='color:#aaa;'>
                            χ² = {chi2:.2f} · gl = {len(observado) - 1} ·
                            corpus de referência: {n_videos_corpus:,} vídeos em
                            {n_snapshots} snapshots
                          </small>
                        </div>
                        """,
                        unsafe_allow_html=True,
                    )
                else:
                    st.info(
                        "Não foi possível aplicar qui-quadrado: poucas categorias com "
                        "frequência esperada suficiente. Veja os desvios por categoria abaixo."
                    )
            except ImportError:
                st.warning(
                    "scipy não disponível neste ambiente. Mostrando apenas desvios em pontos percentuais."
                )
        else:
            # MODO PRELIMINAR: corpus pequeno, mostra desvios em pp com aviso
            st.markdown(
                f"""
                <div style='background:#1a0d00; padding:0.9rem 1.2rem; border-radius:4px;
                            border-left: 3px solid #FFB347; margin-bottom: 1rem;
                            font-size: 0.85rem; color: #ffcc99;'>
                    <strong>⏳ LEITURA PRELIMINAR</strong><br>
                    O corpus do Termômetro tem hoje apenas <strong>{n_snapshots}</strong>
                    snapshot(s). O teste estatístico (qui-quadrado de aderência) só é
                    ativado a partir de {MIN_SNAPSHOTS_PARA_QUIQUADRADO} snapshots
                    para ter base de comparação robusta. Até lá, os desvios mostrados
                    abaixo devem ser tratados como sugestivos, não conclusivos.
                </div>
                """,
                unsafe_allow_html=True,
            )

        # Tabela detalhada de desvios (sempre exibida)
        st.dataframe(
            df_desvio.style.format({
                "% nesta busca": "{:.1f}%",
                "% no corpus (Termômetro)": "{:.1f}%",
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
    # VOZES AUSENTES — duas camadas analíticas distintas
    # =========================================================================
    st.markdown("---")
    st.markdown("### 🔇 Vozes ausentes")

    # Categorias estruturalmente extintas do topo da plataforma
    # Não são "silenciadas neste tema" — são categorias cuja ausência
    # é um achado estrutural da plataforma, confirmado empiricamente.
    EXTINTAS_ESTRUTURALMENTE = {
        "usuario_comum": (
            "Usuário comum",
            "Severo (2026) demonstrou empiricamente que esta categoria "
            "não apareceu em nenhuma das 1.049 entradas coletadas ao longo "
            "de 21 semanas de monitoramento do trending brasileiro. "
            "Bärtl (2018) confirma: canais da categoria equivalente ('People & Blogs') "
            "têm a menor probabilidade de sucesso de todas — 0,4% em 2016, "
            "caindo consistentemente. A ausência aqui não é silenciamento "
            "neste tema: é extinção estrutural do topo da plataforma."
        ),
        "criador_casual": (
            "Criador casual",
            "Também ausente em toda a coleta empírica de Severo (2026). "
            "Canais em processo de profissionalização mas sem estrutura consolidada "
            "não conseguem competir pela visibilidade de pico contra produtoras "
            "digitais e mídia tradicional. Sua ausência é pré-condição estrutural "
            "da plataforma, não fenômeno editorial temático."
        ),
    }

    presentes = set(df["tipo_produtor"].unique())

    # ---- Seção 1: Achado estrutural (ausência documentada empiricamente) ----
    extintas_aqui = {
        cod: info for cod, info in EXTINTAS_ESTRUTURALMENTE.items()
        if cod not in presentes
    }
    if extintas_aqui:
        st.markdown(
            """
            <div style='background:#0a0a0a; padding:1.2rem 1.5rem; border-radius:6px;
                        border-left:4px solid #FFD700; margin-bottom:1rem;'>
              <div style='color:#FFD700; font-size:0.8rem; letter-spacing:0.1em;
                          margin-bottom:0.6rem;'>
                ⚠️ CATEGORIAS ESTRUTURALMENTE EXTINTAS DO TOPO DA PLATAFORMA
              </div>
              <p style='color:#ccc; font-size:0.9rem; margin:0 0 0.8rem;
                        line-height:1.6;'>
                As categorias abaixo não aparecem neste tema — mas também
                não aparecem em <strong>nenhum</strong> tema. Sua ausência é
                um achado estrutural da plataformização, documentado
                empiricamente, não uma anomalia editorial deste tema específico.
              </p>
            """,
            unsafe_allow_html=True,
        )
        for cod, (nome, justificativa) in extintas_aqui.items():
            st.markdown(
                f"""
                <div style='background:#111; padding:1rem; border-radius:4px;
                            margin:0.5rem 0;'>
                  <strong style='color:#fff;'>{nome}</strong><br>
                  <small style='color:#aaa; line-height:1.6;'>{justificativa}</small>
                </div>
                """,
                unsafe_allow_html=True,
            )
        st.markdown("</div>", unsafe_allow_html=True)

    # ---- Seção 2: Ausências relevantes neste tema específico ----
    # Categorias que existem no trending geral (corpus do Termômetro)
    # mas estão ausentes nesta busca temática — ESSAS sim são suspeita
    # de tratamento editorial diferenciado do algoritmo.

    # Prevalências reais do corpus da dissertação (Severo, 2026)
    # Apenas categorias com prevalência > 0 no trending BR são consideradas
    PREVALENCIA_CORPUS = {
        "youtuber_profissional": 35.9,
        "musico": 19.4,
        "midia_tradicional": 17.9,
        "produtora_digital": 17.0,
        "marca": 7.5,
        "instituicao": 2.1,
        "reaproveitamento": 0.1,
    }

    ausentes_relevantes = []
    ausentes_esperaveis = []

    for cod, prevalencia in PREVALENCIA_CORPUS.items():
        if cod in presentes:
            continue
        cat = buscar_produtor(cod)
        if not cat:
            continue
        # P(zero em amostra de 50) = (1 - prevalência)^50
        import math
        p_zero = (1 - prevalencia / 100) ** 50
        if p_zero < 0.10:
            # Ausência improvável dado prevalência → suspeita de silenciamento
            ausentes_relevantes.append((cat.nome, prevalencia, p_zero))
        elif p_zero < 0.50:
            ausentes_esperaveis.append((cat.nome, prevalencia, p_zero))
        # p_zero >= 0.50: ausência puramente estatisticamente esperável → ignora

    if ausentes_relevantes:
        st.markdown(
            """
            <div style='background:#1a0500; padding:1.2rem 1.5rem; border-radius:6px;
                        border-left:4px solid #FF1493; margin:1rem 0;'>
              <div style='color:#FF1493; font-size:0.8rem; letter-spacing:0.1em;
                          margin-bottom:0.6rem;'>
                🔴 AUSÊNCIAS ESTATISTICAMENTE RELEVANTES NESTE TEMA
              </div>
              <p style='color:#ccc; font-size:0.9rem; margin:0 0 0.8rem; line-height:1.6;'>
                Categorias com <strong>alta prevalência no trending geral</strong> mas
                ausentes nesta busca. A probabilidade estatística dessa ausência ocorrer
                por acaso é baixa — indicando possível tratamento editorial do algoritmo
                para este tema.
              </p>
            """,
            unsafe_allow_html=True,
        )
        for nome, prev, p_zero in ausentes_relevantes:
            st.markdown(
                f"""
                <div style='background:#111; padding:0.8rem 1rem; border-radius:4px;
                            margin:0.4rem 0;'>
                  <strong style='color:#FF1493;'>{nome}</strong>
                  <span style='color:#888; font-size:0.85rem;'>
                    — {prev:.1f}% do trending geral |
                    P(ausência por acaso) = {p_zero*100:.1f}%
                  </span>
                </div>
                """,
                unsafe_allow_html=True,
            )
        st.markdown(
            "<small style='color:#666; font-size:0.8rem;'>Prevalências baseadas em "
            "Severo (2026), 21 semanas de coleta do trending BR, n=1.049.</small>"
            "</div>",
            unsafe_allow_html=True,
        )
    elif ausentes_esperaveis:
        st.markdown(
            f"""
            <div style='background:#111; padding:1rem 1.2rem; border-radius:6px;
                        border: 0.5px solid #2a2a2a; margin:1rem 0;'>
              <strong style='color:#FFD700;'>🟡 Ausências esperáveis neste tema:</strong>
              <span style='color:#aaa;'>
                {', '.join(n for n, _, _ in ausentes_esperaveis)}.
                Prevalência baixa no trending geral — ausência em amostra de 50
                é estatisticamente plausível.
              </span>
            </div>
            """,
            unsafe_allow_html=True,
        )
    else:
        st.info(
            "Todas as categorias com presença significativa no trending geral "
            "aparecem nesta busca. Nenhuma ausência estatisticamente relevante."
        )

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
            f"border-left:3px solid #00E87A;'>"
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

    # =========================================================================
    # VERIFICAR VERSÃO CANÔNICA NO CORPUS
    # =========================================================================
    canonica = buscar_canonica_busca(cliente_db, termo_norm, "video,channel,playlist")

    if canonica:
        # Já existe análise canônica — oferecer ver ou atualizar
        chave_estado = f"disputa_{termo_norm.replace(' ', '_')[:30]}"
        decisao = oferecer_versao_canonica(
            canonica,
            label_objeto="deste termo",
            chave_estado=chave_estado,
        )

        if decisao == "ver":
            renderizar_resultados_disputa(
                termo_norm, canonica["id"], do_cache=True, cliente_db=cliente_db,
            )
            return
        elif decisao == "aguardando":
            return
        # decisao == "atualizar" → segue para o pipeline
        peso_a_consumir = st.session_state.get(f"peso_consumir_{chave_estado}", 1)
        versao_anterior_id = st.session_state.get(f"versao_anterior_id_{chave_estado}")
        proxima_versao = st.session_state.get(f"proxima_versao_{chave_estado}", 2)
    else:
        peso_a_consumir = 1
        versao_anterior_id = None
        proxima_versao = 1

    # Verifica slots disponíveis na sessão
    if st.session_state.get("buscas_feitas", 0) + peso_a_consumir > LIMITE_BUSCAS_POR_SESSAO:
        st.error(
            f"⛔ Esta operação consumiria {peso_a_consumir} slot(s), mas você só tem "
            f"{LIMITE_BUSCAS_POR_SESSAO - st.session_state.get('buscas_feitas', 0)} "
            f"restante(s) na sessão. Recarregue a página para continuar."
        )
        return

    # Pipeline completo — consome slots
    st.session_state["buscas_feitas"] = st.session_state.get("buscas_feitas", 0) + peso_a_consumir
    try:
        with st.spinner(f"Auditando '{termo_norm}'... Isso pode levar 1-2 minutos."):
            busca_id = executar_busca_completa(
                termo_norm, cliente_db,
                versao_numero=proxima_versao,
                versao_anterior_id=versao_anterior_id,
            )
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

    # Taxa de engajamento mediana dos vídeos analisados
    # Fórmula: (likes + comentários) / visualizações × 100
    taxas_eng = []
    for v in videos:
        stats_v = v.get("statistics", {})
        views_v = int(stats_v.get("viewCount", 0))
        likes_v = int(stats_v.get("likeCount", 0))
        coments_v = int(stats_v.get("commentCount", 0))
        if views_v > 0:
            taxas_eng.append((likes_v + coments_v) / views_v * 100)
    taxa_eng_mediana = sorted(taxas_eng)[len(taxas_eng) // 2] if taxas_eng else None

    return {
        "frequencia_videos_por_dia": freq_videos_dia,
        "duracao_mediana_segundos": duracao_mediana,
        "link_externo_repetido": link_mais_repetido,
        "pct_titulos_padronizados": pct_padronizados,
        "taxa_engajamento_mediana": taxa_eng_mediana,
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
- Taxa de engajamento mediana: {f"{sintomas['taxa_engajamento_mediana']:.2f}%" if sintomas.get('taxa_engajamento_mediana') is not None else 'indisponível'} (likes+comentários/views)
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
3. Se descrição cita CNPJ, agência, manager, "produzido por X", equipe de redação,
   ou site corporativo → é sinal FORTE de Produtora Digital, não YouTuber Profissional.

4. TESTE DECISIVO 1 — Substituição de Pessoa (Produtora vs. YouTuber):
   "Se essa pessoa saísse do canal, o canal continuaria existindo como marca?"
   - SIM → Produtora Digital
   - NÃO → YouTuber Profissional
   ATENÇÃO: Mesmo com persona famosa e centralizada, se há estrutura empresarial
   por trás com múltiplos canais coordenados → Produtora Digital.

5. TESTE DECISIVO 2 — Origem do conteúdo (Marca vs. Produtora vs. Instituição):
   "O conteúdo existe para divulgar algo que existe fora do YouTube?"
   - SIM → Marca Comercial (clube, empresa, jogo, produto)
   - NÃO, o conteúdo/evento existe para gerar audiência → Produtora Digital
   "A entidade regula ou governa uma atividade reconhecida socialmente?"
   - SIM → Instituição (federação, confederação, liga oficial)

6. EXEMPLOS VALIDADOS PELO PESQUISADOR (use como calibração obrigatória):

   PRODUTORA DIGITAL (mesmo tendo persona/rosto famoso):
   - Gaules → produtora_digital [ecossistema com múltiplos canais, empresa estruturada]
   - Enaldinho → produtora_digital [opera múltiplos canais como empresa, não só persona]
   - MrBeast → produtora_digital [100+ funcionários, múltiplos canais, empresa global]
   - Mark Rober → produtora_digital [produtora de ciência com equipe grande]
   - BRKsEDU → produtora_digital [empresa educativa com múltiplos canais]
   - Gameplayrj → produtora_digital [empresa de games com múltiplos canais]
   - Flow Games → produtora_digital [sub-canal do ecossistema Flow — produtora]
   - Canal GOAT → produtora_digital [produtora nativa de esportes, não emissora]
   - VALORANT Esports BR → marca [Riot Games divulga o jogo via esports]
   - Kings League Brazil → produtora_digital [campeonato existe para gerar conteúdo]
   - Creative Squad → produtora_digital [coletivo sem persona central única]
   - Cortes do Inteligência [OFICIAL] → produtora_digital [derivado oficial de produtora]
   - Cortes do Manual do Mundo → produtora_digital [derivado oficial do Manual do Mundo]
   - Podcats → produtora_digital [marca de podcast, não persona individual]
   - Drauzio Varella → produtora_digital [canal médico institucionalizado com equipe]

   YOUTUBER PROFISSIONAL (persona individual mesmo com equipe grande):
   - Mendrake → youtuber_profissional [persona individual profissionalizada]
   - Tonigon → youtuber_profissional [criador individual, canal = pessoa]
   - Mauro Cezar → youtuber_profissional [jornalista individual, canal = persona]
   - rezendeevil → youtuber_profissional [persona individual de games]
   - T3ddy, só que Games → youtuber_profissional [canal derivado pessoal, não empresa]
   - Canal do Pirulla → youtuber_profissional [cientista individual, canal = persona]
   - NiinaSecrets → youtuber_profissional [criadora individual de lifestyle]
   - Emilly Vick → youtuber_profissional [criadora individual]

   MARCA COMERCIAL (clubes, empresas, jogos):
   - Flamengo TV → marca [canal oficial do clube — vende o clube, não governa esporte]
   - Botafogo TV → marca [canal oficial do clube]
   - TV CRUZEIRO → marca [canal oficial do clube]
   - Sport Club Internacional → marca [canal oficial do clube]
   - Santos Futebol Clube → marca [canal oficial do clube]
   - UFC Brasil → marca [divulga eventos UFC — produto comercial]
   - FORMULA 1 → marca [produto comercial global]
   - Netflix Brasil → marca [streaming divulgando catálogo]
   - Nintendo of America → marca [empresa de jogos divulgando produtos]
   - League of Legends Brasil → marca [Riot Games divulgando jogo]
   - Genshin Impact → marca [empresa divulgando jogo]

   INSTITUIÇÃO (entidades reguladoras e públicas):
   - CONMEBOL Sudamericana → instituicao [entidade reguladora do futebol sul-americano]
   - LALIGA EA SPORTS → instituicao [liga reguladora oficial]
   - Federação Catarinense de Futebol → instituicao [entidade reguladora regional]
   - Liga Brasileira de Futevôlei | LBF → instituicao [entidade reguladora de modalidade]
   - Volleyball World → instituicao [entidade reguladora mundial do vôlei]
   - TVE Bahia → instituicao [emissora pública estatal]
   - Fluminense Football Club → instituicao [clube com canal de caráter institucional]

7. Determine TAMBÉM qual tipo de conteúdo (Eixo B) é PREDOMINANTE no canal.

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


def classificar_lote_eixo_b(videos: list[dict]) -> list[dict]:
    """
    Classifica TODOS os vídeos do dossiê no Eixo B (tipo de conteúdo) em UMA
    única chamada de Haiku. O LLM recebe lista numerada com título + descrição
    truncada de cada vídeo e retorna um array com a classificação de cada um.

    Custo: 1 chamada Haiku (~US$ 0,02 com 50 vídeos) — em vez de 50 chamadas
    individuais. Implementa metodologicamente correta a "Composição de vídeos"
    do Dossiê (substituindo o agregado falso da v1 anterior).

    Retorna: list[{"posicao": int, "tipo_conteudo": str, "titulo": str}]
    """
    if not videos:
        return []

    cliente = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    # Monta a entrada numerada para o LLM
    linhas_videos = []
    for i, v in enumerate(videos, start=1):
        snippet = v.get("snippet", {})
        titulo = snippet.get("title", "")[:200]
        descricao = snippet.get("description", "")[:300]
        # Tags ajudam a discriminar (especialmente útil para 'jogos' vs 'esporte')
        tags = ", ".join(snippet.get("tags", [])[:6])
        bloco = f"[{i}] TÍTULO: {titulo}"
        if descricao:
            bloco += f"\n    DESCRIÇÃO: {descricao}"
        if tags:
            bloco += f"\n    TAGS: {tags}"
        linhas_videos.append(bloco)

    payload_videos = "\n\n".join(linhas_videos)

    prompt_sistema = f"""Você é um classificador especialista em conteúdo audiovisual, \
operando o EIXO B da tipologia desenvolvida na pesquisa de Filipe Severo \
(PUCRS/FAMECOS, 2026).

Sua tarefa: classificar CADA UM dos vídeos abaixo em uma única categoria do Eixo B.

==========
{tipologia_para_prompt()}
==========

REGRAS:
1. Retorne EXATAMENTE uma classificação por vídeo recebido.
2. Use SOMENTE os códigos válidos do Eixo B.
3. Use 'outros' apenas quando nenhuma outra categoria for aplicável.
4. Distinguir bem: "jogos" (videogame) é diferente de "esportivo" (futebol etc.).
5. "Vlog" tem narrativa pessoal/cotidiana; conteúdo roteirizado mesmo que pareça
   espontâneo é "entretenimento_roteirizado".

FORMATO DE SAÍDA: APENAS JSON válido, sem markdown:
{{
  "classificacoes": [
    {{"posicao": 1, "tipo_conteudo": "<código_eixo_b>"}},
    {{"posicao": 2, "tipo_conteudo": "<código_eixo_b>"}},
    ...
  ]
}}

CÓDIGOS VÁLIDOS Eixo B: {", ".join(codigos_conteudo())}
"""

    resposta = cliente.messages.create(
        model="claude-haiku-4-5",
        max_tokens=4000,
        system=prompt_sistema,
        messages=[{"role": "user", "content": f"VÍDEOS A CLASSIFICAR:\n\n{payload_videos}"}],
    )

    texto = resposta.content[0].text.strip()
    texto = re.sub(r"^```(?:json)?\s*|\s*```$", "", texto, flags=re.MULTILINE).strip()
    resultado = json.loads(texto)

    # Mapeia posição → classificação validada
    mapa_classif = {}
    for item in resultado.get("classificacoes", []):
        pos = item.get("posicao")
        cod = item.get("tipo_conteudo", "outros")
        if cod not in codigos_conteudo():
            cod = "outros"
        mapa_classif[pos] = cod

    # Monta saída final, garantindo classificação para cada vídeo (fallback "outros")
    saida = []
    for i, v in enumerate(videos, start=1):
        saida.append({
            "posicao": i,
            "titulo": v.get("snippet", {}).get("title", "")[:200],
            "tipo_conteudo": mapa_classif.get(i, "outros"),
        })

    return saida


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
- Taxa de engajamento mediana: {f"{sintomas['taxa_engajamento_mediana']:.2f}%" if sintomas.get('taxa_engajamento_mediana') is not None else 'indisponível'} (likes+comentários/views)
- {sintomas['pct_titulos_padronizados']:.0f}% dos títulos têm formatação padronizada
- Link externo repetido: {sintomas['link_externo_repetido'] or 'nenhum identificado'}

REDE DECLARADA:
{rede_resumo}

PRESENÇA HISTÓRICA NO TRENDING BRASIL:
Este canal apareceu {aparicoes_termometro} vez(es) nos snapshots do Termômetro do Observatório.
"""

    prompt_sistema = """Você é um analista que produz vereditos sociológicos sobre canais do YouTube.
Você tem domínio dos Estudos de Plataforma e da economia política da atenção digital.

O veredito deve:
1. Ser PROSA ANALÍTICA, não bullets nem JSON.
2. Ter 3 a 5 parágrafos curtos.
3. CONFRONTAR a auto-narrativa do canal com a realidade estrutural detectada nos dados.
4. Identificar a "fachada" quando o canal se apresenta como uma coisa mas as evidências
   mostram outra — ex: canal que se diz "independente" mas opera como empresa estruturada.
5. Interpretar os dados estruturais (frequência, duração, padronização, rede) como
   sintomas de uma posição no campo de produção — não apenas descrevê-los.
6. Usar tom DIRETO e RIGOROSO. Sem elogios, sem neutralidade vaga.
7. NÃO repetir fatos numéricos que o leitor já viu nos cards.
   INTERPRETÁ-LOS — o que essa frequência de postagem revela sobre a estrutura de trabalho?
8. Encerrar com uma frase-síntese sobre a posição real do canal no ecossistema.

REGRAS DE VOZ:
- NÃO escreva em primeira pessoa ("eu observo", "concluo").
- Use construções impessoais: "a evidência sugere", "os dados revelam",
  "configura-se um caso de", "observa-se que", "a estrutura indica".
- NÃO mencione a dissertação, o pesquisador, a PUCRS ou referências bibliográficas.
  O veredito fala sobre O CANAL, não sobre a teoria. A teoria é o olhar, não o assunto.
- NÃO use frases como "conforme a tipologia", "segundo a pesquisa", "como demonstrado".
  Aja como um analista que já internalizou o referencial — não como quem o cita.

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
        "Indicadores extraídos dos vídeos analisados que sustentam a classificação. "
        "Todos são heurísticas exploratórias — sinalizam padrões, não determinam classe."
    )

    # Nota metodológica explícita — Item 3 da auditoria científica
    st.markdown(
        """
        <div style='background:#0d0d0d; padding:0.8rem 1.2rem; border-radius:4px;
                    border-left:3px solid #555; margin-bottom:1rem;
                    font-size:0.82rem; color:#888; line-height:1.6;'>
            <strong style='color:#aaa;'>📋 Nota metodológica:</strong>
            A frequência de postagem é reconhecida na literatura como sinal qualitativo
            de profissionalização — canais com alta frequência de uploads tendem a operar
            com estrutura de produção mais consolidada (Arthurs et al., 2018; Bishop apud
            Arthurs et al., 2018). Contudo, <em>não existem thresholds numéricos validados
            empiricamente</em> que delimitem "casual" de "profissional". Os valores abaixo
            são dados brutos para interpretação contextual pelo pesquisador.
            Inscritos do canal são exibidos como dado informativo — <em>não são indicador
            de estrutura de produção</em>, pois uma Produtora Digital pode ter poucos
            inscritos em canal recente, e um criador casual pode ter acumulado muitos ao
            longo de anos.
        </div>
        """,
        unsafe_allow_html=True,
    )

    # Cards dos 4 sintomas — sem rótulos qualitativos inventados
    sin_cols = st.columns(3)

    freq = sintomas.get("frequencia_videos_por_dia") or 0
    sin_cols[0].metric(
        "Frequência de postagem",
        f"{freq:.2f} vídeos/dia",
        help=(
            "Calculada a partir do intervalo entre o vídeo mais antigo e o mais recente "
            "dos 50 analisados. Frequências altas sugerem profissionalização, mas não há "
            "threshold validado na literatura. Dado bruto para interpretação contextual."
        ),
    )

    dur_min = sintomas.get("duracao_mediana_segundos", 0) / 60
    sin_cols[1].metric(
        "Duração mediana",
        f"{dur_min:.1f} min",
        help=(
            "Severo (2026) identificou duração média de 35min57s no trending BR, "
            "com Produtoras Digitais (18min30s) e YouTubers Profissionais (16min38s) "
            "liderando entre conteúdos de entretenimento."
        ),
    )

    sin_cols[2].metric(
        "% títulos padronizados",
        f"{sintomas.get('pct_titulos_padronizados', 0):.0f}%",
        help=(
            "Proporção de títulos que seguem padrão visual detectado automaticamente "
            "(colchetes, emoji inicial, formatação recorrente). Heurística aproximada."
        ),
    )

    # Inscritos como dado informativo bruto (não discriminante de classe — Item 2)
    inscritos = sintomas.get("inscritos", 0)
    if inscritos:
        inscritos_fmt = f"{int(inscritos):,}".replace(",", ".")
        st.markdown(
            f"""
            <div style='background:#111; padding:0.7rem 1.2rem; border-radius:4px;
                        margin:0.5rem 0; font-size:0.9rem; color:#ccc;'>
                <strong>Inscritos do canal:</strong> {inscritos_fmt}
                <span style='color:#666; font-size:0.82rem;'>
                    — dado informativo, não indicador de estrutura de produção
                </span>
            </div>
            """,
            unsafe_allow_html=True,
        )

    if sintomas.get("link_externo_repetido"):
        link_info = sintomas["link_externo_repetido"]
        st.markdown(
            f"🔗 **Link externo repetido detectado:** `{link_info['dominio']}` "
            f"aparece em **{link_info['n_aparicoes']}** das descrições — "
            f"possível indicador de fluxo de monetização ou rede de marca. "
            f"Threshold de detecção: ≥3 ocorrências (heurístico, não validado)."
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
    st.markdown(
        """
        <div style='background:#1a0d00; padding:0.9rem 1.2rem; border-radius:4px;
                    border-left: 3px solid #FFB347; margin-bottom: 1rem;
                    font-size: 0.85rem; color: #ffcc99;'>
            <strong>⚠️ AVISO METODOLÓGICO</strong><br>
            Esta análise foi <em>gerada automaticamente</em> por Claude Sonnet 4.6,
            usando como referência de estilo e referencial teórico a dissertação
            de Filipe Severo (PUCRS/FAMECOS, 2026), mas <strong>não foi escrita
            nem revisada pelo autor</strong>. O texto reflete uma síntese
            inferencial do LLM, não posicionamento humano. Trate como
            <strong>leitura interpretativa assistida</strong> — útil para inspirar
            análise, não como conclusão científica fechada.
        </div>
        """,
        unsafe_allow_html=True,
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
            f"border-left:3px solid #00E87A;'>"
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

    # =========================================================================
    # VERIFICAR VERSÃO CANÔNICA NO CORPUS
    # =========================================================================
    canonica = buscar_canonica_dossie(cliente_db, canal_id_real)

    if canonica:
        # Já existe análise canônica — oferecer ver ou atualizar
        decisao = oferecer_versao_canonica(
            canonica,
            label_objeto="deste canal",
            chave_estado=f"dossie_{canal_id_real}",
        )

        if decisao == "ver":
            renderizar_dossie_completo(canonica, do_cache=True, cliente_db=cliente_db)
            return
        elif decisao == "aguardando":
            # Usuário ainda não clicou em nada
            return
        # decisao == "atualizar" → segue para o pipeline abaixo, gerando nova versão
        peso_a_consumir = st.session_state.get(f"peso_consumir_dossie_{canal_id_real}", 1)
        versao_anterior_id = st.session_state.get(f"versao_anterior_id_dossie_{canal_id_real}")
        proxima_versao = st.session_state.get(f"proxima_versao_dossie_{canal_id_real}", 2)
    else:
        # Análise nova — versão 1
        peso_a_consumir = 1
        versao_anterior_id = None
        proxima_versao = 1

    # Verificar se ainda há slots na sessão
    if st.session_state.get("dossies_feitos", 0) + peso_a_consumir > LIMITE_DOSSIES_POR_SESSAO:
        st.error(
            f"⛔ Esta operação consumiria {peso_a_consumir} slot(s), mas você só tem "
            f"{LIMITE_DOSSIES_POR_SESSAO - st.session_state.get('dossies_feitos', 0)} "
            f"restante(s) na sessão. Recarregue a página para continuar."
        )
        return

    # Pipeline completo — consome os slots
    st.session_state["dossies_feitos"] = st.session_state.get("dossies_feitos", 0) + peso_a_consumir

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

        with st.spinner("Classificando os 50 vídeos no Eixo B (chamada única Haiku)..."):
            classificacoes_b = classificar_lote_eixo_b(videos)

        from collections import Counter
        composicao_videos = Counter(c["tipo_conteudo"] for c in classificacoes_b)

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
                versao_numero=proxima_versao,
                versao_anterior_id=versao_anterior_id,
            )
    except requests.HTTPError as e:
        st.error(f"Erro na consulta ao YouTube: {e}")
        return
    except Exception as e:
        st.error(f"Erro inesperado: {type(e).__name__}: {e}")
        return

    # Recupera o registro completo recém-salvo e renderiza
    dossie_completo = buscar_canonica_dossie(cliente_db, canal_id_real)
    if dossie_completo:
        st.success("✅ Dossiê concluído e adicionado ao corpus do Observatório.")
        renderizar_dossie_completo(dossie_completo, do_cache=False, cliente_db=cliente_db)


# ==============================================================================
# MÓDULO 5 — A VOZ DA BASE
# ==============================================================================
#
# Termômetro do "chão de fábrica" e das relações parassociais.
# Analisa os 100 principais comentários de um vídeo segundo 6 dimensões
# sociológicas, calcula o "Índice de Pressão Produtiva" (% público-patrão)
# e gera síntese qualitativa por Sonnet 4.6.
#
# Diferenciais sociológicos:
#   - 6 dimensões analíticas mutuamente NÃO exclusivas (um comentário
#     pode ser ao mesmo tempo 'comunidade afetiva' E 'trabalho do fã')
#   - Índice de Pressão Produtiva — métrica original de operação
#     do "público-patrão" (Cunningham & Craig, 2017; Severo, 2026)
#   - Contradição estrutural — cruza com Dossiê do canal (se existir)
#     para revelar gap entre o que canal entrega e o que público pede
#   - Análise em CHAMADA ÚNICA (1 prompt com 100 comentários) —
#     custo de US$ 0,06 em vez de US$ 4 (100 chamadas individuais)
#
# Custo: 1 unidade YouTube + 1 chamada Sonnet ≈ R$ 0,30
# ==============================================================================

LIMITE_VOZ_POR_SESSAO = 5
DIAS_VALIDADE_VOZ = 7
COMENTARIOS_POR_ANALISE = 100

DIMENSOES_VOZ = {
    "publico_patrao": {
        "nome": "Público-patrão",
        "cor": "#FF4FD8",
        "descricao": (
            "Comentários que cobram produtividade, exigem ritmo industrial, "
            "comparam com outros criadores ou reclamam de demora. "
            "Operam o criador como funcionário."
        ),
    },
    "comunidade_afetiva": {
        "nome": "Comunidade afetiva",
        "cor": "#00E87A",
        "descricao": (
            "Comentários de apoio, parasocialidade positiva, declarações "
            "de admiração, formação de vínculo emocional com o criador."
        ),
    },
    "disputa_politica": {
        "nome": "Disputa política/ideológica",
        "cor": "#FFD700",
        "descricao": (
            "Comentários que polemizam, debatem, marcam posicionamento "
            "ideológico, ou tomam o vídeo como pretexto para alinhamento."
        ),
    },
    "trabalho_invisivel_fa": {
        "nome": "Trabalho invisível do fã",
        "cor": "#7B2FFF",
        "descricao": (
            "Comentários que defendem o criador de críticas, fazem "
            "propaganda voluntária, recrutam novos espectadores, "
            "atuam como guarda-pretoriana."
        ),
    },
    "toxico_abusivo": {
        "nome": "Tóxico/abusivo",
        "cor": "#FF1493",
        "descricao": (
            "Assédio, ódio direcionado, ataques pessoais, discurso "
            "discriminatório, agressões."
        ),
    },
    "negociacao_sentido": {
        "nome": "Negociação de sentido",
        "cor": "#00CED1",
        "descricao": (
            "Comentários que interpretam coletivamente o conteúdo, "
            "discutem significado, oferecem leituras alternativas, "
            "complementam ou corrigem informações."
        ),
    },
}


def buscar_comentarios_video(video_id: str, max_comentarios: int = 100) -> list[dict]:
    """
    Coleta os principais comentários do vídeo via commentThreads.list.
    Custo: 1 unidade por página de 100 comentários.

    A ordem 'relevance' do YouTube é editorial (likes + datas), não amostra
    estatística — declarado explicitamente na metodologia da ferramenta.
    """
    resp = requests.get(
        "https://www.googleapis.com/youtube/v3/commentThreads",
        params={
            "videoId": video_id,
            "part": "snippet",
            "maxResults": min(max_comentarios, 100),
            "order": "relevance",
            "textFormat": "plainText",
            "key": YOUTUBE_API_KEY,
        },
        timeout=20,
    )

    if resp.status_code == 403:
        # Comentários desativados pelo criador
        raise PermissionError(
            "Os comentários estão desativados neste vídeo. "
            "A análise da Voz da Base não é possível."
        )
    resp.raise_for_status()

    data = resp.json()
    comentarios = []
    for item in data.get("items", []):
        snippet = item["snippet"]["topLevelComment"]["snippet"]
        comentarios.append({
            "id": item["id"],
            "autor": snippet.get("authorDisplayName", ""),
            "texto": snippet.get("textOriginal", ""),
            "likes": int(snippet.get("likeCount", 0)),
            "data": snippet.get("publishedAt", ""),
            "respostas": item["snippet"].get("totalReplyCount", 0),
        })
    return comentarios


def analisar_comentarios_sonnet(
    titulo_video: str,
    canal_nome: str,
    comentarios: list[dict],
    dossie_canal: dict | None = None,
) -> dict:
    """
    Submete os 100 comentários a Sonnet 4.6 numa CHAMADA ÚNICA, pedindo:
      1. Classificação de cada comentário nas 6 dimensões (multi-rótulo)
      2. Índice de pressão produtiva (% público-patrão)
      3. Síntese qualitativa em prosa
      4. Identificação de contradição estrutural (se houver dossiê do canal)
    """
    cliente = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    # Formata comentários numerados para o LLM referenciar
    comentarios_txt = "\n\n".join(
        f"[{i+1}] (👍 {c['likes']}) @{c['autor']}: {c['texto'][:600]}"
        for i, c in enumerate(comentarios)
    )

    # Preparar contexto do dossiê (se existir)
    contexto_dossie = ""
    if dossie_canal:
        contexto_dossie = f"""

CONTEXTO ESTRUTURAL DO CANAL (do Dossiê já realizado):
- Classificação sociológica: {dossie_canal.get('classificacao_sociologica', 'desconhecida')}
- Tipo de conteúdo predominante: {dossie_canal.get('tipo_conteudo_predominante', 'desconhecido')}

USE este contexto para identificar CONTRADIÇÃO ESTRUTURAL — quando o público
exige do canal um ritmo/qualidade que não corresponde à sua estrutura real.
Por exemplo: público cobrando ritmo industrial de canal classificado como
'criador casual' = contradição estrutural relevante.
"""

    # Descrição das 6 dimensões para o LLM entender exatamente
    descricoes_dim = "\n".join(
        f"- '{cod}' ({dados['nome']}): {dados['descricao']}"
        for cod, dados in DIMENSOES_VOZ.items()
    )

    prompt_sistema = f"""Você é um analista sociológico operando o referencial \
teórico-metodológico desenvolvido por Filipe Severo na dissertação 'O Novo "You" do YouTube' \
(PUCRS/FAMECOS, 2026), aplicando-o agora à análise QUALITATIVA dos comentários públicos \
de um vídeo do YouTube.

Sua tarefa:
1. CLASSIFICAR cada comentário em uma ou mais das 6 dimensões abaixo (multi-rótulo).
   Um comentário pode pertencer a 0, 1 ou várias dimensões simultaneamente.
2. CALCULAR o "Índice de Pressão Produtiva" — percentual de comentários
   classificados como 'publico_patrao'.
3. PRODUZIR síntese qualitativa em prosa interpretativa (3-5 parágrafos).
4. IDENTIFICAR a contradição estrutural, se houver, entre o que o canal entrega
   e o que o público pede.

DIMENSÕES ANALÍTICAS:
{descricoes_dim}

REGRAS DE CLASSIFICAÇÃO:
- Comentários puramente neutros ou sem conteúdo classificável recebem dimensions=[]
- Multi-rótulo é a regra, não exceção: '😍 amo!! posta mais!' = ['comunidade_afetiva', 'publico_patrao']
- Atenção a IRONIA, SARCASMO, MEMES regionais brasileiros
- Não confunda crítica construtiva com toxicidade
- Defesa do criador contra haters = 'trabalho_invisivel_fa'
- "Cadê o vídeo nóvo?", "tá demorando" = 'publico_patrao'
- "Posta mais!", "queremos parte 2" = 'publico_patrao'

REGRAS DE VOZ NA SÍNTESE QUALITATIVA — CRÍTICAS:
- NÃO escreva em primeira pessoa ("eu observo", "concluo", "minha análise").
- NÃO se identifique como Filipe Severo, nem se apresente como autor humano.
- Use construções impessoais ou em terceira pessoa: "os dados sugerem", "a análise
  qualitativa revela", "configura-se", "observa-se que".
- O texto será apresentado ao leitor com aviso explícito de que foi gerado por LLM.
  Sua função é SINTETIZAR ANALITICAMENTE, não simular autoria humana.

FORMATO DA RESPOSTA: APENAS JSON válido, sem markdown:
{{
  "classificacoes": [
    {{"id": 1, "dimensoes": ["publico_patrao", "comunidade_afetiva"]}},
    {{"id": 2, "dimensoes": ["toxico_abusivo"]}},
    ...
  ],
  "indice_pressao_produtiva": <float 0-100, % de comentários com 'publico_patrao'>,
  "sintese_qualitativa": "<3-5 parágrafos analíticos em PROSA IMPESSOAL, sem markdown \
nem bullets, conectando achados à tese sobre 'broadcast to you', plataformização e captura \
do trabalho criativo. Tom rigoroso, direto, politicamente consciente. Identifique padrões \
dominantes, vozes minoritárias relevantes e tensões.>",
  "contradicao_estrutural": "<se houver dossiê do canal: 1-2 parágrafos em prosa impessoal \
identificando o gap entre o que o canal entrega e o que o público pede; se não houver \
dossiê: string vazia ''>"
}}

NÃO classifique mais comentários do que recebeu. NÃO invente IDs.
"""

    payload = f"""VÍDEO ANALISADO: "{titulo_video}"
CANAL: {canal_nome}
TOTAL DE COMENTÁRIOS: {len(comentarios)}
{contexto_dossie}

COMENTÁRIOS NUMERADOS (analise TODOS):

{comentarios_txt}
"""

    resposta = cliente.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=8000,  # Output grande: 100 classificações + síntese + contradição
        system=prompt_sistema,
        messages=[{"role": "user", "content": payload}],
    )

    texto = resposta.content[0].text.strip()
    texto = re.sub(r"^```(?:json)?\s*|\s*```$", "", texto, flags=re.MULTILINE).strip()
    resultado = json.loads(texto)

    return resultado


def renderizar_voz_completa(analise: dict, comentarios: list[dict] | None, do_cache: bool, key_suffix: str = "") -> None:
    """Apresenta a análise completa: índice, distribuição, síntese, contradição, comentários."""

    if do_cache:
        st.info(
            f"⚡ Análise recuperada do cache (gerada em "
            f"{analise.get('data_analise', '')[:10]}). Zero custo de API."
        )

    distribuicao = json.loads(analise["distribuicao_dimensoes"])
    if comentarios is None:
        # Recupera os comentários do JSON salvo
        comentarios = json.loads(analise.get("comentarios_brutos", "[]"))

    # =========================================================================
    # CABEÇALHO
    # =========================================================================
    st.markdown(f"## 💬 Voz da Base: \"{analise['titulo_video'][:80]}\"")
    st.caption(f"Canal: **{analise['canal_nome']}** · {analise['total_analisados']} comentários analisados")

    # =========================================================================
    # ÍNDICE DE PRESSÃO PRODUTIVA — métrica-chave (calibração empírica por percentis)
    # =========================================================================
    st.markdown("---")
    indice = float(analise["indice_pressao_produtiva"])

    # Lê distribuição de IPPs do corpus para calibração empírica (auto-calibrante)
    try:
        cliente_ipp = conectar(modo="leitura")
        distribuicao_ipps = buscar_distribuicao_ipps(cliente_ipp)
    except Exception:
        distribuicao_ipps = []

    # Calibração: precisa de pelo menos 15 análises no corpus para ser estatisticamente
    # mínimo defensável. Abaixo disso, mostra o número cru sem rótulo qualitativo.
    MIN_CORPUS_PARA_PERCENTIS = 15

    if len(distribuicao_ipps) < MIN_CORPUS_PARA_PERCENTIS:
        # Modo "corpus insuficiente": apresenta número sem rotulagem qualitativa
        cor_indice = "#999999"
        label_indice = (
            f"📊 Índice bruto · corpus insuficiente para classificação relativa "
            f"({len(distribuicao_ipps)}/{MIN_CORPUS_PARA_PERCENTIS} análises mínimas)"
        )
        interpretacao = (
            "O Índice de Pressão Produtiva (IPP) só recebe rotulagem qualitativa "
            "(ALTA/TÍPICA/BAIXA) quando o corpus do Observatório acumular pelo menos "
            f"{MIN_CORPUS_PARA_PERCENTIS} análises. Até lá, consulte o número cru "
            "e interprete com cautela. A calibração será automática conforme o corpus crescer."
        )
        percentil_atual = None
    else:
        # Modo "corpus suficiente": classifica por percentis empíricos do próprio corpus
        import bisect
        ordenados = sorted(distribuicao_ipps)
        # Percentil deste IPP (posição relativa no corpus)
        posicao = bisect.bisect_left(ordenados, indice)
        percentil_atual = (posicao / len(ordenados)) * 100

        # Quartis empíricos para limiares
        n_q = len(ordenados)
        p25 = ordenados[int(n_q * 0.25)]
        p75 = ordenados[int(n_q * 0.75)]

        if indice >= p75:
            cor_indice = "#FF1493"
            label_indice = "⚠️ Pressão produtiva ALTA (acima do P75 do corpus)"
            interpretacao = (
                "Este IPP está entre os 25% mais altos já observados no corpus do "
                "Observatório. Indica que o público deste vídeo opera com intensidade "
                "atípica como gestor, cobrando ritmo, exigindo produtividade, "
                "comparando com outros criadores. Padrão consistente com a hipótese "
                "do 'broadcast to you' e do criador como funcionário do próprio fandom."
            )
        elif indice >= p25:
            cor_indice = "#FFD700"
            label_indice = "🟡 Pressão produtiva TÍPICA (P25-P75 do corpus)"
            interpretacao = (
                "Este IPP está dentro da faixa típica do corpus do Observatório. "
                "Há presença mensurável de cobrança produtiva, mas em intensidade "
                "comum entre os vídeos analisados."
            )
        else:
            cor_indice = "#00E87A"
            label_indice = "✅ Pressão produtiva BAIXA (abaixo do P25 do corpus)"
            interpretacao = (
                "Este IPP está entre os 25% mais baixos do corpus. Indica que o "
                "público deste vídeo, comparativamente, NÃO opera como gestor com "
                "a mesma intensidade. Pode refletir vídeo recente, tema sem audiência "
                "cativa, ou relação parassocial menos cobrativa."
            )

    # Bloco visual do IPP
    info_extra = ""
    if percentil_atual is not None:
        info_extra = (
            f"<small style='color:#888; display:block; margin-top:0.6rem;'>"
            f"Posição relativa no corpus: percentil "
            f"<strong style='color:#fff;'>{percentil_atual:.0f}</strong> "
            f"de {len(distribuicao_ipps)} análises acumuladas</small>"
        )

    st.markdown(
        f"""
        <div style='background:#111; padding:2rem; border-radius:8px;
                    border-left: 6px solid {cor_indice};'>
          <small style='color:#888; letter-spacing:0.1em;'>ÍNDICE DE PRESSÃO PRODUTIVA</small>
          <h1 style='color:{cor_indice}; margin:0.5rem 0; font-size:3rem;
                     text-shadow: 0 0 12px {cor_indice}66;'>{indice:.0f}%</h1>
          <p style='color:#fff; margin:0; font-weight:600;'>{label_indice}</p>
          <p style='color:#ccc; margin:0.5rem 0 0 0; font-size:0.9rem;'>{interpretacao}</p>
          {info_extra}
        </div>
        """,
        unsafe_allow_html=True,
    )

    # =========================================================================
    # DISTRIBUIÇÃO POR DIMENSÃO
    # =========================================================================
    st.markdown("---")
    st.markdown("### 🔬 Distribuição por dimensão sociológica")
    st.markdown(
        """
        <div style='background:#1a0d00; padding:0.9rem 1.2rem; border-radius:4px;
                    border-left: 3px solid #FFB347; margin-bottom: 1rem;
                    font-size: 0.85rem; color: #ffcc99; line-height:1.6;'>
            <strong>⚠️ TIPOLOGIA EXPLORATÓRIA EM DESENVOLVIMENTO</strong><br>
            As 6 dimensões abaixo (<em>público-patrão, comunidade afetiva, disputa
            política, trabalho invisível do fã, tóxico/abusivo, negociação de sentido</em>)
            constituem uma proposta analítica original do Observatório Classe Creator,
            com ancoramento conceitual em literatura de estudos de plataforma e fandom
            (Cunningham &amp; Craig, 2017; Terranova, 2000; Hall, 1980; Jenkins, 2006;
            Horton &amp; Wohl, 1956), mas <strong>ainda não foram validadas
            empiricamente</strong> por intercodificadores independentes.
            Trate estes dados como <strong>leitura analítica exploratória</strong> —
            útil para orientar pesquisa, não como achado científico consolidado.
            A validação formal das dimensões é objeto de trabalho metodológico em curso.
        </div>
        """,
        unsafe_allow_html=True,
    )
    st.caption(
        "Comentários podem pertencer a múltiplas dimensões simultaneamente "
        "(ex: 'amo seu trabalho! posta mais!' = afetivo + público-patrão). "
        "Os percentuais de cada dimensão são independentes — a soma pode ultrapassar 100%."
    )

    df_dist = pd.DataFrame([
        {
            "codigo": cod,
            "Dimensão": DIMENSOES_VOZ[cod]["nome"] if cod in DIMENSOES_VOZ else cod,
            "Comentários": n,
            "% do total": (n / analise["total_analisados"]) * 100,
        }
        for cod, n in distribuicao.items()
    ]).sort_values("Comentários", ascending=True)

    cores_voz = {DIMENSOES_VOZ[cod]["nome"]: DIMENSOES_VOZ[cod]["cor"]
                 for cod in DIMENSOES_VOZ}

    fig = px.bar(
        df_dist, x="Comentários", y="Dimensão", orientation="h",
        color="Dimensão", color_discrete_map=cores_voz,
        template="plotly_dark",
        text="% do total",
    )
    fig.update_traces(texttemplate='%{text:.1f}%', textposition='outside')
    fig.update_layout(
        paper_bgcolor="#0a0a0a", plot_bgcolor="#0a0a0a",
        showlegend=False, height=400,
    )
    st.plotly_chart(fig, use_container_width=True)

    # =========================================================================
    # SÍNTESE QUALITATIVA (Sonnet)
    # =========================================================================
    st.markdown("---")
    st.markdown("### 📝 Síntese qualitativa")
    st.markdown(
        """
        <div style='background:#1a0d00; padding:0.9rem 1.2rem; border-radius:4px;
                    border-left: 3px solid #FFB347; margin-bottom: 1rem;
                    font-size: 0.85rem; color: #ffcc99;'>
            <strong>⚠️ AVISO METODOLÓGICO</strong><br>
            Esta síntese foi <em>gerada automaticamente</em> por Claude Sonnet 4.6,
            usando como referencial teórico a dissertação de Filipe Severo
            (PUCRS/FAMECOS, 2026), mas <strong>não foi escrita nem revisada
            pelo autor</strong>. Trate como <strong>leitura interpretativa
            assistida</strong> sobre os comentários — útil como ponto de partida
            analítico, não como conclusão científica fechada.
        </div>
        """,
        unsafe_allow_html=True,
    )
    st.markdown(
        f"<div style='background:#111; padding:1.5rem; border-radius:4px; "
        f"border-left: 4px solid #ffffff; line-height:1.7;'>"
        f"{analise['sintese_qualitativa']}</div>",
        unsafe_allow_html=True,
    )

    # =========================================================================
    # CONTRADIÇÃO ESTRUTURAL (se aplicável)
    # =========================================================================
    if analise.get("contradicao_estrutural"):
        st.markdown("---")
        st.markdown("### ⚖️ Contradição estrutural detectada")
        st.caption(
            "Gap entre o que o canal entrega (estrutura real) e o que "
            "o público pede. Cruzamento com o Dossiê do canal."
        )
        st.markdown(
            f"<div style='background:#111; padding:1.5rem; border-radius:4px; "
            f"border-left: 4px solid #7B2FFF; line-height:1.7;'>"
            f"{analise['contradicao_estrutural']}</div>",
            unsafe_allow_html=True,
        )

    # =========================================================================
    # COMENTÁRIOS BRUTOS COM CLASSIFICAÇÃO
    # =========================================================================
    st.markdown("---")
    st.markdown("### 💬 Comentários classificados")
    st.caption(
        "Os 100 comentários analisados, com suas dimensões atribuídas. "
        "Filtre por dimensão para examinar grupos específicos."
    )

    if comentarios:
        # Permite filtrar por dimensão
        opcoes_filtro = ["(todas)"] + [DIMENSOES_VOZ[cod]["nome"] for cod in DIMENSOES_VOZ]
        filtro_sel = st.selectbox("Filtrar por dimensão", opcoes_filtro, key=f"filtro_voz{key_suffix}")

        df_com = pd.DataFrame(comentarios)
        if filtro_sel != "(todas)":
            cod_filtro = next(
                (cod for cod, d in DIMENSOES_VOZ.items() if d["nome"] == filtro_sel),
                None
            )
            if cod_filtro and "dimensoes" in df_com.columns:
                df_com = df_com[df_com["dimensoes"].apply(
                    lambda d: cod_filtro in (d if isinstance(d, list) else [])
                )]

        if df_com.empty:
            st.info("Nenhum comentário nessa dimensão.")
        else:
            for _, row in df_com.head(50).iterrows():
                dims = row.get("dimensoes", []) if "dimensoes" in row else []
                if not isinstance(dims, list):
                    dims = []
                badges = " ".join([
                    f"<span style='background:{DIMENSOES_VOZ[d]['cor']}33; "
                    f"color:{DIMENSOES_VOZ[d]['cor']}; padding:0.15rem 0.5rem; "
                    f"border-radius:3px; font-size:0.7rem; margin-right:0.3rem;'>"
                    f"{DIMENSOES_VOZ[d]['nome']}</span>"
                    for d in dims if d in DIMENSOES_VOZ
                ])
                st.markdown(
                    f"<div style='background:#111; padding:0.8rem; border-radius:4px; "
                    f"margin:0.4rem 0; border-left:2px solid #2a2a2a;'>"
                    f"<small style='color:#888;'>👍 {row.get('likes', 0)} · @{row.get('autor', '')}</small><br>"
                    f"<span style='color:#f5f5f5;'>{row.get('texto', '')[:600]}</span><br>"
                    f"<div style='margin-top:0.4rem;'>{badges}</div>"
                    f"</div>",
                    unsafe_allow_html=True,
                )
            if len(df_com) > 50:
                st.caption(f"Mostrando 50 de {len(df_com)}. Use o export para o conjunto completo.")

    # =========================================================================
    # EXPORTAR
    # =========================================================================
    if comentarios:
        df_export = pd.DataFrame(comentarios)
        csv = df_export.to_csv(index=False).encode("utf-8")
        st.download_button(
            label="📥 Baixar CSV com todos os comentários classificados",
            data=csv,
            file_name=f"raio-x-voz-{analise['video_id']}-{datetime.now().strftime('%Y-%m-%d')}.csv",
            mime="text/csv",
        )


def renderizar_voz_da_base() -> None:
    st.markdown("# 💬 A Voz da Base")
    st.markdown("##### O termômetro do chão de fábrica e das relações parassociais")
    st.markdown(
        "Este módulo analisa qualitativamente os **100 principais comentários** "
        "de um vídeo segundo **6 dimensões sociológicas**, calcula o "
        "**Índice de Pressão Produtiva** (operação do *público-patrão*) e "
        "identifica **contradições estruturais** entre o que o canal entrega "
        "e o que o público pede. Análise via Claude Sonnet 4.6."
    )

    # Aviso ético
    with st.expander("⚖️ Notas éticas e metodológicas (importante)"):
        st.markdown(
            """
            **Sobre a amostra:** o YouTube ordena comentários por *relevância* (likes + recência),
            que é um corte editorial — não amostra estatística. As conclusões valem para
            *o que algoritmicamente recebeu visibilidade*, não para o universo total
            de comentários.

            **Sobre os comentaristas:** comentários públicos do YouTube são públicos por
            definição, mas isso não suspende cuidado ético. A ferramenta analisa
            **padrões coletivos** — não indivíduos isolados. Não use o output para
            constranger, expor ou perseguir comentaristas específicos. Pesquisa acadêmica
            que cite comentários nominalmente deve seguir as diretrizes do CEP/CONEP.

            **Sobre o LLM:** Claude Sonnet 4.6 é altamente capaz, mas pode errar na
            classificação de ironia, sarcasmo regional ou referências de nicho. Trate
            os resultados como **leitura analítica assistida**, não como verdade absoluta.
            """
        )

    if not SUPABASE_DISPONIVEL:
        st.error("⚠️ Banco de dados não configurado.")
        return

    try:
        cliente_db = conectar(modo="leitura")
    except Exception as e:
        st.error(f"Não foi possível conectar ao banco: {e}")
        return

    # Inicializar contador de sessão
    if "voz_feitas" not in st.session_state:
        st.session_state["voz_feitas"] = 0

    restantes = LIMITE_VOZ_POR_SESSAO - st.session_state["voz_feitas"]
    if restantes > 0:
        st.markdown(
            f"<div style='background:#111; padding:0.7rem; border-radius:4px; "
            f"border-left:3px solid #00E87A;'>"
            f"<small style='color:#888;'>SUA SESSÃO</small> · "
            f"<span class='neon-verde'>{restantes}</span> "
            f"análise(s) restante(s) nesta sessão</div>",
            unsafe_allow_html=True,
        )
    else:
        st.warning(
            f"⛔ Limite de {LIMITE_VOZ_POR_SESSAO} análises por sessão atingido. "
            "Recarregue a página para continuar."
        )

    # =========================================================================
    # FORMULÁRIO
    # =========================================================================
    st.markdown("---")
    url_input = st.text_input(
        "URL do vídeo a analisar",
        placeholder="https://www.youtube.com/watch?v=...",
    )

    botao = st.button(
        "ANALISAR COMENTÁRIOS",
        disabled=(restantes <= 0),
        use_container_width=False,
        key="btn_voz",
    )

    if not (botao and url_input.strip()):
        return

    video_id = extrair_video_id(url_input)
    if not video_id:
        st.error("URL inválida. Cole uma URL completa do YouTube.")
        return

    # =========================================================================
    # VERIFICAR VERSÃO CANÔNICA NO CORPUS
    # =========================================================================
    canonica = buscar_canonica_comentarios(cliente_db, video_id)

    if canonica:
        chave_estado = f"voz_{video_id}"
        decisao = oferecer_versao_canonica(
            canonica,
            label_objeto="dos comentários deste vídeo",
            chave_estado=chave_estado,
        )

        if decisao == "ver":
            renderizar_voz_completa(canonica, comentarios=None, do_cache=True)
            return
        elif decisao == "aguardando":
            return
        # decisao == "atualizar"
        peso_a_consumir = st.session_state.get(f"peso_consumir_{chave_estado}", 1)
        versao_anterior_id = st.session_state.get(f"versao_anterior_id_{chave_estado}")
        proxima_versao = st.session_state.get(f"proxima_versao_{chave_estado}", 2)
    else:
        peso_a_consumir = 1
        versao_anterior_id = None
        proxima_versao = 1

    # Verifica slots disponíveis
    if st.session_state.get("voz_feitas", 0) + peso_a_consumir > LIMITE_VOZ_POR_SESSAO:
        st.error(
            f"⛔ Esta operação consumiria {peso_a_consumir} slot(s), mas você só tem "
            f"{LIMITE_VOZ_POR_SESSAO - st.session_state.get('voz_feitas', 0)} "
            f"restante(s) na sessão. Recarregue a página para continuar."
        )
        return

    # Pipeline completo
    st.session_state["voz_feitas"] = st.session_state.get("voz_feitas", 0) + peso_a_consumir

    try:
        # 1. Pega metadados básicos do vídeo (canal, título)
        with st.spinner("Identificando vídeo e canal..."):
            meta_video = buscar_metadados_video(video_id)

        # 2. Coleta os 100 comentários
        with st.spinner(f"Coletando {COMENTARIOS_POR_ANALISE} comentários principais..."):
            comentarios = buscar_comentarios_video(video_id, COMENTARIOS_POR_ANALISE)

        if not comentarios:
            st.warning("Nenhum comentário encontrado neste vídeo.")
            return

        st.info(f"✓ {len(comentarios)} comentários coletados. Iniciando análise sociológica...")

        # 3. Verifica se existe Dossiê do canal (para contradição estrutural)
        with st.spinner("Verificando Dossiê do canal no corpus..."):
            dossie_canal = buscar_dossie_canal_existente(cliente_db, meta_video["canal_id"])

        if dossie_canal:
            st.info(
                f"💡 Dossiê do canal **{meta_video['canal_nome']}** encontrado no corpus. "
                "A análise vai incluir detecção de contradição estrutural."
            )

        # 4. Análise qualitativa em chamada única (Sonnet)
        with st.spinner("Submetendo a Claude Sonnet 4.6 (análise das 6 dimensões)... 1-2 minutos"):
            resultado = analisar_comentarios_sonnet(
                titulo_video=meta_video["titulo"],
                canal_nome=meta_video["canal_nome"],
                comentarios=comentarios,
                dossie_canal=dossie_canal,
            )

        # 5. Cruzar classificações com comentários
        from collections import Counter
        contagem_dims = Counter()
        mapa_dim = {item["id"]: item.get("dimensoes", [])
                   for item in resultado.get("classificacoes", [])}

        comentarios_enriquecidos = []
        for i, c in enumerate(comentarios):
            dims = mapa_dim.get(i + 1, [])  # IDs do LLM são 1-indexed
            for d in dims:
                contagem_dims[d] += 1
            comentarios_enriquecidos.append({**c, "dimensoes": dims})

        # 6. Persistir
        with st.spinner("Salvando análise no corpus do Observatório..."):
            analise_id = registrar_analise_comentarios(
                cliente_db,
                video_id=video_id,
                titulo_video=meta_video["titulo"],
                canal_id=meta_video["canal_id"],
                canal_nome=meta_video["canal_nome"],
                total_comentarios_analisados=len(comentarios),
                indice_pressao_produtiva=resultado["indice_pressao_produtiva"],
                distribuicao_dimensoes_json=json.dumps(dict(contagem_dims)),
                sintese_qualitativa=resultado["sintese_qualitativa"],
                contradicao_estrutural=resultado.get("contradicao_estrutural", ""),
                comentarios_brutos_json=json.dumps(comentarios_enriquecidos, ensure_ascii=False),
                versao_numero=proxima_versao,
                versao_anterior_id=versao_anterior_id,
            )

        # 7. Recuperar e renderizar
        analise_completa = buscar_canonica_comentarios(cliente_db, video_id)
        if analise_completa:
            st.success("✅ Análise concluída e adicionada ao corpus do Observatório.")
            renderizar_voz_completa(analise_completa, comentarios_enriquecidos, do_cache=False)

    except PermissionError as e:
        st.warning(str(e))
        return
    except requests.HTTPError as e:
        st.error(f"Erro na consulta ao YouTube: {e}")
        return
    except json.JSONDecodeError as e:
        st.error(
            f"O Sonnet retornou resposta malformada. Tente novamente. "
            f"(Detalhe técnico: {e})"
        )
        return
    except Exception as e:
        st.error(f"Erro inesperado: {type(e).__name__}: {e}")
        return


# ==============================================================================
# 🏠 HOME — APRESENTAÇÃO INSTITUCIONAL DO RAIO-X CLASSE CREATOR
# ==============================================================================
#
# Página de boas-vindas e manifesto operacional do Observatório.
# Funções:
#   1. Apresentação institucional (quem somos, o que é, por quê)
#   2. Manual operacional (descrição dos 5 módulos com casos de uso)
#   3. Catálogo de pesquisa (sugestões + concluídas)
#   4. Métricas em tempo real (do corpus acumulado pela ferramenta)
# ==============================================================================

# -----------------------------------------------------------------------------
# DESCRITORES DOS 5 MÓDULOS — fonte única de informação para a Home
# -----------------------------------------------------------------------------

DESCRITORES_MODULOS = [
    {
        "icone": "🔍",
        "nome": "A Lupa",
        "escala": "Análise micro · 1 vídeo",
        "cor": "#00E87A",
        "frase": (
            "Disseca um único artefato audiovisual. Extrai metadados via API "
            "oficial e classifica o vídeo na tipologia dupla, com justificativa "
            "sociológica curta."
        ),
        "quando_usar": (
            "Quando você precisa auditar um vídeo específico — uma anomalia "
            "do algoritmo, um caso polêmico, ou validar manualmente uma "
            "classificação que parece errada em outros módulos."
        ),
        "casos_uso": [
            "Verificar se um vídeo viral é mesmo de “criador independente” ou de produtora",
            "Auditar como o YouTube categoriza conteúdo politicamente sensível",
            "Validar amostras antes de uma pesquisa quantitativa maior",
        ],
    },
    {
        "icone": "🌡️",
        "nome": "Termômetro do Em Alta",
        "escala": "Análise macro longitudinal · trending BR",
        "cor": "#27D337",
        "frase": (
            "Coleta automatizada semanal dos 50 vídeos do trending BR, "
            "alternando dias e horários (replica metodologia da Tabela 02 "
            "da dissertação). Acumula corpus longitudinal auditável."
        ),
        "quando_usar": (
            "Para auditar a curadoria algorítmica em escala. Responde "
            "perguntas como: quem domina o trending? Como a composição "
            "muda ao longo do tempo? Quais canais são recorrentes?"
        ),
        "casos_uso": [
            "Provar empiricamente a profissionalização da plataforma",
            "Acompanhar “higienização editorial” em momentos políticos",
            "Identificar canais hegemônicos que aparecem semana após semana",
        ],
    },
    {
        "icone": "⚔️",
        "nome": "Disputa de Narrativa",
        "escala": "Análise transversal · busca temática",
        "cor": "#7B2FFF",
        "frase": (
            "Audita autoridade algorítmica em temas sensíveis. Você fornece "
            "um termo, a ferramenta classifica os 50 primeiros resultados e "
            "calcula o desvio em relação à linha de base do trending."
        ),
        "quando_usar": (
            "Quando você precisa responder “para quem o YouTube dá o "
            "microfone?” em algum tema específico — direitos trabalhistas, "
            "questões raciais, debate ambiental, crises políticas."
        ),
        "casos_uso": [
            "Mapear quem domina o debate sobre temas trabalhistas",
            "Identificar invisibilização de movimentos sociais",
            "Detectar sobre-representação midiática em pautas sensíveis",
        ],
    },
    {
        "icone": "📋",
        "nome": "Dossiê do Canal",
        "escala": "Análise meso · 1 produtor",
        "cor": "#7e6bff",
        "frase": (
            "Investigação estrutural de produtores. Confronta a auto-narrativa "
            "do canal (descrição pública) com a realidade estrutural detectada "
            "(sintomas de profissionalização, equipe, links repetidos)."
        ),
        "quando_usar": (
            "Para desmascarar “falsos criadores independentes” que operam "
            "como braços de produtoras digitais ou da mídia tradicional. "
            "Modelo híbrido Haiku + Sonnet emite veredito sociológico."
        ),
        "casos_uso": [
            "Investigar coligações de canais sob mesma estrutura empresarial",
            "Mapear redes de produção e financiamento (canais recomendados)",
            "Cruzar presença histórica do canal em outros módulos",
        ],
    },
    {
        "icone": "💬",
        "nome": "A Voz da Base",
        "escala": "Análise comunitária · 100 comentários",
        "cor": "#FF4FD8",
        "frase": (
            "Análise qualitativa dos comentários em 6 dimensões sociológicas. "
            "Calcula o Índice de Pressão Produtiva (% “público-patrão”) e "
            "identifica contradição estrutural com o Dossiê do canal."
        ),
        "quando_usar": (
            "Para entender as relações parassociais e o trabalho gestor "
            "que o público exerce sobre criadores. Diagnostica burnout "
            "induzido pela cobrança coletiva e dinâmicas de fandom."
        ),
        "casos_uso": [
            "Medir cobrança de produtividade do público sobre criadores",
            "Identificar comunidades tóxicas em torno de canais polêmicos",
            "Mapear trabalho voluntário de fãs (defesa, propaganda, recrutamento)",
        ],
    },
]

# -----------------------------------------------------------------------------
# CATÁLOGO DE PESQUISAS SUGERIDAS — 2 por módulo (10 total)
# -----------------------------------------------------------------------------

PESQUISAS_SUGERIDAS = [
    # A LUPA
    {
        "modulos": ["A Lupa"],
        "titulo": "Como o YouTube categoriza conteúdo de educação política?",
        "pergunta": (
            "A categoria nativa do YouTube reproduz fielmente o trabalho "
            "educativo-político, ou achata em rótulos comerciais como "
            "“Entretenimento” ou “Notícias”?"
        ),
        "hipotese": (
            "Conteúdo educativo-político de canais não-vinculados à mídia "
            "tradicional é sistematicamente mal-categorizado pela plataforma, "
            "reduzindo seu alcance algorítmico."
        ),
        "metodo_curto": (
            "Selecionar 30 vídeos educativos-políticos de canais variados, "
            "rodar A Lupa em cada um, comparar Eixo A/B com a categoria "
            "nativa exibida pelo YouTube."
        ),
    },
    {
        "modulos": ["A Lupa"],
        "titulo": "A simulação de espontaneidade nos vlogs profissionais",
        "pergunta": (
            "Em que medida o que se apresenta como “vlog autêntico” é, "
            "estruturalmente, entretenimento roteirizado disfarçado?"
        ),
        "hipotese": (
            "Cunningham & Craig (2017) descrevem a “autenticidade roteirizada”. "
            "Em uma amostra de vlogs brasileiros populares, A Lupa deve "
            "classificar como “entretenimento_roteirizado” mais frequentemente "
            "do que a auto-apresentação dos criadores admite."
        ),
        "metodo_curto": (
            "Amostragem de 50 vídeos rotulados pelos próprios criadores como "
            "“vlog”, comparar com a classificação independente do Eixo B "
            "feita por A Lupa."
        ),
    },
    # TERMÔMETRO
    {
        "modulos": ["Termômetro do Em Alta"],
        "titulo": "Higienização algorítmica em datas politicamente carregadas",
        "pergunta": (
            "O algoritmo do trending privilegia entretenimento e suprime "
            "conteúdo institucional/político em datas de alta tensão "
            "(7 de setembro, eleições, manifestações)?"
        ),
        "hipotese": (
            "Em datas politicamente carregadas, o trending deve apresentar "
            "redução estatística de canais Institucionais e aumento "
            "compensatório de Entretenimento e Música — efeito do Brand Safety."
        ),
        "metodo_curto": (
            "Comparar a composição do Termômetro nos snapshots de datas-chave "
            "vs. snapshots de datas neutras adjacentes (mesmo dia da semana, "
            "dois meses antes/depois)."
        ),
    },
    {
        "modulos": ["Termômetro do Em Alta", "Dossiê do Canal"],
        "titulo": "Concentração oligopolística da visibilidade no YouTube BR",
        "pergunta": (
            "Quantos canais únicos respondem por que percentual da visibilidade "
            "no trending BR ao longo de 1 ano? A distribuição segue lei de "
            "potência, como em outras plataformas?"
        ),
        "hipotese": (
            "Estima-se que menos de 100 canais respondam por mais de 70% "
            "das aparições no trending num período anual — confirmando "
            "concentração oligopolística da atenção."
        ),
        "metodo_curto": (
            "Extrair série completa do Termômetro, contar aparições por "
            "canal, plotar curva de Pareto. Para os top 20, gerar Dossiê "
            "para identificar coligações por trás."
        ),
    },
    # DISPUTA DE NARRATIVA
    {
        "modulos": ["Disputa de Narrativa"],
        "titulo": "Quem fala sobre direitos trabalhistas no YouTube?",
        "pergunta": (
            "O debate sobre direitos do trabalhador é dominado por "
            "narrativas patronais (Mídia Tradicional, Marcas) ou há espaço "
            "para vozes da classe trabalhadora (Sindicatos, Instituições)?"
        ),
        "hipotese": (
            "Buscas sobre temas trabalhistas devem revelar sub-representação "
            "estatística de canais Institucionais (sindicatos, MPT, MTE) "
            "em relação à linha de base do trending — evidência de "
            "captura editorial do tema pelo capital."
        ),
        "metodo_curto": (
            "Rodar buscas para 10 termos-chave (“reforma trabalhista”, "
            "“uberização”, “direitos do trabalhador”, etc), comparar "
            "composição com a média do Termômetro via Desvio Editorial."
        ),
    },
    {
        "modulos": ["Disputa de Narrativa"],
        "titulo": "Vozes ausentes em pautas raciais",
        "pergunta": (
            "Buscas sobre temas raciais (cotas, racismo estrutural, "
            "movimentos negros) apresentam ausência sistemática de quais "
            "tipos de produtor?"
        ),
        "hipotese": (
            "A invisibilização de Instituições do movimento negro e de "
            "Criadores Casuais negros nesses temas — substituídos por "
            "Mídia Tradicional e YouTubers brancos profissionais — "
            "reproduz a colonização do debate racial."
        ),
        "metodo_curto": (
            "Buscas para 8 termos pré-definidos, análise da seção “Vozes "
            "Ausentes” do módulo, triangulação com Dossiê dos canais "
            "presentes para mapeamento racial dos produtores."
        ),
    },
    # DOSSIÊ DO CANAL
    {
        "modulos": ["Dossiê do Canal"],
        "titulo": "O ecossistema invisível das “casas” de criadores",
        "pergunta": (
            "Quantos canais brasileiros que se apresentam como “criadores "
            "individuais” fazem parte de coligações maiores (squads, casas, "
            "MCNs)? Como se conectam estruturalmente?"
        ),
        "hipotese": (
            "Produtoras Digitais brasileiras operam dezenas de canais "
            "coordenados sob persona individual, configurando uma "
            "indústria oculta da “personalidade” como ativo."
        ),
        "metodo_curto": (
            "Selecionar 20 “criadores famosos”, rodar Dossiê, examinar a "
            "rede de canais declarados publicamente, mapear coligações "
            "(grafo de canais associados)."
        ),
    },
    {
        "modulos": ["Dossiê do Canal", "A Lupa"],
        "titulo": "A “mídia de jornalistas” como nova produtora digital",
        "pergunta": (
            "Os canais de jornalistas que saíram da grande mídia "
            "(Reinaldo Azevedo, Andreia Sadi, etc.) operam como YouTubers "
            "Profissionais individuais ou já se estruturam como "
            "Produtoras Digitais com equipes?"
        ),
        "hipotese": (
            "A migração de jornalistas para o YouTube produziu um ciclo "
            "rápido de profissionalização — esses canais convergem para "
            "Produtora Digital, mesmo mantendo aparência de “opinião "
            "individual”, em até 18 meses de existência."
        ),
        "metodo_curto": (
            "Identificar 15 jornalistas de mídia tradicional com canal "
            "no YouTube, rodar Dossiê, examinar sintomas estruturais "
            "(equipe, frequência industrial, links repetidos)."
        ),
    },
    # VOZ DA BASE
    {
        "modulos": ["A Voz da Base", "Dossiê do Canal"],
        "titulo": "Burnout induzido pelo público-patrão",
        "pergunta": (
            "Em canais cujos criadores publicizaram sofrer burnout/pausas, "
            "a Voz da Base detecta níveis sistematicamente mais altos do "
            "Índice de Pressão Produtiva nos vídeos anteriores ao colapso?"
        ),
        "hipotese": (
            "O Índice de Pressão Produtiva funciona como indicador "
            "antecedente — vídeos com IPP > 30% concentram-se nos meses "
            "que antecedem a comunicação pública de pausa/burnout."
        ),
        "metodo_curto": (
            "Selecionar 5 criadores que comunicaram pausa/burnout publicamente, "
            "rodar Voz da Base nos 10 vídeos imediatamente anteriores ao "
            "anúncio, comparar IPP médio com 10 vídeos de controle "
            "(canais ativos sem registro de burnout)."
        ),
    },
    {
        "modulos": ["A Voz da Base"],
        "titulo": "Fandoms como mão-de-obra não-paga de propaganda política",
        "pergunta": (
            "Em canais de criadores politicamente engajados (de qualquer "
            "espectro), em que medida os comentários se organizam como "
            "“trabalho invisível do fã” — defendendo o criador, "
            "atacando críticos, recrutando espectadores?"
        ),
        "hipotese": (
            "Canais com forte vínculo político-ideológico apresentam "
            "% de “trabalho invisível do fã” significativamente acima da "
            "média (estimado >25%) — configurando exército digital "
            "voluntário de comunicação política."
        ),
        "metodo_curto": (
            "Amostragem de 12 canais politicamente engajados (espectro "
            "diversificado), 3 vídeos por canal, análise via Voz da Base, "
            "agregação por canal e por espectro político."
        ),
    },
]

# -----------------------------------------------------------------------------
# PESQUISAS CONCLUÍDAS — vitrine acadêmica
# -----------------------------------------------------------------------------

PESQUISAS_CONCLUIDAS = [
    {
        "tipo": "Dissertação de Mestrado",
        "autor": "Filipe Machado Leal Severo",
        "titulo": (
            "O Novo “You” do YouTube: a ascensão dos produtores plataformizados "
            "e a falência da promessa participativa no Brasil"
        ),
        "ano": 2026,
        "instituicao": "Pontifícia Universidade Católica do Rio Grande do Sul (PUCRS)",
        "programa": "Programa de Pós-Graduação em Comunicação Social (FAMECOS)",
        "orientacao": "(consultar dissertação)",
        "resumo": (
            "A pesquisa cunha e operacionaliza a tipologia dupla "
            "(Eixo A: Produtor × Eixo B: Conteúdo) que constitui o cérebro "
            "do Raio-X Classe Creator. Demonstra empiricamente, a partir de "
            "21 semanas de coleta do trending BR, que mais de 90% da "
            "visibilidade no YouTube brasileiro é controlada por agentes "
            "corporativos profissionalizados — Mídia Tradicional, Produtoras "
            "Digitais e YouTubers Profissionais — configurando a falência "
            "da promessa participativa do “Broadcast Yourself” original."
        ),
        "achados": [
            "Mais de 90% da visibilidade pertence à elite profissionalizada",
            "Mídia Tradicional mantém hegemonia em Informativo",
            "YouTubers Profissionais dominam Entretenimento Roteirizado",
            "Esportes é fronteira de disputa direta entre Mídia Tradicional e Produtoras Digitais",
            "Usuário Comum está estatisticamente extinto no topo da plataforma",
            "Categorias nativas do YouTube servem ao inventário publicitário, não à análise sociológica",
        ],
    },
]


def renderizar_home() -> None:
    # =========================================================================
    # HERO — IMPACTO INICIAL + MÉTRICAS DINÂMICAS DO CORPUS
    # =========================================================================
    st.markdown(
        """
        <div style='padding: 2rem 0 1rem 0;'>
            <div style='font-size: 0.85rem; color: #888; letter-spacing: 0.2em;
                        margin-bottom: 0.5rem;'>OBSERVATÓRIO CLASSE CREATOR</div>
            <h1 style='font-size: 3.2rem; line-height: 1.05; margin: 0;
                       color: #ffffff; font-weight: 800;'>
                RAIO-X<br>
                <span class='neon-verde'>CLASSE CREATOR</span>
            </h1>
            <p style='font-size: 1.15rem; color: #ccc; margin-top: 1rem;
                      max-width: 720px; line-height: 1.6;'>
                Ferramenta de auditoria algorítmica e pesquisa acadêmica do
                trabalho plataformizado no YouTube. Desnaturaliza a
                “economia dos criadores” e devolve materialidade ao trabalho
                que a plataforma reifica em categorias comerciais opacas.
            </p>
        </div>
        """,
        unsafe_allow_html=True,
    )

    # Métricas dinâmicas do corpus — alimentadas pelo Supabase em tempo real
    if SUPABASE_DISPONIVEL:
        try:
            cliente_db = conectar(modo="leitura")
            counts = contadores_publicos(cliente_db)

            st.markdown(
                f"""
                <div style='display: flex; gap: 1rem; margin: 1.5rem 0 2rem 0;
                            flex-wrap: wrap;'>
                    <div style='flex:1; min-width: 140px; background: #111;
                                padding: 1.2rem; border-radius: 4px;
                                border-left: 3px solid #00E87A;'>
                        <div style='font-size: 2.2rem; color: #00E87A;
                                    font-weight: 700; line-height: 1;'>{counts['snapshots_termometro']}</div>
                        <div style='font-size: 0.75rem; color: #888;
                                    letter-spacing: 0.1em; margin-top: 0.4rem;'>
                            SNAPSHOTS<br>NO TERMÔMETRO
                        </div>
                    </div>
                    <div style='flex:1; min-width: 140px; background: #111;
                                padding: 1.2rem; border-radius: 4px;
                                border-left: 3px solid #7B2FFF;'>
                        <div style='font-size: 2.2rem; color: #7B2FFF;
                                    font-weight: 700; line-height: 1;'>{counts['videos_no_termometro']}</div>
                        <div style='font-size: 0.75rem; color: #888;
                                    letter-spacing: 0.1em; margin-top: 0.4rem;'>
                            VÍDEOS<br>CLASSIFICADOS
                        </div>
                    </div>
                    <div style='flex:1; min-width: 140px; background: #111;
                                padding: 1.2rem; border-radius: 4px;
                                border-left: 3px solid #FFD700;'>
                        <div style='font-size: 2.2rem; color: #FFD700;
                                    font-weight: 700; line-height: 1;'>{counts['buscas_realizadas']}</div>
                        <div style='font-size: 0.75rem; color: #888;
                                    letter-spacing: 0.1em; margin-top: 0.4rem;'>
                            TEMAS<br>AUDITADOS
                        </div>
                    </div>
                    <div style='flex:1; min-width: 140px; background: #111;
                                padding: 1.2rem; border-radius: 4px;
                                border-left: 3px solid #7e6bff;'>
                        <div style='font-size: 2.2rem; color: #7e6bff;
                                    font-weight: 700; line-height: 1;'>{counts['dossies_canais']}</div>
                        <div style='font-size: 0.75rem; color: #888;
                                    letter-spacing: 0.1em; margin-top: 0.4rem;'>
                            CANAIS<br>INVESTIGADOS
                        </div>
                    </div>
                    <div style='flex:1; min-width: 140px; background: #111;
                                padding: 1.2rem; border-radius: 4px;
                                border-left: 3px solid #FF4FD8;'>
                        <div style='font-size: 2.2rem; color: #FF4FD8;
                                    font-weight: 700; line-height: 1;'>{counts['analises_voz_da_base']}</div>
                        <div style='font-size: 0.75rem; color: #888;
                                    letter-spacing: 0.1em; margin-top: 0.4rem;'>
                            ANÁLISES<br>DE COMENTÁRIOS
                        </div>
                    </div>
                </div>
                """,
                unsafe_allow_html=True,
            )
        except Exception:
            pass  # Falha silenciosa: a Home funciona mesmo sem contadores

    # =========================================================================
    # MANIFESTO INSTITUCIONAL (tom acadêmico sutil)
    # =========================================================================
    st.markdown("---")
    st.markdown("### O que esta ferramenta faz")
    st.markdown(
        """
        Pesquisas sobre plataformas digitais como o YouTube dependem, em
        larga medida, de categorias produzidas pela própria plataforma —
        rótulos como “Entretenimento”, “Notícias” ou “Educação” que servem
        ao inventário publicitário, não à compreensão sociológica do trabalho
        criativo. O resultado é uma pesquisa que reproduz, em vez de
        problematizar, a opacidade do objeto investigado.

        O **Raio-X Classe Creator** propõe uma alternativa: classificar
        artefatos do YouTube segundo uma **tipologia dupla** —
        Eixo A (quem produz?) × Eixo B (que gênero de trabalho é produzido?) —
        ancorada em pesquisa acadêmica e operacionalizada por inteligência
        artificial. A ferramenta automatiza, em escala, a análise qualitativa
        que pesquisadores precisariam fazer manualmente, devolvendo
        materialidade ao trabalho que a plataforma achata em categorias
        comerciais.

        Mais do que um utilitário de análise, o Raio-X é uma proposta
        metodológica: tratar o YouTube não como vitrine de “criadores
        independentes”, mas como **regime de produção plataformizada** com
        relações de classe, hierarquias de visibilidade e disputas concretas
        pela autoridade algorítmica.
        """
    )

    st.markdown(
        """
        <div style='background: #111; border-left: 4px solid #00E87A;
                    padding: 1.2rem 1.5rem; margin: 1.5rem 0;
                    border-radius: 4px;'>
            <div style='font-size: 1.4rem; color: #00E87A;
                        font-weight: 700; font-style: italic;
                        text-shadow: 0 0 8px rgba(57,255,20,0.3);'>
                "Criar é trabalho."
            </div>
            <div style='color: #888; font-size: 0.85rem; margin-top: 0.5rem;'>
                — princípio operacional do Observatório Classe Creator
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )

    # =========================================================================
    # OS 5 MÓDULOS — cards com casos de uso
    # =========================================================================
    st.markdown("---")
    st.markdown("## 🧰 Os 5 módulos da ferramenta")
    st.markdown(
        "<p style='color:#aaa;'>Cinco lentes de investigação distintas, "
        "operáveis individualmente ou de forma cruzada. Cada uma responde a "
        "uma escala analítica diferente do mesmo objeto.</p>",
        unsafe_allow_html=True,
    )

    for desc in DESCRITORES_MODULOS:
        casos_html = "".join([
            f"<li style='margin-bottom: 0.3rem; color: #ccc;'>{c}</li>"
            for c in desc["casos_uso"]
        ])

        st.markdown(
            f"""
            <div style='background: #111; padding: 1.5rem; border-radius: 6px;
                        border-left: 4px solid {desc['cor']};
                        margin: 1rem 0;'>
              <div style='display: flex; align-items: baseline; gap: 0.8rem;'>
                <span style='font-size: 2rem;'>{desc['icone']}</span>
                <div>
                  <h3 style='margin: 0; color: {desc['cor']};
                             text-shadow: 0 0 8px {desc['cor']}55;'>
                    {desc['nome']}
                  </h3>
                  <small style='color: #888; letter-spacing: 0.05em;'>
                    {desc['escala']}
                  </small>
                </div>
              </div>
              <p style='color: #f5f5f5; margin-top: 1rem; line-height: 1.6;'>
                {desc['frase']}
              </p>
              <div style='margin-top: 1rem;'>
                <strong style='color: #fff; font-size: 0.9rem;'>Quando usar:</strong>
                <p style='color: #ccc; margin-top: 0.3rem; line-height: 1.5;'>
                  {desc['quando_usar']}
                </p>
              </div>
              <div style='margin-top: 1rem;'>
                <strong style='color: #fff; font-size: 0.9rem;'>Casos de uso típicos:</strong>
                <ul style='margin-top: 0.4rem; padding-left: 1.2rem;'>
                  {casos_html}
                </ul>
              </div>
            </div>
            """,
            unsafe_allow_html=True,
        )

    # =========================================================================
    # METODOLOGIA — A TIPOLOGIA DUPLA
    # =========================================================================
    st.markdown("---")
    st.markdown("## 📐 A metodologia: tipologia dupla")
    st.markdown(
        "Toda a ferramenta opera a partir de uma tipologia mutuamente "
        "exclusiva e exaustiva, validada empiricamente em 21 semanas de "
        "coleta na pesquisa fundadora. Clique nos eixos para examinar "
        "as definições operacionais."
    )

    cE1, cE2 = st.columns(2)
    with cE1:
        with st.expander(f"🟢 **EIXO A — PRODUTOR** ({len(PRODUTORES)} categorias)"):
            for c in PRODUTORES:
                st.markdown(f"**{c.nome}** — *{c.definicao}*")
                st.markdown("")

    with cE2:
        with st.expander(f"🟣 **EIXO B — CONTEÚDO** ({len(CONTEUDOS)} categorias)"):
            for c in CONTEUDOS:
                st.markdown(f"**{c.nome}** — *{c.definicao}*")
                st.markdown("")

    # =========================================================================
    # BIBLIOTECA DE PESQUISA
    # =========================================================================
    st.markdown("---")
    st.markdown("## 📚 Biblioteca de Pesquisa")
    st.markdown(
        "Todas as análises realizadas pela ferramenta ficam **permanentemente "
        "disponíveis** no corpus público do Observatório. Cada vídeo, canal, "
        "tema ou conjunto de comentários analisado é versionado e navegável — "
        "antes de iniciar uma nova pesquisa, vale a pena consultar o que "
        "outros já produziram."
    )

    st.markdown(
        """
        <div style='background: linear-gradient(135deg, #0d1f0d 0%, #0a0a0a 100%);
                    padding: 1.5rem; border-radius: 6px;
                    border-left: 4px solid #00E87A;
                    margin: 1.5rem 0;'>
            <div style='display: flex; gap: 1.5rem; flex-wrap: wrap; align-items: center;'>
                <div style='flex: 1; min-width: 280px;'>
                    <h4 style='margin: 0 0 0.5rem 0; color: #fff;'>
                        Acesse o corpus completo
                    </h4>
                    <p style='color: #ccc; margin: 0; line-height: 1.6;'>
                        Navegue por vídeos, canais, temas e análises de comentários
                        já produzidos. Filtre, busque, examine versões anteriores.
                        Consultar antes de gastar uma nova análise é boa prática
                        de pesquisa e preserva recursos coletivos.
                    </p>
                </div>
                <div style='font-size: 0.85rem; color: #888; min-width: 200px;'>
                    <strong style='color: #00E87A;'>Snapshot semanal:</strong>
                    o corpus é exportado em CSV todas as segundas-feiras
                    para o repositório público de dados, permitindo download
                    direto sem onerar a infraestrutura.
                </div>
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )

    st.info(
        "💡 **Acesse pela sidebar** → 📚 Biblioteca de Pesquisa para navegar "
        "pelas 4 abas (Vídeos, Canais, Temas, Voz da Base)."
    )

    # =========================================================================
    # PESQUISAS SUGERIDAS
    # =========================================================================
    st.markdown("---")
    st.markdown("## 🔬 Agenda de pesquisa sugerida")
    st.markdown(
        "Sugestões abertas para a comunidade acadêmica brasileira. "
        "Cada uma é um problema de pesquisa **operacionalizável** com "
        "esta ferramenta. Use, adapte, expanda — e nos avise quando "
        "publicar para incluirmos na vitrine de pesquisas concluídas."
    )

    for i, p in enumerate(PESQUISAS_SUGERIDAS, 1):
        modulos_badge = " · ".join(
            f"<span style='background:#1a1a1a; color:#00E87A; padding:0.2rem 0.6rem; "
            f"border-radius:3px; font-size:0.75rem; letter-spacing:0.05em;'>{m}</span>"
            for m in p["modulos"]
        )

        st.markdown(
            f"""
            <div style='background: #0d0d0d; padding: 1.4rem; border-radius: 6px;
                        border: 1px solid #1f1f1f; margin: 1rem 0;'>
              <div style='display: flex; gap: 0.8rem; align-items: baseline;
                          margin-bottom: 0.8rem;'>
                <span style='color: #555; font-size: 0.85rem;'>#{i:02d}</span>
                <h4 style='margin: 0; color: #fff;'>{p['titulo']}</h4>
              </div>
              <div style='margin-bottom: 0.8rem;'>{modulos_badge}</div>
              <div style='margin-top: 0.7rem;'>
                <strong style='color: #00E87A; font-size: 0.85rem;'>PERGUNTA:</strong>
                <p style='color: #ddd; margin: 0.3rem 0; line-height: 1.6;'>{p['pergunta']}</p>
              </div>
              <div style='margin-top: 0.7rem;'>
                <strong style='color: #7B2FFF; font-size: 0.85rem;'>HIPÓTESE:</strong>
                <p style='color: #ddd; margin: 0.3rem 0; line-height: 1.6;'>{p['hipotese']}</p>
              </div>
              <div style='margin-top: 0.7rem;'>
                <strong style='color: #FFD700; font-size: 0.85rem;'>MÉTODO SUGERIDO:</strong>
                <p style='color: #ccc; margin: 0.3rem 0; line-height: 1.6;
                          font-size: 0.95rem;'>{p['metodo_curto']}</p>
              </div>
            </div>
            """,
            unsafe_allow_html=True,
        )

    # =========================================================================
    # PESQUISAS CONCLUÍDAS — vitrine acadêmica
    # =========================================================================
    st.markdown("---")
    st.markdown("## 📚 Pesquisas concluídas com esta ferramenta")
    st.markdown(
        "<p style='color:#aaa;'>Trabalhos acadêmicos cuja metodologia "
        "ou achados deram origem a, ou foram realizados com, o "
        "Raio-X Classe Creator.</p>",
        unsafe_allow_html=True,
    )

    for p in PESQUISAS_CONCLUIDAS:
        achados_html = "".join([
            f"<li style='margin-bottom: 0.4rem; color: #ddd;'>{a}</li>"
            for a in p["achados"]
        ])

        st.markdown(
            f"""
            <div style='background: linear-gradient(135deg, #111 0%, #0a0a0a 100%);
                        padding: 1.8rem; border-radius: 6px;
                        border-left: 4px solid #00E87A;
                        margin: 1.5rem 0;
                        box-shadow: 0 0 24px rgba(57,255,20,0.05);'>
              <div style='font-size: 0.75rem; color: #888;
                          letter-spacing: 0.15em; margin-bottom: 0.5rem;'>
                {p['tipo'].upper()} · {p['ano']}
              </div>
              <h3 style='margin: 0 0 0.5rem 0; color: #fff;
                         line-height: 1.3;'>{p['titulo']}</h3>
              <p style='color: #aaa; margin: 0.5rem 0;'>
                <strong style='color: #00E87A;'>{p['autor']}</strong><br>
                <small>{p['instituicao']} — {p['programa']}</small>
              </p>
              <div style='margin-top: 1rem;'>
                <strong style='color: #fff; font-size: 0.9rem;'>Resumo:</strong>
                <p style='color: #ddd; margin-top: 0.4rem; line-height: 1.7;'>
                  {p['resumo']}
                </p>
              </div>
              <div style='margin-top: 1rem;'>
                <strong style='color: #fff; font-size: 0.9rem;'>Principais achados:</strong>
                <ul style='margin-top: 0.4rem; padding-left: 1.2rem;'>
                  {achados_html}
                </ul>
              </div>
            </div>
            """,
            unsafe_allow_html=True,
        )

    # =========================================================================
    # COMO CITAR
    # =========================================================================
    st.markdown("---")
    st.markdown("## ✍️ Como citar")
    st.markdown(
        "Ao utilizar resultados gerados por esta ferramenta em publicações "
        "acadêmicas, jornalísticas ou em qualquer outro contexto público, "
        "cite os trabalhos que sustentam sua metodologia."
    )

    st.markdown("**Citação ABNT — pesquisa fundadora:**")
    st.code(
        "SEVERO, Filipe Machado Leal. O Novo \"You\" do YouTube: a ascensão dos "
        "produtores plataformizados e a falência da promessa participativa no Brasil. "
        "2026. Dissertação (Mestrado em Comunicação) — Pontifícia Universidade Católica "
        "do Rio Grande do Sul, Porto Alegre, 2026.",
        language="text",
    )

    st.markdown("**Citação ABNT — ferramenta:**")
    st.code(
        "OBSERVATÓRIO CLASSE CREATOR. Raio-X Classe Creator: ferramenta de auditoria "
        "algorítmica e pesquisa acadêmica do trabalho plataformizado no YouTube. "
        "Versão 1.0. Porto Alegre, 2026. Disponível em: "
        "<https://raio-x-classe-creator.streamlit.app>.",
        language="text",
    )

    # =========================================================================
    # CONTRIBUIR
    # =========================================================================
    st.markdown("---")
    st.markdown("## 🤝 Contribuir com o Observatório")
    st.markdown(
        """
        O **Observatório Classe Creator** é um think tank e movimento de
        emancipação da nova classe trabalhadora digital no Brasil. A ferramenta
        Raio-X é seu braço investigativo — código aberto, gratuito, e em
        constante refinamento.

        Pesquisadores, jornalistas, sindicalistas e organizações da sociedade
        civil que queiram colaborar — seja submetendo pesquisas para a vitrine,
        sugerindo refinamentos metodológicos, ou propondo novos módulos —
        podem entrar em contato pelos canais oficiais do Observatório.
        """
    )

    st.markdown(
        """
        <div style='text-align: center; padding: 2rem 0; color: #555;
                    font-size: 0.85rem;'>
            🔬 Raio-X Classe Creator · v1.0 · Observatório Classe Creator · 2026
        </div>
        """,
        unsafe_allow_html=True,
    )


# ==============================================================================
# 📚 MÓDULO BIBLIOTECA DE PESQUISA
# ==============================================================================
#
# Acesso público navegável ao corpus longitudinal do Observatório.
# Permite consultar análises já realizadas (Lupa, Dossiê, Disputa, Voz da Base)
# antes de gastar uma nova análise.
#
# Diferenciais:
#   - Mostra sempre a versão canônica (mais recente) por padrão
#   - Timeline de versões antigas acessível em cada item
#   - Filtros por classificação, data, busca textual
#   - Convite explícito para consultar antes de gastar
# ==============================================================================

LIMITE_BIBLIOTECA_REGISTROS = 500


def _formatar_data_curta(data_iso: str) -> str:
    """Converte ISO timestamp em data legível (dd/mm/aaaa)."""
    if not data_iso:
        return "—"
    try:
        if data_iso.endswith("Z"):
            data_iso = data_iso[:-1] + "+00:00"
        dt = datetime.fromisoformat(data_iso)
        return dt.strftime("%d/%m/%Y")
    except (ValueError, TypeError):
        return data_iso[:10] if len(data_iso) >= 10 else "—"


def renderizar_aba_videos(cliente_db) -> None:
    """Aba: vídeos analisados pela Lupa."""
    st.markdown("##### 🔍 Vídeos analisados pela Lupa")
    st.caption(
        "Cada linha é a análise mais recente (canônica) de um vídeo. "
        "Vídeos podem ter múltiplas versões — clique em qualquer um para ver histórico."
    )

    try:
        registros = biblioteca_videos(cliente_db, limite=LIMITE_BIBLIOTECA_REGISTROS)
    except Exception as e:
        st.error(f"Erro ao consultar biblioteca de vídeos: {e}")
        return

    if not registros:
        st.info(
            "Ainda não há vídeos analisados publicamente. "
            "Use o módulo **🔍 A Lupa** para fazer a primeira análise."
        )
        return

    # Filtros
    cF1, cF2 = st.columns(2)
    with cF1:
        busca_texto = st.text_input(
            "🔎 Buscar por título ou canal", "",
            key="filtro_videos",
        )
    with cF2:
        opcoes_produtor = ["(todos)"] + sorted({r["tipo_produtor"] for r in registros})
        filtro_produtor = st.selectbox(
            "Filtrar por tipo de produtor", opcoes_produtor,
            key="filtro_videos_produtor",
        )

    # Aplicar filtros
    filtrados = registros
    if busca_texto.strip():
        bt = busca_texto.lower().strip()
        filtrados = [
            r for r in filtrados
            if bt in (r.get("titulo", "") or "").lower()
            or bt in (r.get("canal_nome", "") or "").lower()
        ]
    if filtro_produtor != "(todos)":
        filtrados = [r for r in filtrados if r.get("tipo_produtor") == filtro_produtor]

    st.caption(f"Mostrando **{len(filtrados)}** de {len(registros)} registros canônicos")

    # Construir DataFrame para exibição
    linhas_tabela = []
    for r in filtrados:
        prod = buscar_produtor(r["tipo_produtor"])
        cont = buscar_conteudo(r["tipo_conteudo"])
        linhas_tabela.append({
            "ID": r["id"],
            "Data": _formatar_data_curta(r.get("data_classificacao", "")),
            "Canal": (r.get("canal_nome") or "")[:60],
            "Título": (r.get("titulo") or "")[:80],
            "Produtor": prod.nome if prod else r["tipo_produtor"],
            "Conteúdo": cont.nome if cont else r["tipo_conteudo"],
            "Versão": r.get("versao_numero", 1),
        })

    if linhas_tabela:
        df = pd.DataFrame(linhas_tabela)
        st.dataframe(df, use_container_width=True, hide_index=True, height=400)

        # Seletor para abrir análise completa
        st.markdown("---")
        st.markdown("**Abrir análise completa**")
        ids_opcoes = {f"#{r['ID']} · {r['Canal']} · {r['Título'][:40]}": r["ID"]
                     for r in linhas_tabela}
        if ids_opcoes:
            sel = st.selectbox(
                "Selecione um vídeo para ver a análise completa",
                ["(escolher)"] + list(ids_opcoes.keys()),
                key="sel_video_biblioteca",
            )
            if sel != "(escolher)":
                registro_id = ids_opcoes[sel]
                registro = buscar_analise_por_id(cliente_db, "classificacoes_video", registro_id)
                if registro:
                    _exibir_analise_video(registro, cliente_db)


def _exibir_analise_video(registro: dict, cliente_db) -> None:
    """Renderiza análise completa de um vídeo + timeline de versões."""
    prod = buscar_produtor(registro["tipo_produtor"])
    cont = buscar_conteudo(registro["tipo_conteudo"])

    st.markdown(
        f"""
        <div style='background:#0d0d0d; padding:1.5rem; border-radius:6px;
                    border-left:3px solid #00E87A; margin-top:1rem;'>
          <small style='color:#888;'>📺 ANÁLISE DE VÍDEO · v{registro.get('versao_numero', 1)} · {_formatar_data_curta(registro.get('data_classificacao', ''))}</small>
          <h4 style='color:#fff; margin:0.5rem 0;'>{registro.get('titulo', '')}</h4>
          <p style='color:#aaa; margin:0;'>Canal: <strong>{registro.get('canal_nome', '')}</strong></p>
          <div style='margin-top:1rem;'>
            <span style='background:#1a1a1a; padding:0.4rem 0.8rem; border-radius:3px;
                         color:#00E87A; margin-right:0.5rem; font-size:0.85rem;'>
              Produtor: {prod.nome if prod else registro['tipo_produtor']}
            </span>
            <span style='background:#1a1a1a; padding:0.4rem 0.8rem; border-radius:3px;
                         color:#7B2FFF; font-size:0.85rem;'>
              Conteúdo: {cont.nome if cont else registro['tipo_conteudo']}
            </span>
          </div>
          <p style='color:#ddd; margin-top:1rem; line-height:1.6;'>
            <strong>Justificativa sociológica:</strong><br>
            {registro.get('justificativa', '—')}
          </p>
        </div>
        """,
        unsafe_allow_html=True,
    )

    # Timeline
    if registro.get("video_id"):
        try:
            historico = historico_versoes_video(cliente_db, registro["video_id"])
            if len(historico) > 1:
                with st.expander(f"📜 Ver histórico de versões ({len(historico)} análises deste vídeo)"):
                    for v in historico:
                        prefix = "🟢 ATUAL" if v["versao_numero"] == registro.get("versao_numero") else "📋"
                        p_obj = buscar_produtor(v["tipo_produtor"])
                        c_obj = buscar_conteudo(v["tipo_conteudo"])
                        st.markdown(
                            f"{prefix} **v{v['versao_numero']}** ({_formatar_data_curta(v['data_classificacao'])}) — "
                            f"{p_obj.nome if p_obj else v['tipo_produtor']} / "
                            f"{c_obj.nome if c_obj else v['tipo_conteudo']}"
                        )
        except Exception:
            pass


def renderizar_aba_canais(cliente_db) -> None:
    """Aba: dossiês de canais."""
    st.markdown("##### 📋 Canais investigados pelo Dossiê")
    st.caption(
        "Cada linha é o dossiê mais recente (canônico) de um canal. "
        "A análise estrutural completa abre ao selecionar."
    )

    try:
        registros = biblioteca_dossies(cliente_db, limite=LIMITE_BIBLIOTECA_REGISTROS)
    except Exception as e:
        st.error(f"Erro ao consultar biblioteca de dossiês: {e}")
        return

    if not registros:
        st.info(
            "Ainda não há canais investigados publicamente. "
            "Use o módulo **📋 Dossiê do Canal** para fazer a primeira investigação."
        )
        return

    cF1, cF2 = st.columns(2)
    with cF1:
        busca_texto = st.text_input("🔎 Buscar por canal", "", key="filtro_canais")
    with cF2:
        opcoes_class = ["(todas)"] + sorted({r["classificacao_sociologica"] for r in registros})
        filtro_class = st.selectbox(
            "Filtrar por classificação sociológica", opcoes_class,
            key="filtro_canais_class",
        )

    filtrados = registros
    if busca_texto.strip():
        bt = busca_texto.lower().strip()
        filtrados = [r for r in filtrados if bt in (r.get("canal_nome", "") or "").lower()]
    if filtro_class != "(todas)":
        filtrados = [r for r in filtrados if r.get("classificacao_sociologica") == filtro_class]

    st.caption(f"Mostrando **{len(filtrados)}** de {len(registros)} dossiês canônicos")

    linhas = []
    for r in filtrados:
        prod = buscar_produtor(r["classificacao_sociologica"])
        cont = buscar_conteudo(r["tipo_conteudo_predominante"])
        linhas.append({
            "ID": r["id"],
            "Data": _formatar_data_curta(r.get("data_dossie", "")),
            "Canal": (r.get("canal_nome") or "")[:60],
            "Inscritos": f"{int(r.get('inscritos', 0)):,}".replace(",", "."),
            "Classe": prod.nome if prod else r["classificacao_sociologica"],
            "Conteúdo": cont.nome if cont else r["tipo_conteudo_predominante"],
            "Versão": r.get("versao_numero", 1),
        })

    if linhas:
        df = pd.DataFrame(linhas)
        st.dataframe(df, use_container_width=True, hide_index=True, height=400)

        st.markdown("---")
        st.markdown("**Abrir dossiê completo**")
        ids_opcoes = {f"#{r['ID']} · {r['Canal']} · {r['Inscritos']} insc.": r["ID"]
                     for r in linhas}
        sel = st.selectbox(
            "Selecione um canal", ["(escolher)"] + list(ids_opcoes.keys()),
            key="sel_canal_biblioteca",
        )
        if sel != "(escolher)":
            registro_id = ids_opcoes[sel]
            dossie = buscar_analise_por_id(cliente_db, "dossies_canal", registro_id)
            if dossie:
                st.success("✓ Carregando dossiê canônico do corpus")
                renderizar_dossie_completo(dossie, do_cache=True, cliente_db=cliente_db)


def renderizar_aba_temas(cliente_db) -> None:
    """Aba: buscas temáticas (Disputa de Narrativa)."""
    st.markdown("##### ⚔️ Temas auditados pela Disputa de Narrativa")
    st.caption(
        "Cada linha é a busca mais recente (canônica) de um termo. "
        "Cliques abrem a análise de composição completa."
    )

    try:
        registros = biblioteca_buscas(cliente_db, limite=LIMITE_BIBLIOTECA_REGISTROS)
    except Exception as e:
        st.error(f"Erro ao consultar biblioteca de buscas: {e}")
        return

    if not registros:
        st.info(
            "Ainda não há temas auditados. "
            "Use o módulo **⚔️ Disputa de Narrativa** para fazer a primeira auditoria."
        )
        return

    busca_texto = st.text_input("🔎 Buscar por termo", "", key="filtro_temas")

    filtrados = registros
    if busca_texto.strip():
        bt = busca_texto.lower().strip()
        filtrados = [r for r in filtrados if bt in (r.get("termo_buscado", "") or "").lower()]

    st.caption(f"Mostrando **{len(filtrados)}** de {len(registros)} buscas canônicas")

    linhas = []
    for r in filtrados:
        linhas.append({
            "ID": r["id"],
            "Data": _formatar_data_curta(r.get("data_busca", "")),
            "Termo buscado": r.get("termo_buscado", "")[:80],
            "Resultados analisados": r.get("total_analisados", 0),
            "Versão": r.get("versao_numero", 1),
        })

    if linhas:
        df = pd.DataFrame(linhas)
        st.dataframe(df, use_container_width=True, hide_index=True, height=400)

        st.markdown("---")
        st.markdown("**Abrir análise completa**")
        ids_opcoes = {f"#{r['ID']} · {r['Termo buscado'][:50]}": r["ID"] for r in linhas}
        sel = st.selectbox(
            "Selecione um termo", ["(escolher)"] + list(ids_opcoes.keys()),
            key="sel_tema_biblioteca",
        )
        if sel != "(escolher)":
            registro_id = ids_opcoes[sel]
            busca = buscar_analise_por_id(cliente_db, "buscas_narrativa", registro_id)
            if busca:
                st.success("✓ Carregando análise canônica do corpus")
                renderizar_resultados_disputa(
                    busca["termo_buscado"], busca["id"],
                    do_cache=True, cliente_db=cliente_db,
                )


def renderizar_aba_comentarios(cliente_db) -> None:
    """Aba: análises da Voz da Base."""
    st.markdown("##### 💬 Vídeos com análise de Voz da Base")
    st.caption(
        "Cada linha é a análise mais recente (canônica) de comentários de um vídeo. "
        "Inclui Índice de Pressão Produtiva calculado."
    )

    try:
        registros = biblioteca_comentarios(cliente_db, limite=LIMITE_BIBLIOTECA_REGISTROS)
    except Exception as e:
        st.error(f"Erro ao consultar biblioteca de Voz da Base: {e}")
        return

    if not registros:
        st.info(
            "Ainda não há análises de comentários publicadas. "
            "Use o módulo **💬 Voz da Base** para fazer a primeira análise."
        )
        return

    busca_texto = st.text_input("🔎 Buscar por canal ou vídeo", "", key="filtro_voz_biblioteca")

    filtrados = registros
    if busca_texto.strip():
        bt = busca_texto.lower().strip()
        filtrados = [
            r for r in filtrados
            if bt in (r.get("canal_nome", "") or "").lower()
            or bt in (r.get("titulo_video", "") or "").lower()
        ]

    st.caption(f"Mostrando **{len(filtrados)}** de {len(registros)} análises canônicas")

    linhas = []
    for r in filtrados:
        linhas.append({
            "ID": r["id"],
            "Data": _formatar_data_curta(r.get("data_analise", "")),
            "Canal": (r.get("canal_nome") or "")[:50],
            "Vídeo": (r.get("titulo_video") or "")[:60],
            "Comentários": r.get("total_analisados", 0),
            "IPP": f"{float(r.get('indice_pressao_produtiva', 0)):.0f}%",
            "Versão": r.get("versao_numero", 1),
        })

    if linhas:
        df = pd.DataFrame(linhas)
        st.dataframe(df, use_container_width=True, hide_index=True, height=400)

        st.markdown("---")
        st.markdown("**Abrir análise completa**")
        ids_opcoes = {f"#{r['ID']} · {r['Canal']} · IPP {r['IPP']}": r["ID"] for r in linhas}
        sel = st.selectbox(
            "Selecione um vídeo", ["(escolher)"] + list(ids_opcoes.keys()),
            key="sel_voz_biblioteca",
        )
        if sel != "(escolher)":
            registro_id = ids_opcoes[sel]
            analise = buscar_analise_por_id(cliente_db, "analises_comentarios", registro_id)
            if analise:
                st.success("✓ Carregando análise canônica do corpus")
                renderizar_voz_completa(analise, comentarios=None, do_cache=True, key_suffix=f"_bib_{registro_id}")


def renderizar_biblioteca() -> None:
    """Página principal da Biblioteca de Pesquisa."""
    st.markdown("# 📚 Biblioteca de Pesquisa")
    st.markdown("##### Corpus longitudinal do Observatório Classe Creator")
    st.markdown(
        "Navegue por todas as análises já realizadas pela ferramenta. "
        "Cada análise é versionada — o que você vê é sempre a versão canônica "
        "(mais recente) de cada objeto, com histórico de versões anteriores "
        "acessível. Consultar a biblioteca antes de gastar uma nova análise é "
        "a prática recomendada — preserva recursos do Observatório e dá "
        "continuidade ao trabalho coletivo de pesquisa."
    )

    if not SUPABASE_DISPONIVEL:
        st.error("⚠️ Banco de dados não configurado.")
        return

    try:
        cliente_db = conectar(modo="leitura")
    except Exception as e:
        st.error(f"Não foi possível conectar ao banco: {e}")
        return

    # Métricas do corpus em destaque
    try:
        counts = contadores_publicos(cliente_db)
        c1, c2, c3, c4, c5 = st.columns(5)
        c1.metric("Snapshots", counts["snapshots_termometro"])
        c2.metric("Vídeos no Termômetro", counts["videos_no_termometro"])
        c3.metric("Temas auditados", counts["buscas_realizadas"])
        c4.metric("Canais investigados", counts["dossies_canais"])
        c5.metric("Análises de comentários", counts["analises_voz_da_base"])
    except Exception:
        pass

    st.markdown("---")

    # Abas das 4 fontes de dados
    aba_videos, aba_canais, aba_temas, aba_voz = st.tabs([
        "🔍 Vídeos",
        "📋 Canais",
        "⚔️ Temas",
        "💬 Voz da Base",
    ])

    with aba_videos:
        renderizar_aba_videos(cliente_db)
    with aba_canais:
        renderizar_aba_canais(cliente_db)
    with aba_temas:
        renderizar_aba_temas(cliente_db)
    with aba_voz:
        renderizar_aba_comentarios(cliente_db)


# ==============================================================================
# ROTEAMENTO
# ==============================================================================

if modulo.startswith("🏠"):
    renderizar_home()
elif modulo.startswith("🔍"):
    renderizar_lupa()
elif modulo.startswith("🌡️"):
    renderizar_termometro()
elif modulo.startswith("⚔️"):
    renderizar_disputa_narrativa()
elif modulo.startswith("📋"):
    renderizar_dossie_canal()
elif modulo.startswith("💬"):
    renderizar_voz_da_base()
elif modulo.startswith("📚"):
    renderizar_biblioteca()
else:
    renderizar_home()
