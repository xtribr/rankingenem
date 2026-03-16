'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { formatNumber, formatRanking, formatTriScore } from '@/lib/utils';
import Link from 'next/link';
import { ArrowLeft, TrendingUp, TrendingDown, Award, BookOpen, Calculator, PenTool, Grid3X3, AlertTriangle, CheckCircle, Lightbulb, Brain, Target, Users, Sparkles, ChevronRight, Activity, BarChart3, GraduationCap } from 'lucide-react';
import { BrainXInsights } from '@/components/gliner/GLiNERInsights';
import TRIAnalysis from '@/components/predictions/TRIAnalysis';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LabelList,
} from 'recharts';

export default function SchoolDetailPage() {
  const params = useParams();
  const codigo_inep = params.codigo_inep as string;

  const { data: school, isLoading: schoolLoading } = useQuery({
    queryKey: ['school', codigo_inep],
    queryFn: () => api.getSchool(codigo_inep),
  });

  const { data: history } = useQuery({
    queryKey: ['schoolHistory', codigo_inep],
    queryFn: () => api.getSchoolHistory(codigo_inep),
  });

  // ML Analytics queries
  const { data: predictions } = useQuery({
    queryKey: ['predictions', codigo_inep],
    queryFn: () => api.getPredictions(codigo_inep, 2025),
    enabled: !!school,
  });

  const { data: diagnosis } = useQuery({
    queryKey: ['diagnosis', codigo_inep],
    queryFn: () => api.getDiagnosis(codigo_inep),
    enabled: !!school,
  });

  const { data: cluster } = useQuery({
    queryKey: ['cluster', codigo_inep],
    queryFn: () => api.getSchoolCluster(codigo_inep),
    enabled: !!school,
  });

  const { data: recommendations } = useQuery({
    queryKey: ['recommendations', codigo_inep],
    queryFn: () => api.getRecommendations(codigo_inep),
    enabled: !!school,
  });

  // Selected areas for chart - state for interactive selection (must be before early returns)
  const [selectedAreas, setSelectedAreas] = useState<string[]>(['Média']);

  if (schoolLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!school) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Escola não encontrada</p>
        <Link href="/schools" className="text-sky-500 hover:text-blue-800 mt-4 inline-block">
          ← Voltar para lista de escolas
        </Link>
      </div>
    );
  }

  const latestScore = school.historico[school.historico.length - 1];
  const previousScore = school.historico.length > 1 ? school.historico[school.historico.length - 2] : null;

  // Calculate changes
  const getChange = (current: number | null | undefined, previous: number | null | undefined) => {
    if (!current || !previous) return null;
    return ((current - previous) / previous * 100).toFixed(1);
  };

  const mediaChange = getChange(latestScore?.nota_media, previousScore?.nota_media);
  const rankingChange = previousScore?.ranking_brasil && latestScore?.ranking_brasil
    ? previousScore.ranking_brasil - latestScore.ranking_brasil
    : null;

  // Area configuration with colors
  const areaConfig: Record<string, { color: string; dataKey: string }> = {
    'Média': { color: '#3ABFF8', dataKey: 'Média' },
    'Redação': { color: '#3ABFF8', dataKey: 'Redação' },
    'Matemática': { color: '#f97316', dataKey: 'Matemática' },
    'Linguagens': { color: '#ec4899', dataKey: 'Linguagens' },
    'Humanas': { color: '#8b5cf6', dataKey: 'Humanas' },
    'Natureza': { color: '#22c55e', dataKey: 'Natureza' },
  };

  // Toggle area selection
  const toggleArea = (areaName: string) => {
    setSelectedAreas((prev) => {
      if (prev.includes(areaName)) {
        // Don't remove if it's the last one
        if (prev.length === 1) return prev;
        return prev.filter((a) => a !== areaName);
      }
      return [...prev, areaName];
    });
  };

  // Line chart data with all areas
  const lineChartData = school.historico.map((h) => ({
    ano: h.ano,
    Média: h.nota_media,
    Redação: h.nota_redacao,
    Matemática: h.nota_mt,
    Linguagens: h.nota_lc,
    Humanas: h.nota_ch,
    Natureza: h.nota_cn,
  }));

  // Pie chart data
  const pieData = latestScore ? [
    { name: 'CN', value: latestScore.nota_cn, color: '#22c55e' },
    { name: 'CH', value: latestScore.nota_ch, color: '#8b5cf6' },
    { name: 'LC', value: latestScore.nota_lc, color: '#ec4899' },
    { name: 'MT', value: latestScore.nota_mt, color: '#f97316' },
    { name: 'RED', value: latestScore.nota_redacao, color: '#3ABFF8' },
  ].filter(d => d.value) : [];

  const totalScore = pieData.reduce((acc, d) => acc + (d.value || 0), 0);
  const mediaPresentation = predictions?.areas?.media;

  // Bar data sorted
  const barData = latestScore ? [
    { name: 'Redação', nota: latestScore.nota_redacao || 0, color: '#3ABFF8', max: 1000 },
    { name: 'Matemática', nota: latestScore.nota_mt || 0, color: '#f97316', max: 1000 },
    { name: 'Linguagens', nota: latestScore.nota_lc || 0, color: '#ec4899', max: 1000 },
    { name: 'Humanas', nota: latestScore.nota_ch || 0, color: '#8b5cf6', max: 1000 },
    { name: 'Natureza', nota: latestScore.nota_cn || 0, color: '#22c55e', max: 1000 },
  ].sort((a, b) => b.nota - a.nota) : [];

  return (
    <div className="space-y-6 pb-8">
      {/* Header with gradient background */}
      <div className="relative overflow-hidden rounded-3xl p-8 text-white" style={{ background: 'linear-gradient(135deg, #3ABFF8 0%, #38bdf8 50%, #F26A4B 100%)' }}>
        <div className="relative z-10">
          {/* Back button */}
          <Link
            href="/schools"
            className="inline-flex items-center gap-2 text-white/70 hover:text-white text-sm mb-4 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar para escolas
          </Link>

          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{school.nome_escola}</h1>
              <div className="flex items-center gap-3 mt-3 text-white/80 text-sm">
                <span className="font-medium">{school.uf}</span>
                <span className="text-white/40">•</span>
                <span>INEP: {school.codigo_inep}</span>
                {school.tipo_escola && (
                  <>
                    <span className="text-white/40">•</span>
                    <span className="px-3 py-1 rounded-full bg-white/20 text-xs font-medium backdrop-blur-sm">
                      {school.tipo_escola}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
        {/* Decorative elements */}
        <div className="absolute -right-20 -top-20 w-60 h-60 bg-white/10 rounded-full blur-3xl"></div>
        <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
        <div className="absolute right-10 bottom-10 w-20 h-20 bg-white/5 rounded-full"></div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {/* Média Card */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Média</p>
              <p className="text-3xl font-bold text-sky-500 mt-1">{formatTriScore(latestScore?.nota_media)}</p>
              {mediaChange && (
                <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${parseFloat(mediaChange) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {parseFloat(mediaChange) >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  <span>{parseFloat(mediaChange) >= 0 ? '+' : ''}{mediaChange}%</span>
                </div>
              )}
            </div>
            <div className="h-12 w-12 rounded-xl bg-sky-100 flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-sky-500" />
            </div>
          </div>
        </div>

        {/* Ranking Card */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Ranking</p>
              <p className="text-3xl font-bold text-purple-600 mt-1">#{latestScore?.ranking_brasil}</p>
              {rankingChange !== null && (
                <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${rankingChange >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {rankingChange >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  <span>{rankingChange >= 0 ? '+' : ''}{rankingChange} pos</span>
                </div>
              )}
            </div>
            <div className="h-12 w-12 rounded-xl bg-purple-100 flex items-center justify-center">
              <Award className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </div>

        {/* Redação Card */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Redação</p>
              <p className="text-3xl font-bold text-cyan-600 mt-1">{formatTriScore(latestScore?.nota_redacao)}</p>
              <p className="text-xs text-gray-400 mt-2">{((latestScore?.nota_redacao || 0) / 10).toFixed(0)}% do máx</p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-cyan-100 flex items-center justify-center">
              <PenTool className="h-6 w-6 text-cyan-600" />
            </div>
          </div>
        </div>

        {/* Matemática Card */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Matemática</p>
              <p className="text-3xl font-bold text-orange-500 mt-1">{formatTriScore(latestScore?.nota_mt)}</p>
              <p className="text-xs text-gray-400 mt-2">{((latestScore?.nota_mt || 0) / 10).toFixed(0)}% do máx</p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-orange-100 flex items-center justify-center">
              <Calculator className="h-6 w-6 text-orange-500" />
            </div>
          </div>
        </div>

        {/* Habilidades Card */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Habilidades</p>
              <p className="text-3xl font-bold text-emerald-600 mt-1">
                {latestScore?.desempenho_habilidades
                  ? `${(latestScore.desempenho_habilidades * 100).toFixed(0)}%`
                  : 'N/A'
                }
              </p>
              <p className="text-xs text-gray-400 mt-2">desempenho geral</p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-emerald-100 flex items-center justify-center">
              <BookOpen className="h-6 w-6 text-emerald-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Chart Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Evolução das Notas</h2>
          <div className="flex items-center gap-4 text-sm">
            {selectedAreas.map((area) => (
              <div key={area} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: areaConfig[area]?.color || '#3b82f6' }}
                ></div>
                <span className="text-gray-600 font-medium">{area}</span>
              </div>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={300} minWidth={0}>
          <LineChart data={lineChartData} margin={{ top: 30, right: 30, left: 0, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis
              dataKey="ano"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 500 }}
              dy={10}
            />
            <YAxis
              domain={[400, 1000]}
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#94a3b8', fontSize: 12 }}
              width={45}
              tickFormatter={(value) => typeof value === 'number' ? formatTriScore(value) : value}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'white',
                border: 'none',
                borderRadius: '12px',
                boxShadow: '0 10px 40px rgba(0,0,0,0.12)',
                padding: '12px 16px',
              }}
              formatter={(value) => [typeof value === 'number' ? value.toFixed(1) : value, '']}
              labelStyle={{ fontWeight: 600, marginBottom: 4 }}
            />
            {selectedAreas.map((area) => (
              <Line
                key={area}
                type="monotone"
                dataKey={areaConfig[area]?.dataKey || area}
                stroke={areaConfig[area]?.color || '#3b82f6'}
                strokeWidth={3}
                dot={{ r: 5, fill: areaConfig[area]?.color || '#3b82f6', strokeWidth: 3, stroke: 'white' }}
                activeDot={{ r: 7, strokeWidth: 3 }}
              >
                <LabelList
                  dataKey={areaConfig[area]?.dataKey || area}
                  position="top"
                  offset={12}
                  fill="#64748b"
                  fontSize={11}
                  fontWeight={600}
                  formatter={(value) => typeof value === 'number' ? formatTriScore(value) : value}
                />
              </Line>
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Three Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Detail Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Detalhes {latestScore?.ano}</h3>
          <p className="text-xs text-gray-500 mb-4">Clique para visualizar no gráfico</p>
          <div className="overflow-hidden rounded-xl border border-gray-100">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/80">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Área</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Nota</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {barData.map((item) => {
                  const isSelected = selectedAreas.includes(item.name);
                  return (
                    <tr
                      key={item.name}
                      onClick={() => toggleArea(item.name)}
                      className={`cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-sky-50 hover:bg-sky-100'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-3 h-3 rounded-full transition-transform ${isSelected ? 'scale-125' : ''}`}
                            style={{ backgroundColor: item.color }}
                          ></div>
                          <span className={`${isSelected ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                            {item.name}
                          </span>
                        </div>
                      </td>
                      <td className={`px-4 py-3 text-right font-semibold ${isSelected ? 'text-sky-500' : 'text-gray-900'}`}>
                        {formatTriScore(item.nota)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-500 font-medium">{((item.nota / item.max) * 100).toFixed(0)}%</td>
                    </tr>
                  );
                })}
                {/* Média row */}
                <tr
                  onClick={() => toggleArea('Média')}
                  className={`cursor-pointer transition-all ${
                    selectedAreas.includes('Média')
                      ? 'bg-sky-50 hover:bg-sky-100'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-3 h-3 rounded-full transition-transform ${selectedAreas.includes('Média') ? 'scale-125' : ''}`}
                        style={{ backgroundColor: '#3ABFF8' }}
                      ></div>
                      <span className={`${selectedAreas.includes('Média') ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                        Média
                      </span>
                    </div>
                  </td>
                  <td className={`px-4 py-3 text-right font-semibold ${selectedAreas.includes('Média') ? 'text-sky-500' : 'text-gray-900'}`}>
                    {formatTriScore(latestScore?.nota_media)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500 font-medium">
                    {latestScore?.nota_media ? ((latestScore.nota_media / 1000) * 100).toFixed(0) : 0}%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Pie Chart */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Distribuição por Área</h3>
          <div className="relative">
            <ResponsiveContainer width="100%" height={200} minWidth={0}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={85}
                  paddingAngle={3}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name) => [typeof value === 'number' ? formatTriScore(value) : value, name]}
                  contentStyle={{
                    backgroundColor: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                    padding: '10px 14px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Center text */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <p className="text-3xl font-bold text-gray-900">{((totalScore / 5000) * 100).toFixed(0)}%</p>
                <p className="text-xs text-gray-500 font-medium">{formatTriScore(totalScore)}</p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 mt-4">
            {pieData.map((item) => (
              <div key={item.name} className="flex items-center gap-2 text-sm">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }}></div>
                <span className="text-gray-600 font-medium">{item.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Progress Bars */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Notas por Área</h3>
          <div className="space-y-4">
            {barData.map((item) => (
              <div key={item.name}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">{item.name}</span>
                  <span className="text-sm font-bold text-gray-900">{formatTriScore(item.nota)}</span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{
                      width: `${(item.nota / item.max) * 100}%`,
                      backgroundColor: item.color
                    }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* History Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Histórico Completo</h2>
          <span className="text-sm text-gray-500 font-medium">{school.historico.length} anos</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50/80">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Ano</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Ranking</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Média</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">CN</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">CH</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">LC</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">MT</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">RED</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {history?.history.map((h, idx) => {
                const isLatest = idx === (history.history.length - 1);
                return (
                  <tr key={h.ano} className={`hover:bg-gray-50 transition-colors ${isLatest ? 'bg-sky-50/50' : ''}`}>
                    <td className="px-6 py-4 whitespace-nowrap font-semibold text-gray-900">{h.ano}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold ${
                        isLatest ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        #{h.ranking_brasil}
                      </span>
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-right font-bold ${isLatest ? 'text-sky-500' : 'text-gray-900'}`}>
                      {formatTriScore(h.nota_media)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-gray-600 font-medium">{formatTriScore(h.nota_cn)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-gray-600 font-medium">{formatTriScore(h.nota_ch)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-gray-600 font-medium">{formatTriScore(h.nota_lc)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-gray-600 font-medium">{formatTriScore(h.nota_mt)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-gray-600 font-medium">{formatTriScore(h.nota_redacao)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ML Analytics Section */}
      <div className="bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 rounded-2xl shadow-sm border border-indigo-100 overflow-hidden">
        <div className="px-6 py-5 border-b border-indigo-100/50 bg-white/60 backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
              <Brain className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Análise Inteligente</h2>
              <p className="text-sm text-gray-500">Predições, diagnóstico e recomendações baseadas em ML</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">

            {/* Prediction Card */}
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-lg bg-sky-100 flex items-center justify-center">
                  <Target className="h-5 w-5 text-sky-500" />
                </div>
                <h3 className="text-sm font-semibold text-gray-900">Predição 2025</h3>
              </div>
              {predictions ? (
                <div className="space-y-3">
                  <div className="text-3xl font-bold text-sky-500">
                    {mediaPresentation?.display_score?.toFixed(1) || predictions.scores.media?.toFixed(1) || 'N/A'}
                  </div>
                  <p className="text-xs text-gray-500 font-medium">
                    {mediaPresentation?.display_mode === 'range' ? 'Faixa recomendada para 2025' : 'Média estimada'}
                  </p>
                  {mediaPresentation?.display_mode === 'range' ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
                      <p className="text-xs font-semibold text-amber-700">
                        {mediaPresentation.badge_text || 'Projeção conservadora'}
                      </p>
                      <p className="mt-1 text-xs text-amber-700">
                        {formatTriScore(mediaPresentation.confidence_interval.low)} - {formatTriScore(mediaPresentation.confidence_interval.high)} pontos
                      </p>
                    </div>
                  ) : (
                    <p className={`text-xs font-medium ${
                      (mediaPresentation?.display_expected_change ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-500'
                    }`}>
                      {(mediaPresentation?.display_expected_change ?? 0) >= 0 ? '+' : ''}
                      {(mediaPresentation?.display_expected_change ?? 0).toFixed(1)} pontos vs. {latestScore?.ano}
                    </p>
                  )}
                  <div className="space-y-1.5 mt-4 pt-3 border-t border-gray-100">
                    {['cn', 'ch', 'lc', 'mt', 'redacao'].map((area) => {
                      const presentation = predictions.areas?.[area];
                      const score = presentation?.display_score ?? predictions.scores[area];
                      if (score === undefined || score === null) return null;
                      return (
                        <div key={area} className="flex justify-between text-xs">
                          <span className="text-gray-500 uppercase font-medium">{area}</span>
                          <span className="font-bold text-gray-700">
                            {formatTriScore(Number(score))}
                            {presentation?.display_mode === 'range' ? ' faixa' : ''}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-28">
                  <div className="animate-pulse text-xs text-gray-400">Carregando...</div>
                </div>
              )}
            </div>

            {/* Diagnosis Card */}
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center">
                  <Activity className="h-5 w-5 text-purple-600" />
                </div>
                <h3 className="text-sm font-semibold text-gray-900">Saúde Geral</h3>
              </div>
              {diagnosis ? (
                <div className="space-y-3">
                  <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold ${
                    diagnosis.overall_health === 'excellent' ? 'bg-green-100 text-green-700' :
                    diagnosis.overall_health === 'good' ? 'bg-sky-100 text-blue-700' :
                    diagnosis.overall_health === 'needs_attention' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {diagnosis.overall_health === 'excellent' ? <CheckCircle className="h-4 w-4" /> :
                     diagnosis.overall_health === 'good' ? <CheckCircle className="h-4 w-4" /> :
                     <AlertTriangle className="h-4 w-4" />}
                    {diagnosis.overall_health === 'excellent' ? 'Excelente' :
                     diagnosis.overall_health === 'good' ? 'Bom' :
                     diagnosis.overall_health === 'needs_attention' ? 'Atenção' : 'Crítico'}
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <div className="text-center p-3 bg-green-50 rounded-xl">
                      <div className="text-2xl font-bold text-green-600">{diagnosis.health_summary.excellent_areas}</div>
                      <div className="text-xs text-gray-500 font-medium">Excelentes</div>
                    </div>
                    <div className="text-center p-3 bg-red-50 rounded-xl">
                      <div className="text-2xl font-bold text-red-600">{diagnosis.health_summary.critical_areas}</div>
                      <div className="text-xs text-gray-500 font-medium">Críticas</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-28">
                  <div className="animate-pulse text-xs text-gray-400">Carregando...</div>
                </div>
              )}
            </div>

            {/* Cluster/Persona Card */}
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                  <Users className="h-5 w-5 text-indigo-600" />
                </div>
                <h3 className="text-sm font-semibold text-gray-900">Perfil</h3>
              </div>
              {cluster ? (
                <div className="space-y-3">
                  <div
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold"
                    style={{ backgroundColor: `${cluster.persona.color}20`, color: cluster.persona.color }}
                  >
                    <Sparkles className="h-4 w-4" />
                    {cluster.persona.name}
                  </div>
                  <p className="text-xs text-gray-500 line-clamp-3 mt-3 leading-relaxed">
                    {cluster.persona.description}
                  </p>
                </div>
              ) : (
                <div className="flex items-center justify-center h-28">
                  <div className="animate-pulse text-xs text-gray-400">Carregando...</div>
                </div>
              )}
            </div>

            {/* Quick Recommendations Card */}
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center">
                  <Lightbulb className="h-5 w-5 text-amber-600" />
                </div>
                <h3 className="text-sm font-semibold text-gray-900">Quick Wins</h3>
              </div>
              {recommendations?.quick_wins ? (
                <div className="space-y-3">
                  {recommendations.quick_wins.slice(0, 2).map((qw, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs">
                      <ChevronRight className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-600 leading-relaxed">
                        <span className="font-bold text-gray-900">{qw.area_name}:</span> +{formatTriScore(qw.expected_gain)} pts
                      </span>
                    </div>
                  ))}
                  {recommendations.summary.quick_wins_count > 2 && (
                    <p className="text-xs text-amber-600 font-bold mt-3 pt-2 border-t border-gray-100">
                      +{recommendations.summary.quick_wins_count - 2} mais oportunidades
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center h-28">
                  <div className="animate-pulse text-xs text-gray-400">Carregando...</div>
                </div>
              )}
            </div>
          </div>

          {/* Priority Areas */}
          {diagnosis?.priority_areas && diagnosis.priority_areas.length > 0 && (
            <div className="mt-6 pt-6 border-t border-indigo-100/50">
              <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                Áreas Prioritárias
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {diagnosis.priority_areas.slice(0, 3).map((area) => (
                  <div
                    key={area.area}
                    className={`p-4 rounded-xl border ${
                      area.status === 'critical' ? 'bg-red-50 border-red-200' :
                      area.status === 'needs_attention' ? 'bg-yellow-50 border-yellow-200' :
                      'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{area.area_name}</p>
                        <p className="text-xs text-gray-500 mt-1 font-medium">
                          Score: {formatTriScore(area.school_score)} | Nacional: {formatTriScore(area.national_avg)}
                        </p>
                      </div>
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
                        area.gap_to_national < -20 ? 'bg-red-100 text-red-700' :
                        area.gap_to_national < 0 ? 'bg-yellow-100 text-yellow-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {area.gap_to_national >= 0 ? '+' : ''}{formatTriScore(area.gap_to_national)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Link to full roadmap */}
          <div className="mt-6 pt-5 border-t border-indigo-100/50 flex justify-end">
            <Link
              href={`/schools/${codigo_inep}/roadmap`}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-sky-400 to-orange-500 rounded-xl hover:from-sky-500 hover:to-orange-600 transition-all shadow-lg hover:shadow-xl"
            >
              Ver plano de melhoria completo
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* TRI Analysis Section */}
      <TRIAnalysis codigoInep={codigo_inep} />

      {/* BrainX Insights Section */}
      <BrainXInsights codigoInep={codigo_inep} />
    </div>
  );
}
