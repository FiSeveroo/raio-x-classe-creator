# Raio-X da Classe Creator — Next.js

Nova versão do [Raio-X da Classe Creator](https://raiox.classecreator.com), migrada do Streamlit. Contexto completo, princípios metodológicos e plano de migração: [CLAUDE.md](CLAUDE.md).

## Rodar localmente

```bash
npm install
cp .env.example .env.local   # preencher SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY
npm run dev                  # http://localhost:3000
```

Sem as credenciais do Supabase o site funciona e mostra "sem dados" nos números do corpus.

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | servidor de desenvolvimento |
| `npm run build` | build de produção |
| `npm run lint` | ESLint |
| `npm run verificar:tipologia` | confere se `src/lib/tipologia.ts` é idêntica ao `tipologia.py` do repo legado (espera o clone em `../raio-x-classe-creator`) |

## Estrutura

```
messages/            textos PT/EN/ES (next-intl) + REVISAO.md (traduções a revisar)
src/app/[locale]/    páginas; PT sem prefixo (/lupa), EN e ES com (/en/lupa)
src/proxy.ts         idioma + redirecionamento das URLs antigas do Streamlit (?m=lupa → /lupa)
src/lib/tipologia.ts tipologia dupla (porte literal do tipologia.py)
src/lib/corpus.ts    consultas de LEITURA ao Supabase (porte do db.py)
src/lib/supabase/    cliente só-leitura
```

## Problema conhecido no Windows (SWC)

Se o `next dev` falhar com `ERR_SWC_NATIVE_CACHE ... DACL grants replacement rights`, a pasta de cache global do SWC (`%LOCALAPPDATA%\swc`) está com permissões que ele recusa. Contorno: usar um cache dentro do projeto.

```bash
set SWC_NATIVE_BINDING_CACHE=%CD%\.swc
```
