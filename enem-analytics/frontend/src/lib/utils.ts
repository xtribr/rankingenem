import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(num: number | null | undefined): string {
  if (num === null || num === undefined) return '-';
  return num.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}

export function formatTriScore(num: number | null | undefined): string {
  if (num === null || num === undefined) return '-';
  return num.toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

export function formatRanking(ranking: number | null | undefined): string {
  if (ranking === null || ranking === undefined) return '-';
  return `#${ranking.toLocaleString('pt-BR')}`;
}

export function getTrendColor(trend: string | null): string {
  switch (trend) {
    case 'subindo':
      return 'text-green-600';
    case 'descendo':
      return 'text-red-600';
    default:
      return 'text-gray-600';
  }
}

export function getTrendIcon(trend: string | null): string {
  switch (trend) {
    case 'subindo':
      return '↑';
    case 'descendo':
      return '↓';
    default:
      return '→';
  }
}
