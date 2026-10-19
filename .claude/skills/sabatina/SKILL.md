---
name: sabatina
description: Sabatina implacável sobre um plano, decisão ou ideia do Filipe, até todas as escolhas estarem explícitas. Use quando ele pedir para ser sabatinado, testar um plano ou "me questiona".
argument-hint: "O plano, decisão ou ideia a sabatinar"
disable-model-invocation: true
---

<!-- Adaptado de mattpocock/skills (productivity/grilling), licença MIT, © Matt Pocock. -->

Entreviste o Filipe sem trégua até chegarem a um entendimento comum. Organize o assunto como uma **árvore de decisões**: cada decisão abre as decisões que dependem dela.

## Como conduzir
Trabalhe em **rodadas**. A **fronteira** são as decisões cujos pré-requisitos já estão resolvidos — as perguntas que dá para fazer *agora* sem adivinhar respostas que ainda não vieram. Faça a fronteira inteira numa rodada: numere cada pergunta e dê a tua recomendação. Depois espere as respostas.

Formato de cada pergunta:

```
**P1 — <título>**: <a pergunta, com as opções se houver; pode ter mais de um parágrafo>

→ Recomendo: <tua resposta recomendada e o porquê em uma linha>

---
```

Escreva cada pergunta de modo que "sim" aceite a tua recomendação.

A cada rodada, as respostas mudam a árvore: decisões resolvidas empurram a fronteira e liberam as perguntas que dependiam delas. Recalcule e faça a próxima rodada. Pergunta que depende de outra ainda aberta na mesma rodada fica para depois.

**Fatos são trabalho teu, nunca do Filipe.** Se uma pergunta precisa de um fato que dá para descobrir (código, `CLAUDE.md`, banco em leitura, GitHub, dissertação no repo), descubra sozinho antes de perguntar. **Decisões são dele:** apresente e espere.

## No Raio-X
- Respeite os princípios metodológicos e as decisões já registradas no `CLAUDE.md`. Se o plano contraria uma delas, essa vira pergunta explícita, não suposição.
- Quando a decisão mexe em tipologia, prompt validado, corpus público ou dados históricos, diga isso na pergunta.

## Fim
A sabatina acaba quando a fronteira está vazia: todos os ramos visitados, nada assumido em silêncio. Mostre um resumo das decisões tomadas e **não execute nada** até o Filipe confirmar que o entendimento está fechado. Depois, registre as decisões onde o `CLAUDE.md` manda (Estado/Backlog ou `messages/REVISAO.md`).
