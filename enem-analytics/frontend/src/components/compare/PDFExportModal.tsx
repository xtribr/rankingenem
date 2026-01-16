'use client';

import { useState, useRef } from 'react';
import { X, FileDown, Loader2, Check } from 'lucide-react';

interface PDFExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  school1Name: string;
  school2Name: string;
  contentRef: React.RefObject<HTMLDivElement | null>;
}

interface ExportSection {
  id: string;
  label: string;
  checked: boolean;
}

export default function PDFExportModal({
  isOpen,
  onClose,
  school1Name,
  school2Name,
  contentRef,
}: PDFExportModalProps) {
  const [sections, setSections] = useState<ExportSection[]>([
    { id: 'summary', label: 'Resumo Geral (cards de placar)', checked: true },
    { id: 'radar', label: 'Gráfico Radar (comparação por área)', checked: true },
    { id: 'bars', label: 'Gráfico de Barras por Área', checked: true },
    { id: 'evolution', label: 'Evolução Histórica (2018-2024)', checked: true },
    { id: 'competitive', label: 'Análise de Pontos Fortes/Fracos', checked: true },
    { id: 'tri-analysis', label: 'Análise TRI (proficiência)', checked: true },
    { id: 'quickwins', label: 'Quick Wins (oportunidades)', checked: true },
    { id: 'success-stories', label: 'Casos de Sucesso', checked: true },
    { id: 'rankings', label: 'Rankings e Posição Relativa', checked: true },
  ]);
  const [includeWatermark, setIncludeWatermark] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  const toggleSection = (id: string) => {
    setSections(prev =>
      prev.map(s => (s.id === id ? { ...s, checked: !s.checked } : s))
    );
  };

  // Convert modern CSS colors (lab, oklch) to rgb for html2canvas compatibility
  const convertModernColors = (element: HTMLElement) => {
    const convertColor = (color: string): string => {
      if (!color || color === 'transparent' || color === 'inherit' || color === 'initial') {
        return color;
      }
      // Check if it's a modern color function that needs conversion
      if (color.includes('lab(') || color.includes('oklch(') || color.includes('oklab(')) {
        // Create a temporary element to get computed rgb value
        const temp = document.createElement('div');
        temp.style.color = color;
        temp.style.display = 'none';
        document.body.appendChild(temp);
        const computed = getComputedStyle(temp).color;
        document.body.removeChild(temp);
        return computed || color;
      }
      return color;
    };

    const processElement = (el: HTMLElement) => {
      const computed = getComputedStyle(el);
      const colorProps = [
        'color', 'backgroundColor', 'borderColor',
        'borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor',
        'outlineColor', 'textDecorationColor', 'caretColor'
      ];

      colorProps.forEach(prop => {
        const cssProp = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
        const value = computed.getPropertyValue(cssProp);
        if (value && (value.includes('lab(') || value.includes('oklch(') || value.includes('oklab('))) {
          const converted = convertColor(value);
          el.style.setProperty(cssProp, converted);
        }
      });

      // Process children
      Array.from(el.children).forEach(child => {
        if (child instanceof HTMLElement) {
          processElement(child);
        }
      });
    };

    processElement(element);
  };

  const handleExport = async () => {
    if (!contentRef.current) return;

    setIsExporting(true);
    setExportSuccess(false);

    try {
      // Dynamic import of html2pdf
      const html2pdf = (await import('html2pdf.js')).default;

      // Get selected section IDs
      const selectedIds = sections.filter(s => s.checked).map(s => s.id);

      // Clone the content
      const content = contentRef.current.cloneNode(true) as HTMLElement;

      // Convert modern CSS colors (lab, oklch) to rgb for html2canvas
      document.body.appendChild(content);
      content.style.position = 'absolute';
      content.style.left = '-9999px';
      convertModernColors(content);
      document.body.removeChild(content);

      // Hide unselected sections
      const allSections = content.querySelectorAll('[data-section]');
      allSections.forEach(section => {
        const sectionId = section.getAttribute('data-section');
        if (sectionId && !selectedIds.includes(sectionId)) {
          (section as HTMLElement).style.display = 'none';
        }
      });

      // Add header
      const header = document.createElement('div');
      header.innerHTML = `
        <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #e5e7eb; margin-bottom: 20px;">
          <h1 style="font-size: 24px; font-weight: bold; color: #1f2937; margin: 0;">X-TRI Escolas</h1>
          <p style="font-size: 14px; color: #6b7280; margin: 8px 0 0 0;">Relatório Comparativo de Escolas</p>
          <p style="font-size: 12px; color: #9ca3af; margin: 4px 0 0 0;">Gerado em: ${new Date().toLocaleDateString('pt-BR')}</p>
        </div>
        <div style="text-align: center; margin-bottom: 24px;">
          <p style="font-size: 16px; color: #374151;">
            <strong style="color: #3b82f6;">${school1Name}</strong>
            <span style="margin: 0 12px; color: #9ca3af;">vs</span>
            <strong style="color: #22c55e;">${school2Name}</strong>
          </p>
        </div>
      `;
      content.insertBefore(header, content.firstChild);

      // Add footer/watermark
      if (includeWatermark) {
        const footer = document.createElement('div');
        footer.innerHTML = `
          <div style="text-align: center; padding: 20px 0; border-top: 1px solid #e5e7eb; margin-top: 20px;">
            <p style="font-size: 11px; color: #9ca3af;">
              Gerado por X-TRI Analytics • www.xtriescolas.app
            </p>
          </div>
        `;
        content.appendChild(footer);
      }

      // Configure pdf options
      const opt = {
        margin: [10, 10, 10, 10] as [number, number, number, number],
        filename: `comparativo_${school1Name.slice(0, 15).replace(/\s/g, '_')}_vs_${school2Name.slice(0, 15).replace(/\s/g, '_')}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: false,
        },
        jsPDF: {
          unit: 'mm' as const,
          format: 'a4' as const,
          orientation: 'portrait' as const,
        },
        pagebreak: { mode: 'avoid-all' as const },
      };

      // Generate PDF
      await html2pdf().set(opt).from(content).save();

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
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <FileDown className="h-5 w-5 text-purple-600" />
            <h2 className="font-semibold text-gray-900">Exportar Relatório PDF</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          <p className="text-sm text-gray-600 mb-4">
            Selecione as seções a incluir no relatório:
          </p>

          {/* Sections checkboxes */}
          <div className="space-y-2 mb-6">
            {sections.map(section => (
              <label
                key={section.id}
                className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={section.checked}
                  onChange={() => toggleSection(section.id)}
                  className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                />
                <span className="text-sm text-gray-700">{section.label}</span>
              </label>
            ))}
          </div>

          {/* Watermark option */}
          <div className="border-t border-gray-200 pt-4">
            <label className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer">
              <input
                type="checkbox"
                checked={includeWatermark}
                onChange={(e) => setIncludeWatermark(e.target.checked)}
                className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
              />
              <span className="text-sm text-gray-700">Incluir marca d&apos;água X-TRI</span>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            disabled={isExporting}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting || sections.filter(s => s.checked).length === 0}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50 ${
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
                Exportado!
              </>
            ) : (
              <>
                <FileDown className="h-4 w-4" />
                Gerar Relatório
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
