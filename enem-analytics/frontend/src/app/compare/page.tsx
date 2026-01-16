'use client';

import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Search, GitCompare, FileDown } from 'lucide-react';
import {
  SummaryCards,
  RadarComparison,
  BarComparison,
  EvolutionChart,
  CompetitiveAnalysis,
  RankingComparison,
  SimilarSchoolsSuggestions,
  PDFExportModal,
  QuickWinsComparison,
  SuccessStoriesComparison,
} from '@/components/compare';

export default function ComparePage() {
  const [search1, setSearch1] = useState('');
  const [search2, setSearch2] = useState('');
  const [school1, setSchool1] = useState<string | null>(null);
  const [school2, setSchool2] = useState<string | null>(null);
  const [school1Name, setSchool1Name] = useState('');
  const [school2Name, setSchool2Name] = useState('');
  const [showPdfModal, setShowPdfModal] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Search queries
  const { data: results1 } = useQuery({
    queryKey: ['search', search1],
    queryFn: () => api.searchSchools(search1, 5),
    enabled: search1.length >= 2,
  });

  const { data: results2 } = useQuery({
    queryKey: ['search', search2],
    queryFn: () => api.searchSchools(search2, 5),
    enabled: search2.length >= 2,
  });

  // Basic comparison (existing endpoint)
  const { data: comparison, isLoading: comparing } = useQuery({
    queryKey: ['compare', school1, school2],
    queryFn: () => api.compareSchools(school1!, school2!),
    enabled: !!school1 && !!school2,
  });

  // Diagnosis comparison (detailed by area)
  const { data: diagnosisComparison, isLoading: loadingDiagnosis } = useQuery({
    queryKey: ['diagnosis-compare', school1, school2],
    queryFn: () => api.compareDiagnosis(school1!, school2!),
    enabled: !!school1 && !!school2,
  });

  // School histories for trend calculation
  const { data: history1 } = useQuery({
    queryKey: ['history', school1],
    queryFn: () => api.getSchoolHistory(school1!),
    enabled: !!school1,
  });

  const { data: history2 } = useQuery({
    queryKey: ['history', school2],
    queryFn: () => api.getSchoolHistory(school2!),
    enabled: !!school2,
  });

  // Top school for reference
  const { data: topData } = useQuery({
    queryKey: ['top-school', 2024],
    queryFn: () => api.getTopSchools(1, 2024),
    enabled: !!school1 && !!school2,
  });

  const isLoading = comparing || loadingDiagnosis;

  // Calculate trends from history
  const calculateTrend = (history: typeof history1) => {
    if (!history?.history || history.history.length < 2) return null;
    const validYears = history.history.filter(h => h.nota_media !== null);
    if (validYears.length < 2) return null;
    const firstScore = validYears[0].nota_media!;
    const lastScore = validYears[validYears.length - 1].nota_media!;
    return (lastScore - firstScore) / (validYears.length - 1);
  };

  // Get latest scores
  const getLatestScore = (history: typeof history1) => {
    if (!history?.history || history.history.length === 0) return null;
    const latest = history.history[history.history.length - 1];
    return latest.nota_media;
  };

  const getLatestRanking = (history: typeof history1) => {
    if (!history?.history || history.history.length === 0) return null;
    const latest = history.history[history.history.length - 1];
    return latest.ranking_brasil;
  };

  // Top scores by area for reference
  const topScores: Record<string, number> = {
    CN: topData?.schools[0]?.nota_cn || 850,
    CH: topData?.schools[0]?.nota_ch || 850,
    LC: topData?.schools[0]?.nota_lc || 850,
    MT: topData?.schools[0]?.nota_mt || 900,
    redacao: topData?.schools[0]?.nota_redacao || 980,
  };

  const handleSelectSchool1 = (codigo: string, nome: string) => {
    setSchool1(codigo);
    setSchool1Name(nome);
    setSearch1(nome);
  };

  const handleSelectSchool2 = (codigo: string, nome: string) => {
    setSchool2(codigo);
    setSchool2Name(nome);
    setSearch2(nome);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Comparar Escolas</h1>
          <p className="text-gray-600 mt-1">
            Compare o desempenho de duas escolas lado a lado
          </p>
        </div>
        {comparison && (
          <button
            onClick={() => setShowPdfModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <FileDown className="h-4 w-4" />
            Exportar PDF
          </button>
        )}
      </div>

      {/* School Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* School 1 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Escola 1</h3>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar escola..."
              value={search1}
              onChange={(e) => {
                setSearch1(e.target.value);
                if (school1) setSchool1(null);
              }}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          {results1 && search1.length >= 2 && !school1 && (
            <div className="mt-2 border border-gray-200 rounded-lg overflow-hidden">
              {results1.map((s) => (
                <button
                  key={s.codigo_inep}
                  onClick={() => handleSelectSchool1(s.codigo_inep, s.nome_escola)}
                  className="w-full px-4 py-2 text-left hover:bg-gray-50 border-b last:border-b-0"
                >
                  <p className="font-medium text-gray-900">{s.nome_escola}</p>
                  <p className="text-sm text-gray-500">{s.uf} - {s.codigo_inep}</p>
                </button>
              ))}
            </div>
          )}
          {school1 && (
            <div className="mt-2 p-3 bg-blue-50 rounded-lg">
              <p className="font-medium text-blue-900">{school1Name}</p>
              <button
                onClick={() => {
                  setSchool1(null);
                  setSchool1Name('');
                  setSearch1('');
                }}
                className="text-sm text-blue-600 hover:text-blue-800 mt-1"
              >
                Alterar
              </button>
            </div>
          )}
        </div>

        {/* School 2 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Escola 2</h3>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar escola..."
              value={search2}
              onChange={(e) => {
                setSearch2(e.target.value);
                if (school2) setSchool2(null);
              }}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
            />
          </div>
          {results2 && search2.length >= 2 && !school2 && (
            <div className="mt-2 border border-gray-200 rounded-lg overflow-hidden">
              {results2.map((s) => (
                <button
                  key={s.codigo_inep}
                  onClick={() => handleSelectSchool2(s.codigo_inep, s.nome_escola)}
                  className="w-full px-4 py-2 text-left hover:bg-gray-50 border-b last:border-b-0"
                >
                  <p className="font-medium text-gray-900">{s.nome_escola}</p>
                  <p className="text-sm text-gray-500">{s.uf} - {s.codigo_inep}</p>
                </button>
              ))}
            </div>
          )}
          {school2 && (
            <div className="mt-2 p-3 bg-green-50 rounded-lg">
              <p className="font-medium text-green-900">{school2Name}</p>
              <button
                onClick={() => {
                  setSchool2(null);
                  setSchool2Name('');
                  setSearch2('');
                }}
                className="text-sm text-green-600 hover:text-green-800 mt-1"
              >
                Alterar
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Suggestions Panel - Show when school1 is selected */}
      {school1 && !school2 && (
        <SimilarSchoolsSuggestions
          schoolCode={school1}
          schoolName={school1Name}
          onSelectSchool={handleSelectSchool2}
        />
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )}

      {/* Comparison Results */}
      {comparison && diagnosisComparison && !isLoading && (
        <div ref={contentRef} className="space-y-6">
          {/* Summary Cards */}
          <div data-section="summary">
            <SummaryCards
              school1={{
                codigo_inep: school1!,
                nome_escola: school1Name,
                nota_media: getLatestScore(history1),
                ranking: getLatestRanking(history1),
                tendencia: calculateTrend(history1),
                winsIn: [],
              }}
              school2={{
                codigo_inep: school2!,
                nome_escola: school2Name,
                nota_media: getLatestScore(history2),
                ranking: getLatestRanking(history2),
                tendencia: calculateTrend(history2),
                winsIn: [],
              }}
              diagnosisComparison={diagnosisComparison}
            />
          </div>

          {/* Radar Chart */}
          <div data-section="radar">
            <RadarComparison
              diagnosisComparison={diagnosisComparison}
              topScores={topScores}
              school1Name={school1Name}
              school2Name={school2Name}
            />
          </div>

          {/* Bar Chart */}
          <div data-section="bars">
            <BarComparison
              diagnosisComparison={diagnosisComparison}
              topScores={topScores}
              school1Name={school1Name}
              school2Name={school2Name}
            />
          </div>

          {/* Evolution Chart */}
          <div data-section="evolution">
            <EvolutionChart
              comparison={comparison.comparison}
              school1Name={school1Name}
              school2Name={school2Name}
              topScore={topData?.schools[0]?.nota_media || undefined}
            />
          </div>

          {/* Competitive Analysis */}
          <div data-section="competitive">
            <CompetitiveAnalysis
              diagnosisComparison={diagnosisComparison}
              school1Name={school1Name}
              school2Name={school2Name}
              perspectiveSchool={1}
            />
          </div>

          {/* Quick Wins Comparison */}
          <div data-section="quickwins">
            <QuickWinsComparison
              school1Code={school1!}
              school2Code={school2!}
              school1Name={school1Name}
              school2Name={school2Name}
            />
          </div>

          {/* Success Stories Comparison */}
          <div data-section="success-stories">
            <SuccessStoriesComparison
              school1Code={school1!}
              school2Code={school2!}
              school1Name={school1Name}
              school2Name={school2Name}
            />
          </div>

          {/* Rankings */}
          <div data-section="rankings">
            <RankingComparison
              school1={{
                codigo_inep: school1!,
                nome_escola: school1Name,
                uf: comparison.escola1.uf,
                tipo_escola: diagnosisComparison.school_1.info.tipo_escola,
                porte: diagnosisComparison.school_1.info.porte,
                ranking: {
                  brasil: getLatestRanking(history1),
                },
              }}
              school2={{
                codigo_inep: school2!,
                nome_escola: school2Name,
                uf: comparison.escola2.uf,
                tipo_escola: diagnosisComparison.school_2.info.tipo_escola,
                porte: diagnosisComparison.school_2.info.porte,
                ranking: {
                  brasil: getLatestRanking(history2),
                },
              }}
            />
          </div>
        </div>
      )}

      {/* Empty State */}
      {!school1 && !school2 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <GitCompare className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">Selecione duas escolas para comparar</h3>
          <p className="text-gray-500 mt-2">
            Busque e selecione as escolas nos campos acima para ver a comparação
          </p>
        </div>
      )}

      {/* PDF Export Modal */}
      <PDFExportModal
        isOpen={showPdfModal}
        onClose={() => setShowPdfModal(false)}
        school1Name={school1Name}
        school2Name={school2Name}
        contentRef={contentRef}
      />
    </div>
  );
}
