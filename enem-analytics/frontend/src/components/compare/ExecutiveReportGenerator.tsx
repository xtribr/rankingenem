'use client';

import { jsPDF } from 'jspdf';
import { DiagnosisComparisonResult } from '@/lib/api';

interface SchoolData {
  codigo_inep: string;
  nome_escola: string;
  nota_media: number | null;
  ranking: number | null;
  uf?: string;
}

export interface ReportData {
  school1: SchoolData;
  school2: SchoolData;
  diagnosisComparison: DiagnosisComparisonResult;
  generatedAt: Date;
}

const XTRI_PURPLE = [147, 51, 234]; // #9333ea
const XTRI_BLUE = [59, 130, 246]; // #3b82f6
const XTRI_GREEN = [34, 197, 94]; // #22c55e

export function generateExecutiveReport(data: ReportData): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  let y = margin;

  // Helper functions
  const addText = (text: string, x: number, yPos: number, options?: {
    fontSize?: number;
    fontStyle?: 'normal' | 'bold' | 'italic';
    color?: number[];
    align?: 'left' | 'center' | 'right';
    maxWidth?: number;
  }) => {
    const { fontSize = 12, fontStyle = 'normal', color = [0, 0, 0], align = 'left', maxWidth } = options || {};
    doc.setFontSize(fontSize);
    doc.setFont('helvetica', fontStyle);
    doc.setTextColor(color[0], color[1], color[2]);

    if (maxWidth) {
      const lines = doc.splitTextToSize(text, maxWidth);
      doc.text(lines, x, yPos, { align });
      return lines.length * (fontSize * 0.4);
    }
    doc.text(text, x, yPos, { align });
    return fontSize * 0.4;
  };

  const addLine = (y1: number, color: number[] = [229, 231, 235]) => {
    doc.setDrawColor(color[0], color[1], color[2]);
    doc.setLineWidth(0.5);
    doc.line(margin, y1, pageWidth - margin, y1);
  };

  const addBox = (x: number, yPos: number, w: number, h: number, color: number[], filled = true) => {
    if (filled) {
      doc.setFillColor(color[0], color[1], color[2]);
      doc.rect(x, yPos, w, h, 'F');
    } else {
      doc.setDrawColor(color[0], color[1], color[2]);
      doc.rect(x, yPos, w, h, 'S');
    }
  };

  // === HEADER ===
  addBox(0, 0, pageWidth, 45, [250, 245, 255]);
  addBox(0, 0, pageWidth, 3, XTRI_PURPLE);

  addText('X-TRI', pageWidth / 2, 18, {
    fontSize: 28,
    fontStyle: 'bold',
    color: XTRI_PURPLE,
    align: 'center',
  });
  addText('ESCOLAS', pageWidth / 2, 26, {
    fontSize: 14,
    color: [107, 114, 128],
    align: 'center',
  });
  addText('Relatorio Executivo de Comparacao', pageWidth / 2, 35, {
    fontSize: 11,
    color: [156, 163, 175],
    align: 'center',
  });

  y = 55;

  // === SCHOOLS COMPARISON HEADER ===
  const school1Name = data.school1.nome_escola.slice(0, 35);
  const school2Name = data.school2.nome_escola.slice(0, 35);

  // School 1 box
  addBox(margin, y, (pageWidth - margin * 2 - 10) / 2, 25, [239, 246, 255]);
  addText(school1Name, margin + 5, y + 8, {
    fontSize: 10,
    fontStyle: 'bold',
    color: XTRI_BLUE,
    maxWidth: 70,
  });
  addText(`Media: ${data.school1.nota_media?.toFixed(1) || 'N/A'}`, margin + 5, y + 18, {
    fontSize: 14,
    fontStyle: 'bold',
    color: [31, 41, 55],
  });

  // VS
  addText('VS', pageWidth / 2, y + 14, {
    fontSize: 12,
    fontStyle: 'bold',
    color: [156, 163, 175],
    align: 'center',
  });

  // School 2 box
  const school2X = pageWidth / 2 + 5;
  addBox(school2X, y, (pageWidth - margin * 2 - 10) / 2, 25, [240, 253, 244]);
  addText(school2Name, school2X + 5, y + 8, {
    fontSize: 10,
    fontStyle: 'bold',
    color: XTRI_GREEN,
    maxWidth: 70,
  });
  addText(`Media: ${data.school2.nota_media?.toFixed(1) || 'N/A'}`, school2X + 5, y + 18, {
    fontSize: 14,
    fontStyle: 'bold',
    color: [31, 41, 55],
  });

  y += 35;

  // === SUMMARY SECTION ===
  addText('Resumo Executivo', margin, y, {
    fontSize: 14,
    fontStyle: 'bold',
    color: [31, 41, 55],
  });
  y += 8;
  addLine(y);
  y += 8;

  // Calculate winner
  const score1 = data.school1.nota_media || 0;
  const score2 = data.school2.nota_media || 0;
  const diff = Math.abs(score1 - score2);
  const winner = score1 > score2 ? data.school1.nome_escola : data.school2.nome_escola;
  const loser = score1 > score2 ? data.school2.nome_escola : data.school1.nome_escola;

  const summaryText = score1 === score2
    ? `As escolas apresentam desempenho equivalente com media de ${score1.toFixed(1)} pontos.`
    : `${winner.slice(0, 30)} lidera com ${diff.toFixed(1)} pontos de vantagem.`;

  addText(summaryText, margin, y, {
    fontSize: 11,
    color: [55, 65, 81],
    maxWidth: pageWidth - margin * 2,
  });
  y += 12;

  // Rankings
  if (data.school1.ranking && data.school2.ranking) {
    const rankDiff = Math.abs(data.school1.ranking - data.school2.ranking);
    addText(`- Diferenca de ${rankDiff} posicoes no ranking nacional`, margin, y, {
      fontSize: 10,
      color: [75, 85, 99],
    });
    y += 6;
  }

  y += 10;

  // === PERFORMANCE BY AREA ===
  addText('Desempenho por Area do Conhecimento', margin, y, {
    fontSize: 14,
    fontStyle: 'bold',
    color: [31, 41, 55],
  });
  y += 8;
  addLine(y);
  y += 10;

  // Table header
  const colWidths = [50, 35, 35, 35];
  const tableX = margin;

  addBox(tableX, y - 2, pageWidth - margin * 2, 8, [243, 244, 246]);
  addText('Area', tableX + 5, y + 3, { fontSize: 9, fontStyle: 'bold', color: [55, 65, 81] });
  addText(school1Name.slice(0, 12), tableX + colWidths[0] + 5, y + 3, { fontSize: 9, fontStyle: 'bold', color: XTRI_BLUE });
  addText(school2Name.slice(0, 12), tableX + colWidths[0] + colWidths[1] + 5, y + 3, { fontSize: 9, fontStyle: 'bold', color: XTRI_GREEN });
  addText('Diferenca', tableX + colWidths[0] + colWidths[1] + colWidths[2] + 5, y + 3, { fontSize: 9, fontStyle: 'bold', color: [55, 65, 81] });
  y += 10;

  // Table rows using area_comparison
  data.diagnosisComparison.area_comparison.forEach((area, idx) => {
    if (idx % 2 === 0) {
      addBox(tableX, y - 3, pageWidth - margin * 2, 8, [249, 250, 251]);
    }

    addText(area.area_name, tableX + 5, y + 2, { fontSize: 10, color: [31, 41, 55] });
    addText(area.school_1_score.toFixed(1), tableX + colWidths[0] + 10, y + 2, { fontSize: 10, fontStyle: 'bold', color: XTRI_BLUE });
    addText(area.school_2_score.toFixed(1), tableX + colWidths[0] + colWidths[1] + 10, y + 2, { fontSize: 10, fontStyle: 'bold', color: XTRI_GREEN });

    const diff = area.difference;
    const diffColor = diff > 0 ? XTRI_BLUE : diff < 0 ? XTRI_GREEN : [107, 114, 128];
    const diffText = diff > 0 ? `+${diff.toFixed(1)}` : diff.toFixed(1);
    addText(diffText, tableX + colWidths[0] + colWidths[1] + colWidths[2] + 10, y + 2, { fontSize: 10, fontStyle: 'bold', color: diffColor });

    y += 8;
  });

  y += 10;

  // === STRENGTHS & WEAKNESSES ===
  addText('Pontos Fortes e Oportunidades', margin, y, {
    fontSize: 14,
    fontStyle: 'bold',
    color: [31, 41, 55],
  });
  y += 8;
  addLine(y);
  y += 10;

  // Find best/worst areas for each school
  const areas = data.diagnosisComparison.area_comparison;
  const school1Best = areas.reduce((best, curr) => curr.school_1_score > best.school_1_score ? curr : best);
  const school1Worst = areas.reduce((worst, curr) => curr.school_1_score < worst.school_1_score ? curr : worst);
  const school2Best = areas.reduce((best, curr) => curr.school_2_score > best.school_2_score ? curr : best);
  const school2Worst = areas.reduce((worst, curr) => curr.school_2_score < worst.school_2_score ? curr : worst);

  // School 1 analysis
  addText(`${school1Name.slice(0, 25)}:`, margin, y, { fontSize: 11, fontStyle: 'bold', color: XTRI_BLUE });
  y += 6;
  addText(`- Ponto forte: ${school1Best.area_name} (${school1Best.school_1_score.toFixed(1)} pts)`, margin + 5, y, { fontSize: 10, color: [55, 65, 81] });
  y += 5;
  addText(`- Oportunidade: ${school1Worst.area_name} (${school1Worst.school_1_score.toFixed(1)} pts)`, margin + 5, y, { fontSize: 10, color: [55, 65, 81] });
  y += 10;

  // School 2 analysis
  addText(`${school2Name.slice(0, 25)}:`, margin, y, { fontSize: 11, fontStyle: 'bold', color: XTRI_GREEN });
  y += 6;
  addText(`- Ponto forte: ${school2Best.area_name} (${school2Best.school_2_score.toFixed(1)} pts)`, margin + 5, y, { fontSize: 10, color: [55, 65, 81] });
  y += 5;
  addText(`- Oportunidade: ${school2Worst.area_name} (${school2Worst.school_2_score.toFixed(1)} pts)`, margin + 5, y, { fontSize: 10, color: [55, 65, 81] });
  y += 15;

  // === RECOMMENDATIONS ===
  addText('Recomendacoes Estrategicas', margin, y, {
    fontSize: 14,
    fontStyle: 'bold',
    color: [31, 41, 55],
  });
  y += 8;
  addLine(y);
  y += 10;

  const weakestArea = score1 < score2 ? school1Worst.area_name : school2Worst.area_name;
  const recommendations = [
    `Focar reforco em ${weakestArea} para reduzir gap`,
    'Implementar metodologias ativas nas areas de menor desempenho',
    'Promover intercambio de boas praticas entre equipes pedagogicas',
    'Acompanhar indicadores mensalmente com metas incrementais',
  ];

  recommendations.forEach((rec, idx) => {
    addText(`${idx + 1}. ${rec}`, margin, y, {
      fontSize: 10,
      color: [55, 65, 81],
      maxWidth: pageWidth - margin * 2,
    });
    y += 7;
  });

  // === FOOTER ===
  y = pageHeight - 25;
  addLine(y, [209, 213, 219]);
  y += 8;

  addText('Gerado por X-TRI Analytics', pageWidth / 2, y, {
    fontSize: 9,
    color: [156, 163, 175],
    align: 'center',
  });
  addText('www.xtriescolas.app', pageWidth / 2, y + 5, {
    fontSize: 9,
    color: XTRI_PURPLE,
    align: 'center',
  });
  addText(data.generatedAt.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }), pageWidth / 2, y + 10, {
    fontSize: 8,
    color: [156, 163, 175],
    align: 'center',
  });

  // Save
  const filename = `XTRI_Comparativo_${data.school1.nome_escola.slice(0, 15).replace(/\s/g, '_')}_vs_${data.school2.nome_escola.slice(0, 15).replace(/\s/g, '_')}.pdf`;
  doc.save(filename);
}

export default generateExecutiveReport;
