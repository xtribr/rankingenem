'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import Sidebar from './Sidebar';
import { useAuth } from '@/lib/auth-context';
import { useSidebar } from '@/lib/sidebar-context';
import { AlertTriangle, LogOut, Menu, RefreshCw, School } from 'lucide-react';

// Rotas públicas (vitrine / funil). Acessíveis SEM sessão.
// O detalhe /schools/[inep] oferece resumo público; o roadmap e os dados profundos
// permanecem gated. A vitrine, a lista, o cadastro e o login também são públicos.
function isPublicPath(pathname: string | null): boolean {
  if (!pathname) return false;
  if (pathname === '/') return true;
  if (pathname === '/schools') return true;
  if (pathname === '/redacao') return true;
  // Páginas públicas de SEO: escola, estado e município.
  if (pathname === '/ranking-enem' || pathname.startsWith('/ranking-enem/')) return true;
  // Detalhe da escola (/schools/{inep}) = resumo público; /roadmap segue gated.
  if (/^\/schools\/[^/]+$/.test(pathname)) return true;
  if (pathname === '/termos-de-uso') return true;
  if (pathname === '/politica-de-privacidade') return true;
  if (pathname === '/politica-de-compliance-ia') return true;
  if (pathname.startsWith('/cadastro')) return true;
  if (pathname === '/login') return true;
  return false;
}

function ProfileValidationErrorState({
  isRetrying,
  onRetry,
  onLogout,
}: {
  isRetrying: boolean;
  onRetry: () => Promise<void>;
  onLogout: () => Promise<void>;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <section
        role="alert"
        aria-live="polite"
        className="w-full max-w-lg rounded-2xl border border-amber-200 bg-white p-6 text-center shadow-sm sm:p-8"
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
          <AlertTriangle className="h-6 w-6 text-amber-700" />
        </div>
        <h1 className="mt-4 text-xl font-bold text-slate-900">Não foi possível validar seu acesso</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Sua sessão continua protegida, mas o perfil não pôde ser confirmado pela API.
          Tente novamente antes de acessar dados da escola.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => void onRetry()}
            disabled={isRetrying}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#139ED3] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#0f88b8] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${isRetrying ? 'animate-spin' : ''}`} />
            {isRetrying ? 'Validando…' : 'Tentar novamente'}
          </button>
          <button
            type="button"
            onClick={() => void onLogout()}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100"
          >
            <LogOut className="h-4 w-4" />
            Sair com segurança
          </button>
        </div>
      </section>
    </main>
  );
}

function AdminLayoutShell({
  children,
  collapsed,
}: {
  children: React.ReactNode;
  collapsed: boolean;
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex bg-slate-50 min-h-screen">
      <Sidebar mobileOpen={mobileNavOpen} onMobileClose={() => setMobileNavOpen(false)} />

      {mobileNavOpen && (
        <div
          className="md:hidden fixed inset-0 z-30 bg-black/50"
          onClick={() => setMobileNavOpen(false)}
          aria-hidden="true"
        />
      )}

      <main
        className={`flex-1 min-w-0 min-h-screen transition-all duration-300 ease-in-out ml-0 ${
          collapsed ? 'md:ml-16' : 'md:ml-56'
        }`}
      >
        <header className="md:hidden sticky top-0 z-20 flex items-center gap-3 bg-white border-b border-gray-200 px-4 h-14">
          <button
            onClick={() => setMobileNavOpen(true)}
            className="p-2 -ml-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 bg-gradient-to-br from-sky-400 to-orange-500 rounded-lg flex items-center justify-center p-1">
              <Image src="/logo-xtri.png" alt="X-TRI" width={24} height={24} />
            </div>
            <span className="font-bold text-gray-900">X-TRI Analytics</span>
          </div>
        </header>

        {children}
      </main>
    </div>
  );
}

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, session, isAdmin, isLoading, authError, logout, refreshUser } = useAuth();
  const { collapsed } = useSidebar();
  const isLoginPage = pathname === '/login';
  const isPublic = isPublicPath(pathname);

  useEffect(() => {
    if (isLoading) return;

    // Sessão invalidada: sempre explicar no login, inclusive se o usuário estava
    // na vitrine pública. Visitantes comuns continuam acessando rotas públicas.
    if (!session) {
      const needsLoginExplanation =
        authError?.kind === 'session_expired' || authError?.kind === 'access_denied';
      if (!isLoginPage && (needsLoginExplanation || !isPublic)) {
        router.replace('/login');
      }
      return;
    }

    // Sessão existe mas o perfil ainda está carregando.
    if (!user) return;

    // Modelo B (fail-closed): não-admin sem codigo_inep é um perfil malformado
    // e não deve navegar o app — manda para o login em vez de renderizar o shell.
    if (!isAdmin && !user.codigo_inep) {
      router.push('/login');
      return;
    }

    // Usuário-escola (não admin): pode usar a vitrine `/` e a lista pública `/schools`
    // (com todos os filtros) para montar seus próprios rankings, além do próprio painel.
    // Continua bloqueado do DETALHE de OUTRAS escolas (não vaza painel profundo alheio).
    if (!isAdmin) {
      const path = pathname ?? '';
      const ownPrefix = `/schools/${user.codigo_inep}`;
      const isOtherSchoolDetail =
        /^\/schools\/[^/]+/.test(path) && !path.startsWith(ownPrefix);
      const isAllowed = (isPublic || path.startsWith(ownPrefix)) && !isOtherSchoolDetail;

      if (!isAllowed) {
        router.push(ownPrefix);
      }
    }
  }, [authError?.kind, isLoading, isAdmin, isLoginPage, isPublic, pathname, router, session, user]);

  const hasRecoverableValidationError = session && authError?.kind === 'unavailable';

  if (hasRecoverableValidationError && (!isPublic || isLoginPage)) {
    return (
      <ProfileValidationErrorState
        isRetrying={isLoading}
        onRetry={refreshUser}
        onLogout={logout}
      />
    );
  }

  // Página de login: sem chrome do app.
  if (isLoginPage) {
    return <>{children}</>;
  }

  // Rota pública sem sessão (ou ainda carregando a auth): renderiza a vitrine
  // imediatamente — ela traz o próprio header/hero e não depende de login.
  if (isPublic && (!session || (!user && authError))) {
    return <>{children}</>;
  }

  // Carregando sessão/perfil (rotas autenticadas).
  if (isLoading || (session && !user)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="h-8 w-8 border-4 border-sky-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Rota gated sem sessão → o effect acima já redireciona para /login.
  if (!session) {
    return null;
  }

  // Usuário-escola (não admin): layout enxuto, sem sidebar.
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-50">
        {/* Minimal Header for School Users */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between gap-3 h-16">
              {/* Logo and School Name */}
              <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                <div className="h-10 w-10 bg-gradient-to-br from-sky-400 to-orange-500 rounded-xl flex items-center justify-center p-1 flex-shrink-0">
                  <Image src="/logo-xtri.png" alt="X-TRI" width={32} height={32} />
                </div>
                <div className="min-w-0">
                  <h1 className="text-lg font-bold text-gray-900">X-TRI Escolas</h1>
                  {user && (
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <School className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">{user.nome_escola}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Ações: ranking público + logout */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <Link
                  href="/schools"
                  className="flex items-center gap-2 rounded-xl px-3 sm:px-4 py-2 text-sm font-semibold text-[#139ED3] transition-colors hover:bg-[#E9F8FE]"
                >
                  Ranking
                </Link>
                <Link
                  href="/redacao"
                  className="flex items-center gap-2 rounded-xl px-3 sm:px-4 py-2 text-sm font-semibold text-[#FF4B2E] transition-colors hover:bg-[#FFF0EB]"
                >
                  Redação
                </Link>
                <button
                  onClick={logout}
                  className="flex items-center gap-2 px-3 sm:px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  Sair
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </main>
      </div>
    );
  }

  // A key por rota remonta apenas o shell administrativo e fecha o drawer móvel.
  return (
    <AdminLayoutShell key={pathname ?? 'admin'} collapsed={collapsed}>
      {children}
    </AdminLayoutShell>
  );
}
