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
  Menu,
  Crown,
  Zap,
  MessageCircle,
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useSidebar } from '@/lib/sidebar-context';
import { cn } from '@/lib/utils';

const adminMenuItems = [
  { 
    icon: LayoutDashboard, 
    label: 'Dashboard', 
    href: '/',
    badge: null 
  },
  { 
    icon: School, 
    label: 'Escolas', 
    href: '/schools',
    badge: null 
  },
  { 
    icon: BarChart3, 
    label: 'Habilidades', 
    href: '/skills',
    badge: null 
  },
  { 
    icon: TrendingUp, 
    label: 'Tendências', 
    href: '/trends',
    badge: null 
  },
  { 
    icon: GitCompare, 
    label: 'Comparar', 
    href: '/compare',
    badge: null 
  },
  { 
    icon: Sparkles, 
    label: 'Oráculo 2026', 
    href: '/oraculo',
    badge: { text: 'Novo', color: 'bg-amber-500' }
  },
];

const adminSecondaryItems = [
  { 
    icon: Shield, 
    label: 'Admin', 
    href: '/admin',
    badge: null 
  },
  { 
    icon: Users, 
    label: 'Usuários', 
    href: '/admin/users',
    badge: null 
  },
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
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 rounded-t-2xl">
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
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-gray-900"
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
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-gray-900"
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
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-gray-900"
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
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-gray-900"
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
                    className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-600"
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
                    className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-600"
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
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-gray-900 resize-none"
                placeholder="Conte-nos mais sobre suas necessidades..."
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold py-3 rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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

// Componente de Item de Menu
function MenuItem({ 
  item, 
  isActive, 
  collapsed 
}: { 
  item: { icon: any; label: string; href: string; badge?: { text: string; color: string } | null }; 
  isActive: boolean; 
  collapsed: boolean;
}) {
  const Icon = item.icon;
  
  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 relative group",
        collapsed ? "justify-center" : "",
        isActive
          ? "bg-blue-600 text-white shadow-lg shadow-blue-600/25"
          : "text-slate-400 hover:text-white hover:bg-slate-800/50"
      )}
      title={collapsed ? item.label : undefined}
    >
      <div className={cn(
        "p-1.5 rounded-lg transition-colors",
        isActive ? "bg-white/20" : "bg-slate-800 group-hover:bg-slate-700"
      )}>
        <Icon className="h-4 w-4" />
      </div>
      
      {!collapsed && (
        <>
          <span className="flex-1">{item.label}</span>
          {item.badge && (
            <span className={cn(
              "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
              item.badge.color || "bg-blue-500"
            )}>
              {item.badge.text}
            </span>
          )}
        </>
      )}
      
      {/* Tooltip para modo colapsado */}
      {collapsed && (
        <div className="absolute left-full ml-2 px-3 py-1.5 bg-slate-800 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
          {item.label}
          {item.badge && (
            <span className={cn("ml-2 px-1.5 py-0.5 rounded text-[9px]", item.badge.color)}>
              {item.badge.text}
            </span>
          )}
        </div>
      )}
    </Link>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const { user, isAdmin, logout, isAuthenticated } = useAuth();
  const { collapsed, setCollapsed } = useSidebar();
  const [isContactOpen, setIsContactOpen] = useState(false);

  // Build menu based on user role
  const schoolMenuItems = user?.codigo_inep ? [
    { icon: School, label: 'Painel', href: `/schools/${user.codigo_inep}`, badge: null },
    { icon: TrendingUp, label: 'Roadmap', href: `/schools/${user.codigo_inep}/roadmap`, badge: null },
  ] : [];

  const primaryItems = isAdmin ? adminMenuItems : schoolMenuItems;
  const secondaryItems = isAdmin ? adminSecondaryItems : [];

  return (
    <>
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 h-screen bg-slate-950 text-white flex flex-col transition-all duration-300 ease-in-out border-r border-slate-800",
          collapsed ? 'w-16' : 'w-56'
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-3 py-4 border-b border-slate-800/50">
          <div className={cn(
            "flex items-center gap-3 transition-all",
            collapsed ? 'justify-center w-full' : ''
          )}>
            <div className="h-9 w-9 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-500/20">
              <Crown className="h-5 w-5 text-white" />
            </div>
            {!collapsed && (
              <div className="overflow-hidden">
                <span className="text-base font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">X-TRI</span>
                <span className="text-[10px] text-slate-500 block -mt-0.5">Analytics</span>
              </div>
            )}
          </div>
        </div>

        {/* Toggle Button */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-20 h-6 w-6 bg-slate-800 hover:bg-slate-700 rounded-full flex items-center justify-center border border-slate-700 transition-colors shadow-lg"
        >
          {collapsed ? (
            <ChevronRight className="h-3 w-3 text-slate-400" />
          ) : (
            <ChevronLeft className="h-3 w-3 text-slate-400" />
          )}
        </button>

        {/* Navigation - Primary */}
        <nav className="flex-1 px-2 py-3 overflow-y-auto scrollbar-hide">
          {!collapsed && (
            <div className="px-3 mb-2">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                Menu Principal
              </span>
            </div>
          )}
          
          <ul className="space-y-1">
            {primaryItems.map((item, idx) => {
              const isActive = pathname === item.href ||
                (item.href !== '/' && pathname?.startsWith(item.href));

              return (
                <li key={idx}>
                  <MenuItem 
                    item={item} 
                    isActive={isActive} 
                    collapsed={collapsed} 
                  />
                </li>
              );
            })}
          </ul>

          {/* Secondary Items */}
          {secondaryItems.length > 0 && (
            <>
              {!collapsed && (
                <div className="px-3 mt-4 mb-2">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                    Administração
                  </span>
                </div>
              )}
              <ul className="space-y-1">
                {secondaryItems.map((item, idx) => {
                  const isActive = pathname === item.href ||
                    (item.href !== '/' && pathname?.startsWith(item.href));

                  return (
                    <li key={idx}>
                      <MenuItem 
                        item={item} 
                        isActive={isActive} 
                        collapsed={collapsed} 
                      />
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </nav>

        {/* Bottom Section */}
        <div className="px-2 py-3 border-t border-slate-800/50 space-y-1">
          {/* Contact Button */}
          <button
            onClick={() => setIsContactOpen(true)}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800/50 transition-all duration-200 group relative",
              collapsed ? "justify-center" : ""
            )}
            title={collapsed ? "Fale Conosco" : undefined}
          >
            <div className="p-1.5 rounded-lg bg-slate-800 group-hover:bg-slate-700 transition-colors">
              <MessageCircle className="h-4 w-4" />
            </div>
            {!collapsed && <span className="flex-1">Fale Conosco</span>}
            
            {collapsed && (
              <div className="absolute left-full ml-2 px-3 py-1.5 bg-slate-800 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
                Fale Conosco
              </div>
            )}
          </button>

          {/* Logout */}
          {isAuthenticated && (
            <button
              onClick={logout}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200 group relative w-full",
                collapsed ? "justify-center" : ""
              )}
              title={collapsed ? "Sair" : undefined}
            >
              <div className="p-1.5 rounded-lg bg-slate-800 group-hover:bg-red-500/20 transition-colors">
                <LogOut className="h-4 w-4" />
              </div>
              {!collapsed && <span className="flex-1">Sair</span>}
              
              {collapsed && (
                <div className="absolute left-full ml-2 px-3 py-1.5 bg-slate-800 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
                  Sair
                </div>
              )}
            </button>
          )}
        </div>

        {/* User Info (when expanded) */}
        {isAuthenticated && user && !collapsed && (
          <div className="px-3 py-3 border-t border-slate-800/50">
            <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-slate-900/50">
              <div className="h-8 w-8 bg-gradient-to-br from-slate-700 to-slate-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-white">
                  {user.nome_escola?.substring(0, 2).toUpperCase() || 'US'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-white truncate">{user.nome_escola || 'Usuário'}</p>
                <p className="text-[10px] text-slate-500 truncate">{user.email}</p>
              </div>
            </div>
          </div>
        )}
      </aside>

      <ContactModal isOpen={isContactOpen} onClose={() => setIsContactOpen(false)} />
    </>
  );
}
