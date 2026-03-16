'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { getLatestEnemYear, getNextEnemYear, getYearRangeLabel } from '@/lib/enem-cycle';
import { formatNumber, formatTriScore } from '@/lib/utils';
import Link from 'next/link';
import { 
  Trophy, School, Calendar, MapPin, Bell, Sparkles, 
  TrendingUp, Medal, Award, Target, BookOpen,
  ArrowRight, Star, Zap
} from 'lucide-react';

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['stats'],
    queryFn: api.getStats,
  });

  const { data: topSchools, isLoading: topLoading } = useQuery({
    queryKey: ['topSchools'],
    queryFn: () => api.getTopSchools(10),
  });

  if (statsLoading || topLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600"></div>
          <p className="text-slate-500 font-medium">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  const today = new Date();
  const dateStr = today.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  const latestDataYear = getLatestEnemYear(stats?.years);
  const nextEnemYear = getNextEnemYear(stats?.years);
  const yearRangeLabel = getYearRangeLabel(stats?.years);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Page Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Dashboard ENEM</h1>
              <p className="text-sm text-slate-500 capitalize mt-0.5">{dateStr}</p>
            </div>
            <div className="flex items-center gap-3">
              <button className="p-2.5 hover:bg-slate-100 rounded-xl transition-all duration-200 relative">
                <Bell className="h-5 w-5 text-slate-600" />
                <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-red-500 rounded-full"></span>
              </button>
              <div className="h-10 w-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-full flex items-center justify-center text-white text-sm font-semibold shadow-lg shadow-blue-200">
                AD
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
        {/* Upcoming ENEM Cycle Banner */}
        <div className="relative overflow-hidden rounded-2xl p-6 text-white" style={{ background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 50%, #0ea5e9 100%)' }}>
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-5">
              <div className="p-4 rounded-2xl bg-white/20 backdrop-blur-sm">
                <Sparkles className="h-8 w-8" />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold">ENEM {nextEnemYear || 'Próximo Ciclo'} - Em Breve!</h2>
                  <span className="px-3 py-1 rounded-full bg-white/20 text-xs font-semibold backdrop-blur-sm">
                    Próximo ciclo
                  </span>
                </div>
                <p className="text-white/90 text-sm mt-1.5 max-w-xl">
                  {latestDataYear
                    ? `Os dados reais de ${nextEnemYear} serão integrados assim que divulgados pelo INEP. A base atual vai até ${latestDataYear}.`
                    : 'Os próximos dados do ENEM serão integrados assim que divulgados pelo INEP.'}{' '}
                  Prepare-se para novas análises e predições.
                </p>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-4">
              <div className="flex -space-x-2">
                <div className="w-10 h-10 rounded-full bg-yellow-400 flex items-center justify-center text-yellow-900 font-bold text-lg">🥇</div>
                <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center text-gray-700 font-bold text-lg">🥈</div>
                <div className="w-10 h-10 rounded-full bg-orange-400 flex items-center justify-center text-orange-900 font-bold text-lg">🥉</div>
              </div>
            </div>
          </div>
          <div className="absolute -right-20 -top-20 w-60 h-60 bg-white/10 rounded-full blur-3xl"></div>
          <div className="absolute -left-20 -bottom-20 w-48 h-48 bg-white/10 rounded-full blur-2xl"></div>
        </div>

        {/* Stats Cards - Novo Design */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          <StatCard
            icon={School}
            label="Total de Escolas"
            value={stats?.total_schools.toLocaleString('pt-BR') || '-'}
            subtitle="Cadastradas no sistema"
            trend="+5.2%"
            trendUp={true}
            color="blue"
          />
          <StatCard
            icon={Calendar}
            label="Anos de Dados"
            value={`${stats?.years.length || 0}`}
            subtitle={yearRangeLabel}
            trend="Completo"
            trendUp={true}
            color="emerald"
          />
          <StatCard
            icon={Trophy}
            label="Total de Registros"
            value={stats?.total_records.toLocaleString('pt-BR') || '-'}
            subtitle="Notas analisadas"
            trend="+12%"
            trendUp={true}
            color="amber"
          />
          <StatCard
            icon={MapPin}
            label="Cobertura"
            value={`${stats?.states.length || 0}`}
            subtitle="Estados + DF"
            trend="100%"
            trendUp={true}
            color="violet"
          />
        </div>

        {/* Average Scores - Cards Interativos */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-100 rounded-xl">
                <Target className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Médias Nacionais</h2>
                <p className="text-sm text-slate-500">Desempenho médio por área do conhecimento</p>
              </div>
            </div>
            <span className="text-sm text-slate-400">Baseado em {stats?.total_records.toLocaleString('pt-BR')} registros</span>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { 
                label: 'Ciências da Natureza', 
                shortLabel: 'Natureza',
                value: stats?.avg_scores.nota_cn, 
                icon: '🧬',
                gradient: 'from-emerald-500 to-teal-600',
                bgColor: 'bg-emerald-50',
                textColor: 'text-emerald-700'
              },
              { 
                label: 'Ciências Humanas', 
                shortLabel: 'Humanas',
                value: stats?.avg_scores.nota_ch, 
                icon: '📚',
                gradient: 'from-blue-500 to-indigo-600',
                bgColor: 'bg-blue-50',
                textColor: 'text-blue-700'
              },
              { 
                label: 'Linguagens', 
                shortLabel: 'Linguagens',
                value: stats?.avg_scores.nota_lc, 
                icon: '✍️',
                gradient: 'from-violet-500 to-purple-600',
                bgColor: 'bg-violet-50',
                textColor: 'text-violet-700'
              },
              { 
                label: 'Matemática', 
                shortLabel: 'Matemática',
                value: stats?.avg_scores.nota_mt, 
                icon: '📐',
                gradient: 'from-orange-500 to-amber-600',
                bgColor: 'bg-orange-50',
                textColor: 'text-orange-700'
              },
              { 
                label: 'Redação', 
                shortLabel: 'Redação',
                value: stats?.avg_scores.nota_redacao, 
                icon: '📝',
                gradient: 'from-rose-500 to-pink-600',
                bgColor: 'bg-rose-50',
                textColor: 'text-rose-700'
              },
            ].map((item) => (
              <div 
                key={item.label} 
                className="group relative overflow-hidden rounded-2xl p-5 bg-white border border-slate-100 hover:border-slate-200 hover:shadow-lg transition-all duration-300 cursor-pointer"
              >
                <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${item.gradient}`}></div>
                <div className="flex items-start justify-between mb-3">
                  <span className="text-2xl">{item.icon}</span>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${item.bgColor} ${item.textColor}`}>
                    Média
                  </span>
                </div>
                <p className="text-sm font-medium text-slate-600 mb-1">{item.shortLabel}</p>
                <p className="text-3xl font-bold text-slate-900">{formatTriScore(item.value)}</p>
                <p className="text-xs text-slate-400 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  {item.label}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Top Schools - Tabela Premium */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-100 rounded-xl">
                  <Medal className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Top 10 Escolas</h2>
                  <p className="text-sm text-slate-500">Melhores desempenhos ENEM {topSchools?.ano}</p>
                </div>
              </div>
              <Link
                href="/schools"
                className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-xl font-medium hover:bg-blue-100 transition-colors group"
              >
                Ver ranking completo
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50/80">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-24">
                    Posição
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Escola
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider w-20">
                    UF
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider w-28">
                    Tipo
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider w-28">
                    Média
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider w-24">
                    Hab.
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider w-24 hidden lg:table-cell">
                    CN
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider w-24 hidden lg:table-cell">
                    CH
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider w-24 hidden lg:table-cell">
                    LC
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider w-24 hidden lg:table-cell">
                    MT
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider w-24 hidden xl:table-cell">
                    RED
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {topSchools?.schools.map((school, index) => (
                  <tr
                    key={school.codigo_inep}
                    className="group hover:bg-blue-50/30 transition-all duration-200"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <RankingBadge ranking={school.ranking} index={index} />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <SchoolAvatar name={school.nome_escola} ranking={school.ranking} />
                        <div>
                          <Link
                            href={`/schools/${school.codigo_inep}`}
                            className="font-semibold text-slate-900 hover:text-blue-600 transition-colors line-clamp-1"
                          >
                            {school.nome_escola}
                          </Link>
                          <p className="text-xs text-slate-400 font-mono">{school.codigo_inep}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold">
                        {school.uf}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {school.tipo_escola && (
                        <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold ${
                          school.tipo_escola === 'Privada'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          {school.tipo_escola}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="text-lg font-bold text-slate-900">{formatTriScore(school.nota_media)}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="text-sm font-medium text-slate-600">
                        {school.desempenho_habilidades
                          ? `${(school.desempenho_habilidades * 100).toFixed(0)}%`
                          : '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-slate-600 hidden lg:table-cell">
                      {formatTriScore(school.nota_cn)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-slate-600 hidden lg:table-cell">
                      {formatTriScore(school.nota_ch)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-slate-600 hidden lg:table-cell">
                      {formatTriScore(school.nota_lc)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-slate-600 hidden lg:table-cell">
                      {formatTriScore(school.nota_mt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-slate-600 hidden xl:table-cell">
                      {formatTriScore(school.nota_redacao)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// Componente de Card de Estatística Melhorado
function StatCard({
  icon: Icon,
  label,
  value,
  subtitle,
  trend,
  trendUp,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  subtitle: string;
  trend: string;
  trendUp: boolean;
  color: 'blue' | 'emerald' | 'amber' | 'violet';
}) {
  const colors = {
    blue: {
      gradient: 'from-blue-500 to-blue-600',
      bg: 'bg-blue-50',
      text: 'text-blue-700',
      light: 'bg-blue-500/10',
    },
    emerald: {
      gradient: 'from-emerald-500 to-emerald-600',
      bg: 'bg-emerald-50',
      text: 'text-emerald-700',
      light: 'bg-emerald-500/10',
    },
    amber: {
      gradient: 'from-amber-500 to-amber-600',
      bg: 'bg-amber-50',
      text: 'text-amber-700',
      light: 'bg-amber-500/10',
    },
    violet: {
      gradient: 'from-violet-500 to-violet-600',
      bg: 'bg-violet-50',
      text: 'text-violet-700',
      light: 'bg-violet-500/10',
    },
  };

  const theme = colors[color];

  return (
    <div className="group bg-white rounded-2xl p-6 border border-slate-100 hover:border-slate-200 hover:shadow-xl hover:shadow-slate-200/50 hover:-translate-y-1 transition-all duration-300">
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3.5 rounded-xl ${theme.bg} group-hover:scale-110 transition-transform duration-300`}>
          <Icon className={`h-6 w-6 ${theme.text}`} />
        </div>
        <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
          trendUp ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
        }`}>
          <TrendingUp className="h-3 w-3" />
          {trend}
        </div>
      </div>
      
      <div>
        <p className="text-3xl font-bold text-slate-900 mb-1">{value}</p>
        <p className="text-sm font-medium text-slate-700 mb-0.5">{label}</p>
        <p className="text-xs text-slate-400">{subtitle}</p>
      </div>
      
      <div className={`mt-4 h-1.5 w-full rounded-full ${theme.light} overflow-hidden`}>
        <div className={`h-full rounded-full bg-gradient-to-r ${theme.gradient} w-3/4 group-hover:w-full transition-all duration-500`}></div>
      </div>
    </div>
  );
}

// Badge de Ranking com Medalhas
function RankingBadge({ ranking, index }: { ranking: number; index: number }) {
  if (ranking === 1) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-3xl">🥇</span>
        <span className="text-lg font-bold text-amber-600">#{ranking}</span>
      </div>
    );
  }
  if (ranking === 2) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-3xl">🥈</span>
        <span className="text-lg font-bold text-slate-600">#{ranking}</span>
      </div>
    );
  }
  if (ranking === 3) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-3xl">🥉</span>
        <span className="text-lg font-bold text-orange-600">#{ranking}</span>
      </div>
    );
  }
  
  return (
    <span className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-slate-100 text-slate-600 text-lg font-bold">
      #{ranking}
    </span>
  );
}

// Avatar da Escola com Iniciais
function SchoolAvatar({ name, ranking }: { name: string; ranking: number }) {
  const getInitials = (name: string) => {
    const words = name.split(' ').filter(w => w.length > 2);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const getGradient = (ranking: number) => {
    if (ranking === 1) return 'from-amber-400 to-amber-600';
    if (ranking === 2) return 'from-slate-400 to-slate-600';
    if (ranking === 3) return 'from-orange-400 to-orange-600';
    return 'from-blue-500 to-indigo-600';
  };

  return (
    <div className={`h-11 w-11 rounded-xl bg-gradient-to-br ${getGradient(ranking)} flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-blue-200/50 flex-shrink-0`}>
      {getInitials(name)}
    </div>
  );
}
