export function getLatestEnemYear(years: Array<number | null | undefined> | null | undefined): number | null {
  if (!years || years.length === 0) return null;

  const validYears = years.filter((year): year is number => typeof year === 'number' && Number.isFinite(year));
  if (validYears.length === 0) return null;

  return Math.max(...validYears);
}

export function getNextEnemYear(years: Array<number | null | undefined> | null | undefined): number | null {
  const latestYear = getLatestEnemYear(years);
  return latestYear === null ? null : latestYear + 1;
}

export function getYearRangeLabel(years: Array<number | null | undefined> | null | undefined): string {
  const latestYear = getLatestEnemYear(years);
  if (latestYear === null) return '-';

  const validYears = years?.filter((year): year is number => typeof year === 'number' && Number.isFinite(year)) || [];
  const minYear = Math.min(...validYears);

  return minYear === latestYear ? `${latestYear}` : `${minYear} - ${latestYear}`;
}
