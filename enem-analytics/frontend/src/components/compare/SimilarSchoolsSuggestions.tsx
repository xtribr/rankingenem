'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, TopSchool } from '@/lib/api';
import { Trophy, Target, TrendingUp, ChevronRight, Search, MapPin } from 'lucide-react';

interface SimilarSchoolsSuggestionsProps {
  schoolCode: string;
  schoolName: string;
  onSelectSchool: (codigo_inep: string, nome_escola: string) => void;
}

type TabType = 'benchmarks' | 'competitors' | 'success';

export default function SimilarSchoolsSuggestions({
  schoolCode,
  schoolName,
  onSelectSchool,
}: SimilarSchoolsSuggestionsProps) {
  const [activeTab, setActiveTab] = useState<TabType>('competitors');

  // Fetch school info to get UF and ranking
  const { data: schoolInfo, isLoading: loadingSchoolInfo } = useQuery({
    queryKey: ['school-history', schoolCode],
    queryFn: () => api.getSchoolHistory(schoolCode),
    enabled: !!schoolCode,
  });

  // Extract school's UF and current ranking
  const schoolUF = schoolInfo?.uf;
  const latestHistory = schoolInfo?.history?.[schoolInfo.history.length - 1];
  const schoolRanking = latestHistory?.ranking_brasil;

  // Fetch top schools from same region (for competitors - need enough to filter those above)
  const { data: regionalTopData, isLoading: loadingRegionalTop } = useQuery({
    queryKey: ['regional-top-schools', schoolUF, 2024],
    queryFn: () => api.getTopSchools(50, 2024, schoolUF || undefined),
    enabled: !!schoolCode && !!schoolUF,
  });

  // Fetch top 2 schools from same region (for success stories / benchmarks)
  const { data: regionalBenchmarks, isLoading: loadingBenchmarks } = useQuery({
    queryKey: ['regional-benchmarks', schoolUF, 2024],
    queryFn: () => api.getTopSchools(2, 2024, schoolUF || undefined),
    enabled: !!schoolCode && !!schoolUF,
  });

  // Fetch national top schools for benchmarks tab
  const { data: nationalTopData, isLoading: loadingNationalTop } = useQuery({
    queryKey: ['national-top-schools', 2024],
    queryFn: () => api.getTopSchools(5, 2024),
    enabled: !!schoolCode,
  });

  const isLoading = loadingSchoolInfo || loadingRegionalTop || loadingBenchmarks || loadingNationalTop;

  // Filter competitors: schools from same region ranked above the selected school
  const competitors = useMemo(() => {
    if (!regionalTopData?.schools || !schoolRanking) return [];

    return regionalTopData.schools
      .filter((school: TopSchool) =>
        school.codigo_inep !== schoolCode &&
        school.ranking !== null &&
        school.ranking < schoolRanking
      )
      .slice(0, 5);
  }, [regionalTopData, schoolRanking, schoolCode]);

  // Top 2 schools from same region as success stories/reference
  const regionalSuccessStories = useMemo(() => {
    if (!regionalBenchmarks?.schools) return [];
    return regionalBenchmarks.schools
      .filter((school: TopSchool) => school.codigo_inep !== schoolCode)
      .slice(0, 2);
  }, [regionalBenchmarks, schoolCode]);

  // National benchmarks
  const benchmarks = nationalTopData?.schools?.slice(0, 5) || [];

  const tabs = [
    { id: 'competitors' as TabType, label: 'Concorrentes', icon: Target, count: competitors.length },
    { id: 'success' as TabType, label: 'Referência Regional', icon: TrendingUp, count: regionalSuccessStories.length },
    { id: 'benchmarks' as TabType, label: 'Top Nacional', icon: Trophy, count: benchmarks.length },
  ];

  const renderSchoolItem = (
    codigo_inep: string,
    nome_escola: string,
    extra: React.ReactNode
  ) => (
    <button
      key={codigo_inep}
      onClick={() => onSelectSchool(codigo_inep, nome_escola)}
      className="w-full p-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-0 flex items-center justify-between group transition-colors"
    >
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 truncate">{nome_escola}</p>
        {extra}
      </div>
      <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-gray-600 flex-shrink-0 ml-2" />
    </button>
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center gap-2 mb-1">
          <Search className="h-5 w-5 text-purple-600" />
          <h3 className="font-semibold text-gray-900">Sugestões de Comparação</h3>
        </div>
        <p className="text-sm text-gray-500">
          Baseado no perfil de <strong className="text-gray-700">{schoolName.slice(0, 30)}</strong>
          {schoolUF && (
            <span className="inline-flex items-center gap-1 ml-2">
              <MapPin className="h-3 w-3" />
              <span className="text-purple-600 font-medium">{schoolUF}</span>
              {schoolRanking && <span className="text-gray-400">• #{schoolRanking} Brasil</span>}
            </span>
          )}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                activeTab === tab.id
                  ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{tab.label}</span>
              {tab.count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                  activeTab === tab.id ? 'bg-purple-200 text-purple-700' : 'bg-gray-200 text-gray-600'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="max-h-80 overflow-y-auto">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600 mx-auto"></div>
            <p className="text-sm text-gray-500 mt-2">Carregando sugestões...</p>
          </div>
        ) : (
          <>
            {/* Benchmarks Tab */}
            {activeTab === 'benchmarks' && (
              <>
                {benchmarks.length > 0 ? (
                  <div>
                    <p className="px-4 py-2 text-xs text-gray-500 bg-gray-50">
                      🏆 Melhores escolas do Brasil para usar como referência
                    </p>
                    {benchmarks.map((school: TopSchool) =>
                      renderSchoolItem(
                        school.codigo_inep,
                        school.nome_escola,
                        <p className="text-sm text-gray-500">
                          #{school.ranking} Brasil • {school.nota_media?.toFixed(0)} pts
                        </p>
                      )
                    )}
                  </div>
                ) : (
                  <p className="p-4 text-sm text-gray-500 text-center">
                    Nenhum benchmark disponível
                  </p>
                )}
              </>
            )}

            {/* Competitors Tab */}
            {activeTab === 'competitors' && (
              <>
                {competitors.length > 0 ? (
                  <div>
                    <p className="px-4 py-2 text-xs text-gray-500 bg-gray-50">
                      🎯 Escolas do {schoolUF} com ranking acima da sua escola
                    </p>
                    {competitors.map((school: TopSchool) =>
                      renderSchoolItem(
                        school.codigo_inep,
                        school.nome_escola,
                        <p className="text-sm text-gray-500">
                          #{school.ranking} Brasil • {school.nota_media?.toFixed(0)} pts
                        </p>
                      )
                    )}
                  </div>
                ) : schoolRanking && schoolRanking <= 5 ? (
                  <div className="p-4 text-center">
                    <p className="text-sm text-green-600 font-medium">🎉 Parabéns!</p>
                    <p className="text-sm text-gray-500 mt-1">
                      Sua escola está entre as melhores do {schoolUF}!
                    </p>
                  </div>
                ) : (
                  <p className="p-4 text-sm text-gray-500 text-center">
                    {!schoolUF ? 'Carregando informações da escola...' : 'Nenhum concorrente encontrado'}
                  </p>
                )}
              </>
            )}

            {/* Success Stories Tab - Top 2 from same region */}
            {activeTab === 'success' && (
              <>
                {regionalSuccessStories.length > 0 ? (
                  <div>
                    <p className="px-4 py-2 text-xs text-gray-500 bg-gray-50">
                      🏆 Melhores escolas do {schoolUF} para usar como referência
                    </p>
                    {regionalSuccessStories.map((school: TopSchool) =>
                      renderSchoolItem(
                        school.codigo_inep,
                        school.nome_escola,
                        <p className="text-sm text-purple-600 font-medium">
                          #{school.ranking} Brasil • {school.nota_media?.toFixed(0)} pts
                        </p>
                      )
                    )}
                    <p className="px-4 py-3 text-xs text-purple-700 bg-purple-50 border-t border-purple-100">
                      💡 Compare com as líderes regionais para identificar oportunidades de melhoria
                    </p>
                  </div>
                ) : (
                  <p className="p-4 text-sm text-gray-500 text-center">
                    {!schoolUF ? 'Carregando informações da escola...' : 'Nenhuma referência regional encontrada'}
                  </p>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
