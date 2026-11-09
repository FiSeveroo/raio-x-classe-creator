/*
 * Item A — gera RELATORIO_A.txt e os gráficos SVG a partir de saida/A_dados.json.
 * Uso: node scripts/a_historico.js && node scripts/a_relatorio.js
 */
const fs = require("fs"), path = require("path");
const SAIDA = path.join(__dirname, "..", "saida");
const d = JSON.parse(fs.readFileSync(path.join(SAIDA, "A_dados.json"), "utf8"));
const G = d.grupos;
const NOME = { 1: "Filmes e animação", 2: "Automóveis", 10: "Música", 15: "Animais", 17: "Esportes", 19: "Viagens", 20: "Jogos", 22: "Pessoas e blogs", 23: "Comédia", 24: "Entretenimento", 25: "Notícias e política", 26: "Tutoriais e estilo", 27: "Educação", 28: "Ciência e tecnologia", 29: "Ativismo" };
const br = (x, n = 1) => x.toFixed(n).replace(".", ",");
const mil = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const p = (g, c) => (100 * (g.cat[c] ?? 0)) / g.n;
const jm = (g) => p(g, "10") + p(g, "20");

// Gráficos: cores validadas com scripts/validate_palette.js da skill dataviz (superfície clara)
const COR = { es: "#2a78d6", no: "#eb6834", jm: "#1baf7a", vid: "#6250d6", can: "#008300", tinta: "#0b0b0b", sec: "#52514e", grade: "#e4e3df", fundo: "#fcfcfb" };
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
function linhas({ arq, titulo, sub, xs, rotX, series, yMax, yPasso, yFmt, marcas = [], nota }) {
  const W = 1000, H = 560, m = { e: 62, d: 170, t: 118, b: 78 }, iw = W - m.e - m.d, ih = H - m.t - m.b;
  const X = (i) => m.e + (i * iw) / (xs.length - 1), Y = (v) => m.t + ih - (v * ih) / yMax;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="Arial, Helvetica, sans-serif"><rect width="${W}" height="${H}" fill="${COR.fundo}"/>`;
  s += `<text x="${m.e}" y="36" font-size="22" font-weight="700" fill="${COR.tinta}">${esc(titulo)}</text><text x="${m.e}" y="60" font-size="14" fill="${COR.sec}">${esc(sub)}</text>`;
  let lx = m.e;
  for (const c of series) { s += `<rect x="${lx}" y="74" width="14" height="4" rx="2" fill="${c.cor}"/><text x="${lx + 20}" y="81" font-size="13" fill="${COR.tinta}">${esc(c.nome)}</text>`; lx += 34 + c.nome.length * 7.2; }
  for (let v = 0; v <= yMax; v += yPasso) s += `<line x1="${m.e}" x2="${m.e + iw}" y1="${Y(v)}" y2="${Y(v)}" stroke="${COR.grade}"/><text x="${m.e - 10}" y="${Y(v) + 4}" font-size="12" text-anchor="end" fill="${COR.sec}">${yFmt(v)}</text>`;
  xs.forEach((x, i) => { const r = rotX(x, i); if (r) s += `<text x="${X(i)}" y="${m.t + ih + 22}" font-size="12" text-anchor="middle" fill="${COR.sec}">${r}</text>`; });
  for (const k of marcas) { const i = xs.indexOf(k.x); s += `<line x1="${X(i)}" x2="${X(i)}" y1="${m.t}" y2="${m.t + ih}" stroke="${COR.tinta}" stroke-dasharray="4 4"/><text x="${X(i) + (k.lado === "e" ? -6 : 6)}" y="${m.t + 14 + (k.y ?? 0)}" font-size="12" text-anchor="${k.lado === "e" ? "end" : "start"}" fill="${COR.tinta}">${esc(k.txt)}</text>`; }
  const usados = [];
  for (const c of series) {
    s += `<polyline fill="none" stroke="${c.cor}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" points="${c.v.map((v, i) => X(i).toFixed(1) + "," + Y(v).toFixed(1)).join(" ")}"/>`;
    c.v.forEach((v, i) => { s += `<circle cx="${X(i).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="7" fill="transparent"><title>${esc(xs[i])} · ${esc(c.nome)}: ${esc(c.fmt(v))}</title></circle>`; });
    let y = Y(c.v.at(-1)) + 4; while (usados.some((u) => Math.abs(u - y) < 16)) y -= 16; usados.push(y);
    s += `<circle cx="${X(xs.length - 1)}" cy="${Y(c.v.at(-1))}" r="4" fill="${c.cor}"/><text x="${m.e + iw + 12}" y="${y}" font-size="13" fill="${COR.tinta}">${esc(c.rot)}</text>`;
  }
  s += `<text x="${m.e}" y="${H - 18}" font-size="12" fill="${COR.sec}">${esc(nota)}</text></svg>`;
  fs.writeFileSync(path.join(SAIDA, "graficos", arq), s);
}
const MES = ["", "jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const mesRot = (m) => MES[+m.slice(5)] + "/" + m.slice(2, 4);
const FONTE = "Fonte: FiSeveroo/coletor-youtube (commit " + d.commit.slice(0, 7) + "), categoria declarada na coleta.";
const num = (v) => String(v);
linhas({
  arq: "A_diario_jul_ago_2025.svg", titulo: "A queda de Esportes e Notícias foi súbita, em 23/07/2025", sub: "Vídeos por dia na lista geral mostPopular BR (2 coletas, 100 aparições), 01/07 a 15/08/2025",
  xs: d.diario.map((x) => x.d), rotX: (x, i) => (i % 5 === 0 ? x.slice(8) + "/" + x.slice(5, 7) : ""), yMax: 100, yPasso: 20, yFmt: num,
  series: [{ nome: "Esportes", cor: COR.es, v: d.diario.map((x) => x.e), rot: "Esportes", fmt: num }, { nome: "Notícias e política", cor: COR.no, v: d.diario.map((x) => x.n), rot: "Notícias", fmt: num }, { nome: "Jogos + Música", cor: COR.jm, v: d.diario.map((x) => x.j), rot: "Jogos + Música", fmt: num }],
  marcas: [{ x: "2025-07-21", txt: "21/07: vigência anunciada", lado: "e" }, { x: "2025-07-23", txt: "23/07: virada entre duas coletas", lado: "d" }], nota: FONTE,
});
const pc1 = (v) => br(v) + "%";
linhas({
  arq: "A_mensal_composicao.svg", titulo: "Jogos e Música dobram; Esportes e Notícias somem do geral", sub: "% das aparições na lista geral por categoria declarada, por mês (mar/25 e nov/26 parciais)",
  xs: d.mensal.map((m) => m.mes), rotX: (x, i) => (i % 2 === 0 ? mesRot(x) : ""), yMax: 100, yPasso: 20, yFmt: (v) => v + "%",
  series: [{ nome: "Esportes", cor: COR.es, v: d.mensal.map((m) => m.es), rot: "Esportes", fmt: pc1 }, { nome: "Notícias e política", cor: COR.no, v: d.mensal.map((m) => m.no), rot: "Notícias", fmt: pc1 }, { nome: "Jogos + Música", cor: COR.jm, v: d.mensal.map((m) => m.jm), rot: "Jogos + Música", fmt: pc1 }],
  marcas: [{ x: "2025-07", txt: "jul/25", lado: "d" }], nota: FONTE,
});
const compl = d.mensal.slice(1, -1);
linhas({
  arq: "A_mensal_diversidade.svg", titulo: "Depois da mudança, mais vídeos e canais diferentes passam pelo geral", sub: "Vídeos e canais distintos por mês na lista geral (só meses completos)",
  xs: compl.map((m) => m.mes), rotX: (x, i) => (i % 2 === 0 ? mesRot(x) : ""), yMax: 2000, yPasso: 500, yFmt: (v) => mil(v),
  series: [{ nome: "Vídeos distintos", cor: COR.vid, v: compl.map((m) => m.videos), rot: "Vídeos", fmt: mil }, { nome: "Canais distintos", cor: COR.can, v: compl.map((m) => m.canais), rot: "Canais", fmt: mil }],
  marcas: [{ x: "2025-07", txt: "jul/25", lado: "d" }], nota: FONTE,
});

// Relatório
const L = [], w = (s = "") => L.push(s);
const A = G.antes_corte, B = G.depois_corte, A2 = G.antes_sem_janela, B2 = G.depois_sem_janela, A3 = G.antes_01ago_reconciliacao, B3 = G.depois_01ago_reconciliacao;
const tr = (a) => d.trechos.find((t) => t.a === a);
const trc = (arq) => d.transicao.find((t) => t.arq === arq);
const antes = trc("2025-07-23_05h14m.csv"), dep = trc("2025-07-23_17h10m.csv");
const med2 = (ms) => { const a = ms.map((m) => m.metade_mes).sort((x, y) => x - y), n = a.length; return n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2; };
const mApre = d.mensal.filter((m) => m.mes >= "2025-04" && m.mes <= "2025-06"), mPos = d.mensal.filter((m) => m.mes >= "2025-09" && m.mes <= "2026-10");
const mediaM = (a, f) => a.reduce((s, m) => s + m[f], 0) / a.length;
w("RAIO-X — ITEM A: CORPUS HISTÓRICO DA LISTA GERAL mostPopular (BR)");
w("Gerado por scripts/a_historico.js e scripts/a_relatorio.js. Só leitura, sem IA, sem cota da YouTube API.");
w();
w("FONTE E RECORTE");
w(`Fonte única: repositório FiSeveroo/coletor-youtube, commit ${d.commit}.`);
w(`${d.coletas} coletas (CSV), de ${d.primeiro} a ${d.ultimo}, ${mil(d.itens)} aparições. Datas no horário de Brasília (nome do arquivo).`);
w(`Qualidade: ${d.qual.sem_categoria} linhas sem categoria, ${d.qual.repetidos_na_coleta} vídeos repetidos dentro de uma coleta, ${d.qual.colunas_erradas} linhas malformadas.`);
w("Categoria: a declarada no momento da coleta (coluna \"Categoria do vídeo\" = snippet.categoryId).");
w("Marco de 21/07/2025: data de vigência informada pelo Filipe (nota de 10/07/2025 no revision history da API); não conferida neste script.");
w();
w("[MEDIÇÃO DIRETA] A QUEDA É SÚBITA E DOIS DIAS DEPOIS DE 21/07");
w("Fonte: A2_por_coleta_15jun_31ago_2025.csv, A2_diario_01jul_15ago_2025.csv, A2_trechos.csv");
w(`- Coleta de 23/07/2025 às 05h14: Esportes ${antes.es}, Notícias ${antes.no}, Jogos+Música ${antes.jm}, de 50.`);
w(`- Coleta de 23/07/2025 às 17h10: Esportes ${dep.es}, Notícias ${dep.no}, Jogos+Música ${dep.jm}, de 50.`);
w("- 21/07 e 22/07 seguem no padrão anterior (Esportes 23 e 25 por dia, de 100). A queda não começou antes de 21/07.");
w("- Antes disso, não há tendência de queda em julho: Esportes oscila de 12 a 34 por dia entre 01/07 e 20/07.");
w();
w("Trecho                  coletas  Esportes        Notícias       Jogos+Música");
for (const t of d.trechos) w(`${t.a} a ${t.b}  ${String(t.col).padStart(4)}   ${String(t.e).padStart(4)} (${br(t.pe).padStart(5)}%)   ${String(t.n).padStart(3)} (${br(t.pn).padStart(4)}%)   ${br(t.pj).padStart(5)}%`);
w();
w("Depois da virada, Esportes não voltou ao patamar anterior: de ago/2025 em diante o maior mês tem " + br(Math.max(...d.mensal.filter((m) => m.mes >= "2025-08").map((m) => m.es))) + "%. Notícias tem máximo mensal de " + br(Math.max(...d.mensal.filter((m) => m.mes >= "2025-08").map((m) => m.no))) + "%.");
w("Fonte: A1_composicao_mensal.csv");
w();
w("[MEDIÇÃO DIRETA] ANTES E DEPOIS");
w("Fonte: A3_categorias_antes_depois.csv, A3_resumo_antes_depois.csv");
const lin = (rot, a, b) => w(`${rot.padEnd(36)} ${br(p(a, "17")).padStart(5)}% → ${br(p(b, "17")).padStart(4)}%   ${br(p(a, "25")).padStart(4)}% → ${br(p(b, "25")).padStart(4)}%   ${br(jm(a)).padStart(5)}% → ${br(jm(b)).padStart(5)}%`);
w("Corte                                Esportes           Notícias          Jogos+Música");
lin("21/07/2025 (principal)", A, B);
lin("Sem a janela 01/07–31/08/2025", A2, B2);
lin("01/08/2025 (reconcilia 23,4% e 37%)", A3, B3);
w();
w("Categorias, corte principal (antes → depois):");
for (const c of Object.keys(A.cat).concat(Object.keys(B.cat)).filter((x, i, a) => a.indexOf(x) === i).sort((x, y) => p(B, y) - p(B, x))) if (Math.max(p(A, c), p(B, c)) >= 0.5) w(`  ${(NOME[c] ?? c).padEnd(24)} ${br(p(A, c)).padStart(5)}% → ${br(p(B, c)).padStart(5)}%`);
w();
w(`Antes: ${A.de} a ${A.ate}, ${A.coletas} coletas. Depois: ${B.de} a ${B.ate}, ${B.coletas} coletas.`);
w();
w("Canais mais frequentes (aparições):");
w("  Antes:  " + A.top.slice(0, 8).map((x) => `${x.nome} ${x.n}`).join("; "));
w("  Depois: " + B.top.slice(0, 8).map((x) => `${x.nome} ${x.n}`).join("; "));
w("Fonte: A3_canais_mais_frequentes.csv");
w();
w("[MEDIÇÃO DIRETA] CONCENTRAÇÃO: NÃO AUMENTOU");
w("Fonte: A1_resumo_mensal.csv, A3_resumo_antes_depois.csv");
w(`- Por coleta, canais que somam metade da lista (mediana): ${A.metade_por_coleta} antes, ${B.metade_por_coleta} depois. 25 é o máximo possível numa lista de 50: cada canal aparece só uma vez nessa metade.`);
w(`- Por mês (abr–jun/2025 contra set/2025–out/2026): canais que somam metade das aparições, mediana ${med2(mApre)} contra ${med2(mPos)}.`);
w(`- Média mensal de vídeos distintos: ${mil(Math.round(mediaM(mApre, "videos")))} contra ${mil(Math.round(mediaM(mPos, "videos")))}. Canais distintos: ${Math.round(mediaM(mApre, "canais"))} contra ${Math.round(mediaM(mPos, "canais"))}.`);
w("- Comparar os totais dos períodos inteiros (" + A.metade_conjunto + " e " + B.metade_conjunto + " canais) é enviesado: o período depois é cerca de 3 vezes mais longo.");
w();
w("LEITURA");
w("Os dados sustentam que a lista mudou de natureza: troca abrupta de composição, com Esportes e Notícias saindo e Jogos e Música dobrando.");
w("Os dados NÃO sustentam \"estreita\" no sentido de menos canais ou mais concentração: o giro aumentou. A lista ficou estreita em tipos de conteúdo, não em quantidade de canais.");
w();
w("LIMITAÇÕES");
w("- Mar/2025 começa no dia 5 e nov/2026 termina no dia 8.");
w("- Faltam 11 coletas em 614 dias (coletas por mês em A1_resumo_mensal.csv); nenhuma dentro de 01/07 a 15/08/2025.");
w("- Coincidência temporal com o anúncio não prova causa; o que se mede é o momento da mudança.");
w("- Um único país (BR) e uma única fonte; a virada não foi cruzada com o Raio-X, que só começa em 2026.");
fs.writeFileSync(path.join(SAIDA, "RELATORIO_A.txt"), L.join("\n") + "\n");
console.log(L.join("\n"));
