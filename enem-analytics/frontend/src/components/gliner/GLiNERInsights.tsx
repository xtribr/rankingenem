'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  Brain,
  Sparkles,
  TrendingUp,
  BookOpen,
  Target,
  Zap,
  ChevronRight,
  Info,
  Network,
  Lightbulb,
  ArrowUpRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Filter,
  Layers,
  Check,
} from 'lucide-react';

interface BrainXInsightsProps {
  codigoInep: string;
}

export function BrainXInsights({ codigoInep }: BrainXInsightsProps) {
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'concepts' | 'study' | 'network'>('concepts');

  const { data: conceptAnalysis, isLoading: conceptsLoading } = useQuery({
    queryKey: ['glinerConcepts', codigoInep],
    queryFn: () => api.getGlinerConceptAnalysis(codigoInep, 15),
  });

  const { data: studyFocus, isLoading: studyLoading } = useQuery({
    queryKey: ['glinerStudyFocus', codigoInep],
    queryFn: () => api.getGlinerStudyFocus(codigoInep),
  });

  const isLoading = conceptsLoading || studyLoading;

  if (isLoading) {
    return (
      <div className="bg-gradient-to-br from-purple-50 via-indigo-50 to-blue-50 rounded-2xl p-6 border border-purple-100">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 animate-pulse">
            <Brain className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="h-5 w-40 bg-purple-200 rounded animate-pulse" />
            <div className="h-3 w-60 bg-purple-100 rounded mt-1 animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-40 bg-white/50 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const areaData = selectedArea
    ? conceptAnalysis?.area_analyses.find((a) => a.area === selectedArea)
    : null;

  return (
    <div className="bg-gradient-to-br from-purple-50 via-indigo-50 to-blue-50 rounded-2xl shadow-sm border border-purple-100 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-purple-100/50 bg-white/60 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600">
              <Brain className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-gray-900">Inteligência BrainX</h2>
                <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full font-medium flex items-center gap-1">
                  <Sparkles className="h-3 w-3" /> NER
                </span>
              </div>
              <p className="text-xs text-gray-500">
                {conceptAnalysis?.summary.total_unique_concepts} conceitos |{' '}
                {conceptAnalysis?.summary.total_semantic_fields} campos semânticos |{' '}
                {conceptAnalysis?.summary.total_lexical_fields} campos lexicais
              </p>
            </div>
          </div>

          {/* Tab Buttons */}
          <div className="flex items-center gap-1 bg-white/80 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('concepts')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                activeTab === 'concepts'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Conceitos
            </button>
            <button
              onClick={() => setActiveTab('study')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                activeTab === 'study'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Foco de Estudo
            </button>
            <button
              onClick={() => setActiveTab('network')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                activeTab === 'network'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Rede
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        {activeTab === 'concepts' && (
          <ConceptsTab
            conceptAnalysis={conceptAnalysis}
            selectedArea={selectedArea}
            setSelectedArea={setSelectedArea}
            areaData={areaData}
          />
        )}

        {activeTab === 'study' && studyFocus && (
          <StudyFocusTab studyFocus={studyFocus} />
        )}

        {activeTab === 'network' && (
          <NetworkTab codigoInep={codigoInep} conceptAnalysis={conceptAnalysis} />
        )}
      </div>
    </div>
  );
}

// Concepts Tab Component
function ConceptsTab({
  conceptAnalysis,
  selectedArea,
  setSelectedArea,
  areaData,
}: {
  conceptAnalysis: Awaited<ReturnType<typeof api.getGlinerConceptAnalysis>> | undefined;
  selectedArea: string | null;
  setSelectedArea: (area: string | null) => void;
  areaData: Awaited<ReturnType<typeof api.getGlinerConceptAnalysis>>['area_analyses'][0] | null | undefined;
}) {
  if (!conceptAnalysis) return null;

  return (
    <div className="space-y-5">
      {/* Area Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {conceptAnalysis.area_analyses.map((area) => {
          const isSelected = selectedArea === area.area;
          return (
            <button
              key={area.area}
              onClick={() => setSelectedArea(isSelected ? null : area.area)}
              className={`text-left p-4 rounded-xl border transition-all ${
                isSelected
                  ? 'bg-white shadow-md border-purple-300 ring-2 ring-purple-200'
                  : 'bg-white/70 border-gray-100 hover:bg-white hover:shadow-sm'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div
                  className="h-8 w-8 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                  style={{ backgroundColor: area.color }}
                >
                  {area.area}
                </div>
                <span className="text-lg font-bold" style={{ color: area.color }}>
                  {area.predicted_score}
                </span>
              </div>
              <h4 className="text-sm font-medium text-gray-900 mb-1">{area.area_name}</h4>
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <Lightbulb className="h-3 w-3" />
                  {area.unique_concepts}
                </span>
                <span className="flex items-center gap-1">
                  <BookOpen className="h-3 w-3" />
                  {area.unique_semantic_fields}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected Area Details */}
      {areaData && (
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div
              className="h-10 w-10 rounded-xl flex items-center justify-center text-white font-bold"
              style={{ backgroundColor: areaData.color }}
            >
              {areaData.area}
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{areaData.area_name}</h3>
              <p className="text-xs text-gray-500">
                {areaData.total_content_items} itens de conteúdo analisados
              </p>
            </div>
          </div>

          {/* Top Concepts */}
          <div className="mb-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-amber-500" />
              Conceitos Prioritários
            </h4>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
              {areaData.top_concepts.slice(0, 9).map((concept, idx) => (
                <div
                  key={concept.concept}
                  className={`p-3 rounded-lg border transition-all ${
                    concept.importance === 'high'
                      ? 'bg-amber-50 border-amber-200'
                      : concept.importance === 'medium'
                      ? 'bg-blue-50 border-blue-200'
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between mb-1">
                    <span className="text-xs font-medium text-gray-900 line-clamp-1">
                      {concept.concept}
                    </span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                        concept.importance === 'high'
                          ? 'bg-amber-100 text-amber-700'
                          : concept.importance === 'medium'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {concept.frequency.toFixed(0)}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(concept.confidence * 100, 100)}%`,
                          backgroundColor: areaData.color,
                        }}
                      />
                    </div>
                    <span className="text-[10px] text-gray-500">
                      {(concept.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                  {(concept.semantic_fields?.length > 0 || concept.lexical_fields?.length > 0) && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {concept.semantic_fields?.slice(0, 2).map((field: string) => (
                        <span
                          key={field}
                          className="text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-600 rounded"
                        >
                          {field}
                        </span>
                      ))}
                      {concept.lexical_fields?.slice(0, 1).map((field: string) => (
                        <span
                          key={field}
                          className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-600 rounded"
                        >
                          {field}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Semantic Fields & Historical Contexts */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <Brain className="h-4 w-4 text-purple-500" />
                Campos Semânticos
              </h4>
              <div className="space-y-1">
                {areaData.semantic_fields?.slice(0, 5).map((field: { field: string; count: number }) => (
                  <div key={field.field} className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">{field.field}</span>
                    <span className="font-medium text-gray-900">{field.count}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <Target className="h-4 w-4 text-green-500" />
                Contextos Históricos
              </h4>
              <div className="space-y-1">
                {areaData.historical_contexts?.slice(0, 5).map((ctx: { context: string; count: number }) => (
                  <div key={ctx.context} className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">{ctx.context}</span>
                    <span className="font-medium text-gray-900">{ctx.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Priority Concepts Summary */}
      {!selectedArea && (
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            Conceitos Mais Relevantes (Todas as Áreas)
          </h3>
          <div className="flex flex-wrap gap-2">
            {conceptAnalysis.priority_concepts.slice(0, 20).map((concept, idx) => (
              <span
                key={concept.concept}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all hover:scale-105"
                style={{
                  backgroundColor:
                    conceptAnalysis.area_analyses.find((a) => a.area === concept.area)?.color +
                    '20',
                  color: conceptAnalysis.area_analyses.find((a) => a.area === concept.area)?.color,
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{
                    backgroundColor: conceptAnalysis.area_analyses.find(
                      (a) => a.area === concept.area
                    )?.color,
                  }}
                />
                {concept.concept}
                <span className="opacity-60">{concept.frequency.toFixed(0)}%</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Study Focus Tab Component
function StudyFocusTab({
  studyFocus,
}: {
  studyFocus: Awaited<ReturnType<typeof api.getGlinerStudyFocus>>;
}) {
  return (
    <div className="space-y-5">
      {/* Overall Improvement Banner */}
      <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl p-4 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm opacity-90">Itens TRI Cobertos</p>
            <p className="text-3xl font-bold">{studyFocus.total_estimated_improvement} itens</p>
          </div>
          <div className="text-right">
            <p className="text-sm opacity-90">Áreas em Foco</p>
            <p className="text-2xl font-bold">{studyFocus.focus_areas.length}</p>
          </div>
        </div>
      </div>

      {/* Study Plan Phases */}
      <div className="grid grid-cols-3 gap-3">
        {Object.entries(studyFocus.study_plan).map(([key, phase], idx) => (
          <div
            key={key}
            className={`p-4 rounded-xl border ${
              idx === 0
                ? 'bg-blue-50 border-blue-200'
                : idx === 1
                ? 'bg-purple-50 border-purple-200'
                : 'bg-amber-50 border-amber-200'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <div
                className={`h-6 w-6 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                  idx === 0 ? 'bg-blue-500' : idx === 1 ? 'bg-purple-500' : 'bg-amber-500'
                }`}
              >
                {idx + 1}
              </div>
              <span className="text-sm font-semibold text-gray-900">{phase.name}</span>
            </div>
            <p className="text-xs text-gray-600 mb-2">{phase.description}</p>
            <p className="text-lg font-bold text-gray-900">{phase.concepts_count} conceitos</p>
          </div>
        ))}
      </div>

      {/* Focus Areas Detail */}
      <div className="space-y-4">
        {studyFocus.focus_areas.map((area) => (
          <div key={area.area} className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div
                  className="h-10 w-10 rounded-xl flex items-center justify-center text-white font-bold"
                  style={{ backgroundColor: area.color }}
                >
                  {area.area}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{area.area_name}</h3>
                  <p className="text-xs text-gray-500">
                    Nível: <span className="font-medium capitalize">{area.level}</span> | Score:{' '}
                    {area.current_score}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Itens TRI</p>
                <p className="text-xl font-bold text-green-600">
                  {area.estimated_total_impact} itens
                </p>
              </div>
            </div>

            {/* Study Sequence */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-500 mb-2">
                Sequência de Estudo ({area.study_sequence.length} conceitos)
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {area.study_sequence.slice(0, 9).map((concept, idx) => (
                  <div
                    key={concept.concept}
                    className={`p-3 rounded-lg border ${
                      concept.priority === 'high'
                        ? 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200'
                        : concept.priority === 'medium'
                        ? 'bg-blue-50 border-blue-200'
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${
                            concept.priority === 'high'
                              ? 'bg-amber-500'
                              : concept.priority === 'medium'
                              ? 'bg-blue-500'
                              : 'bg-gray-400'
                          }`}
                        >
                          {idx + 1}
                        </span>
                        <span className="text-xs font-medium text-gray-900 line-clamp-1">
                          {concept.concept}
                        </span>
                      </div>
                      <span className="text-[10px] text-blue-600 font-medium">
                        {concept.estimated_impact}x
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-gray-500 ml-7">
                      <span>TRI: {concept.avg_difficulty}</span>
                      {concept.semantic_fields?.[0] && (
                        <span className="px-1.5 py-0.5 bg-purple-100 text-purple-600 rounded">
                          {concept.semantic_fields[0]}
                        </span>
                      )}
                      {concept.lexical_fields?.[0] && (
                        <span className="px-1.5 py-0.5 bg-green-100 text-green-600 rounded">
                          {concept.lexical_fields[0]}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Network Tab Component with Enhanced Neural Network Visualization
// Features: Entity filters, Flow animations, Zoom/Pan, Thematic clusters
function NetworkTab({
  codigoInep,
  conceptAnalysis,
}: {
  codigoInep: string;
  conceptAnalysis: Awaited<ReturnType<typeof api.getGlinerConceptAnalysis>> | undefined;
}) {
  const [networkArea, setNetworkArea] = useState<string | undefined>(undefined);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'all' | 'clusters'>('clusters');

  // Entity type filters (multi-select)
  const [entityFilters, setEntityFilters] = useState({
    conceito_cientifico: true,
    campo_semantico: true,
    campo_lexical: true,
  });
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  // Node limit and visibility controls
  const [maxNodes, setMaxNodes] = useState(60);
  const [showAllLabels, setShowAllLabels] = useState(false);
  const labelThreshold = 5; // Only show labels for nodes with count >= this

  // Area visibility toggles (for filtering individual areas)
  const [areaVisibility, setAreaVisibility] = useState({
    CN: true, CH: true, LC: true, MT: true
  });

  // Zoom and Pan state
  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Animation state
  const [animationEnabled, setAnimationEnabled] = useState(false);

  const { data: graphData, isLoading } = useQuery({
    queryKey: ['glinerGraph', codigoInep, networkArea],
    queryFn: () => api.getGlinerKnowledgeGraph(codigoInep, networkArea),
  });

  // Filter and sort nodes by relevance (count), then limit
  const filteredNodes = useMemo(() => {
    if (!graphData?.nodes) return [];

    // Filter by entity type and area visibility
    const filtered = graphData.nodes.filter(node => {
      const typeAllowed = entityFilters[node.type as keyof typeof entityFilters];
      const areaAllowed = !node.area || areaVisibility[node.area as keyof typeof areaVisibility];
      return typeAllowed && areaAllowed;
    });

    // Sort by count (relevance) descending
    const sorted = [...filtered].sort((a, b) => b.count - a.count);

    // Limit to maxNodes
    return sorted.slice(0, maxNodes);
  }, [graphData?.nodes, entityFilters, areaVisibility, maxNodes]);

  // Filter edges to only include those with visible nodes
  const filteredEdges = useMemo(() => {
    if (!graphData?.edges) return [];
    const nodeIds = new Set(filteredNodes.map(n => n.id));
    return graphData.edges.filter(edge => nodeIds.has(edge.source) && nodeIds.has(edge.target));
  }, [graphData?.edges, filteredNodes]);

  // Zoom to area function
  const zoomToArea = useCallback((area: string) => {
    const areaPositions: Record<string, { x: number; y: number }> = {
      CN: { x: 150, y: 100 },
      CH: { x: -150, y: 100 },
      LC: { x: 150, y: -100 },
      MT: { x: -150, y: -100 },
    };
    const pos = areaPositions[area];
    if (pos) {
      setTransform({ scale: 1.8, x: pos.x, y: pos.y });
    }
  }, []);

  // Toggle entity filter
  const toggleEntityFilter = (type: keyof typeof entityFilters) => {
    setEntityFilters(prev => ({ ...prev, [type]: !prev[type] }));
  };

  // Zoom handlers
  const handleZoom = useCallback((delta: number) => {
    setTransform(prev => ({
      ...prev,
      scale: Math.min(Math.max(prev.scale + delta, 0.5), 3),
    }));
  }, []);

  // Use effect to add wheel listener with passive: false
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheelEvent = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      handleZoom(delta);
    };

    container.addEventListener('wheel', handleWheelEvent, { passive: false });
    return () => container.removeEventListener('wheel', handleWheelEvent);
  }, [handleZoom]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click
    setIsDragging(true);
    setDragStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
  }, [transform.x, transform.y]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    setTransform(prev => ({
      ...prev,
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    }));
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const resetView = useCallback(() => {
    setTransform({ scale: 1, x: 0, y: 0 });
  }, []);

  // Area colors for clustering
  const areaColors: { [key: string]: { bg: string; border: string; label: string } } = {
    CN: { bg: 'rgba(34, 197, 94, 0.1)', border: 'rgba(34, 197, 94, 0.3)', label: 'Ciências da Natureza' },
    CH: { bg: 'rgba(234, 179, 8, 0.1)', border: 'rgba(234, 179, 8, 0.3)', label: 'Ciências Humanas' },
    LC: { bg: 'rgba(239, 68, 68, 0.1)', border: 'rgba(239, 68, 68, 0.3)', label: 'Linguagens' },
    MT: { bg: 'rgba(59, 130, 246, 0.1)', border: 'rgba(59, 130, 246, 0.3)', label: 'Matemática' },
  };

  // Enhanced node positioning with cluster support
  type GraphNode = {
    id: string;
    label: string;
    type: string;
    color: string;
    size: number;
    count: number;
    area?: string;
    area_name?: string;
    area_distribution?: { [key: string]: number };
    is_interdisciplinary?: boolean;
  };
  const calculatePositions = useCallback((nodes: GraphNode[]) => {
    if (!nodes || nodes.length === 0) return {};

    const positions: { [key: string]: { x: number; y: number; node: GraphNode; ring: number; emphasis: boolean; cluster?: string } } = {};
    const centerX = 50;
    const centerY = 50;

    if (viewMode === 'clusters') {
      // Word cloud style layout with CLEAR separation between quadrants
      // Increased margins between areas for better readability
      const areaRegions: { [key: string]: { xMin: number; xMax: number; yMin: number; yMax: number } } = {
        CN: { xMin: 2, xMax: 44, yMin: 2, yMax: 44 },      // Top-left (green)
        CH: { xMin: 56, xMax: 98, yMin: 2, yMax: 44 },     // Top-right (yellow)
        LC: { xMin: 2, xMax: 44, yMin: 56, yMax: 98 },     // Bottom-left (red)
        MT: { xMin: 56, xMax: 98, yMin: 56, yMax: 98 },    // Bottom-right (blue)
      };

      // Group nodes by area
      const nodesByArea: { [key: string]: GraphNode[] } = { CN: [], CH: [], LC: [], MT: [], other: [] };

      nodes.forEach(node => {
        const area = node.area || 'other';
        if (areaRegions[area]) {
          nodesByArea[area].push(node);
        } else {
          nodesByArea.other.push(node);
        }
      });

      // Word cloud distribution within each area
      Object.entries(nodesByArea).forEach(([area, areaNodes]) => {
        if (area === 'other' || areaNodes.length === 0) return;
        const region = areaRegions[area];
        const width = region.xMax - region.xMin;
        const height = region.yMax - region.yMin;

        // Sort by importance: semantic first, then by count
        const sortedNodes = [...areaNodes].sort((a, b) => {
          const typeOrder: Record<string, number> = { 'campo_semantico': 0, 'campo_lexical': 1, 'conceito_cientifico': 2 };
          const typeCompare = (typeOrder[a.type] || 2) - (typeOrder[b.type] || 2);
          if (typeCompare !== 0) return typeCompare;
          return b.count - a.count;
        });

        // Grid-based word cloud - fill area more evenly
        const cols = Math.ceil(Math.sqrt(sortedNodes.length * 1.5));
        const rows = Math.ceil(sortedNodes.length / cols);
        const cellWidth = width / cols;
        const cellHeight = height / rows;

        sortedNodes.forEach((node, i) => {
          const col = i % cols;
          const row = Math.floor(i / cols);

          // Base position in grid cell
          let x = region.xMin + (col + 0.5) * cellWidth;
          let y = region.yMin + (row + 0.5) * cellHeight;

          // Add organic jitter to avoid rigid grid look
          const jitterX = (Math.sin(i * 13 + col * 7) * cellWidth * 0.3);
          const jitterY = (Math.cos(i * 17 + row * 11) * cellHeight * 0.3);
          x += jitterX;
          y += jitterY;

          // Interdisciplinary nodes get pushed toward borders (closer to other areas)
          if (node.is_interdisciplinary) {
            // Move toward center of canvas (where areas meet)
            x = x + (centerX - x) * 0.15;
            y = y + (centerY - y) * 0.15;
          }

          positions[node.id] = {
            x: Math.max(region.xMin + 2, Math.min(region.xMax - 2, x)),
            y: Math.max(region.yMin + 2, Math.min(region.yMax - 2, y)),
            node,
            ring: Math.floor(i / cols) + 1,
            emphasis: node.type === 'campo_semantico',
            cluster: area,
          };
        });
      });

      // Position "other" nodes in the very center (where all areas meet)
      nodesByArea.other.forEach((node, i) => {
        const angle = (i / Math.max(nodesByArea.other.length, 1)) * Math.PI * 2;
        const r = 5 + (i % 3) * 3;
        positions[node.id] = {
          x: centerX + Math.cos(angle) * r,
          y: centerY + Math.sin(angle) * r,
          node,
          ring: 0,
          emphasis: false,
        };
      });
    } else {
      // Radial layout grouped by area - ALL nodes positioned
      // Areas are distributed in 4 quadrants around center
      const areaAngles: { [key: string]: number } = {
        CN: Math.PI * 0.75,  // Top-left (135°)
        CH: Math.PI * 0.25,  // Top-right (45°)
        LC: Math.PI * 1.25,  // Bottom-left (225°)
        MT: Math.PI * 1.75,  // Bottom-right (315°)
      };

      // Group nodes by area, then by type within each area
      const nodesByArea: { [area: string]: { semantic: GraphNode[], lexical: GraphNode[], concept: GraphNode[] } } = {
        CN: { semantic: [], lexical: [], concept: [] },
        CH: { semantic: [], lexical: [], concept: [] },
        LC: { semantic: [], lexical: [], concept: [] },
        MT: { semantic: [], lexical: [], concept: [] },
        other: { semantic: [], lexical: [], concept: [] },
      };

      nodes.forEach(node => {
        const area = node.area && areaAngles[node.area] !== undefined ? node.area : 'other';
        if (node.type === 'campo_semantico') {
          nodesByArea[area].semantic.push(node);
        } else if (node.type === 'campo_lexical') {
          nodesByArea[area].lexical.push(node);
        } else {
          nodesByArea[area].concept.push(node);
        }
      });

      // Position nodes in radial arcs for each area
      Object.entries(nodesByArea).forEach(([area, typeNodes]) => {
        if (area === 'other') return;

        const baseAngle = areaAngles[area];
        const arcSpread = Math.PI / 2.5; // 72° spread for each area
        const allAreaNodes = [...typeNodes.semantic, ...typeNodes.lexical, ...typeNodes.concept];

        if (allAreaNodes.length === 0) return;

        // Sort by importance: semantic first (inner), then lexical (mid), then concepts (outer)
        // Ring 1 (inner): semantic fields - radius 10-18
        // Ring 2 (middle): lexical fields - radius 20-28
        // Ring 3 (outer): concepts - radius 30-42

        // Position semantic nodes (inner ring)
        typeNodes.semantic.forEach((node, i) => {
          const count = typeNodes.semantic.length;
          const angleOffset = count > 1 ? (i / (count - 1) - 0.5) * arcSpread * 0.6 : 0;
          const angle = baseAngle + angleOffset;
          const radius = 12 + (i % 3) * 2;
          positions[node.id] = {
            x: centerX + Math.cos(angle) * radius,
            y: centerY + Math.sin(angle) * radius,
            node,
            ring: 1,
            emphasis: true,
            cluster: area,
          };
        });

        // Position lexical nodes (middle ring)
        typeNodes.lexical.forEach((node, i) => {
          const count = typeNodes.lexical.length;
          const angleOffset = count > 1 ? (i / (count - 1) - 0.5) * arcSpread * 0.8 : 0;
          const angle = baseAngle + angleOffset;
          const radius = 22 + (i % 3) * 2;
          positions[node.id] = {
            x: centerX + Math.cos(angle) * radius,
            y: centerY + Math.sin(angle) * radius,
            node,
            ring: 2,
            emphasis: false,
            cluster: area,
          };
        });

        // Position concept nodes (outer ring) - may need multiple sub-rings
        const conceptsPerRing = 12;
        typeNodes.concept.forEach((node, i) => {
          const count = typeNodes.concept.length;
          const ringIndex = Math.floor(i / conceptsPerRing);
          const indexInRing = i % conceptsPerRing;
          const nodesInThisRing = Math.min(conceptsPerRing, count - ringIndex * conceptsPerRing);

          const angleOffset = nodesInThisRing > 1
            ? (indexInRing / (nodesInThisRing - 1) - 0.5) * arcSpread
            : 0;
          const angle = baseAngle + angleOffset;
          const radius = 32 + ringIndex * 6 + (indexInRing % 2) * 1.5;

          positions[node.id] = {
            x: centerX + Math.cos(angle) * radius,
            y: centerY + Math.sin(angle) * radius,
            node,
            ring: 3 + ringIndex,
            emphasis: false,
            cluster: area,
          };
        });
      });

      // Position "other" nodes (no area) in center
      const otherNodes = [...nodesByArea.other.semantic, ...nodesByArea.other.lexical, ...nodesByArea.other.concept];
      otherNodes.forEach((node, i) => {
        const angle = (i / Math.max(otherNodes.length, 1)) * Math.PI * 2;
        const radius = 5 + (i % 3) * 2;
        positions[node.id] = {
          x: centerX + Math.cos(angle) * radius,
          y: centerY + Math.sin(angle) * radius,
          node,
          ring: 0,
          emphasis: node.type === 'campo_semantico',
        };
      });
    }

    return positions;
  }, [viewMode]);

  const nodePositions = useMemo(() =>
    calculatePositions(filteredNodes),
    [filteredNodes, calculatePositions]
  );

  // Get connected nodes for highlighting
  const getConnectedNodes = useCallback((nodeId: string) => {
    const connected = new Set<string>();
    filteredEdges.forEach(edge => {
      if (edge.source === nodeId) connected.add(edge.target);
      if (edge.target === nodeId) connected.add(edge.source);
    });
    return connected;
  }, [filteredEdges]);

  const connectedNodes = hoveredNode ? getConnectedNodes(hoveredNode) : new Set<string>();
  const selectedConnections = selectedNode ? getConnectedNodes(selectedNode) : new Set<string>();

  // Count active filters
  const activeFilterCount = Object.values(entityFilters).filter(Boolean).length;

  // Area colors with full config
  const areaConfig: Record<string, { color: string; name: string }> = {
    CN: { color: '#22c55e', name: 'Ciências da Natureza' },
    CH: { color: '#eab308', name: 'Ciências Humanas' },
    LC: { color: '#ef4444', name: 'Linguagens' },
    MT: { color: '#3b82f6', name: 'Matemática' },
  };

  return (
    <div className="space-y-3">
      {/* Controls Row 1: Area toggles + Node slider */}
      <div className="flex items-center justify-between gap-4 flex-wrap bg-white/5 rounded-xl p-3">
        {/* Area Toggle Buttons */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Áreas:</span>
          <div className="flex gap-1">
            {(['CN', 'CH', 'LC', 'MT'] as const).map((area) => (
              <button
                key={area}
                onClick={() => setAreaVisibility(prev => ({ ...prev, [area]: !prev[area] }))}
                onDoubleClick={() => zoomToArea(area)}
                className={`px-2.5 py-1 text-xs rounded-lg transition-all font-medium ${
                  areaVisibility[area]
                    ? 'text-white shadow-sm'
                    : 'bg-gray-100 text-gray-400 opacity-50'
                }`}
                style={areaVisibility[area] ? { backgroundColor: areaConfig[area].color } : undefined}
                title={`Clique: mostrar/esconder | Duplo clique: zoom em ${areaConfig[area].name}`}
              >
                {area}
              </button>
            ))}
          </div>
        </div>

        {/* Node Limit Slider */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">Nós:</span>
          <input
            type="range"
            min={20}
            max={150}
            step={10}
            value={maxNodes}
            onChange={(e) => setMaxNodes(Number(e.target.value))}
            className="w-24 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-500"
          />
          <span className="text-xs text-gray-600 font-medium w-8">{maxNodes}</span>
        </div>

        {/* Labels Toggle */}
        <button
          onClick={() => setShowAllLabels(!showAllLabels)}
          className={`px-3 py-1 text-xs rounded-lg transition-all flex items-center gap-1.5 ${
            showAllLabels
              ? 'bg-purple-100 text-purple-700 border border-purple-200'
              : 'bg-gray-100 text-gray-500'
          }`}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
          {showAllLabels ? 'Labels' : 'Hover'}
        </button>

        {/* Layout Toggle */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
          <button
            onClick={() => setViewMode('clusters')}
            className={`px-3 py-1 text-xs rounded-md transition-all flex items-center gap-1 ${
              viewMode === 'clusters'
                ? 'bg-purple-500 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Layers className="w-3 h-3" />
            Clusters
          </button>
          <button
            onClick={() => setViewMode('all')}
            className={`px-3 py-1 text-xs rounded-md transition-all flex items-center gap-1 ${
              viewMode === 'all'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Network className="w-3 h-3" />
            Radial
          </button>
        </div>

        {/* Animation Toggle */}
        <button
          onClick={() => setAnimationEnabled(!animationEnabled)}
          className={`px-3 py-1 text-xs rounded-lg transition-all flex items-center gap-1 ${
            animationEnabled
              ? 'bg-amber-100 text-amber-700 border border-amber-200'
              : 'bg-gray-100 text-gray-500'
          }`}
        >
          <Zap className={`w-3.5 h-3.5 ${animationEnabled ? 'animate-pulse' : ''}`} />
          Fluxo
        </button>
      </div>

      {/* Controls Row 2: Entity type filters */}
      <div className="flex items-center gap-4 text-xs">
        <span className="text-gray-500">Tipos:</span>
        {[
          { key: 'conceito_cientifico', label: 'Conceitos', color: '#3b82f6' },
          { key: 'campo_semantico', label: 'Semânticos', color: '#a855f7' },
          { key: 'campo_lexical', label: 'Lexicais', color: '#10b981' },
        ].map(({ key, label, color }) => (
          <button
            key={key}
            onClick={() => toggleEntityFilter(key as keyof typeof entityFilters)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg transition-all ${
              entityFilters[key as keyof typeof entityFilters]
                ? 'bg-white shadow-sm'
                : 'bg-gray-100 opacity-50'
            }`}
          >
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: color, opacity: entityFilters[key as keyof typeof entityFilters] ? 1 : 0.3 }}
            />
            <span className={entityFilters[key as keyof typeof entityFilters] ? 'text-gray-700' : 'text-gray-400'}>
              {label}
            </span>
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="h-[500px] bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl flex items-center justify-center">
          <div className="text-center">
            <div className="relative w-16 h-16 mx-auto mb-4">
              <div className="absolute inset-0 rounded-full border-4 border-purple-500/30 animate-ping" />
              <div className="absolute inset-2 rounded-full border-4 border-purple-400/50 animate-pulse" />
              <div className="absolute inset-4 rounded-full bg-purple-500 animate-pulse" />
            </div>
            <p className="text-purple-300 text-sm">Carregando rede neural...</p>
          </div>
        </div>
      ) : graphData ? (
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 rounded-2xl overflow-hidden shadow-2xl">
          {/* Header Stats */}
          <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-purple-500 rounded-xl blur-lg opacity-50" />
                <div className="relative p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl">
                  <Network className="h-5 w-5 text-white" />
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-white">Rede Neural de Conhecimento</h3>
                <p className="text-xs text-slate-400">
                  Visualização interativa • {filteredNodes.length} nós • {filteredEdges.length} conexões
                </p>
              </div>
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-white/10 rounded-lg p-1">
                <button
                  onClick={() => handleZoom(-0.2)}
                  className="p-1.5 rounded hover:bg-white/10 transition-colors text-white"
                  title="Diminuir zoom"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-xs text-slate-300 px-2 min-w-[50px] text-center">
                  {Math.round(transform.scale * 100)}%
                </span>
                <button
                  onClick={() => handleZoom(0.2)}
                  className="p-1.5 rounded hover:bg-white/10 transition-colors text-white"
                  title="Aumentar zoom"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  onClick={resetView}
                  className="p-1.5 rounded hover:bg-white/10 transition-colors text-white ml-1"
                  title="Resetar visualização"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-4 text-xs ml-4">
                {entityFilters.conceito_cientifico && (
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500 shadow-lg shadow-blue-500/50" />
                    <span className="text-slate-300">{filteredNodes.filter(n => n.type === 'conceito_cientifico').length}</span>
                  </div>
                )}
                {entityFilters.campo_semantico && (
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-purple-500 shadow-lg shadow-purple-500/50" />
                    <span className="text-slate-300">{filteredNodes.filter(n => n.type === 'campo_semantico').length}</span>
                  </div>
                )}
                {entityFilters.campo_lexical && (
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/50" />
                    <span className="text-slate-300">{filteredNodes.filter(n => n.type === 'campo_lexical').length}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Neural Network Visualization with Zoom/Pan */}
          <div
            ref={containerRef}
            className="relative h-[650px] overflow-hidden cursor-grab active:cursor-grabbing"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {/* Background Grid Effect */}
            <div className="absolute inset-0 opacity-10 pointer-events-none">
              <div className="absolute inset-0" style={{
                backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.3) 1px, transparent 0)`,
                backgroundSize: '40px 40px'
              }} />
            </div>

            {/* Glow Effects */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute top-1/4 left-1/4 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-1/4 right-1/4 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Cluster backgrounds (when in cluster mode) - Full quadrants with clear separation */}
            {viewMode === 'clusters' && (
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  transform: `scale(${transform.scale}) translate(${transform.x / transform.scale}px, ${transform.y / transform.scale}px)`,
                  transformOrigin: 'center center',
                }}
              >
                {/* Area-specific backgrounds with better colors */}
                {[
                  { area: 'CN', left: '1%', top: '1%', width: '44%', height: '44%', bg: 'rgba(34, 197, 94, 0.08)', border: 'rgba(34, 197, 94, 0.25)', label: 'Ciências da Natureza' },
                  { area: 'CH', left: '55%', top: '1%', width: '44%', height: '44%', bg: 'rgba(234, 179, 8, 0.08)', border: 'rgba(234, 179, 8, 0.25)', label: 'Ciências Humanas' },
                  { area: 'LC', left: '1%', top: '55%', width: '44%', height: '44%', bg: 'rgba(239, 68, 68, 0.08)', border: 'rgba(239, 68, 68, 0.25)', label: 'Linguagens' },
                  { area: 'MT', left: '55%', top: '55%', width: '44%', height: '44%', bg: 'rgba(59, 130, 246, 0.08)', border: 'rgba(59, 130, 246, 0.25)', label: 'Matemática' },
                ].map(({ area, left, top, width, height, bg, border, label }) => (
                  areaVisibility[area as keyof typeof areaVisibility] && (
                    <div
                      key={area}
                      className="absolute rounded-2xl border-2 border-dashed transition-all duration-300"
                      style={{ left, top, width, height, backgroundColor: bg, borderColor: border }}
                    >
                      <div
                        className="absolute top-2 left-3 px-2 py-0.5 rounded text-[10px] font-semibold"
                        style={{ backgroundColor: border, color: 'white' }}
                      >
                        {label}
                      </div>
                    </div>
                  )
                ))}

                {/* Center cross separator */}
                <div className="absolute left-[48%] top-0 w-[4%] h-full bg-gradient-to-b from-transparent via-slate-600/10 to-transparent" />
                <div className="absolute top-[48%] left-0 w-full h-[4%] bg-gradient-to-r from-transparent via-slate-600/10 to-transparent" />
              </div>
            )}

            {/* Transformable container for nodes and edges */}
            <div
              className="absolute inset-0"
              style={{
                transform: `scale(${transform.scale}) translate(${transform.x / transform.scale}px, ${transform.y / transform.scale}px)`,
                transformOrigin: 'center center',
                transition: isDragging ? 'none' : 'transform 0.1s ease-out',
              }}
            >
              {/* SVG for connections with flow animation */}
              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ zIndex: 1 }}>
                <defs>
                  <linearGradient id="lineGradientEnhanced" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="rgba(139, 92, 246, 0.6)" />
                    <stop offset="100%" stopColor="rgba(59, 130, 246, 0.6)" />
                  </linearGradient>
                  <filter id="glowEnhanced">
                    <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                    <feMerge>
                      <feMergeNode in="coloredBlur"/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                  {/* Flow animation marker */}
                  <marker
                    id="flowDot"
                    markerWidth="6"
                    markerHeight="6"
                    refX="3"
                    refY="3"
                  >
                    <circle cx="3" cy="3" r="2" fill="rgba(168, 85, 247, 0.8)" />
                  </marker>
                </defs>

                {/* Draw edges with optional flow animation */}
                {filteredEdges.slice(0, 300).map((edge, idx) => {
                  const sourcePos = nodePositions[edge.source];
                  const targetPos = nodePositions[edge.target];
                  if (!sourcePos || !targetPos) return null;

                  const isHighlighted = hoveredNode === edge.source || hoveredNode === edge.target ||
                                       selectedNode === edge.source || selectedNode === edge.target;
                  const edgeType = (edge as { type?: string }).type;
                  const isInterdisciplinary = edgeType === 'interdisciplinary';
                  const isSimilarity = edgeType === 'semantic_similarity';

                  // Calculate path for curved connections
                  const midX = (sourcePos.x + targetPos.x) / 2;
                  const midY = (sourcePos.y + targetPos.y) / 2;
                  // More curve for special edges to make them stand out
                  const curvature = isInterdisciplinary ? 8 + (idx % 5) : isSimilarity ? 5 + (idx % 4) : 2 + (idx % 3);
                  const curveX = midX + curvature;
                  const curveY = midY - curvature;

                  // Colors by edge type:
                  // - interdisciplinary = amber/gold (original data connections)
                  // - semantic_similarity = cyan/teal (auto-detected similar labels)
                  // - normal = purple/gray
                  const colors = {
                    interdisciplinary: { highlight: 'rgba(251, 191, 36, 0.9)', normal: 'rgba(251, 191, 36, 0.3)' },
                    semantic_similarity: { highlight: 'rgba(6, 182, 212, 0.9)', normal: 'rgba(6, 182, 212, 0.35)' },
                    default: { highlight: 'rgba(168, 85, 247, 0.8)', normal: 'rgba(148, 163, 184, 0.15)' }
                  };
                  const edgeColors = isInterdisciplinary ? colors.interdisciplinary
                    : isSimilarity ? colors.semantic_similarity
                    : colors.default;

                  return (
                    <g key={idx}>
                      {/* Main edge line */}
                      <path
                        d={`M ${sourcePos.x} ${sourcePos.y} Q ${curveX} ${curveY} ${targetPos.x} ${targetPos.y}`}
                        fill="none"
                        stroke={isHighlighted ? edgeColors.highlight : edgeColors.normal}
                        strokeWidth={isHighlighted ? 0.4 : (isInterdisciplinary || isSimilarity ? 0.25 : 0.15)}
                        strokeDasharray={isInterdisciplinary ? '1.5 0.8' : isSimilarity ? '0.8 0.5' : undefined}
                        filter={isHighlighted ? 'url(#glowEnhanced)' : undefined}
                        className="transition-all duration-300"
                      />

                      {/* Flow animation particles */}
                      {animationEnabled && isHighlighted && (
                        <>
                          <circle r="0.8" fill={edgeColors.highlight}>
                            <animateMotion
                              dur={`${1.5 + (idx % 3) * 0.5}s`}
                              repeatCount="indefinite"
                              path={`M ${sourcePos.x} ${sourcePos.y} Q ${curveX} ${curveY} ${targetPos.x} ${targetPos.y}`}
                            />
                          </circle>
                          <circle r="0.5" fill={isSimilarity ? 'rgba(34, 211, 238, 0.7)' : isInterdisciplinary ? 'rgba(245, 158, 11, 0.7)' : 'rgba(59, 130, 246, 0.7)'}>
                            <animateMotion
                              dur={`${2 + (idx % 2) * 0.5}s`}
                              repeatCount="indefinite"
                              begin="0.5s"
                              path={`M ${sourcePos.x} ${sourcePos.y} Q ${curveX} ${curveY} ${targetPos.x} ${targetPos.y}`}
                            />
                          </circle>
                        </>
                      )}
                    </g>
                  );
                })}

                {/* Animated pulse rings on hovered node */}
                {hoveredNode && nodePositions[hoveredNode] && (
                  <>
                    <circle
                      cx={nodePositions[hoveredNode].x}
                      cy={nodePositions[hoveredNode].y}
                      r="4"
                      fill="none"
                      stroke="rgba(168, 85, 247, 0.4)"
                      strokeWidth="0.3"
                      className="animate-ping"
                    />
                    <circle
                      cx={nodePositions[hoveredNode].x}
                      cy={nodePositions[hoveredNode].y}
                      r="2.5"
                      fill="none"
                      stroke="rgba(168, 85, 247, 0.6)"
                      strokeWidth="0.2"
                      className="animate-pulse"
                    />
                  </>
                )}
              </svg>

              {/* Nodes as Tags or Dots */}
              {Object.entries(nodePositions).map(([id, { x, y, node, emphasis }]) => {
                const isHovered = hoveredNode === id;
                const isConnected = connectedNodes.has(id) || selectedConnections.has(id);
                const isSelected = selectedNode === id;
                const isDimmed = (hoveredNode || selectedNode) && !isHovered && !isConnected && !isSelected;

                const isSemantic = node.type === 'campo_semantico';
                const isLexical = node.type === 'campo_lexical';

                // Determine if label should be shown
                const isHighCount = node.count >= labelThreshold;
                const isZoomedIn = transform.scale >= 1.3;
                const shouldShowLabel = showAllLabels || isHovered || isSelected || isConnected || (isHighCount && isZoomedIn) || isSemantic;

                // Tag colors based on type
                const tagColors = {
                  bg: isSemantic ? 'rgba(139, 92, 246, 0.9)' : isLexical ? 'rgba(34, 197, 94, 0.9)' : 'rgba(59, 130, 246, 0.8)',
                  border: isSemantic ? 'rgba(167, 139, 250, 0.6)' : isLexical ? 'rgba(74, 222, 128, 0.5)' : 'rgba(96, 165, 250, 0.4)',
                  glow: isSemantic ? 'rgba(139, 92, 246, 0.5)' : isLexical ? 'rgba(34, 197, 94, 0.4)' : 'rgba(59, 130, 246, 0.3)',
                  solid: isSemantic ? '#8b5cf6' : isLexical ? '#22c55e' : '#3b82f6',
                };

                // Node size based on count (for dot mode)
                const dotSize = Math.max(6, Math.min(14, 6 + node.count * 0.8));

                return (
                  <div
                    key={id}
                    className="absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-200 cursor-pointer"
                    style={{
                      left: `${x}%`,
                      top: `${y}%`,
                      zIndex: isHovered || isSelected ? 50 : isConnected ? 40 : isSemantic ? 30 : isLexical ? 20 : 10,
                      opacity: isDimmed ? 0.25 : 1,
                    }}
                    onMouseEnter={() => setHoveredNode(id)}
                    onMouseLeave={() => setHoveredNode(null)}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedNode(selectedNode === id ? null : id);
                    }}
                  >
                    {shouldShowLabel ? (
                      /* Tag pill (full label) */
                      <div
                        className={`relative px-2 py-0.5 rounded-full text-white font-medium whitespace-nowrap transition-all duration-200 ${
                          isHovered || isSelected ? 'scale-110' : ''
                        }`}
                        style={{
                          fontSize: isSemantic ? '10px' : '9px',
                          backgroundColor: tagColors.bg,
                          border: `1px solid ${isSelected ? 'white' : tagColors.border}`,
                          boxShadow: isHovered || isSelected || isConnected
                            ? `0 0 15px ${tagColors.glow}, 0 2px 8px rgba(0,0,0,0.3)`
                            : '0 1px 4px rgba(0,0,0,0.2)',
                          maxWidth: isHovered ? '200px' : '100px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {isHovered ? node.label : (node.label.length > 14 ? node.label.slice(0, 14) + '…' : node.label)}
                        {node.is_interdisciplinary && (
                          <span className="ml-0.5 text-amber-300">•</span>
                        )}
                      </div>
                    ) : (
                      /* Dot (collapsed mode) */
                      <div
                        className={`rounded-full transition-all duration-200 ${
                          isHovered ? 'scale-150' : ''
                        }`}
                        style={{
                          width: `${dotSize}px`,
                          height: `${dotSize}px`,
                          backgroundColor: tagColors.solid,
                          border: node.is_interdisciplinary ? '2px solid #fbbf24' : `1px solid ${tagColors.border}`,
                          boxShadow: `0 0 ${dotSize}px ${tagColors.glow}`,
                        }}
                      />
                    )}

                    {/* Tooltip */}
                    {y < 50 ? (
                      <div className={`absolute left-1/2 -translate-x-1/2 transition-all duration-200 pointer-events-none ${
                        isHovered ? 'opacity-100 top-full mt-2' : 'opacity-0 top-full mt-0'
                      }`} style={{ zIndex: 50 }}>
                        <div className="bg-slate-900/95 backdrop-blur-sm border border-white/20 rounded-xl px-4 py-3 shadow-2xl min-w-[220px]">
                          <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-slate-900/95 border-l border-t border-white/20 transform rotate-45" />
                          <p className="font-semibold text-white text-sm mb-1">{node.label}</p>
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <span
                              className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                              style={{ backgroundColor: `${node.color}30`, color: node.color }}
                            >
                              {node.type === 'conceito_cientifico' ? 'Conceito' :
                               node.type === 'campo_semantico' ? 'Semântico' : 'Lexical'}
                            </span>
                            <span className="text-[10px] text-slate-400">{node.count}x</span>
                            {node.area && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-700 text-slate-300">
                                {node.area_name || node.area}
                              </span>
                            )}
                          </div>
                          {node.is_interdisciplinary && node.area_distribution && (
                            <div className="mt-2 pt-2 border-t border-white/10">
                              <p className="text-[10px] text-amber-400 mb-1">Interdisciplinar:</p>
                              <div className="flex gap-1 flex-wrap">
                                {Object.entries(node.area_distribution).map(([area, count]) => (
                                  <span key={area} className="text-[9px] px-1.5 py-0.5 bg-slate-700/50 rounded text-slate-400">
                                    {area}: {count}x
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className={`absolute left-1/2 -translate-x-1/2 transition-all duration-200 pointer-events-none ${
                        isHovered ? 'opacity-100 bottom-full mb-2' : 'opacity-0 bottom-full mb-0'
                      }`} style={{ zIndex: 50 }}>
                        <div className="bg-slate-900/95 backdrop-blur-sm border border-white/20 rounded-xl px-4 py-3 shadow-2xl min-w-[220px]">
                          <p className="font-semibold text-white text-sm mb-1">{node.label}</p>
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <span
                              className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                              style={{ backgroundColor: `${node.color}30`, color: node.color }}
                            >
                              {node.type === 'conceito_cientifico' ? 'Conceito' :
                               node.type === 'campo_semantico' ? 'Semântico' : 'Lexical'}
                            </span>
                            <span className="text-[10px] text-slate-400">{node.count}x</span>
                            {node.area && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-700 text-slate-300">
                                {node.area_name || node.area}
                              </span>
                            )}
                          </div>
                          {node.is_interdisciplinary && node.area_distribution && (
                            <div className="mt-2 pt-2 border-t border-white/10">
                              <p className="text-[10px] text-amber-400 mb-1">Interdisciplinar:</p>
                              <div className="flex gap-1 flex-wrap">
                                {Object.entries(node.area_distribution).map(([area, count]) => (
                                  <span key={area} className="text-[9px] px-1.5 py-0.5 bg-slate-700/50 rounded text-slate-400">
                                    {area}: {count}x
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-slate-900/95 border-r border-b border-white/20 transform rotate-45" />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Center decoration */}
              {viewMode === 'all' && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
                  <div className="relative">
                    <div className="absolute inset-0 w-20 h-20 rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 blur-xl" />
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 flex items-center justify-center">
                      <Brain className={`w-8 h-8 text-purple-400 ${animationEnabled ? 'animate-pulse' : ''}`} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Zoom level indicator (bottom right) */}
            <div className="absolute bottom-4 right-4 bg-black/40 backdrop-blur-sm rounded-lg px-3 py-1.5 text-xs text-slate-300">
              {transform.scale !== 1 || transform.x !== 0 || transform.y !== 0 ? (
                <span>Zoom: {Math.round(transform.scale * 100)}% • Scroll para zoom, arraste para mover</span>
              ) : (
                <span>Scroll para zoom • Arraste para mover</span>
              )}
            </div>
          </div>

          {/* Legend & Audit Info */}
          <div className="px-6 py-4 border-t border-white/10 bg-black/20">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-4 flex-wrap">
                {/* Node types */}
                <div className="flex items-center gap-3">
                  {entityFilters.conceito_cientifico && (
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-blue-500" />
                      <span className="text-[10px] text-slate-400">Conceito</span>
                    </div>
                  )}
                  {entityFilters.campo_semantico && (
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-purple-500" />
                      <span className="text-[10px] text-slate-400">Semântico</span>
                    </div>
                  )}
                  {entityFilters.campo_lexical && (
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-emerald-500" />
                      <span className="text-[10px] text-slate-400">Lexical</span>
                    </div>
                  )}
                </div>

                {/* Edge types legend */}
                <div className="flex items-center gap-3 pl-3 border-l border-slate-700">
                  <div className="flex items-center gap-1.5">
                    <div className="w-6 h-0.5 bg-amber-400" style={{ backgroundImage: 'repeating-linear-gradient(90deg, #fbbf24 0, #fbbf24 4px, transparent 4px, transparent 6px)' }} />
                    <span className="text-[10px] text-amber-400">Interdisciplinar</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-6 h-0.5 bg-cyan-400" style={{ backgroundImage: 'repeating-linear-gradient(90deg, #22d3ee 0, #22d3ee 2px, transparent 2px, transparent 4px)' }} />
                    <span className="text-[10px] text-cyan-400">Similaridade</span>
                  </div>
                </div>
              </div>

              {/* Audit summary */}
              {graphData?.similarity_audit && (
                <div className="flex items-center gap-2 text-[10px]">
                  {graphData.similarity_audit.exact_duplicates > 0 && (
                    <span className="px-2 py-0.5 bg-red-500/20 text-red-400 rounded">
                      {graphData.similarity_audit.exact_duplicates} duplicatas
                    </span>
                  )}
                  {graphData.similarity_audit.total_similarity_edges > 0 && (
                    <span className="px-2 py-0.5 bg-cyan-500/20 text-cyan-400 rounded">
                      {graphData.similarity_audit.total_similarity_edges} conexões detectadas
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Expanded audit details (show on hover/click) */}
            {graphData?.similarity_audit && graphData.similarity_audit.exact_duplicates > 0 && (
              <details className="mt-3 text-xs">
                <summary className="cursor-pointer text-slate-400 hover:text-slate-300 transition-colors">
                  Ver relatório de auditoria ({graphData.similarity_audit.exact_duplicates + graphData.similarity_audit.similar_labels} itens)
                </summary>
                <div className="mt-2 p-3 bg-slate-800/50 rounded-lg max-h-40 overflow-y-auto">
                  {graphData.similarity_audit.details.duplicates.length > 0 && (
                    <div className="mb-2">
                      <p className="text-red-400 font-medium mb-1">Duplicatas exatas:</p>
                      <div className="space-y-1">
                        {graphData.similarity_audit.details.duplicates.slice(0, 5).map((d, i) => (
                          <div key={i} className="flex items-center gap-2 text-slate-300">
                            <span className="text-red-400">•</span>
                            <span>"{d.label1}"</span>
                            <span className="text-slate-500">↔</span>
                            <span>"{d.label2}"</span>
                            <span className="text-slate-500">({d.area1} / {d.area2})</span>
                            <span className="text-emerald-400">{Math.round(d.similarity * 100)}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {graphData.similarity_audit.details.similar.length > 0 && (
                    <div>
                      <p className="text-cyan-400 font-medium mb-1">Labels similares:</p>
                      <div className="space-y-1">
                        {graphData.similarity_audit.details.similar.slice(0, 5).map((d, i) => (
                          <div key={i} className="flex items-center gap-2 text-slate-300">
                            <span className="text-cyan-400">•</span>
                            <span>"{d.label1}"</span>
                            <span className="text-slate-500">↔</span>
                            <span>"{d.label2}"</span>
                            <span className="text-slate-500">({d.area1} / {d.area2})</span>
                            <span className="text-emerald-400">{Math.round(d.similarity * 100)}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </details>
            )}
          </div>

        </div>
      ) : null}
    </div>
  );
}
