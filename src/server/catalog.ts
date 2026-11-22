export interface ModuleDefinition {
  slug: string;
  code: string;
  name: string;
  phase: number;
  version: string;
  latestVersion: string;
  minCoreVersion: string;
  category: string;
  description: string;
  dependencies: string[];
  requiredPermissions: string[];
  features: string[];
  dashboardWidgets: string[];
  isCore?: boolean;
}

export interface PermissionDefinition {
  key: string;
  group: string;
  label: string;
  description: string;
}

export interface RoleSeed {
  slug: string;
  name: string;
  description: string;
  isSystem: boolean;
  permissions: string[];
}

export const MODULE_CATALOG: ModuleDefinition[] = [
  {
    slug: 'klyverion-core',
    code: 'CORE',
    name: 'Klyverion Core',
    phase: 1,
    version: '1.0.0',
    latestVersion: '1.0.0',
    minCoreVersion: '1.0.0',
    category: 'Infraestrutura',
    description: 'Núcleo obrigatório responsável pelo registro de módulos, barramento de eventos, RBAC, auditoria, API REST v1 e diagnósticos.',
    dependencies: [],
    requiredPermissions: ['core.dashboard.view'],
    features: [
      'Descoberta e ciclo de vida modular',
      'Barramento desacoplado de eventos (EventBus)',
      'RBAC granular e verificação no servidor',
      'Logs de auditoria e retenção LGPD/GDPR',
      'REST API versionada (/api/v1)'
    ],
    dashboardWidgets: ['core_health', 'active_modules', 'security_audit'],
    isCore: true,
  },
  {
    slug: 'klyverion-crm',
    code: 'MOD-01',
    name: 'CRM & Relacionamento',
    phase: 2,
    version: '1.0.0',
    latestVersion: '1.1.0',
    minCoreVersion: '1.0.0',
    category: 'Comercial',
    description: 'Cadastro de clientes e empresas, gestão de contatos, pipeline comercial, pontuação de leads e histórico de interações.',
    dependencies: [],
    requiredPermissions: ['mod.crm.access', 'records.view'],
    features: ['Clientes e empresas', 'Pipeline de oportunidades', 'Lead scoring', 'Segmentação e campos personalizados', 'Relatórios comerciais'],
    dashboardWidgets: ['kpi_new_clients', 'kpi_opportunities'],
  },
  {
    slug: 'klyverion-financeiro',
    code: 'MOD-02',
    name: 'Gestão Financeira',
    phase: 2,
    version: '1.0.0',
    latestVersion: '1.0.0',
    minCoreVersion: '1.0.0',
    category: 'Financeiro',
    description: 'Contas a pagar e receber, fluxo de caixa, centros de custos, conciliação bancária e demonstrativos de resultados.',
    dependencies: [],
    requiredPermissions: ['mod.financeiro.access', 'records.view'],
    features: ['Fluxo de caixa', 'Contas a pagar e receber', 'Conciliação bancária', 'Centros de custos', 'Previsões e DRE'],
    dashboardWidgets: ['kpi_revenue', 'kpi_expenses', 'kpi_profit', 'kpi_receivables', 'kpi_payables'],
  },
  {
    slug: 'klyverion-vendas',
    code: 'MOD-03',
    name: 'Vendas e Comercial',
    phase: 2,
    version: '1.0.0',
    latestVersion: '1.0.0',
    minCoreVersion: '1.0.0',
    category: 'Comercial',
    description: 'Pedidos de venda, orçamentos, propostas, gestão de vendedores, comissões, tabelas de preços e funil de conversão.',
    dependencies: ['klyverion-crm'],
    requiredPermissions: ['mod.vendas.access', 'records.view'],
    features: ['Pedidos e orçamentos', 'Comissões de vendedores', 'Tabelas de preços e cupons', 'Metas comerciais'],
    dashboardWidgets: ['kpi_sales', 'kpi_billing'],
  },
  {
    slug: 'klyverion-faturamento',
    code: 'MOD-04',
    name: 'Faturamento e Documentos',
    phase: 3,
    version: '1.0.0',
    latestVersion: '1.0.0',
    minCoreVersion: '1.0.0',
    category: 'Financeiro',
    description: 'Emissão de faturas, recibos, notas de débito/crédito, numeração automática, PDF e conectores fiscais certificáveis.',
    dependencies: ['klyverion-vendas', 'klyverion-financeiro'],
    requiredPermissions: ['mod.faturamento.access', 'records.view'],
    features: ['Faturas e recibos', 'Modelos personalizáveis', 'Exportação PDF', 'Adaptadores fiscais por país'],
    dashboardWidgets: ['kpi_billing'],
  },
  {
    slug: 'klyverion-estoque',
    code: 'MOD-05',
    name: 'Produtos e Estoque',
    phase: 2,
    version: '1.0.0',
    latestVersion: '1.2.0',
    minCoreVersion: '1.0.0',
    category: 'Operações',
    description: 'Catálogo com variações, SKU, código de barras, múltiplos depósitos, movimentações, inventário, custo médio e estoque mínimo.',
    dependencies: [],
    requiredPermissions: ['mod.estoque.access', 'records.view'],
    features: ['SKU e código de barras', 'Múltiplos depósitos', 'Alertas de reposição', 'Custo médio e valorização'],
    dashboardWidgets: ['kpi_low_stock'],
  },
  {
    slug: 'klyverion-compras',
    code: 'MOD-06',
    name: 'Compras e Fornecedores',
    phase: 3,
    version: '1.0.0',
    latestVersion: '1.0.0',
    minCoreVersion: '1.0.0',
    category: 'Operações',
    description: 'Cadastro de fornecedores, solicitações de compra, cotações comparativas, aprovação de ordens e recebimento de mercadorias.',
    dependencies: ['klyverion-estoque', 'klyverion-financeiro'],
    requiredPermissions: ['mod.compras.access', 'records.view'],
    features: ['Cotações comparativas', 'Ordens de compra', 'Fluxo de aprovação', 'Integração via EventBus'],
    dashboardWidgets: [],
  },
  {
    slug: 'klyverion-projetos',
    code: 'MOD-07',
    name: 'Gestão de Projetos',
    phase: 3,
    version: '1.0.0',
    latestVersion: '1.0.0',
    minCoreVersion: '1.0.0',
    category: 'Operações',
    description: 'Quadros Kanban, tarefas, subtarefas, cronogramas, marcos, apontamento de horas e relatórios de produtividade.',
    dependencies: [],
    requiredPermissions: ['mod.projetos.access', 'records.view'],
    features: ['Quadros Kanban', 'Marcos e cronogramas', 'Controle de horas', 'Produtividade da equipe'],
    dashboardWidgets: ['kpi_active_projects', 'kpi_pending_tasks'],
  },
  {
    slug: 'klyverion-rh',
    code: 'MOD-08',
    name: 'Recursos Humanos',
    phase: 4,
    version: '1.0.0',
    latestVersion: '1.0.0',
    minCoreVersion: '1.0.0',
    category: 'Pessoas',
    description: 'Colaboradores, departamentos, cargos, férias, ausências, ponto, avaliação de desempenho, contratos e organograma.',
    dependencies: [],
    requiredPermissions: ['mod.rh.access', 'records.view'],
    features: ['Organograma dinâmico', 'Férias e ausências', 'Avaliação de desempenho', 'Conectores de folha local'],
    dashboardWidgets: [],
  },
  {
    slug: 'klyverion-marketing',
    code: 'MOD-09',
    name: 'Marketing e Automação',
    phase: 4,
    version: '1.0.0',
    latestVersion: '1.0.0',
    minCoreVersion: '1.0.0',
    category: 'Comercial',
    description: 'Campanhas multicanal, segmentação de listas, formulários, landing pages, captura de leads e rastreamento de conversões.',
    dependencies: ['klyverion-crm'],
    requiredPermissions: ['mod.marketing.access', 'records.view'],
    features: ['Campanhas de e-mail', 'Formulários e landing pages', 'Conversão de leads', 'Integrações externas'],
    dashboardWidgets: [],
  },
  {
    slug: 'klyverion-suporte',
    code: 'MOD-10',
    name: 'Atendimento e Suporte',
    phase: 4,
    version: '1.0.0',
    latestVersion: '1.0.0',
    minCoreVersion: '1.0.0',
    category: 'Atendimento',
    description: 'Central de tickets, filas por departamento, SLA, respostas prontas, base de conhecimento e pesquisa de satisfação.',
    dependencies: ['klyverion-crm'],
    requiredPermissions: ['mod.suporte.access', 'records.view'],
    features: ['Tickets e SLA', 'Base de conhecimento', 'Atribuição inteligente', 'Avaliação CSAT'],
    dashboardWidgets: ['kpi_open_tickets'],
  },
  {
    slug: 'klyverion-agenda',
    code: 'MOD-11',
    name: 'Agenda e Agendamentos',
    phase: 3,
    version: '1.0.0',
    latestVersion: '1.0.0',
    minCoreVersion: '1.0.0',
    category: 'Atendimento',
    description: 'Calendário empresarial, reserva de serviços, disponibilidade de profissionais, lembretes e sincronização externa.',
    dependencies: ['klyverion-crm'],
    requiredPermissions: ['mod.agenda.access', 'records.view'],
    features: ['Calendário multi-recurso', 'Reservas e confirmações', 'Sincronização iCal/Google'],
    dashboardWidgets: [],
  },
  {
    slug: 'klyverion-bi',
    code: 'MOD-12',
    name: 'Relatórios e BI',
    phase: 5,
    version: '1.0.0',
    latestVersion: '1.0.0',
    minCoreVersion: '1.0.0',
    category: 'Inteligência',
    description: 'Dashboards executivos, cruzamento de KPIs entre módulos, filtros dinâmicos por período e exportação PDF/Excel.',
    dependencies: [],
    requiredPermissions: ['mod.bi.access', 'records.export'],
    features: ['KPIs consolidados', 'Filtros temporais avançados', 'Exportação PDF/XLSX', 'Relatórios agendados'],
    dashboardWidgets: [],
  },
  {
    slug: 'klyverion-automacao',
    code: 'MOD-13',
    name: 'Automação de Processos',
    phase: 5,
    version: '1.0.0',
    latestVersion: '1.0.0',
    minCoreVersion: '1.0.0',
    category: 'Inteligência',
    description: 'Construtor visual de fluxos (gatilho, condição e ação) conectado ao EventBus do Core com fila de reprocessamento.',
    dependencies: [],
    requiredPermissions: ['mod.automacao.access', 'module.admin'],
    features: ['Gatilhos orientados a eventos', 'Condições compostas', 'Histórico de execução', 'Tratamento de falhas'],
    dashboardWidgets: [],
  },
  {
    slug: 'klyverion-documentos',
    code: 'MOD-14',
    name: 'Documentos e Arquivos',
    phase: 4,
    version: '1.0.0',
    latestVersion: '1.0.0',
    minCoreVersion: '1.0.0',
    category: 'Infraestrutura',
    description: 'Biblioteca centralizada com pastas, versionamento, controle de acesso por perfil, pré-visualização e vínculos com ERP.',
    dependencies: [],
    requiredPermissions: ['mod.documentos.access', 'records.view'],
    features: ['Versionamento de arquivos', 'Controle de acesso granular', 'Pesquisa indexada', 'Vínculos CRM/Projetos'],
    dashboardWidgets: [],
  },
  {
    slug: 'klyverion-multiempresa',
    code: 'MOD-15',
    name: 'Configuração Multiempresa',
    phase: 4,
    version: '1.0.0',
    latestVersion: '1.0.0',
    minCoreVersion: '1.0.0',
    category: 'Infraestrutura',
    description: 'Gestão de matriz e filiais, moedas, idiomas, fusos horários, isolamento de dados por empresa e relatórios consolidados.',
    dependencies: [],
    requiredPermissions: ['mod.multiempresa.access', 'core.settings.manage'],
    features: ['Isolamento estrito por empresa', 'Multi-moeda e fusos', 'Usuários por filial', 'Centros de custos por unidade'],
    dashboardWidgets: [],
  },
];

export const PERMISSION_CATALOG: PermissionDefinition[] = [
  // Core
  { key: 'core.dashboard.view', group: 'Núcleo & Sistema', label: 'Visualizar Painel Principal', description: 'Acesso ao painel executivo e indicadores liberados.' },
  { key: 'core.dashboard.customize', group: 'Núcleo & Sistema', label: 'Personalizar Painel', description: 'Organizar, exibir ou ocultar cards no próprio dashboard.' },
  { key: 'core.modules.view', group: 'Núcleo & Sistema', label: 'Visualizar App Center', description: 'Consultar módulos instalados, versões e dependências.' },
  { key: 'core.modules.manage', group: 'Núcleo & Sistema', label: 'Gerenciar Módulos', description: 'Ativar, desativar, configurar e atualizar módulos no App Center.' },
  { key: 'core.users.view', group: 'Segurança & RBAC', label: 'Listar Usuários', description: 'Visualizar usuários e vínculos organizacionais.' },
  { key: 'core.users.manage', group: 'Segurança & RBAC', label: 'Gerenciar Usuários', description: 'Criar, editar, suspender e atribuir perfis a usuários.' },
  { key: 'core.roles.manage', group: 'Segurança & RBAC', label: 'Gerenciar Perfis e Permissões', description: 'Criar funções personalizadas e alterar a matriz RBAC.' },
  { key: 'core.settings.manage', group: 'Núcleo & Sistema', label: 'Configurações Globais', description: 'Alterar parâmetros empresariais, retenção LGPD e idioma.' },
  { key: 'core.audit.view', group: 'Segurança & RBAC', label: 'Auditoria e Diagnósticos', description: 'Acessar trilha de auditoria e saúde do banco de dados.' },
  { key: 'core.backup.manage', group: 'Segurança & RBAC', label: 'Backup e Exclusão Definitiva', description: 'Exportar backups completos e autorizar expurgo de dados.' },

  // Operações transversais (controle de ação solicitado na Seção 7)
  { key: 'records.view', group: 'Ações Operacionais', label: 'Visualizar Registros', description: 'Leitura de registros nos módulos autorizados.' },
  { key: 'records.create', group: 'Ações Operacionais', label: 'Criar Registros', description: 'Inclusão de novos lançamentos e cadastros.' },
  { key: 'records.edit', group: 'Ações Operacionais', label: 'Editar Registros', description: 'Alteração de registros existentes.' },
  { key: 'records.delete', group: 'Ações Operacionais', label: 'Excluir Registros', description: 'Remoção lógica ou definitiva de registros.' },
  { key: 'records.export', group: 'Ações Operacionais', label: 'Exportar Dados', description: 'Exportação de relatórios e tabelas em CSV/PDF/JSON.' },
  { key: 'records.approve', group: 'Ações Operacionais', label: 'Aprovar Operações', description: 'Aprovação de compras, descontos e pagamentos.' },
  { key: 'module.admin', group: 'Ações Operacionais', label: 'Administrar Módulo', description: 'Configuração interna avançada dos módulos acessíveis.' },

  // Acesso granular por módulo
  { key: 'mod.crm.access', group: 'Acesso aos Módulos', label: 'CRM & Relacionamento', description: 'Acesso ao módulo CRM.' },
  { key: 'mod.financeiro.access', group: 'Acesso aos Módulos', label: 'Gestão Financeira', description: 'Acesso ao módulo Financeiro.' },
  { key: 'mod.vendas.access', group: 'Acesso aos Módulos', label: 'Vendas e Comercial', description: 'Acesso ao módulo Vendas.' },
  { key: 'mod.faturamento.access', group: 'Acesso aos Módulos', label: 'Faturamento e Documentos', description: 'Acesso ao módulo Faturamento.' },
  { key: 'mod.estoque.access', group: 'Acesso aos Módulos', label: 'Produtos e Estoque', description: 'Acesso ao módulo Estoque.' },
  { key: 'mod.compras.access', group: 'Acesso aos Módulos', label: 'Compras e Fornecedores', description: 'Acesso ao módulo Compras.' },
  { key: 'mod.projetos.access', group: 'Acesso aos Módulos', label: 'Gestão de Projetos', description: 'Acesso ao módulo Projetos.' },
  { key: 'mod.rh.access', group: 'Acesso aos Módulos', label: 'Recursos Humanos', description: 'Acesso ao módulo RH.' },
  { key: 'mod.marketing.access', group: 'Acesso aos Módulos', label: 'Marketing', description: 'Acesso ao módulo Marketing.' },
  { key: 'mod.suporte.access', group: 'Acesso aos Módulos', label: 'Atendimento e Suporte', description: 'Acesso ao módulo Suporte.' },
  { key: 'mod.agenda.access', group: 'Acesso aos Módulos', label: 'Agenda e Agendamentos', description: 'Acesso ao módulo Agenda.' },
  { key: 'mod.bi.access', group: 'Acesso aos Módulos', label: 'Relatórios e BI', description: 'Acesso ao módulo BI.' },
  { key: 'mod.automacao.access', group: 'Acesso aos Módulos', label: 'Automação de Processos', description: 'Acesso ao módulo Automação.' },
  { key: 'mod.documentos.access', group: 'Acesso aos Módulos', label: 'Documentos e Arquivos', description: 'Acesso ao módulo Documentos.' },
  { key: 'mod.multiempresa.access', group: 'Acesso aos Módulos', label: 'Configuração Multiempresa', description: 'Acesso ao módulo Multiempresa.' },
];

const ALL_PERMISSION_KEYS = PERMISSION_CATALOG.map((p) => p.key);

export const INITIAL_ROLES: RoleSeed[] = [
  {
    slug: 'superadmin',
    name: 'Superadministrador',
    description: 'Controle total sobre infraestrutura, segurança, módulos, multiempresa e auditoria.',
    isSystem: true,
    permissions: ALL_PERMISSION_KEYS,
  },
  {
    slug: 'company_admin',
    name: 'Administrador empresarial',
    description: 'Administração completa da empresa ativa, usuários, módulos e aprovações.',
    isSystem: true,
    permissions: ALL_PERMISSION_KEYS.filter((k) => k !== 'core.backup.manage'),
  },
  {
    slug: 'manager',
    name: 'Gerente',
    description: 'Visão gerencial transversal, aprovações operacionais e indicadores de BI.',
    isSystem: true,
    permissions: [
      'core.dashboard.view', 'core.dashboard.customize', 'core.modules.view', 'core.users.view', 'core.audit.view',
      'records.view', 'records.create', 'records.edit', 'records.export', 'records.approve',
      'mod.crm.access', 'mod.financeiro.access', 'mod.vendas.access', 'mod.estoque.access',
      'mod.compras.access', 'mod.projetos.access', 'mod.suporte.access', 'mod.bi.access', 'mod.agenda.access',
    ],
  },
  {
    slug: 'finance',
    name: 'Financeiro',
    description: 'Contas a pagar/receber, fluxo de caixa, faturamento e relatórios financeiros.',
    isSystem: true,
    permissions: [
      'core.dashboard.view', 'core.dashboard.customize',
      'records.view', 'records.create', 'records.edit', 'records.export', 'records.approve',
      'mod.financeiro.access', 'mod.faturamento.access', 'mod.compras.access', 'mod.bi.access',
    ],
  },
  {
    slug: 'sales',
    name: 'Comercial',
    description: 'CRM, leads, pipeline de oportunidades, pedidos de venda e agenda comercial.',
    isSystem: true,
    permissions: [
      'core.dashboard.view', 'core.dashboard.customize',
      'records.view', 'records.create', 'records.edit', 'records.export',
      'mod.crm.access', 'mod.vendas.access', 'mod.marketing.access', 'mod.agenda.access',
    ],
  },
  {
    slug: 'hr',
    name: 'Recursos humanos',
    description: 'Gestão de colaboradores, departamentos, contratos, ponto e documentos.',
    isSystem: true,
    permissions: [
      'core.dashboard.view', 'core.dashboard.customize', 'core.users.view',
      'records.view', 'records.create', 'records.edit', 'records.export',
      'mod.rh.access', 'mod.documentos.access',
    ],
  },
  {
    slug: 'warehouse',
    name: 'Estoquista',
    description: 'Controle de produtos, movimentações, inventário, depósitos e recebimento.',
    isSystem: true,
    permissions: [
      'core.dashboard.view', 'core.dashboard.customize',
      'records.view', 'records.create', 'records.edit',
      'mod.estoque.access', 'mod.compras.access',
    ],
  },
  {
    slug: 'support',
    name: 'Atendente',
    description: 'Central de tickets, base de conhecimento, consultas CRM e agendamentos.',
    isSystem: true,
    permissions: [
      'core.dashboard.view', 'core.dashboard.customize',
      'records.view', 'records.create', 'records.edit',
      'mod.suporte.access', 'mod.crm.access', 'mod.agenda.access',
    ],
  },
  {
    slug: 'employee',
    name: 'Funcionário',
    description: 'Acesso operacional básico a projetos, agenda interna e documentos compartilhados.',
    isSystem: true,
    permissions: [
      'core.dashboard.view',
      'records.view', 'records.create',
      'mod.projetos.access', 'mod.agenda.access', 'mod.documentos.access',
    ],
  },
];

export interface DashboardWidgetDef {
  id: string;
  title: string;
  moduleSlug: string;
  requiredPermission: string;
  unit: 'currency' | 'count' | 'status';
  description: string;
}

export const DASHBOARD_WIDGETS: DashboardWidgetDef[] = [
  { id: 'kpi_billing', title: 'Faturamento', moduleSlug: 'klyverion-faturamento', requiredPermission: 'mod.faturamento.access', unit: 'currency', description: 'Total faturado no período selecionado.' },
  { id: 'kpi_revenue', title: 'Receita Mensal', moduleSlug: 'klyverion-financeiro', requiredPermission: 'mod.financeiro.access', unit: 'currency', description: 'Entradas realizadas no mês corrente.' },
  { id: 'kpi_expenses', title: 'Despesas', moduleSlug: 'klyverion-financeiro', requiredPermission: 'mod.financeiro.access', unit: 'currency', description: 'Saídas operacionais consolidadas.' },
  { id: 'kpi_profit', title: 'Lucro Líquido', moduleSlug: 'klyverion-financeiro', requiredPermission: 'mod.financeiro.access', unit: 'currency', description: 'Resultado líquido (Receitas - Despesas).' },
  { id: 'kpi_receivables', title: 'Contas a Receber', moduleSlug: 'klyverion-financeiro', requiredPermission: 'mod.financeiro.access', unit: 'currency', description: 'Títulos em aberto a receber.' },
  { id: 'kpi_payables', title: 'Contas a Pagar', moduleSlug: 'klyverion-financeiro', requiredPermission: 'mod.financeiro.access', unit: 'currency', description: 'Obrigações financeiras pendentes.' },
  { id: 'kpi_sales', title: 'Vendas Realizadas', moduleSlug: 'klyverion-vendas', requiredPermission: 'mod.vendas.access', unit: 'count', description: 'Pedidos confirmados no período.' },
  { id: 'kpi_new_clients', title: 'Novos Clientes', moduleSlug: 'klyverion-crm', requiredPermission: 'mod.crm.access', unit: 'count', description: 'Clientes adicionados à base CRM.' },
  { id: 'kpi_opportunities', title: 'Oportunidades Comerciais', moduleSlug: 'klyverion-crm', requiredPermission: 'mod.crm.access', unit: 'count', description: 'Negociações ativas no funil.' },
  { id: 'kpi_active_projects', title: 'Projetos em Andamento', moduleSlug: 'klyverion-projetos', requiredPermission: 'mod.projetos.access', unit: 'count', description: 'Projetos com status em execução.' },
  { id: 'kpi_pending_tasks', title: 'Tarefas Pendentes', moduleSlug: 'klyverion-projetos', requiredPermission: 'mod.projetos.access', unit: 'count', description: 'Atividades aguardando conclusão.' },
  { id: 'kpi_open_tickets', title: 'Tickets Abertos', moduleSlug: 'klyverion-suporte', requiredPermission: 'mod.suporte.access', unit: 'count', description: 'Solicitações de suporte em fila.' },
  { id: 'kpi_low_stock', title: 'Estoque Baixo', moduleSlug: 'klyverion-estoque', requiredPermission: 'mod.estoque.access', unit: 'count', description: 'SKUs abaixo do estoque mínimo.' },
];
