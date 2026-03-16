'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { api, API_BASE } from '@/lib/api';
import Link from 'next/link';
import {
  ArrowLeft,
  TrendingUp,
  Target,
  Zap,
  BookOpen,
  Download,
  FileText,
  Brain,
  Sparkles,
  ChevronRight,
  Users,
  Award,
  BarChart3,
  GraduationCap,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  RadialBarChart,
  RadialBar,
  Legend,
} from 'recharts';

export default function RoadmapPage() {
  const params = useParams();
  const codigo_inep = params.codigo_inep as string;
  const [isExporting, setIsExporting] = useState(false);

  const { data: school } = useQuery({
    queryKey: ['school', codigo_inep],
    queryFn: () => api.getSchool(codigo_inep),
  });

  const { data: roadmap, isLoading: roadmapLoading } = useQuery({
    queryKey: ['roadmap', codigo_inep],
    queryFn: () => api.getRoadmap(codigo_inep),
  });

  const { data: predictions } = useQuery({
    queryKey: ['predictions', codigo_inep],
    queryFn: () => api.getPredictions(codigo_inep),
  });

  const { data: cluster } = useQuery({
    queryKey: ['cluster', codigo_inep],
    queryFn: () => api.getSchoolCluster(codigo_inep),
  });

  const { data: schoolMaterials } = useQuery({
    queryKey: ['schoolMaterials', codigo_inep],
    queryFn: () => api.getSchoolMaterials(codigo_inep),
  });

  const { data: triRecommendations } = useQuery({
    queryKey: ['triRecommendations', codigo_inep],
    queryFn: () => api.getTriRecommendations(codigo_inep),
  });

  const { data: mlRecommendations } = useQuery({
    queryKey: ['mlRecommendations', codigo_inep],
    queryFn: () => api.getRecommendations(codigo_inep),
  });

  if (roadmapLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const areaColors: Record<string, string> = {
    LC: '#3B82F6',
    CH: '#8B5CF6',
    CN: '#10B981',
    MT: '#F59E0B',
    redacao: '#EF4444',
  };

  const areaNames: Record<string, string> = {
    LC: 'Linguagens',
    CH: 'Humanas',
    CN: 'Natureza',
    MT: 'Matemática',
    redacao: 'Redação',
  };

  // Prepare chart data
  const areaChartData = triRecommendations?.recommendations?.map((rec: any) => ({
    area: rec.area,
    name: areaNames[rec.area] || rec.area,
    score: rec.predicted_score || 0,
    target: (rec.predicted_score || 0) * 1.05,
    fill: areaColors[rec.area] || '#6B7280',
  })) || [];

  // Progress radial data
  const currentScore = roadmap?.current_position?.nota_media_estimada || 0;
  const targetScore = roadmap?.target_position?.nota_media_alvo || 800;
  const progressPercent = Math.round((currentScore / 800) * 100);

  const radialData = [
    { name: 'Progresso', value: progressPercent, fill: '#3B82F6' },
  ];

  const handleExportPlan = async () => {
    setIsExporting(true);
    try {
      await api.downloadExportPlan(codigo_inep);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Page Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href={`/schools/${codigo_inep}`}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="h-5 w-5 text-slate-600" />
              </Link>
              <div>
                <h1 className="text-xl font-bold text-slate-900">Plano de Melhoria</h1>
                <p className="text-sm text-slate-500">
                  {school?.nome_escola || 'Carregando...'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {cluster && (
                <span className="px-3 py-1.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
                  {cluster.persona?.name}
                </span>
              )}
              <span className="text-sm text-slate-500">INEP: {codigo_inep}</span>
              <button
                type="button"
                onClick={handleExportPlan}
                disabled={isExporting}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <Download className="h-4 w-4" />
                {isExporting ? 'Exportando...' : 'Exportar Plano CSV'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 py-6">
        {/* Top Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Current Score Card */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
            <div className="flex items-start justify-between">
              <div className="h-12 w-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <BarChart3 className="h-6 w-6 text-blue-600" />
              </div>
              <span className="flex items-center gap-1 text-xs font-semibold text-green-600 bg-green-50 px-2 py-1 rounded-full">
                +{roadmap?.target_position?.melhoria_esperada?.toFixed(0) || 0}%
              </span>
            </div>
            <p className="text-3xl font-bold text-slate-900 mt-4">
              {currentScore.toFixed(0)}
            </p>
            <p className="text-sm text-slate-500 mt-1">Média Atual</p>
          </div>

          {/* Target Score Card */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
            <div className="flex items-start justify-between">
              <div className="h-12 w-12 bg-indigo-100 rounded-xl flex items-center justify-center">
                <Target className="h-6 w-6 text-indigo-600" />
              </div>
              <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full">
                Meta 2025
              </span>
            </div>
            <p className="text-3xl font-bold text-slate-900 mt-4">
              {targetScore.toFixed(0)}
            </p>
            <p className="text-sm text-slate-500 mt-1">Média Alvo</p>
          </div>

          {/* Quick Wins Card */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
            <div className="flex items-start justify-between">
              <div className="h-12 w-12 bg-amber-100 rounded-xl flex items-center justify-center">
                <Zap className="h-6 w-6 text-amber-600" />
              </div>
              <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                Rápido
              </span>
            </div>
            <p className="text-3xl font-bold text-slate-900 mt-4">
              {mlRecommendations?.quick_wins?.length || 0}
            </p>
            <p className="text-sm text-slate-500 mt-1">Quick Wins</p>
          </div>

          {/* Phases Card */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
            <div className="flex items-start justify-between">
              <div className="h-12 w-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <BookOpen className="h-6 w-6 text-purple-600" />
              </div>
              <span className="text-xs font-semibold text-purple-600 bg-purple-50 px-2 py-1 rounded-full">
                Plano
              </span>
            </div>
            <p className="text-3xl font-bold text-slate-900 mt-4">
              {roadmap?.phases?.length || 0}
            </p>
            <p className="text-sm text-slate-500 mt-1">Fases de Melhoria</p>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Bar Chart - Scores by Area */}
          <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Desempenho por Área</h3>
                <p className="text-sm text-slate-500">Notas TRI previstas para 2025</p>
              </div>
              <select className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white">
                <option>Este ano</option>
                <option>Comparar anos</option>
              </select>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart data={areaChartData} barGap={8}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#64748B" />
                  <YAxis domain={[400, 850]} tick={{ fontSize: 12 }} stroke="#64748B" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #E2E8F0',
                      borderRadius: '12px',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    }}
                    formatter={(value) => [`${(value as number)?.toFixed(0) ?? 0} pts`, 'Nota']}
                  />
                  <Bar dataKey="score" radius={[8, 8, 0, 0]} maxBarSize={60}>
                    {areaChartData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Radial Progress Chart */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Progresso Geral</h3>
              <p className="text-sm text-slate-500">Meta: {targetScore.toFixed(0)} pontos</p>
            </div>
            <div className="h-56 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <RadialBarChart
                  cx="50%"
                  cy="50%"
                  innerRadius="60%"
                  outerRadius="90%"
                  barSize={20}
                  data={radialData}
                  startAngle={90}
                  endAngle={-270}
                >
                  <RadialBar
                    background={{ fill: '#E2E8F0' }}
                    dataKey="value"
                    cornerRadius={10}
                  />
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="absolute text-center">
                <p className="text-3xl font-bold text-slate-900">{progressPercent}%</p>
                <p className="text-sm text-slate-500">da meta</p>
              </div>
            </div>
            {/* Area breakdown */}
            <div className="space-y-2 mt-4">
              {areaChartData.slice(0, 4).map((area: any) => (
                <div key={area.area} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: area.fill }}
                    />
                    <span className="text-sm text-slate-600">{area.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900">
                      {area.score?.toFixed(0)}
                    </span>
                    <span className="text-xs text-green-600">+5%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
          {/* Left: Phases + Content by Area */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            {/* Phases - Compact */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-8 w-8 bg-indigo-100 rounded-lg flex items-center justify-center">
                  <BookOpen className="h-4 w-4 text-indigo-600" />
                </div>
                <h3 className="font-semibold text-slate-900">Fases do Plano</h3>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {roadmap?.phases?.map((phase: any, idx: number) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-xl border transition-all ${
                      idx === 0 ? 'border-blue-300 bg-blue-50' : 'border-slate-100 bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div
                        className={`h-6 w-6 rounded-lg flex items-center justify-center text-white text-xs font-bold ${
                          idx === 0 ? 'bg-blue-600' : 'bg-slate-400'
                        }`}
                      >
                        {phase.phase || idx + 1}
                      </div>
                      <span className="text-xs font-semibold text-slate-900">{phase.name}</span>
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-2 mb-2">{phase.description}</p>
                    <span className="text-xs font-medium text-green-600">+{phase.expected_gain?.toFixed(0) || 0} pts</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Content by Area */}
            {triRecommendations && (
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex-1 flex flex-col">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-8 w-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <BarChart3 className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">Conteúdos por Área</h3>
                    <p className="text-xs text-slate-500">Questões recomendadas por TRI</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 flex-1">
                  {triRecommendations.recommendations?.map((rec: any) => (
                    <div key={rec.area} className="border-l-4 bg-slate-50 rounded-r-xl p-3 flex flex-col" style={{ borderLeftColor: areaColors[rec.area] }}>
                      <div className="flex items-center gap-2 mb-2">
                        <div
                          className="h-6 w-6 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: areaColors[rec.area] }}
                        >
                          <span className="text-white text-xs font-bold">{rec.area}</span>
                        </div>
                        <span className="text-sm font-medium text-slate-900">{rec.area_name}</span>
                      </div>

                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        rec.range_info?.label === 'Elite' ? 'bg-purple-100 text-purple-700' :
                        rec.range_info?.label === 'Excelência' ? 'bg-indigo-100 text-indigo-700' :
                        rec.range_info?.label === 'Avançado' ? 'bg-blue-100 text-blue-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {rec.range_info?.label}
                      </span>

                      {/* BrainX Themes */}
                      {rec.key_themes?.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1">
                          {rec.key_themes.slice(0, 3).map((theme: string, idx: number) => (
                            <span key={idx} className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-[10px] rounded">
                              {theme}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Sample Content */}
                      <div className="mt-3 space-y-1.5 flex-1">
                        {rec.sample_content?.slice(0, 10).map((content: any, idx: number) => (
                          <div key={idx} className="text-xs p-2 bg-white rounded-lg border border-slate-100">
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-blue-600 font-semibold">{content.habilidade}</span>
                              {content.tri_score && (
                                <span className="text-[10px] font-medium text-slate-500 whitespace-nowrap">
                                  {content.tri_score} pts
                                </span>
                              )}
                            </div>
                            <p className="text-slate-600 mt-0.5">{content.descricao}</p>
                          </div>
                        ))}
                      </div>

                      {/* Stretch Goals - always at bottom */}
                      <div className="mt-auto pt-3 border-t border-slate-200">
                        {rec.stretch_goals?.length > 0 ? (
                          <>
                            <p className="text-[10px] text-slate-400 mb-1.5">Metas avançadas:</p>
                            {rec.stretch_goals.slice(0, 2).map((goal: any, idx: number) => (
                              <div key={idx} className="text-[10px] text-slate-500">
                                <span className="font-medium">{goal.habilidade}</span> - {goal.tri_score} pts
                              </div>
                            ))}
                          </>
                        ) : (
                          <p className="text-[10px] text-slate-400 text-center">Bom desempenho nesta área</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column */}
          <div className="flex flex-col gap-6">
            {/* Quick Wins */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
              <div className="flex items-center gap-3 mb-5">
                <div className="h-10 w-10 bg-amber-100 rounded-xl flex items-center justify-center">
                  <Zap className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">Quick Wins</h3>
                  <p className="text-xs text-slate-500">{mlRecommendations?.quick_wins?.length || 0} oportunidades</p>
                </div>
              </div>

              <div className="space-y-3">
                {mlRecommendations?.quick_wins?.slice(0, 4).map((win: any, idx: number) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="h-8 w-8 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: `${areaColors[win.area] || '#6B7280'}20` }}
                      >
                        <span
                          className="text-xs font-bold"
                          style={{ color: areaColors[win.area] || '#6B7280' }}
                        >
                          {win.area}
                        </span>
                      </div>
                      <span className="text-sm font-medium text-slate-700">{win.area_name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-green-600">
                        +{win.expected_gain?.toFixed(0)}
                      </span>
                      <ChevronRight className="h-4 w-4 text-slate-400" />
                    </div>
                  </div>
                ))}
                {(!mlRecommendations?.quick_wins || mlRecommendations.quick_wins.length === 0) && (
                  <p className="text-sm text-slate-400 text-center py-4">Analisando...</p>
                )}
              </div>
            </div>


            {/* Download Materials - Filtered by School's TRI Range */}
            {schoolMaterials && schoolMaterials.total_materials > 0 && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex-1 flex flex-col">
                <div className="flex items-center gap-3 mb-5">
                  <div className="h-10 w-10 bg-green-100 rounded-xl flex items-center justify-center">
                    <Download className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">Material de Estudo</h3>
                    <p className="text-xs text-slate-500">Listas TRI para seu nível</p>
                  </div>
                </div>

                <div className="p-3 bg-blue-50 rounded-xl mb-4">
                  <p className="text-xs text-blue-800">
                    <span className="font-semibold">Prezado gestor,</span> materiais filtrados pela amplitude TRI recomendada para sua escola.
                  </p>
                </div>

                <div className="space-y-2 flex-1 overflow-y-auto max-h-80">
                  {['LC', 'CH', 'CN', 'MT'].map((area) => {
                    const areaData = schoolMaterials.materials_by_area?.[area];
                    if (!areaData || areaData.materials.length === 0) return null;

                    return (
                      <div key={area} className="p-3 bg-slate-50 rounded-xl">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div
                              className="h-6 w-6 rounded-lg flex items-center justify-center"
                              style={{ backgroundColor: areaColors[area] }}
                            >
                              <span className="text-white text-xs font-bold">{area}</span>
                            </div>
                            <span className="text-sm font-medium text-slate-900">
                              {areaNames[area]}
                            </span>
                          </div>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            areaData.amplitude?.label === 'Elite' ? 'bg-purple-100 text-purple-700' :
                            areaData.amplitude?.label === 'Excelência' ? 'bg-indigo-100 text-indigo-700' :
                            areaData.amplitude?.label === 'Avançado' ? 'bg-blue-100 text-blue-700' :
                            areaData.amplitude?.label === 'Intermediário' ? 'bg-green-100 text-green-700' :
                            'bg-amber-100 text-amber-700'
                          }`}>
                            {areaData.amplitude?.label} ({areaData.recommended_range})
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 mb-2">
                          Score: {areaData.predicted_score?.toFixed(0)} pts • {areaData.total_files} arquivos
                        </div>
                        <div className="space-y-1">
                          {areaData.materials.slice(0, 3).map((mat, idx) => (
                            <a
                              key={idx}
                              href={`${API_BASE}${mat.download_url}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 text-xs text-blue-600 hover:text-blue-800"
                            >
                              <FileText className="h-3 w-3" />
                              <span className="truncate">{mat.filename}</span>
                              <span className="text-[10px] text-slate-400">({mat.format})</span>
                            </a>
                          ))}
                          {areaData.materials.length > 3 && (
                            <p className="text-[10px] text-slate-400">
                              +{areaData.materials.length - 3} mais arquivos
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
