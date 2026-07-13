# 📚 Corpus Público do Observatório Classe Creator

## Snapshot gerado em 13/07/2026 às 09:31 UTC

Este diretório contém o corpus completo do Raio-X Classe Creator em formato
CSV, atualizado semanalmente (segundas-feiras) via GitHub Actions.

**Total de registros neste snapshot:** 47,549

## Tabelas exportadas

| Tabela | Registros | Descrição |
|---|---:|---|
| `snapshots.csv` | 96 | Cabeçalho dos snapshots semanais do Termômetro |
| `videos_snapshot.csv` | 47,327 | Vídeos do trending classificados (Termômetro) |
| `classificacoes_video.csv` | 12 | Análises individuais de vídeos (Lupa) |
| `dossies_canal.csv` | 10 | Investigações estruturais de canais (Dossiê) |
| `buscas_narrativa.csv` | 2 | Cabeçalho de auditorias temáticas (Disputa) |
| `resultados_busca.csv` | 100 | Resultados detalhados das auditorias temáticas |
| `analises_comentarios.csv` | 2 | Análises qualitativas de comentários (Voz da Base) |


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

- **Ferramenta:** https://raio-x-classe-creator.streamlit.app
- **Tipologia dupla:** Eixo A (Produtor) × Eixo B (Conteúdo)
- **Citação:** SEVERO, Filipe Machado Leal. *O Novo "You" do YouTube*.
  Dissertação (Mestrado em Comunicação) — PUCRS/FAMECOS, 2026.

## Licença

Estes dados são disponibilizados publicamente para fins de pesquisa
acadêmica, jornalística e de organização da sociedade civil. Ao usar,
cite a fonte conforme as referências acima.
