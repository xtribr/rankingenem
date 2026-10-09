import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import RankingSeoShell, { breadcrumbJsonLd, type Crumb } from '@/components/ranking-seo/RankingSeoShell';
import FaqSection from '@/components/ranking-seo/FaqSection';
import SchoolRankTable from '@/components/ranking-seo/SchoolRankTable';
import { faqJsonLd, serializeJsonLd, ufAnswers } from '@/lib/ranking-faq';
import {
  UF_NAMES,
  formatScore,
  getMunicipios,
  getTopPublicSchoolByUf,
  getTopSchoolsByUf,
  getUfStats,
  municipioPath,
  parseUfParam,
  ufDe,
  ufEm,
  ufPath,
} from '@/lib/ranking-geo';

interface UfPageProps {
  params: Promise<{ uf: string }>;
}

const AREA_LABELS = [
  ['media_cn', 'Ciências da Natureza', 'CN'],
  ['media_ch', 'Ciências Humanas', 'CH'],
  ['media_lc', 'Linguagens', 'LC'],
  ['media_mt', 'Matemática', 'MT'],
  ['media_redacao', 'Redação', 'RED'],
] as const;

function formatCount(value: number): string {
  return new Intl.NumberFormat('pt-BR').format(value);
}

export async function generateMetadata({ params }: UfPageProps): Promise<Metadata> {
  const uf = parseUfParam((await params).uf);
  if (!uf) return { title: 'Estado não encontrado | Ranking ENEM XTRI', robots: { index: false, follow: false } };

  const stats = (await getUfStats()).find((row) => row.uf === uf);
  const year = stats?.ano ?? 'mais recente';
  const title = `Ranking ENEM ${year} ${UF_NAMES[uf]} (${uf}): melhores escolas`;
  const description = `Escolas ${ufDe(uf)} no ENEM ${year}: ${stats ? `média das escolas ${formatScore(stats.media)}, ${formatCount(stats.escolas)} escolas ranqueadas` : 'ranking de escolas'} e lista por município, com dados oficiais do INEP.`;
  const canonical = ufPath(uf);

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title: `${title} | XTRI`, description, url: canonical, type: 'website', locale: 'pt_BR' },
  };
}

export default async function UfRankingPage({ params }: UfPageProps) {
  const uf = parseUfParam((await params).uf);
  if (!uf) notFound();

  const [allStats, municipios, schools, bestPublic] = await Promise.all([
    getUfStats(),
    getMunicipios(uf),
    getTopSchoolsByUf(uf),
    getTopPublicSchoolByUf(uf),
  ]);
  const stats = allStats.find((row) => row.uf === uf);
  if (!stats) notFound();

  const year = stats.ano;
  const name = UF_NAMES[uf];
  const path = ufPath(uf);
  const crumbs: Crumb[] = [
    { name: 'Ranking ENEM', href: '/' },
    { name: 'Por estado', href: '/ranking-enem' },
    { name },
  ];
  const answers = ufAnswers(stats, schools, bestPublic);
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [breadcrumbJsonLd(crumbs, path), ...(answers.faq.length > 0 ? [faqJsonLd(answers.faq)] : [])],
  };

  return (
    <RankingSeoShell crumbs={crumbs}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData) }} />
      <section className="mt-5 rounded-3xl bg-[#071a28] p-6 text-white shadow-lg sm:p-9">
        <h1 className="max-w-4xl text-3xl font-black tracking-tight sm:text-5xl">
          Ranking ENEM {year}: {name} ({uf})
        </h1>
        <p className="mt-3 max-w-3xl text-base leading-7 text-slate-200">{answers.lead}</p>
        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-white/10 p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-300">Média das escolas</p>
            <p className="mt-1 text-3xl font-black">{formatScore(stats.media)}</p>
          </div>
          <div className="rounded-2xl bg-white/10 p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-300">Escolas ranqueadas</p>
            <p className="mt-1 text-3xl font-black">{formatCount(stats.escolas)}</p>
          </div>
          <div className="rounded-2xl bg-white/10 p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-300">Municípios</p>
            <p className="mt-1 text-3xl font-black">{formatCount(municipios.length)}</p>
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <h2 className="text-2xl font-black">Média por área {ufEm(uf)}</h2>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {AREA_LABELS.map(([key, label, short]) => (
            <div key={key} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-black text-[#139ED3]">{short}</p>
              <p className="mt-2 text-2xl font-black">{formatScore(stats[key])}</p>
              <p className="mt-1 text-xs leading-4 text-slate-500">{label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <h2 className="text-2xl font-black">
          {schools.length < stats.escolas ? `As ${schools.length} melhores escolas` : 'Escolas'} {ufDe(uf)} no ENEM {year}
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Ordenadas pela média geral. Para ver todas as escolas de uma cidade, escolha o município abaixo.
        </p>
        <SchoolRankTable schools={schools} showMunicipio />
      </section>

      <FaqSection items={answers.faq} />

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <h2 className="text-2xl font-black">Ranking ENEM {year} por município {ufEm(uf)}</h2>
        <ul className="mt-5 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3 lg:grid-cols-4">
          {municipios.map((municipio) => (
            <li key={municipio}>
              <Link href={municipioPath(uf, municipio)} className="text-[#0f6f96] hover:underline">{municipio}</Link>
            </li>
          ))}
        </ul>
      </section>
    </RankingSeoShell>
  );
}
