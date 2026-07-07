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
        # Fonte da coleta: "geral" ou ID da categoria filtrada ("17", "25", etc.)
        # Essencial para a Evidência 2 do paper (overlap entre endpoints).
        # Campo adicionado em 29/mai/2026 — registros anteriores têm DEFAULT 'geral'.
        "categoria_coleta": metadados.get("categoria_coleta", "geral"),
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
# OPERAÇÕES — HOME (CONTADORES AGREGADOS PARA HERO/VITRINE)
# ==============================================================================

def contadores_publicos(cliente: Client) -> dict:
    """
    Retorna métricas agregadas de TODOS os módulos para alimentar
    a Home dinamicamente. Em caso de erro em qualquer tabela específica,
    retorna 0 naquele contador (não derruba a Home).
    """
    counts = {
        "snapshots_termometro": 0,
        "videos_no_termometro": 0,
        "buscas_realizadas": 0,
        "dossies_canais": 0,
        "analises_voz_da_base": 0,
    }

    try:
        r = cliente.table("snapshots").select("id", count="exact").limit(1).execute()
        counts["snapshots_termometro"] = r.count or 0
    except Exception:
        pass

    try:
        r = cliente.table("videos_snapshot").select("id", count="exact").limit(1).execute()
        counts["videos_no_termometro"] = r.count or 0
    except Exception:
        pass

    try:
        r = cliente.table("buscas_narrativa").select("id", count="exact").limit(1).execute()
        counts["buscas_realizadas"] = r.count or 0
    except Exception:
        pass

    try:
        r = cliente.table("dossies_canal").select("id", count="exact").limit(1).execute()
        counts["dossies_canais"] = r.count or 0
    except Exception:
        pass

    try:
        r = cliente.table("analises_comentarios").select("id", count="exact").limit(1).execute()
        counts["analises_voz_da_base"] = r.count or 0
    except Exception:
        pass

    return counts


# ==============================================================================
# OPERAÇÕES — MÓDULO 5 (VOZ DA BASE)
# ==============================================================================

def registrar_analise_comentarios(
    cliente: Client,
    video_id: str,
    titulo_video: str,
    canal_id: str,
    canal_nome: str,
    total_comentarios_analisados: int,
    indice_pressao_produtiva: float,
    distribuicao_dimensoes_json: str,
    sintese_qualitativa: str,
    contradicao_estrutural: str,
    comentarios_brutos_json: str,
    versao_numero: int = 1,
    versao_anterior_id: int | None = None,
) -> int:
    """
    Persiste uma análise de comentários (Voz da Base).

    Se versao_numero > 1, esta é uma ATUALIZAÇÃO — descanoniza versão anterior.

    indice_pressao_produtiva: % de comentários que cobram produtividade
    distribuicao_dimensoes: contagem de comentários por cada dimensão analítica
    sintese_qualitativa: prosa interpretativa gerada por Sonnet
    contradicao_estrutural: análise do gap entre o que canal entrega vs o que público pede
    comentarios_brutos: JSON com os 100 comentários classificados individualmente
    """
    if versao_numero > 1 and versao_anterior_id:
        descanonizar_anterior(cliente, "analises_comentarios", versao_anterior_id)

    resposta = cliente.table("analises_comentarios").insert({
        "video_id": video_id,
        "titulo_video": titulo_video[:500],
        "canal_id": canal_id,
        "canal_nome": canal_nome[:200],
        "total_analisados": total_comentarios_analisados,
        "indice_pressao_produtiva": indice_pressao_produtiva,
        "distribuicao_dimensoes": distribuicao_dimensoes_json,
        "sintese_qualitativa": sintese_qualitativa,
        "contradicao_estrutural": contradicao_estrutural,
        "comentarios_brutos": comentarios_brutos_json,
        "versao_numero": versao_numero,
        "versao_anterior_id": versao_anterior_id,
        "canonica": True,
    }).execute()
    return resposta.data[0]["id"]


def buscar_cache_comentarios(cliente: Client, video_id: str, dias_validade: int = 7) -> dict | None:
    """Cache de 7 dias para análise de comentários do mesmo vídeo."""
    from datetime import datetime, timedelta
    limite = (datetime.utcnow() - timedelta(days=dias_validade)).isoformat()
    resposta = (
        cliente.table("analises_comentarios")
        .select("*")
        .eq("video_id", video_id)
        .gte("data_analise", limite)
        .order("data_analise", desc=True)
        .limit(1)
        .execute()
    )
    return resposta.data[0] if resposta.data else None


def buscar_dossie_canal_existente(cliente: Client, canal_id: str) -> dict | None:
    """
    Verifica se existe dossiê recente do canal (qualquer idade).
    Usado para o cruzamento 'o que canal entrega vs. o que público pede'.
    """
    resposta = (
        cliente.table("dossies_canal")
        .select("classificacao_sociologica, tipo_conteudo_predominante, sintomas_estruturais")
        .eq("canal_id", canal_id)
        .order("data_dossie", desc=True)
        .limit(1)
        .execute()
    )
    return resposta.data[0] if resposta.data else None


def buscar_distribuicao_ipps(cliente: Client) -> list[float]:
    """
    Retorna lista de TODOS os IPPs (Índice de Pressão Produtiva) já calculados
    pelo Módulo 5 no corpus. Usado para calibrar thresholds via percentis
    empíricos — auto-calibrante conforme o corpus cresce.
    """
    try:
        resposta = (
            cliente.table("analises_comentarios")
            .select("indice_pressao_produtiva")
            .execute()
        )
        return [
            float(r["indice_pressao_produtiva"])
            for r in resposta.data
            if r.get("indice_pressao_produtiva") is not None
        ]
    except Exception:
        return []


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
    versao_numero: int = 1,
    versao_anterior_id: int | None = None,
) -> int:
    """
    Persiste um dossiê completo de canal.

    Se versao_numero > 1, esta é uma ATUALIZAÇÃO — a função descanoniza
    o registro anterior (versao_anterior_id) automaticamente.

    classificacao_sociologica = veredito final (Eixo A)
    auto_classificacao = o que o canal "diz ser" pela descrição
    sintomas_estruturais = JSON com indicadores que justificam a classe real
    veredito_sonnet = análise narrativa em texto livre (gerada por Sonnet)
    rede_canais_json = lista de canais "amigos" detectados (channelSections)
    composicao_videos_json = contagem por tipo_conteudo dos 50 vídeos analisados
    """
    # Se é atualização, descanoniza a versão anterior
    if versao_numero > 1 and versao_anterior_id:
        descanonizar_anterior(cliente, "dossies_canal", versao_anterior_id)

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
        "versao_numero": versao_numero,
        "versao_anterior_id": versao_anterior_id,
        "canonica": True,
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
    versao_numero: int = 1,
    versao_anterior_id: int | None = None,
) -> int:
    """
    Registra uma busca executada no Módulo 4 para compor o corpus
    longitudinal de "temas que pesquisadores consideraram dignos de auditoria".

    Se versao_numero > 1, esta é uma ATUALIZAÇÃO — descanoniza versão anterior.

    composicao_*_json: JSON com a contagem por categoria, para análise rápida
    sem precisar reabrir cada vídeo individual.
    """
    if versao_numero > 1 and versao_anterior_id:
        descanonizar_anterior(cliente, "buscas_narrativa", versao_anterior_id)

    resposta = cliente.table("buscas_narrativa").insert({
        "termo_buscado": termo[:500],
        "tipo_resultado": tipo_resultado,
        "total_analisados": total_resultados_analisados,
        "composicao_produtor": composicao_produtor_json,
        "composicao_conteudo": composicao_conteudo_json,
        "versao_numero": versao_numero,
        "versao_anterior_id": versao_anterior_id,
        "canonica": True,
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


def estatisticas_corpus_termometro(cliente: Client) -> dict:
    """
    Retorna estatísticas estruturais do corpus do Termômetro, necessárias
    para validar se a base é robusta o suficiente para testes estatísticos
    (qui-quadrado de aderência no Desvio Editorial).

    Retorna:
      - n_snapshots: número de snapshots acumulados
      - n_videos: total de vídeos no corpus
      - contagens_absolutas: {codigo_produtor: n_videos_dessa_categoria}
      - composicao_proporcional: {codigo_produtor: % do corpus}
    """
    try:
        # Conta snapshots de forma eficiente
        r_snap = cliente.table("snapshots").select("id", count="exact").limit(1).execute()
        n_snapshots = r_snap.count or 0
    except Exception:
        n_snapshots = 0

    todos = todos_videos_para_serie_temporal(cliente)
    if not todos:
        return {
            "n_snapshots": n_snapshots,
            "n_videos": 0,
            "contagens_absolutas": {},
            "composicao_proporcional": {},
        }

    total = len(todos)
    contagem = {}
    for v in todos:
        t = v["tipo_produtor"]
        contagem[t] = contagem.get(t, 0) + 1

    return {
        "n_snapshots": n_snapshots,
        "n_videos": total,
        "contagens_absolutas": contagem,
        "composicao_proporcional": {t: (n / total) * 100 for t, n in contagem.items()},
    }


# ==============================================================================
# UTILITÁRIOS
# ==============================================================================

def ultima_semana_coletada(cliente: Client) -> int | None:
    """Retorna o número da semana ISO do snapshot mais recente, ou None se não houver."""
    try:
        resp = (
            cliente.table("snapshots")
            .select("semana_ano")
            .order("id", desc=True)
            .limit(1)
            .execute()
        )
        if resp.data:
            return resp.data[0]["semana_ano"]
        return None
    except Exception:
        return None


def contar_uso_diario(cliente: Client, modulo: str) -> int:
    """
    Conta quantas análises de um módulo foram feitas hoje (UTC).
    Usa a tabela existente de cada módulo para contar registros do dia.

    Módulos suportados: 'lupa', 'disputa', 'dossie', 'voz'
    """
    hoje = datetime.now().strftime("%Y-%m-%d")
    try:
        tabelas = {
            "lupa": ("classificacoes_video", "data_classificacao"),
            "disputa": ("buscas_narrativa", "data_busca"),
            "dossie": ("dossies_canal", "data_dossie"),
            "voz": ("analises_comentarios", "data_analise"),
        }
        tabela, coluna = tabelas.get(modulo, (None, None))
        if not tabela:
            return 0

        resp = (
            cliente.table(tabela)
            .select("id", count="exact")
            .gte(coluna, f"{hoje}T00:00:00")
            .lte(coluna, f"{hoje}T23:59:59")
            .execute()
        )
        return resp.count if resp.count else 0
    except Exception:
        return 0


# ==============================================================================
# CANAIS VALIDADOS — banco de classificações humanas
# ==============================================================================

def buscar_exemplos_ancora(cliente: Client, limite: int = 20) -> list[dict]:
    """
    Retorna os canais validados mais recentes para usar como few-shot no prompt.
    Balanceia entre categorias para não enviesar o prompt.
    """
    try:
        resp = (
            cliente.table("canais_validados")
            .select("canal_nome, tipo_produtor, tipo_conteudo, justificativa")
            .order("atualizado_em", desc=True)
            .limit(limite)
            .execute()
        )
        return resp.data or []
    except Exception:
        return []


def buscar_canal_validado(cliente: Client, canal_id: str) -> dict | None:
    """
    Consulta se um canal já tem classificação humana validada.
    Retorna o registro ou None se não encontrado.
    """
    try:
        resp = (
            cliente.table("canais_validados")
            .select("*")
            .eq("canal_id", canal_id)
            .limit(1)
            .execute()
        )
        if resp.data:
            return resp.data[0]
        return None
    except Exception:
        return None


def salvar_canal_validado(
    cliente: Client,
    canal_id: str,
    canal_nome: str,
    tipo_produtor: str,
    tipo_conteudo: str | None,
    justificativa: str,
    fonte: str = "curadoria_humana",
) -> None:
    """
    Salva ou atualiza a classificação validada de um canal.
    Usa upsert — se o canal já existe, atualiza.
    """
    try:
        cliente.table("canais_validados").upsert({
            "canal_id": canal_id,
            "canal_nome": canal_nome,
            "tipo_produtor": tipo_produtor,
            "tipo_conteudo": tipo_conteudo,
            "justificativa": justificativa,
            "fonte": fonte,
        }, on_conflict="canal_id").execute()
    except Exception as e:
        print(f"⚠️  Erro ao salvar canal validado {canal_nome}: {e}")


def propagar_classificacao_canal(
    cliente: Client,
    canal_id: str,
    tipo_produtor: str,
    tipo_conteudo: str | None,
    justificativa: str,
) -> int:
    """
    Propaga classificação humana para TODAS as aparições do canal
    nas tabelas videos_snapshot e resultados_busca.
    Retorna o total de registros atualizados.
    """
    total = 0
    payload = {
        "classificado_com": "curadoria_humana",
        "justificativa": justificativa,
        "tipo_produtor": tipo_produtor,
    }
    if tipo_conteudo:
        payload["tipo_conteudo"] = tipo_conteudo

    try:
        r1 = (
            cliente.table("videos_snapshot")
            .update(payload)
            .eq("canal_id", canal_id)
            .execute()
        )
        total += len(r1.data) if r1.data else 0
    except Exception as e:
        print(f"⚠️  Erro ao propagar em videos_snapshot: {e}")

    try:
        r2 = (
            cliente.table("resultados_busca")
            .update(payload)
            .eq("canal_id", canal_id)
            .execute()
        )
        total += len(r2.data) if r2.data else 0
    except Exception as e:
        print(f"⚠️  Erro ao propagar em resultados_busca: {e}")

    return total


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


# ==============================================================================
# OPERAÇÕES — MÓDULO 1 (LUPA) NO SUPABASE
# ==============================================================================
# A Lupa originalmente persistia em SQLite local. Agora também persiste no
# Supabase (cache vitalício + biblioteca pública).

def registrar_lupa(
    cliente: Client,
    video_id: str,
    titulo: str,
    canal_id: str,
    canal_nome: str,
    tipo_produtor: str,
    tipo_conteudo: str,
    justificativa: str,
    metadados_json: str,
    versao_numero: int = 1,
    versao_anterior_id: int | None = None,
) -> int:
    """
    Persiste uma análise da Lupa no Supabase para integrar a biblioteca pública.

    Se versao_numero > 1, esta é uma ATUALIZAÇÃO — descanoniza versão anterior.
    """
    if versao_numero > 1 and versao_anterior_id:
        descanonizar_anterior(cliente, "classificacoes_video", versao_anterior_id)

    resposta = cliente.table("classificacoes_video").insert({
        "video_id": video_id,
        "titulo": titulo[:500] if titulo else "",
        "canal_id": canal_id,
        "canal_nome": canal_nome[:200] if canal_nome else "",
        "tipo_produtor": tipo_produtor,
        "tipo_conteudo": tipo_conteudo,
        "justificativa": justificativa,
        "metadados_json": metadados_json,
        "versao_numero": versao_numero,
        "versao_anterior_id": versao_anterior_id,
        "canonica": True,
    }).execute()
    return resposta.data[0]["id"]


# ==============================================================================
# ==============================================================================
# SISTEMA DE VERSIONAMENTO E BIBLIOTECA DE PESQUISA
# ==============================================================================
# Adicionado em maio/2026, após decisão científica de transformar o cache
# (originalmente decisão técnica de 14 dias) em corpus longitudinal vitalício
# com versionamento de análises e biblioteca pública navegável.
#
# CONCEITOS:
#   - "canonica = True" identifica a versão MAIS RECENTE de cada objeto
#   - Cada nova análise de um objeto existente:
#       1. Marca a versão atual como canonica = False
#       2. Cria nova versão com canonica = True e versao_numero + 1
#       3. Linka via versao_anterior_id
#   - Cache vitalício: nunca expira por tempo, apenas atualização explícita gera versão nova
#   - Cooldown de 30 dias entre atualizações do mesmo objeto
#   - Peso da atualização cresce exponencialmente (1, 2, 4, 8...) para desincentivar abuso
# ==============================================================================

COOLDOWN_ATUALIZACAO_DIAS = 30


# ==============================================================================
# FUNÇÕES GENÉRICAS DE VERSIONAMENTO
# ==============================================================================

def calcular_peso_atualizacao(versao_numero: int) -> int:
    """
    Calcula peso de slots consumidos por uma atualização, baseado em quantas
    versões já existem do objeto. Escala exponencial para desincentivar abuso.

    versão 1 (criação inicial) → consome 1 slot (peso normal)
    versão 2 (1ª atualização)  → consome 2 slots
    versão 3 (2ª atualização)  → consome 4 slots
    versão 4 (3ª atualização)  → consome 8 slots
    ...
    """
    if versao_numero <= 1:
        return 1
    # Para criar versão N, custa 2^(N-1) slots
    return 2 ** (versao_numero - 1)


def pode_atualizar(data_canonica_iso: str, cooldown_dias: int = COOLDOWN_ATUALIZACAO_DIAS) -> tuple[bool, int]:
    """
    Verifica se já passou o cooldown desde a última versão canônica.

    Retorna: (pode_atualizar, dias_restantes)
    Se pode_atualizar=True, dias_restantes=0
    Se pode_atualizar=False, dias_restantes=quantos faltam
    """
    from datetime import datetime, timedelta

    try:
        # Trata Z e timezones diversas
        if data_canonica_iso.endswith("Z"):
            data_canonica_iso = data_canonica_iso[:-1] + "+00:00"
        data_canonica = datetime.fromisoformat(data_canonica_iso)
        if data_canonica.tzinfo is None:
            data_canonica = data_canonica.replace(tzinfo=None)
            agora = datetime.utcnow()
        else:
            agora = datetime.now(data_canonica.tzinfo)
    except (ValueError, AttributeError):
        # Se falhar parse, libera atualização por garantia
        return True, 0

    delta = agora - data_canonica
    if delta >= timedelta(days=cooldown_dias):
        return True, 0
    dias_restantes = cooldown_dias - delta.days
    return False, max(1, dias_restantes)


# ==============================================================================
# CACHE VITALÍCIO — substitui as funções buscar_cache_* antigas
# ==============================================================================
# Todas estas funções buscam a VERSÃO CANÔNICA (mais recente) do objeto,
# sem expiração por tempo. Substituem progressivamente buscar_cache_dossie,
# buscar_cache_comentarios, buscar_cache_busca, etc.

def buscar_canonica_video(cliente: Client, video_id: str) -> dict | None:
    """Retorna a versão canônica (mais recente) da análise de um vídeo."""
    resposta = (
        cliente.table("classificacoes_video")
        .select("*")
        .eq("video_id", video_id)
        .eq("canonica", True)
        .limit(1)
        .execute()
    )
    return resposta.data[0] if resposta.data else None


def buscar_canonica_dossie(cliente: Client, canal_id: str) -> dict | None:
    """Retorna a versão canônica (mais recente) do dossiê de um canal."""
    resposta = (
        cliente.table("dossies_canal")
        .select("*")
        .eq("canal_id", canal_id)
        .eq("canonica", True)
        .limit(1)
        .execute()
    )
    return resposta.data[0] if resposta.data else None


def buscar_canonica_busca(cliente: Client, termo: str, tipo_resultado: str) -> dict | None:
    """Retorna a versão canônica (mais recente) de uma busca temática."""
    resposta = (
        cliente.table("buscas_narrativa")
        .select("*")
        .eq("termo_buscado", termo[:500])
        .eq("tipo_resultado", tipo_resultado)
        .eq("canonica", True)
        .limit(1)
        .execute()
    )
    return resposta.data[0] if resposta.data else None


def buscar_canonica_comentarios(cliente: Client, video_id: str) -> dict | None:
    """Retorna a versão canônica (mais recente) de análise de comentários."""
    resposta = (
        cliente.table("analises_comentarios")
        .select("*")
        .eq("video_id", video_id)
        .eq("canonica", True)
        .limit(1)
        .execute()
    )
    return resposta.data[0] if resposta.data else None


# ==============================================================================
# HISTÓRICO DE VERSÕES — timeline para inspeção de evolução
# ==============================================================================

def historico_versoes_dossie(cliente: Client, canal_id: str) -> list[dict]:
    """Retorna todas as versões de um dossiê, da mais recente para a mais antiga."""
    resposta = (
        cliente.table("dossies_canal")
        .select("id, data_dossie, versao_numero, classificacao_sociologica, tipo_conteudo_predominante")
        .eq("canal_id", canal_id)
        .order("versao_numero", desc=True)
        .execute()
    )
    return resposta.data


def historico_versoes_video(cliente: Client, video_id: str) -> list[dict]:
    """Retorna todas as versões da análise de um vídeo (Módulo 1)."""
    resposta = (
        cliente.table("classificacoes_video")
        .select("id, data_classificacao, versao_numero, tipo_produtor, tipo_conteudo")
        .eq("video_id", video_id)
        .order("versao_numero", desc=True)
        .execute()
    )
    return resposta.data


def historico_versoes_busca(cliente: Client, termo: str, tipo_resultado: str) -> list[dict]:
    """Retorna todas as versões de uma busca temática."""
    resposta = (
        cliente.table("buscas_narrativa")
        .select("id, data_busca, versao_numero, total_analisados")
        .eq("termo_buscado", termo[:500])
        .eq("tipo_resultado", tipo_resultado)
        .order("versao_numero", desc=True)
        .execute()
    )
    return resposta.data


def historico_versoes_comentarios(cliente: Client, video_id: str) -> list[dict]:
    """Retorna todas as versões de análise de comentários de um vídeo."""
    resposta = (
        cliente.table("analises_comentarios")
        .select("id, data_analise, versao_numero, indice_pressao_produtiva, total_analisados")
        .eq("video_id", video_id)
        .order("versao_numero", desc=True)
        .execute()
    )
    return resposta.data


# ==============================================================================
# CRIAÇÃO DE NOVA VERSÃO — descanoniza anterior e cria nova como canônica
# ==============================================================================

def descanonizar_anterior(cliente: Client, tabela: str, registro_id: int) -> None:
    """Marca um registro como NÃO canônico (chamado antes de criar nova versão)."""
    cliente.table(tabela).update({"canonica": False}).eq("id", registro_id).execute()


# ==============================================================================
# BIBLIOTECA — listagens públicas (acesso navegável)
# ==============================================================================

def biblioteca_videos(cliente: Client, limite: int = 500, apenas_canonicas: bool = True) -> list[dict]:
    """
    Lista os vídeos analisados pela Lupa, formato compatível com tabela navegável.
    apenas_canonicas=True (padrão): só a versão atual de cada vídeo.
    """
    query = cliente.table("classificacoes_video").select("*").order("data_classificacao", desc=True).limit(limite)
    if apenas_canonicas:
        query = query.eq("canonica", True)
    return query.execute().data


def biblioteca_dossies(cliente: Client, limite: int = 500, apenas_canonicas: bool = True) -> list[dict]:
    """Lista dossiês de canais (versão canônica por padrão)."""
    query = (
        cliente.table("dossies_canal")
        .select("id, data_dossie, canal_id, canal_nome, inscritos, total_videos_canal,"
                " classificacao_sociologica, tipo_conteudo_predominante, versao_numero")
        .order("data_dossie", desc=True)
        .limit(limite)
    )
    if apenas_canonicas:
        query = query.eq("canonica", True)
    return query.execute().data


def biblioteca_buscas(cliente: Client, limite: int = 500, apenas_canonicas: bool = True) -> list[dict]:
    """Lista buscas temáticas (Disputa de Narrativa)."""
    query = (
        cliente.table("buscas_narrativa")
        .select("*")
        .order("data_busca", desc=True)
        .limit(limite)
    )
    if apenas_canonicas:
        query = query.eq("canonica", True)
    return query.execute().data


def biblioteca_comentarios(cliente: Client, limite: int = 500, apenas_canonicas: bool = True) -> list[dict]:
    """Lista análises de comentários (Voz da Base)."""
    query = (
        cliente.table("analises_comentarios")
        .select("id, data_analise, video_id, titulo_video, canal_id, canal_nome,"
                " total_analisados, indice_pressao_produtiva, versao_numero")
        .order("data_analise", desc=True)
        .limit(limite)
    )
    if apenas_canonicas:
        query = query.eq("canonica", True)
    return query.execute().data


def buscar_analise_por_id(cliente: Client, tabela: str, registro_id: int) -> dict | None:
    """Recupera uma análise específica por ID — útil para timeline e visualização de versão antiga."""
    resposta = cliente.table(tabela).select("*").eq("id", registro_id).limit(1).execute()
    return resposta.data[0] if resposta.data else None
