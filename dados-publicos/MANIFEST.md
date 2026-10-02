> **DESCONTINUADO em 02/10/2026 — não use estes arquivos para pesquisa.**
>
> Esta pasta está congelada no export de 28/09/2026 e está **incompleta**:
> `videos_snapshot.csv` foi cortado em 50.000 linhas (de ~131 mil), então as
> coletas mais recentes do Termômetro aparecem sem vídeos. As demais tabelas
> refletem o corpus de teste anterior ao reset de 01/10/2026.
>
> O corpus completo, conferido contra o banco, agora é publicado toda
> segunda-feira como **GitHub Release**:
> https://github.com/FiSeveroo/raio-x-classe-creator/releases
> (o mais recente: https://github.com/FiSeveroo/raio-x-classe-creator/releases/latest)

# 📚 Corpus Público do Observatório Classe Creator

## Snapshot gerado em 28/09/2026 às 13:14 UTC

Este diretório continha o corpus do Raio-X Classe Creator em formato
CSV, atualizado semanalmente (segundas-feiras) via GitHub Actions.

**Total de registros neste snapshot:** 50,750

## Tabelas exportadas

| Tabela | Registros | Descrição |
|---|---:|---|
| `snapshots.csv` | 251 | Cabeçalho dos snapshots semanais do Termômetro |
| `videos_snapshot.csv` | 50,000 | Vídeos do trending classificados (Termômetro) |
| `classificacoes_video.csv` | 18 | Análises individuais de vídeos (Lupa) |
| `dossies_canal.csv` | 18 | Investigações estruturais de canais (Dossiê) |
| `buscas_narrativa.csv` | 10 | Cabeçalho de auditorias temáticas (Disputa) |
| `resultados_busca.csv` | 450 | Resultados detalhados das auditorias temáticas |
| `analises_comentarios.csv` | 3 | Análises qualitativas de comentários (Voz da Base) |


## Como usar

Os arquivos seguem formato CSV padrão (UTF-8, quoted, separador vírgula).
Valores complexos (JSON aninhado) estão serializados como string JSON nas células.

```python
import pandas as pd
df = pd.read_csv('dossies_canal.csv')
print(df.head())
```

## Sobre o Raio-X Classe Creator

Ferramenta de auditoria algorítmica e pesquisa acadêmica do trabalho
plataformizado no YouTube, desenvolvida pelo Observatório Classe Creator
com metodologia ancorada em SEVERO (2026).

- **Ferramenta:** https://raiox.classecreator.com
- **Tipologia dupla:** Eixo A (Produtor) × Eixo B (Conteúdo)
- **Citação:** SEVERO, Filipe Machado Leal. *O Novo "You" do YouTube*.
  Dissertação (Mestrado em Comunicação) — PUCRS/FAMECOS, 2026.

## Licença

Estes dados são disponibilizados publicamente para fins de pesquisa
acadêmica, jornalística e de organização da sociedade civil. Ao usar,
cite a fonte conforme as referências acima.
