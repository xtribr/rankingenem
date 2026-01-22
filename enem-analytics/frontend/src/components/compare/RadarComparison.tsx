'use client';

import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { DiagnosisComparisonResult } from '@/lib/api';

interface RadarComparisonProps {
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

export default function RadarComparison({
  diagnosisComparison,
  topScores,
  school1Name,
  school2Name,
}: RadarComparisonProps) {
  // Prepare data for radar chart
  const chartData = diagnosisComparison.area_comparison.map(area => ({
    area: AREA_LABELS[area.area] || area.area_name,
    areaCode: area.area,
    escola1: area.school_1_score,
    escola2: area.school_2_score,
    topBrasil: topScores?.[area.area] || 900,
  }));

  // Use labels directly (no truncation needed for anonymous labels)
  const school1Label = school1Name;
  const school2Label = school2Name;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Comparação por Área</h2>
      <p className="text-sm text-gray-500 mb-6">
        Visualize as notas em cada área de conhecimento
      </p>

      <ResponsiveContainer width="100%" height={400}>
        <RadarChart data={chartData} margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
          <PolarGrid strokeDasharray="3 3" />
          <PolarAngleAxis
            dataKey="area"
            tick={{ fill: '#374151', fontSize: 12 }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[400, 900]}
            tick={{ fill: '#6b7280', fontSize: 10 }}
            tickCount={6}
          />

          {/* TOP Brasil reference */}
          {topScores && (
            <Radar
              name="TOP Brasil"
              dataKey="topBrasil"
              stroke="#f59e0b"
              fill="#f59e0b"
              fillOpacity={0.1}
              strokeWidth={2}
              strokeDasharray="5 5"
            />
          )}

          {/* School 1 */}
          <Radar
            name={school1Label}
            dataKey="escola1"
            stroke="#3b82f6"
            fill="#3b82f6"
            fillOpacity={0.3}
            strokeWidth={2}
          />

          {/* School 2 */}
          <Radar
            name={school2Label}
            dataKey="escola2"
            stroke="#22c55e"
            fill="#22c55e"
            fillOpacity={0.3}
            strokeWidth={2}
          />

          <Tooltip
            formatter={(value) => [(value as number).toFixed(0) + ' pts']}
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            }}
          />
          <Legend
            wrapperStyle={{ paddingTop: 20 }}
            formatter={(value) => <span className="text-sm text-gray-700">{value}</span>}
          />
        </RadarChart>
      </ResponsiveContainer>

      {/* Legend explanation */}
      <div className="mt-4 flex flex-wrap justify-center gap-4 text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <div className="w-3 h-0.5 bg-blue-500"></div>
          <span>Escola 1</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-0.5 bg-green-500"></div>
          <span>Escola 2</span>
        </div>
        {topScores && (
          <div className="flex items-center gap-1">
            <div className="w-3 h-0.5 bg-amber-500" style={{ borderStyle: 'dashed' }}></div>
            <span>TOP Brasil (referência)</span>
          </div>
        )}
      </div>
    </div>
  );
}
