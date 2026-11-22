import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { INITIAL_ROLES, MODULE_CATALOG, PERMISSION_CATALOG } from './catalog.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'klyverion.db');

export const db = new DatabaseSync(DB_PATH);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
`);

export function initDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS klyv_companies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      legal_name TEXT NOT NULL,
      trade_name TEXT NOT NULL,
      tax_id TEXT DEFAULT '',
      currency TEXT NOT NULL DEFAULT 'BRL',
      language TEXT NOT NULL DEFAULT 'pt-BR',
      timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS klyv_roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      is_system INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS klyv_permissions (
      key TEXT PRIMARY KEY,
      group_name TEXT NOT NULL,
      label TEXT NOT NULL,
      description TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS klyv_role_permissions (
      role_id INTEGER NOT NULL,
      permission_key TEXT NOT NULL,
      PRIMARY KEY (role_id, permission_key),
      FOREIGN KEY (role_id) REFERENCES klyv_roles(id) ON DELETE CASCADE,
      FOREIGN KEY (permission_key) REFERENCES klyv_permissions(key) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS klyv_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL,
      role_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      department TEXT NOT NULL DEFAULT 'Administração',
      status TEXT NOT NULL DEFAULT 'active',
      avatar_url TEXT DEFAULT '',
      last_login_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (company_id) REFERENCES klyv_companies(id),
      FOREIGN KEY (role_id) REFERENCES klyv_roles(id)
    );

    CREATE INDEX IF NOT EXISTS idx_users_company ON klyv_users(company_id);
    CREATE INDEX IF NOT EXISTS idx_users_role ON klyv_users(role_id);

    CREATE TABLE IF NOT EXISTS klyv_modules (
      slug TEXT PRIMARY KEY,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      phase INTEGER NOT NULL,
      version TEXT NOT NULL,
      latest_version TEXT NOT NULL,
      min_core_version TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      dependencies_json TEXT NOT NULL,
      required_permissions_json TEXT NOT NULL,
      features_json TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'inactive',
      health_status TEXT NOT NULL DEFAULT 'nominal',
      data_retained_records INTEGER NOT NULL DEFAULT 0,
      settings_json TEXT NOT NULL DEFAULT '{}',
      is_core INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_modules_status ON klyv_modules(status);

    CREATE TABLE IF NOT EXISTS klyv_module_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      module_slug TEXT NOT NULL,
      event_type TEXT NOT NULL,
      version TEXT NOT NULL,
      actor_name TEXT NOT NULL,
      notes TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (module_slug) REFERENCES klyv_modules(slug) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS klyv_audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_user_id INTEGER,
      actor_email TEXT NOT NULL,
      company_id INTEGER,
      action TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      resource_id TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'info',
      ip_address TEXT NOT NULL DEFAULT '127.0.0.1',
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_audit_created ON klyv_audit_logs(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_action ON klyv_audit_logs(action);

    CREATE TABLE IF NOT EXISTS klyv_notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL DEFAULT 1,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'info',
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS klyv_dashboard_preferences (
      user_id INTEGER PRIMARY KEY,
      hidden_widgets_json TEXT NOT NULL DEFAULT '[]',
      widget_order_json TEXT NOT NULL DEFAULT '[]',
      refresh_interval_sec INTEGER NOT NULL DEFAULT 60,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES klyv_users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS klyv_global_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  const now = new Date().toISOString();

  // Seed permissions idempotently
  const upsertPerm = db.prepare(`
    INSERT INTO klyv_permissions (key, group_name, label, description)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      group_name = excluded.group_name,
      label = excluded.label,
      description = excluded.description
  `);
  for (const perm of PERMISSION_CATALOG) {
    upsertPerm.run(perm.key, perm.group, perm.label, perm.description);
  }

  // Seed initial 9 roles idempotently if empty
  const existingRoleCount = (db.prepare('SELECT COUNT(*) as c FROM klyv_roles').get() as { c: number }).c;
  if (existingRoleCount === 0) {
    const insertRole = db.prepare(`
      INSERT INTO klyv_roles (slug, name, description, is_system, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    const insertRolePerm = db.prepare(`
      INSERT OR IGNORE INTO klyv_role_permissions (role_id, permission_key)
      VALUES (?, ?)
    `);

    for (const role of INITIAL_ROLES) {
      const res = insertRole.run(role.slug, role.name, role.description, role.isSystem ? 1 : 0, now);
      const roleId = Number(res.lastInsertRowid);
      for (const permKey of role.permissions) {
        insertRolePerm.run(roleId, permKey);
      }
    }
  }

  // Seed module catalog idempotently
  const insertMod = db.prepare(`
    INSERT OR IGNORE INTO klyv_modules (
      slug, code, name, phase, version, latest_version, min_core_version,
      category, description, dependencies_json, required_permissions_json,
      features_json, status, health_status, data_retained_records, settings_json, is_core, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const mod of MODULE_CATALOG) {
    insertMod.run(
      mod.slug,
      mod.code,
      mod.name,
      mod.phase,
      mod.version,
      mod.latestVersion,
      mod.minCoreVersion,
      mod.category,
      mod.description,
      JSON.stringify(mod.dependencies),
      JSON.stringify(mod.requiredPermissions),
      JSON.stringify(mod.features),
      mod.isCore ? 'active' : 'inactive',
      'nominal',
      0,
      JSON.stringify({ lazyLoad: true, auditEvents: true }),
      mod.isCore ? 1 : 0,
      now
    );
  }

  // Seed default global settings idempotently
  const insertSetting = db.prepare(`
    INSERT OR IGNORE INTO klyv_global_settings (key, value, updated_at)
    VALUES (?, ?, ?)
  `);
  const defaultSettings: Array<[string, string]> = [
    ['platform_name', 'Klyverion Business Suite'],
    ['platform_slogan', 'One Platform. Every Business Operation.'],
    ['data_retention_days', '1825'],
    ['default_theme', 'light'],
    ['api_rate_limit_rpm', '120'],
    ['gdpr_anonymize_on_purge', 'true'],
  ];
  for (const [k, v] of defaultSettings) {
    insertSetting.run(k, v, now);
  }
}

export function logAuditEvent(params: {
  actorUserId: number | null;
  actorEmail: string;
  companyId?: number | null;
  action: string;
  resourceType: string;
  resourceId: string;
  severity?: 'info' | 'warning' | 'critical';
  ipAddress?: string;
  metadata?: Record<string, unknown>;
}): void {
  db.prepare(`
    INSERT INTO klyv_audit_logs (
      actor_user_id, actor_email, company_id, action, resource_type,
      resource_id, severity, ip_address, metadata_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    params.actorUserId,
    params.actorEmail,
    params.companyId ?? 1,
    params.action,
    params.resourceType,
    params.resourceId,
    params.severity ?? 'info',
    params.ipAddress ?? '127.0.0.1',
    JSON.stringify(params.metadata ?? {}),
    new Date().toISOString()
  );
}

export function createNotification(params: {
  companyId?: number;
  title: string;
  message: string;
  severity?: 'info' | 'warning' | 'critical';
}): void {
  db.prepare(`
    INSERT INTO klyv_notifications (company_id, title, message, severity, is_read, created_at)
    VALUES (?, ?, ?, ?, 0, ?)
  `).run(
    params.companyId ?? 1,
    params.title,
    params.message,
    params.severity ?? 'info',
    new Date().toISOString()
  );
}
