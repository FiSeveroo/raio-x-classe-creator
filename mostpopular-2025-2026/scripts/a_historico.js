/*
 * Item A — corpus histórico (FiSeveroo/coletor-youtube): lista geral mostPopular BR.
 * Uso: node scripts/a_historico.js    (Node 20+, sem dependências, sem chaves, sem cota)
 * Baixa o repo do coletor no commit fixo abaixo e gera CSVs e dados.json em saida/.
 * Datas: as do nome do arquivo (horário de Brasília).
 */
const fs = require("fs"), path = require("path"), { execSync } = require("child_process");

const COMMIT = "a41bdf02be32a55bc80703f6f6624e4fbfb363c4";
const REPO = "https://github.com/FiSeveroo/coletor-youtube.git";
const RAIZ = path.join(__dirname, "..");
const CACHE = path.join(RAIZ, ".cache", "coletor-youtube");
const SAIDA = path.join(RAIZ, "saida");
const CORTE = "2025-07-21";
const JANELA = ["2025-07-01", "2025-08-31"];
const NOME = { 1: "Filmes e animação", 2: "Automóveis", 10: "Música", 15: "Animais", 17: "Esportes", 18: "Curtas", 19: "Viagens", 20: "Jogos", 22: "Pessoas e blogs", 23: "Comédia", 24: "Entretenimento", 25: "Notícias e política", 26: "Tutoriais e estilo", 27: "Educação", 28: "Ciência e tecnologia", 29: "Ativismo" };

if (!fs.existsSync(path.join(CACHE, ".git"))) {
  fs.mkdirSync(CACHE, { recursive: true });
  for (const c of ["git init -q", `git fetch -q --depth 1 ${REPO} ${COMMIT}`, "git checkout -q FETCH_HEAD"]) execSync(c, { cwd: CACHE, stdio: "inherit" });
}

function parseCsv(t) {
  const linhas = []; let campo = "", linha = [], q = false;
  t = t.replace(/^﻿/, "");
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { campo += '"'; i++; } else q = false; } else campo += c; }
    else if (c === '"') q = true;
    else if (c === ",") { linha.push(campo); campo = ""; }
    else if (c === "\n") { linha.push(campo.replace(/\r$/, "")); linhas.push(linha); linha = []; campo = ""; }
    else campo += c;
  }
  if (campo !== "" || linha.length) { linha.push(campo); linhas.push(linha); }
  return linhas;
}
const q = (x) => { x = String(x ?? ""); return /[",\n]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x; };
const csv = (f, h, rows) => fs.writeFileSync(path.join(SAIDA, f), "﻿" + [h, ...rows].map((r) => r.map(q).join(",")).join("\n") + "\n");
const pc = (a, b) => (b ? (100 * a) / b : null);
const f1 = (x) => (x == null ? "" : x.toFixed(2));
const med = (a) => { if (!a.length) return null; a = [...a].sort((x, y) => x - y); const n = a.length; return n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2; };
const metade = (cont) => { const v = Object.values(cont).sort((a, b) => b - a), T = v.reduce((a, b) => a + b, 0); let s = 0, n = 0; for (const x of v) { s += x; n++; if (2 * s >= T) break; } return n; };
const isoSem = (d) => { const t = new Date(d + "T00:00:00Z"); const dia = (t.getUTCDay() + 6) % 7; t.setUTCDate(t.getUTCDate() - dia); return t.toISOString().slice(0, 10); };

// Leitura
const arquivos = fs.readdirSync(CACHE).filter((f) => /^\d{4}-\d{2}-\d{2}_\d{2}h\d{2}m\.csv$/.test(f)).sort();
const coletas = [], qual = { sem_categoria: 0, sem_video: 0, sem_canal: 0, repetidos_na_coleta: 0, colunas_erradas: 0 };
for (const f of arquivos) {
  const L = parseCsv(fs.readFileSync(path.join(CACHE, f), "utf8")).filter((l) => l.length > 1);
  const h = L[0], iC = h.indexOf("Categoria do vídeo"), iV = h.indexOf("Id do vídeo"), iId = h.indexOf("Id do canal"), iN = h.indexOf("Canal");
  const vistos = new Set(), itens = [];
  for (const l of L.slice(1)) {
    if (l.length !== h.length) qual.colunas_erradas++;
    const it = { cat: l[iC]?.trim(), video: l[iV]?.trim(), canal: l[iId]?.trim(), nome: l[iN]?.trim() };
    if (!it.cat) qual.sem_categoria++; if (!it.video) qual.sem_video++; if (!it.canal) qual.sem_canal++;
    if (vistos.has(it.video)) qual.repetidos_na_coleta++; vistos.add(it.video);
    itens.push(it);
  }
  coletas.push({ arq: f, data: f.slice(0, 10), mes: f.slice(0, 7), hora: f.slice(11, 13) + ":" + f.slice(14, 16), itens });
}

function resumo(cs) {
  const cat = {}, can = {}, nomes = {}, vid = new Set(); let n = 0; const porColeta = [];
  for (const c of cs) { const cc = {}; for (const i of c.itens) { n++; cat[i.cat] = (cat[i.cat] ?? 0) + 1; can[i.canal] = (can[i.canal] ?? 0) + 1; cc[i.canal] = (cc[i.canal] ?? 0) + 1; nomes[i.canal] = i.nome; vid.add(i.video); } porColeta.push(metade(cc)); }
  return { coletas: cs.length, n, cat, can, nomes, videos: vid.size, canais: Object.keys(can).length, metade_conjunto: metade(can), metade_por_coleta_mediana: med(porColeta) };
}
const conta = (c, ks) => c.itens.filter((i) => ks.includes(i.cat)).length;
fs.mkdirSync(path.join(SAIDA, "graficos"), { recursive: true });

// A1 mensal
const meses = [...new Set(coletas.map((c) => c.mes))], m = {};
for (const k of meses) m[k] = resumo(coletas.filter((c) => c.mes === k));
csv("A1_resumo_mensal.csv", ["mes", "coletas", "aparicoes", "videos_distintos", "canais_distintos", "canais_metade_mediana_por_coleta", "canais_metade_no_mes"], meses.map((k) => [k, m[k].coletas, m[k].n, m[k].videos, m[k].canais, m[k].metade_por_coleta_mediana, m[k].metade_conjunto]));
const r1 = [];
for (const k of meses) for (const [c, n] of Object.entries(m[k].cat).sort((a, b) => b[1] - a[1])) r1.push([k, c, NOME[c] ?? "", n, f1(pc(n, m[k].n))]);
csv("A1_composicao_mensal.csv", ["mes", "category_id", "categoria", "aparicoes", "pct"], r1);

// A2 semanal jun-set/2025, diário 01/07-15/08/2025, por coleta jul-ago
const ES = ["17"], NO = ["25"], JM = ["10", "20"];
const linha = (cs) => { const t = cs.reduce((a, c) => a + c.itens.length, 0), e = cs.reduce((a, c) => a + conta(c, ES), 0), n = cs.reduce((a, c) => a + conta(c, NO), 0), j = cs.reduce((a, c) => a + conta(c, JM), 0); return { col: cs.length, t, e, n, j, pe: pc(e, t), pn: pc(n, t), pj: pc(j, t) }; };
const sem = [...new Set(coletas.filter((c) => c.data >= "2025-06-01" && c.data <= "2025-09-30").map((c) => isoSem(c.data)))];
const semanal = sem.map((s) => [s, linha(coletas.filter((c) => isoSem(c.data) === s && c.data >= "2025-06-01" && c.data <= "2025-09-30"))]);
csv("A2_semanal_jun_set_2025.csv", ["semana_inicio_segunda", "coletas", "aparicoes", "esportes", "pct_esportes", "noticias", "pct_noticias", "jogos_musica", "pct_jogos_musica"], semanal.map(([s, l]) => [s, l.col, l.t, l.e, f1(l.pe), l.n, f1(l.pn), l.j, f1(l.pj)]));
const dias = []; for (let d = Date.UTC(2025, 6, 1); d <= Date.UTC(2025, 7, 15); d += 864e5) dias.push(new Date(d).toISOString().slice(0, 10));
const diario = dias.map((d) => [d, linha(coletas.filter((c) => c.data === d))]);
csv("A2_diario_01jul_15ago_2025.csv", ["data", "coletas", "aparicoes", "esportes", "pct_esportes", "noticias", "pct_noticias", "jogos_musica", "pct_jogos_musica"], diario.map(([d, l]) => [d, l.col, l.t, l.e, f1(l.pe), l.n, f1(l.pn), l.j, f1(l.pj)]));
const jan = coletas.filter((c) => c.data >= "2025-06-15" && c.data <= "2025-08-31");
csv("A2_por_coleta_15jun_31ago_2025.csv", ["arquivo", "data", "hora_brasilia", "aparicoes", "esportes", "noticias", "jogos_musica"], jan.map((c) => [c.arq, c.data, c.hora, c.itens.length, conta(c, ES), conta(c, NO), conta(c, JM)]));
const trechos = [["2025-06-01", "2025-06-30"], ["2025-07-01", "2025-07-09"], ["2025-07-10", "2025-07-20"], ["2025-07-21", "2025-07-31"], ["2025-08-01", "2025-08-15"], ["2025-08-16", "2025-08-31"]].map(([a, b]) => ({ a, b, ...linha(coletas.filter((c) => c.data >= a && c.data <= b)) }));
csv("A2_trechos.csv", ["de", "ate", "coletas", "aparicoes", "esportes", "pct_esportes", "noticias", "pct_noticias", "jogos_musica", "pct_jogos_musica"], trechos.map((l) => [l.a, l.b, l.col, l.t, l.e, f1(l.pe), l.n, f1(l.pn), l.j, f1(l.pj)]));

// A3 antes/depois
const gr = {
  antes_corte: coletas.filter((c) => c.data < CORTE), depois_corte: coletas.filter((c) => c.data >= CORTE),
  antes_sem_janela: coletas.filter((c) => c.data < JANELA[0]), depois_sem_janela: coletas.filter((c) => c.data > JANELA[1]),
  antes_01ago_reconciliacao: coletas.filter((c) => c.data < "2025-08-01"), depois_01ago_reconciliacao: coletas.filter((c) => c.data >= "2025-08-01"),
};
const R = {}; for (const k in gr) R[k] = resumo(gr[k]);
csv("A3_resumo_antes_depois.csv", ["grupo", "de", "ate", "coletas", "aparicoes", "videos_distintos", "canais_distintos", "canais_metade_mediana_por_coleta", "canais_metade_no_periodo"], Object.keys(gr).map((k) => [k, gr[k][0].data, gr[k].at(-1).data, R[k].coletas, R[k].n, R[k].videos, R[k].canais, R[k].metade_por_coleta_mediana, R[k].metade_conjunto]));
const cats = [...new Set(Object.values(R).flatMap((r) => Object.keys(r.cat)))].sort((a, b) => (R.antes_corte.cat[b] ?? 0) - (R.antes_corte.cat[a] ?? 0));
csv("A3_categorias_antes_depois.csv", ["category_id", "categoria", ...Object.keys(gr).flatMap((k) => [k + "_n", k + "_pct"])], cats.map((c) => [c, NOME[c] ?? "", ...Object.keys(gr).flatMap((k) => [R[k].cat[c] ?? 0, f1(pc(R[k].cat[c] ?? 0, R[k].n))])]));
const top = [];
for (const k in gr) Object.entries(R[k].can).sort((a, b) => b[1] - a[1]).slice(0, 30).forEach(([id, n], i) => top.push([k, i + 1, id, R[k].nomes[id], n, f1(pc(n, R[k].n))]));
csv("A3_canais_mais_frequentes.csv", ["grupo", "posicao", "canal_id", "canal", "aparicoes", "pct"], top);

const totDias = new Set(coletas.map((c) => c.data)).size;
const dados = { commit: COMMIT, primeiro: arquivos[0], ultimo: arquivos.at(-1), coletas: coletas.length, dias_com_coleta: totDias, qual, itens: coletas.reduce((a, c) => a + c.itens.length, 0),
  mensal: meses.map((k) => ({ mes: k, coletas: m[k].coletas, n: m[k].n, videos: m[k].videos, canais: m[k].canais, metade: m[k].metade_por_coleta_mediana, metade_mes: m[k].metade_conjunto, es: pc(m[k].cat["17"] ?? 0, m[k].n), no: pc(m[k].cat["25"] ?? 0, m[k].n), jm: pc((m[k].cat["10"] ?? 0) + (m[k].cat["20"] ?? 0), m[k].n) })),
  transicao: coletas.filter((c) => c.data >= "2025-07-20" && c.data <= "2025-07-26").map((c) => ({ arq: c.arq, es: conta(c, ES), no: conta(c, NO), jm: conta(c, JM) })),
  semanal: semanal.map(([s, l]) => ({ s, ...l })), diario: diario.map(([d, l]) => ({ d, ...l })), trechos,
  grupos: Object.fromEntries(Object.keys(R).map((k) => [k, { de: gr[k][0].data, ate: gr[k].at(-1).data, coletas: R[k].coletas, n: R[k].n, videos: R[k].videos, canais: R[k].canais, metade_por_coleta: R[k].metade_por_coleta_mediana, metade_conjunto: R[k].metade_conjunto, cat: R[k].cat, top: Object.entries(R[k].can).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([id, n]) => ({ nome: R[k].nomes[id], n })) }])) };
fs.writeFileSync(path.join(SAIDA, "A_dados.json"), JSON.stringify(dados, null, 1));
console.log("ok", dados.coletas, "coletas", dados.itens, "itens", JSON.stringify(qual));
