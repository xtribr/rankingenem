'use client';

import { useQuery } from '@tanstack/react-query';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  Bell,
  Calendar,
  ChevronRight,
  Database,
  GraduationCap,
  MapPin,
  Medal,
  School,
  Search,
  ShieldCheck,
  Target,
} from 'lucide-react';
import { api, type TopSchool } from '@/lib/api';
import { getLatestEnemYear, getNextEnemYear, getYearRangeLabel } from '@/lib/enem-cycle';
import { formatNumber, formatTriScore } from '@/lib/utils';
import { Sparkline } from '@/components/ui/sparkline';
import { AreaCardSkeleton, StatCardSkeleton, TableRowSkeleton } from '@/components/ui/skeleton';

type StatTone = 'blue' | 'emerald' | 'amber' | 'slate';
type AreaTone = 'emerald' | 'blue' | 'violet' | 'orange' | 'rose';

const areaCards: Array<{
  label: string;
  shortLabel: string;
  metric: keyof NonNullable<Awaited<ReturnType<typeof api.getStats>>>['avg_scores'];
  tone: AreaTone;
}> = [
  { label: 'Ciências da Natureza', shortLabel: 'Natureza', metric: 'nota_cn', tone: 'emerald' },
  { label: 'Ciências Humanas', shortLabel: 'Humanas', metric: 'nota_ch', tone: 'blue' },
  { label: 'Linguagens', shortLabel: 'Linguagens', metric: 'nota_lc', tone: 'violet' },
  { label: 'Matemática', shortLabel: 'Matemática', metric: 'nota_mt', tone: 'orange' },
  { label: 'Redação', shortLabel: 'Redação', metric: 'nota_redacao', tone: 'rose' },
];

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['stats'],
    queryFn: api.getStats,
  });

  const { data: topSchools, isLoading: topLoading } = useQuery({
    queryKey: ['topSchools'],
    queryFn: () => api.getTopSchools(10),
  });

  const today = new Date();
  const dateStr = today.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const latestDataYear = getLatestEnemYear(stats?.years);
  const nextEnemYear = getNextEnemYear(stats?.years);
  const yearRangeLabel = getYearRangeLabel(stats?.years);
  const schools = topSchools?.schools ?? [];
  const leader = schools[0];
  const dataCoverageLabel = stats?.years?.length
    ? `${yearRangeLabel} · ${stats.states.length} UFs`
    : 'Base histórica em carregamento';

  return (
    <div className="min-h-screen bg-[#f5fbff]">
      <header className="sticky top-0 z-20 border-b border-[#28B7ED]/20 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[#28B7ED]/20 bg-white shadow-sm">
              <Image src="/logo-x.png" alt="Logo XTRI" width={42} height={42} className="h-10 w-10 object-contain" priority />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#28B7ED]">
                <ShieldCheck className="h-4 w-4" />
                Painel executivo
              </div>
              <h1 className="mt-1 truncate text-xl font-bold text-slate-950 sm:text-2xl">Ranking ENEM XTRI</h1>
              <p className="mt-0.5 text-xs capitalize text-slate-500 sm:text-sm">{dateStr}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/schools"
              className="hidden items-center gap-2 rounded-xl border border-[#28B7ED]/20 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-[#28B7ED]/50 hover:text-[#28B7ED] sm:flex"
            >
              <Search className="h-4 w-4" />
              Buscar escola
            </Link>
            <button
              className="relative rounded-xl border border-[#28B7ED]/20 bg-white p-2.5 text-slate-600 shadow-sm transition hover:border-[#FF4B2E]/40 hover:text-[#FF4B2E]"
              aria-label="Ver notificações"
            >
              <Bell className="h-5 w-5" />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#FF4B2E]" />
            </button>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#28B7ED] to-[#FF4B2E] text-sm font-black text-white shadow-lg shadow-[#28B7ED]/20">
              AD
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] space-y-5 px-4 py-5 sm:px-6 sm:py-6">
        <section className="relative overflow-hidden rounded-[1.75rem] border border-[#28B7ED]/25 bg-[#061927] text-white shadow-xl shadow-[#28B7ED]/10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_14%_0%,rgba(40,183,237,0.58),transparent_34%),radial-gradient(circle_at_86%_18%,rgba(255,75,46,0.48),transparent_31%),linear-gradient(135deg,rgba(40,183,237,0.14),rgba(255,75,46,0.08))]" />
          <div className="pointer-events-none absolute -right-16 -top-24 hidden h-80 w-80 rotate-6 rounded-[4rem] border-[34px] border-white/10 opacity-80 lg:block" />
          <div className="pointer-events-none absolute right-2 top-16 hidden h-32 w-32 rounded-[2rem] border-[18px] border-[#FF4B2E]/20 opacity-70 lg:block" />
          <div className="relative grid gap-6 p-5 sm:p-7 lg:grid-cols-[1.35fr_0.65fr] lg:items-end">
            <div>
              <div className="mb-5 inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/95 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-slate-950 shadow-lg shadow-black/10">
                <span className="h-2.5 w-2.5 rounded-full bg-[#28B7ED]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#FF4B2E]" />
                XTRI EdTech
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-[#DFF7FF] backdrop-blur">
                <Database className="h-3.5 w-3.5" />
                {statsLoading ? 'Carregando base histórica' : `Base ENEM ${dataCoverageLabel}`}
              </div>
              <h2 className="mt-5 max-w-3xl text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
                Decisões pedagógicas guiadas por ranking, TRI e evidência histórica.
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                A primeira leitura deve responder rápido: quem lidera, qual é o padrão nacional e onde vale aprofundar o diagnóstico por escola.
              </p>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/schools"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-[#E9F8FE]"
                >
                  Ver ranking completo
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/compare"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#FF4B2E]/50 bg-[#FF4B2E]/20 px-5 py-3 text-sm font-bold text-white backdrop-blur transition hover:bg-[#FF4B2E]/30"
                >
                  Comparar escolas
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <ExecutiveSignal
                label="Liderança atual"
                value={leader ? `#${leader.ranking}` : '...'}
                detail={leader?.nome_escola ?? 'Aguardando ranking'}
              />
              <ExecutiveSignal
                label="Último ano carregado"
                value={latestDataYear ? String(latestDataYear) : '...'}
                detail={nextEnemYear ? `ENEM ${nextEnemYear} entra após divulgação do INEP` : 'Dados oficiais do INEP'}
              />
              <ExecutiveSignal
                label="Critério principal"
                value="TRI"
                detail="Notas não são proporcionais aos acertos; padrão de resposta importa."
              />
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {statsLoading ? (
            <>
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
            </>
          ) : (
            <>
              <StatCard
                icon={School}
                label="Escolas analisadas"
                value={stats?.total_schools.toLocaleString('pt-BR') || '-'}
                subtitle="Unidades com registros ENEM consolidados"
                badge="Base real"
                tone="blue"
              />
              <StatCard
                icon={Calendar}
                label="Anos de dados"
                value={`${stats?.years.length || 0}`}
                subtitle={yearRangeLabel}
                badge="Série histórica"
                tone="emerald"
              />
              <StatCard
                icon={BarChart3}
                label="Registros avaliados"
                value={formatNumber(stats?.total_records ?? 0)}
                subtitle="Linhas históricas usadas nos agregados"
                badge="Auditável"
                tone="amber"
              />
              <StatCard
                icon={MapPin}
                label="Cobertura geográfica"
                value={`${stats?.states.length || 0}`}
                subtitle="Estados e Distrito Federal"
                badge="Nacional"
                tone="slate"
              />
            </>
          )}
        </section>

        <section className="grid grid-cols-1 gap-5 xl:grid-cols-[0.88fr_1.12fr]">
          <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-sm font-bold text-[#28B7ED]">
                  <Target className="h-5 w-5" />
                  Leitura pedagógica
                </div>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
                  Média nacional por área
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Use esses valores como referência de contexto. Para intervenção, a decisão correta vem da escola, da evolução e da consistência TRI.
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              {statsLoading ? (
                <>
                  <AreaCardSkeleton />
                  <AreaCardSkeleton />
                  <AreaCardSkeleton />
                  <AreaCardSkeleton />
                  <AreaCardSkeleton />
                </>
              ) : (
                areaCards.map((item) => (
                  <AreaScoreCard
                    key={item.metric}
                    label={item.label}
                    shortLabel={item.shortLabel}
                    value={stats?.avg_scores[item.metric]}
                    tone={item.tone}
                  />
                ))
              )}
            </div>
          </div>

          <RankingPanel schools={schools} isLoading={topLoading} ano={topSchools?.ano} />
        </section>
      </main>
    </div>
  );
}

function ExecutiveSignal({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.08] p-4 backdrop-blur">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#DFF7FF]/90">{label}</p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
      <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-300">{detail}</p>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  subtitle,
  badge,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  subtitle: string;
  badge: string;
  tone: StatTone;
}) {
  const colors: Record<StatTone, { icon: string; badge: string; bar: string; surface: string }> = {
    blue: {
      icon: 'bg-[#E9F8FE] text-[#139ED3]',
      badge: 'bg-[#E9F8FE] text-[#139ED3]',
      bar: 'from-[#28B7ED] to-[#70D8FF]',
      surface: 'hover:border-[#28B7ED]/40 hover:shadow-[#28B7ED]/20',
    },
    emerald: {
      icon: 'bg-[#FFF0EB] text-[#FF4B2E]',
      badge: 'bg-[#FFF0EB] text-[#FF4B2E]',
      bar: 'from-[#FF4B2E] to-[#FF8A70]',
      surface: 'hover:border-[#FF4B2E]/35 hover:shadow-[#FF4B2E]/15',
    },
    amber: {
      icon: 'bg-[#FFF0EB] text-[#FF4B2E]',
      badge: 'bg-[#FFF0EB] text-[#FF4B2E]',
      bar: 'from-[#28B7ED] via-[#FF7A59] to-[#FF4B2E]',
      surface: 'hover:border-[#FF4B2E]/35 hover:shadow-[#FF4B2E]/15',
    },
    slate: {
      icon: 'bg-slate-100 text-slate-700',
      badge: 'bg-[#E9F8FE] text-slate-700',
      bar: 'from-[#28B7ED] to-[#FF4B2E]',
      surface: 'hover:border-[#28B7ED]/30 hover:shadow-slate-200/80',
    },
  };
  const theme = colors[tone];

  return (
    <div className={`group rounded-[1.35rem] border border-slate-200 bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-lg ${theme.surface}`}>
      <div className="flex items-start justify-between gap-3">
        <div className={`rounded-2xl p-3 ${theme.icon}`}>
          <Icon className="h-5 w-5" />
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${theme.badge}`}>{badge}</span>
      </div>

      <p className="mt-5 text-3xl font-black tracking-tight text-slate-950">{value}</p>
      <p className="mt-1 text-sm font-bold text-slate-700">{label}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{subtitle}</p>

      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full w-2/3 rounded-full bg-gradient-to-r ${theme.bar} transition-all duration-500 group-hover:w-full`} />
      </div>
    </div>
  );
}

function AreaScoreCard({
  label,
  shortLabel,
  value,
  tone,
}: {
  label: string;
  shortLabel: string;
  value?: number | null;
  tone: AreaTone;
}) {
  const colors: Record<AreaTone, { accent: string; text: string; surface: string }> = {
    emerald: {
      accent: 'bg-[#28B7ED]',
      text: 'text-[#139ED3]',
      surface: 'bg-[#E9F8FE]/70 border-[#28B7ED]/20',
    },
    blue: {
      accent: 'bg-[#28B7ED]',
      text: 'text-[#139ED3]',
      surface: 'bg-[#E9F8FE]/70 border-[#28B7ED]/20',
    },
    violet: {
      accent: 'bg-[#FF4B2E]',
      text: 'text-[#E43E24]',
      surface: 'bg-[#FFF0EB]/70 border-[#FF4B2E]/20',
    },
    orange: {
      accent: 'bg-[#FF4B2E]',
      text: 'text-[#E43E24]',
      surface: 'bg-[#FFF0EB]/70 border-[#FF4B2E]/20',
    },
    rose: {
      accent: 'bg-gradient-to-r from-[#28B7ED] to-[#FF4B2E]',
      text: 'text-slate-800',
      surface: 'bg-white border-[#28B7ED]/20',
    },
  };
  const theme = colors[tone];

  return (
    <div className={`rounded-2xl border p-4 ${theme.surface}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className={`text-sm font-black ${theme.text}`}>{shortLabel}</p>
          <p className="mt-1 truncate text-xs text-slate-500" title={label}>
            {label}
          </p>
        </div>
        <span className={`h-3 w-3 rounded-full ${theme.accent}`} />
      </div>
      <div className="mt-4 flex items-end justify-between gap-3">
        <p className="text-3xl font-black tracking-tight text-slate-950">{formatTriScore(value)}</p>
        <p className="pb-1 text-right text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
          média TRI
        </p>
      </div>
    </div>
  );
}

function RankingPanel({
  schools,
  isLoading,
  ano,
}: {
  schools: TopSchool[];
  isLoading: boolean;
  ano?: number;
}) {
  return (
    <div className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-[#FFF0EB] p-3 text-[#FF4B2E]">
              <Medal className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-2xl font-black tracking-tight text-slate-950">Top 10 escolas</h2>
              <p className="mt-1 text-sm text-slate-500">
                {ano ? `Melhores desempenhos consolidados no ENEM ${ano}` : 'Ranking em carregamento'}
              </p>
            </div>
          </div>
          <Link
            href="/schools"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#28B7ED] to-[#FF4B2E] px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-[#28B7ED]/20 transition hover:brightness-105"
          >
            Ranking completo
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <div className="lg:hidden">
        {isLoading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-32 animate-pulse rounded-2xl bg-slate-100" />
            ))}
          </div>
        ) : schools.length > 0 ? (
          <div className="space-y-3 p-4">
            {schools.map((school) => (
              <SchoolRankingCard key={school.codigo_inep} school={school} />
            ))}
          </div>
        ) : (
          <EmptyRankingState />
        )}
      </div>

      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full">
          <thead className="bg-slate-50/80">
            <tr>
              <th className="w-24 px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                Posição
              </th>
              <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                Escola
              </th>
              <th className="w-20 px-6 py-4 text-center text-xs font-bold uppercase tracking-wider text-slate-500">
                UF
              </th>
              <th className="w-28 px-6 py-4 text-center text-xs font-bold uppercase tracking-wider text-slate-500">
                Tipo
              </th>
              <th className="w-28 px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-500">
                Média TRI
              </th>
              <th className="w-28 px-6 py-4 text-center text-xs font-bold uppercase tracking-wider text-slate-500">
                Série
              </th>
              <th className="w-28 px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-500">
                Hab.
              </th>
              <th className="w-20 px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-500">
                CN
              </th>
              <th className="w-20 px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-500">
                CH
              </th>
              <th className="w-20 px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-500">
                LC
              </th>
              <th className="w-20 px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-500">
                MT
              </th>
              <th className="w-20 px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-500">
                RED
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              Array.from({ length: 10 }).map((_, index) => <TableRowSkeleton key={index} cols={12} />)
            ) : schools.length > 0 ? (
              schools.map((school) => (
                <tr key={school.codigo_inep} className="group transition hover:bg-[#E9F8FE]/60">
                  <td className="whitespace-nowrap px-6 py-4">
                    <RankingBadge ranking={school.ranking} />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <SchoolAvatar name={school.nome_escola} ranking={school.ranking} />
                      <div className="min-w-0">
                        <Link
                          href={`/schools/${school.codigo_inep}`}
                          className="line-clamp-1 font-bold text-slate-950 transition hover:text-[#28B7ED]"
                        >
                          {school.nome_escola}
                        </Link>
                        <p className="font-mono text-xs text-slate-400">{school.codigo_inep}</p>
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-center">
                    <UfBadge uf={school.uf} />
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-center">
                    <SchoolTypeBadge type={school.tipo_escola} />
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right">
                    <span className="text-lg font-black text-slate-950">{formatTriScore(school.nota_media)}</span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <div className="flex justify-center">
                      <Sparkline data={school.history ?? []} />
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right">
                    <span className="text-sm font-bold text-slate-700">{formatSkillScore(school.desempenho_habilidades)}</span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right text-slate-600">{formatTriScore(school.nota_cn)}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-right text-slate-600">{formatTriScore(school.nota_ch)}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-right text-slate-600">{formatTriScore(school.nota_lc)}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-right text-slate-600">{formatTriScore(school.nota_mt)}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-right text-slate-600">{formatTriScore(school.nota_redacao)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={12}>
                  <EmptyRankingState />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SchoolRankingCard({ school }: { school: TopSchool }) {
  return (
    <Link
      href={`/schools/${school.codigo_inep}`}
      className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-[#28B7ED]/40 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <SchoolAvatar name={school.nome_escola} ranking={school.ranking} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <RankingBadge ranking={school.ranking} compact />
              <UfBadge uf={school.uf} />
            </div>
            <h3 className="mt-2 line-clamp-2 text-sm font-black leading-5 text-slate-950">{school.nome_escola}</h3>
            <p className="mt-1 font-mono text-xs text-slate-400">{school.codigo_inep}</p>
          </div>
        </div>
        <ChevronRight className="mt-1 h-5 w-5 flex-shrink-0 text-slate-300" />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <MiniMetric label="Média TRI" value={formatTriScore(school.nota_media)} strong />
        <MiniMetric label="Hab." value={formatSkillScore(school.desempenho_habilidades)} />
      </div>

      <div className="mt-3 grid grid-cols-5 gap-1.5 text-center">
        <AreaPill label="CN" value={school.nota_cn} />
        <AreaPill label="CH" value={school.nota_ch} />
        <AreaPill label="LC" value={school.nota_lc} />
        <AreaPill label="MT" value={school.nota_mt} />
        <AreaPill label="RED" value={school.nota_redacao} />
      </div>
    </Link>
  );
}

function MiniMetric({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className={`mt-1 ${strong ? 'text-xl' : 'text-lg'} font-black text-slate-950`}>{value}</p>
    </div>
  );
}

function AreaPill({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-xl bg-slate-50 px-2 py-2">
      <p className="text-[10px] font-black text-slate-400">{label}</p>
      <p className="mt-1 text-xs font-bold text-slate-700">{formatTriScore(value)}</p>
    </div>
  );
}

function EmptyRankingState() {
  return (
    <div className="p-8 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
        <GraduationCap className="h-7 w-7" />
      </div>
      <h3 className="mt-4 text-base font-black text-slate-950">Ranking indisponível no momento</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
        Quando a API retornar os dados, esta área mostra as escolas líderes e permite abrir o diagnóstico individual.
      </p>
    </div>
  );
}

function RankingBadge({ ranking, compact = false }: { ranking: number; compact?: boolean }) {
  const medal = ranking === 1 ? '1º' : ranking === 2 ? '2º' : ranking === 3 ? '3º' : `#${ranking}`;
  const color =
    ranking === 1
      ? 'bg-[#FFF0EB] text-[#FF4B2E] border-[#FF4B2E]/20'
      : ranking === 2
        ? 'bg-slate-100 text-slate-700 border-slate-200'
        : ranking === 3
          ? 'bg-[#FFF0EB] text-[#E43E24] border-[#FF4B2E]/20'
          : 'bg-[#E9F8FE] text-[#139ED3] border-[#28B7ED]/20';

  return (
    <span
      className={`inline-flex items-center justify-center rounded-xl border font-black ${color} ${
        compact ? 'h-7 px-2 text-xs' : 'h-11 min-w-11 px-3 text-sm'
      }`}
    >
      {medal}
    </span>
  );
}

function SchoolAvatar({ name, ranking }: { name: string; ranking: number }) {
  const words = name.split(' ').filter((word) => word.length > 2);
  const initials = words.length >= 2
    ? `${words[0][0]}${words[1][0]}`.toUpperCase()
    : name.substring(0, 2).toUpperCase();
  const gradient =
    ranking === 1
      ? 'from-[#FF7A59] to-[#FF4B2E]'
      : ranking === 2
        ? 'from-slate-400 to-slate-600'
        : ranking === 3
          ? 'from-[#FF9B84] to-[#FF4B2E]'
          : 'from-[#28B7ED] to-[#139ED3]';

  return (
    <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${gradient} text-sm font-black text-white shadow-lg shadow-[#28B7ED]/20`}>
      {initials}
    </div>
  );
}

function UfBadge({ uf }: { uf: string | null }) {
  return (
    <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-xl bg-slate-100 px-2 text-xs font-black text-slate-700">
      {uf || '--'}
    </span>
  );
}

function SchoolTypeBadge({ type }: { type: string | null }) {
  if (!type) {
    return <span className="text-xs font-semibold text-slate-400">--</span>;
  }

  const isPrivate = type === 'Privada';
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-bold ${
      isPrivate ? 'bg-[#E9F8FE] text-[#139ED3]' : 'bg-[#FFF0EB] text-[#FF4B2E]'
    }`}>
      {type}
    </span>
  );
}

function formatSkillScore(value: number | null) {
  return typeof value === 'number' ? `${(value * 100).toFixed(0)}%` : '--';
}
