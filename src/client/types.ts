export interface AuthUser {
  id: number;
  companyId: number;
  roleId: number;
  roleSlug: string;
  roleName: string;
  name: string;
  email: string;
  department: string;
  avatarUrl: string;
  permissions: string[];
}

export interface CompanyInfo {
  id?: number;
  legal_name: string;
  trade_name: string;
  tax_id?: string;
  currency: string;
  language?: string;
  timezone: string;
}

export interface ModuleHistoryItem {
  id: number;
  module_slug: string;
  event_type: string;
  version: string;
  actor_name: string;
  notes: string;
  created_at: string;
}

export interface ModuleItem {
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
  status: 'active' | 'inactive' | 'error';
  healthStatus: string;
  dataRetainedRecords: number;
  settings: Record<string, unknown>;
  isCore: boolean;
  updatedAt: string;
  history: ModuleHistoryItem[];
}

export interface DashboardWidget {
  id: string;
  title: string;
  moduleSlug: string;
  moduleName: string;
  modulePhase: number;
  requiredPermission: string;
  unit: 'currency' | 'count' | 'status';
  description: string;
  isModuleActive: boolean;
  isVisible: boolean;
  value: number | null;
}

export interface AuditLogItem {
  id: number;
  actor_user_id: number | null;
  actor_email: string;
  company_id: number | null;
  action: string;
  resource_type: string;
  resource_id: string;
  severity: 'info' | 'warning' | 'critical';
  ip_address: string;
  metadata_json: string;
  created_at: string;
}

export interface NotificationItem {
  id: number;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  is_read: number;
  created_at: string;
}

export interface DashboardSummaryResponse {
  company: CompanyInfo;
  coreMetrics: {
    activeModules: number;
    totalModules: number;
    activeUsers: number;
    rolesCount: number;
    auditEvents: number;
    unreadNotifications: number;
  };
  widgets: DashboardWidget[];
  preferences: {
    hiddenWidgets: string[];
    widgetOrder: string[];
    refreshIntervalSec: number;
  };
  recentAudit: AuditLogItem[];
}

export interface SystemUser {
  id: number;
  company_id: number;
  role_id: number;
  name: string;
  email: string;
  department: string;
  status: 'active' | 'suspended';
  last_login_at: string | null;
  created_at: string;
  role_slug: string;
  role_name: string;
}

export interface PermissionCatalogItem {
  key: string;
  group: string;
  label: string;
  description: string;
}

export interface RoleItem {
  id: number;
  slug: string;
  name: string;
  description: string;
  isSystem: boolean;
  createdAt: string;
  permissions: string[];
}

export interface DiagnosticsData {
  sqliteIntegrity: boolean;
  foreignKeysEnforced: boolean;
  nodeVersion: string;
  targetWordPress: string;
  counts: {
    companies: number;
    users: number;
    roles: number;
    modules: number;
    auditLogs: number;
  };
  checkedAt: string;
}

export interface ArchitectureFileEntry {
  path: string;
  size: number;
  layer: string;
}
