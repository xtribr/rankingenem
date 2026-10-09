import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, BarChart3, Database, MapPin, Trophy } from 'lucide-react';
import { notFound } from 'next/navigation';
import EcosystemFooter from '@/components/ranking-seo/EcosystemFooter';
import { UF_NAMES, municipioPath, ufPath } from '@/lib/ranking-geo';
import { getPublicSchoolSeoSummary } from '@/lib/school-seo';

interface SchoolSeoPageProps {
  params: Promise<{ codigo_inep: string }>;
}

const BASE_URL = 'https://app.rankingenem.com';
const AREA_LABELS = [
  ['nota_cn', 'Ciências da Natureza', 'CN'],
  ['nota_ch', 'Ciências Humanas', 'CH'],
  ['nota_lc', 'Linguagens', 'LC'],
  ['nota_mt', 'Matemática', 'MT'],
  ['nota_redacao', 'Redação', 'RED'],
] as const;

function formatScore(value: number | null): string {
  return value === null
    ? 'Não disponível'
    : new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value);
}

function schoolLocation(municipio: string | null, uf: string | null): string {
  return [municipio, uf].filter(Boolean).join(' · ') || 'Brasil';
}

export async function generateMetadata({ params }: SchoolSeoPageProps): Promise<Metadata> {
  const { codigo_inep } = await params;
  const school = await getPublicSchoolSeoSummary(codigo_inep);

  if (!school) {
    return { title: 'Escola não encontrada | Ranking ENEM XTRI', robots: { index: false, follow: false } };
  }

  const year = school.ultimo_ano || 'mais recente';
  const location = schoolLocation(school.municipio, school.uf);
  const title = `${school.nome_escola} no ENEM ${year}: nota e ranking`;
  const description = `${school.nome_escola}, ${location}: média ${formatScore(school.nota_media)} e posição ${school.ranking_brasil ? `nº ${school.ranking_brasil}` : 'no ranking'} do ENEM ${year}, com dados oficiais do INEP.`;
  const canonical = `/ranking-enem/escola/${school.codigo_inep}`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title: `${title} | XTRI`, description, url: canonical, type: 'website', locale: 'pt_BR' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function SchoolSeoPage({ params }: SchoolSeoPageProps) {
  const { codigo_inep } = await params;
  const school = await getPublicSchoolSeoSummary(codigo_inep);
  if (!school) notFound();

  const year = school.ultimo_ano;
  const canonical = `${BASE_URL}/ranking-enem/escola/${school.codigo_inep}`;
  const location = schoolLocation(school.municipio, school.uf);
  const uf = school.uf && school.uf in UF_NAMES ? school.uf : null;
  const geoCrumbs = [
    ...(uf ? [{ name: UF_NAMES[uf], href: ufPath(uf) }] : []),
    ...(uf && school.municipio ? [{ name: school.municipio, href: municipioPath(uf, school.municipio) }] : []),
  ];
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': canonical,
        url: canonical,
        name: `${school.nome_escola} no ENEM ${year}`,
        description: `Nota média e ranking de ${school.nome_escola} no ENEM ${year}, calculados a partir dos microdados oficiais do INEP.`,
        inLanguage: 'pt-BR',
        isPartOf: { '@type': 'WebSite', name: 'Ranking ENEM XTRI', url: BASE_URL },
        about: { '@type': 'Organization', name: school.nome_escola, identifier: school.codigo_inep },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Ranking ENEM', item: BASE_URL },
          ...geoCrumbs.map((crumb, index) => ({
            '@type': 'ListItem',
            position: index + 2,
            name: crumb.name,
            item: `${BASE_URL}${crumb.href}`,
          })),
          { '@type': 'ListItem', position: geoCrumbs.length + 2, name: school.nome_escola, item: canonical },
        ],
      },
    ],
  };

  return (
    <div className="min-h-screen bg-[#f7fafc] text-slate-950">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3 font-black">
            <Image src="/logo-x.png" alt="XTRI" width={36} height={36} className="h-9 w-9 object-contain" priority />
            Ranking ENEM XTRI
          </Link>
          <Link href={`/schools/${school.codigo_inep}`} className="hidden rounded-xl bg-[#FF4B2E] px-4 py-2 text-sm font-bold text-white sm:inline-flex">
            Ver análise completa
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-7 sm:px-6 sm:py-10">
        <nav aria-label="Breadcrumb" className="text-sm text-slate-500">
          <Link href="/" className="font-semibold text-[#139ED3] hover:underline">Ranking ENEM</Link>
          {geoCrumbs.map((crumb) => (
            <span key={crumb.href}>
              <span aria-hidden="true"> / </span>
              <Link href={crumb.href} className="font-semibold text-[#139ED3] hover:underline">{crumb.name}</Link>
            </span>
          ))}
          <span aria-hidden="true"> / </span>
          <span>{school.nome_escola}</span>
        </nav>

        <section className="mt-5 overflow-hidden rounded-3xl bg-[#071a28] p-6 text-white shadow-lg sm:p-9">
          <div className="flex flex-wrap gap-2 text-xs font-bold uppercase tracking-[0.12em] text-sky-100">
            <span className="rounded-full bg-white/10 px-3 py-1">ENEM {year}</span>
            {school.tipo_escola ? <span className="rounded-full bg-white/10 px-3 py-1">{school.tipo_escola}</span> : null}
          </div>
          <h1 className="mt-4 max-w-4xl text-3xl font-black tracking-tight sm:text-5xl">
            {school.nome_escola} no ENEM {year}
          </h1>
          <p className="mt-3 flex items-center gap-2 text-sm text-slate-300">
            <MapPin className="h-4 w-4" /> {location} · Código INEP {school.codigo_inep}
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-white/10 p-5">
              <Trophy className="h-5 w-5 text-orange-300" />
              <p className="mt-3 text-xs font-bold uppercase tracking-wider text-slate-300">Posição nacional</p>
              <p className="mt-1 text-3xl font-black">{school.ranking_brasil ? `#${school.ranking_brasil}` : 'Não disponível'}</p>
            </div>
            <div className="rounded-2xl bg-white/10 p-5">
              <BarChart3 className="h-5 w-5 text-sky-300" />
              <p className="mt-3 text-xs font-bold uppercase tracking-wider text-slate-300">Média geral</p>
              <p className="mt-1 text-3xl font-black">{formatScore(school.nota_media)}</p>
            </div>
            <div className="rounded-2xl bg-white/10 p-5">
              <Database className="h-5 w-5 text-sky-300" />
              <p className="mt-3 text-xs font-bold uppercase tracking-wider text-slate-300">Série histórica</p>
              <p className="mt-1 text-3xl font-black">{school.anos_participacao} {school.anos_participacao === 1 ? 'ano' : 'anos'}</p>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <h2 className="text-2xl font-black">Notas por área no ENEM {year}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Médias agregadas da escola nas cinco áreas divulgadas nos microdados oficiais do INEP.</p>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {AREA_LABELS.map(([key, label, short]) => (
              <div key={key} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-black text-[#139ED3]">{short}</p>
                <p className="mt-2 text-2xl font-black">{formatScore(school[key])}</p>
                <p className="mt-1 text-xs leading-4 text-slate-500">{label}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-2">
          <article className="rounded-3xl border border-slate-200 bg-white p-6">
            <h2 className="text-xl font-black">Como este resultado é calculado?</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              A média geral reúne Ciências da Natureza, Ciências Humanas, Linguagens, Matemática e Redação. O ranking considera escolas com pelo menos 10 participantes presentes nas quatro provas objetivas, seguindo o corte adotado na base agregada da XTRI.
            </p>
          </article>
          <article className="rounded-3xl border border-orange-200 bg-[#fff4ef] p-6">
            <h2 className="text-xl font-black">Veja a evolução completa</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">Acesse o histórico por área, diagnóstico e comparação da escola no painel gratuito.</p>
            <Link href={`/schools/${school.codigo_inep}`} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#FF4B2E] px-5 py-3 text-sm font-bold text-white">
              Abrir análise da escola <ArrowRight className="h-4 w-4" />
            </Link>
          </article>
        </section>
      </main>
      <EcosystemFooter />
    </div>
  );
}
