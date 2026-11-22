import React, { useState } from 'react';
import { Eye, EyeOff, Layers, Lock, Moon, ShieldCheck, Sun } from 'lucide-react';
import { ApiError, apiRequest, setAuthToken } from '../api';
import type { AuthUser } from '../types';

interface SetupAndLoginProps {
  initialized: boolean;
  companyName: string;
  isDark: boolean;
  onToggleTheme: () => void;
  onAuthenticated: (user: AuthUser) => void;
}

const STARTER_MODULES = [
  { slug: 'klyverion-crm', label: 'CRM & Relacionamento (MOD-01)' },
  { slug: 'klyverion-financeiro', label: 'Gestão Financeira (MOD-02)' },
  { slug: 'klyverion-estoque', label: 'Produtos e Estoque (MOD-05)' },
  { slug: 'klyverion-projetos', label: 'Gestão de Projetos (MOD-07)' },
];

export const SetupAndLogin: React.FC<SetupAndLoginProps> = ({
  initialized,
  companyName,
  isDark,
  onToggleTheme,
  onAuthenticated,
}) => {
  const [imgError, setImgError] = useState(false);

  // Setup state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tradeName, setTradeName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [currency, setCurrency] = useState<'BRL' | 'USD' | 'EUR'>('BRL');
  const [selectedModules, setSelectedModules] = useState<string[]>(['klyverion-crm', 'klyverion-financeiro']);

  // Login state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleStarterModule = (slug: string) => {
    setSelectedModules((prev) => (prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]));
  };

  const handleSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await apiRequest<{ token: string; user: AuthUser }>('/auth/setup', {
        method: 'POST',
        body: JSON.stringify({
          name,
          email,
          password,
          companyTradeName: tradeName,
          companyLegalName: legalName || tradeName,
          currency,
          initialModules: selectedModules,
        }),
      });
      setAuthToken(res.token);
      onAuthenticated(res.user);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Falha ao inicializar o sistema.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await apiRequest<{ token: string; user: AuthUser }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      setAuthToken(res.token);
      onAuthenticated(res.user);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Falha na autenticação.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="w-full border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between gap-8">
          <span className="font-display text-lg font-bold tracking-tight whitespace-nowrap shrink-0">
            Klyverion Business Suite
          </span>
          <div className="flex items-center gap-4 shrink-0">
            <span className="hidden sm:inline text-xs text-slate-500 dark:text-slate-400">
              Fase 1 · Núcleo, App Center e RBAC
            </span>
            <button
              type="button"
              onClick={onToggleTheme}
              aria-label="Alternar tema claro ou escuro"
              className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0"
            >
              {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              <span>{isDark ? 'Tema Claro' : 'Tema Escuro'}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-6 lg:p-10">
        <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Left Column: Brand & Architecture Overview */}
          <section className="lg:col-span-6 flex flex-col justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
            <div className="relative h-56 sm:h-64 w-full bg-slate-900 overflow-hidden">
              {!imgError ? (
                <img
                  src="/src/assets/images/klyverion_architecture_hero_1795373702729.jpg"
                  alt="Arquitetura modular em camadas do Klyverion Business Suite"
                  referrerPolicy="no-referrer"
                  onError={() => setImgError(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-slate-900 text-slate-300">
                  <Layers className="w-12 h-12 text-blue-500" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/35 to-transparent" />
              <div className="absolute bottom-5 left-6 right-6 text-white">
                <p className="text-xs font-medium text-blue-300">One Platform. Every Business Operation.</p>
                <h1 className="font-display text-2xl font-semibold mt-1 text-balance">
                  {initialized ? companyName : 'Ecossistema ERP Modular Integrado ao WordPress'}
                </h1>
              </div>
            </div>

            <div className="p-6 lg:p-8 flex-1 flex flex-col justify-between gap-6">
              <div className="space-y-4">
                <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
                  Fundação Arquitetural em 3 Camadas
                </h2>
                <div className="divide-y divide-slate-200 dark:divide-slate-800 border-y border-slate-200 dark:border-slate-800">
                  <div className="py-3 flex items-start gap-3">
                    <span className="font-mono text-xs text-blue-600 dark:text-blue-400 pt-0.5 tabular-nums">01</span>
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Klyverion Core</p>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                        Descoberta de módulos, barramento de eventos, RBAC granular, auditoria e REST API v1.
                      </p>
                    </div>
                  </div>
                  <div className="py-3 flex items-start gap-3">
                    <span className="font-mono text-xs text-blue-600 dark:text-blue-400 pt-0.5 tabular-nums">02</span>
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Plugins Modulares Independentes</p>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                        15 módulos desacoplados geridos pelo App Center sem acoplamento direto entre plugins.
                      </p>
                    </div>
                  </div>
                  <div className="py-3 flex items-start gap-3">
                    <span className="font-mono text-xs text-blue-600 dark:text-blue-400 pt-0.5 tabular-nums">03</span>
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Tema Klyverion</p>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                        Design System unificado, modo claro e escuro e responsividade completa.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Autenticação com hash scrypt, verificação RBAC no servidor e proteção contra CSRF/XSS.</span>
              </div>
            </div>
          </section>

          {/* Right Column: First-Run Setup Wizard OR Sign-In */}
          <section className="lg:col-span-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 lg:p-8 flex flex-col justify-center">
            {!initialized ? (
              <form onSubmit={handleSetupSubmit} className="space-y-5">
                <div>
                  <p className="text-xs font-medium text-blue-600 dark:text-blue-400">
                    Instalação Inicial · Klyverion Core v1.0.0
                  </p>
                  <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-slate-100 mt-1">
                    Provisionar Superadministrador e Empresa
                  </h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    Configure a organização principal e crie a primeira credencial administrativa com hash criptográfico no servidor.
                  </p>
                </div>

                {error && (
                  <div
                    role="alert"
                    className="p-3 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 text-xs text-red-700 dark:text-red-300"
                  >
                    {error}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Nome Fantasia da Empresa
                    </label>
                    <input
                      type="text"
                      required
                      value={tradeName}
                      onChange={(e) => setTradeName(e.target.value)}
                      placeholder="Ex.: Grupo Horizonte S.A."
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Moeda Padrão
                    </label>
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value as 'BRL' | 'USD' | 'EUR')}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    >
                      <option value="BRL">BRL — Real Brasileiro</option>
                      <option value="USD">USD — Dólar Americano</option>
                      <option value="EUR">EUR — Euro</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Razão Social (opcional)
                  </label>
                  <input
                    type="text"
                    value={legalName}
                    onChange={(e) => setLegalName(e.target.value)}
                    placeholder="Razão social completa"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Nome do Superadministrador
                    </label>
                    <input
                      type="text"
                      required
                      minLength={2}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Nome completo"
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      E-mail Corporativo
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@empresa.com"
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Senha Administrativa (mínimo 8 caracteres)
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Crie uma senha forte"
                      className="w-full px-3 py-2 pr-10 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label="Mostrar ou ocultar senha"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <span className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Módulos Iniciais no App Center (opcional — pode ser alterado depois)
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {STARTER_MODULES.map((m) => (
                      <label
                        key={m.slug}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-xs cursor-pointer hover:border-blue-500/60"
                      >
                        <input
                          type="checkbox"
                          checked={selectedModules.includes(m.slug)}
                          onChange={() => toggleStarterModule(m.slug)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                        />
                        <span className="text-slate-700 dark:text-slate-200">{m.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 px-4 text-sm font-medium rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white transition-colors whitespace-nowrap"
                >
                  {submitting ? 'Provisionando Núcleo...' : 'Concluir Instalação e Entrar'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleLoginSubmit} className="space-y-5">
                <div>
                  <p className="text-xs font-medium text-blue-600 dark:text-blue-400">
                    Acesso Corporativo · {companyName}
                  </p>
                  <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-slate-100 mt-1">
                    Entrar no Klyverion Business Suite
                  </h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    As permissões da interface e rotas REST são aplicadas dinamicamente pelo seu perfil RBAC.
                  </p>
                </div>

                {error && (
                  <div
                    role="alert"
                    className="p-3 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 text-xs text-red-700 dark:text-red-300"
                  >
                    {error}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    E-mail Corporativo
                  </label>
                  <input
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="usuario@empresa.com"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Senha
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3 py-2 pr-10 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label="Mostrar ou ocultar senha"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-medium rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white transition-colors whitespace-nowrap"
                >
                  <Lock className="w-4 h-4" />
                  <span>{submitting ? 'Autenticando...' : 'Acessar Plataforma'}</span>
                </button>
              </form>
            )}
          </section>
        </div>
      </main>
    </div>
  );
};
