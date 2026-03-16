import { supabase } from './supabase';

// API URL from environment variable (Fly.io backend - updated)
export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// User type for admin APIs
export interface User {
  id: string;
  codigo_inep: string;
  nome_escola: string;
  email?: string;
  is_active: boolean;
  is_admin: boolean;
  created_at?: string;
}

export interface SchoolScore {
  ano: number;
  nota_cn: number | null;
  nota_ch: number | null;
  nota_lc: number | null;
  nota_mt: number | null;
  nota_redacao: number | null;
  nota_media: number | null;
  ranking_brasil: number | null;
  ranking_uf: number | null;
  desempenho_habilidades: number | null;
  competencia_redacao_media: number | null;
}

export interface SchoolSummary {
  codigo_inep: string;
  nome_escola: string;
  uf: string | null;
  tipo_escola: string | null;
  localizacao: string | null;
  porte: number | null;
  porte_label: string | null;
  qt_matriculas: number | null;
  ultimo_ranking: number | null;
  ultima_nota: number | null;
  anos_participacao: number;
}

export interface SchoolDetail {
  codigo_inep: string;
  nome_escola: string;
  uf: string | null;
  tipo_escola: string | null;
  historico: SchoolScore[];
  tendencia: string | null;
  melhor_ano: number | null;
  melhor_ranking: number | null;
}

export interface TopSchool {
  ranking: number;
  codigo_inep: string;
  nome_escola: string;
  uf: string | null;
  tipo_escola: string | null;
  localizacao: string | null;
  porte: number | null;
  porte_label: string | null;
  qt_matriculas: number | null;
  nota_media: number | null;
  nota_cn: number | null;
  nota_ch: number | null;
  nota_lc: number | null;
  nota_mt: number | null;
  nota_redacao: number | null;
  desempenho_habilidades: number | null;
  competencia_redacao_media: number | null;
}

export interface Stats {
  total_records: number;
  total_schools: number;
  years: number[];
  states: string[];
  avg_scores: {
    nota_cn: number;
    nota_ch: number;
    nota_lc: number;
    nota_mt: number;
    nota_redacao: number;
  };
}

// ML Types - Predictions
export interface PredictionInterval {
  low: number;
  high: number;
}

export interface PredictionAreaPresentation {
  current_score: number;
  raw_score: number;
  display_score: number;
  confidence_interval: PredictionInterval;
  raw_confidence_interval: PredictionInterval;
  display_mode: 'delta' | 'range';
  regime: 'elite_consistent' | 'regular' | 'sparse';
  risk_level: 'normal' | 'conservative' | 'outlier';
  risk_reason?: string | null;
  badge_text?: string | null;
  historical_corridor: PredictionInterval;
  raw_expected_change: number;
  display_expected_change: number;
  model_info: Record<string, unknown>;
}

export interface PredictionResult {
  codigo_inep: string;
  target_year: number;
  scores: Record<string, number>;
  raw_scores: Record<string, number>;
  display_scores: Record<string, number>;
  current_scores: Record<string, number>;
  expected_change: Record<string, number>;
  raw_expected_change: Record<string, number>;
  confidence_intervals: Record<string, PredictionInterval>;
  raw_confidence_intervals: Record<string, PredictionInterval>;
  display_modes: Record<string, 'delta' | 'range'>;
  risk_levels: Record<string, 'normal' | 'conservative' | 'outlier'>;
  risk_reasons: Record<string, string | null | undefined>;
  badge_texts: Record<string, string | null | undefined>;
  historical_corridors: Record<string, PredictionInterval>;
  areas: Record<string, PredictionAreaPresentation>;
  model_info: Record<string, unknown>;
}

export interface PredictionComparison {
  codigo_inep: string;
  historical: {
    year: number;
    scores: Record<string, number | null>;
  };
  predicted: {
    year: number;
    scores: Record<string, number>;
    raw_scores: Record<string, number>;
    display_scores: Record<string, number>;
  };
  expected_change: Record<string, number>;
  raw_expected_change: Record<string, number>;
  confidence_intervals: Record<string, PredictionInterval>;
  raw_confidence_intervals: Record<string, PredictionInterval>;
  areas: Record<string, PredictionAreaPresentation>;
  model_info: Record<string, unknown>;
}

// ML Types - Diagnosis
export interface AreaAnalysis {
  area: string;
  area_name: string;
  school_score: number;
  national_avg: number;
  peer_avg: number;
  gap_to_national: number;
  gap_to_peer: number;
  z_score: number;
  status: 'excellent' | 'good' | 'needs_attention' | 'critical';
  priority_score: number;
}

export interface DiagnosisResult {
  codigo_inep: string;
  school_info: {
    codigo_inep: string;
    nome_escola: string;
    porte: number | null;
    tipo_escola: string | null;
    localizacao: string | null;
    ano: number;
  };
  overall_health: 'excellent' | 'good' | 'needs_attention' | 'critical';
  health_summary: {
    avg_z_score: number;
    critical_areas: number;
    excellent_areas: number;
    total_areas: number;
  };
  area_analysis: AreaAnalysis[];
  priority_areas: AreaAnalysis[];
  strengths: AreaAnalysis[];
  skill_gaps: {
    skill_code: string;
    area: string;
    skill_number: number;
    national_avg: number;
    estimated_school: number;
    gap: number;
    priority_score: number;
  }[];
  peer_comparison: {
    comparison_group: string;
    peer_count: number;
  };
}

// ML Types - Clustering
export interface ClusterPersona {
  name: string;
  description: string;
  color: string;
}

export interface ClusterResult {
  codigo_inep: string;
  cluster: number;
  persona: ClusterPersona;
  scores: Record<string, number>;
  cluster_center: Record<string, number>;
  distance_to_center: number;
}

export interface SimilarSchool {
  codigo_inep: string;
  nome_escola: string;
  distance: number;
  scores: Record<string, number>;
  porte: number | null;
  tipo_escola: string | null;
}

// ML Types - Recommendations
export interface RecommendationEvidence {
  available: boolean;
  schools_improved?: number;
  avg_improvement?: number;
  examples?: {
    escola: string;
    antes: number;
    depois: number;
    melhoria: number;
  }[];
  insight?: string;
}

export interface Recommendation {
  area: string;
  area_name: string;
  priority: number;
  current_score: number;
  target_score: number;
  expected_gain: number;
  difficulty: 'low' | 'medium' | 'high';
  gap_to_mean: number;
  evidence: RecommendationEvidence;
  action_items: string[];
}

export interface SuccessStory {
  codigo_inep: string;
  nome_escola: string;
  similarity_score: number;
  improvement: number;
  area_changes: Record<string, {
    before: number;
    after: number;
    change: number;
  }>;
  tipo_escola: string | null;
  porte: number | null;
}

export interface RecommendationResult {
  codigo_inep: string;
  school_info: {
    codigo_inep: string;
    nome_escola: string;
    porte: number | null;
    tipo_escola: string | null;
    localizacao: string | null;
    ano: number;
  };
  all_recommendations: Recommendation[];
  high_priority_recommendations: Recommendation[];
  quick_wins: Recommendation[];
  long_term_priorities: Recommendation[];
  success_stories: SuccessStory[];
  summary: {
    total_recommendations: number;
    high_priority_count: number;
    quick_wins_count: number;
    success_stories_count: number;
  };
}

export interface RoadmapPhase {
  phase: number;
  name: string;
  description: string;
  focus_areas: string[];
  expected_gain: number;
  action_items: string[];
}

export interface RoadmapResult {
  codigo_inep: string;
  school_info: {
    codigo_inep: string;
    nome_escola: string;
    porte: number | null;
    tipo_escola: string | null;
    localizacao: string | null;
    ano: number;
  };
  current_position: {
    nota_media_estimada: number;
    areas_criticas: number;
    areas_excelentes: number;
  };
  target_position: {
    nota_media_alvo: number;
    melhoria_esperada: number;
  };
  phases: RoadmapPhase[];
  total_phases: number;
  success_stories: SuccessStory[];
}

export interface OraclePrediction {
  rank: number;
  area: string;
  area_codigo?: string;
  tema: string;
  habilidades: string[];
  habilidades_matriz?: Array<{
    codigo: string;
    habilidade: string;
    descricao: string;
    competencia: number;
    competencia_descricao: string;
    relevancia?: number;
  }>;
  objetos_conhecimento?: Array<{
    tema: string;
    sub_area?: string;
    descricao?: string;
    conteudos: string[];
    relevancia: number;
  }>;
  eixos_cognitivos?: Array<{
    codigo: string;
    nome: string;
    descricao: string;
    relevancia: number;
  }>;
  probabilidade: number;
  tipo: string;
  justificativa: string;
  base_cientifica?: {
    questoes_historicas: number;
    total_area: number;
    frequencia_percentual: number;
    tri_medio: number;
    habilidades_historicas: string[];
    fonte: string;
  };
  exemplos_questoes?: string[];
}

export interface OracleResponse {
  total: number;
  ano_predicao: number;
  gerado_em: string;
  modelo: string;
  versao: string;
  predicoes: OraclePrediction[];
  metodologia?: {
    descricao: string;
    fonte_dados: string;
    transparencia: string;
    limitacoes: string[];
  };
}

// Diagnosis Comparison Types
export interface DiagnosisComparisonArea {
  area: string;
  area_name: string;
  school_1_score: number;
  school_2_score: number;
  difference: number;
  school_1_status: 'excellent' | 'good' | 'needs_attention' | 'critical';
  school_2_status: 'excellent' | 'good' | 'needs_attention' | 'critical';
}

export interface DiagnosisComparisonResult {
  school_1: {
    codigo_inep: string;
    info: {
      codigo_inep: string;
      nome_escola: string;
      porte: number | null;
      tipo_escola: string | null;
      localizacao: string | null;
      ano: number;
    };
    overall_health: 'excellent' | 'good' | 'needs_attention' | 'critical';
  };
  school_2: {
    codigo_inep: string;
    info: {
      codigo_inep: string;
      nome_escola: string;
      porte: number | null;
      tipo_escola: string | null;
      localizacao: string | null;
      ano: number;
    };
    overall_health: 'excellent' | 'good' | 'needs_attention' | 'critical';
  };
  area_comparison: DiagnosisComparisonArea[];
  winner_by_area: Record<string, string>;
}

// TRI Analysis Types
export interface TRIContentSample {
  skill: string;
  tri_score: number;
  description: string;
  gap?: number;
}

export interface TRIAreaAnalysis {
  area: string;
  area_name: string;
  color: string;
  current_score: number;
  raw_score: number;
  display_score: number;
  predicted_score: number;
  raw_expected_change: number;
  display_expected_change: number;
  expected_change: number;
  confidence_interval: PredictionInterval;
  raw_confidence_interval: PredictionInterval;
  display_mode: 'delta' | 'range';
  regime: 'elite_consistent' | 'regular' | 'sparse';
  risk_level: 'normal' | 'conservative' | 'outlier';
  risk_reason?: string | null;
  badge_text?: string | null;
  historical_corridor?: PredictionInterval;
  model_info: Record<string, unknown>;
  tri_mastery_level: number;
  tri_gap_to_median: number;
  tri_potential: number;
  skill_gap_national: number;
  weak_skill_count: number;
  accessible_content_sample: TRIContentSample[];
  stretch_content_sample: TRIContentSample[];
  content_based_estimate: number;
}

export interface TRIAnalysisResult {
  codigo_inep: string;
  overall_tri_mastery: number;
  total_weak_skills: number;
  area_analysis: TRIAreaAnalysis[];
  insights: {
    mastery_interpretation: string;
    recommendation: string;
  };
}

// TRI Area Projection Types
export interface TRIHistoricalScore {
  ano: number;
  score: number;
  ranking: number | null;
}

export interface TRIProjectionInsight {
  type: 'positive' | 'warning' | 'neutral' | 'info';
  title: string;
  message: string;
}

export interface TRIAreaProjection {
  codigo_inep: string;
  area: string;
  area_name: string;
  color: string;
  current_year: number;
  current_score: number;
  historical_analysis: {
    total_years: number;
    scores: TRIHistoricalScore[];
    trend: {
      direction: 'ascending' | 'descending' | 'stable' | 'insufficient_data';
      annual_change: number;
      strength: number;
      r_squared: number;
    };
    statistics: {
      mean: number;
      std: number;
      min: number;
      max: number;
      avg_improvement: number;
      max_improvement: number;
    };
  };
  stretch_content: {
    total_items: number;
    items: {
      skill: string;
      tri_score: number;
      description: string;
      gap: number;
    }[];
    tri_range: {
      min: number;
      max: number;
    };
  };
  projection: {
    target_year: number;
    scenarios: {
      trend_based: number;
      conservative: number;
      realistic: number;
      optimistic: number;
    };
    recommended: number;
    confidence_interval: {
      low: number;
      high: number;
    };
    potential_gain: number;
  };
  official_prediction: {
    target_year: number;
    current_score: number;
    raw_score: number;
    display_score: number;
    confidence_interval: PredictionInterval;
    raw_confidence_interval: PredictionInterval;
    display_mode: 'delta' | 'range';
    regime: 'elite_consistent' | 'regular' | 'sparse';
    risk_level: 'normal' | 'conservative' | 'outlier';
    risk_reason?: string | null;
    badge_text?: string | null;
    historical_corridor: PredictionInterval;
    raw_expected_change: number;
    display_expected_change: number;
    model_info: Record<string, unknown>;
  };
  insights: TRIProjectionInsight[];
}

export interface SchoolHistory {
  codigo_inep: string;
  nome_escola: string;
  uf: string | null;
  tipo_escola: string | null;
  anos_participacao: number;
  history: {
    ano: number;
    ranking_brasil: number | null;
    ranking_uf: number | null;
    ranking_change: number | null;
    nota_media: number | null;
    nota_change: number | null;
    nota_cn: number | null;
    nota_ch: number | null;
    nota_lc: number | null;
    nota_mt: number | null;
    nota_redacao: number | null;
    desempenho_habilidades: number | null;
    competencia_redacao_media: number | null;
  }[];
}

// Helper to get session with retry - handles Supabase cold start
async function getSessionWithRetry(maxAttempts = 2): Promise<string | null> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const timeoutMs = attempt === 1 ? 8000 : 5000; // Longer first attempt for cold start

      const sessionPromise = supabase.auth.getSession();
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Session timeout')), timeoutMs)
      );
      const { data: { session } } = await Promise.race([sessionPromise, timeoutPromise]);

      if (session?.access_token) {
        return session.access_token;
      }
      return null;
    } catch {
      if (attempt < maxAttempts) {
        continue;
      }
    }
  }
  return null;
}

async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const token = await getSessionWithRetry();

  if (!token) {
    throw new Error('Não foi possível obter sessão. Tente recarregar a página.');
  }

  const headers: HeadersInit = {
    ...options?.headers,
    'Authorization': `Bearer ${token}`,
  };

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      await supabase.auth.signOut();
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      throw new Error('Sessão expirada');
    }

    if (!response.ok) {
      let errorMessage = `Erro: ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData.detail) {
          errorMessage = errorData.detail;
        }
      } catch {
        // Ignore JSON parse errors
      }
      throw new Error(errorMessage);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json();
  } catch (error) {
    if (error instanceof Error && error.message.includes('fetch')) {
      throw new Error('Erro de conexão. Verifique sua internet.');
    }
    throw error;
  }
}

async function downloadAuthenticatedFile(endpoint: string): Promise<void> {
  const token = await getSessionWithRetry();

  if (!token) {
    throw new Error('Não foi possível obter sessão. Tente recarregar a página.');
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.status === 401) {
    await supabase.auth.signOut();
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    throw new Error('Sessão expirada');
  }

  if (!response.ok) {
    let errorMessage = `Erro: ${response.status}`;
    try {
      const errorData = await response.json();
      if (errorData.detail) {
        errorMessage = errorData.detail;
      }
    } catch {
      // Ignore JSON parse errors for file responses.
    }
    throw new Error(errorMessage);
  }

  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition');
  const filenameMatch = disposition?.match(/filename="?([^"]+)"?/i);
  const filename = filenameMatch?.[1] || 'download.csv';

  const downloadUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(downloadUrl);
}

export const api = {
  getStats: () => fetchAPI<Stats>('/api/stats'),

  getTopSchools: (limit = 10, ano?: number, uf?: string) => {
    const params = new URLSearchParams({ limit: limit.toString() });
    if (ano) params.set('ano', ano.toString());
    if (uf) params.set('uf', uf);
    return fetchAPI<{ ano: number; total: number; schools: TopSchool[] }>(
      `/api/schools/top?${params}`
    );
  },

  searchSchools: (q: string, limit = 20) =>
    fetchAPI<{ codigo_inep: string; nome_escola: string; uf: string | null; ultimo_ano: number }[]>(
      `/api/schools/search?q=${encodeURIComponent(q)}&limit=${limit}`
    ),

  getSchool: (codigo_inep: string) =>
    fetchAPI<SchoolDetail>(`/api/schools/${codigo_inep}`),

  getSchoolHistory: (codigo_inep: string) =>
    fetchAPI<SchoolHistory>(`/api/schools/${codigo_inep}/history`),

  listSchools: (params: {
    page?: number;
    limit?: number;
    search?: string;
    uf?: string;
    tipo_escola?: 'Privada' | 'Pública';
    localizacao?: 'Urbana' | 'Rural';
    porte?: number;
    ano?: number;
    order_by?: 'ranking' | 'nota' | 'nome';
    order?: 'asc' | 'desc';
  }) => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.set(key, value.toString());
      }
    });
    return fetchAPI<SchoolSummary[]>(`/api/schools/?${searchParams}`);
  },

  compareSchools: (inep1: string, inep2: string) =>
    fetchAPI<{
      escola1: { codigo_inep: string; nome_escola: string; uf: string | null };
      escola2: { codigo_inep: string; nome_escola: string; uf: string | null };
      common_years: number[];
      comparison: {
        ano: number;
        escola1: { nota_media: number | null; ranking: number | null };
        escola2: { nota_media: number | null; ranking: number | null };
      }[];
    }>(`/api/schools/compare/${inep1}/${inep2}`),

  getWorstSkills: (area?: string, limit = 10) => {
    const params = new URLSearchParams({ limit: limit.toString() });
    if (area) params.set('area', area);
    return fetchAPI<{
      ano: number;
      skills_by_area: Record<string, { skill_num: number; performance: number; descricao: string }[]>;
    }>(`/api/schools/skills/worst?${params}`);
  },

  getAllSkills: (area?: string) => {
    const params = new URLSearchParams();
    if (area) params.set('area', area);
    return fetchAPI<{
      ano: number;
      total: number;
      skills: { area: string; skill_num: number; performance: number; descricao: string }[];
    }>(`/api/schools/skills/all?${params}`);
  },

  getSchoolSkills: (codigo_inep: string, limit = 10) =>
    fetchAPI<{
      codigo_inep: string;
      ano: number;
      total_skills: number;
      worst_overall: {
        area: string;
        skill_num: number;
        performance: number;
        national_avg: number | null;
        diff: number | null;
        descricao: string;
        status: 'above' | 'below' | 'equal';
      }[];
      by_area: Record<string, {
        skill_num: number;
        performance: number;
        national_avg: number | null;
        diff: number | null;
        descricao: string;
        status: 'above' | 'below' | 'equal';
      }[]>;
    }>(`/api/schools/${codigo_inep}/skills?limit=${limit}`),

  // ML APIs - Predictions
  getPredictions: (codigo_inep: string, target_year?: number) => {
    const params = new URLSearchParams();
    if (typeof target_year === 'number') params.set('target_year', String(target_year));
    const query = params.toString();
    return fetchAPI<PredictionResult>(`/api/predictions/${codigo_inep}${query ? `?${query}` : ''}`);
  },

  getPredictionComparison: (codigo_inep: string) =>
    fetchAPI<PredictionComparison>(`/api/predictions/comparison/${codigo_inep}`),

  getTRIAnalysis: (codigo_inep: string) =>
    fetchAPI<TRIAnalysisResult>(`/api/predictions/${codigo_inep}/tri-analysis`),

  getAreaProjection: (codigo_inep: string, area: string) =>
    fetchAPI<TRIAreaProjection>(`/api/predictions/${codigo_inep}/area-projection/${area}`),

  getOraclePredictions: (filters?: { area?: string; tipo?: string; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (filters?.area) searchParams.set('area', filters.area);
    if (filters?.tipo) searchParams.set('tipo', filters.tipo);
    if (typeof filters?.limit === 'number') searchParams.set('limit', String(filters.limit));
    const query = searchParams.toString();
    return fetchAPI<OracleResponse>(`/api/oracle/predictions${query ? `?${query}` : ''}`);
  },

  // ML APIs - Diagnosis
  getDiagnosis: (codigo_inep: string) =>
    fetchAPI<DiagnosisResult>(`/api/diagnosis/${codigo_inep}`),

  getAreaDiagnosis: (codigo_inep: string, area: string) =>
    fetchAPI<{
      codigo_inep: string;
      area: string;
      area_name: string;
      analysis: AreaAnalysis;
      skill_gaps: DiagnosisResult['skill_gaps'];
      peer_comparison: DiagnosisResult['peer_comparison'];
    }>(`/api/diagnosis/${codigo_inep}/area/${area}`),

  getImprovementPotential: (codigo_inep: string) =>
    fetchAPI<{
      codigo_inep: string;
      improvements: {
        area: string;
        area_name: string;
        current_score: number;
        peer_avg: number;
        potential_gain: number;
        effort_level: 'high' | 'medium';
      }[];
      total_potential_gain: number;
      priority_area: string | null;
    }>(`/api/diagnosis/${codigo_inep}/improvement-potential`),

  compareDiagnosis: (inep1: string, inep2: string) =>
    fetchAPI<DiagnosisComparisonResult>(`/api/diagnosis/compare/${inep1}/${inep2}`),

  // ML APIs - Clustering
  getSchoolCluster: (codigo_inep: string) =>
    fetchAPI<ClusterResult>(`/api/clusters/${codigo_inep}/cluster`),

  getSimilarSchools: (codigo_inep: string, limit = 10, same_cluster = true) =>
    fetchAPI<{
      codigo_inep: string;
      school_cluster: ClusterResult;
      similar_schools: SimilarSchool[];
    }>(`/api/clusters/${codigo_inep}/similar?limit=${limit}&same_cluster=${same_cluster}`),

  getSimilarImprovedSchools: (codigo_inep: string, limit = 10, min_improvement = 10) =>
    fetchAPI<{
      codigo_inep: string;
      school_cluster: ClusterResult;
      improved_similar_schools: {
        codigo_inep: string;
        nome_escola: string;
        similarity_distance: number;
        improvement: number;
        comparison_years: {
          previous: number | null;
          current: number;
        };
        scores_previous: Record<string, number>;
        scores_current: Record<string, number>;
        tipo_escola: string | null;
        porte: number | null;
      }[];
      insight: string;
    }>(`/api/clusters/${codigo_inep}/similar-improved?limit=${limit}&min_improvement=${min_improvement}`),

  getClusterPersonas: () =>
    fetchAPI<{
      personas: {
        cluster: number;
        persona: ClusterPersona;
        center_scores: Record<string, number>;
        avg_media: number;
      }[];
    }>('/api/clusters/personas'),

  // ML APIs - Recommendations
  getRecommendations: (codigo_inep: string) =>
    fetchAPI<RecommendationResult>(`/api/recommendations/${codigo_inep}`),

  getRoadmap: (codigo_inep: string) =>
    fetchAPI<RoadmapResult>(`/api/recommendations/${codigo_inep}/roadmap`),

  getSuccessStories: (codigo_inep: string, limit = 10) =>
    fetchAPI<{
      codigo_inep: string;
      school_info: RecommendationResult['school_info'];
      success_stories: (SuccessStory & {
        highlight_area: string | null;
        highlight_area_name: string | null;
        highlight_improvement: number;
        key_insight: string | null;
      })[];
      total_found: number;
      insight: string;
    }>(`/api/recommendations/${codigo_inep}/success-stories?limit=${limit}`),

  getQuickWins: (codigo_inep: string, limit = 5) =>
    fetchAPI<{
      codigo_inep: string;
      school_info: RecommendationResult['school_info'];
      quick_wins: Recommendation[];
      total_available: number;
      recommendation: string;
    }>(`/api/recommendations/${codigo_inep}/quick-wins?limit=${limit}`),

  getActionPlan: (codigo_inep: string) =>
    fetchAPI<{
      codigo_inep: string;
      school_info: RecommendationResult['school_info'];
      action_plan: {
        immediate_actions: string[];
        short_term_goals: string[];
        long_term_objectives: string[];
      };
      expected_improvement: number;
      phases_count: number;
      success_stories_count: number;
    }>(`/api/recommendations/${codigo_inep}/action-plan`),

  // TRI Lists APIs
  getTriAreas: () =>
    fetchAPI<{
      areas: {
        code: string;
        name: string;
        total_content: number;
        tri_min: number | null;
        tri_max: number | null;
        ranges: Record<string, number>;
      }[];
      total_content: number;
    }>('/api/tri-lists/areas'),

  getTriRanges: () =>
    fetchAPI<{
      ranges: {
        code: string;
        min: number;
        max: number;
        label: string;
        description: string;
      }[];
    }>('/api/tri-lists/ranges'),

  getTriContent: (area: string, params?: { tri_range?: string; habilidade?: string; limit?: number; offset?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.tri_range) searchParams.set('tri_range', params.tri_range);
    if (params?.habilidade) searchParams.set('habilidade', params.habilidade);
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.offset) searchParams.set('offset', params.offset.toString());
    const query = searchParams.toString();
    return fetchAPI<{
      area: string;
      area_name: string;
      tri_range: string | null;
      total: number;
      offset: number;
      limit: number;
      items: {
        habilidade: string;
        descricao: string;
        tri_score: number;
        tri_range: string;
      }[];
    }>(`/api/tri-lists/content/${area}${query ? `?${query}` : ''}`);
  },

  getTriRecommendations: (codigo_inep: string) =>
    fetchAPI<{
      codigo_inep: string;
      recommendations: {
        area: string;
        area_name: string;
        predicted_score: number;
        recommended_range: string;
        range_info: {
          min: number;
          max: number;
          label: string;
          description: string;
        };
        content_count: number;
        sample_content: {
          habilidade: string;
          descricao: string;
          tri_score: number;
        }[];
        stretch_goals: {
          habilidade: string;
          descricao: string;
          tri_score: number;
        }[];
      }[];
      download_available: boolean;
      download_url: string;
    }>(`/api/tri-lists/recommend/${codigo_inep}`),

  getTriMaterials: () =>
    fetchAPI<{
      materials: {
        area: string;
        area_name: string;
        tri_range: string;
        filename: string;
        format: string;
        size_kb: number;
        download_url: string;
      }[];
      total: number;
      brand: string;
    }>('/api/tri-lists/download/materials'),

  getTriSkills: (area: string) =>
    fetchAPI<{
      area: string;
      area_name: string;
      total_skills: number;
      skills: {
        code: string;
        content_count: number;
        tri_min: number;
        tri_max: number;
        tri_avg: number;
        ranges: Record<string, number>;
      }[];
    }>(`/api/tri-lists/skills/${area}`),

  // TRI Materials filtered by school's TRI range
  getSchoolMaterials: (codigo_inep: string) =>
    fetchAPI<{
      codigo_inep: string;
      escola: { nome?: string };
      materials_by_area: Record<string, {
        area_name: string;
        predicted_score: number;
        recommended_range: string;
        amplitude: {
          min: number;
          max: number;
          label: string;
          description: string;
        };
        materials: {
          filename: string;
          tri_range: string;
          format: string;
          size_kb: number;
          download_url: string;
        }[];
        total_files: number;
      }>;
      total_materials: number;
    }>(`/api/tri-lists/download/escola/${codigo_inep}`),

  // Export improvement plan as CSV
  getExportPlanUrl: (codigo_inep: string) =>
    `${API_BASE}/api/tri-lists/export/plano/${codigo_inep}`,

  downloadExportPlan: (codigo_inep: string) =>
    downloadAuthenticatedFile(`/api/tri-lists/export/plano/${codigo_inep}`),

  // GLiNER Enhanced Insights
  getGlinerConceptAnalysis: (codigo_inep: string, topN?: number) =>
    fetchAPI<{
      codigo_inep: string;
      area_analyses: {
        area: string;
        area_name: string;
        color: string;
        predicted_score: number;
        total_content_items: number;
        unique_concepts: number;
        unique_semantic_fields: number;
        unique_lexical_fields: number;
        top_concepts: {
          concept: string;
          count: number;
          frequency: number;
          confidence: number;
          semantic_fields: string[];
          lexical_fields: string[];
          related_skills: string[];
          importance: 'high' | 'medium' | 'low';
        }[];
        semantic_fields: { field: string; count: number }[];
        lexical_fields: { field: string; count: number }[];
        processes_phenomena: { process: string; count: number }[];
        historical_contexts: { context: string; count: number }[];
        compound_skills: { skill: string; count: number }[];
      }[];
      priority_concepts: {
        concept: string;
        area: string;
        area_name: string;
        frequency: number;
      }[];
      entity_definitions: Record<string, string>;
      summary: {
        total_areas: number;
        total_unique_concepts: number;
        total_semantic_fields: number;
        total_lexical_fields: number;
      };
    }>(`/api/gliner/school/${codigo_inep}/concepts${topN ? `?top_n=${topN}` : ''}`),

  getGlinerKnowledgeGraph: (codigo_inep: string, area?: string) =>
    fetchAPI<{
      codigo_inep: string;
      area: string | null;
      nodes: {
        id: string;
        label: string;
        type: 'conceito_cientifico' | 'campo_semantico' | 'campo_lexical';
        size: number;
        color: string;
        count: number;
        area?: string;
        area_name?: string;
        area_distribution?: Record<string, number>;
        is_interdisciplinary?: boolean;
      }[];
      edges: {
        source: string;
        target: string;
        weight: number;
        type: string;
        similarity?: number;
        match_type?: string;
        via?: string;
      }[];
      stats: {
        total_nodes: number;
        total_edges: number;
        concept_nodes: number;
        semantic_nodes: number;
        lexical_nodes: number;
        interdisciplinary_edges?: number;
        similarity_edges?: number;
      };
      similarity_audit?: {
        exact_duplicates: number;
        similar_labels: number;
        suggested_connections: number;
        total_similarity_edges: number;
        details: {
          duplicates: Array<{
            node1_id: string;
            node2_id: string;
            label1: string;
            label2: string;
            area1: string;
            area2: string;
            similarity: number;
            is_cross_area: boolean;
            match_type: string;
          }>;
          similar: Array<{
            node1_id: string;
            node2_id: string;
            label1: string;
            label2: string;
            area1: string;
            area2: string;
            similarity: number;
            is_cross_area: boolean;
            match_type: string;
          }>;
          suggested: Array<{
            node1_id: string;
            node2_id: string;
            label1: string;
            label2: string;
            area1: string;
            area2: string;
            similarity: number;
            is_cross_area: boolean;
            match_type: string;
          }>;
        };
      };
    }>(`/api/gliner/school/${codigo_inep}/knowledge-graph${area ? `?area=${area}` : ''}`),

  getGlinerStudyFocus: (codigo_inep: string) =>
    fetchAPI<{
      codigo_inep: string;
      focus_areas: {
        area: string;
        area_name: string;
        color: string;
        current_score: number;
        target_range: [number, number];
        level: string;
        study_sequence: {
          concept: string;
          frequency: number;
          avg_difficulty: number;
          semantic_fields: string[];
          lexical_fields: string[];
          related_processes: string[];
          priority: 'high' | 'medium' | 'low';
          estimated_impact: number;
        }[];
        total_concepts: number;
        estimated_total_impact: number;
      }[];
      total_estimated_improvement: number;
      study_plan: {
        phase_1: { name: string; description: string; concepts_count: number };
        phase_2: { name: string; description: string; concepts_count: number };
        phase_3: { name: string; description: string; concepts_count: number };
      };
    }>(`/api/gliner/school/${codigo_inep}/study-focus`),

  getGlinerTrendingConcepts: (area?: string, limit?: number) =>
    fetchAPI<{
      area: string | null;
      trending_concepts: {
        concept: string;
        total_count: number;
        avg_tri_score: number;
        areas: { area: string; area_name: string; count: number }[];
        primary_area: string | null;
        difficulty: 'hard' | 'medium' | 'easy';
      }[];
      total_unique_concepts: number;
      summary_by_area: Record<string, { name: string; unique_concepts: number }>;
    }>(`/api/gliner/global/trending-concepts${area || limit ? `?${area ? `area=${area}` : ''}${limit ? `&limit=${limit}` : ''}` : ''}`),

  // Admin APIs
  listUsers: (skip = 0, limit = 100) =>
    fetchAPI<User[]>(`/api/admin/users?skip=${skip}&limit=${limit}`),

  getUser: (userId: string) =>
    fetchAPI<User>(`/api/admin/users/${userId}`),

  createUser: (data: { codigo_inep: string; nome_escola: string; email: string; password: string; is_admin?: boolean }) =>
    fetchAPI<User>('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  updateUser: (userId: string, data: { nome_escola?: string; is_active?: boolean; is_admin?: boolean; password?: string }) =>
    fetchAPI<User>(`/api/admin/users/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  deleteUser: (userId: string) =>
    fetchAPI<void>(`/api/admin/users/${userId}`, {
      method: 'DELETE',
    }),

  getAdminStats: () =>
    fetchAPI<{ total_users: number; active_users: number; inactive_users: number; admin_users: number }>('/api/admin/stats'),
};
