'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatNumber, formatRanking, formatTriScore } from '@/lib/utils';
import Link from 'next/link';
import { Search, ChevronLeft, ChevronRight, Bell, School as SchoolIcon } from 'lucide-react';

const UF_OPTIONS = [
  '', 'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS',
  'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'
];

const PORTE_OPTIONS = [
  { value: '', label: 'Todos os Portes' },
  { value: '1', label: 'Até 30 concluintes' },
  { value: '2', label: '31-100 concluintes' },
  { value: '3', label: '101-200 concluintes' },
  { value: '4', label: '201-400 concluintes' },
  { value: '5', label: '400+ concluintes' },
];

export default function SchoolsPage() {
  const [search, setSearch] = useState('');
  const [uf, setUf] = useState('');
  const [tipoEscola, setTipoEscola] = useState<'Privada' | 'Pública' | ''>('');
  const [localizacao, setLocalizacao] = useState<'Urbana' | 'Rural' | ''>('');
  const [porte, setPorte] = useState('');
  const [page, setPage] = useState(1);
  const limit = 50;

  const { data: schools, isLoading } = useQuery({
    queryKey: ['schools', search, uf, tipoEscola, localizacao, porte, page],
    queryFn: () => api.listSchools({
      page,
      limit,
      search: search || undefined,
      uf: uf || undefined,
      tipo_escola: tipoEscola || undefined,
      localizacao: localizacao || undefined,
      porte: porte ? parseInt(porte) : undefined,
      order_by: 'ranking',
      order: 'asc'
    }),
  });

  const hasMore = schools?.length === limit;

  return (
    <div className="min-h-screen">
      {/* Page Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-blue-100 rounded-xl flex items-center justify-center">
                <SchoolIcon className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">Escolas</h1>
                <p className="text-sm text-slate-500">Busque e filtre escolas por nome ou estado</p>
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
      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por nome ou código INEP..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
          </div>
          <div className="w-full md:w-48">
            <select
              value={uf}
              onChange={(e) => {
                setUf(e.target.value);
                setPage(1);
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
            >
              <option value="">Todos os Estados</option>
              {UF_OPTIONS.filter(Boolean).map((state) => (
                <option key={state} value={state}>{state}</option>
              ))}
            </select>
          </div>
          <div className="w-full md:w-40">
            <select
              value={tipoEscola}
              onChange={(e) => {
                setTipoEscola(e.target.value as 'Privada' | 'Pública' | '');
                setPage(1);
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
            >
              <option value="">Todas as Redes</option>
              <option value="Privada">Privada</option>
              <option value="Pública">Pública</option>
            </select>
          </div>
          <div className="w-full md:w-36">
            <select
              value={localizacao}
              onChange={(e) => {
                setLocalizacao(e.target.value as 'Urbana' | 'Rural' | '');
                setPage(1);
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
            >
              <option value="">Todas Localizações</option>
              <option value="Urbana">Urbana</option>
              <option value="Rural">Rural</option>
            </select>
          </div>
          <div className="w-full md:w-52">
            <select
              value={porte}
              onChange={(e) => {
                setPorte(e.target.value);
                setPage(1);
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
            >
              {PORTE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : schools?.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            Nenhuma escola encontrada
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ranking
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Escola
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      UF
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tipo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Porte
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Concluintes
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Nota Média
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {schools?.map((school) => (
                    <tr key={school.codigo_inep} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-gray-900 font-medium">
                          {formatRanking(school.ultimo_ranking)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <Link
                          href={`/schools/${school.codigo_inep}`}
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          {school.nome_escola}
                        </Link>
                        <p className="text-gray-500 text-sm">{school.codigo_inep}</p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {school.uf && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {school.uf}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {school.tipo_escola && (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            school.tipo_escola === 'Privada'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {school.tipo_escola}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {school.porte_label && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                            {school.porte_label}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-gray-600">
                        {school.qt_matriculas ? formatNumber(school.qt_matriculas) : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right font-semibold text-gray-900">
                        {formatTriScore(school.ultima_nota)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </button>
              <span className="text-sm text-gray-600">Página {page}</span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={!hasMore}
                className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Próxima
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </>
        )}
      </div>
      </div>
    </div>
  );
}
