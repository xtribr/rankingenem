'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts';
import { DiagnosisComparisonResult } from '@/lib/api';
import { formatTriScore } from '@/lib/utils';

interface BarComparisonProps {
  diagnosisComparison: DiagnosisComparisonResult;
  topScores?: Record<string, number>;
  school1Name: string;
  school2Name: string;
}

const AREA_LABELS: Record<string, string> = {
  CN: 'Ciências Natureza',
  CH: 'Ciências Humanas',
  LC: 'Linguagens',
  MT: 'Matemática',
  redacao: 'Redação',
};

const AREA_SHORT: Record<string, string> = {
  CN: 'CN',
  CH: 'CH',
  LC: 'LC',
  MT: 'MT',
  redacao: 'RED',
};

export default function BarComparison({
  diagnosisComparison,
  topScores,
  school1Name,
  school2Name,
}: BarComparisonProps) {
  // Prepare data for bar chart
  const chartData = diagnosisComparison.area_comparison.map(area => ({
    area: AREA_SHORT[area.area] || area.area,
    areaFull: AREA_LABELS[area.area] || area.area_name,
    escola1: area.school_1_score,
    escola2: area.school_2_score,
    diff: area.difference,
    topBrasil: topScores?.[area.area] || null,
    winner: area.difference > 0 ? 'escola1' : area.difference < 0 ? 'escola2' : 'tie',
  }));

  // Truncate names for legend
  const school1Label = school1Name.length > 18 ? school1Name.slice(0, 18) + '...' : school1Name;
  const school2Label = school2Name.length > 18 ? school2Name.slice(0, 18) + '...' : school2Name;

  // Find max top score for reference line
  const maxTop = topScores ? Math.max(...Object.values(topScores)) : null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-2">Notas por Área</h2>
      <p className="text-sm text-gray-500 mb-6">
        Comparação detalhada das notas em cada área de conhecimento
      </p>

      <ResponsiveContainer width="100%" height={350}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 20, right: 30, left: 80, bottom: 20 }}
          barGap={4}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
          <XAxis
            type="number"
            domain={[400, 950]}
            tick={{ fill: '#6b7280', fontSize: 11 }}
            tickCount={6}
            tickFormatter={(value) => typeof value === 'number' ? formatTriScore(value) : value}
          />
          <YAxis
            type="category"
            dataKey="areaFull"
            tick={{ fill: '#374151', fontSize: 12 }}
            width={75}
          />

          {/* Reference line for TOP Brasil */}
          {maxTop && (
            <ReferenceLine
              x={maxTop}
              stroke="#f59e0b"
              strokeDasharray="5 5"
              strokeWidth={2}
              label={{
                value: `TOP: ${formatTriScore(maxTop)}`,
                fill: '#f59e0b',
                fontSize: 10,
                position: 'top',
              }}
            />
          )}

          <Tooltip
            formatter={(value) => [formatTriScore(value as number) + ' pts']}
            labelFormatter={(label) => String(label)}
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

          <Bar dataKey="escola1" name={school1Label} fill="#3b82f6" radius={[0, 4, 4, 0]}>
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-1-${index}`}
                fill={entry.winner === 'escola1' ? '#3b82f6' : '#93c5fd'}
              />
            ))}
          </Bar>
          <Bar dataKey="escola2" name={school2Label} fill="#22c55e" radius={[0, 4, 4, 0]}>
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-2-${index}`}
                fill={entry.winner === 'escola2' ? '#22c55e' : '#86efac'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Difference indicators below */}
      <div className="mt-4 grid grid-cols-5 gap-2">
        {chartData.map((item) => (
          <div
            key={item.area}
            className={`text-center p-2 rounded-lg ${
              item.diff > 0
                ? 'bg-blue-50'
                : item.diff < 0
                ? 'bg-green-50'
                : 'bg-gray-50'
            }`}
          >
            <p className="text-xs text-gray-500 font-medium">{item.area}</p>
            <p
              className={`text-sm font-bold ${
                item.diff > 0
                  ? 'text-blue-600'
                  : item.diff < 0
                  ? 'text-green-600'
                  : 'text-gray-500'
              }`}
            >
              {item.diff > 0 ? '+' : ''}
              {item.diff.toFixed(0)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
