'use client';

import { useQuery } from '@tanstack/react-query';
import { api, SuccessStory } from '@/lib/api';
import { Star, TrendingUp, Users, Sparkles, Loader2, ArrowUpRight, School } from 'lucide-react';

interface SuccessStoriesComparisonProps {
  school1Code: string;
  school2Code: string;
  school1Name: string;
  school2Name: string;
}

const AREA_COLORS: Record<string, string> = {
  MT: 'text-blue-600',
  LC: 'text-purple-600',
  CH: 'text-amber-600',
  CN: 'text-green-600',
  redacao: 'text-pink-600',
};

const AREA_BG: Record<string, string> = {
  MT: 'bg-blue-100',
  LC: 'bg-purple-100',
  CH: 'bg-amber-100',
  CN: 'bg-green-100',
  redacao: 'bg-pink-100',
};

function SuccessStoryCard({ story, schoolColor }: { story: SuccessStory; schoolColor: 'blue' | 'green' }) {
  const borderColor = schoolColor === 'blue' ? 'border-blue-200' : 'border-green-200';
  const headerBg = schoolColor === 'blue' ? 'bg-blue-50' : 'bg-green-50';

  // Find the area with biggest improvement
  const sortedAreas = Object.entries(story.area_changes)
    .sort(([, a], [, b]) => b.change - a.change);
  const topArea = sortedAreas[0];
  const topAreaCode = topArea?.[0] || 'MT';

  return (
    <div className={`rounded-xl border-2 ${borderColor} overflow-hidden`}>
      {/* Header */}
      <div className={`${headerBg} p-4`}>
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-gray-900 truncate text-sm" title={story.nome_escola}>
              {story.nome_escola}
            </h4>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-gray-500">{story.tipo_escola}</span>
              <span className="text-xs text-gray-400">•</span>
              <span className="text-xs text-gray-500">
                {story.similarity_score.toFixed(0)}% similar
              </span>
            </div>
          </div>
          <div className={`flex items-center gap-1 px-2 py-1 rounded-full ${schoolColor === 'blue' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
            <TrendingUp className="h-3 w-3" />
            <span className="text-xs font-bold">+{story.improvement.toFixed(0)}</span>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-4 bg-white">
        {/* Key Insight */}
        <div className={`flex items-center gap-2 mb-3 p-2 rounded-lg ${AREA_BG[topAreaCode]}`}>
          <Sparkles className={`h-4 w-4 ${AREA_COLORS[topAreaCode]}`} />
          <span className={`text-sm font-medium ${AREA_COLORS[topAreaCode]}`}>
            {(story as SuccessStory & { key_insight?: string }).key_insight || `+${topArea[1].change.toFixed(0)} pts em ${topAreaCode}`}
          </span>
        </div>

        {/* Area Changes - Top 3 */}
        <div className="space-y-2">
          {sortedAreas.slice(0, 3).map(([area, data]) => (
            <div key={area} className="flex items-center justify-between text-sm">
              <span className={`font-medium ${AREA_COLORS[area]}`}>
                {area === 'redacao' ? 'Redação' : area}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-gray-400 text-xs">
                  {data.before.toFixed(0)} → {data.after.toFixed(0)}
                </span>
                <span className={`font-semibold ${data.change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {data.change > 0 ? '+' : ''}{data.change.toFixed(0)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function InsightPanel({
  stories1,
  stories2,
  school1Name,
  school2Name,
}: {
  stories1: SuccessStory[];
  stories2: SuccessStory[];
  school1Name: string;
  school2Name: string;
}) {
  // Analyze common patterns
  const getTopImprovement = (stories: SuccessStory[]) => {
    const areaCounts: Record<string, { count: number; totalGain: number }> = {};
    stories.forEach(story => {
      Object.entries(story.area_changes).forEach(([area, data]) => {
        if (!areaCounts[area]) areaCounts[area] = { count: 0, totalGain: 0 };
        if (data.change > 50) {
          areaCounts[area].count++;
          areaCounts[area].totalGain += data.change;
        }
      });
    });
    return Object.entries(areaCounts)
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, 2);
  };

  const patterns1 = getTopImprovement(stories1);
  const patterns2 = getTopImprovement(stories2);

  const avgImprovement1 = stories1.length > 0
    ? stories1.reduce((sum, s) => sum + s.improvement, 0) / stories1.length
    : 0;
  const avgImprovement2 = stories2.length > 0
    ? stories2.reduce((sum, s) => sum + s.improvement, 0) / stories2.length
    : 0;

  return (
    <div className="mt-6 p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border border-purple-200">
      <div className="flex items-center gap-2 mb-3">
        <Star className="h-5 w-5 text-purple-600" />
        <h3 className="font-semibold text-gray-900">Padrões de Sucesso</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-gray-600 mb-2">
            <strong className="text-blue-600">{school1Name.slice(0, 20)}</strong>
          </p>
          <ul className="space-y-1 text-gray-700">
            <li>• Escolas similares melhoraram em média <strong>+{avgImprovement1.toFixed(0)} pts</strong></li>
            {patterns1.length > 0 && (
              <li>• Principal foco: <strong className={AREA_COLORS[patterns1[0][0]]}>
                {patterns1[0][0] === 'redacao' ? 'Redação' : patterns1[0][0]}
              </strong> ({patterns1[0][1].count} escolas)</li>
            )}
          </ul>
        </div>

        <div>
          <p className="text-gray-600 mb-2">
            <strong className="text-green-600">{school2Name.slice(0, 20)}</strong>
          </p>
          <ul className="space-y-1 text-gray-700">
            <li>• Escolas similares melhoraram em média <strong>+{avgImprovement2.toFixed(0)} pts</strong></li>
            {patterns2.length > 0 && (
              <li>• Principal foco: <strong className={AREA_COLORS[patterns2[0][0]]}>
                {patterns2[0][0] === 'redacao' ? 'Redação' : patterns2[0][0]}
              </strong> ({patterns2[0][1].count} escolas)</li>
            )}
          </ul>
        </div>
      </div>

      {/* Common advice */}
      <div className="mt-4 p-3 bg-white rounded-lg">
        <p className="text-sm text-gray-700">
          <strong>💡 O que escolas de sucesso fizeram:</strong> A maioria focou em
          <strong className="text-pink-600"> Redação</strong> como área de maior ganho
          (até +200 pts possíveis), seguida de
          <strong className="text-blue-600"> Matemática</strong> e
          <strong className="text-green-600"> Ciências da Natureza</strong>.
        </p>
      </div>
    </div>
  );
}

export default function SuccessStoriesComparison({
  school1Code,
  school2Code,
  school1Name,
  school2Name,
}: SuccessStoriesComparisonProps) {
  const { data: stories1, isLoading: loading1 } = useQuery({
    queryKey: ['successStories', school1Code],
    queryFn: () => api.getSuccessStories(school1Code, 3),
    enabled: !!school1Code,
  });

  const { data: stories2, isLoading: loading2 } = useQuery({
    queryKey: ['successStories', school2Code],
    queryFn: () => api.getSuccessStories(school2Code, 3),
    enabled: !!school2Code,
  });

  const isLoading = loading1 || loading2;

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          <span className="ml-2 text-gray-500">Buscando casos de sucesso...</span>
        </div>
      </div>
    );
  }

  const hasStories1 = stories1?.success_stories && stories1.success_stories.length > 0;
  const hasStories2 = stories2?.success_stories && stories2.success_stories.length > 0;

  if (!hasStories1 && !hasStories2) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Users className="h-5 w-5 text-purple-600" />
          <h2 className="text-xl font-semibold text-gray-900">Casos de Sucesso</h2>
        </div>
        <div className="text-center py-8 text-gray-500">
          <School className="h-12 w-12 mx-auto mb-3 text-gray-300" />
          <p>Não encontramos escolas similares com histórico de melhoria significativa.</p>
          <p className="text-sm mt-2">Isso pode indicar que as escolas já estão entre as melhores do país!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-2">
        <Users className="h-5 w-5 text-purple-600" />
        <h2 className="text-xl font-semibold text-gray-900">Casos de Sucesso</h2>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Escolas similares que melhoraram significativamente - aprenda com elas!
      </p>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-center justify-between">
            <span className="text-sm text-blue-700 font-medium">
              Referências para {school1Name.slice(0, 18)}
            </span>
            <span className="text-sm font-bold text-blue-800">
              {stories1?.total_found || 0} escolas
            </span>
          </div>
        </div>
        <div className="p-3 bg-green-50 rounded-lg border border-green-200">
          <div className="flex items-center justify-between">
            <span className="text-sm text-green-700 font-medium">
              Referências para {school2Name.slice(0, 18)}
            </span>
            <span className="text-sm font-bold text-green-800">
              {stories2?.total_found || 0} escolas
            </span>
          </div>
        </div>
      </div>

      {/* Side by Side Stories */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* School 1 Stories */}
        <div>
          <h3 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
            <div className="h-3 w-3 bg-blue-500 rounded-full"></div>
            Inspirações para {school1Name.slice(0, 15)}
          </h3>
          {hasStories1 ? (
            <div className="space-y-4">
              {stories1!.success_stories.slice(0, 2).map((story) => (
                <SuccessStoryCard key={story.codigo_inep} story={story} schoolColor="blue" />
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 italic p-4 bg-gray-50 rounded-lg">
              Escola já está entre as melhores - sem referências de melhoria
            </p>
          )}
        </div>

        {/* School 2 Stories */}
        <div>
          <h3 className="font-semibold text-green-800 mb-3 flex items-center gap-2">
            <div className="h-3 w-3 bg-green-500 rounded-full"></div>
            Inspirações para {school2Name.slice(0, 15)}
          </h3>
          {hasStories2 ? (
            <div className="space-y-4">
              {stories2!.success_stories.slice(0, 2).map((story) => (
                <SuccessStoryCard key={story.codigo_inep} story={story} schoolColor="green" />
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 italic p-4 bg-gray-50 rounded-lg">
              Escola já está entre as melhores - sem referências de melhoria
            </p>
          )}
        </div>
      </div>

      {/* Insights Panel */}
      {(hasStories1 || hasStories2) && (
        <InsightPanel
          stories1={stories1?.success_stories || []}
          stories2={stories2?.success_stories || []}
          school1Name={school1Name}
          school2Name={school2Name}
        />
      )}
    </div>
  );
}
