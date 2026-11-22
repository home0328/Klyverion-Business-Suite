import React, { useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  RefreshCw,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { ApiError, apiRequest } from '../api';
import type { AuthUser, DashboardSummaryResponse, DashboardWidget } from '../types';

interface DashboardViewProps {
  user: AuthUser;
  onNavigate: (tab: 'dashboard' | 'app-center' | 'rbac' | 'architecture' | 'settings') => void;
  onModulesChanged: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ user, onNavigate, onModulesChanged }) => {
  const [summary, setSummary] = useState<DashboardSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<'30d' | '90d' | 'ytd'>('30d');
  const [customizing, setCustomizing] = useState(false);
  const [draftWidgets, setDraftWidgets] = useState<DashboardWidget[]>([]);
  const [refreshSec, setRefreshSec] = useState(60);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [activatingSlug, setActivatingSlug] = useState<string | null>(null);

  const canCustomize = user.roleSlug === 'superadmin' || user.permissions.includes('core.dashboard.customize');
  const canManageModules = user.roleSlug === 'superadmin' || user.permissions.includes('core.modules.manage');

  const fetchSummary = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<DashboardSummaryResponse>('/dashboard/summary');
      setSummary(data);
      setDraftWidgets(data.widgets);
      setRefreshSec(data.preferences.refreshIntervalSec);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar painel executivo.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchSummary();
  }, []);

  const formatMetricValue = (widget: DashboardWidget, currency: string) => {
    if (widget.value === null) return '—';
    if (widget.unit === 'currency') {
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: currency || 'BRL' }).format(widget.value);
    }
    return new Intl.NumberFormat('pt-BR').format(widget.value);
  };

  const handleQuickActivate = async (slug: string) => {
    setActivatingSlug(slug);
    setError(null);
    try {
      await apiRequest(`/modules/${slug}/activate`, { method: 'POST' });
      onModulesChanged();
      await fetchSummary();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível ativar o módulo.');
    } finally {
      setActivatingSlug(null);
    }
  };

  const handleMoveDraftWidget = (index: number, dir: -1 | 1) => {
    const next = [...draftWidgets];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setDraftWidgets(next);
  };

  const handleToggleDraftVisibility = (id: string) => {
    setDraftWidgets((prev) => prev.map((w) => (w.id === id ? { ...w, isVisible: !w.isVisible } : w)));
  };

  const handleSavePreferences = async () => {
    setSavingPrefs(true);
    try {
      const hiddenWidgets = draftWidgets.filter((w) => !w.isVisible).map((w) => w.id);
      const widgetOrder = draftWidgets.map((w) => w.id);
      await apiRequest('/dashboard/preferences', {
        method: 'PUT',
        body: JSON.stringify({ hiddenWidgets, widgetOrder, refreshIntervalSec: refreshSec }),
      });
      setCustomizing(false);
      await fetchSummary();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao salvar preferências.');
    } finally {
      setSavingPrefs(false);
    }
  };

  if (loading && !summary) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 animate-pulse" />
          ))}
        </div>
        <div className="h-64 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 animate-pulse" />
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="p-6 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 text-sm text-red-700 dark:text-red-300">
        {error || 'Não foi possível carregar os dados do painel.'}
      </div>
    );
  }

  const visibleWidgets = summary.widgets.filter((w) => w.isVisible);
  const activeModuleWidgets = visibleWidgets.filter((w) => w.isModuleActive);
  const inactiveModuleWidgets = visibleWidgets.filter((w) => !w.isModuleActive);
  const currency = summary.company?.currency || 'BRL';

  return (
    <div className="space-y-8">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-slate-900 dark:text-slate-100">
            Painel Executivo · {summary.company?.trade_name}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
            Indicadores governados pelos módulos ativos no App Center e permissões do perfil {user.roleName}.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-200/70 dark:bg-slate-800">
            {(['30d', '90d', 'ytd'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  period === p
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                {p === '30d' ? '30 dias' : p === '90d' ? '90 dias' : 'Ano atual'}
              </button>
            ))}
          </div>

          {canCustomize && (
            <button
              type="button"
              onClick={() => setCustomizing(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Personalizar Painel</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => void fetchSummary()}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors whitespace-nowrap shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Atualizar</span>
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="p-3.5 rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 text-xs text-amber-800 dark:text-amber-300">
          {error}
        </div>
      )}

      {/* Core Infrastructure Strip (Real live metrics from SQLite) */}
      <section aria-label="Indicadores do Núcleo" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="text-xs text-slate-500 dark:text-slate-400">Módulos Ativos · Ecossistema</div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="font-mono text-2xl font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
              {summary.coreMetrics.activeModules} / {summary.coreMetrics.totalModules}
            </span>
            <button
              type="button"
              onClick={() => onNavigate('app-center')}
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
            >
              <span>App Center</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="text-xs text-slate-500 dark:text-slate-400">Usuários Ativos · Perfis RBAC</div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="font-mono text-2xl font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
              {summary.coreMetrics.activeUsers} · {summary.coreMetrics.rolesCount} perfis
            </span>
            <button
              type="button"
              onClick={() => onNavigate('rbac')}
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
            >
              <span>Gerenciar</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="text-xs text-slate-500 dark:text-slate-400">Registros de Auditoria</div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="font-mono text-2xl font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
              {summary.coreMetrics.auditEvents}
            </span>
            <button
              type="button"
              onClick={() => onNavigate('settings')}
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
            >
              <span>Ver Logs</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="text-xs text-slate-500 dark:text-slate-400">Estado do Núcleo · Fase 1</div>
          <div className="mt-2 flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
              <span>Operacional</span>
            </span>
            <button
              type="button"
              onClick={() => onNavigate('architecture')}
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
            >
              <span>Arquitetura</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>

      {/* Active Module KPI Widgets */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
              Indicadores de Módulos Ativos e Autorizados
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Período de consulta: {period === '30d' ? 'Últimos 30 dias' : period === '90d' ? 'Últimos 90 dias' : 'Acumulado anual'} · Sem dados simulados em produção.
            </p>
          </div>
        </div>

        {activeModuleWidgets.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {activeModuleWidgets.map((w) => (
              <div
                key={w.id}
                className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col justify-between gap-3"
              >
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {w.moduleName} · Ativo
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-700 dark:text-slate-300">{w.title}</div>
                  <div className="font-mono text-2xl font-semibold text-slate-900 dark:text-slate-100 mt-1 tabular-nums">
                    {formatMetricValue(w, currency)}
                  </div>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {w.description}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-center space-y-3">
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
              Nenhum módulo operacional de negócio está ativo para seus indicadores no momento.
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-lg mx-auto">
              Na Fase 1 (Fundação), apenas o Klyverion Core é obrigatório. Ative módulos como CRM ou Gestão Financeira no App Center para habilitar seus cards neste painel.
            </p>
            <button
              type="button"
              onClick={() => onNavigate('app-center')}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors"
            >
              <span>Abrir Klyverion App Center</span>
            </button>
          </div>
        )}
      </section>

      {/* Inactive Module Slots (Respecting Module Activation State) */}
      {inactiveModuleWidgets.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-sm font-semibold text-slate-700 dark:text-slate-300">
            Indicadores Desabilitados por Módulo Inativo ({inactiveModuleWidgets.length})
          </h2>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 divide-y divide-slate-200 dark:divide-slate-800">
            {inactiveModuleWidgets.map((w) => (
              <div key={w.id} className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{w.title}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Requer {w.moduleName} (Fase {w.modulePhase}) · Permissão: <span className="font-mono">{w.requiredPermission}</span>
                  </div>
                </div>
                {canManageModules ? (
                  <button
                    type="button"
                    disabled={activatingSlug === w.moduleSlug}
                    onClick={() => void handleQuickActivate(w.moduleSlug)}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors whitespace-nowrap shrink-0"
                  >
                    {activatingSlug === w.moduleSlug ? 'Ativando...' : `Ativar ${w.moduleName}`}
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                    <Lock className="w-3.5 h-3.5" />
                    <span>Módulo inativo</span>
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recent Audit Activity */}
      {summary.recentAudit.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
              Atividade Recente de Segurança e Núcleo
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('settings')}
              className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
            >
              Ver histórico completo
            </button>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400">
                  <th className="py-2.5 px-4">Evento</th>
                  <th className="py-2.5 px-4">Recurso</th>
                  <th className="py-2.5 px-4">Ator</th>
                  <th className="py-2.5 px-4 text-right">Data/Hora</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                {summary.recentAudit.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="py-2.5 px-4 font-mono text-slate-900 dark:text-slate-100">{log.action}</td>
                    <td className="py-2.5 px-4 text-slate-600 dark:text-slate-300">
                      {log.resource_type} / {log.resource_id}
                    </td>
                    <td className="py-2.5 px-4 text-slate-600 dark:text-slate-300">{log.actor_email}</td>
                    <td className="py-2.5 px-4 text-right font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                      {new Date(log.created_at).toLocaleString('pt-BR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Customize Dashboard Modal */}
      {customizing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-xl rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Personalizar Painel Executivo
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Configure visibilidade, ordem e frequência de atualização dos seus indicadores autorizados.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCustomizing(false)}
                aria-label="Fechar"
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-between gap-4 py-2 border-y border-slate-200 dark:border-slate-800">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Frequência de atualização
              </label>
              <select
                value={refreshSec}
                onChange={(e) => setRefreshSec(Number(e.target.value))}
                className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              >
                <option value={30}>A cada 30 segundos</option>
                <option value={60}>A cada 1 minuto</option>
                <option value={300}>A cada 5 minutos</option>
                <option value={0}>Somente manual</option>
              </select>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800">
              {draftWidgets.map((w, idx) => (
                <div key={w.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{w.title}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {w.moduleName} · {w.isModuleActive ? 'Módulo ativo' : 'Módulo inativo'}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMoveDraftWidget(idx, -1)}
                      aria-label="Mover para cima"
                      className="p-1.5 rounded border border-slate-200 dark:border-slate-700 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === draftWidgets.length - 1}
                      onClick={() => handleMoveDraftWidget(idx, 1)}
                      aria-label="Mover para baixo"
                      className="p-1.5 rounded border border-slate-200 dark:border-slate-700 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleDraftVisibility(w.id)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded border transition-colors ${
                        w.isVisible
                          ? 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                          : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {w.isVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      <span>{w.isVisible ? 'Visível' : 'Oculto'}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setCustomizing(false)}
                className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={savingPrefs}
                onClick={() => void handleSavePreferences()}
                className="px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-60"
              >
                {savingPrefs ? 'Salvando...' : 'Salvar Preferências'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
