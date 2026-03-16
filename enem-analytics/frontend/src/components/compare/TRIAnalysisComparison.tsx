'use client';

import { useQuery } from '@tanstack/react-query';
import { api, TRIAnalysisResult } from '@/lib/api';
import { BarChart3, Brain, Target, Loader2, TrendingUp, BookOpen, Zap } from 'lucide-react';
import { formatTriScore } from '@/lib/utils';

interface TRIAnalysisComparisonProps {
  school1Code: string;
  school2Code: string;
  school1Name: string;
  school2Name: string;
}

const AREA_COLORS: Record<string, { bg: string; text: string; bar: string }> = {
  CN: { bg: 'bg-green-50', text: 'text-green-700', bar: 'bg-green-500' },
  CH: { bg: 'bg-purple-50', text: 'text-purple-700', bar: 'bg-purple-500' },
  LC: { bg: 'bg-amber-50', text: 'text-amber-700', bar: 'bg-amber-500' },
  MT: { bg: 'bg-blue-50', text: 'text-blue-700', bar: 'bg-blue-500' },
  redacao: { bg: 'bg-pink-50', text: 'text-pink-700', bar: 'bg-pink-500' },
};

const AREA_NAMES: Record<string, string> = {
  CN: 'Ciências Natureza',
  CH: 'Ciências Humanas',
  LC: 'Linguagens',
  MT: 'Matemática',
};

function getMasteryLabel(level: number): { label: string; color: string } {
  if (level >= 0.8) return { label: 'Excelente', color: 'text-green-600' };
  if (level >= 0.6) return { label: 'Bom', color: 'text-blue-600' };
  if (level >= 0.4) return { label: 'Intermediário', color: 'text-amber-600' };
  if (level >= 0.2) return { label: 'Em Desenvolvimento', color: 'text-orange-600' };
  return { label: 'Iniciante', color: 'text-red-600' };
}

function MasteryBar({ level, color }: { level: number; color: string }) {
  const percentage = Math.min(level * 100, 100);
  return (
    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
      <div
        className={`h-full ${color} transition-all duration-500`}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}

function AreaComparisonRow({
  area,
  school1Data,
  school2Data,
  school1Name,
  school2Name,
}: {
  area: string;
  school1Data: TRIAnalysisResult['area_analysis'][0] | undefined;
  school2Data: TRIAnalysisResult['area_analysis'][0] | undefined;
  school1Name: string;
  school2Name: string;
}) {
  const colors = AREA_COLORS[area] || AREA_COLORS.MT;
  const areaName = AREA_NAMES[area] || area;

  const mastery1 = school1Data?.tri_mastery_level || 0;
  const mastery2 = school2Data?.tri_mastery_level || 0;
  const winner = mastery1 > mastery2 ? 1 : mastery2 > mastery1 ? 2 : 0;

  const score1 = school1Data?.current_score || 0;
  const score2 = school2Data?.current_score || 0;

  return (
    <div className={`p-4 rounded-lg ${colors.bg} border border-gray-200`}>
      <div className="flex items-center justify-between mb-3">
        <span className={`font-semibold ${colors.text}`}>{areaName}</span>
        {winner !== 0 && (
          <span className={`text-xs px-2 py-0.5 rounded-full ${winner === 1 ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
            {winner === 1 ? school1Name.slice(0, 12) : school2Name.slice(0, 12)} domina
          </span>
        )}
      </div>

      {/* School 1 */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-sm mb-1">
          <span className="text-blue-700 font-medium">{school1Name.slice(0, 15)}</span>
          <span className="text-gray-600">{(mastery1 * 100).toFixed(0)}% domínio</span>
        </div>
        <MasteryBar level={mastery1} color="bg-blue-500" />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>Nota: {formatTriScore(score1)}</span>
          <span>{getMasteryLabel(mastery1).label}</span>
        </div>
      </div>

      {/* School 2 */}
      <div>
        <div className="flex items-center justify-between text-sm mb-1">
          <span className="text-green-700 font-medium">{school2Name.slice(0, 15)}</span>
          <span className="text-gray-600">{(mastery2 * 100).toFixed(0)}% domínio</span>
        </div>
        <MasteryBar level={mastery2} color="bg-green-500" />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>Nota: {formatTriScore(score2)}</span>
          <span>{getMasteryLabel(mastery2).label}</span>
        </div>
      </div>

      {/* Gap indicator */}
      {Math.abs(mastery1 - mastery2) > 0.1 && (
        <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-gray-600">
          Gap: {((Math.abs(mastery1 - mastery2)) * 100).toFixed(0)}% de diferença no domínio TRI
        </div>
      )}
    </div>
  );
}

function ContentSampleCard({
  title,
  icon: Icon,
  samples,
  schoolColor,
  emptyMessage,
}: {
  title: string;
  icon: React.ElementType;
  samples: Array<{ skill: string; tri_score: number; description: string; gap?: number }>;
  schoolColor: 'blue' | 'green';
  emptyMessage: string;
}) {
  const bgColor = schoolColor === 'blue' ? 'bg-blue-50' : 'bg-green-50';
  const borderColor = schoolColor === 'blue' ? 'border-blue-200' : 'border-green-200';
  const textColor = schoolColor === 'blue' ? 'text-blue-700' : 'text-green-700';

  if (!samples || samples.length === 0) {
    return (
      <div className={`p-3 ${bgColor} rounded-lg border ${borderColor}`}>
        <div className="flex items-center gap-2 mb-2">
          <Icon className={`h-4 w-4 ${textColor}`} />
          <span className={`font-medium text-sm ${textColor}`}>{title}</span>
        </div>
        <p className="text-xs text-gray-500 italic">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={`p-3 ${bgColor} rounded-lg border ${borderColor}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`h-4 w-4 ${textColor}`} />
        <span className={`font-medium text-sm ${textColor}`}>{title}</span>
      </div>
      <div className="space-y-2">
        {samples.slice(0, 3).map((item, idx) => (
          <div key={idx} className="text-xs">
            <div className="flex items-center gap-2">
              <span className={`font-mono font-bold ${textColor}`}>{item.skill}</span>
              <span className="text-gray-500">TRI {formatTriScore(item.tri_score)}</span>
              {item.gap && (
                <span className="text-amber-600 font-medium">+{formatTriScore(item.gap)} gap</span>
              )}
            </div>
            <p className="text-gray-600 truncate" title={item.description}>
              {item.description.slice(0, 60)}...
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TRIAnalysisComparison({
  school1Code,
  school2Code,
  school1Name,
  school2Name,
}: TRIAnalysisComparisonProps) {
  const { data: tri1, isLoading: loading1 } = useQuery({
    queryKey: ['triAnalysis', school1Code],
    queryFn: () => api.getTRIAnalysis(school1Code),
    enabled: !!school1Code,
  });

  const { data: tri2, isLoading: loading2 } = useQuery({
    queryKey: ['triAnalysis', school2Code],
    queryFn: () => api.getTRIAnalysis(school2Code),
    enabled: !!school2Code,
  });

  const isLoading = loading1 || loading2;

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          <span className="ml-2 text-gray-500">Analisando domínio TRI...</span>
        </div>
      </div>
    );
  }

  if (!tri1 && !tri2) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="h-5 w-5 text-indigo-600" />
          <h2 className="text-xl font-semibold text-gray-900">Análise TRI</h2>
        </div>
        <div className="text-center py-8 text-gray-500">
          <Brain className="h-12 w-12 mx-auto mb-3 text-gray-300" />
          <p>Análise TRI não disponível para estas escolas.</p>
        </div>
      </div>
    );
  }

  const mastery1 = tri1?.overall_tri_mastery || 0;
  const mastery2 = tri2?.overall_tri_mastery || 0;
  const masteryLabel1 = getMasteryLabel(mastery1);
  const masteryLabel2 = getMasteryLabel(mastery2);

  // Get areas that both schools have
  const areas = ['CN', 'CH', 'LC', 'MT'];

  // Determine who dominates more areas
  let school1Wins = 0;
  let school2Wins = 0;
  areas.forEach(area => {
    const m1 = tri1?.area_analysis.find(a => a.area === area)?.tri_mastery_level || 0;
    const m2 = tri2?.area_analysis.find(a => a.area === area)?.tri_mastery_level || 0;
    if (m1 > m2) school1Wins++;
    else if (m2 > m1) school2Wins++;
  });

  // Get sample content for display
  const getAreaSamples = (tri: TRIAnalysisResult | undefined, type: 'accessible' | 'stretch') => {
    if (!tri?.area_analysis) return [];
    const allSamples: Array<{ skill: string; tri_score: number; description: string; gap?: number }> = [];
    tri.area_analysis.forEach(area => {
      const samples = type === 'accessible' ? area.accessible_content_sample : area.stretch_content_sample;
      if (samples) {
        allSamples.push(...samples.slice(0, 2));
      }
    });
    return allSamples.slice(0, 4);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-2">
        <BarChart3 className="h-5 w-5 text-indigo-600" />
        <h2 className="text-xl font-semibold text-gray-900">Análise TRI - Teoria de Resposta ao Item</h2>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Nível de domínio por dificuldade de questão: quem acerta as fáceis vs as difíceis?
      </p>

      {/* Overall Mastery Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium text-blue-800">{school1Name.slice(0, 20)}</span>
            <Brain className="h-5 w-5 text-blue-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-blue-700">{(mastery1 * 100).toFixed(0)}%</span>
            <span className={`text-sm font-medium ${masteryLabel1.color}`}>{masteryLabel1.label}</span>
          </div>
          <MasteryBar level={mastery1} color="bg-blue-500" />
          <p className="text-xs text-blue-600 mt-2">
            Domina {school1Wins} de 4 áreas
          </p>
        </div>

        <div className="p-4 bg-green-50 rounded-xl border border-green-200">
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium text-green-800">{school2Name.slice(0, 20)}</span>
            <Brain className="h-5 w-5 text-green-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-green-700">{(mastery2 * 100).toFixed(0)}%</span>
            <span className={`text-sm font-medium ${masteryLabel2.color}`}>{masteryLabel2.label}</span>
          </div>
          <MasteryBar level={mastery2} color="bg-green-500" />
          <p className="text-xs text-green-600 mt-2">
            Domina {school2Wins} de 4 áreas
          </p>
        </div>
      </div>

      {/* Per-Area Comparison */}
      <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
        <Target className="h-4 w-4 text-gray-600" />
        Domínio por Área
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {areas.map(area => (
          <AreaComparisonRow
            key={area}
            area={area}
            school1Data={tri1?.area_analysis.find(a => a.area === area)}
            school2Data={tri2?.area_analysis.find(a => a.area === area)}
            school1Name={school1Name}
            school2Name={school2Name}
          />
        ))}
      </div>

      {/* Content Samples */}
      <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
        <BookOpen className="h-4 w-4 text-gray-600" />
        Conteúdos ao Alcance vs Desafiadores
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* School 1 Content */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-blue-700">{school1Name.slice(0, 20)}</h4>
          <ContentSampleCard
            title="Ao Alcance (pode dominar agora)"
            icon={Zap}
            samples={getAreaSamples(tri1, 'accessible')}
            schoolColor="blue"
            emptyMessage="Já domina a maioria dos conteúdos"
          />
          <ContentSampleCard
            title="Desafiador (próximo passo)"
            icon={TrendingUp}
            samples={getAreaSamples(tri1, 'stretch')}
            schoolColor="blue"
            emptyMessage="Todos os conteúdos estão ao alcance"
          />
        </div>

        {/* School 2 Content */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-green-700">{school2Name.slice(0, 20)}</h4>
          <ContentSampleCard
            title="Ao Alcance (pode dominar agora)"
            icon={Zap}
            samples={getAreaSamples(tri2, 'accessible')}
            schoolColor="green"
            emptyMessage="Já domina a maioria dos conteúdos"
          />
          <ContentSampleCard
            title="Desafiador (próximo passo)"
            icon={TrendingUp}
            samples={getAreaSamples(tri2, 'stretch')}
            schoolColor="green"
            emptyMessage="Todos os conteúdos estão ao alcance"
          />
        </div>
      </div>

      {/* Insight */}
      <div className="mt-6 p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
        <div className="flex items-start gap-3">
          <Brain className="h-5 w-5 text-indigo-600 mt-0.5" />
          <div>
            <h4 className="font-semibold text-indigo-900">Interpretação TRI</h4>
            <p className="text-sm text-indigo-800 mt-1">
              {mastery1 > mastery2 ? (
                <>
                  <strong>{school1Name.slice(0, 20)}</strong> tem domínio TRI superior ({((mastery1 - mastery2) * 100).toFixed(0)}% à frente).
                  Isso significa que acerta mais questões <em>difíceis</em> do ENEM, demonstrando conhecimento mais profundo.
                </>
              ) : mastery2 > mastery1 ? (
                <>
                  <strong>{school2Name.slice(0, 20)}</strong> tem domínio TRI superior ({((mastery2 - mastery1) * 100).toFixed(0)}% à frente).
                  Isso significa que acerta mais questões <em>difíceis</em> do ENEM, demonstrando conhecimento mais profundo.
                </>
              ) : (
                <>
                  Ambas as escolas têm domínio TRI similar. A diferença está nos conteúdos específicos que cada uma domina melhor.
                </>
              )}
            </p>
            <p className="text-xs text-indigo-600 mt-2">
              💡 TRI mede a profundidade do conhecimento: não basta acertar, é preciso acertar as questões certas.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
