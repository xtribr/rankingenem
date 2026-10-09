import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import RankingSeoShell, { breadcrumbJsonLd, type Crumb } from '@/components/ranking-seo/RankingSeoShell';
import FaqSection from '@/components/ranking-seo/FaqSection';
import SchoolRankTable from '@/components/ranking-seo/SchoolRankTable';
import { faqJsonLd, municipioAnswers, serializeJsonLd } from '@/lib/ranking-faq';
import {
  UF_NAMES,
  findMunicipioBySlug,
  getMunicipios,
  getSchoolsByMunicipio,
  getUfStats,
  municipioDe,
  municipioEm,
  municipioPath,
  parseUfParam,
  ufDe,
  ufPath,
} from '@/lib/ranking-geo';

interface MunicipioPageProps {
  params: Promise<{ uf: string; municipio: string }>;
}

async function resolveMunicipio(params: MunicipioPageProps['params']) {
  const { uf: ufParam, municipio: slug } = await params;
  const uf = parseUfParam(ufParam);
  if (!uf) return null;
  const municipio = findMunicipioBySlug(await getMunicipios(uf), slug);
  return municipio ? { uf, municipio } : null;
}

export async function generateMetadata({ params }: MunicipioPageProps): Promise<Metadata> {
  const resolved = await resolveMunicipio(params);
  if (!resolved) return { title: 'Município não encontrado | Ranking ENEM XTRI', robots: { index: false, follow: false } };

  const { uf, municipio } = resolved;
  const [allStats, schools] = await Promise.all([getUfStats(), getSchoolsByMunicipio(uf, municipio)]);
  const year = allStats.find((row) => row.uf === uf)?.ano;
  const title = `Ranking ENEM ${year ?? 'mais recente'} ${municipioEm(municipio)} (${uf}): notas por escola`;
  const description = `${municipioAnswers(uf, municipio, year, schools).lead} Dados oficiais do INEP.`;
  const canonical = municipioPath(uf, municipio);

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title: `${title} | XTRI`, description, url: canonical, type: 'website', locale: 'pt_BR' },
  };
}

export default async function MunicipioRankingPage({ params }: MunicipioPageProps) {
  const resolved = await resolveMunicipio(params);
  if (!resolved) notFound();

  const { uf, municipio } = resolved;
  const [allStats, schools] = await Promise.all([getUfStats(), getSchoolsByMunicipio(uf, municipio)]);
  if (schools.length === 0) notFound();

  const year = allStats.find((row) => row.uf === uf)?.ano;
  const path = municipioPath(uf, municipio);
  const crumbs: Crumb[] = [
    { name: 'Ranking ENEM', href: '/' },
    { name: 'Por estado', href: '/ranking-enem' },
    { name: UF_NAMES[uf], href: ufPath(uf) },
    { name: municipio },
  ];
  const answers = municipioAnswers(uf, municipio, year, schools);
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [breadcrumbJsonLd(crumbs, path), ...(answers.faq.length > 0 ? [faqJsonLd(answers.faq)] : [])],
  };

  return (
    <RankingSeoShell crumbs={crumbs}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData) }} />
      <section className="mt-5 rounded-3xl bg-[#071a28] p-6 text-white shadow-lg sm:p-9">
        <h1 className="max-w-4xl text-3xl font-black tracking-tight sm:text-5xl">
          Ranking ENEM {year} {municipioEm(municipio)} ({uf})
        </h1>
        <p className="mt-3 max-w-3xl text-base leading-7 text-slate-200">{answers.lead}</p>
        <p className="mt-2 text-sm text-slate-400">Microdados oficiais do INEP</p>
      </section>

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <h2 className="text-2xl font-black">Escolas {municipioDe(municipio)} no ENEM {year}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Ordenadas pela média geral das cinco áreas. A coluna Brasil mostra a posição da escola no ranking nacional.
        </p>
        <SchoolRankTable schools={schools} />
      </section>

      <FaqSection items={answers.faq} />

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6">
        <h2 className="text-xl font-black">Como este resultado é calculado?</h2>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          A média geral reúne Ciências da Natureza, Ciências Humanas, Linguagens, Matemática e Redação. O ranking considera escolas com pelo menos 10 participantes presentes nas quatro provas objetivas, seguindo o corte adotado na base agregada da XTRI.
        </p>
        <Link href={ufPath(uf)} className="mt-4 inline-block text-sm font-semibold text-[#139ED3] hover:underline">
          Ver o ranking {ufDe(uf)}
        </Link>
      </section>
    </RankingSeoShell>
  );
}
