import React, { useEffect, useState } from 'react';
import { Activity, CheckCircle2, Download, FileText, Settings } from 'lucide-react';
import { ApiError, apiRequest } from '../api';
import type { AuditLogItem, AuthUser, CompanyInfo, DiagnosticsData } from '../types';

interface SettingsAuditViewProps {
  user: AuthUser;
  isDark: boolean;
  onToggleTheme: () => void;
}

export const SettingsAuditView: React.FC<SettingsAuditViewProps> = ({ user, isDark, onToggleTheme }) => {
  const [tab, setTab] = useState<'audit' | 'diagnostics' | 'settings'>('audit');
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [severityFilter, setSeverityFilter] = useState<'all' | 'info' | 'warning' | 'critical'>('all');
  const [diagnostics, setDiagnostics] = useState<DiagnosticsData | null>(null);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [company, setCompany] = useState<CompanyInfo>({
    trade_name: '',
    legal_name: '',
    currency: 'BRL',
    timezone: 'America/Sao_Paulo',
  });
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const canAudit = user.roleSlug === 'superadmin' || user.permissions.includes('core.audit.view');
  const canManageSettings = user.roleSlug === 'superadmin' || user.permissions.includes('core.settings.manage');
  const canBackup = user.roleSlug === 'superadmin' || user.permissions.includes('core.backup.manage');

  const loadAudit = async (sev = severityFilter) => {
    if (!canAudit) return;
    try {
      const res = await apiRequest<{ logs: AuditLogItem[] }>(`/audit?severity=${sev}&limit=80`);
      setLogs(res.logs);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar auditoria.');
    }
  };

  const loadDiagnostics = async () => {
    if (!canAudit) return;
    try {
      const res = await apiRequest<DiagnosticsData>('/diagnostics');
      setDiagnostics(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao executar diagnósticos.');
    }
  };

  const loadSettings = async () => {
    try {
      const res = await apiRequest<{ settings: Record<string, string>; company: CompanyInfo }>('/settings');
      setSettings(res.settings);
      if (res.company) setCompany(res.company);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar configurações.');
    }
  };

  useEffect(() => {
    if (tab === 'audit') void loadAudit();
    if (tab === 'diagnostics') void loadDiagnostics();
    if (tab === 'settings') void loadSettings();
  }, [tab, severityFilter]);

  const handleExportAuditCsv = () => {
    const header = ['id', 'created_at', 'actor_email', 'action', 'resource_type', 'resource_id', 'severity', 'ip_address'];
    const lines = [
      header.join(','),
      ...logs.map((l) =>
        [l.id, l.created_at, l.actor_email, l.action, l.resource_type, l.resource_id, l.severity, l.ip_address]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(',')
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `klyverion-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadFullBackup = async () => {
    setError(null);
    try {
      const snapshot = await apiRequest('/backup/export');
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `klyverion-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setFeedback('Backup completo exportado com sucesso (credenciais sensíveis excluídas por segurança).');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Falha ao gerar backup.');
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setFeedback(null);
    try {
      await apiRequest('/settings', {
        method: 'PUT',
        body: JSON.stringify({ settings, company }),
      });
      setFeedback('Configurações globais e dados empresariais atualizados.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao salvar configurações.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-slate-900 dark:text-slate-100">
          Auditoria, Diagnóstico e Configurações Globais
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
          Monitoramento de segurança, integridade do banco relacional, backup e parâmetros corporativos.
        </p>
      </div>

      <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-200/70 dark:bg-slate-800 w-fit">
        <button
          type="button"
          onClick={() => setTab('audit')}
          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
            tab === 'audit' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs' : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Trilha de Auditoria</span>
        </button>
        <button
          type="button"
          onClick={() => setTab('diagnostics')}
          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
            tab === 'diagnostics' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs' : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Diagnóstico & Backup</span>
        </button>
        <button
          type="button"
          onClick={() => setTab('settings')}
          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
            tab === 'settings' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs' : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          <Settings className="w-3.5 h-3.5" />
          <span>Configurações Globais</span>
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

      {tab === 'audit' && (
        <div className="space-y-4">
          {!canAudit ? (
            <div className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-500">
              Seu perfil não possui permissão <span className="font-mono">core.audit.view</span>.
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800">
                  {(['all', 'info', 'warning', 'critical'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSeverityFilter(s)}
                      className={`px-3 py-1 text-xs font-medium rounded-md ${
                        severityFilter === s
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {s === 'all' ? 'Todos' : s === 'info' ? 'Informativo' : s === 'warning' ? 'Alerta' : 'Crítico'}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleExportAuditCsv}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Exportar CSV</span>
                </button>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400">
                      <th className="py-2.5 px-4">Ação</th>
                      <th className="py-2.5 px-4">Ator</th>
                      <th className="py-2.5 px-4">Recurso</th>
                      <th className="py-2.5 px-4">Severidade</th>
                      <th className="py-2.5 px-4">IP</th>
                      <th className="py-2.5 px-4 text-right">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                    {logs.map((l) => (
                      <tr key={l.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-4 font-mono text-slate-900 dark:text-slate-100">{l.action}</td>
                        <td className="py-2.5 px-4 text-slate-600 dark:text-slate-300">{l.actor_email}</td>
                        <td className="py-2.5 px-4 font-mono text-slate-500 dark:text-slate-400">
                          {l.resource_type}/{l.resource_id}
                        </td>
                        <td className="py-2.5 px-4">
                          <span
                            className={`font-medium ${
                              l.severity === 'critical'
                                ? 'text-red-700 dark:text-red-400'
                                : l.severity === 'warning'
                                ? 'text-amber-700 dark:text-amber-400'
                                : 'text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            {l.severity}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 font-mono text-slate-500 dark:text-slate-400">{l.ip_address}</td>
                        <td className="py-2.5 px-4 text-right font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                          {new Date(l.created_at).toLocaleString('pt-BR')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'diagnostics' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
            <h2 className="font-display text-base font-semibold">Integridade do Banco de Dados e Ambiente</h2>
            {diagnostics ? (
              <div className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                <div className="py-2.5 flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">SQLite PRAGMA integrity_check</span>
                  <span className="inline-flex items-center gap-1 font-medium text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{diagnostics.sqliteIntegrity ? 'Íntegro' : 'Falha'}</span>
                  </span>
                </div>
                <div className="py-2.5 flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Integridade Referencial (Foreign Keys)</span>
                  <span className="font-mono">{diagnostics.foreignKeysEnforced ? 'Ativa' : 'Inativa'}</span>
                </div>
                <div className="py-2.5 flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Runtime Servidor</span>
                  <span className="font-mono">{diagnostics.nodeVersion}</span>
                </div>
                <div className="py-2.5 flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Alvo WordPress</span>
                  <span className="font-mono">{diagnostics.targetWordPress}</span>
                </div>
                <div className="py-2.5 flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Registros Totais</span>
                  <span className="font-mono tabular-nums">
                    {diagnostics.counts.modules} módulos · {diagnostics.counts.users} usuários · {diagnostics.counts.auditLogs} logs
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500">Carregando diagnóstico...</p>
            )}
          </div>

          <div className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
            <h2 className="font-display text-base font-semibold">Backup e Portabilidade</h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Exporte um instantâneo completo de empresas, perfis RBAC, permissões, usuários (sem hashes de senha), estado dos módulos e configurações globais.
            </p>
            {canBackup ? (
              <button
                type="button"
                onClick={() => void handleDownloadFullBackup()}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Exportar Snapshot JSON Completo</span>
              </button>
            ) : (
              <p className="text-xs text-slate-500">Requer permissão <span className="font-mono">core.backup.manage</span>.</p>
            )}
          </div>
        </div>
      )}

      {tab === 'settings' && (
        <form
          onSubmit={handleSaveSettings}
          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-6 max-w-3xl"
        >
          <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h2 className="font-display text-base font-semibold">Parâmetros Corporativos & Tema</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Configurações globais gerenciadas pelo Klyverion Core.</p>
            </div>
            <button
              type="button"
              onClick={onToggleTheme}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Alternar para {isDark ? 'Modo Claro' : 'Modo Escuro'}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Nome Fantasia</label>
              <input
                type="text"
                disabled={!canManageSettings}
                value={company.trade_name}
                onChange={(e) => setCompany({ ...company, trade_name: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Razão Social</label>
              <input
                type="text"
                disabled={!canManageSettings}
                value={company.legal_name}
                onChange={(e) => setCompany({ ...company, legal_name: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Moeda Padrão</label>
              <select
                disabled={!canManageSettings}
                value={company.currency}
                onChange={(e) => setCompany({ ...company, currency: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
              >
                <option value="BRL">BRL — Real</option>
                <option value="USD">USD — Dólar</option>
                <option value="EUR">EUR — Euro</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Retenção de Logs (LGPD/GDPR em dias)</label>
              <input
                type="number"
                min={30}
                max={3650}
                disabled={!canManageSettings}
                value={settings.data_retention_days || '1825'}
                onChange={(e) => setSettings({ ...settings, data_retention_days: e.target.value })}
                className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
            </div>
          </div>

          {canManageSettings && (
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-60"
              >
                {saving ? 'Salvando...' : 'Salvar Configurações Globais'}
              </button>
            </div>
          )}
        </form>
      )}
    </div>
  );
};
