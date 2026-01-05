'use client';

import { CheckCircle2, XCircle, MinusCircle, Target, Lightbulb } from 'lucide-react';
import { DiagnosisComparisonResult } from '@/lib/api';

interface CompetitiveAnalysisProps {
  diagnosisComparison: DiagnosisComparisonResult;
  school1Name: string;
  school2Name: string;
  perspectiveSchool: 1 | 2; // From whose perspective to show the analysis
}

const AREA_LABELS: Record<string, string> = {
  CN: 'Ciências da Natureza',
  CH: 'Ciências Humanas',
  LC: 'Linguagens e Códigos',
  MT: 'Matemática',
  redacao: 'Redação',
};

function getAdvantageLevel(diff: number): 'high' | 'moderate' | 'tie' {
  const absDiff = Math.abs(diff);
  if (absDiff < 10) return 'tie';
  if (absDiff < 30) return 'moderate';
  return 'high';
}

export default function CompetitiveAnalysis({
  diagnosisComparison,
  school1Name,
  school2Name,
  perspectiveSchool,
}: CompetitiveAnalysisProps) {
  // Analyze areas from perspective of selected school
  const wins: Array<{ area: string; areaName: string; diff: number; level: string }> = [];
  const losses: Array<{ area: string; areaName: string; diff: number; level: string }> = [];
  const ties: Array<{ area: string; areaName: string }> = [];

  diagnosisComparison.area_comparison.forEach(area => {
    const diff = perspectiveSchool === 1 ? area.difference : -area.difference;
    const areaName = AREA_LABELS[area.area] || area.area_name;
    const level = getAdvantageLevel(diff);

    if (level === 'tie') {
      ties.push({ area: area.area, areaName });
    } else if (diff > 0) {
      wins.push({
        area: area.area,
        areaName,
        diff: Math.abs(diff),
        level: level === 'high' ? 'ALTA' : 'MODERADA',
      });
    } else {
      losses.push({
        area: area.area,
        areaName,
        diff: Math.abs(diff),
        level: level === 'high' ? 'ALTO' : 'MODERADO',
      });
    }
  });

  // Sort by diff (biggest gaps first)
  wins.sort((a, b) => b.diff - a.diff);
  losses.sort((a, b) => b.diff - a.diff);

  // Determine primary recommendation
  const biggestGap = losses[0];
  const myName = perspectiveSchool === 1 ? school1Name : school2Name;
  const opponentName = perspectiveSchool === 1 ? school2Name : school1Name;

  // Calculate total impact if closing biggest gap
  const totalLoss = losses.reduce((sum, l) => sum + l.diff, 0);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-2">
        <Target className="h-5 w-5 text-purple-600" />
        <h2 className="text-xl font-semibold text-gray-900">Análise Competitiva</h2>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Perspectiva de <strong className={perspectiveSchool === 1 ? 'text-blue-600' : 'text-green-600'}>
          {myName.slice(0, 30)}
        </strong>
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Wins Column */}
        <div>
          <h3 className="flex items-center gap-2 font-semibold text-gray-900 mb-3">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            Você Ganha em:
          </h3>
          {wins.length > 0 ? (
            <div className="space-y-2">
              {wins.map(win => (
                <div
                  key={win.area}
                  className="p-3 bg-green-50 border border-green-100 rounded-lg"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-green-800">{win.areaName}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      win.level === 'ALTA'
                        ? 'bg-green-200 text-green-800'
                        : 'bg-green-100 text-green-700'
                    }`}>
                      Vantagem {win.level}
                    </span>
                  </div>
                  <p className="text-sm text-green-600 mt-1">+{win.diff.toFixed(0)} pts</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 italic">Nenhuma área com vantagem clara</p>
          )}
        </div>

        {/* Losses Column */}
        <div>
          <h3 className="flex items-center gap-2 font-semibold text-gray-900 mb-3">
            <XCircle className="h-5 w-5 text-red-500" />
            Você Perde em:
          </h3>
          {losses.length > 0 ? (
            <div className="space-y-2">
              {losses.map(loss => (
                <div
                  key={loss.area}
                  className="p-3 bg-red-50 border border-red-100 rounded-lg"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-red-800">{loss.areaName}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      loss.level === 'ALTO'
                        ? 'bg-red-200 text-red-800'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      Gap {loss.level}
                    </span>
                  </div>
                  <p className="text-sm text-red-600 mt-1">-{loss.diff.toFixed(0)} pts</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 italic">Nenhuma área com desvantagem clara</p>
          )}
        </div>
      </div>

      {/* Ties */}
      {ties.length > 0 && (
        <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
          <div className="flex items-center gap-2">
            <MinusCircle className="h-4 w-4 text-gray-500" />
            <span className="text-sm text-gray-600">
              <strong>Empate técnico:</strong> {ties.map(t => t.areaName).join(', ')} (diferença &lt; 10 pts)
            </span>
          </div>
        </div>
      )}

      {/* Strategic Recommendation */}
      {biggestGap && (
        <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <div className="flex items-start gap-3">
            <Lightbulb className="h-5 w-5 text-amber-600 mt-0.5" />
            <div>
              <h4 className="font-semibold text-amber-900">Recomendação Estratégica</h4>
              <p className="text-sm text-amber-800 mt-1">
                Para ultrapassar <strong>{opponentName.slice(0, 25)}</strong>, foque em:
              </p>
              <ol className="mt-3 space-y-2">
                {losses.slice(0, 2).map((loss, index) => (
                  <li key={loss.area} className="flex items-start gap-2 text-sm">
                    <span className={`font-bold ${index === 0 ? 'text-red-600' : 'text-amber-700'}`}>
                      {index + 1}.
                    </span>
                    <span className="text-amber-800">
                      <strong>{loss.areaName}</strong> (gap: -{loss.diff.toFixed(0)} pts)
                      {index === 0 && ' → Maior oportunidade de ganho'}
                    </span>
                  </li>
                ))}
              </ol>
              {wins.length > 0 && (
                <p className="mt-3 text-sm text-amber-700">
                  ✅ <strong>Mantenha:</strong> {wins.map(w => w.areaName).join(', ')} (suas fortalezas)
                </p>
              )}
              {biggestGap && totalLoss > 0 && (
                <p className="mt-2 text-xs text-amber-600">
                  Se igualar todas as áreas deficitárias, você ganha +{totalLoss.toFixed(0)} pts na média.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
