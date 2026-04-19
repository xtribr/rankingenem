'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api, User } from '@/lib/api';
import {
  Users,
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  Check,
  AlertCircle,
  Shield,
  ShieldOff,
  Eye,
  EyeOff,
  Loader2,
} from 'lucide-react';

interface SchoolSearchResult {
  codigo_inep: string;
  nome_escola: string;
  uf: string | null;
  ultimo_ano: number;
}

interface UserFormData {
  codigo_inep: string;
  nome_escola: string;
  email: string;
  password: string;
  is_admin: boolean;
}

function UserModal({
  isOpen,
  onClose,
  onSave,
  user,
  isEdit,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  user: User | null;
  isEdit: boolean;
}) {
  // Form data is initialized from props on mount. The parent forces a fresh
  // mount via `key` whenever `user` or `isOpen` changes, so the state stays in
  // sync without a setState-in-effect.
  const [formData, setFormData] = useState<UserFormData>(() =>
    isEdit && user
      ? {
          codigo_inep: user.codigo_inep,
          nome_escola: user.nome_escola,
          email: user.email || '',
          password: '',
          is_admin: user.is_admin,
        }
      : {
          codigo_inep: '',
          nome_escola: '',
          email: '',
          password: '',
          is_admin: false,
        }
  );
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // School search state
  const [searchQuery, setSearchQuery] = useState(() =>
    isEdit && user ? user.nome_escola : ''
  );
  const [searchResults, setSearchResults] = useState<SchoolSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Search schools with debounce
  const searchSchools = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const results = await api.searchSchools(query, 15);
      setSearchResults(results);
      setShowDropdown(true);
    } catch (err) {
      console.error('Search error:', err);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Handle search input change with debounce
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Debounce search
    searchTimeoutRef.current = setTimeout(() => {
      searchSchools(value);
    }, 300);
  };

  // Handle school selection
  const handleSelectSchool = (school: SchoolSearchResult) => {
    setFormData({
      ...formData,
      codigo_inep: school.codigo_inep,
      nome_escola: school.nome_escola,
    });
    setSearchQuery(school.nome_escola);
    setShowDropdown(false);
    setSearchResults([]);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (isEdit && user) {
        // Update user - now supports password changes via Supabase Auth
        const updateData: { nome_escola: string; is_admin: boolean; password?: string } = {
          nome_escola: formData.nome_escola,
          is_admin: formData.is_admin,
        };
        // Only include password if provided
        if (formData.password) {
          updateData.password = formData.password;
        }
        await api.updateUser(user.id, updateData);
      } else {
        await api.createUser(formData);
      }
      onSave();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar usuário');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="sticky top-0 bg-gradient-to-r from-sky-400 to-orange-500 px-6 py-4 rounded-t-2xl">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
          >
            <X className="h-5 w-5 text-white" />
          </button>
          <h2 className="text-lg font-bold text-white">
            {isEdit ? 'Editar Escola' : 'Nova Escola'}
          </h2>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-700 text-sm">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* School Search Dropdown */}
          <div ref={dropdownRef} className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Buscar Escola *
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                required={!isEdit}
                disabled={isEdit}
                value={searchQuery}
                onChange={handleSearchChange}
                onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
                className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-gray-200 focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 outline-none transition-all text-gray-900 disabled:bg-gray-100"
                placeholder="Digite o nome da escola..."
              />
              {isSearching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 animate-spin" />
              )}
            </div>

            {/* Dropdown Results */}
            {showDropdown && searchResults.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                {searchResults.map((school) => (
                  <button
                    key={school.codigo_inep}
                    type="button"
                    onClick={() => handleSelectSchool(school)}
                    className="w-full px-4 py-3 text-left hover:bg-sky-50 transition-colors border-b border-gray-100 last:border-b-0"
                  >
                    <div className="font-medium text-gray-900 text-sm">{school.nome_escola}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      INEP: {school.codigo_inep} • {school.uf || 'N/A'}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {showDropdown && searchQuery.length >= 2 && searchResults.length === 0 && !isSearching && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg p-4 text-center text-gray-500 text-sm">
                Nenhuma escola encontrada
              </div>
            )}
          </div>

          {/* INEP Code (readonly, auto-filled) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Código INEP
            </label>
            <input
              type="text"
              readOnly
              value={formData.codigo_inep}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 font-mono"
              placeholder="Selecione uma escola acima"
            />
            {!formData.codigo_inep && !isEdit && (
              <p className="text-xs text-gray-500 mt-1">O código será preenchido automaticamente</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email *
            </label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 outline-none transition-all text-gray-900"
              placeholder="escola@email.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Senha {isEdit ? '(deixe em branco para manter)' : '*'}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required={!isEdit}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-4 py-2.5 pr-12 rounded-xl border border-gray-200 focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 outline-none transition-all text-gray-900"
                placeholder={isEdit ? '••••••••' : 'Senha de acesso'}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
            <button
              type="button"
              onClick={() => setFormData({ ...formData, is_admin: !formData.is_admin })}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                formData.is_admin ? 'bg-orange-500' : 'bg-gray-300'
              }`}
            >
              <span
                className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  formData.is_admin ? 'translate-x-6' : ''
                }`}
              />
            </button>
            <div>
              <p className="text-sm font-medium text-gray-900">Administrador</p>
              <p className="text-xs text-gray-500">Pode gerenciar outros usuários</p>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 bg-gradient-to-r from-sky-400 to-orange-500 text-white font-semibold py-2.5 rounded-xl hover:from-sky-500 hover:to-orange-600 transition-all disabled:opacity-70 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Check className="h-5 w-5" />
                  Salvar
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function UsersPage() {
  const router = useRouter();
  const { session, user, isLoading: authLoading, isAdmin } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !session) {
      router.push('/login');
      return;
    }

    if (!authLoading && user && !isAdmin) {
      router.push('/');
    }
  }, [authLoading, isAdmin, router, session, user]);

  const [loadError, setLoadError] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setLoadError(null);
    try {
      const data = await api.listUsers();
      setUsers(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao carregar usuários';
      console.error('Error loading users:', error);
      setLoadError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadUsersRef = useRef(loadUsers);
  loadUsersRef.current = loadUsers;

  useEffect(() => {
    if (!isAdmin) return;

    // Kick the fetch in a microtask so the effect body itself does not run any
    // synchronous setState — avoids react-hooks/set-state-in-effect while keeping
    // behavior identical (the fetch still starts immediately after mount).
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        void loadUsersRef.current();
      }
    });
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDelete = async (userId: string) => {
    if (!confirm('Deseja realmente desativar este usuário?')) {
      return;
    }

    setDeleteError(null);
    setDeletingId(userId);
    try {
      await api.deleteUser(userId);
      await loadUsers();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao desativar usuário';
      console.error('[handleDelete] Error:', error);
      setDeleteError(message);
      // Clear error after 10 seconds
      setTimeout(() => setDeleteError(null), 10000);
    } finally {
      setDeletingId(null);
    }
  };

  const filteredUsers = users.filter(
    (user) =>
      user.nome_escola.toLowerCase().includes(search.toLowerCase()) ||
      (user.email && user.email.toLowerCase().includes(search.toLowerCase())) ||
      user.codigo_inep.includes(search)
  );

  if (authLoading || (session && !user)) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 border-4 border-sky-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session || !user || !isAdmin) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gerenciar Escolas</h1>
          <p className="text-gray-500">{users.length} escolas cadastradas</p>
        </div>
        <button
          onClick={() => {
            setEditingUser(null);
            setIsModalOpen(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-sky-400 to-orange-500 text-white font-medium rounded-xl hover:from-sky-500 hover:to-orange-600 transition-all shadow-lg"
        >
          <Plus className="h-5 w-5" />
          Adicionar Escola
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome, email ou código INEP..."
          className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 outline-none transition-all text-gray-900"
        />
      </div>

      {/* Error Alerts */}
      {(deleteError || loadError) && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span>{deleteError || loadError}</span>
          {loadError && (
            <button
              onClick={() => { setIsLoading(true); loadUsers(); }}
              className="ml-2 px-3 py-1 bg-red-100 hover:bg-red-200 rounded-lg text-sm font-medium"
            >
              Tentar novamente
            </button>
          )}
          <button
            onClick={() => { setDeleteError(null); setLoadError(null); }}
            className="ml-auto p-1 hover:bg-red-100 rounded-full"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">
                  Escola
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">
                  Código INEP
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">
                  Email
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">
                  Tipo
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="h-8 w-8 border-4 border-sky-400 border-t-transparent rounded-full animate-spin mx-auto" />
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    {search ? 'Nenhum usuário encontrado' : 'Nenhuma escola cadastrada'}
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-sky-100 rounded-lg flex items-center justify-center">
                          <Users className="h-5 w-5 text-sky-600" />
                        </div>
                        <span className="font-medium text-gray-900">{user.nome_escola}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600 font-mono">{user.codigo_inep}</td>
                    <td className="px-6 py-4 text-gray-600">{user.email}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                          user.is_active
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {user.is_active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {user.is_admin ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                          <Shield className="h-3 w-3" />
                          Admin
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                          <ShieldOff className="h-3 w-3" />
                          Escola
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setEditingUser(user);
                            setIsModalOpen(true);
                          }}
                          className="p-2 text-gray-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(user.id)}
                          disabled={deletingId === user.id}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                          title="Desativar"
                        >
                          {deletingId === user.id ? (
                            <div className="h-4 w-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal — key forces a fresh mount whenever the target user changes,
          so the form state is re-initialized from props without a useEffect. */}
      <UserModal
        key={`${editingUser?.id ?? 'new'}:${isModalOpen}`}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingUser(null);
        }}
        onSave={loadUsers}
        user={editingUser}
        isEdit={!!editingUser}
      />
    </div>
  );
}
