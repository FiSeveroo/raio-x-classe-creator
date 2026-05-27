"""
==============================================================================
RAIO-X CLASSE CREATOR — TIPOLOGIA OFICIAL
==============================================================================

Este arquivo é a "constituição" da ferramenta. Todas as classificações geradas
pelos 5 módulos do Raio-X Classe Creator são feitas a partir das definições
operacionais aqui registradas.

Fonte teórica: SEVERO, Filipe Machado Leal. "O Novo 'You' do YouTube: a ascensão
dos produtores plataformizados e a falência da promessa participativa no Brasil."
Dissertação (Mestrado) — PUCRS / FAMECOS, 2026. Capítulo 4.2.

A tipologia é DUPLA, MUTUAMENTE EXCLUSIVA e EXAUSTIVA:
  - EIXO A: Tipologia de Produtor (quem controla a produção?)
  - EIXO B: Tipologia de Conteúdo (qual é o gênero do trabalho?)

Cada categoria possui:
  - codigo: identificador curto, usado internamente (não renomear sem cuidado)
  - nome: rótulo apresentado ao usuário
  - definicao: definição operacional vinda da dissertação
  - sinais: pistas observáveis que ajudam o LLM a classificar

Para AJUSTAR a tipologia: edite as strings aqui, salve, faça push pro GitHub.
A ferramenta inteira se atualiza automaticamente.
==============================================================================
"""

from dataclasses import dataclass


@dataclass
class Categoria:
    codigo: str
    nome: str
    definicao: str
    sinais: str


# ==============================================================================
# EIXO A — TIPOLOGIA DE PRODUTOR
# ==============================================================================
# Critérios de classificação (Severo, 2026, p. 61-62):
#   - origem institucional
#   - estrutura de produção
#   - intencionalidade comunicativa
# ==============================================================================

PRODUTORES = [
    Categoria(
        codigo="midia_tradicional",
        nome="Mídia tradicional",
        definicao=(
            "Canais vinculados a empresas de mídia tradicionais (TV, rádio, jornais). "
            "Inclui também canais derivados ou de nicho desses grupos (ex.: canais "
            "específicos para programas, editorias ou emissoras afiliadas)."
        ),
        sinais=(
            "Vinculação explícita a grandes grupos (Globo, Record, SBT, Band, UOL, Folha, "
            "Estadão, R7, GZH, Jovem Pan, CNN Brasil, etc.); selo de verificação institucional; "
            "menção a programas televisivos, jornais impressos ou emissoras de rádio; "
            "produção noticiosa com padrão broadcast; nomes de canal como 'ge', 'gshow', "
            "'globoplay', 'JN', 'Mesa Redonda', etc."
        ),
    ),
    Categoria(
        codigo="produtora_digital",
        nome="Produtora digital",
        definicao=(
            "Produtoras nativas digitais, redes multicanais (MCNs), estúdios independentes "
            "e farms de conteúdo. Operam com equipes profissionalizadas mas não pertencem "
            "à mídia legada. Frequentemente operam múltiplos canais coordenados. "
            "A MARCA/EMPRESA é o produto — não uma persona individual."
        ),
        sinais=(
            "EXEMPLOS CANÔNICOS BR: CazéTV, Flow (Flow Sport Club, Flow Podcast, Flow News), "
            "Desimpedidos, Porta dos Fundos, Choque de Cultura, Manual do Mundo, "
            "Kondzilla (como produtora), Galo Frito, Cazé TV, Band Sports, SporTV, "
            "Jovem Pan Sports, Studio Dreamers, A Fórmula, Virgula, Tá Querendo, "
            "Escolinha do Bichão, Os Virgulinos. "
            "SINAIS ESTRUTURAIS: nome do canal é uma marca/empresa (não o nome de uma pessoa); "
            "equipe creditada na descrição ou nos créditos; múltiplos canais sob mesma "
            "marca/CNPJ/grupo (ex.: canal principal + 'Cortes de X' + canal temático); "
            "produção audiovisual de alto valor com identidade visual corporativa nativa digital; "
            "site próprio da empresa citado; contato comercial/assessoria na bio. "
            "FRONTEIRA COM YouTuber profissional: se o canal gira em torno de UMA pessoa "
            "reconhecível como a 'estrela' (ex.: Whindersson, Felipe Neto, Casimiro) → "
            "é YouTuber Profissional, mesmo que tenha equipe grande. Se o canal existiria "
            "sem aquela pessoa (ex.: Flow continuaria sem um apresentador específico) → "
            "é Produtora Digital."
        ),
    ),
    Categoria(
        codigo="youtuber_profissional",
        nome="YouTuber profissional",
        definicao=(
            "Criadores individuais ou grupos/coletivos profissionalizados que operam como "
            "empresas de mídia. Possuem regularidade de postagem, equipe (mesmo que grande), "
            "monetização consolidada e tratam o canal como atividade econômica principal. "
            "A PERSONA INDIVIDUAL é o produto central — o canal não existiria sem ela."
        ),
        sinais=(
            "EXEMPLOS CANÔNICOS BR: Whindersson Nunes, Felipe Neto, Casimiro (Casimito), "
            "Natan por Aí, Alanzoka, Cellbit, Gaules, Luccas Neto, Rezende Evil, "
            "Enaldinho, Jovem Nerd, Tata Estaniecki, Yudi Tamashiro, Virgínia Fonseca. "
            "SINAIS ESTRUTURAIS: nome do canal É o nome da pessoa (ou apelido/persona); "
            "o rosto/voz do criador é onipresente no conteúdo; mesmo com equipe de dezenas "
            "de pessoas, o canal é indissociável daquele indivíduo; presença cross-plataforma "
            "sob o mesmo nome pessoal (Instagram, TikTok, Twitter); merchandising pessoal. "
            "FRONTEIRA COM Produtora Digital: se retirar a pessoa e o canal ainda faz sentido "
            "como marca → é Produtora. Se retirar a pessoa e o canal deixa de existir → "
            "é YouTuber Profissional, independente do tamanho da equipe."
        ),
    ),
    Categoria(
        codigo="criador_casual",
        nome="Criador casual",
        definicao=(
            "Amadores em transição para formatos mais estruturados, mas sem plena "
            "profissionalização. Postam com alguma regularidade, demonstram intenção "
            "de crescer, mas ainda não vivem do canal."
        ),
        sinais=(
            "Produção visivelmente caseira mas com esforço de edição; periodicidade irregular; "
            "ausência de equipe; baixa monetização aparente; descrição menciona aspirações "
            "ou apelos a inscrição/apoio; nicho específico mantido por uma pessoa só."
        ),
    ),
    Categoria(
        codigo="usuario_comum",
        nome="Usuário comum",
        definicao=(
            "Publicações amadoras sem intenção profissional ou regularidade. Uploads "
            "esporádicos, sem busca por audiência ou monetização. É o 'You' original "
            "do Broadcast Yourself que, conforme a dissertação demonstra, está "
            "estatisticamente extinto no topo da plataforma."
        ),
        sinais=(
            "Canal sem branding; poucos vídeos; nenhum padrão de postagem; títulos "
            "descritivos sem otimização; ausência total de chamadas para inscrição; "
            "vídeos que parecem registros pessoais sem intenção comercial."
        ),
    ),
    Categoria(
        codigo="instituicao",
        nome="Instituições públicas e sociais",
        definicao=(
            "Canais de órgãos governamentais, ONGs, universidades, sindicatos, partidos, "
            "movimentos sociais, coletivos sem fins lucrativos, e entidades que REGULAM "
            "ou GOVERNAM uma atividade reconhecida socialmente (federações, confederações, "
            "ligas esportivas oficiais). A entidade transcende os indivíduos e existe para "
            "organizar a vida coletiva, não para gerar lucro direto ou divulgar produtos."
        ),
        sinais=(
            "ENTIDADES REGULADORAS ESPORTIVAS: CONMEBOL, LALIGA, FIFA, CBF, Federações "
            "estaduais, Confederações (CBV, CBB), Volleyball World, Paulistão, ligas "
            "oficiais reconhecidas. "
            "ENTIDADES PÚBLICAS: Governo Federal/Estadual/Municipal, ministérios, "
            "autarquias, tribunais; universidades (UFRGS, USP, UFRJ, etc.); "
            "ENTIDADES SOCIAIS: ONGs reconhecidas; sindicatos e centrais (CUT, Força "
            "Sindical); partidos políticos; movimentos sociais. "
            "ATENÇÃO — NÃO É INSTITUIÇÃO: clubes de futebol (são Marcas Comerciais); "
            "ligas criadas por influenciadores/empresas de entretenimento (são Produtoras); "
            "empresas patrocinadoras de ligas (são Marcas)."
        ),
    ),
    Categoria(
        codigo="musico",
        nome="Músicos e bandas",
        definicao=(
            "Canais oficiais de artistas, bandas e gravadoras, incluindo selos "
            "independentes, que publicam clipes, músicas e conteúdos relacionados "
            "à carreira artística. Inclui projetos de curadoria musical com identidade "
            "artística própria — mesmo sem artista humano identificável — quando o canal "
            "produz experiência sonora/visual original e consistente (lofi, ambient, "
            "folk curation, gospel autoral, etc.)."
        ),
        sinais=(
            "CANAL OFICIAL DE ARTISTA: verificação Artista do YouTube; vínculo com gravadoras "
            "(Sony, Universal, Warner, Som Livre); discografia; videoclipes oficiais; VEVO; ISRCs. "
            "PROJETO DE CURADORIA MUSICAL COM IDENTIDADE PRÓPRIA: nome artístico próprio do canal; "
            "produz experiência visual+sonora consistente com estética definida (lofi, ambient, "
            "cinematic folk, gospel autoral); descreve mood específico; curadoria editorial clara "
            "— não agrega músicas aleatórias. Ex: lofi channels, Haven222, nature sounds com "
            "identidade visual, selos digitais independentes. "
            "NÃO É MÚSICO: canal que compila músicas de terceiros (gospel, sertanejo, pagode) "
            "sem identidade artística própria → Reaproveitamento."
        ),
    ),
    Categoria(
        codigo="marca",
        nome="Marcas comerciais",
        definicao=(
            "Empresas não midiáticas que utilizam o YouTube para marketing, branding "
            "e relacionamento com consumidores. O YouTube não é o produto — é canal "
            "de divulgação do negócio principal que existe fora da plataforma. "
            "Inclui clubes esportivos (que usam o canal para vender a marca do clube) "
            "e empresas de jogos/entretenimento que usam esports para divulgar seu produto."
        ),
        sinais=(
            "TESTE DECISIVO: O conteúdo existe para divulgar algo que existe fora do YouTube? "
            "Se SIM → Marca Comercial. "
            "EMPRESAS GERAIS: Magazine Luiza, Natura, Itaú, Ambev, montadoras, moda, "
            "Apple, Netflix, streaming services. "
            "CLUBES ESPORTIVOS (sempre Marca): Flamengo TV, Botafogo TV, Corinthians TV, "
            "TV Palmeiras, Santos FC, São Paulo FC, Grêmio, Cruzeiro, Vasco TV — o canal "
            "existe para vender o clube, não para governar o esporte. "
            "EMPRESAS DE JOGOS usando esports p/ divulgar produto: VALORANT Esports BR "
            "(Riot Games), EA SPORTS FC, Genshin Impact, Brawl Stars, Clash of Clans, "
            "Free Fire Esports, Minecraft, Resident Evil, Street Fighter. "
            "FRANQUIAS E EVENTOS COMERCIAIS: UFC Brasil (vende eventos), FORMULA 1 "
            "(produto comercial), Kings League NÃO (é produtora — campeonato existe "
            "para gerar conteúdo, não o contrário)."
        ),
    ),
    Categoria(
        codigo="reaproveitamento",
        nome="Reaproveitamento e pirataria",
        definicao=(
            "Canais que agregam, compilam ou republicam conteúdo de terceiros como produto "
            "principal, com ou sem autorização formal. A produção própria é mínima — o valor "
            "está na seleção/agregação, não na criação. Inclui compilações musicais, rips de "
            "TV, dublagens não autorizadas e cortes sem vínculo com o canal original."
        ),
        sinais=(
            "SINAL PRINCIPAL: canal não produz conteúdo original — agrega músicas ou vídeos "
            "de terceiros. COMPILAÇÕES MUSICAIS (mesmo profissionais): 'melhores hinos "
            "evangélicos', 'top sertanejo', 'louvores gospel', 'músicas para dormir' que "
            "reúnem músicas de outros artistas. A embalagem profissional NÃO exclui: farms "
            "de conteúdo gospel/sertanejo/pagode são Reaproveitamento mesmo com descrição "
            "organizada e hashtags. OUTROS SINAIS: foco em 'os melhores X' sem produção "
            "própria; ausência de artista vinculado ao canal; conteúdo não produzido pelo "
            "canal. DISTINÇÃO COM MÚSICO: identidade artística própria + produção original "
            "→ Músico. Agregação temática de terceiros → Reaproveitamento."
        ),
    ),
    Categoria(
        codigo="outros",
        nome="Outros usos",
        definicao=(
            "Canais de acervo pessoal, arquivos, uploads técnicos, bots, ou qualquer "
            "caso residual que não se enquadre nas categorias anteriores. Use APENAS "
            "quando nenhuma outra categoria for aplicável."
        ),
        sinais=(
            "Acervos históricos pessoais; uploads automatizados (câmeras de monitoramento, "
            "transmissões institucionais sem curadoria); arquivos de família; "
            "experimentos técnicos; canais sem propósito comunicacional discernível."
        ),
    ),
]


# ==============================================================================
# EIXO B — TIPOLOGIA DE CONTEÚDO
# ==============================================================================
# Inspirada em Burgess & Green (2018), Cunningham & Craig (2017),
# Morcillo et al. (2019), Tolson (2010). Adaptada para garantir
# exclusividade mútua e cobertura exaustiva (Severo, 2026, p. 62-63).
# ==============================================================================

CONTEUDOS = [
    Categoria(
        codigo="informativo",
        nome="Informativo",
        definicao=(
            "Vídeos com função informativa e factual: reportagens, boletins, comentários "
            "noticiosos, entrevistas jornalísticas, análises de fatos do dia."
        ),
        sinais=(
            "Notícias, factualidade, fontes citadas, telejornalismo adaptado ao YouTube, "
            "podcasts noticiosos em vídeo, entrevistas com autoridades, lives de cobertura, "
            "comentaristas políticos/econômicos, debates noticiosos."
        ),
    ),
    Categoria(
        codigo="entretenimento_roteirizado",
        nome="Entretenimento roteirizado",
        definicao=(
            "Produções planejadas com roteiro pré-definido, voltadas ao entretenimento. "
            "Inclui esquetes, séries web, programas de humor, ficção, conteúdos com "
            "encenação e direção artística, mesmo quando simulam espontaneidade."
        ),
        sinais=(
            "Roteiro evidente; encenação; cenário planejado; pós-produção elaborada; "
            "humor produzido; quadros recorrentes; reality shows; programas de auditório "
            "adaptados ou nativos; até 'vlogs falsos' que reencenam autenticidade."
        ),
    ),
    Categoria(
        codigo="jogos",
        nome="Jogos eletrônicos",
        definicao=(
            "Vídeos centrados na experiência de jogo: gameplays comentadas ou não, "
            "speedruns, machinimas, desafios dentro de jogos, análises e reviews."
        ),
        sinais=(
            "Gameplay; comentários sobre jogos; Minecraft, Roblox, FIFA, GTA, Free Fire; "
            "lives de jogo; speedruns; análises de mecânicas; reações a trailers de games; "
            "machinimas; tutoriais de gameplay."
        ),
    ),
    Categoria(
        codigo="esportivo",
        nome="Esportivo",
        definicao=(
            "Vídeos que exibem, analisam ou narram eventos esportivos: partidas, melhores "
            "momentos, bastidores, análises pós-jogo, programas esportivos. Não confundir "
            "com Jogos eletrônicos (videogames)."
        ),
        sinais=(
            "Futebol, basquete, MMA, fórmula 1, vôlei, tênis; melhores momentos; análises "
            "táticas; transmissões ao vivo de jogos; bastidores de equipes; mesa redonda "
            "esportiva; cobertura de campeonatos."
        ),
    ),
    Categoria(
        codigo="musical",
        nome="Musical",
        definicao=(
            "Videoclipes oficiais, apresentações, lyric videos, lançamentos musicais, "
            "covers e shows. O foco é a música como obra audiovisual."
        ),
        sinais=(
            "Clipe musical; performance ao vivo; lyric video; áudio oficial; cifras com "
            "performance; covers; lançamentos de single/álbum; trilhas; integração com "
            "YouTube Music; sertanejo, funk, pop, rap, gospel."
        ),
    ),
    Categoria(
        codigo="promocional",
        nome="Promocional",
        definicao=(
            "Vídeos cujo objetivo é promover marcas, produtos ou serviços. Anúncios, "
            "trailers, demonstrações de produto, branded content explícito, lançamentos."
        ),
        sinais=(
            "Comercial; trailer; teaser; unboxing patrocinado; lançamento de produto; "
            "campanha publicitária; vídeo institucional; demo de software/serviço."
        ),
    ),
    Categoria(
        codigo="vlog",
        nome="Vlog",
        definicao=(
            "Narrativas centradas na figura do criador, de caráter autobiográfico ou "
            "relacional. Mostram rotina, opiniões, experiências pessoais. Mesmo quando "
            "roteirizados, mantêm a estética de espontaneidade do diário em vídeo."
        ),
        sinais=(
            "'Um dia na minha vida'; rotina; storytelling pessoal; câmera na mão; "
            "narração em primeira pessoa; conteúdo confessional; viagens pessoais; "
            "opiniões sobre o cotidiano; relação parassocial central."
        ),
    ),
    Categoria(
        codigo="educativo",
        nome="Educativo",
        definicao=(
            "Aulas, tutoriais e vídeos explicativos. Função primária é transmitir "
            "conhecimento ou ensinar uma habilidade específica."
        ),
        sinais=(
            "Aula; tutorial; 'como fazer'; explicação de conceito; videoaulas escolares "
            "ou universitárias; cursos; passo a passo técnico; documentários didáticos; "
            "ENEM/vestibular; programação; idiomas."
        ),
    ),
    Categoria(
        codigo="experimental",
        nome="Experimental",
        definicao=(
            "Narrativas não convencionais, híbridas ou que desafiam classificações "
            "tradicionais. Conteúdos artísticos, video-arte, formatos novos sem encaixe "
            "nas categorias estabelecidas."
        ),
        sinais=(
            "Linguagem audiovisual não convencional; arte digital; ASMR como obra; "
            "ensaios visuais; formatos híbridos; manifestos audiovisuais; "
            "experiências sensoriais sem narrativa clássica."
        ),
    ),
    Categoria(
        codigo="outros",
        nome="Outros",
        definicao=(
            "Casos residuais que não se enquadram nos tipos anteriores. Use APENAS "
            "quando nenhuma outra categoria for aplicável."
        ),
        sinais=(
            "Conteúdos sem propósito comunicativo claro; uploads técnicos sem narrativa; "
            "registros sem categorização possível."
        ),
    ),
]


# ==============================================================================
# UTILITÁRIOS DE ACESSO
# ==============================================================================
# Funções auxiliares para o resto da ferramenta consultar a tipologia.
# ==============================================================================

def codigos_produtor() -> list[str]:
    """Lista todos os códigos válidos do Eixo A (Produtor)."""
    return [c.codigo for c in PRODUTORES]


def codigos_conteudo() -> list[str]:
    """Lista todos os códigos válidos do Eixo B (Conteúdo)."""
    return [c.codigo for c in CONTEUDOS]


def buscar_produtor(codigo: str) -> Categoria | None:
    """Retorna o objeto Categoria do Eixo A pelo código, ou None."""
    return next((c for c in PRODUTORES if c.codigo == codigo), None)


def buscar_conteudo(codigo: str) -> Categoria | None:
    """Retorna o objeto Categoria do Eixo B pelo código, ou None."""
    return next((c for c in CONTEUDOS if c.codigo == codigo), None)


def tipologia_para_prompt() -> str:
    """
    Renderiza a tipologia inteira em texto plano, formatada para ser
    inserida no prompt do LLM. Esta é a forma como o Claude "vê"
    a constituição da ferramenta.
    """
    linhas = ["EIXO A — TIPOLOGIA DE PRODUTOR (quem controla a produção?)\n"]
    for c in PRODUTORES:
        linhas.append(f"\n[{c.codigo}] {c.nome}")
        linhas.append(f"  Definição: {c.definicao}")
        linhas.append(f"  Sinais observáveis: {c.sinais}")

    linhas.append("\n\nEIXO B — TIPOLOGIA DE CONTEÚDO (qual é o gênero do trabalho?)\n")
    for c in CONTEUDOS:
        linhas.append(f"\n[{c.codigo}] {c.nome}")
        linhas.append(f"  Definição: {c.definicao}")
        linhas.append(f"  Sinais observáveis: {c.sinais}")

    return "\n".join(linhas)
