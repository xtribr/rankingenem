import type { Metadata } from 'next';
import Link from 'next/link';
import RankingSeoShell, { breadcrumbJsonLd, type Crumb } from '@/components/ranking-seo/RankingSeoShell';
import { UF_NAMES, formatScore, getUfStats, ufPath } from '@/lib/ranking-geo';

// Renderiza sob demanda: o build não depende da API estar no ar.
export const dynamic = 'force-dynamic';

const PATH = '/ranking-enem';
const CRUMBS: Crumb[] = [{ name: 'Ranking ENEM', href: '/' }, { name: 'Por estado' }];

export async function generateMetadata(): Promise<Metadata> {
  const stats = await getUfStats();
  const year = stats[0]?.ano ?? 'mais recente';
  const title = `Ranking ENEM ${year} por estado: média das escolas em cada UF`;
  const description = `Média das escolas no ENEM ${year} em cada um dos 27 estados, com o ranking de escolas por estado e por município. Microdados oficiais do INEP.`;

  return {
    title,
    description,
    alternates: { canonical: PATH },
    openGraph: { title: `${title} | XTRI`, description, url: PATH, type: 'website', locale: 'pt_BR' },
  };
}

export default async function RankingByUfPage() {
  const stats = (await getUfStats()).sort((a, b) => (b.media ?? 0) - (a.media ?? 0));
  const year = stats[0]?.ano;
  const structuredData = { '@context': 'https://schema.org', '@graph': [breadcrumbJsonLd(CRUMBS, PATH)] };

  return (
    <RankingSeoShell crumbs={CRUMBS}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <section className="mt-5 rounded-3xl bg-[#071a28] p-6 text-white shadow-lg sm:p-9">
        <h1 className="max-w-4xl text-3xl font-black tracking-tight sm:text-5xl">Ranking ENEM {year} por estado</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
          Média das escolas de cada estado no ENEM {year}, calculada a partir dos microdados oficiais do INEP. Escolha um estado para ver as escolas e os municípios.
        </p>
      </section>

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <h2 className="text-2xl font-black">Estados por média no ENEM {year}</h2>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[420px] text-left text-sm">
            <thead className="text-xs font-bold uppercase tracking-wider text-slate-500">
              <tr className="border-b border-slate-200">
                <th scope="col" className="py-3 pr-3">#</th>
                <th scope="col" className="py-3 pr-3">Estado</th>
                <th scope="col" className="py-3 pr-3 text-right">Escolas</th>
                <th scope="col" className="py-3 text-right">Média</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((row, index) => (
                <tr key={row.uf} className="border-b border-slate-100">
                  <td className="py-3 pr-3 font-bold text-slate-500">{index + 1}</td>
                  <td className="py-3 pr-3">
                    <Link href={ufPath(row.uf)} className="font-semibold text-[#0f6f96] hover:underline">
                      {UF_NAMES[row.uf]} ({row.uf})
                    </Link>
                  </td>
                  <td className="py-3 pr-3 text-right text-slate-600">{new Intl.NumberFormat('pt-BR').format(row.escolas)}</td>
                  <td className="py-3 text-right font-black">{formatScore(row.media)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </RankingSeoShell>
  );
}
