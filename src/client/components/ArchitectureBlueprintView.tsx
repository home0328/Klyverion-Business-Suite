import React, { useEffect, useState } from 'react';
import { Check, Copy, Database, Download, FileCode2, FolderTree, Layers, Lock, Palette, Route } from 'lucide-react';
import { apiRequest, getAuthToken } from '../api';
import type { ArchitectureFileEntry } from '../types';

type BlueprintTab = 'layers' | 'directories' | 'core-plugins' | 'database' | 'design-system' | 'roadmap-security' | 'wp-code';

const DIRECTORY_TREE = `wp-content/
├── plugins/
│   ├── klyverion-core/                  # Camada 1 — Núcleo Obrigatório
│   │   ├── klyverion-core.php           # Bootstrap, singleton Kernel e hooks WP
│   │   ├── interfaces/
│   │   │   └── ModuleContract.php       # Contrato público obrigatório de módulos
│   │   ├── includes/
│   │   │   ├── ModuleRegistry.php       # Registro, dependências e ciclo de vida
│   │   │   ├── EventBus.php             # Barramento pub/sub entre plugins
│   │   │   ├── SettingsManager.php      # Configurações globais e multiempresa
│   │   │   └── UpdateManager.php        # Verificação de versões e compatibilidade
│   │   ├── services/                    # Serviços compartilhados (PDF, Mail, Cache)
│   │   ├── api/
│   │   │   └── RestRouter.php           # Endpoints /wp-json/klyverion/v1/*
│   │   ├── admin/                       # Shell admin e App Center
│   │   ├── database/
│   │   │   └── SchemaMigrator.php       # Migrações idempotentes wp_klyv_*
│   │   ├── security/
│   │   │   └── CapabilityGuard.php      # RBAC granular, nonces e auditoria
│   │   └── assets/
│   │
│   └── klyverion-crm/                   # Camada 2 — Exemplo de Módulo (MOD-01)
│       ├── klyverion-crm.php            # Implementa ModuleContract via Core
│       ├── includes/
│       ├── models/
│       ├── repositories/
│       ├── services/
│       ├── controllers/
│       ├── api/
│       ├── admin/
│       ├── database/
│       ├── assets/
│       └── languages/
│
└── themes/
    └── klyverion-theme/                 # Camada 3 — Apresentação Desacoplada
        ├── style.css                    # Design tokens Light/Dark
        ├── functions.php                # Sem regras de negócio de ERP
        └── templates/`;

const DB_TABLES = [
  { name: 'wp_klyv_companies', pk: 'id (BIGINT)', fk: '—', indexes: 'idx_company_status', purpose: 'Cadastro matriz/filiais, moeda, idioma e fuso horário para isolamento multiempresa.' },
  { name: 'wp_klyv_roles', pk: 'id (BIGINT)', fk: '—', indexes: 'UNIQUE(slug)', purpose: '9 perfis iniciais do sistema e funções personalizadas criadas pelo administrador.' },
  { name: 'wp_klyv_role_permissions', pk: '(role_id, permission_key)', fk: 'role_id → klyv_roles.id', indexes: 'PRIMARY COMPOSITE', purpose: 'Matriz granular de capacidades por módulo e ação (view, create, edit, delete, export, approve, admin).' },
  { name: 'wp_klyv_modules', pk: 'slug (VARCHAR 64)', fk: '—', indexes: 'idx_module_status', purpose: 'Estado de ativação, versão instalada, dependências, saúde e configurações individuais.' },
  { name: 'wp_klyv_module_history', pk: 'id (BIGINT)', fk: 'module_slug → klyv_modules.slug', indexes: 'idx_mod_hist_slug', purpose: 'Histórico imutável de ativações, desativações, atualizações e expurgos.' },
  { name: 'wp_klyv_audit_logs', pk: 'id (BIGINT)', fk: 'actor_user_id, company_id', indexes: 'idx_audit_action, idx_audit_created', purpose: 'Trilha de segurança, IP, ator, recurso afetado e metadados JSON (LGPD/GDPR).' },
  { name: 'wp_klyv_dashboard_preferences', pk: 'user_id (BIGINT)', fk: 'user_id → users.id', indexes: 'PRIMARY(user_id)', purpose: 'Ordem, visibilidade de widgets e frequência de atualização por usuário.' },
];

const PHASES = [
  { phase: 'Fase 1 — Fundação', status: 'Implementada', scope: 'Identidade visual, Tema Light/Dark, Klyverion Core, arquitetura de contratos de plugins, App Center e RBAC granular.' },
  { phase: 'Fase 2 — Gestão Empresarial Básica', status: 'Planejada', scope: 'CRM (MOD-01), Gestão Financeira (MOD-02), Vendas e Comercial (MOD-03) e Produtos/Estoque (MOD-05).' },
  { phase: 'Fase 3 — Operação Empresarial', status: 'Planejada', scope: 'Faturamento e Documentos (MOD-04), Compras e Fornecedores (MOD-06), Gestão de Projetos (MOD-07) e Agenda (MOD-11).' },
  { phase: 'Fase 4 — Gestão Avançada', status: 'Planejada', scope: 'Recursos Humanos (MOD-08), Marketing (MOD-09), Atendimento e Suporte (MOD-10), Documentos (MOD-14) e Multiempresa (MOD-15).' },
  { phase: 'Fase 5 — Inteligência', status: 'Planejada', scope: 'Relatórios e BI (MOD-12), Automação de Processos visual (MOD-13) e módulo opcional Klyverion AI.' },
  { phase: 'Fase 6 — Comercialização', status: 'Planejada', scope: 'Licenciamento desacoplado do Core/Módulos, portal de atualizações, testes automatizados de regressão e empacotamento.' },
];

export const ArchitectureBlueprintView: React.FC = () => {
  const [tab, setTab] = useState<BlueprintTab>('layers');
  const [wpFiles, setWpFiles] = useState<ArchitectureFileEntry[]>([]);
  const [selectedFilePath, setSelectedFilePath] = useState<string>('');
  const [fileContent, setFileContent] = useState<string>('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (tab === 'wp-code' && wpFiles.length === 0) {
      void apiRequest<{ files: ArchitectureFileEntry[] }>('/architecture/files').then((res) => {
        setWpFiles(res.files);
        if (res.files.length > 0) {
          void loadFileContent(res.files[0].path);
        }
      });
    }
  }, [tab]);

  const loadFileContent = async (filePath: string) => {
    setSelectedFilePath(filePath);
    const res = await apiRequest<{ path: string; content: string }>(
      `/architecture/file?path=${encodeURIComponent(filePath)}`
    );
    setFileContent(res.content);
  };

  const handleCopyCode = async () => {
    if (!fileContent) return;
    await navigator.clipboard.writeText(fileContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleDownloadBundle = async (kind: 'wp' | 'complete') => {
    const token = getAuthToken();
    const endpoint = kind === 'wp' ? '/api/v1/architecture/bundle' : '/api/v1/architecture/complete-bundle';
    const filename = kind === 'wp' ? 'klyverion-wp-suite-phase1.zip' : 'klyverion-business-suite-complete.zip';
    const res = await fetch(endpoint, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-slate-900 dark:text-slate-100">
          Arquitetura Técnica & Especificação (Seção 17)
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
          Documentação completa da primeira entrega obrigatória e código-fonte WordPress PHP 8.2+ da Fase 1.
        </p>
      </div>

      {/* Sub-navigation */}
      <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-slate-200/70 dark:bg-slate-800 w-fit">
        {[
          { id: 'layers', label: 'Arquitetura & Diagrama', icon: Layers },
          { id: 'directories', label: 'Diretórios', icon: FolderTree },
          { id: 'core-plugins', label: 'Core & Plugins', icon: Route },
          { id: 'database', label: 'Banco de Dados', icon: Database },
          { id: 'design-system', label: 'Design System & Dashboard', icon: Palette },
          { id: 'roadmap-security', label: 'Plano & Segurança', icon: Lock },
          { id: 'wp-code', label: 'Código WordPress (PHP)', icon: FileCode2 },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id as BlueprintTab)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                tab === item.id
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {tab === 'layers' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
              <div className="font-mono text-xs text-blue-600 dark:text-blue-400">Camada 1 · Obrigatória</div>
              <h2 className="font-display text-base font-semibold">Klyverion Core</h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Kernel central de infraestrutura: inicialização, descoberta de plugins, barramento EventBus, RBAC, auditoria, API REST v1 e diagnósticos. Nunca armazena regras de negócio de módulos específicos.
              </p>
            </div>
            <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
              <div className="font-mono text-xs text-blue-600 dark:text-blue-400">Camada 2 · Desacoplada</div>
              <h2 className="font-display text-base font-semibold">15 Plugins Modulares</h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Plugins WordPress independentes (MOD-01 a MOD-15). Implementam a interface <span className="font-mono">ModuleContract</span> e comunicam-se exclusivamente por contratos e eventos do Core.
              </p>
            </div>
            <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
              <div className="font-mono text-xs text-blue-600 dark:text-blue-400">Camada 3 · Apresentação</div>
              <h2 className="font-display text-base font-semibold">Tema Klyverion</h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Design System próprio, navegação responsiva, Light/Dark mode e tokens visuais. Toda a lógica empresarial reside nos plugins para permitir substituição de tema sem perda de dados.
              </p>
            </div>
          </div>

          <div className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
            <h3 className="font-display text-base font-semibold">Diagrama de Componentes e Fluxo de Comunicação</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-2">
                <div className="font-semibold text-slate-900 dark:text-slate-100">Plugins Produtores</div>
                <div className="text-slate-600 dark:text-slate-400">CRM · Vendas · Estoque · Suporte</div>
                <div className="font-mono text-[11px] text-blue-600 dark:text-blue-400">
                  events-&gt;dispatch(&apos;sale.completed&apos;, payload)
                </div>
              </div>
              <div className="p-4 rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/30 space-y-2">
                <div className="font-semibold text-slate-900 dark:text-slate-100">Klyverion Core (Núcleo)</div>
                <div className="text-slate-600 dark:text-slate-400">ModuleRegistry · EventBus · CapabilityGuard · RestRouter</div>
                <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                  Valida RBAC + Isolamento Multiempresa + Auditoria
                </div>
              </div>
              <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-2">
                <div className="font-semibold text-slate-900 dark:text-slate-100">Plugins Consumidores</div>
                <div className="text-slate-600 dark:text-slate-400">Financeiro · Faturamento · BI · Automação</div>
                <div className="font-mono text-[11px] text-emerald-700 dark:text-emerald-400">
                  events-&gt;subscribe(&apos;sale.completed&apos;, handler)
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'directories' && (
        <div className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
          <h2 className="font-display text-base font-semibold">Estrutura Padronizada de Diretórios WordPress</h2>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Todos os 15 módulos seguem exatamente a mesma convenção de pastas para manutenção previsível e atualizações independentes.
          </p>
          <pre className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto leading-relaxed">
            {DIRECTORY_TREE}
          </pre>
        </div>
      )}

      {tab === 'core-plugins' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
            <h2 className="font-display text-base font-semibold">Especificação do Klyverion Core</h2>
            <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
              <li><strong className="text-slate-900 dark:text-slate-100">Bootstrap & Descoberta:</strong> Dispara <span className="font-mono">do_action(&apos;klyverion_register_modules&apos;)</span> no hook <span className="font-mono">plugins_loaded</span>.</li>
              <li><strong className="text-slate-900 dark:text-slate-100">Carregamento Preguiçoso (Lazy):</strong> Apenas módulos ativos no App Center têm <span className="font-mono">boot()</span> invocado.</li>
              <li><strong className="text-slate-900 dark:text-slate-100">Resolução de Dependências:</strong> Impede ativação sem dependências ativas e impede desativação quando há dependentes ativos.</li>
              <li><strong className="text-slate-900 dark:text-slate-100">Preservação de Dados:</strong> <span className="font-mono">deactivate($purge = false)</span> preserva integralmente tabelas e opções.</li>
              <li><strong className="text-slate-900 dark:text-slate-100">Licenciamento & Updates:</strong> Verificação desacoplada por slug e compatibilidade com <span className="font-mono">min_core_version</span>.</li>
            </ul>
          </div>
          <div className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
            <h2 className="font-display text-base font-semibold">Contrato Público de Plugins (ModuleContract)</h2>
            <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
              <li><span className="font-mono text-slate-900 dark:text-slate-100">get_slug() / get_version() / get_min_core_version()</span> — Identificação e compatibilidade semântica.</li>
              <li><span className="font-mono text-slate-900 dark:text-slate-100">get_dependencies()</span> — Declara slugs obrigatórios sem importar código de terceiros.</li>
              <li><span className="font-mono text-slate-900 dark:text-slate-100">get_permissions()</span> — Registra capacidades RBAC automaticamente no <span className="font-mono">CapabilityGuard</span>.</li>
              <li><span className="font-mono text-slate-900 dark:text-slate-100">activate() / deactivate($purge)</span> — Migrações dedicadas e preservação garantida.</li>
              <li><span className="font-mono text-slate-900 dark:text-slate-100">health_check()</span> — Telemetria real consumida pelo painel de Diagnóstico do Core.</li>
            </ul>
          </div>
        </div>
      )}

      {tab === 'database' && (
        <div className="space-y-4">
          <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <h2 className="font-display text-base font-semibold">Modelo Relacional Inicial (<span className="font-mono">wp_klyv_*</span>)</h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              Dados empresariais estruturados utilizam tabelas próprias com chaves primárias, chaves estrangeiras, índices compostos e paginação — evitando sobrecarga de <span className="font-mono">wp_postmeta</span> e <span className="font-mono">wp_options</span>.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-4">Tabela</th>
                  <th className="py-3 px-4">Chave Primária</th>
                  <th className="py-3 px-4">Chave Estrangeira</th>
                  <th className="py-3 px-4">Índices</th>
                  <th className="py-3 px-4">Finalidade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                {DB_TABLES.map((t) => (
                  <tr key={t.name} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-mono font-medium text-slate-900 dark:text-slate-100">{t.name}</td>
                    <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-300">{t.pk}</td>
                    <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-300">{t.fk}</td>
                    <td className="py-3 px-4 font-mono text-slate-500 dark:text-slate-400">{t.indexes}</td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{t.purpose}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'design-system' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
            <h2 className="font-display text-base font-semibold">Tokens Visuais (Regra 60-30-10 & Tipografia 2+1)</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950">
                <div className="h-6 rounded bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 mb-2" />
                <div className="font-medium">60% Canvas</div>
                <div className="font-mono text-slate-500">#F8FAFC / #020617</div>
              </div>
              <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                <div className="h-6 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 mb-2" />
                <div className="font-medium">30% Superfície</div>
                <div className="font-mono text-slate-500">#FFFFFF / #0F172A</div>
              </div>
              <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="h-6 rounded bg-blue-600 mb-2" />
                <div className="font-medium">10% Ação</div>
                <div className="font-mono text-slate-500">#2563EB</div>
              </div>
              <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="h-6 rounded bg-emerald-600 mb-2" />
                <div className="font-medium">Semântico</div>
                <div className="font-mono text-slate-500">#16A34A · #D97706 · #DC2626</div>
              </div>
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1 pt-2 border-t border-slate-200 dark:border-slate-800">
              <div><strong>Display / Títulos:</strong> Plus Jakarta Sans (500–700)</div>
              <div><strong>Texto & Tabelas:</strong> Public Sans (400–600)</div>
              <div><strong>Métricas & Código:</strong> JetBrains Mono com <span className="font-mono">tabular-nums</span></div>
            </div>
          </div>

          <div className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
            <h2 className="font-display text-base font-semibold">Arquitetura do Layout do Dashboard</h2>
            <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
              <li><strong className="text-slate-900 dark:text-slate-100">Sidebar Lateral Expansível:</strong> 260px aberta / 72px recolhida, com menu dinâmico filtrado por permissões RBAC.</li>
              <li><strong className="text-slate-900 dark:text-slate-100">Cabeçalho Compacto (56px):</strong> Trilha de navegação (breadcrumb), notificações em tempo real, alternador Light/Dark e perfil.</li>
              <li><strong className="text-slate-900 dark:text-slate-100">Widgets Governados por Módulos:</strong> Cards de Faturamento, Receita, Despesas, Lucro, Contas, Vendas, Clientes, Projetos e Tickets só são exibidos quando o módulo está ativo e autorizado.</li>
              <li><strong className="text-slate-900 dark:text-slate-100">Personalização Persistente:</strong> Cada usuário define ordem, visibilidade e intervalo de atualização no banco de dados.</li>
            </ul>
          </div>
        </div>
      )}

      {tab === 'roadmap-security' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 divide-y divide-slate-200 dark:divide-slate-800">
            <div className="p-5">
              <h2 className="font-display text-base font-semibold">Plano de Desenvolvimento em 6 Fases</h2>
            </div>
            {PHASES.map((p) => (
              <div key={p.phase} className="p-4 flex items-start justify-between gap-4 text-xs">
                <div>
                  <div className="font-semibold text-slate-900 dark:text-slate-100">{p.phase}</div>
                  <div className="text-slate-600 dark:text-slate-400 mt-1">{p.scope}</div>
                </div>
                <span
                  className={`font-medium shrink-0 ${
                    p.status === 'Implementada'
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {p.status}
                </span>
              </div>
            ))}
          </div>

          <div className="lg:col-span-5 p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
            <h2 className="font-display text-base font-semibold">Estratégia de Segurança e Proteção de Dados</h2>
            <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              <li>· <strong className="text-slate-900 dark:text-slate-100">Autenticação & Sessão:</strong> Senhas com hash <span className="font-mono">scrypt</span> + salt aleatório por usuário; tokens HMAC-SHA256 em memória (zero exposição em localStorage).</li>
              <li>· <strong className="text-slate-900 dark:text-slate-100">Autorização Server-Side:</strong> Middleware RBAC e <span className="font-mono">permission_callback</span> em 100% das rotas REST e mutações.</li>
              <li>· <strong className="text-slate-900 dark:text-slate-100">SQL Injection & XSS:</strong> Declarações preparadas parametrizadas (<span className="font-mono">?</span> / <span className="font-mono">$wpdb-&gt;prepare</span>) e escape seguro na renderização.</li>
              <li>· <strong className="text-slate-900 dark:text-slate-100">CSRF & Path Traversal:</strong> Nonces no WordPress, verificação de origem e confinamento estrito via <span className="font-mono">path.resolve</span>.</li>
              <li>· <strong className="text-slate-900 dark:text-slate-100">LGPD / GDPR:</strong> Política configurável de retenção de dados, auditoria de acessos e exportação/expurgo auditados.</li>
            </ul>
          </div>
        </div>
      )}

      {tab === 'wp-code' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div className="text-xs text-slate-600 dark:text-slate-400">
              Pacote completo da Fase 1 contendo <span className="font-mono text-slate-900 dark:text-slate-100">klyverion-core/</span>, <span className="font-mono text-slate-900 dark:text-slate-100">klyverion-crm/</span> e <span className="font-mono text-slate-900 dark:text-slate-100">klyverion-theme/</span> ({wpFiles.length} arquivos).
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => void handleDownloadBundle('wp')}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 whitespace-nowrap shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                <span>WordPress (.zip)</span>
              </button>
              <button
                type="button"
                onClick={() => void handleDownloadBundle('complete')}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Projeto Completo (.zip)</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 divide-y divide-slate-200 dark:divide-slate-800">
              {wpFiles.map((f) => (
                <button
                  key={f.path}
                  type="button"
                  onClick={() => void loadFileContent(f.path)}
                  className={`w-full text-left px-4 py-3 text-xs transition-colors ${
                    selectedFilePath === f.path
                      ? 'bg-blue-50/70 dark:bg-blue-950/30'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <div className="font-mono font-medium text-slate-900 dark:text-slate-100 break-all">{f.path}</div>
                  <div className="text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                    {f.layer} · {f.size} bytes
                  </div>
                </button>
              ))}
            </div>

            <div className="lg:col-span-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-950 text-slate-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between gap-4">
                <span className="font-mono text-xs text-slate-300 truncate">{selectedFilePath || 'Selecione um arquivo'}</span>
                <button
                  type="button"
                  onClick={() => void handleCopyCode()}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded border border-slate-700 hover:bg-slate-800 text-slate-200 whitespace-nowrap shrink-0"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copiado' : 'Copiar Código'}</span>
                </button>
              </div>
              <pre className="p-4 text-xs font-mono overflow-x-auto max-h-[600px] leading-relaxed">
                <code>{fileContent}</code>
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
