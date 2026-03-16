'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { Users, UserPlus, Shield, Activity } from 'lucide-react';

interface AdminStats {
  total_users: number;
  active_users: number;
  inactive_users: number;
  admin_users: number;
}

export default function AdminPage() {
  const router = useRouter();
  const { user, session, isLoading, isAdmin } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    if (!isLoading && !session) {
      router.push('/login');
      return;
    }

    if (!isLoading && user && !isAdmin) {
      router.push('/');
    }
  }, [isLoading, isAdmin, router, session, user]);

  useEffect(() => {
    if (isAdmin) {
      api.getAdminStats()
        .then(setStats)
        .catch(console.error)
        .finally(() => setLoadingStats(false));
    }
  }, [isAdmin]);

  if (isLoading || (session && !user)) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 border-4 border-sky-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session || !user || !isAdmin) {
    return null;
  }

  const statCards = [
    {
      title: 'Total de Usuários',
      value: stats?.total_users ?? '-',
      icon: Users,
      color: 'bg-sky-100 text-sky-600',
    },
    {
      title: 'Usuários Ativos',
      value: stats?.active_users ?? '-',
      icon: Activity,
      color: 'bg-green-100 text-green-600',
    },
    {
      title: 'Usuários Inativos',
      value: stats?.inactive_users ?? '-',
      icon: Users,
      color: 'bg-gray-100 text-gray-600',
    },
    {
      title: 'Administradores',
      value: stats?.admin_users ?? '-',
      icon: Shield,
      color: 'bg-orange-100 text-orange-600',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Painel Administrativo</h1>
          <p className="text-gray-500">Bem-vindo, {user?.nome_escola}</p>
        </div>
        <Link
          href="/admin/users"
          className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-sky-400 to-orange-500 text-white font-medium rounded-xl hover:from-sky-500 hover:to-orange-600 transition-all shadow-lg"
        >
          <UserPlus className="h-5 w-5" />
          Gerenciar Usuários
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, idx) => (
          <div key={idx} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-4">
              <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${card.color}`}>
                <card.icon className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-gray-500">{card.title}</p>
                <p className="text-2xl font-bold text-gray-900">
                  {loadingStats ? (
                    <span className="h-6 w-12 bg-gray-200 rounded animate-pulse inline-block" />
                  ) : (
                    card.value
                  )}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Ações Rápidas</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link
            href="/admin/users"
            className="flex items-center gap-4 p-4 rounded-xl border border-gray-200 hover:border-sky-400 hover:bg-sky-50 transition-all"
          >
            <div className="h-10 w-10 bg-sky-100 rounded-lg flex items-center justify-center">
              <Users className="h-5 w-5 text-sky-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">Gerenciar Usuários</p>
              <p className="text-sm text-gray-500">Adicionar, editar ou remover escolas</p>
            </div>
          </Link>
          <Link
            href="/"
            className="flex items-center gap-4 p-4 rounded-xl border border-gray-200 hover:border-sky-400 hover:bg-sky-50 transition-all"
          >
            <div className="h-10 w-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <Activity className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">Ver Dashboard</p>
              <p className="text-sm text-gray-500">Acessar o painel principal</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
