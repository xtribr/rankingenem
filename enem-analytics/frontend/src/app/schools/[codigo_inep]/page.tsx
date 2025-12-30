'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { formatNumber, formatRanking } from '@/lib/utils';
import Link from 'next/link';
import { ArrowLeft, TrendingUp, TrendingDown, Award, BookOpen, Calculator, PenTool, Grid3X3, AlertTriangle, CheckCircle, Lightbulb, Brain, Target, Users, Sparkles, ChevronRight, Activity, BarChart3, GraduationCap, Zap, Flame, Eye } from 'lucide-react';
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

  const { data: schoolSkills, isLoading: skillsLoading } = useQuery({
    queryKey: ['schoolSkills', codigo_inep],
    queryFn: () => api.getSchoolSkills(codigo_inep, 10),
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

  // Oracle ENEM 2026 Recommendations
  const { data: oracleRecommendations, isLoading: oracleLoading } = useQuery({
    queryKey: ['oracleRecommendations', codigo_inep],
    queryFn: () => api.getOracleRecommendations(codigo_inep, 10),
    enabled: !!school,
  });

  // Selected areas for chart - state for interactive selection (must be before early returns)
  const [selectedAreas, setSelectedAreas] = useState<string[]>(['Média']);
  const [selectedSkillArea, setSelectedSkillArea] = useState<string | null>(null);

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
              <p className="text-3xl font-bold text-sky-500 mt-1">{formatNumber(latestScore?.nota_media)}</p>
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
              <p className="text-3xl font-bold text-cyan-600 mt-1">{formatNumber(latestScore?.nota_redacao)}</p>
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
              <p className="text-3xl font-bold text-orange-500 mt-1">{formatNumber(latestScore?.nota_mt)}</p>
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
                  formatter={(value) => typeof value === 'number' ? value.toFixed(0) : value}
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
                        {formatNumber(item.nota)}
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
                    {formatNumber(latestScore?.nota_media)}
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
                  formatter={(value, name) => [typeof value === 'number' ? formatNumber(value) : value, name]}
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
                <p className="text-xs text-gray-500 font-medium">{formatNumber(totalScore)}</p>
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
                  <span className="text-sm font-bold text-gray-900">{formatNumber(item.nota)}</span>
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
                      {formatNumber(h.nota_media)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-gray-600 font-medium">{formatNumber(h.nota_cn)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-gray-600 font-medium">{formatNumber(h.nota_ch)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-gray-600 font-medium">{formatNumber(h.nota_lc)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-gray-600 font-medium">{formatNumber(h.nota_mt)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-gray-600 font-medium">{formatNumber(h.nota_redacao)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Skills Analysis Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-red-100 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Habilidades - Pontos de Atenção</h2>
                <p className="text-sm text-gray-500">Comparação com a média nacional (ENEM 2024)</p>
              </div>
            </div>
          </div>
        </div>

        {skillsLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
          </div>
        ) : schoolSkills ? (
          <div className="p-6">
            {/* Area Filter Tabs */}
            <div className="flex flex-wrap gap-2 mb-6">
              <button
                onClick={() => setSelectedSkillArea(null)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                  selectedSkillArea === null
                    ? 'bg-gray-900 text-white shadow-lg'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Todas ({schoolSkills.worst_overall.length})
              </button>
              {(['CN', 'CH', 'LC', 'MT'] as const).map((area) => {
                const areaColors: Record<string, string> = {
                  CN: 'bg-green-500 text-white',
                  CH: 'bg-purple-500 text-white',
                  LC: 'bg-pink-500 text-white',
                  MT: 'bg-orange-500 text-white',
                };
                const areaColorsInactive: Record<string, string> = {
                  CN: 'bg-green-100 text-green-700 hover:bg-green-200',
                  CH: 'bg-purple-100 text-purple-700 hover:bg-purple-200',
                  LC: 'bg-pink-100 text-pink-700 hover:bg-pink-200',
                  MT: 'bg-orange-100 text-orange-700 hover:bg-orange-200',
                };
                const areaNames: Record<string, string> = {
                  CN: 'Natureza',
                  CH: 'Humanas',
                  LC: 'Linguagens',
                  MT: 'Matemática',
                };
                return (
                  <button
                    key={area}
                    onClick={() => setSelectedSkillArea(area)}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                      selectedSkillArea === area
                        ? areaColors[area] + ' shadow-lg'
                        : areaColorsInactive[area]
                    }`}
                  >
                    {areaNames[area]}
                  </button>
                );
              })}
            </div>

            {/* Skills List */}
            <div className="space-y-3">
              {(selectedSkillArea
                ? (schoolSkills.by_area[selectedSkillArea] || []).map(s => ({ ...s, area: selectedSkillArea }))
                : schoolSkills.worst_overall
              ).map((skill, index) => {
                const areaColors: Record<string, { bg: string; text: string; border: string }> = {
                  CN: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
                  CH: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
                  LC: { bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-200' },
                  MT: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
                };
                const area = skill.area;
                const colors = areaColors[area] || areaColors.CN;

                return (
                  <div
                    key={`${area}-${skill.skill_num}`}
                    className={`p-5 rounded-xl border ${colors.border} ${colors.bg} transition-all hover:shadow-md`}
                  >
                    <div className="flex items-start gap-4">
                      {/* Rank */}
                      <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold ${
                        index < 3 ? 'bg-red-500 text-white' : 'bg-gray-200 text-gray-600'
                      }`}>
                        {index + 1}
                      </div>

                      {/* Skill Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${colors.bg} ${colors.text}`}>
                            {area}
                          </span>
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${colors.bg} ${colors.text}`}>
                            H{skill.skill_num.toString().padStart(2, '0')}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 leading-relaxed">{skill.descricao}</p>
                      </div>

                      {/* Performance Comparison */}
                      <div className="flex-shrink-0 text-right">
                        <div className="flex items-center gap-4">
                          {/* School Performance */}
                          <div>
                            <div className={`text-2xl font-bold ${
                              skill.performance < 30 ? 'text-red-600' :
                              skill.performance < 50 ? 'text-orange-500' :
                              'text-green-600'
                            }`}>
                              {skill.performance.toFixed(1)}%
                            </div>
                            <div className="text-xs text-gray-500 font-medium">escola</div>
                          </div>

                          {/* Comparison Arrow */}
                          {skill.diff !== null && (
                            <div className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold ${
                              skill.status === 'above' ? 'bg-green-100 text-green-700' :
                              skill.status === 'below' ? 'bg-red-100 text-red-700' :
                              'bg-gray-100 text-gray-600'
                            }`}>
                              {skill.status === 'above' ? (
                                <TrendingUp className="h-3.5 w-3.5" />
                              ) : skill.status === 'below' ? (
                                <TrendingDown className="h-3.5 w-3.5" />
                              ) : null}
                              {skill.diff > 0 ? '+' : ''}{skill.diff.toFixed(1)}
                            </div>
                          )}

                          {/* National Average */}
                          {skill.national_avg !== null && (
                            <div>
                              <div className="text-2xl font-bold text-gray-300">
                                {skill.national_avg.toFixed(1)}%
                              </div>
                              <div className="text-xs text-gray-400 font-medium">média BR</div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-4 ml-14">
                      <div className="relative h-2.5 bg-gray-200 rounded-full overflow-hidden">
                        {/* National average marker */}
                        {skill.national_avg !== null && (
                          <div
                            className="absolute top-0 bottom-0 w-0.5 bg-gray-500 z-10"
                            style={{ left: `${skill.national_avg}%` }}
                          />
                        )}
                        {/* School performance bar */}
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${skill.performance}%`,
                            backgroundColor: skill.performance < 30 ? '#dc2626' :
                                           skill.performance < 50 ? '#f97316' :
                                           '#16a34a'
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="mt-6 pt-5 border-t border-gray-100">
              <div className="flex flex-wrap gap-8 text-sm text-gray-500">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-red-500"></div>
                  <span className="font-medium">Crítico (&lt;30%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-orange-500"></div>
                  <span className="font-medium">Atenção (30-50%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-green-500"></div>
                  <span className="font-medium">Bom (&gt;50%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1 h-4 bg-gray-500 rounded-full"></div>
                  <span className="font-medium">Média Nacional</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6 text-center text-gray-500">
            Dados de habilidades não disponíveis para esta escola
          </div>
        )}
      </div>

      {/* Oracle ENEM 2026 - Personalized Recommendations */}
      <div className="bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 rounded-2xl shadow-sm border border-orange-200 overflow-hidden">
        <div className="px-6 py-5 border-b border-orange-200/50 bg-white/60 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-lg">
                <Eye className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Oráculo ENEM 2026</h2>
                <p className="text-sm text-gray-500">Temas previstos onde sua escola precisa melhorar</p>
              </div>
            </div>
            {oracleRecommendations && (
              <div className="flex items-center gap-3">
                {oracleRecommendations.summary.high_priority > 0 && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-100 text-red-700 text-xs font-bold">
                    <Flame className="h-3.5 w-3.5" />
                    {oracleRecommendations.summary.high_priority} urgente{oracleRecommendations.summary.high_priority > 1 ? 's' : ''}
                  </span>
                )}
                <span className="text-xs text-gray-500 font-medium">
                  Dados {oracleRecommendations.ano_dados} → Predição {oracleRecommendations.ano_predicao}
                </span>
              </div>
            )}
          </div>
        </div>

        {oracleLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-600"></div>
          </div>
        ) : oracleRecommendations ? (
          <div className="p-6">
            {/* Top 5 Urgent Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
              {oracleRecommendations.top_5_urgentes.map((item, idx) => {
                const areaColors: Record<string, { bg: string; border: string; text: string; icon: string }> = {
                  'Linguagens': { bg: 'bg-pink-50', border: 'border-pink-200', text: 'text-pink-700', icon: 'bg-pink-500' },
                  'Matematica': { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', icon: 'bg-orange-500' },
                  'Natureza': { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', icon: 'bg-green-500' },
                  'Humanas': { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', icon: 'bg-purple-500' },
                };
                const colors = areaColors[item.area] || areaColors['Linguagens'];
                const isUrgent = item.priority_score >= 20;

                return (
                  <div
                    key={idx}
                    className={`relative p-4 rounded-xl border-2 ${colors.border} ${colors.bg} transition-all hover:shadow-lg ${isUrgent ? 'ring-2 ring-red-300 ring-offset-2' : ''}`}
                  >
                    {isUrgent && (
                      <div className="absolute -top-2 -right-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white">
                          <Flame className="h-3 w-3" />
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${colors.icon} text-white`}>
                        #{idx + 1}
                      </span>
                      <span className={`text-xs font-semibold ${colors.text}`}>{item.area}</span>
                    </div>
                    <h4 className="font-bold text-gray-900 text-sm mb-2 line-clamp-2">{item.tema}</h4>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">Probabilidade</span>
                        <span className="font-bold text-amber-600">{item.probabilidade_pct}%</span>
                      </div>
                      {item.school_performance !== null && (
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Sua escola</span>
                          <span className={`font-bold ${item.school_performance < 40 ? 'text-red-600' : item.school_performance < 60 ? 'text-orange-500' : 'text-green-600'}`}>
                            {item.school_performance.toFixed(0)}%
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">Prioridade</span>
                        <span className={`font-bold ${item.priority_score >= 25 ? 'text-red-600' : item.priority_score >= 15 ? 'text-orange-500' : 'text-gray-600'}`}>
                          {item.priority_score.toFixed(1)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Detailed Recommendations */}
            <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" />
              Detalhamento das Recomendações
            </h3>
            <div className="space-y-4">
              {oracleRecommendations.recommendations.slice(0, 5).map((rec, idx) => {
                const areaColors: Record<string, { bg: string; border: string; text: string; bar: string }> = {
                  'LC': { bg: 'bg-pink-50', border: 'border-pink-200', text: 'text-pink-700', bar: 'bg-pink-500' },
                  'MT': { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', bar: 'bg-orange-500' },
                  'CN': { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', bar: 'bg-green-500' },
                  'CH': { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', bar: 'bg-purple-500' },
                };
                const colors = areaColors[rec.area_codigo] || areaColors['LC'];

                return (
                  <div
                    key={idx}
                    className={`p-5 rounded-xl border ${colors.border} ${colors.bg} transition-all hover:shadow-md`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${colors.bg} ${colors.text} border ${colors.border}`}>
                            {rec.area_codigo}
                          </span>
                          <span className={`text-xs font-medium px-2.5 py-1 rounded-lg bg-amber-100 text-amber-700`}>
                            {rec.tipo}
                          </span>
                          <span className="text-xs text-gray-500">{rec.justificativa}</span>
                        </div>
                        <h4 className="font-bold text-gray-900 text-lg mb-3">{rec.tema}</h4>

                        {/* Skills breakdown */}
                        {rec.habilidades.length > 0 && (
                          <div className="mb-4">
                            <p className="text-xs font-semibold text-gray-600 mb-2">Habilidades relacionadas:</p>
                            <div className="flex flex-wrap gap-2">
                              {rec.habilidades.map((hab, hidx) => (
                                <div
                                  key={hidx}
                                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium ${
                                    hab.status === 'weak' ? 'bg-red-100 text-red-700 border border-red-200' :
                                    hab.status === 'medium' ? 'bg-yellow-100 text-yellow-700 border border-yellow-200' :
                                    'bg-green-100 text-green-700 border border-green-200'
                                  }`}
                                  title={hab.descricao}
                                >
                                  <span className="font-bold">{hab.codigo}</span>
                                  <span className="font-bold">{hab.school_performance.toFixed(0)}%</span>
                                  {hab.status === 'weak' && <AlertTriangle className="h-3 w-3" />}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Example questions */}
                        {rec.exemplos_questoes.length > 0 && (
                          <div className="text-xs text-gray-600">
                            <span className="font-semibold">Exemplos: </span>
                            {rec.exemplos_questoes.join(' | ')}
                          </div>
                        )}
                      </div>

                      {/* Priority Score */}
                      <div className="flex-shrink-0 text-right">
                        <div className={`text-3xl font-bold ${
                          rec.priority_score >= 25 ? 'text-red-600' :
                          rec.priority_score >= 15 ? 'text-orange-500' :
                          'text-gray-400'
                        }`}>
                          {rec.priority_score.toFixed(1)}
                        </div>
                        <div className="text-xs text-gray-500 font-medium">prioridade</div>
                        <div className="mt-2 space-y-1">
                          <div className="text-xs">
                            <span className="text-gray-400">Prob: </span>
                            <span className="font-bold text-amber-600">{rec.probabilidade_pct}%</span>
                          </div>
                          {rec.school_avg_performance !== null && (
                            <div className="text-xs">
                              <span className="text-gray-400">Escola: </span>
                              <span className={`font-bold ${rec.school_avg_performance < 40 ? 'text-red-600' : 'text-gray-700'}`}>
                                {rec.school_avg_performance.toFixed(0)}%
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Progress bar showing school vs probability */}
                    {rec.school_avg_performance !== null && (
                      <div className="mt-4">
                        <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${colors.bar}`}
                            style={{ width: `${rec.school_avg_performance}%` }}
                          />
                          {/* Probability marker */}
                          <div
                            className="absolute top-0 bottom-0 w-1 bg-amber-500"
                            style={{ left: `${rec.probabilidade_pct * 2}%` }}
                            title={`Probabilidade: ${rec.probabilidade_pct}%`}
                          />
                        </div>
                        <div className="flex justify-between mt-1 text-xs text-gray-400">
                          <span>0%</span>
                          <span>Desempenho da escola</span>
                          <span>100%</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Methodology note */}
            <div className="mt-6 pt-5 border-t border-orange-200/50">
              <p className="text-xs text-gray-500 text-center">
                <strong>Metodologia:</strong> {oracleRecommendations.metodologia}
              </p>
            </div>
          </div>
        ) : (
          <div className="p-6 text-center text-gray-500">
            <p className="mb-2">Recomendações do Oráculo não disponíveis para esta escola.</p>
            <p className="text-xs">Apenas escolas com dados detalhados de habilidades (top 100 por estado) possuem recomendações personalizadas.</p>
          </div>
        )}
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
                    {predictions.scores.media?.toFixed(1) || 'N/A'}
                  </div>
                  <p className="text-xs text-gray-500 font-medium">Média estimada</p>
                  <div className="space-y-1.5 mt-4 pt-3 border-t border-gray-100">
                    {['cn', 'ch', 'lc', 'mt', 'redacao'].map((area) => {
                      const score = predictions.scores[area];
                      if (!score) return null;
                      return (
                        <div key={area} className="flex justify-between text-xs">
                          <span className="text-gray-500 uppercase font-medium">{area}</span>
                          <span className="font-bold text-gray-700">{(score as number).toFixed(0)}</span>
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
                        <span className="font-bold text-gray-900">{qw.area_name}:</span> +{qw.expected_gain.toFixed(0)} pts
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
                          Score: {area.school_score.toFixed(0)} | Nacional: {area.national_avg.toFixed(0)}
                        </p>
                      </div>
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
                        area.gap_to_national < -20 ? 'bg-red-100 text-red-700' :
                        area.gap_to_national < 0 ? 'bg-yellow-100 text-yellow-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {area.gap_to_national >= 0 ? '+' : ''}{area.gap_to_national.toFixed(0)}
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
