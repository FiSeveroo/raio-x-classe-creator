import { getFormatter, getTranslations } from "next-intl/server";
import { SectionTitle } from "@/components/brand/Brand";
import { Barras } from "@/components/barras";
import { MapaCalor } from "@/components/graficos";
import { Metricas } from "@/components/metricas";
import type { Locale } from "@/i18n/routing";
import { resumosParaProjeto, type ResumoAnalise } from "@/lib/corpus";
import type { ItemProjeto, Projeto } from "@/lib/projetos";
import { CONTEUDOS, PRODUTORES, nomeConteudo, nomeProdutor } from "@/lib/tipologia";
import { ListaItens, type ItemTela } from "./lista-itens";

/*
 * Painel do projeto (decisão do Filipe em 17/nov/2026: "o mais UX friendly
 * possível"): números-resumo, tipologia dupla do que foi coletado, linha do
 * tempo, canais recorrentes e a lista com notas. Serve ao dono (editavel) e
 * ao link de leitura (só leitura, com as notas).
 */

export const CAMINHO_ANALISE: Record<ResumoAnalise["modulo"], string> = {
  lupa: "/biblioteca/video/",
  dossie: "/biblioteca/canal/",
  disputa: "/biblioteca/tema/",
  voz: "/biblioteca/voz/",
};

export async function PainelProjeto({
  projeto,
  itens,
  locale,
  editavel,
  outrosProjetos = [],
}: {
  projeto: Projeto;
  itens: ItemProjeto[];
  locale: Locale;
  editavel: boolean;
  outrosProjetos?: { id: number; nome: string }[];
}) {
  const t = await getTranslations("Projetos");
  const tm = await getTranslations("Modulos");
  const format = await getFormatter();
  const resumos = await resumosParaProjeto(itens.map((i) => ({ modulo: i.modulo, id: i.analise_id })));
  const comResumo = itens.map((i) => ({ item: i, r: resumos.get(`${i.modulo}:${i.analise_id}`) ?? null }));

  const porModulo = (["lupa", "dossie", "disputa", "voz"] as const).map((m) => ({ m, n: itens.filter((i) => i.modulo === m).length }));

  // Tipologia dupla: Lupa (vídeo) e Dossiê (canal).
  const classificados = comResumo.filter((x) => x.r?.eixoA && x.r?.eixoB).map((x) => x.r!);
  const matriz: Record<string, Record<string, number>> = {};
  for (const r of classificados) {
    matriz[r.eixoA!] ??= {};
    matriz[r.eixoA!][r.eixoB!] = (matriz[r.eixoA!][r.eixoB!] ?? 0) + 1;
  }
  const linhas = PRODUTORES.filter((p) => matriz[p.codigo]).map((p) => ({ chave: p.codigo, rotulo: nomeProdutor(p.codigo, locale) }));
  const colunas = CONTEUDOS.filter((c) => classificados.some((r) => r.eixoB === c.codigo)).map((c) => ({ chave: c.codigo, rotulo: nomeConteudo(c.codigo, locale) }));

  // Linha do tempo: análises por mês (data da análise no corpus).
  const meses = new Map<string, number>();
  for (const x of comResumo) {
    const d = x.r?.data?.slice(0, 7);
    if (d) meses.set(d, (meses.get(d) ?? 0) + 1);
  }
  const serie = [...meses.entries()].sort(([a], [b]) => a.localeCompare(b));
  const maxMes = Math.max(1, ...serie.map(([, n]) => n));

  // Canais recorrentes.
  const canais = new Map<string, { nome: string; n: number }>();
  for (const x of comResumo) {
    if (!x.r?.canalId) continue;
    const c = canais.get(x.r.canalId) ?? { nome: x.r.canalNome ?? x.r.canalId, n: 0 };
    c.n++;
    canais.set(x.r.canalId, c);
  }
  const topCanais = [...canais.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 10);

  const itensTela: ItemTela[] = comResumo.map(({ item, r }) => ({
    id: item.id,
    modulo: item.modulo,
    analiseId: item.analise_id,
    nota: item.nota,
    rotulo: r?.rotulo ?? `#${item.analise_id}`,
    data: r?.data ?? null,
    versao: r?.versao ?? null,
    versaoMaisNovaId: r?.versaoMaisNovaId ?? null,
    eixoA: r?.eixoA ? nomeProdutor(r.eixoA, locale) : null,
    eixoB: r?.eixoB ? nomeConteudo(r.eixoB, locale) : null,
    canal: r?.canalNome ?? null,
    href: `${CAMINHO_ANALISE[item.modulo]}${item.analise_id}`,
  }));

  if (!itens.length) {
    return <p className="mt-10 max-w-prose rounded-lg bg-cc-surface px-5 py-4 text-muted-foreground">{editavel ? t("vazioDono") : t("vazioLeitura")}</p>;
  }

  return (
    <div className="mt-12 space-y-16">
      <Metricas
        colunas={4}
        itens={[
          { rotulo: t("total"), valor: format.number(itens.length) },
          ...porModulo.filter((p) => p.n > 0).map((p) => ({ rotulo: tm(`${p.m}.nome`), valor: format.number(p.n) })),
        ].slice(0, 4)}
      />

      {classificados.length > 0 && (
        <section aria-labelledby="tipologia">
          <SectionTitle as="h2">
            <span id="tipologia">{t("tipologiaTitulo")}</span>
          </SectionTitle>
          <p className="-mt-2 mb-6 max-w-prose text-sm text-muted-foreground">{t("tipologiaLegenda", { n: classificados.length })}</p>
          <MapaCalor linhas={linhas} colunas={colunas} valores={matriz} rotuloCanto={t("produtorConteudo")} />
        </section>
      )}

      <div className="grid gap-16 lg:grid-cols-2">
        {serie.length > 0 && (
          <section aria-labelledby="tempo">
            <SectionTitle as="h2" tone="secondary">
              <span id="tempo">{t("tempoTitulo")}</span>
            </SectionTitle>
            <ol className="mt-2 flex h-40 items-end gap-1.5" aria-label={t("tempoTitulo")}>
              {serie.map(([mes, n]) => (
                <li key={mes} className="flex h-full flex-1 flex-col justify-end" title={`${mes}: ${n}`}>
                  <span className="mb-1 text-center text-xs tabular-nums text-muted-foreground">{n}</span>
                  <span className="block rounded-t-sm bg-cc-green" style={{ height: `${(n / maxMes) * 75}%` }} />
                  <span className="mt-1.5 text-center text-[0.65rem] text-muted-foreground">
                    {format.dateTime(new Date(`${mes}-15T12:00:00Z`), { month: "short", year: "2-digit" })}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )}
        {topCanais.length > 0 && (
          <section aria-labelledby="canais">
            <SectionTitle as="h2" tone="secondary">
              <span id="canais">{t("canaisTitulo")}</span>
            </SectionTitle>
            <Barras cor="roxo" itens={topCanais.map(([id, c]) => ({ chave: id, rotulo: c.nome, valor: c.n }))} total={itens.length} />
          </section>
        )}
      </div>

      <section aria-labelledby="analises">
        <SectionTitle as="h2">
          <span id="analises">{t("analisesTitulo")}</span>
        </SectionTitle>
        <ListaItens itens={itensTela} editavel={editavel} projetoId={projeto.id} outrosProjetos={outrosProjetos} />
      </section>
    </div>
  );
}
