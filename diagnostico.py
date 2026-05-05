"""
==============================================================================
RAIO-X — SCRIPT DE DIAGNÓSTICO DO SUPABASE
==============================================================================

Este script NÃO faz parte da operação normal. É uma ferramenta de
troubleshooting para isolar problemas de conexão com o Supabase.

Roda via GitHub Actions ou localmente. Imprime informações úteis
para identificar onde está a falha, sem expor as chaves.
==============================================================================
"""

import os
import sys

print("="*70)
print("DIAGNÓSTICO SUPABASE — RAIO-X")
print("="*70)

# 1. Verificar se as variáveis de ambiente chegaram
print("\n[1] Verificando variáveis de ambiente...")
url = os.environ.get("SUPABASE_URL", "")
chave = os.environ.get("SUPABASE_SECRET_KEY", "")

if not url:
    print("  ❌ SUPABASE_URL está vazia ou ausente.")
    sys.exit(1)
if not chave:
    print("  ❌ SUPABASE_SECRET_KEY está vazia ou ausente.")
    sys.exit(1)

# Análise da URL (sem expor a chave)
print(f"  ✅ SUPABASE_URL recebida")
print(f"     - tamanho: {len(url)} caracteres")
print(f"     - começa com: {url[:30]}")
print(f"     - termina com: ...{url[-10:]}")
print(f"     - tem barra no final? {'SIM ⚠️' if url.endswith('/') else 'não ✓'}")
print(f"     - tem espaço no início/fim? {'SIM ⚠️' if url != url.strip() else 'não ✓'}")
print(f"     - usa https? {'sim ✓' if url.startswith('https://') else 'NÃO ⚠️'}")

print(f"  ✅ SUPABASE_SECRET_KEY recebida")
print(f"     - tamanho: {len(chave)} caracteres")
print(f"     - tem espaço no início/fim? {'SIM ⚠️' if chave != chave.strip() else 'não ✓'}")
print(f"     - prefixo: {chave[:10]}...")
print(f"     - formato: {'JWT (eyJ...)' if chave.startswith('eyJ') else 'Novo formato (sb_secret_...)' if chave.startswith('sb_secret') else 'DESCONHECIDO ⚠️'}")

# 2. Testar import da biblioteca
print("\n[2] Verificando biblioteca supabase-py...")
try:
    import supabase
    print(f"  ✅ supabase-py versão: {supabase.__version__ if hasattr(supabase, '__version__') else '(versão não disponível)'}")
except ImportError as e:
    print(f"  ❌ Falha ao importar supabase: {e}")
    sys.exit(1)

# 3. Tentar criar o cliente
print("\n[3] Criando cliente Supabase...")
try:
    from supabase import create_client
    cliente = create_client(url.strip(), chave.strip())
    print(f"  ✅ Cliente criado com sucesso")
except Exception as e:
    print(f"  ❌ Erro ao criar cliente: {type(e).__name__}: {e}")
    sys.exit(1)

# 4. Tentar uma operação SELECT simples (deve funcionar mesmo sem dados)
print("\n[4] Testando SELECT na tabela 'snapshots'...")
try:
    resp = cliente.table("snapshots").select("id").limit(1).execute()
    print(f"  ✅ SELECT funcionou. Linhas retornadas: {len(resp.data)}")
except Exception as e:
    print(f"  ❌ Erro no SELECT: {type(e).__name__}: {e}")
    print("     CAUSAS POSSÍVEIS:")
    print("     - tabela 'snapshots' não existe (rode o SQL de criação)")
    print("     - URL incorreta")
    print("     - chave inválida")
    sys.exit(1)

# 5. Tentar um INSERT de teste
print("\n[5] Testando INSERT em 'snapshots' (registro de teste)...")
try:
    resp = cliente.table("snapshots").insert({
        "semana_ano": 0,
        "dia_semana": "TESTE",
        "horario_coleta": "00h",
        "total_videos_coletados": 0,
        "observacoes": "REGISTRO DE DIAGNÓSTICO — pode ser deletado",
    }).execute()
    snapshot_id = resp.data[0]["id"]
    print(f"  ✅ INSERT funcionou. ID criado: #{snapshot_id}")

    # Limpar o registro de teste
    cliente.table("snapshots").delete().eq("id", snapshot_id).execute()
    print(f"  ✅ Registro de teste deletado")
except Exception as e:
    print(f"  ❌ Erro no INSERT: {type(e).__name__}: {e}")
    print("     CAUSA PROVÁVEL: chave usada não tem permissão de escrita.")
    print("     - Você está usando a chave 'anon' (leitura) em vez de 'service_role' (escrita)?")
    sys.exit(1)

print("\n" + "="*70)
print("✅ TODOS OS TESTES PASSARAM — Supabase está OK")
print("="*70)
