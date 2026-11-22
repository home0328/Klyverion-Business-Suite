import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpCircle,
  CheckCircle2,
  Database,
  Download,
  History,
  Lock,
  Package,
  Power,
  Search,
  Settings,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react';
import { ApiError, apiRequest } from '../api';
import type { AuthUser, ModuleItem } from '../types';

interface AppCenterViewProps {
  user: AuthUser;
  onModulesUpdated: () => void;
}

export const AppCenterView: React.FC<AppCenterViewProps> = ({ user, onModulesUpdated }) => {
  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'updates'>('all');
  const [busySlug, setBusySlug] = useState<string | null>(null);

  // Module Configuration / History / Purge Modal
  const [selectedMod, setSelectedMod] = useState<ModuleItem | null>(null);
  const [modalTab, setModalTab] = useState<'settings' | 'history' | 'retention'>('settings');
  const [settingsLazy, setSettingsLazy] = useState(true);
  const [settingsAudit, setSettingsAudit] = useState(true);
  const [settingsNotes, setSettingsNotes] = useState('');
  const [confirmPurgeSlug, setConfirmPurgeSlug] = useState('');
  const [backupDownloaded, setBackupDownloaded] = useState(false);

  const canManage = user.roleSlug === 'superadmin' || user.permissions.includes('core.modules.manage');
  const canPurge = user.roleSlug === 'superadmin' || user.permissions.includes('core.backup.manage');

  const loadModules = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest<{ modules: ModuleItem[] }>('/modules');
      setModules(res.modules);
      if (selectedMod) {
        const refreshed = res.modules.find((m) => m.slug === selectedMod.slug);
        if (refreshed) setSelectedMod(refreshed);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao listar módulos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadModules();
  }, []);

  const openModuleModal = (mod: ModuleItem) => {
    setSelectedMod(mod);
    setModalTab('settings');
    setSettingsLazy(mod.settings?.lazyLoad !== false);
    setSettingsAudit(mod.settings?.auditEvents !== false);
    setSettingsNotes(typeof mod.settings?.notes === 'string' ? mod.settings.notes : '');
    setConfirmPurgeSlug('');
    setBackupDownloaded(false);
  };

  const handleToggleModule = async (mod: ModuleItem) => {
    if (!canManage) return;
    setBusySlug(mod.slug);
    setError(null);
    setFeedback(null);
    try {
      const endpoint = mod.status === 'active' ? `/modules/${mod.slug}/deactivate` : `/modules/${mod.slug}/activate`;
      await apiRequest(endpoint, { method: 'POST' });
      setFeedback(
        mod.status === 'active'
          ? `${mod.name} desativado com preservação integral dos dados.`
          : `${mod.name} ativado e registrado no barramento do Klyverion Core.`
      );
      await loadModules();
      onModulesUpdated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao alterar estado do módulo.');
    } finally {
      setBusySlug(null);
    }
  };

  const handleUpdateModule = async (mod: ModuleItem) => {
    if (!canManage) return;
    setBusySlug(mod.slug);
    setError(null);
    setFeedback(null);
    try {
      await apiRequest(`/modules/${mod.slug}/update`, { method: 'POST' });
      setFeedback(`${mod.name} atualizado para a versão ${mod.latestVersion}.`);
      await loadModules();
      onModulesUpdated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Falha na atualização do módulo.');
    } finally {
      setBusySlug(null);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMod || !canManage) return;
    setBusySlug(selectedMod.slug);
    setError(null);
    try {
      await apiRequest(`/modules/${selectedMod.slug}/settings`, {
        method: 'PUT',
        body: JSON.stringify({
          settings: {
            lazyLoad: settingsLazy,
            auditEvents: settingsAudit,
            notes: settingsNotes,
          },
        }),
      });
      setFeedback(`Configurações de ${selectedMod.name} salvas.`);
      await loadModules();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Falha ao salvar configurações.');
    } finally {
      setBusySlug(null);
    }
  };

  const handleDownloadModuleBackup = () => {
    if (!selectedMod) return;
    const blob = new Blob(
      [
        JSON.stringify(
          {
            exportedAt: new Date().toISOString(),
            module: selectedMod.slug,
            version: selectedMod.version,
            settings: selectedMod.settings,
            history: selectedMod.history,
          },
          null,
          2
        ),
      ],
      { type: 'application/json' }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedMod.slug}-backup.json`;
    a.click();
    URL.revokeObjectURL(url);
    setBackupDownloaded(true);
  };

  const handlePurgeData = async () => {
    if (!selectedMod || !canPurge) return;
    setBusySlug(selectedMod.slug);
    setError(null);
    try {
      await apiRequest(`/modules/${selectedMod.slug}/purge`, {
        method: 'POST',
        body: JSON.stringify({ confirmSlug: confirmPurgeSlug, backupDownloaded }),
      });
      setFeedback(`Expurgo definitivo concluído para ${selectedMod.name}.`);
      setSelectedMod(null);
      await loadModules();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível expurgar os dados.');
    } finally {
      setBusySlug(null);
    }
  };

  const moduleNameMap = new Map(modules.map((m) => [m.slug, m]));

  const filtered = modules.filter((m) => {
    const matchesSearch =
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.description.toLowerCase().includes(search.toLowerCase()) ||
      m.category.toLowerCase().includes(search.toLowerCase()) ||
      m.code.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;
    if (statusFilter === 'active') return m.status === 'active';
    if (statusFilter === 'inactive') return m.status === 'inactive';
    if (statusFilter === 'updates') return m.version !== m.latestVersion;
    return true;
  });

  const activeCount = modules.filter((m) => m.status === 'active').length;
  const updateCount = modules.filter((m) => m.version !== m.latestVersion).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-slate-900 dark:text-slate-100">
            Klyverion App Center
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
            Central de governança modular. Desativar um módulo preserva dados e histórico sem exclusão automática.
          </p>
        </div>

        <div className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
          {activeCount} ativos · {modules.length - activeCount} inativos · {updateCount} atualizações disponíveis
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-200/70 dark:bg-slate-800 w-fit">
          {[
            { id: 'all', label: `Todos (${modules.length})` },
            { id: 'active', label: `Ativos (${activeCount})` },
            { id: 'inactive', label: `Inativos (${modules.length - activeCount})` },
            { id: 'updates', label: `Atualizações (${updateCount})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id as typeof statusFilter)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                statusFilter === tab.id
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar módulo, código ou categoria..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>
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

      {loading && modules.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-52 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((mod) => {
            const hasUpdate = mod.version !== mod.latestVersion;
            const unmetDeps = mod.dependencies.filter((d) => moduleNameMap.get(d)?.status !== 'active');
            const isBusy = busySlug === mod.slug;

            return (
              <article
                key={mod.slug}
                className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                        {mod.code} · Fase {mod.phase} · {mod.category}
                      </div>
                      <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100 mt-1 flex items-center gap-2">
                        <Package className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                        <span>{mod.name}</span>
                      </h2>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="font-mono text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                        v{mod.version}
                      </div>
                      <div
                        className={`inline-flex items-center gap-1 text-xs font-medium mt-0.5 ${
                          mod.status === 'active'
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {mod.status === 'active' ? (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        ) : (
                          <Power className="w-3.5 h-3.5" />
                        )}
                        <span>{mod.status === 'active' ? 'Ativo' : 'Inativo'}</span>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {mod.description}
                  </p>

                  {mod.dependencies.length > 0 && (
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-medium text-slate-700 dark:text-slate-300">Dependências: </span>
                      {mod.dependencies
                        .map((dep) => {
                          const target = moduleNameMap.get(dep);
                          const ok = target?.status === 'active';
                          return `${target?.name ?? dep} (${ok ? 'ativa' : 'inativa'})`;
                        })
                        .join(' · ')}
                    </div>
                  )}

                  {unmetDeps.length > 0 && mod.status === 'inactive' && (
                    <div className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>Requer ativação prévia das dependências listadas acima.</span>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openModuleModal(mod)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
                    >
                      <Settings className="w-3.5 h-3.5" />
                      <span>Configurar</span>
                    </button>

                    {hasUpdate && canManage && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handleUpdateModule(mod)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors whitespace-nowrap shrink-0"
                      >
                        <ArrowUpCircle className="w-3.5 h-3.5" />
                        <span>v{mod.latestVersion}</span>
                      </button>
                    )}
                  </div>

                  {mod.isCore ? (
                    <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      <Lock className="w-3.5 h-3.5" />
                      <span>Obrigatório</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={!canManage || isBusy}
                      onClick={() => void handleToggleModule(mod)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 disabled:opacity-50 ${
                        mod.status === 'active'
                          ? 'border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                          : 'bg-blue-600 hover:bg-blue-700 text-white'
                      }`}
                    >
                      {isBusy ? 'Processando...' : mod.status === 'active' ? 'Desativar' : 'Ativar Módulo'}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Module Detail / Config / History / Retention Modal */}
      {selectedMod && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-2xl rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5 max-h-[88vh] flex flex-col">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-mono text-xs text-slate-500 dark:text-slate-400">
                  {selectedMod.slug} · v{selectedMod.version} · Core mín. v{selectedMod.minCoreVersion}
                </div>
                <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                  {selectedMod.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedMod(null)}
                aria-label="Fechar modal"
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800 w-fit">
              <button
                type="button"
                onClick={() => setModalTab('settings')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  modalTab === 'settings'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Configurações & Contrato
              </button>
              <button
                type="button"
                onClick={() => setModalTab('history')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  modalTab === 'history'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>Histórico ({selectedMod.history.length})</span>
              </button>
              {!selectedMod.isCore && (
                <button
                  type="button"
                  onClick={() => setModalTab('retention')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    modalTab === 'retention'
                      ? 'bg-white dark:bg-slate-900 text-red-700 dark:text-red-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <Database className="w-3.5 h-3.5" />
                  <span>Retenção & Expurgo</span>
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto space-y-4">
              {modalTab === 'settings' && (
                <form onSubmit={handleSaveSettings} className="space-y-4">
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-slate-700 dark:text-slate-300">Funcionalidades Previstas</div>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                      {selectedMod.features.map((f) => (
                        <li key={f}>· {f}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="text-xs text-slate-600 dark:text-slate-400">
                    <span className="font-medium text-slate-700 dark:text-slate-300">Permissões requeridas: </span>
                    <span className="font-mono">{selectedMod.requiredPermissions.join(', ')}</span>
                  </div>

                  <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3">
                    <label className="flex items-center justify-between gap-3 text-xs cursor-pointer">
                      <div>
                        <div className="font-medium text-slate-800 dark:text-slate-200">Carregamento sob demanda (Lazy Load)</div>
                        <div className="text-slate-500 dark:text-slate-400">Evita inicialização simultânea em rotas não relacionadas.</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={settingsLazy}
                        disabled={!canManage}
                        onChange={(e) => setSettingsLazy(e.target.checked)}
                      />
                    </label>

                    <label className="flex items-center justify-between gap-3 text-xs cursor-pointer">
                      <div>
                        <div className="font-medium text-slate-800 dark:text-slate-200">Auditoria detalhada no EventBus</div>
                        <div className="text-slate-500 dark:text-slate-400">Registra mutações críticas deste módulo na trilha global.</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={settingsAudit}
                        disabled={!canManage}
                        onChange={(e) => setSettingsAudit(e.target.checked)}
                      />
                    </label>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Notas administrativas internas
                      </label>
                      <textarea
                        rows={2}
                        disabled={!canManage}
                        value={settingsNotes}
                        onChange={(e) => setSettingsNotes(e.target.value)}
                        placeholder="Observações operacionais do módulo..."
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                      />
                    </div>
                  </div>

                  {canManage && (
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={busySlug === selectedMod.slug}
                        className="px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        Salvar Configurações do Módulo
                      </button>
                    </div>
                  )}
                </form>
              )}

              {modalTab === 'history' && (
                <div className="divide-y divide-slate-200 dark:divide-slate-800 border-y border-slate-200 dark:border-slate-800">
                  {selectedMod.history.length === 0 ? (
                    <p className="py-6 text-xs text-slate-500 dark:text-slate-400 text-center">
                      Nenhuma alteração registrada ainda para este módulo.
                    </p>
                  ) : (
                    selectedMod.history.map((h) => (
                      <div key={h.id} className="py-3 flex items-start justify-between gap-4 text-xs">
                        <div>
                          <div className="font-medium text-slate-900 dark:text-slate-100">
                            {h.event_type} · v{h.version}
                          </div>
                          <div className="text-slate-600 dark:text-slate-400 mt-0.5">{h.notes}</div>
                          <div className="text-slate-500 dark:text-slate-500 mt-0.5">Responsável: {h.actor_name}</div>
                        </div>
                        <span className="font-mono text-slate-500 dark:text-slate-400 tabular-nums shrink-0">
                          {new Date(h.created_at).toLocaleString('pt-BR')}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}

              {modalTab === 'retention' && !selectedMod.isCore && (
                <div className="space-y-4">
                  <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs space-y-2">
                    <div className="font-medium text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      <span>Política de Preservação de Dados</span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-400">
                      A desativação simples mantém todas as tabelas e configurações intactas ({selectedMod.dataRetainedRecords} registros retidos). Para exclusão definitiva, desative o módulo, gere um backup e confirme o identificador exato.
                    </p>
                    <button
                      type="button"
                      onClick={handleDownloadModuleBackup}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{backupDownloaded ? 'Backup JSON Baixado' : 'Gerar Backup Antes de Excluir'}</span>
                    </button>
                  </div>

                  {canPurge ? (
                    <div className="space-y-3 pt-2">
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                        Digite <span className="font-mono text-red-600 dark:text-red-400">{selectedMod.slug}</span> para liberar a exclusão definitiva dos dados:
                      </label>
                      <input
                        type="text"
                        value={confirmPurgeSlug}
                        onChange={(e) => setConfirmPurgeSlug(e.target.value)}
                        placeholder={selectedMod.slug}
                        className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                      />
                      <button
                        type="button"
                        disabled={selectedMod.status === 'active' || confirmPurgeSlug !== selectedMod.slug || busySlug === selectedMod.slug}
                        onClick={() => void handlePurgeData()}
                        className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>
                          {selectedMod.status === 'active' ? 'Desative o módulo primeiro' : 'Excluir Dados Definitivamente'}
                        </span>
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Seu perfil não possui a permissão <span className="font-mono">core.backup.manage</span> para expurgo de dados.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
