'use client';

import { useMemo, useState } from 'react';
import { Brain, ZoomIn, ZoomOut, Maximize2, Play, Pause } from 'lucide-react';

type AreaCode = 'CN' | 'CH' | 'LC' | 'MT';
type NodeType = 'conceito' | 'campo_semantico' | 'campo_lexical';

interface SemanticNode {
  id: string;
  label: string;
  area: AreaCode;
  type: NodeType;
  count: number;
  connections?: string[];
}

interface SemanticEdge {
  source: string;
  target: string;
  weight: number;
  isInterdisciplinary: boolean;
}

interface PositionedNode extends SemanticNode {
  x: number;
  y: number;
  color: string;
  areaName: string;
}

interface Props {
  nodes?: SemanticNode[];
  edges?: SemanticEdge[];
}

const AREA_CONFIG: Record<AreaCode, { color: string; name: string; angle: number }> = {
  CN: { color: '#22c55e', name: 'Ciências da Natureza', angle: Math.PI * 0.75 },
  CH: { color: '#eab308', name: 'Ciências Humanas', angle: Math.PI * 0.25 },
  LC: { color: '#ef4444', name: 'Linguagens', angle: Math.PI * 1.25 },
  MT: { color: '#3b82f6', name: 'Matemática', angle: Math.PI * 1.75 },
};

const SAMPLE_NODES: SemanticNode[] = [
  { id: 'cn1', label: 'Fisiologia', area: 'CN', type: 'campo_semantico', count: 45, connections: ['ch3', 'lc2'] },
  { id: 'cn2', label: 'Eletromagnetismo', area: 'CN', type: 'conceito', count: 38, connections: ['mt1', 'mt3'] },
  { id: 'cn3', label: 'Biologia/Ecologia', area: 'CN', type: 'campo_semantico', count: 52, connections: ['ch2'] },
  { id: 'cn4', label: 'Termologia', area: 'CN', type: 'conceito', count: 28, connections: ['mt2'] },
  { id: 'cn5', label: 'Física/Tecnologia', area: 'CN', type: 'campo_lexical', count: 35, connections: ['mt1'] },
  { id: 'cn6', label: 'Meio Ambiente', area: 'CN', type: 'campo_semantico', count: 48, connections: ['ch1', 'ch2'] },
  { id: 'cn7', label: 'Compostos Orgânicos', area: 'CN', type: 'conceito', count: 22 },
  { id: 'cn8', label: 'Relações Ecológicas', area: 'CN', type: 'conceito', count: 31, connections: ['ch2'] },
  { id: 'ch1', label: 'Geografia Física', area: 'CH', type: 'campo_semantico', count: 42, connections: ['cn6'] },
  { id: 'ch2', label: 'Filosofia Política', area: 'CH', type: 'campo_semantico', count: 38, connections: ['lc1'] },
  { id: 'ch3', label: 'História da Vida Privada', area: 'CH', type: 'conceito', count: 29, connections: ['lc3'] },
  { id: 'ch4', label: 'Globalização', area: 'CH', type: 'conceito', count: 51, connections: ['mt4', 'lc1'] },
  { id: 'ch5', label: 'Movimentos Sociais', area: 'CH', type: 'campo_lexical', count: 33, connections: ['lc2'] },
  { id: 'lc1', label: 'Variação Linguística', area: 'LC', type: 'campo_semantico', count: 55, connections: ['ch5'] },
  { id: 'lc2', label: 'Gêneros Textuais', area: 'LC', type: 'campo_semantico', count: 62 },
  { id: 'lc3', label: 'Figuras de Linguagem', area: 'LC', type: 'conceito', count: 41 },
  { id: 'lc4', label: 'Funções da Linguagem', area: 'LC', type: 'conceito', count: 38, connections: ['ch2'] },
  { id: 'mt1', label: 'Geometria Espacial', area: 'MT', type: 'campo_semantico', count: 47 },
  { id: 'mt2', label: 'Probabilidade', area: 'MT', type: 'conceito', count: 53, connections: ['cn4'] },
  { id: 'mt3', label: 'Análise de Gráficos', area: 'MT', type: 'campo_semantico', count: 58, connections: ['cn2', 'ch6'] },
  { id: 'mt4', label: 'Progressão Aritmética', area: 'MT', type: 'conceito', count: 34 },
];

function generateEdges(nodes: SemanticNode[]): SemanticEdge[] {
  const edges: SemanticEdge[] = [];
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));

  nodes.forEach((node) => {
    node.connections?.forEach((targetId) => {
      const target = nodeMap.get(targetId);
      if (!target || node.area === target.area) return;

      const exists = edges.some(
        (edge) =>
          (edge.source === node.id && edge.target === targetId) ||
          (edge.source === targetId && edge.target === node.id)
      );
      if (!exists) {
        edges.push({
          source: node.id,
          target: targetId,
          weight: Math.min(node.count, target.count) / 10,
          isInterdisciplinary: true,
        });
      }
    });
  });

  return edges;
}

function getNodeRadius(node: SemanticNode): number {
  return Math.max(8, Math.min(20, 7 + node.count / 7));
}

function getTypeColor(node: PositionedNode): string {
  if (node.type === 'campo_semantico') return node.color;
  if (node.type === 'campo_lexical') return '#10b981';
  return '#6366f1';
}

function truncateLabel(label: string): string {
  return label.length > 18 ? `${label.slice(0, 18)}...` : label;
}

export function SemanticNeuralNetwork({ nodes = SAMPLE_NODES, edges }: Props) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isAnimating, setIsAnimating] = useState(true);
  const [scale, setScale] = useState(1);
  const computedEdges = edges || generateEdges(nodes);

  const { positionedNodes, positionedEdges } = useMemo(() => {
    const width = 1000;
    const height = 700;
    const centerX = width / 2;
    const centerY = height / 2;

    const byArea = nodes.reduce<Record<AreaCode, SemanticNode[]>>(
      (acc, node) => {
        acc[node.area].push(node);
        return acc;
      },
      { CN: [], CH: [], LC: [], MT: [] }
    );

    const laidOut = nodes.map((node) => {
      const areaConfig = AREA_CONFIG[node.area];
      const areaNodes = byArea[node.area];
      const indexInArea = Math.max(0, areaNodes.findIndex((item) => item.id === node.id));
      const totalInArea = Math.max(1, areaNodes.length);
      const spreadAngle = Math.PI / 3;
      const nodeAngle = areaConfig.angle + (indexInArea / totalInArea - 0.5) * spreadAngle;
      const radius = 150 + (indexInArea % 3) * 50;

      return {
        ...node,
        x: centerX + Math.cos(nodeAngle) * radius,
        y: centerY + Math.sin(nodeAngle) * radius,
        color: areaConfig.color,
        areaName: areaConfig.name,
      };
    });

    const nodeMap = new Map(laidOut.map((node) => [node.id, node]));
    const linked = computedEdges.flatMap((edge) => {
      const sourceNode = nodeMap.get(edge.source);
      const targetNode = nodeMap.get(edge.target);
      if (!sourceNode || !targetNode) return [];
      return [{ ...edge, sourceNode, targetNode }];
    });

    return { positionedNodes: laidOut, positionedEdges: linked };
  }, [computedEdges, nodes]);

  const selectedNode = selectedNodeId
    ? positionedNodes.find((node) => node.id === selectedNodeId)
    : null;
  const connectedNodeIds = new Set(selectedNode?.connections || []);

  const handleZoom = (delta: number) => {
    setScale((current) => Math.min(2.2, Math.max(0.6, Number((current + delta).toFixed(2)))));
  };

  const resetView = () => {
    setSelectedNodeId(null);
    setScale(1);
  };

  return (
    <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 rounded-2xl overflow-hidden shadow-2xl">
      <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 bg-purple-500 rounded-xl blur-lg opacity-50" />
            <div className="relative p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl">
              <Brain className="h-5 w-5 text-white" />
            </div>
          </div>
          <div>
            <h3 className="font-semibold text-white">Rede Neural de Conhecimento</h3>
            <p className="text-xs text-slate-400">
              Visualização interativa • {nodes.length} nós • {computedEdges.length} conexões
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAnimating((current) => !current)}
            className={`p-2 rounded-lg transition-colors ${
              isAnimating ? 'bg-amber-500/20 text-amber-400' : 'bg-white/10 text-slate-400'
            }`}
            title={isAnimating ? 'Pausar animação' : 'Iniciar animação'}
          >
            {isAnimating ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          <div className="flex items-center gap-1 bg-white/10 rounded-lg p-1">
            <button onClick={() => handleZoom(-0.15)} className="p-1.5 rounded hover:bg-white/10 transition-colors text-white" title="Diminuir zoom">
              <ZoomOut className="w-4 h-4" />
            </button>
            <button onClick={() => handleZoom(0.15)} className="p-1.5 rounded hover:bg-white/10 transition-colors text-white" title="Aumentar zoom">
              <ZoomIn className="w-4 h-4" />
            </button>
            <button onClick={resetView} className="p-1.5 rounded hover:bg-white/10 transition-colors text-white" title="Resetar visão">
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="relative h-[700px]">
        <svg viewBox="0 0 1000 700" className="h-full w-full bg-transparent" role="img" aria-label="Rede semântica de conhecimento">
          <defs>
            <filter id="semantic-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <g transform={`translate(500 350) scale(${scale}) translate(-500 -350)`}>
            {Object.entries(AREA_CONFIG).map(([area, config]) => (
              <g key={area}>
                <circle
                  cx={500 + Math.cos(config.angle) * 180}
                  cy={350 + Math.sin(config.angle) * 180}
                  r={180}
                  fill={config.color}
                  opacity={0.08}
                  stroke={config.color}
                  strokeWidth={1}
                  strokeOpacity={0.2}
                  strokeDasharray="5,5"
                />
                <text
                  x={500 + Math.cos(config.angle) * 280}
                  y={350 + Math.sin(config.angle) * 280}
                  textAnchor="middle"
                  fill={config.color}
                  fontSize="12"
                  fontWeight="700"
                  opacity={0.7}
                >
                  {config.name}
                </text>
              </g>
            ))}

            {positionedEdges.map((edge) => {
              const selected = selectedNodeId && (edge.source === selectedNodeId || edge.target === selectedNodeId);
              const midX = (edge.sourceNode.x + edge.targetNode.x) / 2;
              const midY = (edge.sourceNode.y + edge.targetNode.y) / 2 - 30;
              return (
                <path
                  key={`${edge.source}-${edge.target}`}
                  d={`M${edge.sourceNode.x},${edge.sourceNode.y} Q${midX},${midY} ${edge.targetNode.x},${edge.targetNode.y}`}
                  fill="none"
                  stroke="#fbbf24"
                  strokeWidth={selected ? 3 : edge.isInterdisciplinary ? 2 : 1}
                  strokeOpacity={selected ? 0.85 : 0.18}
                  strokeDasharray="8,4"
                />
              );
            })}

            {positionedNodes.map((node) => {
              const selected = selectedNodeId === node.id;
              const dimmed = selectedNodeId && !selected && !connectedNodeIds.has(node.id);
              const radius = getNodeRadius(node);
              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x},${node.y})`}
                  opacity={dimmed ? 0.25 : 1}
                  className="cursor-pointer"
                  onClick={() => setSelectedNodeId((current) => (current === node.id ? null : node.id))}
                >
                  <circle r={radius + 4} fill={node.color} opacity={selected ? 0.45 : 0.25} filter="url(#semantic-glow)" />
                  <circle r={radius} fill={getTypeColor(node)} stroke={node.color} strokeWidth={selected ? 3 : 2} />
                  <text
                    y={-(radius + 8)}
                    textAnchor="middle"
                    fill="white"
                    fontSize="10"
                    fontWeight="500"
                    opacity={0.9}
                    style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}
                  >
                    {truncateLabel(node.label)}
                  </text>
                  <title>{`${node.label} • ${node.areaName} • frequência ${node.count}`}</title>
                </g>
              );
            })}
          </g>
        </svg>

        <div className="absolute bottom-4 left-4 bg-black/40 backdrop-blur-sm rounded-xl p-4">
          <div className="text-xs text-slate-400 mb-2">Legenda</div>
          <div className="space-y-2">
            {Object.entries(AREA_CONFIG).map(([area, config]) => (
              <div key={area} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: config.color }} />
                <span className="text-xs text-slate-300">{config.name}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-white/10 mt-3 pt-3 space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-6 h-0.5 bg-amber-400" style={{ backgroundImage: 'repeating-linear-gradient(90deg, #fbbf24 0, #fbbf24 4px, transparent 4px, transparent 8px)' }} />
              <span className="text-xs text-amber-400">Conexão Interdisciplinar</span>
            </div>
          </div>
        </div>

        {selectedNode && (
          <div className="absolute bottom-4 right-4 max-w-xs bg-black/50 backdrop-blur-sm rounded-lg px-3 py-2 text-xs text-slate-300">
            <div className="font-semibold text-white">{selectedNode.label}</div>
            <div className="mt-1 text-slate-400">{selectedNode.areaName} • frequência {selectedNode.count}</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default SemanticNeuralNetwork;
