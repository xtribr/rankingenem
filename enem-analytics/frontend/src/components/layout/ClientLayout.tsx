'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Image from 'next/image';
import Sidebar from './Sidebar';
import { useAuth } from '@/lib/auth-context';
import { useSidebar } from '@/lib/sidebar-context';
import { LogOut, School } from 'lucide-react';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, isAdmin, isLoading, logout } = useAuth();
  const { collapsed } = useSidebar();
  const isLoginPage = pathname === '/login';

  useEffect(() => {
    // Don't redirect while loading or on login page
    if (isLoading || isLoginPage) return;

    // Redirect to login if not authenticated
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    // For non-admin users, redirect to their school page
    if (!isAdmin && user?.codigo_inep) {
      const allowedPaths = [
        `/schools/${user.codigo_inep}`,
        `/schools/${user.codigo_inep}/roadmap`,
      ];
      const isAllowed = allowedPaths.some(p => pathname?.startsWith(p));

      if (!isAllowed) {
        router.push(`/schools/${user.codigo_inep}`);
      }
    }
  }, [isLoading, isAuthenticated, isAdmin, user, pathname, router, isLoginPage]);

  if (isLoginPage) {
    return <>{children}</>;
  }

  // Show loading while checking auth
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="h-8 w-8 border-4 border-sky-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Don't render anything if not authenticated (will redirect)
  if (!isAuthenticated) {
    return null;
  }

  // For non-admin users, show full-width layout without sidebar
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-50">
        {/* Minimal Header for School Users */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              {/* Logo and School Name */}
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 bg-gradient-to-br from-sky-400 to-orange-500 rounded-xl flex items-center justify-center p-1">
                  <Image src="/logo-xtri.png" alt="X-TRI" width={32} height={32} />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-gray-900">X-TRI Escolas</h1>
                  {user && (
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <School className="h-3 w-3" />
                      {user.nome_escola}
                    </p>
                  )}
                </div>
              </div>

              {/* Logout Button */}
              <button
                onClick={logout}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Sair
              </button>
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

  // Admin users see the full sidebar layout
  return (
    <div className="flex">
      <Sidebar />
      <main className={`flex-1 min-h-screen transition-all duration-300 p-6 ${
        collapsed ? 'ml-20' : 'ml-64'
      }`}>
        {children}
      </main>
    </div>
  );
}
