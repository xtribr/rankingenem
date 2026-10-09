import { describe, expect, it } from 'vitest';

import { faqJsonLd, municipioAnswers, schoolAnswers, serializeJsonLd, ufAnswers } from './ranking-faq';
import { municipioDe, municipioEm, type RankedSchool, type UfStats } from './ranking-geo';
import type { PublicSchoolSeoSummary } from './school-seo';

const SCHOOL: PublicSchoolSeoSummary = {
  codigo_inep: '24097004',
  nome_escola: 'COLEGIO CIENCIAS APLICADAS',
  uf: 'RN',
  municipio: 'Natal',
  tipo_escola: 'Privada',
  anos_participacao: 8,
  ultimo_ano: 2025,
  ranking_brasil: 42,
  ranking_uf: 1,
  nota_media: 726.39,
  nota_cn: 674.39,
  nota_ch: 652.0,
  nota_lc: 649.45,
  nota_mt: 772.05,
  nota_redacao: 884.07,
};

const NO_SCORES = {
  nota_media: null,
  nota_cn: null,
  nota_ch: null,
  nota_lc: null,
  nota_mt: null,
  nota_redacao: null,
};

function ranked(overrides: Partial<RankedSchool>): RankedSchool {
  return {
    codigo_inep: '24097004',
    nome_escola: 'COLEGIO CIENCIAS APLICADAS',
    uf: 'RN',
    municipio: 'Natal',
    tipo_escola: 'Privada',
    ultimo_ranking: 42,
    ranking_uf: 1,
    ultima_nota: 726.39,
    ...overrides,
  };
}

const PUBLIC_SCHOOL = ranked({
  codigo_inep: '24059110',
  nome_escola: 'IFRN - CAMPUS NATAL - CENTRAL',
  tipo_escola: 'Pública',
  ultimo_ranking: 1909,
  ranking_uf: 32,
  ultima_nota: 628.9,
});

const RN_STATS: UfStats = {
  uf: 'RN',
  media: 526.3,
  escolas: 424,
  media_cn: 493.3,
  media_ch: 498.1,
  media_lc: 521.1,
  media_mt: 498.6,
  media_redacao: 620.2,
  media_prev: 530.0,
  ano: 2025,
  ano_prev: 2024,
};

describe('schoolAnswers', () => {
  it('responde nota e posição na primeira frase, com o escopo de cada posição', () => {
    const { lead, faq } = schoolAnswers(SCHOOL);

    expect(lead).toBe(
      'No ENEM 2025, COLEGIO CIENCIAS APLICADAS (Natal/RN) teve média geral 726,4 e ficou na 42ª posição no ranking nacional e na 1ª entre as escolas do estado do Rio Grande do Norte.',
    );
    expect(faq.map((item) => item.question)).toEqual([
      'Qual foi a nota de COLEGIO CIENCIAS APLICADAS no ENEM 2025?',
      'Qual a posição de COLEGIO CIENCIAS APLICADAS no ranking do ENEM 2025?',
      'Quais foram as notas de COLEGIO CIENCIAS APLICADAS por área no ENEM 2025?',
    ]);
    expect(faq[2].answer).toContain('Matemática: 772,1');
  });

  it('não confunde a posição no estado com a posição na capital de mesmo nome', () => {
    const { lead } = schoolAnswers({ ...SCHOOL, uf: 'RJ', municipio: 'Rio de Janeiro', ranking_brasil: 20, ranking_uf: 3 });

    expect(lead).toContain('20ª posição no ranking nacional e na 3ª entre as escolas do estado do Rio de Janeiro.');
  });

  it('trata o Distrito Federal sem chamá-lo de estado', () => {
    const { lead } = schoolAnswers({ ...SCHOOL, uf: 'DF', municipio: 'Brasília', ranking_uf: 5 });

    expect(lead).toContain('na 5ª entre as escolas do Distrito Federal.');
  });

  it('escreve a frase completa quando só existe a posição estadual', () => {
    const { lead, faq } = schoolAnswers({ ...SCHOOL, uf: 'SP', municipio: null, ultimo_ano: 2019, ranking_brasil: null, ranking_uf: 2091 });

    expect(lead).toBe(
      'No ENEM 2019, COLEGIO CIENCIAS APLICADAS (SP) teve média geral 726,4 e ficou na 2.091ª posição entre as escolas do estado de São Paulo.',
    );
    expect(faq[1].answer).toBe(
      'No ENEM 2019, COLEGIO CIENCIAS APLICADAS ficou na 2.091ª posição entre as escolas do estado de São Paulo.',
    );
  });

  it('não inventa nota nem posição quando o dado não existe', () => {
    const { lead, faq } = schoolAnswers({ ...SCHOOL, ...NO_SCORES, ranking_brasil: null, ranking_uf: null });

    expect(lead).toBe('COLEGIO CIENCIAS APLICADAS (Natal/RN) não tem média geral disponível no ENEM 2025.');
    expect(faq).toEqual([]);
  });

  it('não afirma posição no ranking para escola sem média', () => {
    const { lead, faq } = schoolAnswers({ ...SCHOOL, ...NO_SCORES, ultimo_ano: 2024, ranking_brasil: 22023, ranking_uf: null });

    expect(lead).not.toContain('posição');
    expect(faq).toEqual([]);
  });

  it('nunca escreve "null" quando o ano não vem da API', () => {
    const { lead, faq } = schoolAnswers({ ...SCHOOL, ultimo_ano: null });
    const text = [lead, ...faq.flatMap((item) => [item.question, item.answer])].join(' ');

    expect(text).not.toMatch(/null|undefined/);
    expect(lead.startsWith('No ENEM, COLEGIO')).toBe(true);
  });
});

describe('municipioAnswers', () => {
  it('cita a maior média e a melhor pública quando são escolas diferentes', () => {
    const { lead, faq } = municipioAnswers('RN', 'Natal', 2025, [ranked({}), PUBLIC_SCHOOL]);

    expect(lead).toBe(
      'Natal (RN) tem 2 escolas ranqueadas no ENEM 2025. A maior média geral foi de COLEGIO CIENCIAS APLICADAS, com 726,4.',
    );
    expect(faq.map((item) => item.question)).toEqual([
      'Qual a melhor escola de Natal no ENEM 2025?',
      'Qual a melhor escola pública de Natal no ENEM 2025?',
      'Quantas escolas de Natal aparecem no ranking do ENEM 2025?',
    ]);
    expect(faq[1].answer).toContain('IFRN - CAMPUS NATAL - CENTRAL, com 628,9');
  });

  it('omite a pergunta da pública quando ela já é a primeira ou não existe', () => {
    const other = ranked({ codigo_inep: '24000000', nome_escola: 'COLEGIO PORTO', ultimo_ranking: 98, ultima_nota: 706.8 });

    expect(municipioAnswers('RN', 'Natal', 2025, [PUBLIC_SCHOOL, other]).faq).toHaveLength(2);
    expect(municipioAnswers('RN', 'Natal', 2025, [ranked({}), other]).faq).toHaveLength(2);
  });

  it('não usa superlativo quando o município tem uma única escola', () => {
    const only = ranked({ nome_escola: 'CIEP 419 BENIGNO BAIRRAL', municipio: 'Aperibé', uf: 'RJ', ultimo_ranking: 14842, ultima_nota: 504.2 });
    const { lead, faq } = municipioAnswers('RJ', 'Aperibé', 2025, [only]);

    expect(lead).toBe('Aperibé (RJ) tem 1 escola ranqueada no ENEM 2025: CIEP 419 BENIGNO BAIRRAL, com média geral 504,2.');
    expect(faq).toEqual([
      {
        question: 'Qual escola de Aperibé aparece no ranking do ENEM 2025?',
        answer: 'CIEP 419 BENIGNO BAIRRAL, com média geral 504,2 (14.842ª posição no ranking nacional).',
      },
    ]);
  });

  it('usa o artigo no Rio de Janeiro', () => {
    const { faq } = municipioAnswers('RJ', 'Rio de Janeiro', 2025, [
      ranked({ municipio: 'Rio de Janeiro', uf: 'RJ' }),
      { ...PUBLIC_SCHOOL, municipio: 'Rio de Janeiro', uf: 'RJ' },
    ]);

    expect(faq.map((item) => item.question)).toEqual([
      'Qual a melhor escola do Rio de Janeiro no ENEM 2025?',
      'Qual a melhor escola pública do Rio de Janeiro no ENEM 2025?',
      'Quantas escolas do Rio de Janeiro aparecem no ranking do ENEM 2025?',
    ]);
    expect(faq[1].answer.startsWith('Entre as escolas públicas do Rio de Janeiro,')).toBe(true);
  });

  it('não escreve "undefined" quando o ano não está disponível', () => {
    const { lead, faq } = municipioAnswers('RN', 'Natal', undefined, [ranked({}), PUBLIC_SCHOOL]);
    const text = [lead, ...faq.flatMap((item) => [item.question, item.answer])].join(' ');

    expect(text).not.toMatch(/undefined|null/);
  });

  it('não quebra com lista vazia', () => {
    expect(municipioAnswers('RN', 'Natal', 2025, [])).toEqual({
      lead: 'Natal (RN) não tem escolas ranqueadas no ENEM 2025.',
      faq: [],
    });
  });
});

describe('ufAnswers', () => {
  it('usa a preposição do estado e a média estadual', () => {
    const { lead, faq } = ufAnswers(RN_STATS, [ranked({})], PUBLIC_SCHOOL);

    expect(lead).toBe(
      'No ENEM 2025, a média das escolas do Rio Grande do Norte foi 526,3, com 424 escolas ranqueadas. A maior média geral foi de COLEGIO CIENCIAS APLICADAS, em Natal, com 726,4.',
    );
    expect(faq.map((item) => item.question)).toEqual([
      'Qual a melhor escola do Rio Grande do Norte no ENEM 2025?',
      'Qual a melhor escola pública do Rio Grande do Norte no ENEM 2025?',
      'Qual foi a média das escolas do Rio Grande do Norte no ENEM 2025?',
      'Como o ranking do ENEM por escola é calculado?',
    ]);
  });

  it('escreve "no Rio de Janeiro" para a cidade da melhor escola', () => {
    const { lead } = ufAnswers(
      { ...RN_STATS, uf: 'RJ', media: 547.5, escolas: 1663 },
      [ranked({ nome_escola: 'COLEGIO ALFA CEM BILINGUE', uf: 'RJ', municipio: 'Rio de Janeiro', ultima_nota: 759.31 })],
      null,
    );

    expect(lead).toBe(
      'No ENEM 2025, a média das escolas do Rio de Janeiro foi 547,5, com 1.663 escolas ranqueadas. A maior média geral foi de COLEGIO ALFA CEM BILINGUE, no Rio de Janeiro, com 759,3.',
    );
  });

  it('omite a média quando ela não existe, sem escrever "Não disponível"', () => {
    const { lead, faq } = ufAnswers({ ...RN_STATS, media: null }, [], null);

    expect(lead).toBe('No ENEM 2025, há 424 escolas ranqueadas no Rio Grande do Norte.');
    expect(faq.map((item) => item.question)).toEqual(['Como o ranking do ENEM por escola é calculado?']);
  });
});

describe('preposições por município', () => {
  it('usa artigo só onde o nome da cidade pede', () => {
    expect(municipioDe('Natal')).toBe('de Natal');
    expect(municipioEm('Natal')).toBe('em Natal');
    expect(municipioDe('Rio de Janeiro')).toBe('do Rio de Janeiro');
    expect(municipioEm('Rio de Janeiro')).toBe('no Rio de Janeiro');
  });
});

describe('JSON-LD', () => {
  it('gera a marcação FAQPage', () => {
    expect(faqJsonLd([{ question: 'P?', answer: 'R.' }])).toEqual({
      '@type': 'FAQPage',
      mainEntity: [{ '@type': 'Question', name: 'P?', acceptedAnswer: { '@type': 'Answer', text: 'R.' } }],
    });
  });

  it('escapa "<" para que nenhum nome vindo do banco feche o script', () => {
    const serialized = serializeJsonLd({ name: 'ESCOLA </script><script>alert(1)</script>' });

    expect(serialized).not.toContain('<');
    expect(JSON.parse(serialized)).toEqual({ name: 'ESCOLA </script><script>alert(1)</script>' });
  });
});
