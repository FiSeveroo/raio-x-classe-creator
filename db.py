"""
==============================================================================
RAIO-X CLASSE CREATOR — CAMADA DE ACESSO AO BANCO (Supabase)
==============================================================================

Este módulo isola TODAS as operações com o banco Postgres no Supabase.
Tanto o app Streamlit (leitura pública via publishable key) quanto o coletor
automatizado (escrita via secret key) consomem este módulo.

A separação é proposital: se um dia mudarmos de banco, basta editar este
arquivo, sem tocar no resto da ferramenta.

Tabelas em uso:
  - snapshots: cada coleta semanal do trending (metadado da coleta)
  - videos_snapshot: 50 vídeos classificados de cada coleta
==============================================================================
"""

import os
from datetime import datetime
from typing import Any

from supabase import Client, create_client


# ==============================================================================
# CONEXÃO
# ==============================================================================

def conectar(modo: str = "leitura") -> Client:
    """
    Cria cliente Supabase autenticado.

    modo='leitura'  → usa SUPABASE_PUBLISHABLE_KEY (segura, só lê)
    modo='escrita'  → usa SUPABASE_SECRET_KEY (poder, só roda no coletor)

    As chaves vêm de:
      - st.secrets em produção (Streamlit Cloud)
      - variáveis de ambiente em scripts (GitHub Actions, local)
    """
    url = _ler_credencial("SUPABASE_URL")

    if modo == "escrita":
        chave = _ler_credencial("SUPABASE_SECRET_KEY")
    else:
        chave = _ler_credencial("SUPABASE_PUBLISHABLE_KEY")

    return create_client(url, chave)


def _ler_credencial(nome: str) -> str:
    """
    Lê uma credencial primeiro de variável de ambiente (scripts/CI),
    e se não achar, tenta st.secrets (app Streamlit).
    """
    valor = os.environ.get(nome)
    if valor:
        return valor

    try:
        import streamlit as st
        return st.secrets[nome]
    except (ImportError, KeyError, FileNotFoundError):
        raise RuntimeError(
            f"Credencial '{nome}' não encontrada. "
            f"Configure em st.secrets (app) ou variáveis de ambiente (coletor)."
        )


# ==============================================================================
# OPERAÇÕES DE ESCRITA (usadas pelo coletor)
# ==============================================================================

def criar_snapshot(
    cliente: Client,
    semana_ano: int,
    dia_semana: str,
    horario_coleta: str,
    total_videos: int,
    observacoes: str = "",
) -> int:
    """
    Cria um novo registro de snapshot e retorna o ID gerado.
    Esse ID é a chave estrangeira que conecta os 50 vídeos a esta coleta.
    """
    resposta = cliente.table("snapshots").insert({
        "semana_ano": semana_ano,
        "dia_semana": dia_semana,
        "horario_coleta": horario_coleta,
        "total_videos_coletados": total_videos,
        "observacoes": observacoes,
    }).execute()

    return resposta.data[0]["id"]


def gravar_video_classificado(
    cliente: Client,
    snapshot_id: int,
    posicao: int,
    metadados: dict[str, Any],
    classificacao: dict[str, str],
    modelo_usado: str = "claude-haiku-4-5",
) -> None:
    """
    Persiste um vídeo classificado dentro de um snapshot.

    metadados: dict com chaves do retorno da YouTube API (videos.list)
    classificacao: {tipo_produtor, tipo_conteudo, justificativa}
    """
    cliente.table("videos_snapshot").insert({
        "snapshot_id": snapshot_id,
        "posicao_ranking": posicao,
        "video_id": metadados["video_id"],
        "titulo": metadados["titulo"][:500],  # protege contra títulos absurdos
        "canal_id": metadados["canal_id"],
        "canal_nome": metadados["canal_nome"][:200],
        "visualizacoes": metadados.get("visualizacoes"),
        "likes": metadados.get("likes"),
        "comentarios": metadados.get("comentarios"),
        "duracao_segundos": metadados.get("duracao_segundos"),
        "tipo_produtor": classificacao["tipo_produtor"],
        "tipo_conteudo": classificacao["tipo_conteudo"],
        "justificativa": classificacao["justificativa"],
        "classificado_com": modelo_usado,
        "data_publicacao": metadados.get("data_publicacao"),
    }).execute()


# ==============================================================================
# OPERAÇÕES DE LEITURA (usadas pelo app Streamlit)
# ==============================================================================

def listar_snapshots(cliente: Client, limite: int = 100) -> list[dict]:
    """
    Retorna a lista de coletas, mais recente primeiro.
    Usado para popular dropdown de seleção de snapshot e série temporal.
    """
    resposta = (
        cliente.table("snapshots")
        .select("*")
        .order("data_coleta", desc=True)
        .limit(limite)
        .execute()
    )
    return resposta.data


def buscar_snapshot_mais_recente(cliente: Client) -> dict | None:
    """Retorna o snapshot mais recente, ou None se ainda não há coletas."""
    snapshots = listar_snapshots(cliente, limite=1)
    return snapshots[0] if snapshots else None


def videos_do_snapshot(cliente: Client, snapshot_id: int) -> list[dict]:
    """Retorna os 50 vídeos classificados de um snapshot, ordenados por ranking."""
    resposta = (
        cliente.table("videos_snapshot")
        .select("*")
        .eq("snapshot_id", snapshot_id)
        .order("posicao_ranking", desc=False)
        .execute()
    )
    return resposta.data


def todos_videos_para_serie_temporal(cliente: Client) -> list[dict]:
    """
    Retorna TODOS os vídeos de TODOS os snapshots, com data da coleta junto.
    Usado para construir gráficos de série temporal (composição × tempo).
    Cuidado: pode ficar pesado se acumularmos centenas de snapshots —
    mais à frente podemos paginar ou agregar no banco.
    """
    resposta = (
        cliente.table("videos_snapshot")
        .select("*, snapshots(data_coleta, semana_ano, dia_semana, horario_coleta)")
        .order("snapshot_id", desc=True)
        .limit(5000)
        .execute()
    )
    return resposta.data


# ==============================================================================
# OPERAÇÕES — MÓDULO 2 (DOSSIÊ DO CANAL)
# ==============================================================================

def registrar_dossie(
    cliente: Client,
    canal_id: str,
    canal_nome: str,
    canal_descricao: str,
    inscritos: int,
    total_videos_canal: int,
    total_videos_analisados: int,
    sintomas_estruturais: str,
    auto_classificacao: str,
    classificacao_sociologica: str,
    tipo_conteudo_predominante: str,
    veredito_sonnet: str,
    rede_canais_json: str,
    composicao_videos_json: str,
) -> int:
    """
    Persiste um dossiê completo de canal.

    classificacao_sociologica = veredito final (Eixo A)
    auto_classificacao = o que o canal "diz ser" pela descrição
    sintomas_estruturais = JSON com indicadores que justificam a classe real
    veredito_sonnet = análise narrativa em texto livre (gerada por Sonnet)
    rede_canais_json = lista de canais "amigos" detectados (channelSections)
    composicao_videos_json = contagem por tipo_conteudo dos 50 vídeos analisados
    """
    resposta = cliente.table("dossies_canal").insert({
        "canal_id": canal_id,
        "canal_nome": canal_nome[:200],
        "canal_descricao": canal_descricao[:5000] if canal_descricao else "",
        "inscritos": inscritos,
        "total_videos_canal": total_videos_canal,
        "total_videos_analisados": total_videos_analisados,
        "sintomas_estruturais": sintomas_estruturais,
        "auto_classificacao": auto_classificacao,
        "classificacao_sociologica": classificacao_sociologica,
        "tipo_conteudo_predominante": tipo_conteudo_predominante,
        "veredito_sonnet": veredito_sonnet,
        "rede_canais": rede_canais_json,
        "composicao_videos": composicao_videos_json,
    }).execute()
    return resposta.data[0]["id"]


def buscar_cache_dossie(cliente: Client, canal_id: str, dias_validade: int = 14) -> dict | None:
    """Verifica se existe um dossiê recente para o canal (cache de 14 dias)."""
    from datetime import datetime, timedelta
    limite = (datetime.utcnow() - timedelta(days=dias_validade)).isoformat()
    resposta = (
        cliente.table("dossies_canal")
        .select("*")
        .eq("canal_id", canal_id)
        .gte("data_dossie", limite)
        .order("data_dossie", desc=True)
        .limit(1)
        .execute()
    )
    return resposta.data[0] if resposta.data else None


def aparicoes_canal_no_termometro(cliente: Client, canal_id: str) -> list[dict]:
    """
    Retorna todas as vezes que o canal apareceu nos snapshots do Termômetro.
    Permite cruzar Dossiê com corpus longitudinal para evidência empírica.
    """
    resposta = (
        cliente.table("videos_snapshot")
        .select("posicao_ranking, titulo, snapshots(data_coleta, semana_ano)")
        .eq("canal_id", canal_id)
        .order("snapshot_id", desc=True)
        .limit(100)
        .execute()
    )
    return resposta.data


def aparicoes_canal_em_buscas(cliente: Client, canal_id: str) -> list[dict]:
    """Retorna em quais buscas do Módulo 4 o canal apareceu."""
    resposta = (
        cliente.table("resultados_busca")
        .select("posicao_ranking, titulo, busca_id, buscas_narrativa(termo_buscado, data_busca)")
        .eq("canal_id", canal_id)
        .order("busca_id", desc=True)
        .limit(50)
        .execute()
    )
    return resposta.data


# ==============================================================================
# OPERAÇÕES — MÓDULO 4 (DISPUTA DE NARRATIVA)
# ==============================================================================

def registrar_busca(
    cliente: Client,
    termo: str,
    tipo_resultado: str,
    total_resultados_analisados: int,
    composicao_produtor_json: str,
    composicao_conteudo_json: str,
) -> int:
    """
    Registra uma busca executada no Módulo 4 para compor o corpus
    longitudinal de "temas que pesquisadores consideraram dignos de auditoria".

    composicao_*_json: JSON com a contagem por categoria, para análise rápida
    sem precisar reabrir cada vídeo individual.
    """
    resposta = cliente.table("buscas_narrativa").insert({
        "termo_buscado": termo[:500],
        "tipo_resultado": tipo_resultado,
        "total_analisados": total_resultados_analisados,
        "composicao_produtor": composicao_produtor_json,
        "composicao_conteudo": composicao_conteudo_json,
    }).execute()
    return resposta.data[0]["id"]


def gravar_resultado_busca(
    cliente: Client,
    busca_id: int,
    posicao: int,
    tipo_item: str,  # 'video', 'channel', 'playlist'
    item_id: str,
    titulo: str,
    canal_id: str,
    canal_nome: str,
    tipo_produtor: str,
    tipo_conteudo: str,
    justificativa: str,
    metadados_extras: dict | None = None,
) -> None:
    """Persiste um resultado individual da busca (vídeo, canal ou playlist)."""
    import json as _json
    cliente.table("resultados_busca").insert({
        "busca_id": busca_id,
        "posicao_ranking": posicao,
        "tipo_item": tipo_item,
        "item_id": item_id,
        "titulo": titulo[:500],
        "canal_id": canal_id,
        "canal_nome": canal_nome[:200] if canal_nome else "",
        "tipo_produtor": tipo_produtor,
        "tipo_conteudo": tipo_conteudo,
        "justificativa": justificativa,
        "metadados_extras": _json.dumps(metadados_extras or {}, ensure_ascii=False),
    }).execute()


def buscar_cache_busca(cliente: Client, termo: str, tipo_resultado: str, dias_validade: int = 7) -> dict | None:
    """
    Verifica se já existe uma busca recente (dentro de N dias) para o mesmo
    termo + tipo. Se existir, retorna o registro para reuso (zero custo de API).
    """
    from datetime import datetime, timedelta
    limite = (datetime.utcnow() - timedelta(days=dias_validade)).isoformat()
    resposta = (
        cliente.table("buscas_narrativa")
        .select("*")
        .eq("termo_buscado", termo[:500])
        .eq("tipo_resultado", tipo_resultado)
        .gte("data_busca", limite)
        .order("data_busca", desc=True)
        .limit(1)
        .execute()
    )
    return resposta.data[0] if resposta.data else None


def resultados_de_busca(cliente: Client, busca_id: int) -> list[dict]:
    """Retorna todos os resultados classificados de uma busca."""
    resposta = (
        cliente.table("resultados_busca")
        .select("*")
        .eq("busca_id", busca_id)
        .order("posicao_ranking", desc=False)
        .execute()
    )
    return resposta.data


def listar_buscas_recentes(cliente: Client, limite: int = 50) -> list[dict]:
    """Lista as buscas mais recentes (para painel agregado)."""
    resposta = (
        cliente.table("buscas_narrativa")
        .select("*")
        .order("data_busca", desc=True)
        .limit(limite)
        .execute()
    )
    return resposta.data


def composicao_media_termometro(cliente: Client) -> dict[str, float]:
    """
    Calcula a composição MÉDIA por tipo de produtor de TODOS os snapshots
    do Termômetro. Usada como linha de base para detectar 'desvio editorial'
    nas buscas do Módulo 4.

    Retorna: {codigo_produtor: percentual_medio}
    """
    todos = todos_videos_para_serie_temporal(cliente)
    if not todos:
        return {}

    total = len(todos)
    contagem = {}
    for v in todos:
        t = v["tipo_produtor"]
        contagem[t] = contagem.get(t, 0) + 1

    return {t: (n / total) * 100 for t, n in contagem.items()}


# ==============================================================================
# UTILITÁRIOS
# ==============================================================================

def calcular_proxima_coleta_semanal() -> tuple[int, str, str]:
    """
    Calcula em qual dia/horário a coleta DEVE acontecer hoje, replicando
    a metodologia da Tabela 02 da dissertação (Severo, 2026):

      Semana 1: segunda 17h
      Semana 2: terça 5h
      Semana 3: quarta 17h
      Semana 4: quinta 5h
      Semana 5: sexta 17h
      Semana 6: sábado 5h
      Semana 7: domingo 17h
      Semana 8: segunda 5h
      ... (cicla a cada 14 semanas)

    Retorna: (semana_do_ano, dia_semana, horario)
    """
    agora = datetime.now()
    semana_ano = int(agora.strftime("%V"))  # ISO week number (1-53)

    # Padrão da dissertação: 14 slots cíclicos
    slots = [
        ("segunda", "17h"), ("terça", "05h"),
        ("quarta", "17h"), ("quinta", "05h"),
        ("sexta", "17h"), ("sábado", "05h"),
        ("domingo", "17h"), ("segunda", "05h"),
        ("terça", "17h"), ("quarta", "05h"),
        ("quinta", "17h"), ("sexta", "05h"),
        ("sábado", "17h"), ("domingo", "05h"),
    ]
    slot = slots[(semana_ano - 1) % 14]
    return semana_ano, slot[0], slot[1]
