"""
==============================================================================
RAIO-X DA CLASSE CREATOR — APP PRINCIPAL
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

import streamlit.components.v1 as components_v1

# Tentamos importar o db.py (Supabase). Se falhar, o Termômetro mostra aviso.
try:
    from db import (
        conectar,
        listar_snapshots,
        buscar_snapshot_mais_recente,
        videos_do_snapshot,
        buscar_canal_validado,
        salvar_canal_validado,
        propagar_classificacao_canal,
        buscar_exemplos_ancora,
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
        contar_uso_diario,
    )
    SUPABASE_DISPONIVEL = True
except ImportError:
    SUPABASE_DISPONIVEL = False


# ==============================================================================
# CONFIGURAÇÃO GLOBAL
# ==============================================================================

st.set_page_config(
    page_title="Raio-X da Classe Creator",
    page_icon="🔬",
    layout="wide",
    initial_sidebar_state="expanded",
)

# Força sidebar sempre expandida
st.session_state["sidebar_state"] = "expanded"

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

    /* Esconde menu hamburger, footer e botão de colapso da sidebar */
    #MainMenu { visibility: hidden; }
    footer { visibility: hidden; }

    /* Esconde o botão de colapso/toggle APENAS no desktop (>1024px)
       Em tablets e mobile, mantém visível para poder esconder a sidebar */
    @media (min-width: 1025px) {
        [data-testid="stSidebarCollapsedControl"],
        [data-testid="stSidebarCollapseButton"],
        button[data-testid="stBaseButton-headerNoPadding"] {
            display: none !important;
        }
    }

    /* Em tablet/mobile, garante que o botão de collapse fique visível e clicável */
    @media (max-width: 1024px) {
        [data-testid="stSidebarCollapseButton"],
        button[data-testid="stBaseButton-headerNoPadding"] {
            display: flex !important;
            visibility: visible !important;
            opacity: 1 !important;
            z-index: 999 !important;
        }
    }

    /* Remove scroll da sidebar — conteúdo cabe na tela */
    [data-testid="stSidebar"] > div:first-child {
        overflow: hidden !important;
        height: 100vh !important;
    }

    /* Remove padding extra do topo da sidebar */
    [data-testid="stSidebar"] {
        padding-top: 0 !important;
    }

    /* Aumenta fonte dos textos descritivos da sidebar */
    [data-testid="stSidebar"] p,
    [data-testid="stSidebar"] .stMarkdown p,
    [data-testid="stSidebarContent"] p,
    section[data-testid="stSidebar"] p {
        font-size: 1.35rem !important;
        line-height: 1.7 !important;
    }
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

# reCAPTCHA v2 — proteção anti-bot nos módulos de análise.
# Se as chaves não estiverem configuradas, o gate é desabilitado (dev mode).
RECAPTCHA_SITE_KEY = st.secrets.get("RECAPTCHA_SITE_KEY", "")
RECAPTCHA_SECRET_KEY = st.secrets.get("RECAPTCHA_SECRET_KEY", "")


def verificar_token_recaptcha(token: str) -> bool:
    """Valida o token reCAPTCHA com o servidor do Google."""
    if not RECAPTCHA_SECRET_KEY:
        return True
    try:
        resp = requests.post(
            "https://www.google.com/recaptcha/api/siteverify",
            data={"secret": RECAPTCHA_SECRET_KEY, "response": token},
            timeout=5,
        )
        return resp.json().get("success", False)
    except Exception:
        return False


def _processar_token_recaptcha() -> None:
    """Verifica se há token reCAPTCHA nos query params (retorno do widget)."""
    params = st.query_params
    token = params.get("captcha_token")
    if token:
        if verificar_token_recaptcha(token):
            st.session_state["recaptcha_ok"] = True
        st.query_params.clear()
        st.rerun()


# Processar token de retorno no início da execução (antes de renderizar qualquer coisa)
if RECAPTCHA_SITE_KEY:
    _processar_token_recaptcha()


def exigir_recaptcha() -> bool:
    """
    Gate reCAPTCHA reutilizável por todos os módulos de análise.

    Retorna True se o usuário já foi verificado nesta sessão.
    Se não, renderiza o widget e retorna False (o módulo deve parar).

    Se as chaves não estiverem configuradas, retorna True sempre (dev mode).
    """
    if not RECAPTCHA_SITE_KEY:
        return True  # Dev mode — sem reCAPTCHA configurado

    if st.session_state.get("recaptcha_ok"):
        return True

    st.markdown("---")
    st.markdown(
        "🔒 **Verificação necessária** — confirme que você é humano "
        "para utilizar as ferramentas de análise."
    )

    # Container no documento principal (domínio correto para o Google)
    st.markdown(
        '<div id="recaptcha-container" '
        'style="display:flex;justify-content:center;padding:16px 0;">'
        "</div>",
        unsafe_allow_html=True,
    )

    # Injeta um <script> tag diretamente no parent document.
    # Esse script executa 100% no contexto do Streamlit (window, document,
    # location — tudo referente ao domínio correto). Nenhuma chamada cross-frame.
    recaptcha_js = f"""
    <script>
    (function() {{
        var doc = window.parent.document;
        var container = doc.getElementById('recaptcha-container');
        if (!container || container.dataset.rendered === 'true') return;
        container.dataset.rendered = 'true';

        // Cria <script> no parent — executa no escopo global do parent
        var tag = doc.createElement('script');
        tag.textContent = `
            window.__recaptchaSiteKey = '{RECAPTCHA_SITE_KEY}';

            window.onRecaptchaSuccess = function(token) {{
                var url = new URL(window.location.href);
                url.searchParams.set('captcha_token', token);
                window.location.replace(url.toString());
            }};

            (function tryRender() {{
                var c = document.getElementById('recaptcha-container');
                if (!c) return;
                if (window.grecaptcha && window.grecaptcha.render) {{
                    try {{
                        window.grecaptcha.render(c, {{
                            sitekey: window.__recaptchaSiteKey,
                            theme: 'dark',
                            callback: 'onRecaptchaSuccess'
                        }});
                    }} catch(e) {{}}
                }} else {{
                    setTimeout(tryRender, 300);
                }}
            }})();
        `;
        doc.body.appendChild(tag);

        // Carrega API do Google no parent (se ainda não carregou)
        if (!doc.querySelector('script[src*="recaptcha"]')) {{
            var api = doc.createElement('script');
            api.src = 'https://www.google.com/recaptcha/api.js?render=explicit';
            doc.head.appendChild(api);
        }}
    }})();
    </script>
    """
    components_v1.html(recaptcha_js, height=0)

    return False


def notificar_carrinho() -> None:
    """
    Notifica o usuário que o resultado foi salvo no carrinho.
    Na primeira vez da sessão, mostra um info explicativo.
    Nas demais, mostra apenas um toast discreto.
    """
    if not st.session_state.get("carrinho_explicado"):
        st.session_state["carrinho_explicado"] = True
        st.info(
            "📥 **Resultado salvo na sessão!** Cada análise que você fizer "
            "é acumulada automaticamente. Ao final, clique em "
            "**\"Exportar sessão\"** na barra lateral para baixar tudo "
            "em uma planilha única — com uma aba por módulo.",
            icon="🧺",
        )
    else:
        st.toast("Resultado salvo na sessão.", icon="🧺")


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


def _detectar_short(item: dict, duracao_segundos: int) -> bool | None:
    """
    Detecta se é Short usando duração + aspecto do player.
    True=Short, False=Longo, None=inconclusivo (sem dimensões).
    Regra validada: duração ≤ 180s + embedHeight > embedWidth.
    """
    if duracao_segundos > 180:
        return False
    player = item.get("player") or {}
    embed_w = player.get("embedWidth")
    embed_h = player.get("embedHeight")
    if embed_w is None or embed_h is None:
        return None
    try:
        return int(embed_h) > int(embed_w)
    except (ValueError, TypeError):
        return None


def buscar_metadados_video(video_id: str) -> dict:
    resp = requests.get(
        "https://www.googleapis.com/youtube/v3/videos",
        params={
            "id": video_id,
            "part": "snippet,statistics,contentDetails,player",
            "maxWidth": 1920,  # necessário para embedWidth/embedHeight virem com aspecto real
            "key": YOUTUBE_API_KEY,
        },
        timeout=10,
    )
    resp.raise_for_status()
    data = resp.json()
    if not data.get("items"):
        raise ValueError("Vídeo não encontrado. Verifique se a URL está correta e se o vídeo é público.")
    item = data["items"][0]
    duracao_iso = item["contentDetails"]["duration"]
    duracao_seg = duracao_iso_para_segundos(duracao_iso)
    return {
        "video_id": video_id,
        "titulo": item["snippet"]["title"],
        "descricao": item["snippet"].get("description", ""),
        "tags": item["snippet"].get("tags", []),
        "canal_id": item["snippet"]["channelId"],
        "canal_nome": item["snippet"]["channelTitle"],
        "data_publicacao": item["snippet"]["publishedAt"],
        "duracao_iso": duracao_iso,
        "duracao_segundos": duracao_seg,
        "visualizacoes": int(item["statistics"].get("viewCount", 0)),
        "likes": int(item["statistics"].get("likeCount", 0)),
        "comentarios": int(item["statistics"].get("commentCount", 0)),
        "is_short": _detectar_short(item, duracao_seg),
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
    # Consulta banco âncora antes de chamar a IA
    canal_id = meta_video.get("canal_id", "")
    exemplos_dinamicos = ""
    try:
        cliente_db = conectar(modo="leitura")
        if canal_id:
            validado = buscar_canal_validado(cliente_db, canal_id)
            if validado:
                return {
                    "tipo_produtor": validado["tipo_produtor"],
                    "tipo_conteudo": validado.get("tipo_conteudo") or meta_video.get("tipo_conteudo", "outros"),
                    "justificativa": f"[ÂNCORA VALIDADA] {validado.get('justificativa', '')}",
                }
        # Busca exemplos do banco para few-shot dinâmico
        exemplos = buscar_exemplos_ancora(cliente_db, limite=15)
        if exemplos:
            linhas = []
            for ex in exemplos:
                just = ex.get("justificativa", "")[:80]
                linhas.append(
                    f"- {ex['canal_nome']} → {ex['tipo_produtor']}"
                    f"{f' [{just}]' if just else ''}"
                )
            exemplos_dinamicos = (
                "\n\nEXEMPLOS VALIDADOS PELO PESQUISADOR (aprendizado acumulado):\n"
                + "\n".join(linhas)
            )
    except Exception:
        pass  # falha silenciosa — segue para a IA sem exemplos

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

TESTE DECISIVO — Produtora vs. YouTuber:
"Se essa pessoa saísse do canal, o canal continuaria existindo como marca?"
- SIM → produtora_digital (ex: Ei Nerd, Flow, Desimpedidos, CazéTV, Canal GOAT, Manual do Mundo)
- NÃO → youtuber_profissional (ex: Whindersson, Felipe Neto, Casimiro, Gaules, Virgínia)

EXEMPLOS VALIDADOS (use como calibração):
- Ei Nerd → produtora_digital [marca com apresentadores rotativos, múltiplos canais, empresa]
- Gaules → produtora_digital [ecossistema com múltiplos canais, empresa estruturada]
- Flow Games → produtora_digital [sub-canal do ecossistema Flow]
- Canal GOAT → produtora_digital [produtora nativa de esportes]
- MrBeast → produtora_digital [empresa global, 100+ funcionários]
- Enaldinho → produtora_digital [opera múltiplos canais como empresa]
- Mendrake → youtuber_profissional [persona individual]
- Tonigon → youtuber_profissional [criador individual]
- rezendeevil → youtuber_profissional [persona individual de games]
- Flamengo TV → marca [canal oficial do clube]
- CONMEBOL → instituicao [entidade reguladora]
- VALORANT Esports BR → marca [Riot Games divulgando o jogo]
- Kings League → produtora_digital [campeonato existe para gerar conteúdo]

FORMATO: APENAS JSON válido, sem markdown:
{{
  "tipo_produtor": "<código exato do Eixo A>",
  "tipo_conteudo": "<código exato do Eixo B>",
  "justificativa": "<2 a 4 frases analíticas>"
}}

CÓDIGOS Eixo A: {", ".join(codigos_produtor())}
CÓDIGOS Eixo B: {", ".join(codigos_conteudo())}
{exemplos_dinamicos}"""

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
    st.markdown(
        """
        <style>
        /* Impedir overflow na sidebar */
        section[data-testid="stSidebar"] > div {
            overflow-x: hidden !important;
            word-wrap: break-word !important;
        }
        /* Radio buttons compactos */
        section[data-testid="stSidebar"] .stRadio label {
            font-size: 0.85rem !important;
            padding: 0.15rem 0 !important;
            min-height: unset !important;
        }
        section[data-testid="stSidebar"] .stRadio > div {
            gap: 0.1rem !important;
        }
        </style>
        """,
        unsafe_allow_html=True,
    )

    st.markdown("# RAIO-X")
    st.caption("OBSERVATÓRIO CLASSE CREATOR")

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
            "ℹ️ Sobre",
        ],
        label_visibility="collapsed",
    )

    if "carrinho" not in st.session_state:
        st.session_state["carrinho"] = {
            "lupa": [],
            "disputa": [],
            "dossie": [],
            "voz_da_base": [],
        }


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
                st.rerun()
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

LIMITE_LUPA_POR_SESSAO = 15

# Limites diários globais (todos os usuários somados).
# Margem generosa para não travar pesquisa legítima — é proteção de orçamento.
LIMITES_DIARIOS = {
    "lupa": 80,
    "disputa": 30,
    "dossie": 40,
    "voz": 25,
}


def verificar_limite_diario(modulo: str) -> bool:
    """
    Verifica se o limite diário global de um módulo foi atingido.
    Retorna True se pode prosseguir, False se atingiu o limite.
    Se Supabase não estiver disponível, libera (dev mode).
    """
    if not SUPABASE_DISPONIVEL:
        return True
    limite = LIMITES_DIARIOS.get(modulo, 999)
    try:
        cliente = conectar(modo="leitura")
        uso = contar_uso_diario(cliente, modulo)
        if uso >= limite:
            st.warning(
                f"⚠️ Limite diário da ferramenta atingido para este módulo "
                f"({uso}/{limite} análises hoje). "
                f"Tente novamente amanhã ou entre em contato com o Observatório "
                f"para acesso ampliado."
            )
            return False
        return True
    except Exception:
        return True  # em caso de falha, não bloqueia


def renderizar_lupa() -> None:
    st.markdown("## 🔍 A Lupa")
    st.markdown("##### Análise de um vídeo, na profundidade que o feed esconde")
    st.markdown(
        "Cole abaixo o link de um vídeo do YouTube. A ferramenta extrairá os "
        "metadados via API oficial e classificará o artefato segundo a "
        "**tipologia dupla** (Produtor × Conteúdo) desenvolvida na pesquisa "
        "*O Novo 'You' do YouTube* (SEVERO, 2026)."
    )

    if not exigir_recaptcha():
        return

    init_db_local()

    # Inicializar contador de sessão
    if "lupas_feitas" not in st.session_state:
        st.session_state["lupas_feitas"] = 0

    restantes = LIMITE_LUPA_POR_SESSAO - st.session_state["lupas_feitas"]
    if restantes > 0:
        st.markdown(
            f"<div style='background:#111; padding:0.7rem; border-radius:4px; "
            f"border-left:3px solid #00E87A;'>"
            f"<small style='color:#888;'>SUA SESSÃO</small> · "
            f"<span style='color:#00E87A;'>{restantes}</span> "
            f"análise(s) restante(s)</div>",
            unsafe_allow_html=True,
        )
    else:
        st.warning(
            f"⛔ Limite de {LIMITE_LUPA_POR_SESSAO} análises por sessão atingido. "
            "Recarregue a página para continuar."
        )

    url_input = st.text_input(
        "URL do vídeo",
        placeholder="https://www.youtube.com/watch?v=...",
        label_visibility="collapsed",
    )
    col_a, _ = st.columns([1, 5])
    with col_a:
        botao = st.button("ANALISAR", use_container_width=True, key="btn_lupa",
                          disabled=(restantes <= 0))

    if not (botao and url_input):
        return

    video_id = extrair_video_id(url_input)
    if not video_id:
        st.error("URL inválida.")
        return

    # Check diário global
    if not verificar_limite_diario("lupa"):
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
                    is_short=meta.get("is_short"),
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
                        is_short=meta_video.get("is_short"),
                    )
                except Exception:
                    pass  # falha aqui não bloqueia o usuário

            meta = {**meta_video, **meta_canal}
            st.session_state["lupas_feitas"] = st.session_state.get("lupas_feitas", 0) + 1
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

    # Badge de formato (Short vs. Vídeo longo)
    _is_short = meta.get("is_short")
    _dur_seg = meta.get("duracao_segundos", 0)
    if _is_short is True:
        st.markdown(
            f"<span style='background:#560BF2; color:white; padding:0.2rem 0.6rem; "
            f"border-radius:4px; font-size:0.85rem;'>📱 SHORT · {_dur_seg}s</span>",
            unsafe_allow_html=True,
        )
    elif _is_short is False:
        _min = _dur_seg // 60
        _sec = _dur_seg % 60
        st.markdown(
            f"<span style='background:#27D337; color:black; padding:0.2rem 0.6rem; "
            f"border-radius:4px; font-size:0.85rem;'>🎥 VÍDEO LONGO · {_min}min {_sec}s</span>",
            unsafe_allow_html=True,
        )

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
    st.markdown("## ANÁLISE TIPOLÓGICA")

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

    st.markdown("### Como chegamos nessa análise")
    st.markdown(
        f"""<div style="background:#111; padding:1.5rem; border-radius:4px;
                    border-left: 4px solid #ffffff;">{resultado['justificativa']}</div>""",
        unsafe_allow_html=True,
    )

    with st.expander("🔧 Metadados brutos (para auditoria)"):
        st.json(meta)

    # Acumular no carrinho da sessão
    item_lupa = {
        "video_id": meta.get("video_id", ""),
        "titulo": meta.get("titulo", ""),
        "canal": meta.get("canal_nome", ""),
        "canal_id": meta.get("canal_id", ""),
        "tipo_produtor": resultado.get("tipo_produtor", ""),
        "tipo_conteudo": resultado.get("tipo_conteudo", ""),
        "justificativa": resultado.get("justificativa", ""),
        "visualizacoes": meta.get("visualizacoes", 0),
        "likes": meta.get("likes", 0),
        "comentarios": meta.get("comentarios", 0),
        "inscritos": meta.get("inscritos", 0),
        "data_publicacao": meta.get("publicado_em", ""),
        "data_analise": datetime.now().strftime("%Y-%m-%d %H:%M"),
    }
    # Evitar duplicatas por video_id na mesma sessão
    ids_existentes = {r["video_id"] for r in st.session_state["carrinho"]["lupa"]}
    if item_lupa["video_id"] not in ids_existentes:
        st.session_state["carrinho"]["lupa"].append(item_lupa)
        notificar_carrinho()


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
    st.markdown("## 🌡️ Termômetro do Em Alta")
    st.markdown("##### Acompanhamento contínuo do que o YouTube Brasil está colocando em destaque")

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
        semanal do YouTube Brasil, classifica cada vídeo segundo a tipologia dupla
        (Produtor × Conteúdo) desenvolvida na dissertação de mestrado de Filipe Severo
        (PUCRS/FAMECOS, 2026), e armazena o resultado em um corpus auditável.

        **Por que coletamos ~600 vídeos e não 50?** A pesquisa original usava o
        endpoint geral `chart=mostPopular`, que retorna apenas 50 vídeos. Descobrimos
        empiricamente — e depois confirmamos na documentação oficial do Google (jul/2025)
        — que esse endpoint **exclui sistematicamente** quase todas as categorias
        (Esportes, Notícias, Entretenimento, Música, etc.). Essa exclusão é um achado
        de pesquisa em si: a vitrine "Em Alta" do YouTube é *mais opaca* do que aparenta.

        A solução: coletamos os 50 vídeos mais populares de **cada uma das 12 categorias
        válidas para o Brasil**, mais o endpoint geral — totalizando 13 chamadas e
        aproximadamente **525–600 vídeos únicos por snapshot** (após deduplicação).
        Cada vídeo registra qual endpoint o capturou (`categoria_coleta`), preservando
        rastreabilidade metodológica.

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
    st.markdown("## 🌡️ Termômetro — Painel Interno")
    st.markdown("##### Análise contínua do que o YouTube Brasil escolhe destacar")

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

    st.success(f"📊 {len(snapshots)} coleta(s) disponível(is) no corpus.")

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
        escolha = st.selectbox("Coleta a examinar", options=list(opcoes.keys()), index=0)
        snapshot_id = opcoes[escolha]
        videos = videos_do_snapshot(cliente, snapshot_id)

        if not videos:
            st.warning("Coleta vazia.")
            df = None
        else:
            df = pd.DataFrame(videos)

        if df is not None:

            st.markdown("### Composição do trending")
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

            # Composição por formato (Shorts vs. Longos) — se dado disponível
            if "is_short" in df.columns and df["is_short"].notna().any():
                st.markdown("#### Formato dos vídeos no trending")
                st.caption(
                    "Detecção estrutural: duração ≤ 180s + player vertical = Short. "
                    "Vídeos coletados antes desta funcionalidade aparecem como 'sem dados'."
                )
                shorts_n = int((df["is_short"] == True).sum())
                longos_n = int((df["is_short"] == False).sum())
                sem_dados = int(df["is_short"].isna().sum())
                total_classificado = shorts_n + longos_n

                fc1, fc2, fc3, fc4 = st.columns(4)
                fc1.metric("📱 Shorts", f"{shorts_n}")
                fc2.metric("🎥 Vídeos longos", f"{longos_n}")
                fc3.metric(
                    "% Shorts",
                    f"{(shorts_n / total_classificado * 100):.1f}%" if total_classificado else "—",
                    help="Sobre o total de vídeos com dados de formato disponíveis.",
                )
                fc4.metric(
                    "Sem dados",
                    f"{sem_dados}",
                    help="Coletados antes da detecção de formato ou sem dimensões de player.",
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
                st.plotly_chart(fig_a, use_container_width=True, key="chart_1")

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
                st.plotly_chart(fig_b, use_container_width=True, key="chart_2")

            st.markdown("#### Cruzamento Produtor × Conteúdo")
            st.caption("Baseado no Gráfico 11 da dissertação (Severo, 2026, p. 80).")
            cruzamento = pd.crosstab(df["tipo_produtor"], df["tipo_conteudo"])
            fig_heat = px.imshow(
                cruzamento, template="plotly_dark",
                color_continuous_scale=["#0a0a0a", "#00E87A"],
                aspect="auto", labels={"color": "Vídeos"},
            )
            fig_heat.update_layout(paper_bgcolor="#0a0a0a", plot_bgcolor="#0a0a0a", height=500)
            st.plotly_chart(fig_heat, use_container_width=True, key="termo_fig_heat")

            st.markdown("#### Vídeos dessa coleta")
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
        st.markdown("### Como o trending BR muda ao longo do tempo")

        if len(snapshots) < 2:
            st.info(
                f"📈 A série temporal precisa de pelo menos 2 snapshots. "
                f"Você tem {len(snapshots)}. Aguarde a próxima coleta automatizada "
                "ou execute manualmente pelo GitHub Actions."
            )
            pass  # não interrompe outras abas

        with st.spinner("Carregando corpus completo..."):
            todos = todos_videos_para_serie_temporal(cliente)

        df_t = pd.DataFrame(todos)
        df_t["data_coleta"] = df_t["snapshots"].apply(
            lambda s: s["data_coleta"][:10] if s else None
        )
        df_t = df_t.dropna(subset=["data_coleta"])

        st.markdown("#### Composição por tipo de produtor (% por coleta)")
        comp_a = df_t.groupby(["data_coleta", "tipo_produtor"]).size().reset_index(name="n")
        total_a = comp_a.groupby("data_coleta")["n"].transform("sum")
        comp_a["percentual"] = (comp_a["n"] / total_a) * 100

        fig_serie_a = px.area(
            comp_a, x="data_coleta", y="percentual", color="tipo_produtor",
            color_discrete_map=CORES_PRODUTOR, template="plotly_dark",
            labels={"data_coleta": "Coleta", "percentual": "% do trending"},
        )
        fig_serie_a.update_layout(paper_bgcolor="#0a0a0a", plot_bgcolor="#0a0a0a", height=450)
        st.plotly_chart(fig_serie_a, use_container_width=True, key="termo_serie_a")

        st.markdown("#### Composição por tipo de conteúdo (% por coleta)")
        comp_b = df_t.groupby(["data_coleta", "tipo_conteudo"]).size().reset_index(name="n")
        total_b = comp_b.groupby("data_coleta")["n"].transform("sum")
        comp_b["percentual"] = (comp_b["n"] / total_b) * 100

        fig_serie_b = px.area(
            comp_b, x="data_coleta", y="percentual", color="tipo_conteudo",
            color_discrete_map=CORES_CONTEUDO, template="plotly_dark",
            labels={"data_coleta": "Coleta", "percentual": "% do trending"},
        )
        fig_serie_b.update_layout(paper_bgcolor="#0a0a0a", plot_bgcolor="#0a0a0a", height=450)
        st.plotly_chart(fig_serie_b, use_container_width=True, key="termo_serie_b")

    # === ABA 3: CANAIS ===
    with tab_canais:
        st.markdown("### Canais que mais aparecem no trending")
        st.caption("Baseado no Gráfico 03 da dissertação (Severo, 2026, p. 69).")

        with st.spinner("Calculando recorrências..."):
            todos = todos_videos_para_serie_temporal(cliente)

        df_c = pd.DataFrame(todos)
        if df_c.empty:
            st.info("Sem dados ainda.")
            pass  # não interrompe outras abas

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
        st.plotly_chart(fig_canais, use_container_width=True, key="termo_canais")

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
            pass  # não interrompe outras abas

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
            "Cada correção é registrada com justificativa."
        )
        try:
            cliente_escrita = conectar(modo="escrita")
        except Exception as e:
            st.error(f"Erro ao conectar para escrita: {e}")
            cliente_escrita = cliente

        try:
            snapshots_cur = listar_snapshots(cliente)
            if not snapshots_cur:
                st.info("Nenhum snapshot disponível.")
            else:
                opcoes_cur = {
                    f"#{s['id']} — {s['data_coleta'][:10]} ({s['dia_semana']} {s['horario_coleta']})": s["id"]
                    for s in snapshots_cur
                }
                escolha_cur = st.selectbox(
                    "Coleta a revisar", options=list(opcoes_cur.keys()), key="cur_snapshot"
                )
                snapshot_id_cur = opcoes_cur[escolha_cur]
                videos_cur = videos_do_snapshot(cliente, snapshot_id_cur)

                if not videos_cur:
                    st.warning("Coleta vazia.")
                else:
                    df_cur = pd.DataFrame(videos_cur)
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
                                        # 1. Salva no banco âncora de canais validados
                                        salvar_canal_validado(
                                            cliente_escrita,
                                            canal_id=row["canal_id"],
                                            canal_nome=row["canal_nome"],
                                            tipo_produtor=novo_produtor,
                                            tipo_conteudo=novo_conteudo,
                                            justificativa=justificativa_cor.strip(),
                                        )
                                        # 2. Propaga para TODO o banco
                                        n_prop = propagar_classificacao_canal(
                                            cliente_escrita,
                                            canal_id=row["canal_id"],
                                            tipo_produtor=novo_produtor,
                                            tipo_conteudo=novo_conteudo if mudou_conteudo else None,
                                            justificativa=f"[CURADORIA HUMANA] {justificativa_cor.strip()}",
                                        )
                                        st.success(
                                            f"✅ {row['canal_nome']} → "
                                            f"{buscar_produtor(novo_produtor).nome if mudou_produtor else ''}"
                                            f"{' + ' if mudou_produtor and mudou_conteudo else ''}"
                                            f"{buscar_conteudo(novo_conteudo).nome if mudou_conteudo else ''}"
                                            f" — {n_prop} registro(s) atualizados + canal salvo como âncora."
                                        )
                                        st.rerun()
                                    except Exception as e:
                                        st.error(f"Erro ao salvar: {e}")
        except Exception as e:
            st.error(f"Erro na curadoria: {e}")
            st.exception(e)


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
            "part": "snippet,statistics,contentDetails,player",
            "maxWidth": 1920,
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

    # Gerar exemplos dinâmicos do canais_validados (few-shot anchoring)
    exemplos_dinamicos_haiku = ""
    try:
        cliente_db_local = conectar(modo="leitura")

        # Verificar se o canal deste item já foi validado manualmente
        canal_id_item = item["snippet"].get("channelId", "")
        if canal_id_item:
            validado = buscar_canal_validado(cliente_db_local, canal_id_item)
            if validado:
                return {
                    "tipo_produtor": validado["tipo_produtor"],
                    "tipo_conteudo": validado.get("tipo_conteudo") or "outros",
                    "justificativa": f"[ÂNCORA VALIDADA] {validado.get('justificativa', '')}",
                }

        exemplos = buscar_exemplos_ancora(cliente_db_local, limite=15)
        if exemplos:
            linhas = []
            for ex in exemplos:
                just = ex.get("justificativa", "")[:80]
                linhas.append(
                    f"- {ex['canal_nome']} → {ex['tipo_produtor']}"
                    f"{f' [{just}]' if just else ''}"
                )
            exemplos_dinamicos_haiku = (
                "\n\nEXEMPLOS VALIDADOS PELO PESQUISADOR:\n"
                + "\n".join(linhas)
            )
    except Exception:
        pass

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
{exemplos_dinamicos_haiku}"""

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
            # Logar o primeiro erro para diagnóstico (só uma vez, não polui a tela)
            if i == 0:
                st.warning(
                    f"⚠️ Classificação automática falhou no primeiro item: `{type(e).__name__}: {e}`. "
                    f"Se todos os resultados aparecerem como 'outros', verifique os créditos/chave da API Anthropic."
                )

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


def renderizar_resultados_disputa(termo: str, busca_id: int, do_cache: bool, cliente_db, auto_carrinho: bool = True) -> None:
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

    st.markdown("### Quem ganhou visibilidade?")
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
    st.markdown("### Diferença em relação à média do trending")
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
                    coleta(s). O teste estatístico (qui-quadrado de aderência) só é
                    ativado a partir de {MIN_SNAPSHOTS_PARA_QUIQUADRADO} coletas
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
        st.plotly_chart(fig_a, use_container_width=True, key="chart_3")

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
        st.plotly_chart(fig_b, use_container_width=True, key="chart_4")

    # =========================================================================
    # VOZES AUSENTES — duas camadas analíticas distintas
    # =========================================================================
    st.markdown("---")
    st.markdown("### 🔇 Quem ficou de fora")

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
            # Ausência impro
