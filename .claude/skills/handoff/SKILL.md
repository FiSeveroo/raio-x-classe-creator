---
name: handoff
description: Passa o bastão — resume a conversa atual num documento para outro chat do Raio-X continuar o trabalho sem o Filipe copiar mensagem longa.
argument-hint: "Para qual chat/área e o que ele vai fazer (ex.: dados, auditar lacunas do Termômetro)"
disable-model-invocation: true
---

<!-- Adaptado de mattpocock/skills (productivity/handoff), licença MIT, © Matt Pocock. -->

Escreva um documento de passagem de bastão que permita a um chat novo continuar o trabalho desta conversa sem ter lido nada dela.

## Onde salvar
`.claude/handoffs/AAAA-MM-DD-<area>-<assunto-curto>.md` dentro do projeto (a pasta é ignorada pelo Git; crie se não existir). Todos os chats do projeto leem essa pasta.

## O que o documento traz
1. **Para quem:** o chat de destino (`/raiox-dados`, `/raiox-metodologia`, `/raiox-infra`, `/raiox-design`, `/raiox-ux` ou `/raiox-pesquisa`). Se o Filipe passou argumento, use-o para escolher a área e recortar o documento.
2. **Tarefa:** o que fazer, em uma ou duas frases.
3. **Contexto que só existe nesta conversa:** diagnóstico, números conferidos, o que já foi tentado, o que ficou descartado e por quê.
4. **Decisões do Filipe** já tomadas nesta conversa (com data) e o que **ainda depende dele**.
5. **Limites:** o que não pode ser feito sem perguntar (gravar no corpus, mexer no `main`, mudar prompt validado etc., conforme o `CLAUDE.md`).
6. **Como saber que terminou** e onde registrar o resultado (`CLAUDE.md` Estado/Backlog ou `messages/REVISAO.md`).

## Regras
- Não repita o que já está escrito em outro lugar (`CLAUDE.md`, PR, commit, issue, arquivo do repo): aponte o caminho ou link.
- Nunca inclua segredo (chave, senha, token) nem dado pessoal.
- Português, direto, sem enfeite. Curto o bastante para ler em um minuto.

## Ao terminar
Responda ao Filipe com uma única linha pronta para colar no chat de destino, num bloco de código:

```
/raiox-<area> Leia .claude/handoffs/<arquivo>.md e continue a partir dali.
```
