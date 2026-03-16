'use client';

import { useQuery } from '@tanstack/react-query';
import { api, Recommendation } from '@/lib/api';
import { Zap, TrendingUp, Target, ArrowRight, Loader2 } from 'lucide-react';
import { formatTriScore } from '@/lib/utils';

interface QuickWinsComparisonProps {
  school1Code: string;
  school2Code: string;
  school1Name: string;
  school2Name: string;
}

const AREA_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  MT: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  LC: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  CH: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  CN: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
  redacao: { bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-200' },
};

const DIFFICULTY_LABELS: Record<string, { label: string; color: string }> = {
  low: { label: 'Fácil', color: 'text-green-600' },
  medium: { label: 'Médio', color: 'text-amber-600' },
  high: { label: 'Difícil', color: 'text-red-600' },
};

function QuickWinCard({ win, schoolColor }: { win: Recommendation; schoolColor: 'blue' | 'green' }) {
  const areaColor = AREA_COLORS[win.area] || AREA_COLORS.MT;
  const difficulty = DIFFICULTY_LABELS[win.difficulty] || DIFFICULTY_LABELS.medium;

  return (
    <div className={`p-4 rounded-lg border ${areaColor.border} ${areaColor.bg}`}>
      <div className="flex items-start justify-between mb-2">
        <span className={`font-semibold ${areaColor.text}`}>{win.area_name}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full bg-white ${difficulty.color}`}>
          {difficulty.label}
        </span>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-600">Atual:</span>
          <span className="font-medium">{formatTriScore(win.current_score)} pts</span>
          <ArrowRight className="h-3 w-3 text-gray-400" />
          <span className="text-gray-600">Meta:</span>
          <span className={`font-medium ${schoolColor === 'blue' ? 'text-blue-600' : 'text-green-600'}`}>
            {formatTriScore(win.target_score)} pts
          </span>
        </div>

        <div className="flex items-center gap-2">
          <TrendingUp className={`h-4 w-4 ${schoolColor === 'blue' ? 'text-blue-500' : 'text-green-500'}`} />
          <span className={`text-sm font-semibold ${schoolColor === 'blue' ? 'text-blue-600' : 'text-green-600'}`}>
            +{formatTriScore(win.expected_gain)} pts potenciais
          </span>
        </div>

        {win.gap_to_mean < 0 && (
          <p className="text-xs text-gray-500">
            Gap para média: {formatTriScore(win.gap_to_mean)} pts
          </p>
        )}
      </div>
    </div>
  );
}

function CommonOpportunitiesSection({
  commonAreas,
  school1Wins,
  school2Wins,
  school1Name,
  school2Name,
}: {
  commonAreas: string[];
  school1Wins: Recommendation[];
  school2Wins: Recommendation[];
  school1Name: string;
  school2Name: string;
}) {
  if (commonAreas.length === 0) return null;

  return (
    <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-green-50 rounded-xl border border-gray-200">
      <div className="flex items-center gap-2 mb-3">
        <Target className="h-5 w-5 text-purple-600" />
        <h3 className="font-semibold text-gray-900">Oportunidades em Comum</h3>
      </div>
      <p className="text-sm text-gray-600 mb-3">
        Ambas as escolas podem melhorar em:
      </p>
      <div className="flex flex-wrap gap-2">
        {commonAreas.map(area => {
          const win1 = school1Wins.find(w => w.area === area);
          const win2 = school2Wins.find(w => w.area === area);
          const areaColor = AREA_COLORS[area] || AREA_COLORS.MT;

          return (
            <div key={area} className={`px-3 py-2 rounded-lg ${areaColor.bg} border ${areaColor.border}`}>
              <span className={`font-medium ${areaColor.text}`}>
                {win1?.area_name || win2?.area_name || area}
              </span>
              <div className="text-xs text-gray-600 mt-1">
                {school1Name.slice(0, 15)}: +{win1?.expected_gain !== undefined ? formatTriScore(win1.expected_gain) : '?'} pts
                <br />
                {school2Name.slice(0, 15)}: +{win2?.expected_gain !== undefined ? formatTriScore(win2.expected_gain) : '?'} pts
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function QuickWinsComparison({
  school1Code,
  school2Code,
  school1Name,
  school2Name,
}: QuickWinsComparisonProps) {
  const { data: quickWins1, isLoading: loading1 } = useQuery({
    queryKey: ['quickWins', school1Code],
    queryFn: () => api.getQuickWins(school1Code, 5),
    enabled: !!school1Code,
  });

  const { data: quickWins2, isLoading: loading2 } = useQuery({
    queryKey: ['quickWins', school2Code],
    queryFn: () => api.getQuickWins(school2Code, 5),
    enabled: !!school2Code,
  });

  const isLoading = loading1 || loading2;

  // Find common areas of opportunity
  const school1Areas = new Set(quickWins1?.quick_wins.map(w => w.area) || []);
  const school2Areas = new Set(quickWins2?.quick_wins.map(w => w.area) || []);
  const commonAreas = [...school1Areas].filter(a => school2Areas.has(a));

  // Calculate total potential improvement
  const total1 = quickWins1?.quick_wins.reduce((sum, w) => sum + w.expected_gain, 0) || 0;
  const total2 = quickWins2?.quick_wins.reduce((sum, w) => sum + w.expected_gain, 0) || 0;

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          <span className="ml-2 text-gray-500">Carregando oportunidades de melhoria...</span>
        </div>
      </div>
    );
  }

  // If both schools have no quick wins, they're probably top performers
  if ((!quickWins1?.quick_wins?.length) && (!quickWins2?.quick_wins?.length)) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="h-5 w-5 text-amber-500" />
          <h2 className="text-xl font-semibold text-gray-900">Quick Wins - Oportunidades de Melhoria</h2>
        </div>
        <div className="text-center py-8 text-gray-500">
          <p>Ambas as escolas já apresentam desempenho excelente em todas as áreas!</p>
          <p className="text-sm mt-2">Não há gaps significativos para corrigir.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-2">
        <Zap className="h-5 w-5 text-amber-500" />
        <h2 className="text-xl font-semibold text-gray-900">Quick Wins - Oportunidades de Melhoria</h2>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Áreas onde cada escola pode ganhar pontos rapidamente com esforço direcionado
      </p>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-center justify-between">
            <span className="text-sm text-blue-600 font-medium">
              {school1Name.slice(0, 25)}
            </span>
            <span className="text-lg font-bold text-blue-700">
              +{formatTriScore(total1)} pts
            </span>
          </div>
          <p className="text-xs text-blue-600 mt-1">
            Potencial de melhoria com {quickWins1?.quick_wins?.length || 0} ações
          </p>
        </div>

        <div className="p-4 bg-green-50 rounded-lg border border-green-200">
          <div className="flex items-center justify-between">
            <span className="text-sm text-green-600 font-medium">
              {school2Name.slice(0, 25)}
            </span>
            <span className="text-lg font-bold text-green-700">
              +{formatTriScore(total2)} pts
            </span>
          </div>
          <p className="text-xs text-green-600 mt-1">
            Potencial de melhoria com {quickWins2?.quick_wins?.length || 0} ações
          </p>
        </div>
      </div>

      {/* Side by Side Quick Wins */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* School 1 Quick Wins */}
        <div>
          <h3 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
            <div className="h-3 w-3 bg-blue-500 rounded-full"></div>
            {school1Name.slice(0, 20)} - Prioridades
          </h3>
          {quickWins1?.quick_wins?.length ? (
            <div className="space-y-3">
              {quickWins1.quick_wins.slice(0, 3).map((win, idx) => (
                <QuickWinCard key={`${win.area}-${idx}`} win={win} schoolColor="blue" />
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 italic p-4 bg-gray-50 rounded-lg">
              Escola com desempenho excelente - sem gaps significativos
            </p>
          )}
        </div>

        {/* School 2 Quick Wins */}
        <div>
          <h3 className="font-semibold text-green-800 mb-3 flex items-center gap-2">
            <div className="h-3 w-3 bg-green-500 rounded-full"></div>
            {school2Name.slice(0, 20)} - Prioridades
          </h3>
          {quickWins2?.quick_wins?.length ? (
            <div className="space-y-3">
              {quickWins2.quick_wins.slice(0, 3).map((win, idx) => (
                <QuickWinCard key={`${win.area}-${idx}`} win={win} schoolColor="green" />
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 italic p-4 bg-gray-50 rounded-lg">
              Escola com desempenho excelente - sem gaps significativos
            </p>
          )}
        </div>
      </div>

      {/* Common Opportunities */}
      <CommonOpportunitiesSection
        commonAreas={commonAreas}
        school1Wins={quickWins1?.quick_wins || []}
        school2Wins={quickWins2?.quick_wins || []}
        school1Name={school1Name}
        school2Name={school2Name}
      />

      {/* Insight Box */}
      {(quickWins1?.recommendation || quickWins2?.recommendation) && (
        <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm text-amber-800">
            <strong>💡 Insight:</strong>{' '}
            {total1 > total2
              ? `${school1Name.slice(0, 20)} tem mais margem para crescimento (+${formatTriScore(total1 - total2)} pts de potencial a mais)`
              : total2 > total1
              ? `${school2Name.slice(0, 20)} tem mais margem para crescimento (+${formatTriScore(total2 - total1)} pts de potencial a mais)`
              : 'Ambas as escolas têm potencial de melhoria similar'}
          </p>
        </div>
      )}
    </div>
  );
}
