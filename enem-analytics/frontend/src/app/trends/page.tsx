'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { getLatestEnemYear } from '@/lib/enem-cycle';
import { formatRanking, formatTriScore } from '@/lib/utils';
import Link from 'next/link';
import { TrendingUp, TrendingDown, Bell } from 'lucide-react';

export default function TrendsPage() {
  const { data: topSchools } = useQuery({
    queryKey: ['topSchools', 50],
    queryFn: () => api.getTopSchools(50),
  });
  const latestYear = topSchools?.ano || null;

  return (
    <div className="min-h-screen">
      {/* Page Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-green-100 rounded-xl flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">Tendências</h1>
                <p className="text-sm text-slate-500">Análise de tendências de desempenho</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                <Bell className="h-5 w-5 text-slate-600" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-6 w-6 text-green-600" />
          <h2 className="text-xl font-semibold text-gray-900">Top 50 Escolas - {latestYear || 'último ano'}</h2>
        </div>
        <p className="text-gray-600 mb-6">
          As melhores escolas do Brasil no ENEM {latestYear || 'mais recente'}, ordenadas por ranking.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {topSchools?.schools.slice(0, 30).map((school, index) => (
            <Link
              key={school.codigo_inep}
              href={`/schools/${school.codigo_inep}`}
              className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold mb-2 ${
                    index < 3 ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-200 text-gray-700'
                  }`}>
                    {school.ranking}
                  </span>
                  <h3 className="font-medium text-gray-900 line-clamp-1">{school.nome_escola}</h3>
                  <p className="text-sm text-gray-500">{school.uf}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-blue-600">{formatTriScore(school.nota_media)}</p>
                  <p className="text-xs text-gray-500">média</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Em Breve</h2>
        <p className="text-gray-600">
          Análises avançadas de tendências em desenvolvimento:
        </p>
        <ul className="mt-4 space-y-2 text-gray-600">
          <li className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-600" />
            Escolas com maior crescimento nos últimos 3 anos
          </li>
          <li className="flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-red-600" />
            Escolas com maior queda de desempenho
          </li>
          <li className="flex items-center gap-2">
            <span className="h-4 w-4 rounded-full bg-blue-500"></span>
            Comparação entre escolas públicas e privadas
          </li>
          <li className="flex items-center gap-2">
            <span className="h-4 w-4 rounded-full bg-purple-500"></span>
            Análise por região e estado
          </li>
        </ul>
      </div>
      </div>
    </div>
  );
}
