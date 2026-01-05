'use client';

import { Medal, Globe, MapPin, Building2, GraduationCap } from 'lucide-react';

interface RankingData {
  brasil: number | null;
  estado?: number | null;
  porte?: number | null;
  tipo?: number | null;
}

interface SchoolContext {
  codigo_inep: string;
  nome_escola: string;
  uf?: string | null;
  tipo_escola?: string | null;
  porte?: number | null;
  ranking: RankingData;
}

interface RankingComparisonProps {
  school1: SchoolContext;
  school2: SchoolContext;
  totalSchools?: number;
  totalByState?: Record<string, number>;
}

function formatRanking(rank: number | null | undefined): string {
  if (rank === null || rank === undefined) return '-';
  return `#${rank.toLocaleString('pt-BR')}`;
}

function getPercentile(rank: number, total: number): number {
  return ((total - rank) / total) * 100;
}

export default function RankingComparison({
  school1,
  school2,
  totalSchools = 15000,
  totalByState,
}: RankingComparisonProps) {
  // Calculate rankings comparison
  const rankings = [
    {
      label: 'Brasil',
      icon: Globe,
      school1: school1.ranking.brasil,
      school2: school2.ranking.brasil,
      total: totalSchools,
    },
    {
      label: school1.uf && school2.uf && school1.uf === school2.uf
        ? `Estado (${school1.uf})`
        : 'Estado',
      icon: MapPin,
      school1: school1.ranking.estado,
      school2: school2.ranking.estado,
      total: totalByState?.[school1.uf || ''] || 2000,
    },
    {
      label: 'Mesmo Porte',
      icon: Building2,
      school1: school1.ranking.porte,
      school2: school2.ranking.porte,
      total: 3000,
    },
    {
      label: school1.tipo_escola === school2.tipo_escola
        ? school1.tipo_escola || 'Tipo'
        : 'Tipo de Escola',
      icon: GraduationCap,
      school1: school1.ranking.tipo,
      school2: school2.ranking.tipo,
      total: school1.tipo_escola === 'Privada' ? 5000 : 10000,
    },
  ];

  // Calculate percentiles for Brazil ranking
  const percentile1 = school1.ranking.brasil
    ? getPercentile(school1.ranking.brasil, totalSchools)
    : null;
  const percentile2 = school2.ranking.brasil
    ? getPercentile(school2.ranking.brasil, totalSchools)
    : null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-2">
        <Medal className="h-5 w-5 text-amber-500" />
        <h2 className="text-xl font-semibold text-gray-900">Rankings e Posição Relativa</h2>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Posição no ranking por diferentes perspectivas (2024)
      </p>

      {/* Rankings Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Ranking</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-blue-600">
                {school1.nome_escola.slice(0, 20)}
              </th>
              <th className="px-4 py-3 text-right text-sm font-medium text-green-600">
                {school2.nome_escola.slice(0, 20)}
              </th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">Diferença</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rankings.map(ranking => {
              const diff = ranking.school1 && ranking.school2
                ? ranking.school2 - ranking.school1
                : null;
              const Icon = ranking.icon;

              return (
                <tr key={ranking.label} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-700">{ranking.label}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-semibold text-blue-600">
                      {formatRanking(ranking.school1)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-semibold text-green-600">
                      {formatRanking(ranking.school2)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {diff !== null && (
                      <span className={`text-sm font-medium ${
                        diff > 0 ? 'text-blue-600' : diff < 0 ? 'text-green-600' : 'text-gray-500'
                      }`}>
                        {diff > 0 ? '+' : ''}{diff} pos
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Visual Position Gauge */}
      {school1.ranking.brasil && school2.ranking.brasil && (
        <div className="mt-6 p-4 bg-gray-50 rounded-xl">
          <h4 className="text-sm font-medium text-gray-700 mb-3">
            Posição no Ranking Brasil ({totalSchools.toLocaleString('pt-BR')} escolas)
          </h4>
          <div className="relative h-8 bg-gradient-to-r from-green-200 via-yellow-200 to-red-200 rounded-full overflow-hidden">
            {/* TOP markers */}
            <div className="absolute top-0 left-[1%] h-full w-0.5 bg-green-600 opacity-50"></div>
            <div className="absolute top-0 left-[5%] h-full w-0.5 bg-yellow-600 opacity-50"></div>
            <div className="absolute top-0 left-[10%] h-full w-0.5 bg-orange-600 opacity-50"></div>

            {/* School 1 marker */}
            <div
              className="absolute top-1 h-6 w-6 bg-blue-500 rounded-full border-2 border-white shadow-md flex items-center justify-center"
              style={{ left: `${Math.max(1, Math.min(95, (school1.ranking.brasil / totalSchools) * 100))}%`, transform: 'translateX(-50%)' }}
            >
              <span className="text-xs font-bold text-white">1</span>
            </div>

            {/* School 2 marker */}
            <div
              className="absolute top-1 h-6 w-6 bg-green-500 rounded-full border-2 border-white shadow-md flex items-center justify-center"
              style={{ left: `${Math.max(1, Math.min(95, (school2.ranking.brasil / totalSchools) * 100))}%`, transform: 'translateX(-50%)' }}
            >
              <span className="text-xs font-bold text-white">2</span>
            </div>
          </div>

          {/* Labels */}
          <div className="flex justify-between mt-2 text-xs text-gray-500">
            <span>TOP 1%</span>
            <span>TOP 5%</span>
            <span>TOP 10%</span>
            <span className="text-right">Demais</span>
          </div>
        </div>
      )}

      {/* Context Cards */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* School 1 Context */}
        {percentile1 !== null && (
          <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>{school1.nome_escola.slice(0, 20)}</strong> supera{' '}
              <strong>{percentile1.toFixed(1)}%</strong> das escolas do Brasil
            </p>
            {percentile1 >= 99 && (
              <span className="inline-block mt-1 text-xs bg-blue-200 text-blue-800 px-2 py-0.5 rounded">
                🏆 Elite Educacional - TOP 1%
              </span>
            )}
            {percentile1 >= 95 && percentile1 < 99 && (
              <span className="inline-block mt-1 text-xs bg-blue-200 text-blue-800 px-2 py-0.5 rounded">
                ⭐ TOP 5% Nacional
              </span>
            )}
          </div>
        )}

        {/* School 2 Context */}
        {percentile2 !== null && (
          <div className="p-3 bg-green-50 border border-green-100 rounded-lg">
            <p className="text-sm text-green-800">
              <strong>{school2.nome_escola.slice(0, 20)}</strong> supera{' '}
              <strong>{percentile2.toFixed(1)}%</strong> das escolas do Brasil
            </p>
            {percentile2 >= 99 && (
              <span className="inline-block mt-1 text-xs bg-green-200 text-green-800 px-2 py-0.5 rounded">
                🏆 Elite Educacional - TOP 1%
              </span>
            )}
            {percentile2 >= 95 && percentile2 < 99 && (
              <span className="inline-block mt-1 text-xs bg-green-200 text-green-800 px-2 py-0.5 rounded">
                ⭐ TOP 5% Nacional
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
