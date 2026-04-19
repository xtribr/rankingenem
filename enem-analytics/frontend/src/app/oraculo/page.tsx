'use client';

import { Fragment, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, OraclePrediction, OracleResponse } from '@/lib/api';
import { formatTriScore } from '@/lib/utils';
import Link from 'next/link';
import {
  Sparkles,
  TrendingUp,
  BookOpen,
  Brain,
  Calculator,
  Globe,
  ChevronDown,
  ChevronUp,
  Info,
  Filter,
  Database,
  FileText,
} from 'lucide-react';

// Normaliza nomes de área do CSV para exibição
const normalizeArea = (area: string): string => {
  const map: Record<string, string> = {
    'Linguagens': 'Linguagens',
    'Humanas': 'Ciências Humanas',
    'Natureza': 'Ciências da Natureza',
    'Matematica': 'Matemática',
    'Matemática': 'Matemática'
  };
  return map[area] || area;
};

const AREA_ICONS: Record<string, React.ReactNode> = {
  'Linguagens': <BookOpen className="h-5 w-5" />,
  'Ciências Humanas': <Globe className="h-5 w-5" />,
  'Humanas': <Globe className="h-5 w-5" />,
  'Ciências da Natureza': <Brain className="h-5 w-5" />,
  'Natureza': <Brain className="h-5 w-5" />,
  'Matemática': <Calculator className="h-5 w-5" />,
  'Matematica': <Calculator className="h-5 w-5" />
};

const AREA_COLORS: Record<string, string> = {
  'Linguagens': 'bg-purple-100 text-purple-800 border-purple-200',
  'Ciências Humanas': 'bg-amber-100 text-amber-800 border-amber-200',
  'Humanas': 'bg-amber-100 text-amber-800 border-amber-200',
  'Ciências da Natureza': 'bg-green-100 text-green-800 border-green-200',
  'Natureza': 'bg-green-100 text-green-800 border-green-200',
  'Matemática': 'bg-blue-100 text-blue-800 border-blue-200',
  'Matematica': 'bg-blue-100 text-blue-800 border-blue-200'
};

const TIPO_COLORS: Record<string, string> = {
  'Recorrente': 'bg-green-100 text-green-700 border-green-200',
  'Frequente': 'bg-blue-100 text-blue-700 border-blue-200',
  'Ocasional': 'bg-gray-100 text-gray-700 border-gray-200'
};

export default function OraculoPage() {
  const [selectedArea, setSelectedArea] = useState<string>('');
  const [selectedTipo, setSelectedTipo] = useState<string>('');
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  const { data, isLoading, error } = useQuery<OracleResponse>({
    queryKey: ['oracle-predictions', selectedArea, selectedTipo],
    queryFn: () =>
      api.getOraclePredictions({
        area: selectedArea || undefined,
        tipo: selectedTipo || undefined,
      }),
  });

  const predictionYear = data?.ano_predicao;

  const getProbabilityColor = (prob: number) => {
    if (prob >= 0.3) return 'text-green-600 bg-green-50';
    if (prob >= 0.1) return 'text-blue-600 bg-blue-50';
    if (prob >= 0.05) return 'text-yellow-600 bg-yellow-50';
    return 'text-gray-600 bg-gray-50';
  };

  const getProbabilityBar = (prob: number) => {
    // Escala logarítmica para melhor visualização
    const width = Math.min(100, Math.round(prob * 200));
    let color = 'bg-gray-400';
    if (prob >= 0.3) color = 'bg-green-500';
    else if (prob >= 0.1) color = 'bg-blue-500';
    else if (prob >= 0.05) color = 'bg-yellow-500';
    return (
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${width}%` }} />
      </div>
    );
  };

  const getDifficultyLabel = (tri: number) => {
    if (tri >= 700) return { label: 'Difícil', color: 'text-red-600 bg-red-50' };
    if (tri >= 550) return { label: 'Médio', color: 'text-yellow-600 bg-yellow-50' };
    return { label: 'Fácil', color: 'text-green-600 bg-green-50' };
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">
                  {predictionYear ? `Oráculo ENEM ${predictionYear}` : 'Oráculo ENEM'}
                </h1>
                <p className="text-sm text-slate-500">
                  Análise estatística de {data?.total || '...'} campos semânticos (2.600 questões históricas)
                </p>
              </div>
            </div>
            <Link
              href="/"
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              ← Voltar
            </Link>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Filtros</span>
          </div>
          <div className="flex flex-wrap gap-4">
            <select
              value={selectedArea}
              onChange={(e) => setSelectedArea(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white text-sm"
            >
              <option value="">Todas as Áreas</option>
              <option value="Linguagens">Linguagens</option>
              <option value="Humanas">Ciências Humanas</option>
              <option value="Natureza">Ciências da Natureza</option>
              <option value="Matematica">Matemática</option>
            </select>

            <select
              value={selectedTipo}
              onChange={(e) => setSelectedTipo(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white text-sm"
            >
              <option value="">Todos os Tipos</option>
              <option value="Recorrente">Recorrente (≥10%)</option>
              <option value="Frequente">Frequente (5-10%)</option>
              <option value="Ocasional">Ocasional (&lt;5%)</option>
            </select>

            {data && (
              <div className="ml-auto flex items-center gap-2 text-sm text-gray-500">
                <TrendingUp className="h-4 w-4" />
                <span>{data.total} campos semânticos</span>
              </div>
            )}
          </div>
        </div>

        {/* Predictions Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
            </div>
          ) : error ? (
            <div className="text-center py-20 text-red-500">
              Erro ao carregar predições. Tente novamente.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider w-16">
                      Rank
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider w-40">
                      Área
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      Campo Semântico
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider w-28">
                      Tipo
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider w-32">
                      Freq. Histórica
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider w-28">
                      Questões
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider w-20">
                      +
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data?.predicoes.map((pred: OraclePrediction) => (
                    <Fragment key={pred.rank}>
                      <tr
                        className="hover:bg-slate-50 transition-colors cursor-pointer"
                        onClick={() => setExpandedRow(expandedRow === pred.rank ? null : pred.rank)}
                      >
                        <td className="px-4 py-4">
                          <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${
                            pred.rank <= 3 ? 'bg-yellow-100 text-yellow-700' :
                            pred.rank <= 10 ? 'bg-indigo-100 text-indigo-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {pred.rank}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border ${AREA_COLORS[pred.area] || 'bg-gray-100 text-gray-800'}`}>
                            {AREA_ICONS[pred.area]}
                            {normalizeArea(pred.area).split(' ')[0]}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <span className="font-medium text-slate-900">{pred.tema}</span>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${TIPO_COLORS[pred.tipo] || 'bg-gray-100 text-gray-700'}`}>
                            {pred.tipo}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className={`text-sm font-semibold px-2 py-0.5 rounded ${getProbabilityColor(pred.probabilidade)}`}>
                                {(pred.probabilidade * 100).toFixed(1)}%
                              </span>
                            </div>
                            {getProbabilityBar(pred.probabilidade)}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          {pred.base_cientifica && (
                            <div className="text-sm">
                              <span className="font-semibold text-slate-700">
                                {pred.base_cientifica.questoes_historicas}
                              </span>
                              <span className="text-slate-400 text-xs">
                                /{pred.base_cientifica.total_area}
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-4 text-center">
                          <button className="p-1 hover:bg-slate-100 rounded-lg transition-colors">
                            {expandedRow === pred.rank ? (
                              <ChevronUp className="h-5 w-5 text-slate-400" />
                            ) : (
                              <ChevronDown className="h-5 w-5 text-slate-400" />
                            )}
                          </button>
                        </td>
                      </tr>
                      {expandedRow === pred.rank && (
                        <tr className="bg-gradient-to-br from-slate-50 to-indigo-50/30">
                          <td colSpan={7} className="px-4 py-5">
                            <div className="space-y-4">
                              {/* Base Científica */}
                              {pred.base_cientifica && (
                                <div className="bg-white rounded-lg p-4 border border-slate-200 shadow-sm">
                                  <h4 className="text-xs font-semibold text-slate-600 uppercase mb-3 flex items-center gap-1">
                                    <Database className="h-3.5 w-3.5" />
                                    Base Científica
                                  </h4>
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div>
                                      <p className="text-[10px] text-slate-400 uppercase">Questões Históricas</p>
                                      <p className="text-lg font-bold text-slate-900">
                                        {pred.base_cientifica.questoes_historicas}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-slate-400 uppercase">Frequência na Área</p>
                                      <p className="text-lg font-bold text-indigo-600">
                                        {pred.base_cientifica.frequencia_percentual.toFixed(1)}%
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-slate-400 uppercase">TRI Médio</p>
                                      <p className={`text-lg font-bold ${getDifficultyLabel(pred.base_cientifica.tri_medio).color} px-2 py-0.5 rounded inline-block`}>
                                        {formatTriScore(pred.base_cientifica.tri_medio)}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-slate-400 uppercase">Dificuldade</p>
                                      <p className={`text-sm font-semibold ${getDifficultyLabel(pred.base_cientifica.tri_medio).color} px-2 py-0.5 rounded inline-block`}>
                                        {getDifficultyLabel(pred.base_cientifica.tri_medio).label}
                                      </p>
                                    </div>
                                  </div>
                                  <p className="text-[10px] text-slate-400 mt-3 flex items-center gap-1">
                                    <FileText className="h-3 w-3" />
                                    {pred.base_cientifica.fonte}
                                  </p>
                                </div>
                              )}

                              {/* Exemplos de Questões */}
                              {pred.exemplos_questoes && pred.exemplos_questoes.length > 0 && (
                                <div>
                                  <h4 className="text-xs font-semibold text-amber-600 uppercase mb-2 flex items-center gap-1">
                                    <FileText className="h-3.5 w-3.5" />
                                    Exemplos de Questões Anteriores
                                  </h4>
                                  <div className="space-y-2">
                                    {pred.exemplos_questoes.slice(0, 3).map((ex, i) => (
                                      <div key={i} className="bg-amber-50 rounded-lg p-3 border border-amber-100 text-xs text-amber-800">
                                        {ex}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Habilidades da Matriz ENEM */}
                              {pred.habilidades_matriz && pred.habilidades_matriz.length > 0 && (
                                <div>
                                  <h4 className="text-xs font-semibold text-indigo-600 uppercase mb-2 flex items-center gap-1">
                                    <Brain className="h-3.5 w-3.5" />
                                    Habilidades da Matriz ENEM
                                  </h4>
                                  <div className="space-y-2">
                                    {pred.habilidades_matriz.slice(0, 3).map((h, i) => (
                                      <div key={i} className="bg-white rounded-lg p-3 border border-indigo-100 shadow-sm">
                                        <div className="flex items-start gap-2">
                                          <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs font-bold flex-shrink-0">
                                            {h.codigo}
                                          </span>
                                          <div className="flex-1 min-w-0">
                                            <p className="text-xs text-slate-700 leading-relaxed">{h.descricao}</p>
                                            <p className="text-[10px] text-slate-400 mt-1">
                                              Competência {h.competencia}: {h.competencia_descricao}
                                            </p>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Objetos de Conhecimento */}
                                {pred.objetos_conhecimento && pred.objetos_conhecimento.length > 0 && (
                                  <div>
                                    <h4 className="text-xs font-semibold text-green-600 uppercase mb-2 flex items-center gap-1">
                                      <BookOpen className="h-3.5 w-3.5" />
                                      Objetos de Conhecimento
                                    </h4>
                                    <div className="space-y-2">
                                      {pred.objetos_conhecimento.slice(0, 2).map((obj, i) => (
                                        <div key={i} className="bg-white rounded-lg p-3 border border-green-100">
                                          <p className="text-xs font-medium text-slate-800">{obj.tema}</p>
                                          {obj.sub_area && (
                                            <span className="text-[10px] text-green-600 uppercase">{obj.sub_area}</span>
                                          )}
                                          {obj.conteudos && obj.conteudos.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-2">
                                              {obj.conteudos.slice(0, 4).map((c, j) => (
                                                <span key={j} className="px-1.5 py-0.5 bg-green-50 text-green-700 rounded text-[10px]">
                                                  {c}
                                                </span>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Eixos Cognitivos */}
                                <div className="space-y-4">
                                  {pred.eixos_cognitivos && pred.eixos_cognitivos.length > 0 && (
                                    <div>
                                      <h4 className="text-xs font-semibold text-purple-600 uppercase mb-2 flex items-center gap-1">
                                        <Sparkles className="h-3.5 w-3.5" />
                                        Eixos Cognitivos
                                      </h4>
                                      <div className="flex flex-wrap gap-1">
                                        {pred.eixos_cognitivos.map((e, i) => (
                                          <span key={i} className="px-2 py-1 bg-purple-50 border border-purple-200 rounded text-xs text-purple-700" title={e.descricao}>
                                            {e.codigo} - {e.nome}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Habilidades Históricas */}
                                  {pred.base_cientifica?.habilidades_historicas && (
                                    <div>
                                      <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">
                                        Habilidades Mais Frequentes (histórico)
                                      </h4>
                                      <div className="flex flex-wrap gap-1">
                                        {pred.base_cientifica.habilidades_historicas.slice(0, 5).map((h, i) => (
                                          <span key={i} className="px-2 py-1 bg-white border border-slate-200 rounded text-xs text-slate-700">
                                            {h}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Justificativa */}
                              <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                                <h4 className="text-xs font-semibold text-slate-600 uppercase mb-1">Base da Predição</h4>
                                <p className="text-xs text-slate-700">
                                  {pred.justificativa}
                                </p>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer Info */}
        <div className="text-center text-xs text-slate-400 py-4">
          <p>
            Predições geradas em {data?.gerado_em} | Modelo: {data?.modelo} v{data?.versao}
          </p>
          <p className="mt-1">
            Baseado em análise estatística de frequência histórica. Probabilidades representam frequência real nas provas anteriores.
          </p>
        </div>
      </div>
    </div>
  );
}
