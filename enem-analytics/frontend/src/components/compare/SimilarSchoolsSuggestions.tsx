'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, SimilarSchool, TopSchool } from '@/lib/api';
import { Trophy, Target, TrendingUp, ChevronRight, Search } from 'lucide-react';

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
  const [activeTab, setActiveTab] = useState<TabType>('benchmarks');

  // Fetch similar schools
  const { data: similarData, isLoading: loadingSimilar } = useQuery({
    queryKey: ['similar', schoolCode],
    queryFn: () => api.getSimilarSchools(schoolCode, 10, true),
    enabled: !!schoolCode,
  });

  // Fetch improved similar schools
  const { data: improvedData, isLoading: loadingImproved } = useQuery({
    queryKey: ['similar-improved', schoolCode],
    queryFn: () => api.getSimilarImprovedSchools(schoolCode, 5, 30),
    enabled: !!schoolCode,
  });

  // Fetch top schools for benchmarks
  const { data: topData, isLoading: loadingTop } = useQuery({
    queryKey: ['top-schools', 2024],
    queryFn: () => api.getTopSchools(10, 2024),
    enabled: !!schoolCode,
  });

  const isLoading = loadingSimilar || loadingImproved || loadingTop;

  // Filter similar schools as competitors (close in ranking)
  const competitors = similarData?.similar_schools?.slice(0, 5) || [];

  // Top schools as benchmarks
  const benchmarks = topData?.schools?.slice(0, 5) || [];

  // Success stories
  const successStories = improvedData?.improved_similar_schools || [];

  const tabs = [
    { id: 'benchmarks' as TabType, label: 'Benchmarks', icon: Trophy, count: benchmarks.length },
    { id: 'competitors' as TabType, label: 'Concorrentes', icon: Target, count: competitors.length },
    { id: 'success' as TabType, label: 'Casos de Sucesso', icon: TrendingUp, count: successStories.length },
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
                      🎯 Escolas similares ao seu perfil (mesmo cluster)
                    </p>
                    {competitors.map((school: SimilarSchool) =>
                      renderSchoolItem(
                        school.codigo_inep,
                        school.nome_escola,
                        <p className="text-sm text-gray-500">
                          {school.tipo_escola} • Porte {school.porte}
                        </p>
                      )
                    )}
                  </div>
                ) : (
                  <p className="p-4 text-sm text-gray-500 text-center">
                    Nenhum concorrente encontrado
                  </p>
                )}
              </>
            )}

            {/* Success Stories Tab */}
            {activeTab === 'success' && (
              <>
                {successStories.length > 0 ? (
                  <div>
                    <p className="px-4 py-2 text-xs text-gray-500 bg-gray-50">
                      📈 Escolas similares que melhoraram significativamente
                    </p>
                    {successStories.map((school) =>
                      renderSchoolItem(
                        school.codigo_inep,
                        school.nome_escola,
                        <p className="text-sm text-green-600 font-medium">
                          +{school.improvement?.toFixed(0)} pts de melhoria
                        </p>
                      )
                    )}
                    {improvedData?.insight && (
                      <p className="px-4 py-3 text-xs text-amber-700 bg-amber-50 border-t border-amber-100">
                        💡 {improvedData.insight}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="p-4 text-sm text-gray-500 text-center">
                    Nenhum caso de sucesso encontrado
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
