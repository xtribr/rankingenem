'use client';

import { TrendingUp, TrendingDown, Trophy, Minus } from 'lucide-react';
import { DiagnosisComparisonResult } from '@/lib/api';
import { formatTriScore } from '@/lib/utils';

interface SchoolSummary {
  codigo_inep: string;
  nome_escola: string;
  nota_media: number | null;
  ranking: number | null;
  tendencia: number | null; // pts/ano
  winsIn: string[]; // areas where this school wins
}

interface SummaryCardsProps {
  school1: SchoolSummary;
  school2: SchoolSummary;
  diagnosisComparison?: DiagnosisComparisonResult;
}

const AREA_NAMES: Record<string, string> = {
  CN: 'Ciências Natureza',
  CH: 'Ciências Humanas',
  LC: 'Linguagens',
  MT: 'Matemática',
  redacao: 'Redação',
};

export default function SummaryCards({ school1, school2, diagnosisComparison }: SummaryCardsProps) {
  const diff = (school1.nota_media || 0) - (school2.nota_media || 0);

  // Calculate wins from diagnosis comparison
  const school1Wins: string[] = [];
  const school2Wins: string[] = [];

  if (diagnosisComparison) {
    diagnosisComparison.area_comparison.forEach(area => {
      if (area.difference > 0) {
        school1Wins.push(AREA_NAMES[area.area] || area.area_name);
      } else if (area.difference < 0) {
        school2Wins.push(AREA_NAMES[area.area] || area.area_name);
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Main comparison cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* School 1 Card */}
        <div className="bg-white rounded-xl shadow-sm border-2 border-blue-200 p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-semibold text-gray-900 text-lg truncate max-w-[200px]" title={school1.nome_escola}>
                {school1.nome_escola}
              </h3>
              <p className="text-sm text-gray-500">{school1.codigo_inep}</p>
            </div>
            <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-blue-600 font-bold">1</span>
            </div>
          </div>

          <div className="space-y-3">
            {/* Score */}
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" />
              <span className="text-2xl font-bold text-blue-600">
                {formatTriScore(school1.nota_media)} pts
              </span>
              <span className="text-sm text-gray-500">(2024)</span>
            </div>

            {/* Trend */}
            {school1.tendencia !== null && (
              <div className="flex items-center gap-2">
                {school1.tendencia >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-green-500" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                )}
                <span className={`text-sm font-medium ${school1.tendencia >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {school1.tendencia >= 0 ? '+' : ''}{school1.tendencia.toFixed(1)} pts/ano
                </span>
              </div>
            )}

            {/* Ranking */}
            {school1.ranking && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>🏆</span>
                <span>#{school1.ranking} Brasil</span>
              </div>
            )}

            {/* Wins in */}
            {school1Wins.length > 0 && (
              <div className="pt-2 border-t border-gray-100">
                <p className="text-xs text-gray-500 mb-1">Ganha em:</p>
                <div className="flex flex-wrap gap-1">
                  {school1Wins.map(area => (
                    <span key={area} className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                      {area}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* School 2 Card */}
        <div className="bg-white rounded-xl shadow-sm border-2 border-green-200 p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-semibold text-gray-900 text-lg truncate max-w-[200px]" title={school2.nome_escola}>
                {school2.nome_escola}
              </h3>
              <p className="text-sm text-gray-500">{school2.codigo_inep}</p>
            </div>
            <div className="h-10 w-10 bg-green-100 rounded-full flex items-center justify-center">
              <span className="text-green-600 font-bold">2</span>
            </div>
          </div>

          <div className="space-y-3">
            {/* Score */}
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" />
              <span className="text-2xl font-bold text-green-600">
                {formatTriScore(school2.nota_media)} pts
              </span>
              <span className="text-sm text-gray-500">(2024)</span>
            </div>

            {/* Trend */}
            {school2.tendencia !== null && (
              <div className="flex items-center gap-2">
                {school2.tendencia >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-green-500" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                )}
                <span className={`text-sm font-medium ${school2.tendencia >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {school2.tendencia >= 0 ? '+' : ''}{school2.tendencia.toFixed(1)} pts/ano
                </span>
              </div>
            )}

            {/* Ranking */}
            {school2.ranking && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>🏆</span>
                <span>#{school2.ranking} Brasil</span>
              </div>
            )}

            {/* Wins in */}
            {school2Wins.length > 0 && (
              <div className="pt-2 border-t border-gray-100">
                <p className="text-xs text-gray-500 mb-1">Ganha em:</p>
                <div className="flex flex-wrap gap-1">
                  {school2Wins.map(area => (
                    <span key={area} className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">
                      {area}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Difference indicator */}
      <div className="flex justify-center">
        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${
          diff > 0 ? 'bg-blue-50 text-blue-700' : diff < 0 ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-600'
        }`}>
          {diff === 0 ? (
            <>
              <Minus className="h-4 w-4" />
              <span className="font-medium">Empate técnico</span>
            </>
          ) : (
            <>
              <span className="font-medium">
                Diferença: {diff > 0 ? '+' : ''}{formatTriScore(diff)} pts
              </span>
              <span className="text-sm">
                ({diff > 0 ? school1.nome_escola.slice(0, 15) : school2.nome_escola.slice(0, 15)} na frente)
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
