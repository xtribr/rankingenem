'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  Search,
  TrendingUp,
  TrendingDown,
  Trophy,
  Target,
  BarChart3,
  LineChart,
  Download,
  ChevronDown,
  Sparkles,
  Award,
  GraduationCap
} from 'lucide-react';
import {
  SimilarSchoolsSuggestions,
  PDFExportModal,
} from '@/components/compare';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  RadialBarChart,
  RadialBar,
  BarChart,
  Bar,
  Legend,
  Cell,
} from 'recharts';

// XTRI Color Palette
const COLORS = {
  purple: '#9333ea',
  purpleLight: '#a855f7',
  purpleDark: '#7c22ce',
  blue: '#3b82f6',
  blueLight: '#60a5fa',
  green: '#22c55e',
  greenLight: '#4ade80',
  amber: '#f59e0b',
  amberLight: '#fbbf24',
  gray: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
  }
};

const AREA_NAMES: Record<string, string> = {
  MT: 'Matemática',
  LC: 'Linguagens',
  CH: 'Ciências Humanas',
  CN: 'Ciências da Natureza',
  redacao: 'Redação',
};

export default function ComparePage() {
  const [search1, setSearch1] = useState('');
  const [search2, setSearch2] = useState('');
  const [school1, setSchool1] = useState<string | null>(null);
  const [school2, setSchool2] = useState<string | null>(null);
  const [school1Name, setSchool1Name] = useState('');
  const [school2Name, setSchool2Name] = useState('');
  const [showPdfModal, setShowPdfModal] = useState(false);

  // Search queries
  const { data: results1, isLoading: searching1 } = useQuery({
    queryKey: ['search', search1],
    queryFn: () => api.searchSchools(search1, 10),
    enabled: search1.length >= 1,
  });

  const { data: results2, isLoading: searching2 } = useQuery({
    queryKey: ['search', search2],
    queryFn: () => api.searchSchools(search2, 10),
    enabled: search2.length >= 1,
  });

  // Comparison data
  const { data: comparison, isLoading: comparing } = useQuery({
    queryKey: ['compare', school1, school2],
    queryFn: () => api.compareSchools(school1!, school2!),
    enabled: !!school1 && !!school2,
  });

  const { data: diagnosisComparison, isLoading: loadingDiagnosis } = useQuery({
    queryKey: ['diagnosis-compare', school1, school2],
    queryFn: () => api.compareDiagnosis(school1!, school2!),
    enabled: !!school1 && !!school2,
  });

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

  const isLoading = comparing || loadingDiagnosis;

  // Helpers
  const getLatestScore = (history: typeof history1) => {
    if (!history?.history || history.history.length === 0) return null;
    return history.history[history.history.length - 1].nota_media;
  };

  const getLatestRanking = (history: typeof history1) => {
    if (!history?.history || history.history.length === 0) return null;
    return history.history[history.history.length - 1].ranking_brasil;
  };

  const calculateTrend = (history: typeof history1) => {
    if (!history?.history || history.history.length < 2) return null;
    const validYears = history.history.filter(h => h.nota_media !== null);
    if (validYears.length < 2) return null;
    const firstScore = validYears[0].nota_media!;
    const lastScore = validYears[validYears.length - 1].nota_media!;
    return lastScore - firstScore;
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

  // Prepare chart data
  const evolutionData = comparison?.comparison?.map(year => ({
    ano: year.ano,
    [school1Name.slice(0, 15)]: year.escola1?.nota_media || null,
    [school2Name.slice(0, 15)]: year.escola2?.nota_media || null,
  })) || [];

  const areaData = diagnosisComparison?.area_comparison?.map(area => ({
    name: area.area_name,
    escola1: area.school_1_score,
    escola2: area.school_2_score,
    diff: area.difference,
  })) || [];

  // Calculate satisfaction-like metric (performance vs potential)
  const school1Score = getLatestScore(history1) || 0;
  const school2Score = getLatestScore(history2) || 0;
  const maxPossible = 1000;
  const school1Pct = Math.round((school1Score / maxPossible) * 100);
  const school2Pct = Math.round((school2Score / maxPossible) * 100);

  const radialData1 = [
    { name: 'score', value: school1Pct, fill: COLORS.blue },
  ];
  const radialData2 = [
    { name: 'score', value: school2Pct, fill: COLORS.green },
  ];

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #faf5ff 0%, #f0f9ff 50%, #f0fdf4 100%)' }}>
      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900" style={{ fontFamily: 'system-ui' }}>
            Comparar Escolas
          </h1>
          <p className="text-gray-500 mt-1">
            Analise o desempenho comparativo entre duas instituições no ENEM
          </p>
        </div>

        {/* School Selection Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* School 1 Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${COLORS.blue}15` }}>
                <GraduationCap className="w-5 h-5" style={{ color: COLORS.blue }} />
              </div>
              <h3 className="font-semibold text-gray-800">Escola 1</h3>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Digite para buscar..."
                value={search1}
                onChange={(e) => {
                  setSearch1(e.target.value);
                  if (school1) setSchool1(null);
                }}
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border-0 rounded-xl focus:ring-2 focus:bg-white outline-none transition-all"
                style={{ '--tw-ring-color': COLORS.blue } as React.CSSProperties}
              />
            </div>
            {searching1 && search1.length >= 1 && !school1 && (
              <div className="mt-2 p-3 text-center text-gray-500 text-sm">Buscando...</div>
            )}
            {results1 && results1.length > 0 && search1.length >= 1 && !school1 && !searching1 && (
              <div className="mt-2 rounded-xl overflow-hidden max-h-64 overflow-y-auto border border-gray-100">
                {results1.map((s) => (
                  <button
                    key={s.codigo_inep}
                    onClick={() => handleSelectSchool1(s.codigo_inep, s.nome_escola)}
                    className="w-full px-4 py-3 text-left hover:bg-blue-50 border-b border-gray-50 last:border-b-0 transition-colors"
                  >
                    <p className="font-medium text-gray-900 truncate">{s.nome_escola}</p>
                    <p className="text-sm text-gray-500">{s.uf} - {s.codigo_inep}</p>
                  </button>
                ))}
              </div>
            )}
            {school1 && (
              <div className="mt-3 p-4 rounded-xl border-2" style={{ borderColor: COLORS.blue, backgroundColor: `${COLORS.blue}08` }}>
                <p className="font-semibold" style={{ color: COLORS.blue }}>{school1Name}</p>
                <button
                  onClick={() => { setSchool1(null); setSchool1Name(''); setSearch1(''); }}
                  className="text-sm mt-1 hover:underline"
                  style={{ color: COLORS.blue }}
                >
                  Alterar
                </button>
              </div>
            )}
          </div>

          {/* School 2 Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${COLORS.green}15` }}>
                <GraduationCap className="w-5 h-5" style={{ color: COLORS.green }} />
              </div>
              <h3 className="font-semibold text-gray-800">Escola 2</h3>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Digite para buscar..."
                value={search2}
                onChange={(e) => {
                  setSearch2(e.target.value);
                  if (school2) setSchool2(null);
                }}
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border-0 rounded-xl focus:ring-2 focus:bg-white outline-none transition-all"
                style={{ '--tw-ring-color': COLORS.green } as React.CSSProperties}
              />
            </div>
            {searching2 && search2.length >= 1 && !school2 && (
              <div className="mt-2 p-3 text-center text-gray-500 text-sm">Buscando...</div>
            )}
            {results2 && results2.length > 0 && search2.length >= 1 && !school2 && !searching2 && (
              <div className="mt-2 rounded-xl overflow-hidden max-h-64 overflow-y-auto border border-gray-100">
                {results2.map((s) => (
                  <button
                    key={s.codigo_inep}
                    onClick={() => handleSelectSchool2(s.codigo_inep, s.nome_escola)}
                    className="w-full px-4 py-3 text-left hover:bg-green-50 border-b border-gray-50 last:border-b-0 transition-colors"
                  >
                    <p className="font-medium text-gray-900 truncate">{s.nome_escola}</p>
                    <p className="text-sm text-gray-500">{s.uf} - {s.codigo_inep}</p>
                  </button>
                ))}
              </div>
            )}
            {school2 && (
              <div className="mt-3 p-4 rounded-xl border-2" style={{ borderColor: COLORS.green, backgroundColor: `${COLORS.green}08` }}>
                <p className="font-semibold" style={{ color: COLORS.green }}>{school2Name}</p>
                <button
                  onClick={() => { setSchool2(null); setSchool2Name(''); setSearch2(''); }}
                  className="text-sm mt-1 hover:underline"
                  style={{ color: COLORS.green }}
                >
                  Alterar
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Suggestions when school1 selected */}
        {school1 && !school2 && (
          <SimilarSchoolsSuggestions
            schoolCode={school1}
            schoolName={school1Name}
            onSelectSchool={handleSelectSchool2}
          />
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2" style={{ borderColor: COLORS.purple }}></div>
          </div>
        )}

        {/* Comparison Results */}
        {comparison && diagnosisComparison && !isLoading && (
          <div className="space-y-6">

            {/* KPI Cards Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* School 1 Score */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${COLORS.blue} 0%, ${COLORS.blueLight} 100%)` }}>
                    <TrendingUp className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{school1Score.toFixed(0)}</p>
                    <p className="text-sm text-gray-500">Média Escola 1</p>
                  </div>
                </div>
              </div>

              {/* School 2 Score */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${COLORS.green} 0%, ${COLORS.greenLight} 100%)` }}>
                    <TrendingUp className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{school2Score.toFixed(0)}</p>
                    <p className="text-sm text-gray-500">Média Escola 2</p>
                  </div>
                </div>
              </div>

              {/* Ranking School 1 */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${COLORS.purple} 0%, ${COLORS.purpleLight} 100%)` }}>
                    <Trophy className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">#{getLatestRanking(history1) || '-'}</p>
                    <p className="text-sm text-gray-500">Ranking E1</p>
                  </div>
                </div>
              </div>

              {/* Ranking School 2 */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${COLORS.amber} 0%, ${COLORS.amberLight} 100%)` }}>
                    <Trophy className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">#{getLatestRanking(history2) || '-'}</p>
                    <p className="text-sm text-gray-500">Ranking E2</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Main Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* Evolution Chart - Takes 2 columns */}
              <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="px-4 py-2 bg-gray-100 rounded-lg flex items-center gap-2">
                      <LineChart className="w-4 h-4 text-gray-600" />
                      <span className="text-sm font-medium text-gray-700">Evolução Histórica</span>
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    </div>
                  </div>
                  <button
                    onClick={() => setShowPdfModal(true)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <Download className="w-5 h-5 text-gray-500" />
                  </button>
                </div>

                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={evolutionData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorSchool1" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={COLORS.blue} stopOpacity={0.3}/>
                          <stop offset="95%" stopColor={COLORS.blue} stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorSchool2" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={COLORS.green} stopOpacity={0.3}/>
                          <stop offset="95%" stopColor={COLORS.green} stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="ano" stroke="#9ca3af" fontSize={12} />
                      <YAxis stroke="#9ca3af" fontSize={12} domain={['dataMin - 20', 'dataMax + 20']} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'white',
                          border: 'none',
                          borderRadius: '12px',
                          boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey={school1Name.slice(0, 15)}
                        stroke={COLORS.blue}
                        strokeWidth={3}
                        fillOpacity={1}
                        fill="url(#colorSchool1)"
                      />
                      <Area
                        type="monotone"
                        dataKey={school2Name.slice(0, 15)}
                        stroke={COLORS.green}
                        strokeWidth={3}
                        fillOpacity={1}
                        fill="url(#colorSchool2)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Legend */}
                <div className="flex items-center justify-center gap-6 mt-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.blue }}></div>
                    <span className="text-sm text-gray-600">{school1Name.slice(0, 20)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.green }}></div>
                    <span className="text-sm text-gray-600">{school2Name.slice(0, 20)}</span>
                  </div>
                </div>
              </div>

              {/* Radial Progress Charts */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-800">Aproveitamento</h3>
                  <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                    <Download className="w-5 h-5 text-gray-500" />
                  </button>
                </div>

                {/* School 1 Radial */}
                <div className="relative h-36 mb-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadialBarChart
                      cx="50%"
                      cy="50%"
                      innerRadius="60%"
                      outerRadius="90%"
                      barSize={12}
                      data={radialData1}
                      startAngle={180}
                      endAngle={0}
                    >
                      <RadialBar
                        background={{ fill: '#f3f4f6' }}
                        dataKey="value"
                        cornerRadius={10}
                      />
                    </RadialBarChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-bold" style={{ color: COLORS.blue }}>{school1Pct}%</span>
                    <span className="text-xs text-gray-500">Escola 1</span>
                  </div>
                </div>

                {/* School 2 Radial */}
                <div className="relative h-36">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadialBarChart
                      cx="50%"
                      cy="50%"
                      innerRadius="60%"
                      outerRadius="90%"
                      barSize={12}
                      data={radialData2}
                      startAngle={180}
                      endAngle={0}
                    >
                      <RadialBar
                        background={{ fill: '#f3f4f6' }}
                        dataKey="value"
                        cornerRadius={10}
                      />
                    </RadialBarChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-bold" style={{ color: COLORS.green }}>{school2Pct}%</span>
                    <span className="text-xs text-gray-500">Escola 2</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Second Row - Performance by Area & Bar Chart */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* Performance by Area - Progress Bars */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-semibold text-gray-800">Desempenho por Área</h3>
                  <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                    <Download className="w-5 h-5 text-gray-500" />
                  </button>
                </div>

                <div className="space-y-5">
                  {areaData.map((area, idx) => (
                    <div key={area.name}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">{area.name}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold" style={{ color: COLORS.blue }}>{area.escola1.toFixed(0)}</span>
                          <span className="text-gray-300">|</span>
                          <span className="text-sm font-semibold" style={{ color: COLORS.green }}>{area.escola2.toFixed(0)}</span>
                        </div>
                      </div>
                      <div className="flex gap-1 h-2">
                        <div
                          className="rounded-l-full transition-all duration-500"
                          style={{
                            width: `${(area.escola1 / 1000) * 100}%`,
                            backgroundColor: COLORS.blue
                          }}
                        ></div>
                        <div
                          className="rounded-r-full transition-all duration-500"
                          style={{
                            width: `${(area.escola2 / 1000) * 100}%`,
                            backgroundColor: COLORS.green
                          }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Vertical Bar Chart - Score Comparison */}
              <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="px-4 py-2 bg-gray-100 rounded-lg flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-gray-600" />
                      <span className="text-sm font-medium text-gray-700">Comparativo por Área</span>
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: `${COLORS.blue}15`, color: COLORS.blue }}>
                      {school1Name.slice(0, 10)}
                    </span>
                    <span className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: `${COLORS.green}15`, color: COLORS.green }}>
                      {school2Name.slice(0, 10)}
                    </span>
                  </div>
                </div>

                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={areaData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                      <XAxis dataKey="name" stroke="#9ca3af" fontSize={11} />
                      <YAxis stroke="#9ca3af" fontSize={12} domain={[0, 1000]} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'white',
                          border: 'none',
                          borderRadius: '12px',
                          boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
                        }}
                      />
                      <Bar dataKey="escola1" name={school1Name.slice(0, 15)} fill={COLORS.blue} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="escola2" name={school2Name.slice(0, 15)} fill={COLORS.green} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Trend Indicators Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* School 1 Trend */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Tendência {school1Name.slice(0, 20)}</p>
                    <div className="flex items-center gap-2">
                      {calculateTrend(history1) !== null && (
                        <>
                          {calculateTrend(history1)! >= 0 ? (
                            <TrendingUp className="w-6 h-6" style={{ color: COLORS.green }} />
                          ) : (
                            <TrendingDown className="w-6 h-6" style={{ color: '#ef4444' }} />
                          )}
                          <span className="text-2xl font-bold text-gray-900">
                            {calculateTrend(history1)! >= 0 ? '+' : ''}{calculateTrend(history1)!.toFixed(1)}
                          </span>
                          <span className="text-gray-500">pts</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: `${COLORS.blue}10` }}>
                    <Sparkles className="w-8 h-8" style={{ color: COLORS.blue }} />
                  </div>
                </div>
              </div>

              {/* School 2 Trend */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Tendência {school2Name.slice(0, 20)}</p>
                    <div className="flex items-center gap-2">
                      {calculateTrend(history2) !== null && (
                        <>
                          {calculateTrend(history2)! >= 0 ? (
                            <TrendingUp className="w-6 h-6" style={{ color: COLORS.green }} />
                          ) : (
                            <TrendingDown className="w-6 h-6" style={{ color: '#ef4444' }} />
                          )}
                          <span className="text-2xl font-bold text-gray-900">
                            {calculateTrend(history2)! >= 0 ? '+' : ''}{calculateTrend(history2)!.toFixed(1)}
                          </span>
                          <span className="text-gray-500">pts</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: `${COLORS.green}10` }}>
                    <Sparkles className="w-8 h-8" style={{ color: COLORS.green }} />
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* Empty State */}
        {!school1 && !school2 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-16 text-center">
            <div className="w-20 h-20 rounded-2xl mx-auto mb-6 flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${COLORS.purple}20 0%, ${COLORS.blue}20 100%)` }}>
              <BarChart3 className="h-10 w-10" style={{ color: COLORS.purple }} />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Selecione duas escolas para comparar</h3>
            <p className="text-gray-500 max-w-md mx-auto">
              Busque e selecione as escolas nos campos acima para visualizar a comparação detalhada de desempenho no ENEM
            </p>
          </div>
        )}

        {/* PDF Export Modal */}
        <PDFExportModal
          isOpen={showPdfModal}
          onClose={() => setShowPdfModal(false)}
          school1Name={school1Name}
          school2Name={school2Name}
          school1Code={school1 || ''}
          school2Code={school2 || ''}
          school1Data={{
            nota_media: getLatestScore(history1),
            ranking: getLatestRanking(history1),
            uf: comparison?.escola1?.uf || undefined,
          }}
          school2Data={{
            nota_media: getLatestScore(history2),
            ranking: getLatestRanking(history2),
            uf: comparison?.escola2?.uf || undefined,
          }}
          diagnosisComparison={diagnosisComparison}
        />
      </div>
    </div>
  );
}
