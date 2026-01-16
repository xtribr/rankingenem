'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  School,
  BarChart3,
  TrendingUp,
  GitCompare,
  ChevronLeft,
  ChevronRight,
  X,
  Send,
  CheckCircle,
  LogOut,
  Shield,
  Users,
  Sparkles,
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useSidebar } from '@/lib/sidebar-context';

const adminMenuItems = [
  { label: 'MENU', type: 'header' as const },
  { icon: LayoutDashboard, label: 'Dashboard', href: '/' },
  { icon: School, label: 'Escolas', href: '/schools' },
  { icon: BarChart3, label: 'Habilidades', href: '/skills' },
  { label: 'ANALYTICS', type: 'header' as const },
  { icon: TrendingUp, label: 'Tendências', href: '/trends' },
  { icon: GitCompare, label: 'Comparar', href: '/compare' },
  { icon: Sparkles, label: 'Oráculo 2026', href: '/oraculo' },
  { label: 'ADMIN', type: 'header' as const },
  { icon: Shield, label: 'Painel Admin', href: '/admin' },
  { icon: Users, label: 'Usuários', href: '/admin/users' },
];

interface ContactFormData {
  nome: string;
  telefone: string;
  nomeEscola: string;
  cargo: string;
  conheciaXtri: 'sim' | 'nao' | '';
  comentarios: string;
}

function ContactModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [formData, setFormData] = useState<ContactFormData>({
    nome: '',
    telefone: '',
    nomeEscola: '',
    cargo: '',
    conheciaXtri: '',
    comentarios: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const message =
      `*Novo Contato - X-TRI Escolas*\n\n` +
      `*Nome:* ${formData.nome}\n` +
      `*Telefone:* ${formData.telefone}\n` +
      `*Escola:* ${formData.nomeEscola}\n` +
      `*Cargo:* ${formData.cargo}\n` +
      `*Conhecia a XTRI?* ${formData.conheciaXtri === 'sim' ? 'Sim' : 'Não'}\n\n` +
      `*Comentários:*\n${formData.comentarios || 'Nenhum'}`;

    const whatsappNumber = '5584996613971';
    const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;

    window.open(whatsappUrl, '_blank');

    setIsSubmitting(false);
    setIsSuccess(true);
    setTimeout(() => {
      setIsSuccess(false);
      onClose();
      setFormData({
        nome: '',
        telefone: '',
        nomeEscola: '',
        cargo: '',
        conheciaXtri: '',
        comentarios: '',
      });
    }, 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gradient-to-r from-sky-400 to-orange-500 px-6 py-4 rounded-t-2xl">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
          >
            <X className="h-5 w-5 text-white" />
          </button>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-white rounded-xl flex items-center justify-center p-1">
              <Image src="/logo-xtri.png" alt="X-TRI" width={32} height={32} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Entre em Contato</h2>
              <p className="text-xs text-white/80">Fale com nossa equipe</p>
            </div>
          </div>
        </div>

        {isSuccess ? (
          <div className="p-8 text-center">
            <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Mensagem Enviada!</h3>
            <p className="text-sm text-gray-500">Entraremos em contato em breve.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nome completo *
              </label>
              <input
                type="text"
                required
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 outline-none transition-all text-gray-900"
                placeholder="Seu nome"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Telefone com WhatsApp *
              </label>
              <input
                type="tel"
                required
                value={formData.telefone}
                onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 outline-none transition-all text-gray-900"
                placeholder="(11) 99999-9999"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nome da Escola *
              </label>
              <input
                type="text"
                required
                value={formData.nomeEscola}
                onChange={(e) => setFormData({ ...formData, nomeEscola: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 outline-none transition-all text-gray-900"
                placeholder="Nome da instituição"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cargo na Escola *
              </label>
              <input
                type="text"
                required
                value={formData.cargo}
                onChange={(e) => setFormData({ ...formData, cargo: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 outline-none transition-all text-gray-900"
                placeholder="Ex: Coordenador, Diretor, Professor"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Já conhecia a XTRI? *
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="conheciaXtri"
                    value="sim"
                    required
                    checked={formData.conheciaXtri === 'sim'}
                    onChange={() => setFormData({ ...formData, conheciaXtri: 'sim' })}
                    className="w-4 h-4 text-sky-400 border-gray-300 focus:ring-sky-400"
                  />
                  <span className="text-sm text-gray-700">Sim</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="conheciaXtri"
                    value="nao"
                    required
                    checked={formData.conheciaXtri === 'nao'}
                    onChange={() => setFormData({ ...formData, conheciaXtri: 'nao' })}
                    className="w-4 h-4 text-sky-400 border-gray-300 focus:ring-sky-400"
                  />
                  <span className="text-sm text-gray-700">Não</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Comentários
              </label>
              <textarea
                value={formData.comentarios}
                onChange={(e) => setFormData({ ...formData, comentarios: e.target.value })}
                rows={3}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 outline-none transition-all text-gray-900 resize-none"
                placeholder="Conte-nos mais sobre suas necessidades..."
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-gradient-to-r from-sky-400 to-orange-500 text-white font-semibold py-3 rounded-xl hover:from-sky-500 hover:to-orange-600 transition-all shadow-lg hover:shadow-xl disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Enviar Mensagem
                </>
              )}
            </button>

            <p className="text-xs text-center text-gray-400">
              Enviaremos para contato@xtri.online
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const { user, isAdmin, logout, isAuthenticated } = useAuth();
  const { collapsed, setCollapsed } = useSidebar();
  const [isContactOpen, setIsContactOpen] = useState(false);

  // Build menu based on user role
  const schoolMenuItems = user?.codigo_inep ? [
    { label: 'MINHA ESCOLA', type: 'header' as const },
    { icon: School, label: 'Painel', href: `/schools/${user.codigo_inep}` },
    { icon: TrendingUp, label: 'Roadmap', href: `/schools/${user.codigo_inep}/roadmap` },
  ] : [];

  const allMenuItems = isAdmin ? adminMenuItems : schoolMenuItems;

  return (
    <>
      <aside
        className={`fixed left-0 top-0 z-40 h-screen bg-slate-900 text-white flex flex-col transition-all duration-300 ${
          collapsed ? 'w-20' : 'w-64'
        }`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-4 py-5 border-b border-slate-700">
          <div className={`flex items-center gap-3 ${collapsed ? 'justify-center w-full' : ''}`}>
            <div className="h-10 w-10 bg-white rounded-xl flex items-center justify-center flex-shrink-0 p-1">
              <Image src="/logo-xtri.png" alt="X-TRI" width={32} height={32} />
            </div>
            {!collapsed && (
              <div>
                <span className="text-lg font-bold">X-TRI</span>
                <span className="text-xs text-slate-400 block">Escolas</span>
              </div>
            )}
          </div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={`p-1.5 hover:bg-slate-800 rounded-lg transition-colors ${collapsed ? 'hidden' : ''}`}
          >
            <ChevronLeft className="h-4 w-4 text-slate-400" />
          </button>
        </div>

        {collapsed && (
          <button
            onClick={() => setCollapsed(false)}
            className="mx-auto mt-2 p-1.5 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <ChevronRight className="h-4 w-4 text-slate-400" />
          </button>
        )}

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4">
          <ul className="space-y-1">
            {allMenuItems.map((item, idx) => {
              if (item.type === 'header') {
                if (collapsed) return null;
                return (
                  <li key={idx} className="pt-4 pb-2 px-3">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      {item.label}
                    </span>
                  </li>
                );
              }

              const Icon = item.icon!;
              const isActive = pathname === item.href ||
                (item.href !== '/' && pathname?.startsWith(item.href!));

              return (
                <li key={idx}>
                  <Link
                    href={item.href!}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      collapsed ? 'justify-center' : ''
                    } ${
                      isActive
                        ? 'bg-gradient-to-r from-sky-400 to-sky-500 text-white'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                    title={collapsed ? item.label : undefined}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    {!collapsed && item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* User Info & Logout */}
        {isAuthenticated && (
          <div className={`px-3 py-2 border-t border-slate-700 ${collapsed ? 'text-center' : ''}`}>
            {!collapsed && user && (
              <div className="px-3 py-2 mb-2">
                <p className="text-sm font-medium text-white truncate">{user.nome_escola}</p>
                <p className="text-xs text-slate-400 truncate">{user.email}</p>
              </div>
            )}
            <button
              onClick={logout}
              className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-all ${
                collapsed ? 'justify-center' : ''
              }`}
              title="Sair"
            >
              <LogOut className="h-5 w-5 flex-shrink-0" />
              {!collapsed && 'Sair'}
            </button>
          </div>
        )}

        {/* Contact Button */}
        <div className={`px-3 pb-4 ${collapsed ? 'text-center' : ''}`}>
          <button
            onClick={() => setIsContactOpen(true)}
            className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-all ${
              collapsed ? 'justify-center' : ''
            }`}
            title="Fale Conosco"
          >
            <Send className="h-5 w-5 flex-shrink-0" />
            {!collapsed && 'Fale Conosco'}
          </button>
        </div>
      </aside>

      <ContactModal isOpen={isContactOpen} onClose={() => setIsContactOpen(false)} />
    </>
  );
}
