'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { Brain, ZoomIn, ZoomOut, Maximize2, Play, Pause } from 'lucide-react';

// Types
interface SemanticNode {
  id: string;
  label: string;
  area: 'CN' | 'CH' | 'LC' | 'MT';
  type: 'conceito' | 'campo_semantico' | 'campo_lexical';
  count: number;
  connections?: string[]; // IDs of connected nodes in OTHER areas (interdisciplinary)
}

interface SemanticEdge {
  source: string;
  target: string;
  weight: number;
  isInterdisciplinary: boolean;
}

interface Props {
  nodes?: SemanticNode[];
  edges?: SemanticEdge[];
}

// Area configuration
const AREA_CONFIG = {
  CN: { color: '#22c55e', name: 'Ciências da Natureza', angle: Math.PI * 0.75 },
  CH: { color: '#eab308', name: 'Ciências Humanas', angle: Math.PI * 0.25 },
  LC: { color: '#ef4444', name: 'Linguagens', angle: Math.PI * 1.25 },
  MT: { color: '#3b82f6', name: 'Matemática', angle: Math.PI * 1.75 },
};

// Sample data - Replace with your actual data
const SAMPLE_NODES: SemanticNode[] = [
  // Ciências da Natureza (CN)
  { id: 'cn1', label: 'Fisiologia', area: 'CN', type: 'campo_semantico', count: 45, connections: ['ch3', 'lc2'] },
  { id: 'cn2', label: 'Eletromagnetismo', area: 'CN', type: 'conceito', count: 38, connections: ['mt1', 'mt3'] },
  { id: 'cn3', label: 'Biologia/Ecologia', area: 'CN', type: 'campo_semantico', count: 52, connections: ['ch2'] },
  { id: 'cn4', label: 'Termologia', area: 'CN', type: 'conceito', count: 28, connections: ['mt2'] },
  { id: 'cn5', label: 'Física/Tecnologia', area: 'CN', type: 'campo_lexical', count: 35, connections: ['mt1'] },
  { id: 'cn6', label: 'Meio Ambiente', area: 'CN', type: 'campo_semantico', count: 48, connections: ['ch1', 'ch2'] },
  { id: 'cn7', label: 'Compostos Orgânicos', area: 'CN', type: 'conceito', count: 22 },
  { id: 'cn8', label: 'Relações Ecológicas', area: 'CN', type: 'conceito', count: 31, connections: ['ch2'] },
  { id: 'cn9', label: 'Biotecnologia', area: 'CN', type: 'campo_lexical', count: 19, connections: ['ch3'] },
  { id: 'cn10', label: 'Consumo de Energia', area: 'CN', type: 'conceito', count: 25, connections: ['mt2', 'ch1'] },
  
  // Ciências Humanas (CH)
  { id: 'ch1', label: 'Geografia Física', area: 'CH', type: 'campo_semantico', count: 42, connections: ['cn6'] },
  { id: 'ch2', label: 'Filosofia Política', area: 'CH', type: 'campo_semantico', count: 38, connections: ['lc1'] },
  { id: 'ch3', label: 'História da Vida Privada', area: 'CH', type: 'conceito', count: 29, connections: ['lc3'] },
  { id: 'ch4', label: 'Globalização', area: 'CH', type: 'conceito', count: 51, connections: ['mt4', 'lc1'] },
  { id: 'ch5', label: 'Movimentos Sociais', area: 'CH', type: 'campo_lexical', count: 33, connections: ['lc2'] },
  { id: 'ch6', label: 'Cartografia', area: 'CH', type: 'conceito', count: 27, connections: ['mt3'] },
  { id: 'ch7', label: 'Urbanização', area: 'CH', type: 'campo_semantico', count: 44, connections: ['cn6'] },
  { id: 'ch8', label: 'Direitos Humanos', area: 'CH', type: 'conceito', count: 36, connections: ['lc1'] },
  { id: 'ch9', label: 'Blocos Econômicos', area: 'CH', type: 'campo_lexical', count: 21 },
  { id: 'ch10', label: 'Tectônica de Placas', area: 'CH', type: 'conceito', count: 18, connections: ['cn3'] },
  
  // Linguagens (LC)
  { id: 'lc1', label: 'Variação Linguística', area: 'LC', type: 'campo_semantico', count: 55, connections: ['ch5'] },
  { id: 'lc2', label: 'Gêneros Textuais', area: 'LC', type: 'campo_semantico', count: 62 },
  { id: 'lc3', label: 'Figuras de Linguagem', area: 'LC', type: 'conceito', count: 41 },
  { id: 'lc4', label: 'Funções da Linguagem', area: 'LC', type: 'conceito', count: 38, connections: ['ch2'] },
  { id: 'lc5', label: 'Intertextualidade', area: 'LC', type: 'campo_lexical', count: 29, connections: ['ch3'] },
  { id: 'lc6', label: 'Língua Portuguesa', area: 'LC', type: 'campo_semantico', count: 48 },
  { id: 'lc7', label: 'Formas Verbais', area: 'LC', type: 'conceito', count: 25 },
  { id: 'lc8', label: 'Valores Olímpicos', area: 'LC', type: 'campo_lexical', count: 17, connections: ['ch5'] },
  { id: 'lc9', label: 'Desigualdade de Gênero', area: 'LC', type: 'conceito', count: 32, connections: ['ch8'] },
  { id: 'lc10', label: 'Práticas Corporais', area: 'LC', type: 'campo_lexical', count: 22, connections: ['cn1'] },
  
  // Matemática (MT)
  { id: 'mt1', label: 'Geometria Espacial', area: 'MT', type: 'campo_semantico', count: 47 },
  { id: 'mt2', label: 'Probabilidade', area: 'MT', type: 'conceito', count: 53, connections: ['cn4'] },
  { id: 'mt3', label: 'Análise de Gráficos', area: 'MT', type: 'campo_semantico', count: 58, connections: ['cn2', 'ch6'] },
  { id: 'mt4', label: 'Progressão Aritmética', area: 'MT', type: 'conceito', count: 34 },
  { id: 'mt5', label: 'Trigonometria', area: 'MT', type: 'conceito', count: 42 },
  { id: 'mt6', label: 'Cálculo de Área', area: 'MT', type: 'campo_lexical', count: 39 },
  { id: 'mt7', label: 'Média Aritmética', area: 'MT', type: 'conceito', count: 45, connections: ['cn10'] },
  { id: 'mt8', label: 'Expressão Algébrica', area: 'MT', type: 'campo_lexical', count: 28 },
  { id: 'mt9', label: 'Projeção Ortogonal', area: 'MT', type: 'conceito', count: 19 },
  { id: 'mt10', label: 'Notação Científica', area: 'MT', type: 'campo_lexical', count: 24, connections: ['cn2'] },
];

// Generate edges from node connections
function generateEdges(nodes: SemanticNode[]): SemanticEdge[] {
  const edges: SemanticEdge[] = [];
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  
  nodes.forEach(node => {
    if (node.connections) {
      node.connections.forEach(targetId => {
        const target = nodeMap.get(targetId);
        if (target && node.area !== target.area) {
          // Only add if not already exists (avoid duplicates)
          const exists = edges.some(e => 
            (e.source === node.id && e.target === targetId) ||
            (e.source === targetId && e.target === node.id)
          );
          if (!exists) {
            edges.push({
              source: node.id,
              target: targetId,
              weight: Math.min(node.count, target.count) / 10,
              isInterdisciplinary: true,
            });
          }
        }
      });
    }
  });
  
  return edges;
}

export function SemanticNeuralNetwork({ nodes = SAMPLE_NODES, edges }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [isAnimating, setIsAnimating] = useState(true);
  const [dimensions, setDimensions] = useState({ width: 1000, height: 700 });
  const simulationRef = useRef<d3.Simulation<any, any> | null>(null);
  const particlesRef = useRef<any[]>([]);
  
  const computedEdges = edges || generateEdges(nodes);

  // Update dimensions on resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: Math.max(600, containerRef.current.clientHeight),
        });
      }
    };
    
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Main D3 visualization
  useEffect(() => {
    if (!svgRef.current || dimensions.width === 0) return;

    // Custom force to cluster nodes by area. Declared inside the effect so the
    // React Compiler does not see it as a TDZ access across the component body.
    const forceCluster = (
      clusterNodes: any[],
      clusterCenterX: number,
      clusterCenterY: number
    ) => {
      const strength = 0.15;
      return (alpha: number) => {
        clusterNodes.forEach(node => {
          const areaConfig = AREA_CONFIG[node.area as keyof typeof AREA_CONFIG];
          const targetX = clusterCenterX + Math.cos(areaConfig.angle) * 180;
          const targetY = clusterCenterY + Math.sin(areaConfig.angle) * 180;

          node.vx += (targetX - node.x) * strength * alpha;
          node.vy += (targetY - node.y) * strength * alpha;
        });
      };
    };

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const { width, height } = dimensions;
    const centerX = width / 2;
    const centerY = height / 2;

    // Create main group with zoom
    const g = svg.append('g');

    // Zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Background gradient
    const defs = svg.append('defs');
    
    // Glow filter
    const filter = defs.append('filter')
      .attr('id', 'glow')
      .attr('x', '-50%')
      .attr('y', '-50%')
      .attr('width', '200%')
      .attr('height', '200%');
    filter.append('feGaussianBlur')
      .attr('stdDeviation', '3')
      .attr('result', 'coloredBlur');
    const feMerge = filter.append('feMerge');
    feMerge.append('feMergeNode').attr('in', 'coloredBlur');
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    // Particle gradient for flow animation
    const particleGradient = defs.append('radialGradient')
      .attr('id', 'particleGradient');
    particleGradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#fbbf24')
      .attr('stop-opacity', 1);
    particleGradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#fbbf24')
      .attr('stop-opacity', 0);

    // Prepare node data with initial positions in clusters
    const nodeData = nodes.map((node, i) => {
      const areaConfig = AREA_CONFIG[node.area];
      const areaNodes = nodes.filter(n => n.area === node.area);
      const indexInArea = areaNodes.indexOf(node);
      const totalInArea = areaNodes.length;
      
      // Spread nodes in a cluster around the area's angle
      const spreadAngle = Math.PI / 3; // 60 degrees spread
      const nodeAngle = areaConfig.angle + (indexInArea / totalInArea - 0.5) * spreadAngle;
      const radius = 150 + (indexInArea % 3) * 50 + Math.random() * 30;
      
      return {
        ...node,
        x: centerX + Math.cos(nodeAngle) * radius,
        y: centerY + Math.sin(nodeAngle) * radius,
        vx: 0,
        vy: 0,
        color: areaConfig.color,
        areaName: areaConfig.name,
      };
    });

    // Create edge data
    const edgeData = computedEdges.map(edge => ({
      ...edge,
      sourceNode: nodeData.find(n => n.id === edge.source),
      targetNode: nodeData.find(n => n.id === edge.target),
    })).filter(e => e.sourceNode && e.targetNode);

    // Force simulation
    const simulation = d3.forceSimulation(nodeData)
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(centerX, centerY).strength(0.05))
      .force('collision', d3.forceCollide().radius((d: any) => 30 + d.count / 5))
      .force('link', d3.forceLink(edgeData)
        .id((d: any) => d.id)
        .distance(200)
        .strength(0.3))
      .force('cluster', forceCluster(nodeData, centerX, centerY))
      .alphaDecay(0.02)
      .on('tick', ticked);

    simulationRef.current = simulation;

    // Draw area backgrounds
    const areaBackgrounds = g.append('g').attr('class', 'area-backgrounds');
    Object.entries(AREA_CONFIG).forEach(([area, config]) => {
      areaBackgrounds.append('circle')
        .attr('cx', centerX + Math.cos(config.angle) * 180)
        .attr('cy', centerY + Math.sin(config.angle) * 180)
        .attr('r', 180)
        .attr('fill', config.color)
        .attr('opacity', 0.08)
        .attr('stroke', config.color)
        .attr('stroke-width', 1)
        .attr('stroke-opacity', 0.2)
        .attr('stroke-dasharray', '5,5');
      
      // Area label
      areaBackgrounds.append('text')
        .attr('x', centerX + Math.cos(config.angle) * 280)
        .attr('y', centerY + Math.sin(config.angle) * 280)
        .attr('text-anchor', 'middle')
        .attr('fill', config.color)
        .attr('font-size', '12px')
        .attr('font-weight', 'bold')
        .attr('opacity', 0.7)
        .text(config.name);
    });

    // Draw edges
    const edgeGroup = g.append('g').attr('class', 'edges');
    const edgeLines = edgeGroup.selectAll('path')
      .data(edgeData)
      .enter()
      .append('path')
      .attr('fill', 'none')
      .attr('stroke', '#fbbf24')
      .attr('stroke-width', (d: any) => d.isInterdisciplinary ? 2 : 1)
      .attr('stroke-opacity', 0.15)
      .attr('stroke-dasharray', '8,4');

    // Particle container for flow animations
    const particleGroup = g.append('g').attr('class', 'particles');

    // Draw nodes
    const nodeGroup = g.append('g').attr('class', 'nodes');
    const nodeElements = nodeGroup.selectAll('g')
      .data(nodeData)
      .enter()
      .append('g')
      .attr('class', 'node')
      .attr('cursor', 'pointer')
      .call(d3.drag<any, any>()
        .on('start', dragStarted)
        .on('drag', dragged)
        .on('end', dragEnded));

    // Node background glow
    nodeElements.append('circle')
      .attr('r', (d: any) => 8 + d.count / 8)
      .attr('fill', (d: any) => d.color)
      .attr('opacity', 0.3)
      .attr('filter', 'url(#glow)');

    // Node main circle
    nodeElements.append('circle')
      .attr('r', (d: any) => 6 + d.count / 10)
      .attr('fill', (d: any) => d.type === 'campo_semantico' ? d.color : 
                               d.type === 'campo_lexical' ? '#10b981' : '#6366f1')
      .attr('stroke', (d: any) => d.color)
      .attr('stroke-width', 2);

    // Node labels
    nodeElements.append('text')
      .attr('dy', (d: any) => -(10 + d.count / 10))
      .attr('text-anchor', 'middle')
      .attr('fill', 'white')
      .attr('font-size', '10px')
      .attr('font-weight', '500')
      .text((d: any) => d.label.length > 18 ? d.label.slice(0, 18) + '...' : d.label)
      .attr('opacity', 0.9)
      .style('text-shadow', '0 1px 3px rgba(0,0,0,0.8)');

    // Click handler for nodes
    nodeElements.on('click', function(event, d: any) {
      event.stopPropagation();
      
      if (selectedNode === d.id) {
        setSelectedNode(null);
        resetHighlight();
      } else {
        setSelectedNode(d.id);
        highlightConnections(d);
      }
    });

    // Hover effects
    nodeElements
      .on('mouseenter', function(event, d: any) {
        d3.select(this).select('circle:nth-child(2)')
          .transition()
          .duration(200)
          .attr('r', (d: any) => (8 + d.count / 10) * 1.3);
        
        // Show tooltip
        showTooltip(event, d);
      })
      .on('mouseleave', function(event, d: any) {
        d3.select(this).select('circle:nth-child(2)')
          .transition()
          .duration(200)
          .attr('r', (d: any) => 6 + d.count / 10);
        
        hideTooltip();
      });

    // Tooltip
    const tooltip = d3.select(containerRef.current)
      .append('div')
      .attr('class', 'tooltip')
      .style('position', 'absolute')
      .style('visibility', 'hidden')
      .style('background', 'rgba(15, 23, 42, 0.95)')
      .style('border', '1px solid rgba(255,255,255,0.2)')
      .style('border-radius', '12px')
      .style('padding', '12px 16px')
      .style('color', 'white')
      .style('font-size', '12px')
      .style('pointer-events', 'none')
      .style('z-index', '100')
      .style('backdrop-filter', 'blur(8px)');

    function showTooltip(event: any, d: any) {
      const connections = d.connections?.length || 0;
      tooltip
        .style('visibility', 'visible')
        .html(`
          <div style="font-weight: 600; font-size: 14px; margin-bottom: 6px;">${d.label}</div>
          <div style="color: ${d.color}; font-size: 11px; margin-bottom: 4px;">${d.areaName}</div>
          <div style="display: flex; gap: 12px; margin-top: 8px;">
            <span style="color: #94a3b8;">Frequência: <strong style="color: white;">${d.count}</strong></span>
            ${connections > 0 ? `<span style="color: #fbbf24;">Conexões: <strong>${connections}</strong></span>` : ''}
          </div>
          ${d.type === 'campo_semantico' ? '<div style="margin-top: 6px; padding: 4px 8px; background: rgba(139, 92, 246, 0.3); border-radius: 4px; font-size: 10px;">Campo Semântico</div>' : ''}
        `)
        .style('left', (event.pageX + 15) + 'px')
        .style('top', (event.pageY - 10) + 'px');
    }

    function hideTooltip() {
      tooltip.style('visibility', 'hidden');
    }

    function highlightConnections(d: any) {
      // Dim all edges first
      edgeLines.attr('stroke-opacity', 0.05);
      
      // Highlight connected edges and animate particles
      const connectedEdges = edgeData.filter((e: any) => 
        e.source.id === d.id || e.target.id === d.id
      );
      
      edgeLines.filter((e: any) => 
        e.source.id === d.id || e.target.id === d.id
      )
        .attr('stroke-opacity', 0.8)
        .attr('stroke-width', 3);
      
      // Dim non-connected nodes
      nodeElements.attr('opacity', (n: any) => {
        if (n.id === d.id) return 1;
        if (d.connections?.includes(n.id)) return 1;
        return 0.2;
      });
      
      // Create flowing particles for connections
      if (isAnimating) {
        createFlowingParticles(connectedEdges, d);
      }
    }

    function resetHighlight() {
      edgeLines
        .attr('stroke-opacity', 0.15)
        .attr('stroke-width', (d: any) => d.isInterdisciplinary ? 2 : 1);
      
      nodeElements.attr('opacity', 1);
      
      // Clear particles
      particleGroup.selectAll('*').remove();
      particlesRef.current = [];
    }

    function createFlowingParticles(edges: any[], sourceNode: any) {
      particleGroup.selectAll('*').remove();
      particlesRef.current = [];
      
      edges.forEach((edge: any) => {
        const isSource = edge.source.id === sourceNode.id;
        const startNode = isSource ? edge.source : edge.target;
        const endNode = isSource ? edge.target : edge.source;
        
        // Create multiple particles per edge
        for (let i = 0; i < 5; i++) {
          const particle = {
            edge,
            startNode,
            endNode,
            progress: i * 0.2, // Stagger particles
            speed: 0.008 + Math.random() * 0.004,
          };
          particlesRef.current.push(particle);
          
          particleGroup.append('circle')
            .attr('class', `particle-${edge.source.id}-${edge.target.id}-${i}`)
            .attr('r', 4)
            .attr('fill', '#fbbf24')
            .attr('opacity', 0)
            .attr('filter', 'url(#glow)');
        }
      });
    }

    function animateParticles() {
      if (!isAnimating || particlesRef.current.length === 0) return;
      
      particlesRef.current.forEach((particle, i) => {
        particle.progress += particle.speed;
        if (particle.progress > 1) {
          particle.progress = 0;
        }
        
        const t = particle.progress;
        const x = particle.startNode.x + (particle.endNode.x - particle.startNode.x) * t;
        const y = particle.startNode.y + (particle.endNode.y - particle.startNode.y) * t;
        
        // Fade in at start, fade out at end
        const opacity = t < 0.1 ? t * 10 : t > 0.9 ? (1 - t) * 10 : 1;
        
        particleGroup.select(`.particle-${particle.edge.source.id}-${particle.edge.target.id}-${i % 5}`)
          .attr('cx', x)
          .attr('cy', y)
          .attr('opacity', opacity * 0.8);
      });
    }

    function ticked() {
      // Update edge positions with curves
      edgeLines.attr('d', (d: any) => {
        const dx = d.target.x - d.source.x;
        const dy = d.target.y - d.source.y;
        const dr = Math.sqrt(dx * dx + dy * dy) * 0.5;
        return `M${d.source.x},${d.source.y}Q${(d.source.x + d.target.x) / 2},${(d.source.y + d.target.y) / 2 - dr * 0.3},${d.target.x},${d.target.y}`;
      });

      // Update node positions
      nodeElements.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
      
      // Animate particles
      animateParticles();
    }

    function dragStarted(event: any, d: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event: any, d: any) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragEnded(event: any, d: any) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    // Animation loop for particles
    const animationFrame = () => {
      if (isAnimating && particlesRef.current.length > 0) {
        animateParticles();
      }
      requestAnimationFrame(animationFrame);
    };
    const animationId = requestAnimationFrame(animationFrame);

    // Click on background to reset
    svg.on('click', () => {
      setSelectedNode(null);
      resetHighlight();
    });

    return () => {
      simulation.stop();
      cancelAnimationFrame(animationId);
      tooltip.remove();
    };
  }, [nodes, computedEdges, dimensions, isAnimating]);

  const handleZoomIn = () => {
    if (svgRef.current) {
      const svg = d3.select(svgRef.current);
      svg.transition().duration(300).call(
        d3.zoom<SVGSVGElement, unknown>().scaleBy as any,
        1.3
      );
    }
  };

  const handleZoomOut = () => {
    if (svgRef.current) {
      const svg = d3.select(svgRef.current);
      svg.transition().duration(300).call(
        d3.zoom<SVGSVGElement, unknown>().scaleBy as any,
        0.7
      );
    }
  };

  const handleReset = () => {
    if (svgRef.current) {
      const svg = d3.select(svgRef.current);
      svg.transition().duration(500).call(
        d3.zoom<SVGSVGElement, unknown>().transform as any,
        d3.zoomIdentity
      );
    }
    setSelectedNode(null);
  };

  return (
    <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 rounded-2xl overflow-hidden shadow-2xl">
      {/* Header */}
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

        {/* Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAnimating(!isAnimating)}
            className={`p-2 rounded-lg transition-colors ${
              isAnimating ? 'bg-amber-500/20 text-amber-400' : 'bg-white/10 text-slate-400'
            }`}
            title={isAnimating ? 'Pausar animação' : 'Iniciar animação'}
          >
            {isAnimating ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          <div className="flex items-center gap-1 bg-white/10 rounded-lg p-1">
            <button
              onClick={handleZoomOut}
              className="p-1.5 rounded hover:bg-white/10 transition-colors text-white"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={handleZoomIn}
              className="p-1.5 rounded hover:bg-white/10 transition-colors text-white"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={handleReset}
              className="p-1.5 rounded hover:bg-white/10 transition-colors text-white"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Visualization */}
      <div ref={containerRef} className="relative" style={{ height: '700px' }}>
        <svg
          ref={svgRef}
          width={dimensions.width}
          height={dimensions.height}
          style={{ background: 'transparent' }}
        />
        
        {/* Legend */}
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

        {/* Instructions */}
        <div className="absolute bottom-4 right-4 bg-black/40 backdrop-blur-sm rounded-lg px-3 py-2 text-xs text-slate-400">
          Clique em um nó para ver conexões • Arraste para mover • Scroll para zoom
        </div>
      </div>
    </div>
  );
}

export default SemanticNeuralNetwork;
