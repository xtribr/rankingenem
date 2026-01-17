'use client';

import { jsPDF } from 'jspdf';
import { DiagnosisComparisonResult, SchoolHistory } from '@/lib/api';

interface SchoolData {
  codigo_inep: string;
  nome_escola: string;
  nota_media: number | null;
  ranking: number | null;
  uf?: string;
  tipo_escola?: string | null;
}

interface ComparisonYear {
  ano: number;
  escola1: { nota_media: number | null; ranking: number | null } | null;
  escola2: { nota_media: number | null; ranking: number | null } | null;
}

export interface ReportData {
  school1: SchoolData;
  school2: SchoolData;
  diagnosisComparison: DiagnosisComparisonResult;
  history1?: SchoolHistory;
  history2?: SchoolHistory;
  comparison?: {
    escola1: { codigo_inep: string; nome_escola: string; uf: string | null };
    escola2: { codigo_inep: string; nome_escola: string; uf: string | null };
    common_years: number[];
    comparison: ComparisonYear[];
  };
  generatedAt: Date;
}

// Brand colors
const XTRI_PURPLE = [147, 51, 234] as const;
const XTRI_BLUE = [59, 130, 246] as const;
const XTRI_GREEN = [34, 197, 94] as const;
const GRAY_900 = [17, 24, 39] as const;
const GRAY_700 = [55, 65, 81] as const;
const GRAY_500 = [107, 114, 128] as const;
const GRAY_400 = [156, 163, 175] as const;
const GRAY_200 = [229, 231, 235] as const;
const GRAY_100 = [243, 244, 246] as const;

export function generateExecutiveReport(data: ReportData): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;

  // Helper functions
  const setColor = (color: readonly number[]) => {
    doc.setTextColor(color[0], color[1], color[2]);
  };

  const setFill = (color: readonly number[]) => {
    doc.setFillColor(color[0], color[1], color[2]);
  };

  const setDraw = (color: readonly number[]) => {
    doc.setDrawColor(color[0], color[1], color[2]);
  };

  const addText = (text: string, x: number, y: number, opts?: {
    size?: number;
    bold?: boolean;
    color?: readonly number[];
    align?: 'left' | 'center' | 'right';
    maxWidth?: number;
  }) => {
    doc.setFontSize(opts?.size || 10);
    doc.setFont('helvetica', opts?.bold ? 'bold' : 'normal');
    setColor(opts?.color || GRAY_900);
    if (opts?.maxWidth) {
      const lines = doc.splitTextToSize(text, opts.maxWidth);
      doc.text(lines, x, y, { align: opts?.align || 'left' });
      return lines.length * (opts?.size || 10) * 0.4;
    }
    doc.text(text, x, y, { align: opts?.align || 'left' });
  };

  const addBox = (x: number, y: number, w: number, h: number, color: readonly number[]) => {
    setFill(color);
    doc.rect(x, y, w, h, 'F');
  };

  const addLine = (y: number, color: readonly number[] = GRAY_200) => {
    setDraw(color);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageWidth - margin, y);
  };

  const addPageFooter = (pageNum: number, totalPages: number) => {
    const footerY = pageHeight - 10;
    addLine(footerY - 5, GRAY_200);
    addText('X-TRI Escolas', margin, footerY, { size: 8, color: GRAY_400 });
    addText('www.xtriescolas.app', pageWidth / 2, footerY, { size: 8, color: XTRI_PURPLE, align: 'center' });
    addText(`Pagina ${pageNum}/${totalPages}`, pageWidth - margin, footerY, { size: 8, color: GRAY_400, align: 'right' });
  };

  // Calculate metrics
  const score1 = data.school1.nota_media || 0;
  const score2 = data.school2.nota_media || 0;
  const diff = Math.abs(score1 - score2);
  const winner = score1 >= score2 ? data.school1 : data.school2;
  const loser = score1 >= score2 ? data.school2 : data.school1;
  const areas = data.diagnosisComparison.area_comparison;

  // Calculate wins per school
  let school1Wins = 0;
  let school2Wins = 0;
  areas.forEach(area => {
    if (area.difference > 0) school1Wins++;
    else if (area.difference < 0) school2Wins++;
  });

  // Calculate trends
  const getTrend = (history?: SchoolHistory) => {
    if (!history?.history || history.history.length < 2) return null;
    const valid = history.history.filter(h => h.nota_media !== null);
    if (valid.length < 2) return null;
    return (valid[valid.length - 1].nota_media || 0) - (valid[0].nota_media || 0);
  };

  const trend1 = getTrend(data.history1);
  const trend2 = getTrend(data.history2);

  // ============================================
  // PAGE 1: EXECUTIVE SUMMARY
  // ============================================
  let y = margin;

  // Header bar
  addBox(0, 0, pageWidth, 40, [250, 245, 255]);
  addBox(0, 0, pageWidth, 3, XTRI_PURPLE);

  // Title
  addText('X-TRI', pageWidth / 2, 15, { size: 24, bold: true, color: XTRI_PURPLE, align: 'center' });
  addText('ESCOLAS', pageWidth / 2, 22, { size: 12, color: GRAY_500, align: 'center' });
  addText('Relatorio Executivo de Comparacao', pageWidth / 2, 30, { size: 10, color: GRAY_400, align: 'center' });
  addText(data.generatedAt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }), pageWidth / 2, 36, { size: 8, color: GRAY_400, align: 'center' });

  y = 50;

  // School comparison cards
  const cardWidth = (contentWidth - 10) / 2;
  const cardHeight = 45;

  // School 1 card
  addBox(margin, y, cardWidth, cardHeight, [239, 246, 255]);
  addText('ESCOLA 1', margin + 5, y + 8, { size: 8, bold: true, color: XTRI_BLUE });
  addText(data.school1.nome_escola.slice(0, 30), margin + 5, y + 16, { size: 10, bold: true, color: GRAY_900, maxWidth: cardWidth - 10 });
  addText(`${data.school1.uf || '-'} • ${data.school1.tipo_escola || '-'}`, margin + 5, y + 24, { size: 8, color: GRAY_500 });
  addText(`${score1.toFixed(1)}`, margin + 5, y + 38, { size: 20, bold: true, color: XTRI_BLUE });
  addText('pontos', margin + 35, y + 38, { size: 8, color: GRAY_500 });
  if (data.school1.ranking) {
    addText(`#${data.school1.ranking} Brasil`, margin + cardWidth - 30, y + 38, { size: 9, bold: true, color: GRAY_700 });
  }

  // VS badge
  addBox(pageWidth / 2 - 8, y + cardHeight / 2 - 6, 16, 12, XTRI_PURPLE);
  addText('VS', pageWidth / 2, y + cardHeight / 2 + 2, { size: 8, bold: true, color: [255, 255, 255], align: 'center' });

  // School 2 card
  const card2X = margin + cardWidth + 10;
  addBox(card2X, y, cardWidth, cardHeight, [240, 253, 244]);
  addText('ESCOLA 2', card2X + 5, y + 8, { size: 8, bold: true, color: XTRI_GREEN });
  addText(data.school2.nome_escola.slice(0, 30), card2X + 5, y + 16, { size: 10, bold: true, color: GRAY_900, maxWidth: cardWidth - 10 });
  addText(`${data.school2.uf || '-'} • ${data.school2.tipo_escola || '-'}`, card2X + 5, y + 24, { size: 8, color: GRAY_500 });
  addText(`${score2.toFixed(1)}`, card2X + 5, y + 38, { size: 20, bold: true, color: XTRI_GREEN });
  addText('pontos', card2X + 35, y + 38, { size: 8, color: GRAY_500 });
  if (data.school2.ranking) {
    addText(`#${data.school2.ranking} Brasil`, card2X + cardWidth - 30, y + 38, { size: 9, bold: true, color: GRAY_700 });
  }

  y += cardHeight + 15;

  // Winner announcement
  addBox(margin, y, contentWidth, 25, GRAY_100);
  const winnerColor = winner === data.school1 ? XTRI_BLUE : XTRI_GREEN;
  if (diff > 0) {
    addText('VENCEDOR DA COMPARACAO', pageWidth / 2, y + 8, { size: 8, bold: true, color: GRAY_500, align: 'center' });
    addText(winner.nome_escola.slice(0, 40), pageWidth / 2, y + 17, { size: 12, bold: true, color: winnerColor, align: 'center' });
    addText(`+${diff.toFixed(1)} pontos de vantagem`, pageWidth / 2, y + 23, { size: 9, color: GRAY_700, align: 'center' });
  } else {
    addText('EMPATE TECNICO', pageWidth / 2, y + 12, { size: 12, bold: true, color: GRAY_700, align: 'center' });
    addText('Ambas escolas com desempenho equivalente', pageWidth / 2, y + 20, { size: 9, color: GRAY_500, align: 'center' });
  }

  y += 35;

  // Key metrics row
  addText('METRICAS PRINCIPAIS', margin, y, { size: 10, bold: true, color: GRAY_900 });
  y += 8;

  const metricBoxWidth = (contentWidth - 15) / 4;
  const metrics = [
    { label: 'Diferenca', value: `${diff.toFixed(1)} pts`, color: XTRI_PURPLE },
    { label: 'Areas vencidas E1', value: `${school1Wins}/5`, color: XTRI_BLUE },
    { label: 'Areas vencidas E2', value: `${school2Wins}/5`, color: XTRI_GREEN },
    { label: 'Empates', value: `${5 - school1Wins - school2Wins}/5`, color: GRAY_500 },
  ];

  metrics.forEach((metric, i) => {
    const boxX = margin + i * (metricBoxWidth + 5);
    addBox(boxX, y, metricBoxWidth, 22, GRAY_100);
    addText(metric.label, boxX + metricBoxWidth / 2, y + 8, { size: 7, color: GRAY_500, align: 'center' });
    addText(metric.value, boxX + metricBoxWidth / 2, y + 17, { size: 12, bold: true, color: metric.color, align: 'center' });
  });

  y += 32;

  // Executive summary text
  addText('RESUMO EXECUTIVO', margin, y, { size: 10, bold: true, color: GRAY_900 });
  y += 6;
  addLine(y);
  y += 8;

  const summaryPoints = [
    diff > 0
      ? `${winner.nome_escola.slice(0, 25)} apresenta desempenho superior com ${diff.toFixed(1)} pontos de vantagem na media geral.`
      : `As escolas apresentam desempenho equivalente na media geral.`,
    `${data.school1.nome_escola.slice(0, 20)} vence em ${school1Wins} de 5 areas do conhecimento.`,
    `${data.school2.nome_escola.slice(0, 20)} vence em ${school2Wins} de 5 areas do conhecimento.`,
  ];

  if (data.school1.ranking && data.school2.ranking) {
    const rankDiff = Math.abs(data.school1.ranking - data.school2.ranking);
    summaryPoints.push(`Diferenca de ${rankDiff} posicoes no ranking nacional.`);
  }

  if (trend1 !== null || trend2 !== null) {
    if (trend1 !== null && trend1 > 0) {
      summaryPoints.push(`${data.school1.nome_escola.slice(0, 20)} apresenta tendencia de crescimento (+${trend1.toFixed(1)} pts).`);
    }
    if (trend2 !== null && trend2 > 0) {
      summaryPoints.push(`${data.school2.nome_escola.slice(0, 20)} apresenta tendencia de crescimento (+${trend2.toFixed(1)} pts).`);
    }
  }

  summaryPoints.forEach(point => {
    addText(`• ${point}`, margin + 3, y, { size: 9, color: GRAY_700, maxWidth: contentWidth - 6 });
    y += 7;
  });

  y += 10;

  // Performance table
  addText('DESEMPENHO POR AREA DO CONHECIMENTO', margin, y, { size: 10, bold: true, color: GRAY_900 });
  y += 6;
  addLine(y);
  y += 6;

  // Table header
  const colWidths = [45, 30, 30, 35, 30];
  addBox(margin, y, contentWidth, 8, GRAY_100);
  addText('Area', margin + 3, y + 5.5, { size: 8, bold: true, color: GRAY_700 });
  addText('E1', margin + colWidths[0] + 10, y + 5.5, { size: 8, bold: true, color: XTRI_BLUE });
  addText('E2', margin + colWidths[0] + colWidths[1] + 10, y + 5.5, { size: 8, bold: true, color: XTRI_GREEN });
  addText('Diferenca', margin + colWidths[0] + colWidths[1] + colWidths[2] + 5, y + 5.5, { size: 8, bold: true, color: GRAY_700 });
  addText('Vencedor', margin + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + 5, y + 5.5, { size: 8, bold: true, color: GRAY_700 });
  y += 10;

  // Table rows
  areas.forEach((area, idx) => {
    if (idx % 2 === 0) addBox(margin, y - 1, contentWidth, 8, [249, 250, 251]);

    addText(area.area_name, margin + 3, y + 4, { size: 9, color: GRAY_900 });
    addText(area.school_1_score.toFixed(1), margin + colWidths[0] + 10, y + 4, { size: 9, bold: true, color: XTRI_BLUE });
    addText(area.school_2_score.toFixed(1), margin + colWidths[0] + colWidths[1] + 10, y + 4, { size: 9, bold: true, color: XTRI_GREEN });

    const diffValue = area.difference;
    const diffColor = diffValue > 0 ? XTRI_BLUE : diffValue < 0 ? XTRI_GREEN : GRAY_500;
    const diffText = diffValue > 0 ? `+${diffValue.toFixed(1)}` : diffValue.toFixed(1);
    addText(diffText, margin + colWidths[0] + colWidths[1] + colWidths[2] + 10, y + 4, { size: 9, bold: true, color: diffColor });

    const winnerName = diffValue > 0 ? 'E1' : diffValue < 0 ? 'E2' : 'Empate';
    addText(winnerName, margin + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + 10, y + 4, { size: 9, color: diffColor });

    y += 8;
  });

  addPageFooter(1, 2);

  // ============================================
  // PAGE 2: DETAILED ANALYSIS & RECOMMENDATIONS
  // ============================================
  doc.addPage();
  y = margin;

  // Header
  addBox(0, 0, pageWidth, 20, GRAY_100);
  addText('X-TRI ESCOLAS', margin, 13, { size: 10, bold: true, color: XTRI_PURPLE });
  addText('Analise Detalhada e Recomendacoes', pageWidth - margin, 13, { size: 10, color: GRAY_500, align: 'right' });

  y = 30;

  // Historical trend section
  if (data.comparison?.comparison && data.comparison.comparison.length > 0) {
    addText('EVOLUCAO HISTORICA', margin, y, { size: 10, bold: true, color: GRAY_900 });
    y += 6;
    addLine(y);
    y += 6;

    // Table header
    addBox(margin, y, contentWidth, 8, GRAY_100);
    addText('Ano', margin + 5, y + 5.5, { size: 8, bold: true, color: GRAY_700 });
    addText('E1 - Media', margin + 35, y + 5.5, { size: 8, bold: true, color: XTRI_BLUE });
    addText('E1 - Ranking', margin + 65, y + 5.5, { size: 8, bold: true, color: XTRI_BLUE });
    addText('E2 - Media', margin + 100, y + 5.5, { size: 8, bold: true, color: XTRI_GREEN });
    addText('E2 - Ranking', margin + 130, y + 5.5, { size: 8, bold: true, color: XTRI_GREEN });
    y += 10;

    // Show last 5 years
    const recentYears = data.comparison.comparison.slice(-5);
    recentYears.forEach((yearData, idx) => {
      if (idx % 2 === 0) addBox(margin, y - 1, contentWidth, 7, [249, 250, 251]);

      addText(yearData.ano.toString(), margin + 5, y + 3.5, { size: 8, color: GRAY_900 });
      addText(yearData.escola1?.nota_media?.toFixed(1) || '-', margin + 40, y + 3.5, { size: 8, color: GRAY_700 });
      addText(yearData.escola1?.ranking ? `#${yearData.escola1.ranking}` : '-', margin + 70, y + 3.5, { size: 8, color: GRAY_700 });
      addText(yearData.escola2?.nota_media?.toFixed(1) || '-', margin + 105, y + 3.5, { size: 8, color: GRAY_700 });
      addText(yearData.escola2?.ranking ? `#${yearData.escola2.ranking}` : '-', margin + 135, y + 3.5, { size: 8, color: GRAY_700 });
      y += 7;
    });

    y += 10;
  }

  // Strengths & Weaknesses
  addText('PONTOS FORTES E OPORTUNIDADES', margin, y, { size: 10, bold: true, color: GRAY_900 });
  y += 6;
  addLine(y);
  y += 8;

  const school1Best = areas.reduce((best, curr) => curr.school_1_score > best.school_1_score ? curr : best);
  const school1Worst = areas.reduce((worst, curr) => curr.school_1_score < worst.school_1_score ? curr : worst);
  const school2Best = areas.reduce((best, curr) => curr.school_2_score > best.school_2_score ? curr : best);
  const school2Worst = areas.reduce((worst, curr) => curr.school_2_score < worst.school_2_score ? curr : worst);

  // School 1 analysis
  addBox(margin, y, contentWidth / 2 - 3, 35, [239, 246, 255]);
  addText(data.school1.nome_escola.slice(0, 25), margin + 5, y + 8, { size: 9, bold: true, color: XTRI_BLUE });
  addText(`Ponto Forte: ${school1Best.area_name}`, margin + 5, y + 17, { size: 8, color: GRAY_700 });
  addText(`(${school1Best.school_1_score.toFixed(1)} pts)`, margin + 5, y + 23, { size: 8, bold: true, color: XTRI_GREEN });
  addText(`Oportunidade: ${school1Worst.area_name}`, margin + 5, y + 30, { size: 8, color: GRAY_700 });

  // School 2 analysis
  const s2BoxX = margin + contentWidth / 2 + 3;
  addBox(s2BoxX, y, contentWidth / 2 - 3, 35, [240, 253, 244]);
  addText(data.school2.nome_escola.slice(0, 25), s2BoxX + 5, y + 8, { size: 9, bold: true, color: XTRI_GREEN });
  addText(`Ponto Forte: ${school2Best.area_name}`, s2BoxX + 5, y + 17, { size: 8, color: GRAY_700 });
  addText(`(${school2Best.school_2_score.toFixed(1)} pts)`, s2BoxX + 5, y + 23, { size: 8, bold: true, color: XTRI_GREEN });
  addText(`Oportunidade: ${school2Worst.area_name}`, s2BoxX + 5, y + 30, { size: 8, color: GRAY_700 });

  y += 45;

  // Strategic Recommendations
  addText('RECOMENDACOES ESTRATEGICAS', margin, y, { size: 10, bold: true, color: GRAY_900 });
  y += 6;
  addLine(y);
  y += 8;

  const recommendations = [
    {
      title: 'Foco nas Areas Criticas',
      desc: `Priorizar reforco em ${loser === data.school1 ? school1Worst.area_name : school2Worst.area_name} para reduzir o gap de desempenho.`,
    },
    {
      title: 'Benchmarking de Melhores Praticas',
      desc: `Estudar metodologias da escola com melhor desempenho em ${winner === data.school1 ? school1Best.area_name : school2Best.area_name}.`,
    },
    {
      title: 'Monitoramento Continuo',
      desc: 'Implementar avaliacoes diagnosticas mensais para acompanhar evolucao e ajustar estrategias.',
    },
    {
      title: 'Capacitacao Docente',
      desc: 'Promover formacao continuada focada nas areas identificadas como oportunidades de melhoria.',
    },
    {
      title: 'Engajamento dos Alunos',
      desc: 'Desenvolver projetos interdisciplinares que conectem as areas de melhor desempenho com as que precisam de reforco.',
    },
  ];

  recommendations.forEach((rec, idx) => {
    addBox(margin, y, contentWidth, 18, idx % 2 === 0 ? GRAY_100 : [255, 255, 255]);
    addText(`${idx + 1}. ${rec.title}`, margin + 5, y + 6, { size: 9, bold: true, color: XTRI_PURPLE });
    addText(rec.desc, margin + 5, y + 13, { size: 8, color: GRAY_700, maxWidth: contentWidth - 10 });
    y += 20;
  });

  y += 10;

  // Action items
  addText('PROXIMOS PASSOS', margin, y, { size: 10, bold: true, color: GRAY_900 });
  y += 6;
  addLine(y);
  y += 8;

  const actions = [
    'Compartilhar este relatorio com a equipe pedagogica',
    'Agendar reuniao de planejamento estrategico',
    'Definir metas de melhoria por area do conhecimento',
    'Estabelecer cronograma de acompanhamento mensal',
    'Identificar recursos necessarios para implementacao',
  ];

  actions.forEach((action, idx) => {
    addBox(margin, y, 5, 5, XTRI_PURPLE);
    addText(action, margin + 8, y + 4, { size: 9, color: GRAY_700 });
    y += 8;
  });

  // Final note
  y += 10;
  addBox(margin, y, contentWidth, 20, [250, 245, 255]);
  addText('Este relatorio foi gerado automaticamente pela plataforma X-TRI Escolas.', pageWidth / 2, y + 8, { size: 8, color: GRAY_500, align: 'center' });
  addText('Para analises mais detalhadas, acesse www.xtriescolas.app', pageWidth / 2, y + 14, { size: 8, color: XTRI_PURPLE, align: 'center' });

  addPageFooter(2, 2);

  // Save
  const filename = `XTRI_Relatorio_Executivo_${data.school1.nome_escola.slice(0, 12).replace(/\s/g, '_')}_vs_${data.school2.nome_escola.slice(0, 12).replace(/\s/g, '_')}.pdf`;
  doc.save(filename);
}

export default generateExecutiveReport;
