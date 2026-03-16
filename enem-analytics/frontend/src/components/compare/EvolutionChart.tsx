'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { TrendingUp, TrendingDown, Calendar, Award } from 'lucide-react';
import { formatTriScore } from '@/lib/utils';

interface YearData {
  ano: number;
  escola1: { nota_media: number | null; ranking: number | null };
  escola2: { nota_media: number | null; ranking: number | null };
}

interface TrendAnalysis {
  totalChange: number;
  avgChange: number;
  bestYear: number | null;
  worstYear: number | null;
  bestScore: number | null;
  worstScore: number | null;
}

interface EvolutionChartProps {
  comparison: YearData[];
  school1Name: string;
  school2Name: string;
  topScore?: number;
}

function calculateTrend(data: YearData[], schoolKey: 'escola1' | 'escola2'): TrendAnalysis {
  const validYears = data.filter(d => d[schoolKey].nota_media !== null);

  if (validYears.length < 2) {
    return { totalChange: 0, avgChange: 0, bestYear: null, worstYear: null, bestScore: null, worstScore: null };
  }

  const scores = validYears.map(d => ({ ano: d.ano, score: d[schoolKey].nota_media as number }));
  const firstScore = scores[0].score;
  const lastScore = scores[scores.length - 1].score;
  const totalChange = lastScore - firstScore;
  const avgChange = totalChange / (scores.length - 1);

  const best = scores.reduce((max, curr) => curr.score > max.score ? curr : max);
  const worst = scores.reduce((min, curr) => curr.score < min.score ? curr : min);

  return {
    totalChange,
    avgChange,
    bestYear: best.ano,
    worstYear: worst.ano,
    bestScore: best.score,
    worstScore: worst.score,
  };
}

export default function EvolutionChart({
  comparison,
  school1Name,
  school2Name,
  topScore,
}: EvolutionChartProps) {
  // Prepare chart data
  const chartData = comparison.map(c => ({
    ano: c.ano,
    escola1: c.escola1.nota_media,
    escola2: c.escola2.nota_media,
  }));

  // Calculate trends
  const trend1 = calculateTrend(comparison, 'escola1');
  const trend2 = calculateTrend(comparison, 'escola2');

  // Truncate names
  const school1Label = school1Name.length > 20 ? school1Name.slice(0, 20) + '...' : school1Name;
  const school2Label = school2Name.length > 20 ? school2Name.slice(0, 20) + '...' : school2Name;

  // Calculate growth comparison insight
  const growthRatio = trend1.avgChange !== 0 && trend2.avgChange !== 0
    ? Math.abs((trend1.avgChange / trend2.avgChange - 1) * 100)
    : null;

  const fasterGrower = trend1.avgChange > trend2.avgChange ? school1Name : school2Name;
  const slowerGrower = trend1.avgChange > trend2.avgChange ? school2Name : school1Name;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-2">Evolução Histórica</h2>
      <p className="text-sm text-gray-500 mb-6">
        Acompanhe o desempenho ao longo dos anos
      </p>

      {/* Line Chart */}
      <ResponsiveContainer width="100%" height={350}>
        <LineChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="ano" tick={{ fill: '#6b7280', fontSize: 12 }} />
          <YAxis
            domain={[400, 950]}
            tick={{ fill: '#6b7280', fontSize: 11 }}
            tickCount={6}
            tickFormatter={(value) => typeof value === 'number' ? formatTriScore(value) : value}
          />

          {/* TOP Brasil reference line */}
          {topScore && (
            <ReferenceLine
              y={topScore}
              stroke="#f59e0b"
              strokeDasharray="5 5"
              strokeWidth={2}
              label={{
                value: `TOP: ${formatTriScore(topScore)}`,
                fill: '#f59e0b',
                fontSize: 11,
                position: 'right',
              }}
            />
          )}

          <Tooltip
            formatter={(value) => [
              value ? formatTriScore(value as number) + ' pts' : '-',
            ]}
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            }}
          />
          <Legend
            wrapperStyle={{ paddingTop: 10 }}
            formatter={(value) => <span className="text-sm text-gray-700">{value}</span>}
          />

          <Line
            type="monotone"
            dataKey="escola1"
            name={school1Label}
            stroke="#3b82f6"
            strokeWidth={3}
            dot={{ r: 5, fill: '#3b82f6' }}
            activeDot={{ r: 7 }}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="escola2"
            name={school2Label}
            stroke="#22c55e"
            strokeWidth={3}
            dot={{ r: 5, fill: '#22c55e' }}
            activeDot={{ r: 7 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Trend Analysis Cards */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* School 1 Trend */}
        <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
          <div className="flex items-center gap-2 mb-3">
            {trend1.avgChange >= 0 ? (
              <TrendingUp className="h-5 w-5 text-blue-600" />
            ) : (
              <TrendingDown className="h-5 w-5 text-red-500" />
            )}
            <h4 className="font-semibold text-blue-900 truncate" title={school1Name}>
              {school1Label}
            </h4>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-blue-600 font-medium">
                {trend1.totalChange >= 0 ? '+' : ''}{formatTriScore(trend1.totalChange)} pts
              </p>
              <p className="text-xs text-blue-500">Total no período</p>
            </div>
            <div>
              <p className="text-blue-600 font-medium">
                {trend1.avgChange >= 0 ? '+' : ''}{trend1.avgChange.toFixed(1)} pts/ano
              </p>
              <p className="text-xs text-blue-500">Média anual</p>
            </div>
            <div className="flex items-center gap-1">
              <Award className="h-3 w-3 text-amber-500" />
              <span className="text-gray-700">{trend1.bestYear}: {formatTriScore(trend1.bestScore)}</span>
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3 text-gray-400" />
              <span className="text-gray-500">{trend1.worstYear}: {formatTriScore(trend1.worstScore)}</span>
            </div>
          </div>
        </div>

        {/* School 2 Trend */}
        <div className="p-4 bg-green-50 rounded-xl border border-green-100">
          <div className="flex items-center gap-2 mb-3">
            {trend2.avgChange >= 0 ? (
              <TrendingUp className="h-5 w-5 text-green-600" />
            ) : (
              <TrendingDown className="h-5 w-5 text-red-500" />
            )}
            <h4 className="font-semibold text-green-900 truncate" title={school2Name}>
              {school2Label}
            </h4>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-green-600 font-medium">
                {trend2.totalChange >= 0 ? '+' : ''}{formatTriScore(trend2.totalChange)} pts
              </p>
              <p className="text-xs text-green-500">Total no período</p>
            </div>
            <div>
              <p className="text-green-600 font-medium">
                {trend2.avgChange >= 0 ? '+' : ''}{trend2.avgChange.toFixed(1)} pts/ano
              </p>
              <p className="text-xs text-green-500">Média anual</p>
            </div>
            <div className="flex items-center gap-1">
              <Award className="h-3 w-3 text-amber-500" />
              <span className="text-gray-700">{trend2.bestYear}: {formatTriScore(trend2.bestScore)}</span>
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3 text-gray-400" />
              <span className="text-gray-500">{trend2.worstYear}: {formatTriScore(trend2.worstScore)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Insight */}
      {growthRatio !== null && growthRatio > 10 && (
        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm text-amber-800">
            💡 <strong>{fasterGrower.slice(0, 25)}</strong> está crescendo{' '}
            <strong>{growthRatio.toFixed(0)}%</strong> mais rápido que{' '}
            <strong>{slowerGrower.slice(0, 25)}</strong>.
            {growthRatio > 50 && ' Se a tendência continuar, pode haver mudança significativa nos rankings.'}
          </p>
        </div>
      )}
    </div>
  );
}
