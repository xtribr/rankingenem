const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const REVALIDATE_SECONDS = 86_400;
const PAGE_SIZE = 200;
const MAX_PAGES = 20;

export const UF_NAMES: Record<string, string> = {
  AC: 'Acre',
  AL: 'Alagoas',
  AP: 'Amapá',
  AM: 'Amazonas',
  BA: 'Bahia',
  CE: 'Ceará',
  DF: 'Distrito Federal',
  ES: 'Espírito Santo',
  GO: 'Goiás',
  MA: 'Maranhão',
  MT: 'Mato Grosso',
  MS: 'Mato Grosso do Sul',
  MG: 'Minas Gerais',
  PA: 'Pará',
  PB: 'Paraíba',
  PR: 'Paraná',
  PE: 'Pernambuco',
  PI: 'Piauí',
  RJ: 'Rio de Janeiro',
  RN: 'Rio Grande do Norte',
  RS: 'Rio Grande do Sul',
  RO: 'Rondônia',
  RR: 'Roraima',
  SC: 'Santa Catarina',
  SP: 'São Paulo',
  SE: 'Sergipe',
  TO: 'Tocantins',
};

// Estados que levam artigo ("do Ceará", "da Bahia"); os demais usam "de"/"em".
const UF_ARTICLE: Record<string, 'o' | 'a'> = {
  AC: 'o', AP: 'o', AM: 'o', BA: 'a', CE: 'o', DF: 'o', ES: 'o', MA: 'o', PA: 'o',
  PB: 'a', PR: 'o', PI: 'o', RJ: 'o', RN: 'o', RS: 'o', TO: 'o',
};

/** "do Rio Grande do Norte", "da Bahia", "de Minas Gerais". */
export function ufDe(uf: string): string {
  const article = UF_ARTICLE[uf];
  return `${article ? `d${article}` : 'de'} ${UF_NAMES[uf]}`;
}

/** "no Rio Grande do Norte", "na Bahia", "em Minas Gerais". */
export function ufEm(uf: string): string {
  const article = UF_ARTICLE[uf];
  return `${article ? `n${article}` : 'em'} ${UF_NAMES[uf]}`;
}

export interface UfStats {
  uf: string;
  media: number | null;
  escolas: number;
  media_cn: number | null;
  media_ch: number | null;
  media_lc: number | null;
  media_mt: number | null;
  media_redacao: number | null;
  media_prev: number | null;
  ano: number;
  ano_prev: number | null;
}

export interface RankedSchool {
  codigo_inep: string;
  nome_escola: string;
  uf: string | null;
  municipio: string | null;
  tipo_escola: string | null;
  ultimo_ranking: number | null;
  ranking_uf: number | null;
  ultima_nota: number | null;
}

export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Sigla da UF em maiúsculas a partir do segmento da URL, ou null se não existir. */
export function parseUfParam(param: string): string | null {
  const uf = param.toUpperCase();
  return param === param.toLowerCase() && uf in UF_NAMES ? uf : null;
}

export function findMunicipioBySlug(municipios: string[], slug: string): string | null {
  return municipios.find((municipio) => slugify(municipio) === slug) ?? null;
}

export function ufPath(uf: string): string {
  return `/ranking-enem/${uf.toLowerCase()}`;
}

export function municipioPath(uf: string, municipio: string): string {
  return `${ufPath(uf)}/${slugify(municipio)}`;
}

export function formatScore(value: number | null | undefined): string {
  return value === null || value === undefined
    ? 'Não disponível'
    : new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value);
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, { next: { revalidate: REVALIDATE_SECONDS } });
  if (!response.ok) throw new Error(`Ranking request failed (${response.status}): ${path}`);
  return response.json() as Promise<T>;
}

export async function getUfStats(): Promise<UfStats[]> {
  const { by_uf } = await getJson<{ by_uf: UfStats[] }>('/api/stats/by-uf');
  return by_uf.filter(({ uf }) => uf in UF_NAMES);
}

export async function getMunicipios(uf: string): Promise<string[]> {
  const { municipios } = await getJson<{ municipios: string[] }>(
    `/api/schools/municipios?uf=${encodeURIComponent(uf)}`,
  );
  return municipios;
}

/** Primeiras escolas da UF, na ordem do ranking nacional do último ano. */
export async function getTopSchoolsByUf(uf: string, limit = PAGE_SIZE): Promise<RankedSchool[]> {
  return getJson<RankedSchool[]>(`/api/schools/?uf=${encodeURIComponent(uf)}&limit=${limit}`);
}

/** Todas as escolas ranqueadas do município no último ano. */
export async function getSchoolsByMunicipio(uf: string, municipio: string): Promise<RankedSchool[]> {
  const schools: RankedSchool[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const batch = await getJson<RankedSchool[]>(
      `/api/schools/?uf=${encodeURIComponent(uf)}&municipio=${encodeURIComponent(municipio)}&limit=${PAGE_SIZE}&page=${page}`,
    );
    schools.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return schools;
}
