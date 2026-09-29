/*
 * ==============================================================================
 * RAIO-X CLASSE CREATOR — TIPOLOGIA OFICIAL
 * ==============================================================================
 *
 * Porte literal de tipologia.py (repo legado). É a "constituição" da ferramenta.
 *
 * Fonte teórica: SEVERO, Filipe Machado Leal. "O Novo 'You' do YouTube: a ascensão
 * dos produtores plataformizados e a falência da promessa participativa no Brasil."
 * Dissertação (Mestrado) — PUCRS / FAMECOS, 2026. Capítulo 4.2.
 *
 * A tipologia é DUPLA, MUTUAMENTE EXCLUSIVA e EXAUSTIVA:
 *   - EIXO A: Tipologia de Produtor (quem controla a produção?)
 *   - EIXO B: Tipologia de Conteúdo (qual é o gênero do trabalho?)
 *
 * REGRAS DESTE ARQUIVO
 * - `codigo` é o valor gravado no Supabase. Nunca renomear.
 * - `nome.pt`, `definicao.pt` e `sinais` são cópia exata do tipologia.py e
 *   alimentam os prompts do Claude. Qualquer mudança aqui deve espelhar o
 *   tipologia.py (e vice-versa) — o coletor Python usa o arquivo de lá.
 * - `nome.en/es` e `definicao.en/es` servem só para EXIBIÇÃO. Traduções
 *   sugeridas, pendentes de revisão (ver messages/REVISAO.md).
 * ==============================================================================
 */

import type { Locale } from "@/i18n/routing";

type Traduzido = Record<Locale, string>;

export type Categoria = {
  codigo: string;
  nome: Traduzido;
  definicao: Traduzido;
  /** Pistas observáveis para o LLM. Só PT — usado em prompt, não exibido. */
  sinais: string;
};

// ==============================================================================
// EIXO A — TIPOLOGIA DE PRODUTOR
// ==============================================================================
// Critérios de classificação (Severo, 2026, p. 61-62):
//   - origem institucional
//   - estrutura de produção
//   - intencionalidade comunicativa
// ==============================================================================

export const PRODUTORES: Categoria[] = [
  {
    codigo: "midia_tradicional",
    nome: {
      pt: "Mídia tradicional",
      en: "Traditional media",
      es: "Medios tradicionales",
    },
    definicao: {
      pt:
        "Canais vinculados a empresas de mídia tradicionais (TV, rádio, jornais). " +
        "Inclui também canais derivados ou de nicho desses grupos (ex.: canais " +
        "específicos para programas, editorias ou emissoras afiliadas).",
      en:
        "Channels linked to traditional media companies (TV, radio, newspapers). " +
        "Also includes derivative or niche channels of these groups (e.g., channels " +
        "dedicated to specific shows, desks, or affiliate stations).",
      es:
        "Canales vinculados a empresas de medios tradicionales (TV, radio, periódicos). " +
        "Incluye también canales derivados o de nicho de esos grupos (ej.: canales " +
        "específicos de programas, secciones o emisoras afiliadas).",
    },
    sinais:
      "Vinculação explícita a grandes grupos (Globo, Record, SBT, Band, UOL, Folha, " +
      "Estadão, R7, GZH, Jovem Pan, CNN Brasil, etc.); selo de verificação institucional; " +
      "menção a programas televisivos, jornais impressos ou emissoras de rádio; " +
      "produção noticiosa com padrão broadcast; nomes de canal como 'ge', 'gshow', " +
      "'globoplay', 'JN', 'Mesa Redonda', etc.",
  },
  {
    codigo: "produtora_digital",
    nome: {
      pt: "Produtora digital",
      en: "Digital production company",
      es: "Productora digital",
    },
    definicao: {
      pt:
        "Produtoras nativas digitais, redes multicanais (MCNs), estúdios independentes " +
        "e farms de conteúdo. Operam com equipes profissionalizadas mas não pertencem " +
        "à mídia legada. Frequentemente operam múltiplos canais coordenados. " +
        "A MARCA/EMPRESA é o produto — não uma persona individual.",
      en:
        "Digital-native production companies, multi-channel networks (MCNs), independent " +
        "studios, and content farms. They operate with professionalized teams but do not " +
        "belong to legacy media. They often run multiple coordinated channels. " +
        "The BRAND/COMPANY is the product — not an individual persona.",
      es:
        "Productoras nativas digitales, redes multicanal (MCNs), estudios independientes " +
        "y granjas de contenido. Operan con equipos profesionalizados pero no pertenecen " +
        "a los medios tradicionales. A menudo operan múltiples canales coordinados. " +
        "La MARCA/EMPRESA es el producto — no una persona individual.",
    },
    sinais:
      "EXEMPLOS CANÔNICOS BR: CazéTV, Flow (Flow Sport Club, Flow Podcast, Flow News), " +
      "Desimpedidos, Porta dos Fundos, Choque de Cultura, Manual do Mundo, " +
      "Kondzilla (como produtora), Galo Frito, Cazé TV, Band Sports, SporTV, " +
      "Jovem Pan Sports, Studio Dreamers, A Fórmula, Virgula, Tá Querendo, " +
      "Escolinha do Bichão, Os Virgulinos. " +
      "SINAIS ESTRUTURAIS: nome do canal é uma marca/empresa (não o nome de uma pessoa); " +
      "equipe creditada na descrição ou nos créditos; múltiplos canais sob mesma " +
      "marca/CNPJ/grupo (ex.: canal principal + 'Cortes de X' + canal temático); " +
      "produção audiovisual de alto valor com identidade visual corporativa nativa digital; " +
      "site próprio da empresa citado; contato comercial/assessoria na bio. " +
      "FRONTEIRA COM YouTuber profissional: se o canal gira em torno de UMA pessoa " +
      "reconhecível como a 'estrela' (ex.: Whindersson, Felipe Neto, Casimiro) → " +
      "é YouTuber Profissional, mesmo que tenha equipe grande. Se o canal existiria " +
      "sem aquela pessoa (ex.: Flow continuaria sem um apresentador específico) → " +
      "é Produtora Digital.",
  },
  {
    codigo: "youtuber_profissional",
    nome: {
      pt: "YouTuber profissional",
      en: "Professional YouTuber",
      es: "YouTuber profesional",
    },
    definicao: {
      pt:
        "Criadores individuais ou grupos/coletivos profissionalizados que operam como " +
        "empresas de mídia. Possuem regularidade de postagem, equipe (mesmo que grande), " +
        "monetização consolidada e tratam o canal como atividade econômica principal. " +
        "A PERSONA INDIVIDUAL é o produto central — o canal não existiria sem ela.",
      en:
        "Professionalized individual creators or groups/collectives that operate as " +
        "media companies. They post regularly, have a team (even a large one), " +
        "consolidated monetization, and treat the channel as their main economic activity. " +
        "The INDIVIDUAL PERSONA is the core product — the channel would not exist without it.",
      es:
        "Creadores individuales o grupos/colectivos profesionalizados que operan como " +
        "empresas de medios. Publican con regularidad, tienen equipo (aunque sea grande), " +
        "monetización consolidada y tratan el canal como actividad económica principal. " +
        "La PERSONA INDIVIDUAL es el producto central — el canal no existiría sin ella.",
    },
    sinais:
      "EXEMPLOS CANÔNICOS BR: Whindersson Nunes, Felipe Neto, Casimiro (Casimito), " +
      "Natan por Aí, Alanzoka, Cellbit, Gaules, Luccas Neto, Rezende Evil, " +
      "Enaldinho, Jovem Nerd, Tata Estaniecki, Yudi Tamashiro, Virgínia Fonseca. " +
      "SINAIS ESTRUTURAIS: nome do canal É o nome da pessoa (ou apelido/persona); " +
      "o rosto/voz do criador é onipresente no conteúdo; mesmo com equipe de dezenas " +
      "de pessoas, o canal é indissociável daquele indivíduo; presença cross-plataforma " +
      "sob o mesmo nome pessoal (Instagram, TikTok, Twitter); merchandising pessoal. " +
      "FRONTEIRA COM Produtora Digital: se retirar a pessoa e o canal ainda faz sentido " +
      "como marca → é Produtora. Se retirar a pessoa e o canal deixa de existir → " +
      "é YouTuber Profissional, independente do tamanho da equipe.",
  },
  {
    codigo: "criador_casual",
    nome: {
      pt: "Criador casual",
      en: "Casual creator",
      es: "Creador casual",
    },
    definicao: {
      pt:
        "Amadores em transição para formatos mais estruturados, mas sem plena " +
        "profissionalização. Postam com alguma regularidade, demonstram intenção " +
        "de crescer, mas ainda não vivem do canal.",
      en:
        "Amateurs transitioning to more structured formats, but without full " +
        "professionalization. They post with some regularity and show an intention " +
        "to grow, but do not yet make a living from the channel.",
      es:
        "Aficionados en transición hacia formatos más estructurados, pero sin plena " +
        "profesionalización. Publican con cierta regularidad y muestran intención " +
        "de crecer, pero aún no viven del canal.",
    },
    sinais:
      "Produção visivelmente caseira mas com esforço de edição; periodicidade irregular; " +
      "ausência de equipe; baixa monetização aparente; descrição menciona aspirações " +
      "ou apelos a inscrição/apoio; nicho específico mantido por uma pessoa só.",
  },
  {
    codigo: "usuario_comum",
    nome: {
      pt: "Usuário comum",
      en: "Ordinary user",
      es: "Usuario común",
    },
    definicao: {
      pt:
        "Publicações amadoras sem intenção profissional ou regularidade. Uploads " +
        "esporádicos, sem busca por audiência ou monetização. É o 'You' original " +
        "do Broadcast Yourself que, conforme a dissertação demonstra, está " +
        "estatisticamente extinto no topo da plataforma.",
      en:
        "Amateur uploads with no professional intent or regularity. Sporadic uploads, " +
        "with no pursuit of audience or monetization. This is the original 'You' " +
        "of Broadcast Yourself which, as the dissertation shows, is " +
        "statistically extinct at the top of the platform.",
      es:
        "Publicaciones amateurs sin intención profesional ni regularidad. Subidas " +
        "esporádicas, sin búsqueda de audiencia ni monetización. Es el 'You' original " +
        "del Broadcast Yourself que, como demuestra la disertación, está " +
        "estadísticamente extinto en la cima de la plataforma.",
    },
    sinais:
      "Canal sem branding; poucos vídeos; nenhum padrão de postagem; títulos " +
      "descritivos sem otimização; ausência total de chamadas para inscrição; " +
      "vídeos que parecem registros pessoais sem intenção comercial.",
  },
  {
    codigo: "instituicao",
    nome: {
      pt: "Instituições públicas e sociais",
      en: "Public and social institutions",
      es: "Instituciones públicas y sociales",
    },
    definicao: {
      pt:
        "Canais de órgãos governamentais, ONGs, universidades, sindicatos, partidos, " +
        "movimentos sociais, coletivos sem fins lucrativos, e entidades que REGULAM " +
        "ou GOVERNAM uma atividade reconhecida socialmente (federações, confederações, " +
        "ligas esportivas oficiais). A entidade transcende os indivíduos e existe para " +
        "organizar a vida coletiva, não para gerar lucro direto ou divulgar produtos.",
      en:
        "Channels of government bodies, NGOs, universities, unions, political parties, " +
        "social movements, non-profit collectives, and entities that REGULATE " +
        "or GOVERN a socially recognized activity (federations, confederations, " +
        "official sports leagues). The entity transcends individuals and exists to " +
        "organize collective life, not to generate direct profit or promote products.",
      es:
        "Canales de órganos gubernamentales, ONGs, universidades, sindicatos, partidos, " +
        "movimientos sociales, colectivos sin fines de lucro y entidades que REGULAN " +
        "o GOBIERNAN una actividad socialmente reconocida (federaciones, confederaciones, " +
        "ligas deportivas oficiales). La entidad trasciende a los individuos y existe para " +
        "organizar la vida colectiva, no para generar lucro directo ni promocionar productos.",
    },
    sinais:
      "ENTIDADES REGULADORAS ESPORTIVAS: CONMEBOL, LALIGA, FIFA, CBF, Federações " +
      "estaduais, Confederações (CBV, CBB), Volleyball World, Paulistão, ligas " +
      "oficiais reconhecidas. " +
      "ENTIDADES PÚBLICAS: Governo Federal/Estadual/Municipal, ministérios, " +
      "autarquias, tribunais; universidades (UFRGS, USP, UFRJ, etc.); " +
      "ENTIDADES SOCIAIS: ONGs reconhecidas; sindicatos e centrais (CUT, Força " +
      "Sindical); partidos políticos; movimentos sociais. " +
      "ATENÇÃO — NÃO É INSTITUIÇÃO: clubes de futebol (são Marcas Comerciais); " +
      "ligas criadas por influenciadores/empresas de entretenimento (são Produtoras); " +
      "empresas patrocinadoras de ligas (são Marcas).",
  },
  {
    codigo: "musico",
    nome: {
      pt: "Músicos e bandas",
      en: "Musicians and bands",
      es: "Músicos y bandas",
    },
    definicao: {
      pt:
        "Canais oficiais de artistas, bandas e gravadoras, incluindo selos " +
        "independentes, que publicam clipes, músicas e conteúdos relacionados " +
        "à carreira artística. Inclui projetos de curadoria musical com identidade " +
        "artística própria — mesmo sem artista humano identificável — quando o canal " +
        "produz experiência sonora/visual original e consistente (lofi, ambient, " +
        "folk curation, gospel autoral, etc.).",
      en:
        "Official channels of artists, bands, and record labels, including independent " +
        "labels, that publish music videos, songs, and content related to their " +
        "artistic careers. Includes music curation projects with their own artistic " +
        "identity — even without an identifiable human artist — when the channel " +
        "produces an original and consistent sound/visual experience (lofi, ambient, " +
        "folk curation, original gospel, etc.).",
      es:
        "Canales oficiales de artistas, bandas y discográficas, incluidos sellos " +
        "independientes, que publican videoclips, canciones y contenidos relacionados " +
        "con la carrera artística. Incluye proyectos de curaduría musical con identidad " +
        "artística propia — incluso sin artista humano identificable — cuando el canal " +
        "produce una experiencia sonora/visual original y consistente (lofi, ambient, " +
        "folk curation, gospel de autor, etc.).",
    },
    sinais:
      "CANAL OFICIAL DE ARTISTA: verificação Artista do YouTube; vínculo com gravadoras " +
      "(Sony, Universal, Warner, Som Livre); discografia; videoclipes oficiais; VEVO; ISRCs. " +
      "PROJETO DE CURADORIA MUSICAL COM IDENTIDADE PRÓPRIA: nome artístico próprio do canal; " +
      "produz experiência visual+sonora consistente com estética definida (lofi, ambient, " +
      "cinematic folk, gospel autoral); descreve mood específico; curadoria editorial clara " +
      "— não agrega músicas aleatórias. Ex: lofi channels, Haven222, nature sounds com " +
      "identidade visual, selos digitais independentes. " +
      "NÃO É MÚSICO: canal que compila músicas de terceiros (gospel, sertanejo, pagode) " +
      "sem identidade artística própria → Reaproveitamento.",
  },
  {
    codigo: "marca",
    nome: {
      pt: "Marcas comerciais",
      en: "Commercial brands",
      es: "Marcas comerciales",
    },
    definicao: {
      pt:
        "Empresas não midiáticas que utilizam o YouTube para marketing, branding " +
        "e relacionamento com consumidores. O YouTube não é o produto — é canal " +
        "de divulgação do negócio principal que existe fora da plataforma. " +
        "Inclui clubes esportivos (que usam o canal para vender a marca do clube) " +
        "e empresas de jogos/entretenimento que usam esports para divulgar seu produto.",
      en:
        "Non-media companies that use YouTube for marketing, branding, " +
        "and customer relations. YouTube is not the product — it is a channel " +
        "for promoting the core business that exists outside the platform. " +
        "Includes sports clubs (which use the channel to sell the club's brand) " +
        "and gaming/entertainment companies that use esports to promote their product.",
      es:
        "Empresas no mediáticas que utilizan YouTube para marketing, branding " +
        "y relación con los consumidores. YouTube no es el producto — es un canal " +
        "de difusión del negocio principal que existe fuera de la plataforma. " +
        "Incluye clubes deportivos (que usan el canal para vender la marca del club) " +
        "y empresas de juegos/entretenimiento que usan esports para promocionar su producto.",
    },
    sinais:
      "TESTE DECISIVO: O conteúdo existe para divulgar algo que existe fora do YouTube? " +
      "Se SIM → Marca Comercial. " +
      "EMPRESAS GERAIS: Magazine Luiza, Natura, Itaú, Ambev, montadoras, moda, " +
      "Apple, Netflix, streaming services. " +
      "CLUBES ESPORTIVOS (sempre Marca): Flamengo TV, Botafogo TV, Corinthians TV, " +
      "TV Palmeiras, Santos FC, São Paulo FC, Grêmio, Cruzeiro, Vasco TV — o canal " +
      "existe para vender o clube, não para governar o esporte. " +
      "EMPRESAS DE JOGOS usando esports p/ divulgar produto: VALORANT Esports BR " +
      "(Riot Games), EA SPORTS FC, Genshin Impact, Brawl Stars, Clash of Clans, " +
      "Free Fire Esports, Minecraft, Resident Evil, Street Fighter. " +
      "FRANQUIAS E EVENTOS COMERCIAIS: UFC Brasil (vende eventos), FORMULA 1 " +
      "(produto comercial), Kings League NÃO (é produtora — campeonato existe " +
      "para gerar conteúdo, não o contrário).",
  },
  {
    codigo: "reaproveitamento",
    nome: {
      pt: "Reaproveitamento e pirataria",
      en: "Repurposing and piracy",
      es: "Reaprovechamiento y piratería",
    },
    definicao: {
      pt:
        "Canais que agregam, compilam ou republicam conteúdo de terceiros como produto " +
        "principal, com ou sem autorização formal. A produção própria é mínima — o valor " +
        "está na seleção/agregação, não na criação. Inclui compilações musicais, rips de " +
        "TV, dublagens não autorizadas e cortes sem vínculo com o canal original.",
      en:
        "Channels that aggregate, compile, or republish third-party content as their main " +
        "product, with or without formal authorization. Original production is minimal — the " +
        "value lies in selection/aggregation, not creation. Includes music compilations, TV " +
        "rips, unauthorized dubs, and clips with no link to the original channel.",
      es:
        "Canales que agregan, compilan o republican contenido de terceros como producto " +
        "principal, con o sin autorización formal. La producción propia es mínima — el valor " +
        "está en la selección/agregación, no en la creación. Incluye compilaciones musicales, " +
        "rips de TV, doblajes no autorizados y recortes sin vínculo con el canal original.",
    },
    sinais:
      "SINAL PRINCIPAL: canal não produz conteúdo original — agrega músicas ou vídeos " +
      "de terceiros. COMPILAÇÕES MUSICAIS (mesmo profissionais): 'melhores hinos " +
      "evangélicos', 'top sertanejo', 'louvores gospel', 'músicas para dormir' que " +
      "reúnem músicas de outros artistas. A embalagem profissional NÃO exclui: farms " +
      "de conteúdo gospel/sertanejo/pagode são Reaproveitamento mesmo com descrição " +
      "organizada e hashtags. OUTROS SINAIS: foco em 'os melhores X' sem produção " +
      "própria; ausência de artista vinculado ao canal; conteúdo não produzido pelo " +
      "canal. DISTINÇÃO COM MÚSICO: identidade artística própria + produção original " +
      "→ Músico. Agregação temática de terceiros → Reaproveitamento.",
  },
  {
    codigo: "outros",
    nome: {
      pt: "Outros usos",
      en: "Other uses",
      es: "Otros usos",
    },
    definicao: {
      pt:
        "Canais de acervo pessoal, arquivos, uploads técnicos, bots, ou qualquer " +
        "caso residual que não se enquadre nas categorias anteriores. Use APENAS " +
        "quando nenhuma outra categoria for aplicável.",
      en:
        "Personal archive channels, archives, technical uploads, bots, or any " +
        "residual case that does not fit the previous categories. Use ONLY " +
        "when no other category applies.",
      es:
        "Canales de acervo personal, archivos, subidas técnicas, bots o cualquier " +
        "caso residual que no encaje en las categorías anteriores. Usar SOLO " +
        "cuando ninguna otra categoría sea aplicable.",
    },
    sinais:
      "Acervos históricos pessoais; uploads automatizados (câmeras de monitoramento, " +
      "transmissões institucionais sem curadoria); arquivos de família; " +
      "experimentos técnicos; canais sem propósito comunicacional discernível.",
  },
];

// ==============================================================================
// EIXO B — TIPOLOGIA DE CONTEÚDO
// ==============================================================================
// Inspirada em Burgess & Green (2018), Cunningham & Craig (2017),
// Morcillo et al. (2019), Tolson (2010). Adaptada para garantir
// exclusividade mútua e cobertura exaustiva (Severo, 2026, p. 62-63).
// ==============================================================================

export const CONTEUDOS: Categoria[] = [
  {
    codigo: "informativo",
    nome: { pt: "Informativo", en: "Informative", es: "Informativo" },
    definicao: {
      pt:
        "Vídeos com função informativa e factual: reportagens, boletins, comentários " +
        "noticiosos, entrevistas jornalísticas, análises de fatos do dia.",
      en:
        "Videos with an informative and factual function: reports, bulletins, news " +
        "commentary, journalistic interviews, analyses of the day's events.",
      es:
        "Videos con función informativa y factual: reportajes, boletines, comentarios " +
        "noticiosos, entrevistas periodísticas, análisis de hechos del día.",
    },
    sinais:
      "Notícias, factualidade, fontes citadas, telejornalismo adaptado ao YouTube, " +
      "podcasts noticiosos em vídeo, entrevistas com autoridades, lives de cobertura, " +
      "comentaristas políticos/econômicos, debates noticiosos.",
  },
  {
    codigo: "entretenimento_roteirizado",
    nome: {
      pt: "Entretenimento roteirizado",
      en: "Scripted entertainment",
      es: "Entretenimiento guionizado",
    },
    definicao: {
      pt:
        "Produções planejadas com roteiro pré-definido, voltadas ao entretenimento. " +
        "Inclui esquetes, séries web, programas de humor, ficção, conteúdos com " +
        "encenação e direção artística, mesmo quando simulam espontaneidade.",
      en:
        "Planned productions with a predefined script, aimed at entertainment. " +
        "Includes sketches, web series, comedy shows, fiction, and content with " +
        "staging and artistic direction, even when simulating spontaneity.",
      es:
        "Producciones planificadas con guion predefinido, orientadas al entretenimiento. " +
        "Incluye sketches, series web, programas de humor, ficción y contenidos con " +
        "puesta en escena y dirección artística, incluso cuando simulan espontaneidad.",
    },
    sinais:
      "Roteiro evidente; encenação; cenário planejado; pós-produção elaborada; " +
      "humor produzido; quadros recorrentes; reality shows; programas de auditório " +
      "adaptados ou nativos; até 'vlogs falsos' que reencenam autenticidade.",
  },
  {
    codigo: "jogos",
    nome: { pt: "Jogos eletrônicos", en: "Video games", es: "Videojuegos" },
    definicao: {
      pt:
        "Vídeos centrados na experiência de jogo: gameplays comentadas ou não, " +
        "speedruns, machinimas, desafios dentro de jogos, análises e reviews.",
      en:
        "Videos centered on the gaming experience: gameplay with or without commentary, " +
        "speedruns, machinima, in-game challenges, analyses, and reviews.",
      es:
        "Videos centrados en la experiencia de juego: gameplays comentados o no, " +
        "speedruns, machinimas, desafíos dentro de juegos, análisis y reseñas.",
    },
    sinais:
      "Gameplay; comentários sobre jogos; Minecraft, Roblox, FIFA, GTA, Free Fire; " +
      "lives de jogo; speedruns; análises de mecânicas; reações a trailers de games; " +
      "machinimas; tutoriais de gameplay.",
  },
  {
    codigo: "esportivo",
    nome: { pt: "Esportivo", en: "Sports", es: "Deportivo" },
    definicao: {
      pt:
        "Vídeos que exibem, analisam ou narram eventos esportivos: partidas, melhores " +
        "momentos, bastidores, análises pós-jogo, programas esportivos. Não confundir " +
        "com Jogos eletrônicos (videogames).",
      en:
        "Videos that show, analyze, or narrate sporting events: matches, highlights, " +
        "behind the scenes, post-game analyses, sports shows. Not to be confused " +
        "with Video games.",
      es:
        "Videos que exhiben, analizan o narran eventos deportivos: partidos, mejores " +
        "momentos, detrás de escena, análisis post-partido, programas deportivos. No " +
        "confundir con Videojuegos.",
    },
    sinais:
      "Futebol, basquete, MMA, fórmula 1, vôlei, tênis; melhores momentos; análises " +
      "táticas; transmissões ao vivo de jogos; bastidores de equipes; mesa redonda " +
      "esportiva; cobertura de campeonatos.",
  },
  {
    codigo: "musical",
    nome: { pt: "Musical", en: "Music", es: "Musical" },
    definicao: {
      pt:
        "Videoclipes oficiais, apresentações, lyric videos, lançamentos musicais, " +
        "covers e shows. O foco é a música como obra audiovisual.",
      en:
        "Official music videos, performances, lyric videos, music releases, " +
        "covers, and concerts. The focus is music as an audiovisual work.",
      es:
        "Videoclips oficiales, presentaciones, lyric videos, lanzamientos musicales, " +
        "covers y conciertos. El foco es la música como obra audiovisual.",
    },
    sinais:
      "Clipe musical; performance ao vivo; lyric video; áudio oficial; cifras com " +
      "performance; covers; lançamentos de single/álbum; trilhas; integração com " +
      "YouTube Music; sertanejo, funk, pop, rap, gospel.",
  },
  {
    codigo: "promocional",
    nome: { pt: "Promocional", en: "Promotional", es: "Promocional" },
    definicao: {
      pt:
        "Vídeos cujo objetivo é promover marcas, produtos ou serviços. Anúncios, " +
        "trailers, demonstrações de produto, branded content explícito, lançamentos.",
      en:
        "Videos whose goal is to promote brands, products, or services. Ads, " +
        "trailers, product demos, explicit branded content, launches.",
      es:
        "Videos cuyo objetivo es promocionar marcas, productos o servicios. Anuncios, " +
        "tráilers, demostraciones de producto, branded content explícito, lanzamientos.",
    },
    sinais:
      "Comercial; trailer; teaser; unboxing patrocinado; lançamento de produto; " +
      "campanha publicitária; vídeo institucional; demo de software/serviço.",
  },
  {
    codigo: "vlog",
    nome: { pt: "Vlog", en: "Vlog", es: "Vlog" },
    definicao: {
      pt:
        "Narrativas centradas na figura do criador, de caráter autobiográfico ou " +
        "relacional. Mostram rotina, opiniões, experiências pessoais. Mesmo quando " +
        "roteirizados, mantêm a estética de espontaneidade do diário em vídeo.",
      en:
        "Narratives centered on the creator, autobiographical or relational in " +
        "character. They show routines, opinions, personal experiences. Even when " +
        "scripted, they keep the aesthetic of spontaneity of the video diary.",
      es:
        "Narrativas centradas en la figura del creador, de carácter autobiográfico o " +
        "relacional. Muestran rutina, opiniones, experiencias personales. Incluso cuando " +
        "están guionizados, mantienen la estética de espontaneidad del diario en video.",
    },
    sinais:
      "'Um dia na minha vida'; rotina; storytelling pessoal; câmera na mão; " +
      "narração em primeira pessoa; conteúdo confessional; viagens pessoais; " +
      "opiniões sobre o cotidiano; relação parassocial central.",
  },
  {
    codigo: "educativo",
    nome: { pt: "Educativo", en: "Educational", es: "Educativo" },
    definicao: {
      pt:
        "Aulas, tutoriais e vídeos explicativos. Função primária é transmitir " +
        "conhecimento ou ensinar uma habilidade específica.",
      en:
        "Lessons, tutorials, and explainer videos. The primary function is to convey " +
        "knowledge or teach a specific skill.",
      es:
        "Clases, tutoriales y videos explicativos. La función principal es transmitir " +
        "conocimiento o enseñar una habilidad específica.",
    },
    sinais:
      "Aula; tutorial; 'como fazer'; explicação de conceito; videoaulas escolares " +
      "ou universitárias; cursos; passo a passo técnico; documentários didáticos; " +
      "ENEM/vestibular; programação; idiomas.",
  },
  {
    codigo: "experimental",
    nome: { pt: "Experimental", en: "Experimental", es: "Experimental" },
    definicao: {
      pt:
        "Narrativas não convencionais, híbridas ou que desafiam classificações " +
        "tradicionais. Conteúdos artísticos, video-arte, formatos novos sem encaixe " +
        "nas categorias estabelecidas.",
      en:
        "Unconventional or hybrid narratives, or ones that defy traditional " +
        "classifications. Artistic content, video art, new formats that do not fit " +
        "established categories.",
      es:
        "Narrativas no convencionales, híbridas o que desafían clasificaciones " +
        "tradicionales. Contenidos artísticos, videoarte, formatos nuevos sin encaje " +
        "en las categorías establecidas.",
    },
    sinais:
      "Linguagem audiovisual não convencional; arte digital; ASMR como obra; " +
      "ensaios visuais; formatos híbridos; manifestos audiovisuais; " +
      "experiências sensoriais sem narrativa clássica.",
  },
  {
    codigo: "outros",
    nome: { pt: "Outros", en: "Other", es: "Otros" },
    definicao: {
      pt:
        "Casos residuais que não se enquadram nos tipos anteriores. Use APENAS " +
        "quando nenhuma outra categoria for aplicável.",
      en:
        "Residual cases that do not fit the previous types. Use ONLY " +
        "when no other category applies.",
      es:
        "Casos residuales que no encajan en los tipos anteriores. Usar SOLO " +
        "cuando ninguna otra categoría sea aplicable.",
    },
    sinais:
      "Conteúdos sem propósito comunicativo claro; uploads técnicos sem narrativa; " +
      "registros sem categorização possível.",
  },
];

// ==============================================================================
// UTILITÁRIOS DE ACESSO
// ==============================================================================

export const codigosProdutor = () => PRODUTORES.map((c) => c.codigo);
export const codigosConteudo = () => CONTEUDOS.map((c) => c.codigo);

export const buscarProdutor = (codigo: string) =>
  PRODUTORES.find((c) => c.codigo === codigo);
export const buscarConteudo = (codigo: string) =>
  CONTEUDOS.find((c) => c.codigo === codigo);

/** Nome exibível; se o código não existir na tipologia, mostra o código cru. */
export const nomeProdutor = (codigo: string, locale: Locale) =>
  buscarProdutor(codigo)?.nome[locale] ?? codigo;
export const nomeConteudo = (codigo: string, locale: Locale) =>
  buscarConteudo(codigo)?.nome[locale] ?? codigo;

/**
 * tipologia_para_prompt() — renderiza a tipologia em texto plano para o
 * prompt do LLM. Saída idêntica à do Python (sempre em PT).
 */
export function tipologiaParaPrompt(): string {
  const linhas = ["EIXO A — TIPOLOGIA DE PRODUTOR (quem controla a produção?)\n"];
  for (const c of PRODUTORES) {
    linhas.push(`\n[${c.codigo}] ${c.nome.pt}`);
    linhas.push(`  Definição: ${c.definicao.pt}`);
    linhas.push(`  Sinais observáveis: ${c.sinais}`);
  }
  linhas.push("\n\nEIXO B — TIPOLOGIA DE CONTEÚDO (qual é o gênero do trabalho?)\n");
  for (const c of CONTEUDOS) {
    linhas.push(`\n[${c.codigo}] ${c.nome.pt}`);
    linhas.push(`  Definição: ${c.definicao.pt}`);
    linhas.push(`  Sinais observáveis: ${c.sinais}`);
  }
  return linhas.join("\n");
}
