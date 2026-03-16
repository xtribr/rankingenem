'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, TRIAreaAnalysis, TRIAreaProjection } from '@/lib/api';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  ComposedChart,
} from 'recharts';

interface TRIAnalysisProps {
  codigoInep: string;
}

function MasteryGauge({ value, label }: { value: number; label: string }) {
  const percentage = Math.round(value * 100);

  const getColor = (val: number) => {
    if (val >= 0.8) return '#22c55e';
    if (val >= 0.6) return '#84cc16';
    if (val >= 0.4) return '#eab308';
    if (val >= 0.2) return '#f97316';
    return '#ef4444';
  };

  const color = getColor(value);

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-24 h-24">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle
            cx="50" cy="50" r="40"
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="12"
          />
          <circle
            cx="50" cy="50" r="40"
            fill="none"
            stroke={color}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={`${percentage * 2.51} 251`}
            className="transition-all duration-1000"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xl font-bold" style={{ color }}>
            {percentage}%
          </span>
        </div>
      </div>
      <span className="text-xs text-gray-500 mt-1">{label}</span>
    </div>
  );
}

function ProjectionModal({
  codigoInep,
  area,
  onClose
}: {
  codigoInep: string;
  area: string;
  onClose: () => void;
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['area-projection', codigoInep, area],
    queryFn: () => api.getAreaProjection(codigoInep, area),
  });

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
        <div className="bg-white rounded-2xl p-8 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
        <div className="bg-white rounded-2xl p-8 max-w-4xl w-full mx-4" onClick={e => e.stopPropagation()}>
          <p className="text-red-600">Erro ao carregar projeção</p>
          <button onClick={onClose} className="mt-4 px-4 py-2 bg-gray-100 rounded-lg">Fechar</button>
        </div>
      </div>
    );
  }

  // Prepare chart data
  const historicalData = data.historical_analysis.scores.map(s => ({
    ano: s.ano,
    score: s.score,
    type: 'historical'
  }));

  // Add projection point
  const projectionData = [
    ...historicalData,
    {
      ano: data.projection.target_year,
      score: data.projection.recommended,
      type: 'projection',
      low: data.projection.confidence_interval.low,
      high: data.projection.confidence_interval.high
    }
  ];

  const trendColor = data.historical_analysis.trend.direction === 'ascending' ? '#22c55e' :
                     data.historical_analysis.trend.direction === 'descending' ? '#ef4444' : '#6b7280';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="sticky top-0 px-6 py-4 border-b flex items-center justify-between z-10"
          style={{ backgroundColor: `${data.color}10` }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
              style={{ backgroundColor: data.color }}
            >
              {data.area}
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Cenários TRI - {data.area_name}</h2>
              <p className="text-sm text-gray-500">Predição oficial calibrada + cenários pedagógicos baseados em {data.historical_analysis.total_years} anos de histórico</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-gray-50 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-gray-900">{data.current_score.toFixed(0)}</div>
              <div className="text-xs text-gray-500">Score Atual ({data.current_year})</div>
            </div>
            <div className={`rounded-xl p-4 text-center ${
              data.official_prediction.display_mode === 'range' ? 'bg-amber-50' : 'bg-blue-50'
            }`}>
              <div className={`text-2xl font-bold ${
                data.official_prediction.display_mode === 'range' ? 'text-amber-700' : 'text-blue-600'
              }`}>
                {data.official_prediction.display_score.toFixed(0)}
              </div>
              <div className="text-xs text-gray-500">Predição oficial {data.official_prediction.target_year}</div>
              {data.official_prediction.display_mode === 'range' ? (
                <div className="mt-2 text-[11px] font-medium text-amber-700">
                  {data.official_prediction.confidence_interval.low.toFixed(0)} - {data.official_prediction.confidence_interval.high.toFixed(0)}
                </div>
              ) : (
                <div className={`mt-2 text-[11px] font-medium ${
                  data.official_prediction.display_expected_change >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {data.official_prediction.display_expected_change >= 0 ? '+' : ''}
                  {data.official_prediction.display_expected_change.toFixed(0)} pts
                </div>
              )}
            </div>
            <div className={`rounded-xl p-4 text-center ${data.projection.potential_gain >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
              <div className={`text-2xl font-bold ${data.projection.potential_gain >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {data.projection.potential_gain >= 0 ? '+' : ''}{data.projection.potential_gain.toFixed(0)}
              </div>
              <div className="text-xs text-gray-500">Cenário Pedagógico</div>
            </div>
            <div className="bg-purple-50 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-purple-600">{data.stretch_content.total_items}</div>
              <div className="text-xs text-gray-500">Conteúdos a Dominar</div>
            </div>
          </div>

          {data.official_prediction.display_mode === 'range' && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-sm font-semibold text-amber-800">
                {data.official_prediction.badge_text || 'Projeção conservadora'}
              </p>
              <p className="mt-1 text-sm text-amber-700">
                {data.official_prediction.risk_reason || 'A predição oficial foi apresentada em faixa por exceder a volatilidade histórica observada.'}
              </p>
            </div>
          )}

          {/* Historical Chart */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Evolução Histórica e Projeção</h3>
            <ResponsiveContainer width="100%" height={280} minWidth={0}>
              <ComposedChart data={projectionData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="ano"
                  tick={{ fill: '#6b7280', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={['dataMin - 30', 'dataMax + 30']}
                  tick={{ fill: '#6b7280', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                    fontSize: '12px'
                  }}
                  formatter={(value) => {
                    if (typeof value === 'number') return value.toFixed(1);
                    return value;
                  }}
                />
                {/* Confidence interval area for projection */}
                <Area
                  dataKey="high"
                  stroke="none"
                  fill={`${data.color}20`}
                  connectNulls={false}
                />
                <Area
                  dataKey="low"
                  stroke="none"
                  fill="white"
                  connectNulls={false}
                />
                {/* Historical line */}
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke={data.color}
                  strokeWidth={3}
                  dot={(props) => {
                    const { cx, cy, payload } = props;
                    const isProjection = payload.type === 'projection';
                    return (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={isProjection ? 8 : 5}
                        fill={isProjection ? '#3b82f6' : data.color}
                        stroke="white"
                        strokeWidth={2}
                      />
                    );
                  }}
                />
                {/* Reference line for current */}
                <ReferenceLine
                  y={data.current_score}
                  stroke="#9ca3af"
                  strokeDasharray="5 5"
                  label={{ value: 'Atual', fill: '#9ca3af', fontSize: 10 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Trend Analysis */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-xl p-4">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Análise de Tendência</h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Direção</span>
                  <span className="font-medium" style={{ color: trendColor }}>
                    {data.historical_analysis.trend.direction === 'ascending' ? '↑ Crescente' :
                     data.historical_analysis.trend.direction === 'descending' ? '↓ Decrescente' : '→ Estável'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Variação Anual</span>
                  <span className={`font-medium ${data.historical_analysis.trend.annual_change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {data.historical_analysis.trend.annual_change >= 0 ? '+' : ''}{data.historical_analysis.trend.annual_change.toFixed(1)} pts/ano
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Confiabilidade (R²)</span>
                  <span className="font-medium text-gray-900">{(data.historical_analysis.trend.r_squared * 100).toFixed(0)}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Melhoria Média</span>
                  <span className="font-medium text-blue-600">+{data.historical_analysis.statistics.avg_improvement.toFixed(1)} pts</span>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl p-4">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Cenários Pedagógicos</h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Conservador</span>
                  <span className="font-medium text-gray-600">{data.projection.scenarios.conservative.toFixed(0)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-blue-600 font-medium">Realista (Cenário)</span>
                  <span className="font-bold text-blue-600">{data.projection.scenarios.realistic.toFixed(0)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Otimista</span>
                  <span className="font-medium text-green-600">{data.projection.scenarios.optimistic.toFixed(0)}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                  <span className="text-sm text-gray-600">Intervalo de Confiança</span>
                  <span className="font-medium text-gray-500">
                    {data.projection.confidence_interval.low.toFixed(0)} - {data.projection.confidence_interval.high.toFixed(0)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Insights */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-gray-900">Insights da Análise</h4>
            {data.insights.map((insight, idx) => (
              <div
                key={idx}
                className={`p-4 rounded-xl border-l-4 ${
                  insight.type === 'positive' ? 'bg-green-50 border-green-500' :
                  insight.type === 'warning' ? 'bg-amber-50 border-amber-500' :
                  insight.type === 'info' ? 'bg-blue-50 border-blue-500' :
                  'bg-gray-50 border-gray-400'
                }`}
              >
                <h5 className={`font-medium text-sm ${
                  insight.type === 'positive' ? 'text-green-700' :
                  insight.type === 'warning' ? 'text-amber-700' :
                  insight.type === 'info' ? 'text-blue-700' :
                  'text-gray-700'
                }`}>{insight.title}</h5>
                <p className="text-sm text-gray-600 mt-1">{insight.message}</p>
              </div>
            ))}
          </div>

          {/* Stretch Content to Master */}
          {data.stretch_content.items.length > 0 && (
            <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
              <h4 className="text-sm font-semibold text-amber-800 mb-3 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                Conteúdo a Dominar para Alcançar a Projeção
              </h4>
              <p className="text-xs text-amber-700 mb-3">
                TRI entre {data.stretch_content.tri_range.min.toFixed(0)} e {data.stretch_content.tri_range.max.toFixed(0)} pontos
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                {data.stretch_content.items.map((item, idx) => (
                  <div key={idx} className="bg-white p-3 rounded-lg border border-amber-100">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-mono text-amber-700 font-medium text-sm">{item.skill}</span>
                      <span className="text-xs text-gray-500">TRI: {item.tri_score.toFixed(0)}</span>
                    </div>
                    <p className="text-xs text-gray-600 line-clamp-2">{item.description}</p>
                    <div className="mt-1">
                      <span className="text-xs text-red-500">Gap: +{item.gap.toFixed(0)} pts</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="pt-4 border-t border-gray-100 flex justify-between items-center">
            <p className="text-xs text-gray-400">
              Cenários baseados em {data.historical_analysis.total_years} anos de dados históricos. A predição oficial acima é a referência do produto.
            </p>
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AreaCard({
  area,
  isExpanded,
  onToggle,
  codigoInep,
  onOpenProjection
}: {
  area: TRIAreaAnalysis;
  isExpanded: boolean;
  onToggle: () => void;
  codigoInep: string;
  onOpenProjection: (area: string) => void;
}) {
  const changeColor = area.display_mode === 'range'
    ? 'text-amber-700'
    : area.expected_change >= 0 ? 'text-green-600' : 'text-red-600';
  const masteryPercent = Math.round(area.tri_mastery_level * 100);

  const handlePredictionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onOpenProjection(area.area.toLowerCase());
  };

  return (
    <div
      className="bg-white rounded-xl border border-gray-200 overflow-hidden cursor-pointer transition-all hover:border-gray-300 hover:shadow-sm"
      onClick={onToggle}
    >
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: area.color }}
            />
            <span className="font-semibold text-gray-900">{area.area_name}</span>
            <span className="text-xs text-gray-400">({area.area})</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePredictionClick}
              className="px-3 py-1 bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-xs font-medium rounded-full hover:from-blue-600 hover:to-indigo-700 transition-all shadow-sm hover:shadow flex items-center gap-1"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              CENÁRIOS TRI
            </button>
            <svg
              className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-gray-500 text-xs">Atual</div>
            <div className="text-xl font-bold text-gray-900">{area.current_score.toFixed(0)}</div>
          </div>
          <div>
            <div className="text-gray-500 text-xs">Previsto</div>
            <div className="text-xl font-bold text-blue-600">{area.predicted_score.toFixed(0)}</div>
          </div>
          <div>
            <div className="text-gray-500 text-xs">{area.display_mode === 'range' ? 'Faixa' : 'Mudança'}</div>
            <div className={`text-xl font-bold ${changeColor}`}>
              {area.display_mode === 'range'
                ? `${area.confidence_interval.low.toFixed(0)}-${area.confidence_interval.high.toFixed(0)}`
                : `${area.expected_change >= 0 ? '+' : ''}${area.expected_change.toFixed(0)}`}
            </div>
          </div>
        </div>

        {area.display_mode === 'range' && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
            <p className="text-xs font-semibold text-amber-800">
              {area.badge_text || 'Projeção conservadora'}
            </p>
            {area.risk_reason && (
              <p className="mt-1 text-xs text-amber-700">{area.risk_reason}</p>
            )}
          </div>
        )}

        <div className="mt-4">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>{area.area === 'RE' ? 'Domínio Competências' : 'Domínio TRI'}</span>
            <span>{masteryPercent}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div
              className="h-2 rounded-full transition-all duration-500"
              style={{
                width: `${masteryPercent}%`,
                backgroundColor: area.color
              }}
            />
          </div>
        </div>

        <div className="mt-3 flex gap-4 text-xs">
          <div className="flex items-center gap-1">
            <span className="text-gray-500">Gap Mediana:</span>
            <span className={area.tri_gap_to_median >= 0 ? 'text-green-600' : 'text-red-600'}>
              {area.tri_gap_to_median >= 0 ? '+' : ''}{area.tri_gap_to_median.toFixed(0)}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-gray-500">Potencial:</span>
            <span className="text-blue-600">{(area.tri_potential * 100).toFixed(0)}%</span>
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-gray-100 p-4 bg-gray-50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Accessible Content */}
            <div>
              <h4 className="text-sm font-semibold text-green-600 mb-2 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {area.area === 'RE' ? 'Competências Fortes' : 'Conteúdo Dominado'}
              </h4>
              {area.accessible_content_sample.length > 0 ? (
                <ul className="space-y-2">
                  {area.accessible_content_sample.map((content, idx) => (
                    <li key={idx} className="text-xs bg-white p-2 rounded border border-gray-100">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-mono text-green-600 font-medium">{content.skill}</span>
                        <span className="text-gray-400">{area.area === 'RE' ? 'Máx' : 'TRI'}: {content.tri_score.toFixed(0)}</span>
                      </div>
                      <p className="text-gray-600 line-clamp-2">{content.description}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-gray-400 italic">Sem dados disponíveis</p>
              )}
            </div>

            {/* Stretch Content */}
            <div>
              <h4 className="text-sm font-semibold text-amber-600 mb-2 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                {area.area === 'RE' ? 'Competências a Desenvolver' : 'Próximos Desafios'}
              </h4>
              {area.stretch_content_sample.length > 0 ? (
                <ul className="space-y-2">
                  {area.stretch_content_sample.map((content, idx) => (
                    <li key={idx} className="text-xs bg-white p-2 rounded border border-gray-100">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-mono text-amber-600 font-medium">{content.skill}</span>
                        <span className="text-gray-400">
                          {area.area === 'RE' ? 'Máx' : 'TRI'}: {content.tri_score.toFixed(0)}
                          {content.gap && <span className="text-red-500 ml-1">(+{content.gap.toFixed(0)})</span>}
                        </span>
                      </div>
                      <p className="text-gray-600 line-clamp-2">{content.description}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-gray-400 italic">Sem dados disponíveis</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TRIAnalysis({ codigoInep }: TRIAnalysisProps) {
  const [expandedArea, setExpandedArea] = useState<string | null>(null);
  const [projectionArea, setProjectionArea] = useState<string | null>(null);

  const { data, error, isLoading } = useQuery({
    queryKey: ['tri-analysis', codigoInep],
    queryFn: () => api.getTRIAnalysis(codigoInep),
  });

  if (isLoading) {
    return (
      <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 rounded-2xl shadow-sm border border-blue-100 p-6 animate-pulse">
        <div className="h-6 bg-blue-100 rounded w-1/3 mb-4" />
        <div className="h-32 bg-blue-50 rounded mb-4" />
        <div className="grid grid-cols-2 gap-4">
          <div className="h-48 bg-blue-50 rounded" />
          <div className="h-48 bg-blue-50 rounded" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-red-200 p-6">
        <p className="text-red-600">Erro ao carregar análise TRI</p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 rounded-2xl shadow-sm border border-blue-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-blue-100/50 bg-white/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900">Análise TRI</h2>
                <p className="text-xs text-gray-500">Predição baseada em Teoria de Resposta ao Item</p>
              </div>
            </div>
            <MasteryGauge value={data.overall_tri_mastery} label="Domínio Geral" />
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Insights */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl p-4 border-l-4 border-blue-500 shadow-sm">
              <h3 className="text-sm font-semibold text-blue-600 mb-2">Interpretação</h3>
              <p className="text-sm text-gray-600">{data.insights.mastery_interpretation}</p>
            </div>
            <div className="bg-white rounded-xl p-4 border-l-4 border-green-500 shadow-sm">
              <h3 className="text-sm font-semibold text-green-600 mb-2">Recomendação</h3>
              <p className="text-sm text-gray-600">{data.insights.recommendation}</p>
            </div>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-5 gap-3">
            {data.area_analysis.map((area) => (
              <div
                key={area.area}
                className="bg-white rounded-xl p-3 text-center cursor-pointer hover:shadow-md transition-all border border-gray-100"
                onClick={() => setExpandedArea(expandedArea === area.area ? null : area.area)}
              >
                <div
                  className="w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center text-white font-bold text-sm"
                  style={{ backgroundColor: area.color }}
                >
                  {area.area}
                </div>
                <div className="text-lg font-bold text-gray-900">{area.predicted_score.toFixed(0)}</div>
                {area.display_mode === 'range' ? (
                  <>
                    <div className="text-xs font-medium text-amber-700">
                      {area.confidence_interval.low.toFixed(0)} - {area.confidence_interval.high.toFixed(0)}
                    </div>
                    <div className="mt-1 text-[11px] font-semibold text-amber-700">
                      {area.badge_text || 'Projeção conservadora'}
                    </div>
                  </>
                ) : (
                  <div className={`text-xs font-medium ${area.expected_change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {area.expected_change >= 0 ? '+' : ''}{area.expected_change.toFixed(0)} pts
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Area Details */}
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-gray-900">Análise por Área</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {data.area_analysis.map((area) => (
                <AreaCard
                  key={area.area}
                  area={area}
                  isExpanded={expandedArea === area.area}
                  onToggle={() => setExpandedArea(expandedArea === area.area ? null : area.area)}
                  codigoInep={codigoInep}
                  onOpenProjection={setProjectionArea}
                />
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="text-xs text-gray-400 text-center pt-4 border-t border-gray-100">
            A apresentação das faixas e deltas é decidida pelo backend com base no histórico da escola e na volatilidade observada.
          </div>
        </div>
      </div>

      {/* Projection Modal */}
      {projectionArea && (
        <ProjectionModal
          codigoInep={codigoInep}
          area={projectionArea}
          onClose={() => setProjectionArea(null)}
        />
      )}
    </>
  );
}
