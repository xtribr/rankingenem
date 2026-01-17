'use client';

import { useState } from 'react';
import { X, FileDown, Loader2, Check, FileText } from 'lucide-react';
import { generateExecutiveReport } from './ExecutiveReportGenerator';
import { DiagnosisComparisonResult, SchoolHistory } from '@/lib/api';

interface ComparisonYear {
  ano: number;
  escola1: {
    nota_media: number | null;
    ranking: number | null;
  } | null;
  escola2: {
    nota_media: number | null;
    ranking: number | null;
  } | null;
}

interface PDFExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  school1Name: string;
  school2Name: string;
  school1Code: string;
  school2Code: string;
  school1Data?: {
    nota_media: number | null;
    ranking: number | null;
    uf?: string;
  };
  school2Data?: {
    nota_media: number | null;
    ranking: number | null;
    uf?: string;
  };
  diagnosisComparison?: DiagnosisComparisonResult;
  history1?: SchoolHistory;
  history2?: SchoolHistory;
  comparison?: {
    escola1: { codigo_inep: string; nome_escola: string; uf: string | null };
    escola2: { codigo_inep: string; nome_escola: string; uf: string | null };
    common_years: number[];
    comparison: ComparisonYear[];
  };
}

export default function PDFExportModal({
  isOpen,
  onClose,
  school1Name,
  school2Name,
  school1Code,
  school2Code,
  school1Data,
  school2Data,
  diagnosisComparison,
  history1,
  history2,
  comparison,
}: PDFExportModalProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  const handleExport = async () => {
    if (!diagnosisComparison) {
      alert('Dados de comparação não disponíveis. Aguarde o carregamento.');
      return;
    }

    setIsExporting(true);
    setExportSuccess(false);

    try {
      // Generate executive report using jsPDF directly
      generateExecutiveReport({
        school1: {
          codigo_inep: school1Code,
          nome_escola: school1Name,
          nota_media: school1Data?.nota_media || null,
          ranking: school1Data?.ranking || null,
          uf: school1Data?.uf,
          tipo_escola: history1?.tipo_escola,
        },
        school2: {
          codigo_inep: school2Code,
          nome_escola: school2Name,
          nota_media: school2Data?.nota_media || null,
          ranking: school2Data?.ranking || null,
          uf: school2Data?.uf,
          tipo_escola: history2?.tipo_escola,
        },
        diagnosisComparison,
        history1,
        history2,
        comparison,
        generatedAt: new Date(),
      });

      setExportSuccess(true);
      setTimeout(() => {
        setExportSuccess(false);
        onClose();
      }, 1500);
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Erro ao exportar PDF. Tente novamente.');
    } finally {
      setIsExporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <FileDown className="h-5 w-5 text-purple-600" />
            <h2 className="font-semibold text-gray-900">Exportar Relatório</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Preview */}
          <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl p-6 mb-6 border border-purple-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center">
                <FileText className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-purple-900">Relatório Executivo</h3>
                <p className="text-sm text-purple-600">PDF formatado com marca X-TRI</p>
              </div>
            </div>

            <div className="space-y-2 text-sm text-gray-600">
              <p>📊 Resumo executivo da comparação</p>
              <p>📈 Tabela de desempenho por área</p>
              <p>💪 Análise de pontos fortes e fracos</p>
              <p>🎯 Recomendações estratégicas</p>
            </div>
          </div>

          {/* Schools info */}
          <div className="flex items-center justify-center gap-4 mb-6">
            <div className="text-center">
              <p className="text-xs text-gray-500 mb-1">Escola 1</p>
              <p className="font-medium text-blue-600 text-sm">{school1Name.slice(0, 20)}</p>
            </div>
            <span className="text-gray-400">vs</span>
            <div className="text-center">
              <p className="text-xs text-gray-500 mb-1">Escola 2</p>
              <p className="font-medium text-green-600 text-sm">{school2Name.slice(0, 20)}</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <button
            onClick={onClose}
            disabled={isExporting}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting || !diagnosisComparison}
            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50 ${
              exportSuccess
                ? 'bg-green-600'
                : 'bg-purple-600 hover:bg-purple-700'
            }`}
          >
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Gerando...
              </>
            ) : exportSuccess ? (
              <>
                <Check className="h-4 w-4" />
                Baixado!
              </>
            ) : (
              <>
                <FileDown className="h-4 w-4" />
                Gerar PDF
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
