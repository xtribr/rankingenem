import type { MetadataRoute } from 'next';
import { UF_NAMES, getMunicipios, municipioPath, ufPath } from '@/lib/ranking-geo';
import { getSchoolSeoIndex } from '@/lib/school-seo';

const BASE_URL = 'https://app.rankingenem.com';
const BATCH_SIZE = 5000;

export const revalidate = 86_400;

const corePages: MetadataRoute.Sitemap = [
  { url: BASE_URL, changeFrequency: 'weekly', priority: 1 },
  { url: `${BASE_URL}/redacao`, changeFrequency: 'monthly', priority: 0.8 },
  { url: `${BASE_URL}/termos-de-uso`, changeFrequency: 'yearly', priority: 0.2 },
  { url: `${BASE_URL}/politica-de-privacidade`, changeFrequency: 'yearly', priority: 0.2 },
  { url: `${BASE_URL}/politica-de-compliance-ia`, changeFrequency: 'yearly', priority: 0.2 },
];

async function geoPages(): Promise<MetadataRoute.Sitemap> {
  const ufs = Object.keys(UF_NAMES);
  const municipiosByUf = await Promise.all(ufs.map((uf) => getMunicipios(uf)));

  return [
    { url: `${BASE_URL}/ranking-enem`, changeFrequency: 'yearly', priority: 0.9 },
    ...ufs.map((uf) => ({
      url: `${BASE_URL}${ufPath(uf)}`,
      changeFrequency: 'yearly' as const,
      priority: 0.8,
    })),
    ...ufs.flatMap((uf, index) =>
      municipiosByUf[index].map((municipio) => ({
        url: `${BASE_URL}${municipioPath(uf, municipio)}`,
        changeFrequency: 'yearly' as const,
        priority: 0.7,
      })),
    ),
  ];
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    const firstBatch = await getSchoolSeoIndex(0, BATCH_SIZE);
    const remainingOffsets = Array.from(
      { length: Math.max(0, Math.ceil(firstBatch.total / BATCH_SIZE) - 1) },
      (_, index) => (index + 1) * BATCH_SIZE,
    );
    const remainingBatches = await Promise.all(
      remainingOffsets.map((offset) => getSchoolSeoIndex(offset, BATCH_SIZE)),
    );
    const schools = [firstBatch, ...remainingBatches].flatMap((batch) => batch.schools);

    return [
      ...corePages,
      ...(await geoPages().catch(() => [])),
      ...schools.map(({ codigo_inep }) => ({
        url: `${BASE_URL}/ranking-enem/escola/${codigo_inep}`,
        changeFrequency: 'yearly' as const,
        priority: 0.6,
      })),
    ];
  } catch {
    return corePages;
  }
}
