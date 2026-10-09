import {
  UF_NAMES,
  formatScore,
  municipioDe,
  municipioEm,
  ufDe,
  ufEm,
  type RankedSchool,
  type UfStats,
} from '@/lib/ranking-geo';
import type { PublicSchoolSeoSummary } from '@/lib/school-seo';

export interface FaqItem {
  question: string;
  answer: string;
}

export interface AnswerContent {
  /** Frase direta, no topo da página, que responde a busca principal. */
  lead: string;
  faq: FaqItem[];
}

// Só na página de estado: as de escola e município já têm um bloco próprio de metodologia.
const METHODOLOGY: FaqItem = {
  question: 'Como o ranking do ENEM por escola é calculado?',
  answer:
    'A média geral reúne Ciências da Natureza, Ciências Humanas, Linguagens, Matemática e Redação, a partir dos microdados oficiais do INEP. Entram no ranking as escolas com pelo menos 10 participantes presentes nas quatro provas objetivas.',
};

const count = (value: number) => new Intl.NumberFormat('pt-BR').format(value);
const plural = (value: number, one: string, many: string) => `${count(value)} ${value === 1 ? one : many}`;
const enemLabel = (year: number | null | undefined) => (year ? `ENEM ${year}` : 'ENEM');

function schoolPlace(school: { municipio: string | null; uf: string | null }): string {
  return [school.municipio, school.uf].filter(Boolean).join('/');
}

/** "do estado do Rio de Janeiro": deixa claro que é o estado, não a capital de mesmo nome. */
function stateScope(uf: string): string {
  return uf === 'DF' ? 'do Distrito Federal' : `do estado ${ufDe(uf)}`;
}

/** "42ª posição no ranking nacional e na 1ª entre as escolas do estado do Rio Grande do Norte". */
function positionText(school: PublicSchoolSeoSummary): string {
  const parts: string[] = [];
  if (school.ranking_brasil) {
    parts.push(`${count(school.ranking_brasil)}ª posição no ranking nacional`);
  }
  if (school.ranking_uf && school.uf && school.uf in UF_NAMES) {
    parts.push(
      `${count(school.ranking_uf)}ª${parts.length === 0 ? ' posição' : ''} entre as escolas ${stateScope(school.uf)}`,
    );
  }
  return parts.join(' e na ');
}

function nationalRank(school: RankedSchool): string {
  return school.ultimo_ranking ? ` (${count(school.ultimo_ranking)}ª posição no ranking nacional)` : '';
}

export function schoolAnswers(school: PublicSchoolSeoSummary): AnswerContent {
  const enem = enemLabel(school.ultimo_ano);
  const name = school.nome_escola;
  const place = schoolPlace(school);
  const where = place ? ` (${place})` : '';
  const hasScore = school.nota_media !== null;
  // A posição é a ordem pela média geral: sem média, não se afirma posição.
  const position = hasScore ? positionText(school) : '';

  const lead = hasScore
    ? `No ${enem}, ${name}${where} teve média geral ${formatScore(school.nota_media)}${position ? ` e ficou na ${position}` : ''}.`
    : `${name}${where} não tem média geral disponível no ${enem}.`;

  const faq: FaqItem[] = [];
  if (hasScore) {
    faq.push({
      question: `Qual foi a nota de ${name} no ${enem}?`,
      answer: `A média geral de ${name} no ${enem} foi ${formatScore(school.nota_media)}, considerando as quatro provas objetivas e a Redação.`,
    });
  }
  if (position) {
    faq.push({
      question: `Qual a posição de ${name} no ranking do ${enem}?`,
      answer: `No ${enem}, ${name} ficou na ${position}.`,
    });
  }
  const areas = [
    ['Ciências da Natureza', school.nota_cn],
    ['Ciências Humanas', school.nota_ch],
    ['Linguagens', school.nota_lc],
    ['Matemática', school.nota_mt],
    ['Redação', school.nota_redacao],
  ].filter((area): area is [string, number] => area[1] !== null);
  if (areas.length > 0) {
    faq.push({
      question: `Quais foram as notas de ${name} por área no ${enem}?`,
      answer: `${areas.map(([label, value]) => `${label}: ${formatScore(value)}`).join('; ')}.`,
    });
  }
  return { lead, faq };
}

export function municipioAnswers(
  uf: string,
  municipio: string,
  year: number | undefined,
  schools: RankedSchool[],
): AnswerContent {
  const enem = enemLabel(year);
  const de = municipioDe(municipio);
  const [best] = schools;
  if (!best) return { lead: `${municipio} (${uf}) não tem escolas ranqueadas no ${enem}.`, faq: [] };

  // Uma única escola: não há comparação a fazer, então nada de "maior média" ou "melhor escola".
  if (schools.length === 1) {
    const score = best.ultima_nota === null ? '' : `, com média geral ${formatScore(best.ultima_nota)}`;
    return {
      lead: `${municipio} (${uf}) tem 1 escola ranqueada no ${enem}: ${best.nome_escola}${score}.`,
      faq: [
        {
          question: `Qual escola ${de} aparece no ranking do ${enem}?`,
          answer: `${best.nome_escola}${score}${nationalRank(best)}.`,
        },
      ],
    };
  }

  const total = `${count(schools.length)} escolas ranqueadas`;
  const bestSentence = best.ultima_nota === null
    ? null
    : `A maior média geral foi de ${best.nome_escola}, com ${formatScore(best.ultima_nota)}`;
  const bestPublic = schools.find((school) => school.tipo_escola === 'Pública' && school.ultima_nota !== null);

  const faq: FaqItem[] = [];
  if (bestSentence) {
    faq.push({
      question: `Qual a melhor escola ${de} no ${enem}?`,
      answer: `${bestSentence}${nationalRank(best)}.`,
    });
  }
  if (bestPublic && bestPublic.codigo_inep !== best.codigo_inep) {
    faq.push({
      question: `Qual a melhor escola pública ${de} no ${enem}?`,
      answer: `Entre as escolas públicas ${de}, a maior média geral foi de ${bestPublic.nome_escola}, com ${formatScore(bestPublic.ultima_nota)}.`,
    });
  }
  faq.push({
    question: `Quantas escolas ${de} aparecem no ranking do ${enem}?`,
    answer: `${municipio} (${uf}) tem ${total} no ${enem}.`,
  });

  return {
    lead: `${municipio} (${uf}) tem ${total} no ${enem}.${bestSentence ? ` ${bestSentence}.` : ''}`,
    faq,
  };
}

export function ufAnswers(
  stats: UfStats,
  schools: RankedSchool[],
  bestPublic: RankedSchool | null,
): AnswerContent {
  const { uf } = stats;
  const enem = enemLabel(stats.ano);
  const best = schools[0];
  const total = plural(stats.escolas, 'escola ranqueada', 'escolas ranqueadas');
  const inCity = (school: RankedSchool) => (school.municipio ? `, ${municipioEm(school.municipio)}` : '');
  const bestSentence = best && best.ultima_nota !== null
    ? `A maior média geral foi de ${best.nome_escola}${inCity(best)}, com ${formatScore(best.ultima_nota)}`
    : null;

  const faq: FaqItem[] = [];
  if (best && bestSentence) {
    faq.push({
      question: `Qual a melhor escola ${ufDe(uf)} no ${enem}?`,
      answer: `${bestSentence}${nationalRank(best)}.`,
    });
  }
  if (bestPublic && bestPublic.ultima_nota !== null && bestPublic.codigo_inep !== best?.codigo_inep) {
    faq.push({
      question: `Qual a melhor escola pública ${ufDe(uf)} no ${enem}?`,
      answer: `Entre as escolas públicas ${ufDe(uf)}, a maior média geral foi de ${bestPublic.nome_escola}${inCity(bestPublic)}, com ${formatScore(bestPublic.ultima_nota)}.`,
    });
  }
  if (stats.media !== null) {
    faq.push({
      question: `Qual foi a média das escolas ${ufDe(uf)} no ${enem}?`,
      answer: `A média geral das escolas ${ufDe(uf)} no ${enem} foi ${formatScore(stats.media)}, com ${total}.`,
    });
  }
  faq.push(METHODOLOGY);

  const summary = stats.media !== null
    ? `No ${enem}, a média das escolas ${ufDe(uf)} foi ${formatScore(stats.media)}, com ${total}.`
    : `No ${enem}, há ${total} ${ufEm(uf)}.`;

  return { lead: `${summary}${bestSentence ? ` ${bestSentence}.` : ''}`, faq };
}

export function faqJsonLd(faq: FaqItem[]) {
  return {
    '@type': 'FAQPage',
    mainEntity: faq.map(({ question, answer }) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: { '@type': 'Answer', text: answer },
    })),
  };
}

/** JSON para um script ld+json inline: "<" é escapado para que nenhum texto vindo do banco feche o elemento. */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
