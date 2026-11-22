import React, { useEffect, useState } from 'react';
import { CheckCircle2, Lock, Plus, Shield, UserPlus, Users, X } from 'lucide-react';
import { ApiError, apiRequest } from '../api';
import type { AuthUser, PermissionCatalogItem, RoleItem, SystemUser } from '../types';

interface UsersRbacViewProps {
  currentUser: AuthUser;
}

export const UsersRbacView: React.FC<UsersRbacViewProps> = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState<'users' | 'roles'>('users');
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [permCatalog, setPermCatalog] = useState<PermissionCatalogItem[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [draftPerms, setDraftPerms] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [savingPerms, setSavingPerms] = useState(false);

  // Create user modal
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserDept, setNewUserDept] = useState('Comercial');
  const [newUserRoleId, setNewUserRoleId] = useState<number>(0);

  // Create role modal
  const [showCreateRole, setShowCreateRole] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');

  const canManageUsers = currentUser.roleSlug === 'superadmin' || currentUser.permissions.includes('core.users.manage');
  const canManageRoles = currentUser.roleSlug === 'superadmin' || currentUser.permissions.includes('core.roles.manage');

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [usersRes, rolesRes] = await Promise.all([
        apiRequest<{ users: SystemUser[] }>('/users'),
        apiRequest<{ roles: RoleItem[]; permissionCatalog: PermissionCatalogItem[] }>('/roles'),
      ]);
      setUsers(usersRes.users);
      setRoles(rolesRes.roles);
      setPermCatalog(rolesRes.permissionCatalog);

      if (rolesRes.roles.length > 0) {
        const currentSelected = rolesRes.roles.find((r) => r.id === selectedRoleId) ?? rolesRes.roles[0];
        setSelectedRoleId(currentSelected.id);
        setDraftPerms(currentSelected.permissions);
        if (newUserRoleId === 0) {
          setNewUserRoleId(rolesRes.roles[rolesRes.roles.length - 1].id);
        }
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Falha ao carregar usuários e permissões.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleSelectRole = (role: RoleItem) => {
    setSelectedRoleId(role.id);
    setDraftPerms(role.permissions);
    setFeedback(null);
    setError(null);
  };

  const handleTogglePerm = (permKey: string) => {
    if (!canManageRoles || selectedRole?.slug === 'superadmin') return;
    setDraftPerms((prev) => (prev.includes(permKey) ? prev.filter((k) => k !== permKey) : [...prev, permKey]));
  };

  const handleSaveRolePermissions = async () => {
    if (!selectedRoleId || !canManageRoles) return;
    setSavingPerms(true);
    setError(null);
    setFeedback(null);
    try {
      await apiRequest(`/roles/${selectedRoleId}/permissions`, {
        method: 'PUT',
        body: JSON.stringify({ permissions: draftPerms }),
      });
      setFeedback('Matriz de permissões atualizada com verificação imediata no servidor.');
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao atualizar permissões.');
    } finally {
      setSavingPerms(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFeedback(null);
    try {
      await apiRequest('/users', {
        method: 'POST',
        body: JSON.stringify({
          name: newUserName,
          email: newUserEmail,
          password: newUserPassword,
          department: newUserDept,
          roleId: newUserRoleId,
        }),
      });
      setShowCreateUser(false);
      setNewUserName('');
      setNewUserEmail('');
      setNewUserPassword('');
      setFeedback('Usuário criado com senha criptografada (scrypt) e registrado na auditoria.');
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao criar usuário.');
    }
  };

  const handleUpdateUser = async (target: SystemUser, patch: { status?: 'active' | 'suspended'; roleId?: number }) => {
    setError(null);
    setFeedback(null);
    try {
      await apiRequest(`/users/${target.id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      setFeedback(`Cadastro de ${target.name} atualizado.`);
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao atualizar usuário.');
    }
  };

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFeedback(null);
    try {
      const created = await apiRequest<{ id: number }>('/roles', {
        method: 'POST',
        body: JSON.stringify({
          name: newRoleName,
          description: newRoleDesc,
          permissions: ['core.dashboard.view', 'records.view'],
        }),
      });
      setShowCreateRole(false);
      setNewRoleName('');
      setNewRoleDesc('');
      setSelectedRoleId(created.id);
      setFeedback('Perfil personalizado criado. Ajuste as capacidades granulares ao lado.');
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao criar perfil.');
    }
  };

  const selectedRole = roles.find((r) => r.id === selectedRoleId) ?? null;
  const groups = Array.from(new Set(permCatalog.map((p) => p.group)));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-slate-900 dark:text-slate-100">
            Usuários e Controle de Acesso (RBAC)
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
            9 perfis iniciais do sistema, criação de funções personalizadas e validação estrita no servidor.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {activeTab === 'users' && canManageUsers && (
            <button
              type="button"
              onClick={() => setShowCreateUser(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap shrink-0"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Novo Usuário</span>
            </button>
          )}
          {activeTab === 'roles' && canManageRoles && (
            <button
              type="button"
              onClick={() => setShowCreateRole(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Novo Perfil Personalizado</span>
            </button>
          )}
        </div>
      </div>

      {/* Sub-navigation */}
      <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-200/70 dark:bg-slate-800 w-fit">
        <button
          type="button"
          onClick={() => setActiveTab('users')}
          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
            activeTab === 'users'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Usuários ({users.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('roles')}
          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
            activeTab === 'roles'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          <Shield className="w-3.5 h-3.5" />
          <span>Perfis e Permissões ({roles.length})</span>
        </button>
      </div>

      {feedback && (
        <div className="p-3.5 rounded-lg border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/30 text-xs text-emerald-800 dark:text-emerald-300">
          {feedback}
        </div>
      )}

      {error && (
        <div role="alert" className="p-3.5 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 text-xs text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {loading && roles.length === 0 ? (
        <div className="h-64 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 animate-pulse" />
      ) : activeTab === 'users' ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400">
                <th className="py-3 px-4">Nome</th>
                <th className="py-3 px-4">E-mail</th>
                <th className="py-3 px-4">Departamento</th>
                <th className="py-3 px-4">Perfil RBAC</th>
                <th className="py-3 px-4">Estado</th>
                <th className="py-3 px-4 text-right">Último Acesso</th>
                {canManageUsers && <th className="py-3 px-4 text-right">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="py-3 px-4 font-medium text-slate-900 dark:text-slate-100">{u.name}</td>
                  <td className="py-3 px-4 text-slate-600 dark:text-slate-300 font-mono">{u.email}</td>
                  <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{u.department}</td>
                  <td className="py-3 px-4">
                    {canManageUsers && u.id !== currentUser.id ? (
                      <select
                        value={u.role_id}
                        onChange={(e) => void handleUpdateUser(u, { roleId: Number(e.target.value) })}
                        className="px-2 py-1 text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200"
                      >
                        {roles.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-slate-800 dark:text-slate-200">{u.role_name}</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex items-center gap-1 font-medium ${
                        u.status === 'active'
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-red-700 dark:text-red-400'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{u.status === 'active' ? 'Ativo' : 'Suspenso'}</span>
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                    {u.last_login_at ? new Date(u.last_login_at).toLocaleString('pt-BR') : 'Nunca'}
                  </td>
                  {canManageUsers && (
                    <td className="py-3 px-4 text-right">
                      {u.id === currentUser.id ? (
                        <span className="text-slate-400">Sessão atual</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            void handleUpdateUser(u, { status: u.status === 'active' ? 'suspended' : 'active' })
                          }
                          className="px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                        >
                          {u.status === 'active' ? 'Suspender' : 'Reativar'}
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Roles List */}
          <div className="lg:col-span-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 divide-y divide-slate-200 dark:divide-slate-800">
            {roles.map((role) => {
              const active = role.id === selectedRoleId;
              return (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => handleSelectRole(role)}
                  className={`w-full text-left px-4 py-3.5 transition-colors ${
                    active ? 'bg-blue-50/70 dark:bg-blue-950/30' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{role.name}</span>
                    <span className="font-mono text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      {role.permissions.length} cap.
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">{role.description}</p>
                  <div className="text-[11px] font-mono text-slate-400 mt-1">
                    {role.slug} · {role.isSystem ? 'Perfil Padrão' : 'Personalizado'}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right: Granular Permission Matrix */}
          <div className="lg:col-span-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-6">
            {selectedRole && (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
                  <div>
                    <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">
                      {selectedRole.name}
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{selectedRole.description}</p>
                  </div>
                  {selectedRole.slug === 'superadmin' ? (
                    <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      <Lock className="w-3.5 h-3.5" />
                      <span>Acesso integral protegido</span>
                    </span>
                  ) : (
                    canManageRoles && (
                      <button
                        type="button"
                        disabled={savingPerms}
                        onClick={() => void handleSaveRolePermissions()}
                        className="px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-60 whitespace-nowrap shrink-0"
                      >
                        {savingPerms ? 'Salvando...' : 'Salvar Matriz RBAC'}
                      </button>
                    )
                  )}
                </div>

                <div className="space-y-6">
                  {groups.map((groupName) => {
                    const items = permCatalog.filter((p) => p.group === groupName);
                    return (
                      <div key={groupName} className="space-y-2.5">
                        <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300">{groupName}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                          {items.map((perm) => {
                            const checked =
                              selectedRole.slug === 'superadmin' || draftPerms.includes(perm.key);
                            return (
                              <label
                                key={perm.key}
                                className={`flex items-start gap-2.5 p-3 rounded-lg border text-xs transition-colors ${
                                  checked
                                    ? 'border-blue-200 dark:border-blue-900/70 bg-blue-50/40 dark:bg-blue-950/20'
                                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40'
                                } ${
                                  canManageRoles && selectedRole.slug !== 'superadmin'
                                    ? 'cursor-pointer'
                                    : 'cursor-default opacity-80'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={!canManageRoles || selectedRole.slug === 'superadmin'}
                                  onChange={() => handleTogglePerm(perm.key)}
                                  className="mt-0.5 rounded border-slate-300 text-blue-600"
                                />
                                <div>
                                  <div className="font-medium text-slate-900 dark:text-slate-100">{perm.label}</div>
                                  <div className="text-slate-500 dark:text-slate-400 mt-0.5">{perm.description}</div>
                                  <div className="font-mono text-[11px] text-slate-400 mt-1">{perm.key}</div>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {showCreateUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <form
            onSubmit={handleCreateUser}
            className="w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">
                Cadastrar Usuário
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateUser(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Nome Completo</label>
              <input
                type="text"
                required
                minLength={2}
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">E-mail</label>
              <input
                type="email"
                required
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Perfil RBAC</label>
                <select
                  value={newUserRoleId}
                  onChange={(e) => setNewUserRoleId(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Departamento</label>
                <input
                  type="text"
                  value={newUserDept}
                  onChange={(e) => setNewUserDept(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Senha Inicial (mín. 8 caracteres)
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={newUserPassword}
                onChange={(e) => setNewUserPassword(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCreateUser(false)}
                className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
              >
                Criar Usuário
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Create Custom Role Modal */}
      {showCreateRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <form
            onSubmit={handleCreateRole}
            className="w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">
                Novo Perfil Personalizado
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateRole(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Nome do Perfil</label>
              <input
                type="text"
                required
                minLength={3}
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                placeholder="Ex.: Auditor Fiscal"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Descrição</label>
              <textarea
                rows={2}
                value={newRoleDesc}
                onChange={(e) => setNewRoleDesc(e.target.value)}
                placeholder="Escopo de atuação e responsabilidades..."
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCreateRole(false)}
                className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
              >
                Criar Perfil
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
