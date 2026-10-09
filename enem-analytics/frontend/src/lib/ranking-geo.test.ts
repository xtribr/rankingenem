import { describe, expect, it } from 'vitest';

import { findMunicipioBySlug, municipioPath, parseUfParam, slugify, ufDe, ufEm, ufPath } from './ranking-geo';

describe('slugify', () => {
  it('remove acentos, cedilha e pontuação', () => {
    expect(slugify('São Paulo')).toBe('sao-paulo');
    expect(slugify('Açu')).toBe('acu');
    expect(slugify("Olho-d'Água do Borges")).toBe('olho-d-agua-do-borges');
    expect(slugify('Ceará-Mirim')).toBe('ceara-mirim');
  });
});

describe('parseUfParam', () => {
  it('aceita somente siglas válidas em minúsculas', () => {
    expect(parseUfParam('rn')).toBe('RN');
    expect(parseUfParam('RN')).toBeNull();
    expect(parseUfParam('escola')).toBeNull();
    expect(parseUfParam('xx')).toBeNull();
  });
});

describe('findMunicipioBySlug', () => {
  const municipios = ['Açu', 'Ceará-Mirim', 'Natal'];

  it('devolve o nome original do município', () => {
    expect(findMunicipioBySlug(municipios, 'ceara-mirim')).toBe('Ceará-Mirim');
    expect(findMunicipioBySlug(municipios, 'acu')).toBe('Açu');
  });

  it('devolve null quando o slug não existe', () => {
    expect(findMunicipioBySlug(municipios, 'mossoro')).toBeNull();
  });
});

describe('preposições por estado', () => {
  it('usa artigo quando o estado pede', () => {
    expect(ufDe('RN')).toBe('do Rio Grande do Norte');
    expect(ufDe('BA')).toBe('da Bahia');
    expect(ufDe('MG')).toBe('de Minas Gerais');
    expect(ufEm('RN')).toBe('no Rio Grande do Norte');
    expect(ufEm('PB')).toBe('na Paraíba');
    expect(ufEm('SP')).toBe('em São Paulo');
  });
});

describe('paths', () => {
  it('monta as URLs públicas de estado e município', () => {
    expect(ufPath('RN')).toBe('/ranking-enem/rn');
    expect(municipioPath('RN', 'Ceará-Mirim')).toBe('/ranking-enem/rn/ceara-mirim');
  });
});
