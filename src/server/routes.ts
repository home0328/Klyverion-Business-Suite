import fs from 'node:fs';
import path from 'node:path';
import { Router, type Request, type Response } from 'express';
import {
  type AuthedRequest,
  hashPassword,
  isEnvPasscodeConfigured,
  loadUserWithPermissions,
  requireAuth,
  requirePermission,
  signSessionToken,
  verifyEnvAdminPasscode,
  verifyPassword,
} from './auth.ts';
import { DASHBOARD_WIDGETS, PERMISSION_CATALOG } from './catalog.ts';
import { createNotification, db, logAuditEvent } from './db.ts';
import { buildCompleteProjectZip, buildWordPressBundleZip } from './packager.ts';

const WP_ROOT = path.resolve(process.cwd(), 'wp-ecosystem');

function getClientIp(req: Request): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) {
    return fwd.split(',')[0].trim();
  }
  return req.socket.remoteAddress || '127.0.0.1';
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function createApiRouter(): Router {
  const router = Router();

  // Public health check
  router.get('/health', (_req: Request, res: Response) => {
    res.json({ ok: true, data: { status: 'nominal', coreVersion: '1.0.0', phase: 1 } });
  });

  // Check whether first-run setup is claimed
  router.get('/auth/status', (_req: Request, res: Response) => {
    const userCount = (db.prepare('SELECT COUNT(*) as c FROM klyv_users').get() as { c: number }).c;
    const company = db.prepare('SELECT trade_name FROM klyv_companies ORDER BY id ASC LIMIT 1').get() as
      | { trade_name: string }
      | undefined;

    res.json({
      ok: true,
      data: {
        initialized: userCount > 0,
        envPasscodeActive: isEnvPasscodeConfigured(),
        companyName: company?.trade_name ?? 'Klyverion Business Suite',
      },
    });
  });

  // First-run atomic Superadmin setup/claim route
  router.post('/auth/setup', (req: Request, res: Response) => {
    const existingCount = (db.prepare('SELECT COUNT(*) as c FROM klyv_users').get() as { c: number }).c;
    if (existingCount > 0) {
      res.status(409).json({
        ok: false,
        error: { code: 'ALREADY_INITIALIZED', message: 'A instalação inicial já foi concluída. Faça login com suas credenciais.' },
      });
      return;
    }

    const { name, email, password, companyLegalName, companyTradeName, taxId, currency, initialModules } = req.body ?? {};
    const cleanName = typeof name === 'string' ? name.trim() : '';
    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const cleanPassword = typeof password === 'string' ? password : '';
    const cleanTrade = typeof companyTradeName === 'string' && companyTradeName.trim() ? companyTradeName.trim() : 'Klyverion Enterprise';
    const cleanLegal = typeof companyLegalName === 'string' && companyLegalName.trim() ? companyLegalName.trim() : cleanTrade;
    const cleanTaxId = typeof taxId === 'string' ? taxId.trim() : '';
    const cleanCurrency = ['BRL', 'USD', 'EUR'].includes(currency) ? currency : 'BRL';

    if (cleanName.length < 2 || !isValidEmail(cleanEmail) || cleanPassword.length < 8) {
      res.status(400).json({
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'Informe nome válido, e-mail corporativo e senha com no mínimo 8 caracteres.' },
      });
      return;
    }

    const superRole = db.prepare("SELECT id FROM klyv_roles WHERE slug = 'superadmin'").get() as { id: number } | undefined;
    if (!superRole) {
      res.status(500).json({ ok: false, error: { code: 'ROLE_MISSING', message: 'Perfil superadministrador ausente.' } });
      return;
    }

    const now = new Date().toISOString();
    const companyRes = db.prepare(`
      INSERT INTO klyv_companies (legal_name, trade_name, tax_id, currency, language, timezone, status, created_at)
      VALUES (?, ?, ?, ?, 'pt-BR', 'America/Sao_Paulo', 'active', ?)
    `).run(cleanLegal, cleanTrade, cleanTaxId, cleanCurrency, now);
    const companyId = Number(companyRes.lastInsertRowid);

    const passwordHash = hashPassword(cleanPassword);
    const userRes = db.prepare(`
      INSERT INTO klyv_users (company_id, role_id, name, email, password_hash, department, status, avatar_url, last_login_at, created_at)
      VALUES (?, ?, ?, ?, ?, 'Diretoria & Arquitetura', 'active', '/src/assets/images/avatar_executive_admin_1795373702972.jpg', ?, ?)
    `).run(companyId, superRole.id, cleanName, cleanEmail, passwordHash, now, now);
    const userId = Number(userRes.lastInsertRowid);

    // Optional initial modules selected during setup (respecting dependencies)
    if (Array.isArray(initialModules)) {
      const activateStmt = db.prepare("UPDATE klyv_modules SET status = 'active', updated_at = ? WHERE slug = ?");
      const historyStmt = db.prepare(`
        INSERT INTO klyv_module_history (module_slug, event_type, version, actor_name, notes, created_at)
        VALUES (?, 'activated', '1.0.0', ?, 'Ativado na configuração inicial da Fase 1', ?)
      `);
      for (const slug of initialModules) {
        if (typeof slug === 'string' && ['klyverion-crm', 'klyverion-financeiro', 'klyverion-estoque', 'klyverion-projetos'].includes(slug)) {
          activateStmt.run(now, slug);
          historyStmt.run(slug, cleanName, now);
        }
      }
    }

    logAuditEvent({
      actorUserId: userId,
      actorEmail: cleanEmail,
      companyId,
      action: 'core.setup.completed',
      resourceType: 'system',
      resourceId: 'klyverion-core',
      ipAddress: getClientIp(req),
      metadata: { companyTradeName: cleanTrade, currency: cleanCurrency },
    });

    createNotification({
      companyId,
      title: 'Klyverion Core Inicializado',
      message: `Ambiente empresarial "${cleanTrade}" provisionado com sucesso para ${cleanName}.`,
      severity: 'info',
    });

    const user = loadUserWithPermissions(userId);
    const token = signSessionToken(userId, companyId);
    res.status(201).json({ ok: true, data: { token, user } });
  });

  // Login endpoint
  router.post('/auth/login', (req: Request, res: Response) => {
    const { email, password } = req.body ?? {};
    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const cleanPassword = typeof password === 'string' ? password : '';

    if (!isValidEmail(cleanEmail) || !cleanPassword) {
      res.status(400).json({
        ok: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Informe e-mail e senha válidos.' },
      });
      return;
    }

    const row = db.prepare(`
      SELECT u.id, u.company_id, u.password_hash, u.status, r.slug as role_slug
      FROM klyv_users u
      JOIN klyv_roles r ON r.id = u.role_id
      WHERE u.email = ?
    `).get(cleanEmail) as
      | { id: number; company_id: number; password_hash: string; status: string; role_slug: string }
      | undefined;

    if (!row) {
      res.status(401).json({
        ok: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Credenciais inválidas.' },
      });
      return;
    }

    if (row.status !== 'active') {
      res.status(403).json({
        ok: false,
        error: { code: 'ACCOUNT_SUSPENDED', message: 'Esta conta está suspensa pelo administrador.' },
      });
      return;
    }

    const passwordMatches =
      verifyPassword(cleanPassword, row.password_hash) ||
      (row.role_slug === 'superadmin' && verifyEnvAdminPasscode(cleanPassword));

    if (!passwordMatches) {
      logAuditEvent({
        actorUserId: row.id,
        actorEmail: cleanEmail,
        companyId: row.company_id,
        action: 'auth.login.failed',
        resourceType: 'session',
        resourceId: String(row.id),
        severity: 'warning',
        ipAddress: getClientIp(req),
      });
      res.status(401).json({
        ok: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'E-mail ou senha incorretos.' },
      });
      return;
    }

    const now = new Date().toISOString();
    db.prepare('UPDATE klyv_users SET last_login_at = ? WHERE id = ?').run(now, row.id);

    logAuditEvent({
      actorUserId: row.id,
      actorEmail: cleanEmail,
      companyId: row.company_id,
      action: 'auth.login.success',
      resourceType: 'session',
      resourceId: String(row.id),
      ipAddress: getClientIp(req),
    });

    const user = loadUserWithPermissions(row.id);
    const token = signSessionToken(row.id, row.company_id);
    res.json({ ok: true, data: { token, user } });
  });

  // Current authenticated user
  router.get('/auth/me', requireAuth, (req: AuthedRequest, res: Response) => {
    const company = db.prepare('SELECT * FROM klyv_companies WHERE id = ?').get(req.authUser!.companyId);
    res.json({ ok: true, data: { user: req.authUser, company } });
  });

  // Dashboard Summary (strictly governed by active modules + user RBAC permissions)
  router.get('/dashboard/summary', requireAuth, requirePermission('core.dashboard.view'), (req: AuthedRequest, res: Response) => {
    const user = req.authUser!;
    const modules = db.prepare('SELECT slug, name, status, phase, health_status FROM klyv_modules').all() as Array<{
      slug: string;
      name: string;
      status: string;
      phase: number;
      health_status: string;
    }>;

    const moduleStatusMap = new Map(modules.map((m) => [m.slug, m]));
    const activeModulesCount = modules.filter((m) => m.status === 'active').length;
    const usersCount = (db.prepare('SELECT COUNT(*) as c FROM klyv_users WHERE status = ?').get('active') as { c: number }).c;
    const rolesCount = (db.prepare('SELECT COUNT(*) as c FROM klyv_roles').get() as { c: number }).c;
    const auditCount = (db.prepare('SELECT COUNT(*) as c FROM klyv_audit_logs').get() as { c: number }).c;
    const unreadNotifs = (db.prepare('SELECT COUNT(*) as c FROM klyv_notifications WHERE is_read = 0').get() as { c: number }).c;

    const prefsRow = db.prepare('SELECT * FROM klyv_dashboard_preferences WHERE user_id = ?').get(user.id) as
      | { hidden_widgets_json: string; widget_order_json: string; refresh_interval_sec: number }
      | undefined;

    const hiddenWidgets: string[] = prefsRow ? JSON.parse(prefsRow.hidden_widgets_json) : [];
    const widgetOrder: string[] = prefsRow ? JSON.parse(prefsRow.widget_order_json) : [];

    // Filter widgets by RBAC permission; expose module active status honestly
    const authorizedWidgets = DASHBOARD_WIDGETS.filter(
      (w) => user.roleSlug === 'superadmin' || user.permissions.includes(w.requiredPermission)
    ).map((w) => {
      const mod = moduleStatusMap.get(w.moduleSlug);
      const isModuleActive = mod?.status === 'active';
      return {
        ...w,
        moduleName: mod?.name ?? w.moduleSlug,
        modulePhase: mod?.phase ?? 2,
        isModuleActive,
        isVisible: !hiddenWidgets.includes(w.id),
        // Real Phase 1 value: 0 until operational transactions are recorded in Phase 2+
        value: isModuleActive ? 0 : null,
      };
    });

    if (widgetOrder.length > 0) {
      authorizedWidgets.sort((a, b) => {
        const ia = widgetOrder.indexOf(a.id);
        const ib = widgetOrder.indexOf(b.id);
        if (ia === -1 && ib === -1) return 0;
        if (ia === -1) return 1;
        if (ib === -1) return -1;
        return ia - ib;
      });
    }

    const recentAudit = user.roleSlug === 'superadmin' || user.permissions.includes('core.audit.view')
      ? db.prepare('SELECT id, actor_email, action, resource_type, resource_id, severity, created_at FROM klyv_audit_logs ORDER BY id DESC LIMIT 6').all()
      : [];

    const company = db.prepare('SELECT legal_name, trade_name, currency, timezone FROM klyv_companies WHERE id = ?').get(user.companyId);

    res.json({
      ok: true,
      data: {
        company,
        coreMetrics: {
          activeModules: activeModulesCount,
          totalModules: modules.length,
          activeUsers: usersCount,
          rolesCount,
          auditEvents: auditCount,
          unreadNotifications: unreadNotifs,
        },
        widgets: authorizedWidgets,
        preferences: {
          hiddenWidgets,
          widgetOrder,
          refreshIntervalSec: prefsRow?.refresh_interval_sec ?? 60,
        },
        recentAudit,
      },
    });
  });

  // Save personalized dashboard preferences
  router.put('/dashboard/preferences', requireAuth, requirePermission('core.dashboard.customize'), (req: AuthedRequest, res: Response) => {
    const user = req.authUser!;
    const { hiddenWidgets, widgetOrder, refreshIntervalSec } = req.body ?? {};
    const cleanHidden = Array.isArray(hiddenWidgets) ? hiddenWidgets.filter((x) => typeof x === 'string') : [];
    const cleanOrder = Array.isArray(widgetOrder) ? widgetOrder.filter((x) => typeof x === 'string') : [];
    const cleanRefresh = typeof refreshIntervalSec === 'number' && [30, 60, 300, 0].includes(refreshIntervalSec) ? refreshIntervalSec : 60;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO klyv_dashboard_preferences (user_id, hidden_widgets_json, widget_order_json, refresh_interval_sec, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        hidden_widgets_json = excluded.hidden_widgets_json,
        widget_order_json = excluded.widget_order_json,
        refresh_interval_sec = excluded.refresh_interval_sec,
        updated_at = excluded.updated_at
    `).run(user.id, JSON.stringify(cleanHidden), JSON.stringify(cleanOrder), cleanRefresh, now);

    res.json({ ok: true, data: { hiddenWidgets: cleanHidden, widgetOrder: cleanOrder, refreshIntervalSec: cleanRefresh } });
  });

  // App Center: List all modules
  router.get('/modules', requireAuth, requirePermission('core.modules.view'), (_req: AuthedRequest, res: Response) => {
    const rows = db.prepare('SELECT * FROM klyv_modules ORDER BY is_core DESC, phase ASC, code ASC').all() as Array<Record<string, unknown>>;
    const historyRows = db.prepare('SELECT * FROM klyv_module_history ORDER BY id DESC LIMIT 100').all() as Array<Record<string, unknown>>;

    const modules = rows.map((r) => ({
      slug: r.slug,
      code: r.code,
      name: r.name,
      phase: r.phase,
      version: r.version,
      latestVersion: r.latest_version,
      minCoreVersion: r.min_core_version,
      category: r.category,
      description: r.description,
      dependencies: JSON.parse(String(r.dependencies_json || '[]')),
      requiredPermissions: JSON.parse(String(r.required_permissions_json || '[]')),
      features: JSON.parse(String(r.features_json || '[]')),
      status: r.status,
      healthStatus: r.health_status,
      dataRetainedRecords: r.data_retained_records,
      settings: JSON.parse(String(r.settings_json || '{}')),
      isCore: Boolean(r.is_core),
      updatedAt: r.updated_at,
      history: historyRows.filter((h) => h.module_slug === r.slug),
    }));

    res.json({ ok: true, data: { modules } });
  });

  // App Center: Activate module with dependency validation
  router.post('/modules/:slug/activate', requireAuth, requirePermission('core.modules.manage'), (req: AuthedRequest, res: Response) => {
    const slug = String(req.params.slug || '').trim();
    const mod = db.prepare('SELECT * FROM klyv_modules WHERE slug = ?').get(slug) as Record<string, unknown> | undefined;
    if (!mod) {
      res.status(404).json({ ok: false, error: { code: 'MODULE_NOT_FOUND', message: 'Módulo não encontrado.' } });
      return;
    }

    const deps: string[] = JSON.parse(String(mod.dependencies_json || '[]'));
    const missingDeps: Array<{ slug: string; name: string }> = [];
    for (const depSlug of deps) {
      const depMod = db.prepare('SELECT slug, name, status FROM klyv_modules WHERE slug = ?').get(depSlug) as
        | { slug: string; name: string; status: string }
        | undefined;
      if (!depMod || depMod.status !== 'active') {
        missingDeps.push({ slug: depSlug, name: depMod?.name ?? depSlug });
      }
    }

    if (missingDeps.length > 0) {
      res.status(409).json({
        ok: false,
        error: {
          code: 'MISSING_DEPENDENCIES',
          message: `Dependências obrigatórias inativas: ${missingDeps.map((d) => d.name).join(', ')}.`,
          details: { missingDeps },
        },
      });
      return;
    }

    const now = new Date().toISOString();
    db.prepare("UPDATE klyv_modules SET status = 'active', health_status = 'nominal', updated_at = ? WHERE slug = ?").run(now, slug);
    db.prepare(`
      INSERT INTO klyv_module_history (module_slug, event_type, version, actor_name, notes, created_at)
      VALUES (?, 'activated', ?, ?, 'Módulo ativado via App Center', ?)
    `).run(slug, String(mod.version), req.authUser!.name, now);

    logAuditEvent({
      actorUserId: req.authUser!.id,
      actorEmail: req.authUser!.email,
      companyId: req.authUser!.companyId,
      action: 'module.activated',
      resourceType: 'module',
      resourceId: slug,
      ipAddress: getClientIp(req),
      metadata: { version: mod.version },
    });

    createNotification({
      companyId: req.authUser!.companyId,
      title: `Módulo Ativado: ${mod.name}`,
      message: `O módulo ${mod.name} (v${mod.version}) foi ativado por ${req.authUser!.name}.`,
    });

    res.json({ ok: true, data: { slug, status: 'active' } });
  });

  // App Center: Safe deactivation (checks dependents, preserves data)
  router.post('/modules/:slug/deactivate', requireAuth, requirePermission('core.modules.manage'), (req: AuthedRequest, res: Response) => {
    const slug = String(req.params.slug || '').trim();
    const mod = db.prepare('SELECT * FROM klyv_modules WHERE slug = ?').get(slug) as Record<string, unknown> | undefined;
    if (!mod) {
      res.status(404).json({ ok: false, error: { code: 'MODULE_NOT_FOUND', message: 'Módulo não encontrado.' } });
      return;
    }
    if (mod.is_core) {
      res.status(409).json({ ok: false, error: { code: 'CORE_REQUIRED', message: 'O Klyverion Core é obrigatório e não pode ser desativado.' } });
      return;
    }

    const allActive = db.prepare("SELECT slug, name, dependencies_json FROM klyv_modules WHERE status = 'active' AND slug != ?").all(slug) as Array<{
      slug: string;
      name: string;
      dependencies_json: string;
    }>;

    const dependents = allActive.filter((other) => {
      const deps: string[] = JSON.parse(other.dependencies_json || '[]');
      return deps.includes(slug);
    });

    if (dependents.length > 0) {
      res.status(409).json({
        ok: false,
        error: {
          code: 'ACTIVE_DEPENDENTS',
          message: `Desative primeiro os módulos dependentes: ${dependents.map((d) => d.name).join(', ')}.`,
          details: { dependents: dependents.map((d) => ({ slug: d.slug, name: d.name })) },
        },
      });
      return;
    }

    const now = new Date().toISOString();
    db.prepare("UPDATE klyv_modules SET status = 'inactive', updated_at = ? WHERE slug = ?").run(now, slug);
    db.prepare(`
      INSERT INTO klyv_module_history (module_slug, event_type, version, actor_name, notes, created_at)
      VALUES (?, 'deactivated', ?, ?, 'Módulo desativado com preservação integral de dados e configurações', ?)
    `).run(slug, String(mod.version), req.authUser!.name, now);

    logAuditEvent({
      actorUserId: req.authUser!.id,
      actorEmail: req.authUser!.email,
      companyId: req.authUser!.companyId,
      action: 'module.deactivated',
      resourceType: 'module',
      resourceId: slug,
      ipAddress: getClientIp(req),
      metadata: { dataPreserved: true },
    });

    res.json({ ok: true, data: { slug, status: 'inactive', dataPreserved: true } });
  });

  // App Center: Individual module settings
  router.put('/modules/:slug/settings', requireAuth, requirePermission('core.modules.manage'), (req: AuthedRequest, res: Response) => {
    const slug = String(req.params.slug || '').trim();
    const mod = db.prepare('SELECT slug, name FROM klyv_modules WHERE slug = ?').get(slug) as { slug: string; name: string } | undefined;
    if (!mod) {
      res.status(404).json({ ok: false, error: { code: 'MODULE_NOT_FOUND', message: 'Módulo não encontrado.' } });
      return;
    }

    const settings = req.body?.settings;
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
      res.status(400).json({ ok: false, error: { code: 'INVALID_SETTINGS', message: 'Configurações inválidas.' } });
      return;
    }

    const now = new Date().toISOString();
    db.prepare('UPDATE klyv_modules SET settings_json = ?, updated_at = ? WHERE slug = ?').run(JSON.stringify(settings), now, slug);

    logAuditEvent({
      actorUserId: req.authUser!.id,
      actorEmail: req.authUser!.email,
      companyId: req.authUser!.companyId,
      action: 'module.settings.updated',
      resourceType: 'module',
      resourceId: slug,
      ipAddress: getClientIp(req),
    });

    res.json({ ok: true, data: { slug, settings } });
  });

  // App Center: Apply module update when latestVersion > version
  router.post('/modules/:slug/update', requireAuth, requirePermission('core.modules.manage'), (req: AuthedRequest, res: Response) => {
    const slug = String(req.params.slug || '').trim();
    const mod = db.prepare('SELECT slug, name, version, latest_version FROM klyv_modules WHERE slug = ?').get(slug) as
      | { slug: string; name: string; version: string; latest_version: string }
      | undefined;

    if (!mod) {
      res.status(404).json({ ok: false, error: { code: 'MODULE_NOT_FOUND', message: 'Módulo não encontrado.' } });
      return;
    }
    if (mod.version === mod.latest_version) {
      res.json({ ok: true, data: { slug, version: mod.version, updated: false } });
      return;
    }

    const now = new Date().toISOString();
    db.prepare('UPDATE klyv_modules SET version = latest_version, updated_at = ? WHERE slug = ?').run(now, slug);
    db.prepare(`
      INSERT INTO klyv_module_history (module_slug, event_type, version, actor_name, notes, created_at)
      VALUES (?, 'updated', ?, ?, ?, ?)
    `).run(slug, mod.latest_version, req.authUser!.name, `Atualizado de v${mod.version} para v${mod.latest_version}`, now);

    logAuditEvent({
      actorUserId: req.authUser!.id,
      actorEmail: req.authUser!.email,
      companyId: req.authUser!.companyId,
      action: 'module.updated',
      resourceType: 'module',
      resourceId: slug,
      ipAddress: getClientIp(req),
      metadata: { from: mod.version, to: mod.latest_version },
    });

    res.json({ ok: true, data: { slug, version: mod.latest_version, updated: true } });
  });

  // App Center: Explicit data purge with confirmation slug & optional backup flag
  router.post('/modules/:slug/purge', requireAuth, requirePermission('core.backup.manage'), (req: AuthedRequest, res: Response) => {
    const slug = String(req.params.slug || '').trim();
    const { confirmSlug, backupDownloaded } = req.body ?? {};
    const mod = db.prepare('SELECT slug, name, status, is_core, settings_json FROM klyv_modules WHERE slug = ?').get(slug) as
      | { slug: string; name: string; status: string; is_core: number; settings_json: string }
      | undefined;

    if (!mod) {
      res.status(404).json({ ok: false, error: { code: 'MODULE_NOT_FOUND', message: 'Módulo não encontrado.' } });
      return;
    }
    if (mod.is_core) {
      res.status(409).json({ ok: false, error: { code: 'CORE_PROTECTED', message: 'Dados do Core não podem ser expurgados.' } });
      return;
    }
    if (mod.status === 'active') {
      res.status(409).json({ ok: false, error: { code: 'MODULE_ACTIVE', message: 'Desative o módulo antes de excluir seus dados.' } });
      return;
    }
    if (confirmSlug !== slug) {
      res.status(400).json({ ok: false, error: { code: 'CONFIRMATION_MISMATCH', message: 'Confirmação de slug incorreta.' } });
      return;
    }

    const now = new Date().toISOString();
    db.prepare("UPDATE klyv_modules SET data_retained_records = 0, settings_json = '{}', updated_at = ? WHERE slug = ?").run(now, slug);
    db.prepare(`
      INSERT INTO klyv_module_history (module_slug, event_type, version, actor_name, notes, created_at)
      VALUES (?, 'purged', '1.0.0', ?, ?, ?)
    `).run(slug, req.authUser!.name, `Expurgo explícito executado (backup prévio: ${backupDownloaded ? 'sim' : 'não'})`, now);

    logAuditEvent({
      actorUserId: req.authUser!.id,
      actorEmail: req.authUser!.email,
      companyId: req.authUser!.companyId,
      action: 'module.data.purged',
      resourceType: 'module',
      resourceId: slug,
      severity: 'critical',
      ipAddress: getClientIp(req),
      metadata: { backupDownloaded: Boolean(backupDownloaded) },
    });

    res.json({ ok: true, data: { slug, purged: true } });
  });

  // Users Management
  router.get('/users', requireAuth, requirePermission('core.users.view'), (_req: AuthedRequest, res: Response) => {
    const users = db.prepare(`
      SELECT u.id, u.company_id, u.role_id, u.name, u.email, u.department, u.status, u.last_login_at, u.created_at,
             r.slug as role_slug, r.name as role_name
      FROM klyv_users u
      JOIN klyv_roles r ON r.id = u.role_id
      ORDER BY u.id ASC
    `).all();
    res.json({ ok: true, data: { users } });
  });

  router.post('/users', requireAuth, requirePermission('core.users.manage'), (req: AuthedRequest, res: Response) => {
    const { name, email, password, roleId, department } = req.body ?? {};
    const cleanName = typeof name === 'string' ? name.trim() : '';
    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const cleanPassword = typeof password === 'string' ? password : '';
    const cleanDept = typeof department === 'string' && department.trim() ? department.trim() : 'Operações';
    const numericRoleId = Number(roleId);

    if (cleanName.length < 2 || !isValidEmail(cleanEmail) || cleanPassword.length < 8 || !Number.isInteger(numericRoleId)) {
      res.status(400).json({
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'Nome, e-mail válido, perfil e senha (>= 8 caracteres) são obrigatórios.' },
      });
      return;
    }

    const roleExists = db.prepare('SELECT id, slug, name FROM klyv_roles WHERE id = ?').get(numericRoleId) as
      | { id: number; slug: string; name: string }
      | undefined;
    if (!roleExists) {
      res.status(404).json({ ok: false, error: { code: 'ROLE_NOT_FOUND', message: 'Perfil de acesso inválido.' } });
      return;
    }

    const duplicate = db.prepare('SELECT id FROM klyv_users WHERE email = ?').get(cleanEmail);
    if (duplicate) {
      res.status(409).json({ ok: false, error: { code: 'EMAIL_EXISTS', message: 'Já existe um usuário com este e-mail.' } });
      return;
    }

    const now = new Date().toISOString();
    const info = db.prepare(`
      INSERT INTO klyv_users (company_id, role_id, name, email, password_hash, department, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'active', ?)
    `).run(req.authUser!.companyId, numericRoleId, cleanName, cleanEmail, hashPassword(cleanPassword), cleanDept, now);

    const newId = Number(info.lastInsertRowid);
    logAuditEvent({
      actorUserId: req.authUser!.id,
      actorEmail: req.authUser!.email,
      companyId: req.authUser!.companyId,
      action: 'user.created',
      resourceType: 'user',
      resourceId: String(newId),
      ipAddress: getClientIp(req),
      metadata: { targetEmail: cleanEmail, role: roleExists.slug },
    });

    res.status(201).json({
      ok: true,
      data: {
        user: {
          id: newId,
          name: cleanName,
          email: cleanEmail,
          department: cleanDept,
          role_id: numericRoleId,
          role_slug: roleExists.slug,
          role_name: roleExists.name,
          status: 'active',
          created_at: now,
        },
      },
    });
  });

  router.patch('/users/:id', requireAuth, requirePermission('core.users.manage'), (req: AuthedRequest, res: Response) => {
    const targetId = Number(req.params.id);
    if (!Number.isInteger(targetId)) {
      res.status(400).json({ ok: false, error: { code: 'INVALID_ID', message: 'ID de usuário inválido.' } });
      return;
    }

    const existing = db.prepare('SELECT id, email, status, role_id FROM klyv_users WHERE id = ?').get(targetId) as
      | { id: number; email: string; status: string; role_id: number }
      | undefined;
    if (!existing) {
      res.status(404).json({ ok: false, error: { code: 'USER_NOT_FOUND', message: 'Usuário não encontrado.' } });
      return;
    }

    const { status, roleId, department } = req.body ?? {};
    const nextStatus = status === 'active' || status === 'suspended' ? status : existing.status;
    if (targetId === req.authUser!.id && nextStatus === 'suspended') {
      res.status(409).json({ ok: false, error: { code: 'SELF_LOCKOUT', message: 'Não é possível suspender sua própria conta ativa.' } });
      return;
    }

    const nextRoleId = typeof roleId === 'number' && Number.isInteger(roleId) ? roleId : existing.role_id;
    const roleExists = db.prepare('SELECT id FROM klyv_roles WHERE id = ?').get(nextRoleId);
    if (!roleExists) {
      res.status(404).json({ ok: false, error: { code: 'ROLE_NOT_FOUND', message: 'Perfil não encontrado.' } });
      return;
    }

    if (typeof department === 'string' && department.trim()) {
      db.prepare('UPDATE klyv_users SET status = ?, role_id = ?, department = ? WHERE id = ?').run(
        nextStatus,
        nextRoleId,
        department.trim(),
        targetId
      );
    } else {
      db.prepare('UPDATE klyv_users SET status = ?, role_id = ? WHERE id = ?').run(nextStatus, nextRoleId, targetId);
    }

    logAuditEvent({
      actorUserId: req.authUser!.id,
      actorEmail: req.authUser!.email,
      companyId: req.authUser!.companyId,
      action: 'user.updated',
      resourceType: 'user',
      resourceId: String(targetId),
      ipAddress: getClientIp(req),
      metadata: { nextStatus, nextRoleId },
    });

    res.json({ ok: true, data: { id: targetId, status: nextStatus, roleId: nextRoleId } });
  });

  // Roles & Granular RBAC Matrix
  router.get('/roles', requireAuth, requirePermission('core.users.view'), (_req: AuthedRequest, res: Response) => {
    const roles = db.prepare('SELECT * FROM klyv_roles ORDER BY is_system DESC, id ASC').all() as Array<{
      id: number;
      slug: string;
      name: string;
      description: string;
      is_system: number;
      created_at: string;
    }>;

    const mappings = db.prepare('SELECT role_id, permission_key FROM klyv_role_permissions').all() as Array<{
      role_id: number;
      permission_key: string;
    }>;

    const hydrated = roles.map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      description: r.description,
      isSystem: Boolean(r.is_system),
      createdAt: r.created_at,
      permissions: mappings.filter((m) => m.role_id === r.id).map((m) => m.permission_key),
    }));

    res.json({ ok: true, data: { roles: hydrated, permissionCatalog: PERMISSION_CATALOG } });
  });

  router.post('/roles', requireAuth, requirePermission('core.roles.manage'), (req: AuthedRequest, res: Response) => {
    const { name, description, permissions } = req.body ?? {};
    const cleanName = typeof name === 'string' ? name.trim() : '';
    const cleanDesc = typeof description === 'string' ? description.trim() : '';
    if (cleanName.length < 3) {
      res.status(400).json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'Nome do perfil deve ter ao menos 3 caracteres.' } });
      return;
    }

    const slug = cleanName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 48);

    const existing = db.prepare('SELECT id FROM klyv_roles WHERE slug = ?').get(slug);
    if (existing) {
      res.status(409).json({ ok: false, error: { code: 'ROLE_EXISTS', message: 'Já existe um perfil com identificador equivalente.' } });
      return;
    }

    const now = new Date().toISOString();
    const resInsert = db.prepare(`
      INSERT INTO klyv_roles (slug, name, description, is_system, created_at)
      VALUES (?, ?, ?, 0, ?)
    `).run(slug || `custom_${Date.now()}`, cleanName, cleanDesc || 'Perfil personalizado criado pelo administrador.', now);
    const roleId = Number(resInsert.lastInsertRowid);

    const validPermKeys = new Set(PERMISSION_CATALOG.map((p) => p.key));
    const permList = Array.isArray(permissions)
      ? permissions.filter((k) => typeof k === 'string' && validPermKeys.has(k))
      : ['core.dashboard.view'];

    const insertRP = db.prepare('INSERT OR IGNORE INTO klyv_role_permissions (role_id, permission_key) VALUES (?, ?)');
    for (const k of permList) {
      insertRP.run(roleId, k);
    }

    logAuditEvent({
      actorUserId: req.authUser!.id,
      actorEmail: req.authUser!.email,
      companyId: req.authUser!.companyId,
      action: 'rbac.role.created',
      resourceType: 'role',
      resourceId: String(roleId),
      ipAddress: getClientIp(req),
      metadata: { name: cleanName, permissionsCount: permList.length },
    });

    res.status(201).json({ ok: true, data: { id: roleId, slug, name: cleanName, permissions: permList } });
  });

  router.put('/roles/:id/permissions', requireAuth, requirePermission('core.roles.manage'), (req: AuthedRequest, res: Response) => {
    const roleId = Number(req.params.id);
    if (!Number.isInteger(roleId)) {
      res.status(400).json({ ok: false, error: { code: 'INVALID_ID', message: 'ID de perfil inválido.' } });
      return;
    }

    const role = db.prepare('SELECT id, slug, name FROM klyv_roles WHERE id = ?').get(roleId) as
      | { id: number; slug: string; name: string }
      | undefined;
    if (!role) {
      res.status(404).json({ ok: false, error: { code: 'ROLE_NOT_FOUND', message: 'Perfil não encontrado.' } });
      return;
    }
    if (role.slug === 'superadmin') {
      res.status(409).json({
        ok: false,
        error: { code: 'SUPERADMIN_PROTECTED', message: 'O perfil Superadministrador mantém acesso integral garantido pelo Core.' },
      });
      return;
    }

    const validKeys = new Set(PERMISSION_CATALOG.map((p) => p.key));
    const nextPerms: string[] = Array.isArray(req.body?.permissions)
      ? req.body.permissions.filter((k: unknown) => typeof k === 'string' && validKeys.has(k))
      : [];

    db.prepare('DELETE FROM klyv_role_permissions WHERE role_id = ?').run(roleId);
    const insertRP = db.prepare('INSERT OR IGNORE INTO klyv_role_permissions (role_id, permission_key) VALUES (?, ?)');
    for (const k of nextPerms) {
      insertRP.run(roleId, k);
    }

    logAuditEvent({
      actorUserId: req.authUser!.id,
      actorEmail: req.authUser!.email,
      companyId: req.authUser!.companyId,
      action: 'rbac.permissions.updated',
      resourceType: 'role',
      resourceId: role.slug,
      ipAddress: getClientIp(req),
      metadata: { grantedCount: nextPerms.length },
    });

    res.json({ ok: true, data: { roleId, permissions: nextPerms } });
  });

  // Audit logs
  router.get('/audit', requireAuth, requirePermission('core.audit.view'), (req: AuthedRequest, res: Response) => {
    const severity = typeof req.query.severity === 'string' ? req.query.severity : 'all';
    const limit = Math.min(Number(req.query.limit) || 50, 200);

    const rows =
      severity !== 'all' && ['info', 'warning', 'critical'].includes(severity)
        ? db.prepare('SELECT * FROM klyv_audit_logs WHERE severity = ? ORDER BY id DESC LIMIT ?').all(severity, limit)
        : db.prepare('SELECT * FROM klyv_audit_logs ORDER BY id DESC LIMIT ?').all(limit);

    res.json({ ok: true, data: { logs: rows } });
  });

  // Notifications
  router.get('/notifications', requireAuth, (_req: AuthedRequest, res: Response) => {
    const items = db.prepare('SELECT * FROM klyv_notifications ORDER BY id DESC LIMIT 25').all();
    res.json({ ok: true, data: { notifications: items } });
  });

  router.post('/notifications/read', requireAuth, (req: AuthedRequest, res: Response) => {
    const id = req.body?.id;
    if (typeof id === 'number' && Number.isInteger(id)) {
      db.prepare('UPDATE klyv_notifications SET is_read = 1 WHERE id = ?').run(id);
    } else {
      db.prepare('UPDATE klyv_notifications SET is_read = 1').run();
    }
    res.json({ ok: true });
  });

  // Global settings & Company
  router.get('/settings', requireAuth, (req: AuthedRequest, res: Response) => {
    const rows = db.prepare('SELECT key, value, updated_at FROM klyv_global_settings').all() as Array<{
      key: string;
      value: string;
      updated_at: string;
    }>;
    const settings: Record<string, string> = {};
    for (const r of rows) settings[r.key] = r.value;
    const company = db.prepare('SELECT * FROM klyv_companies WHERE id = ?').get(req.authUser!.companyId);
    res.json({ ok: true, data: { settings, company } });
  });

  router.put('/settings', requireAuth, requirePermission('core.settings.manage'), (req: AuthedRequest, res: Response) => {
    const { settings, company } = req.body ?? {};
    const now = new Date().toISOString();

    if (settings && typeof settings === 'object') {
      const allowedKeys = new Set([
        'platform_name',
        'platform_slogan',
        'data_retention_days',
        'default_theme',
        'api_rate_limit_rpm',
        'gdpr_anonymize_on_purge',
      ]);
      const upsert = db.prepare(`
        INSERT INTO klyv_global_settings (key, value, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
      `);
      for (const [k, v] of Object.entries(settings)) {
        if (allowedKeys.has(k) && typeof v === 'string') {
          upsert.run(k, v.trim(), now);
        }
      }
    }

    if (company && typeof company === 'object') {
      const tradeName = typeof company.trade_name === 'string' ? company.trade_name.trim() : '';
      const legalName = typeof company.legal_name === 'string' ? company.legal_name.trim() : '';
      const currency = ['BRL', 'USD', 'EUR'].includes(company.currency) ? company.currency : 'BRL';
      const timezone = typeof company.timezone === 'string' ? company.timezone.trim() : 'America/Sao_Paulo';
      if (tradeName && legalName) {
        db.prepare(`
          UPDATE klyv_companies SET trade_name = ?, legal_name = ?, currency = ?, timezone = ? WHERE id = ?
        `).run(tradeName, legalName, currency, timezone, req.authUser!.companyId);
      }
    }

    logAuditEvent({
      actorUserId: req.authUser!.id,
      actorEmail: req.authUser!.email,
      companyId: req.authUser!.companyId,
      action: 'core.settings.updated',
      resourceType: 'settings',
      resourceId: 'global',
      ipAddress: getClientIp(req),
    });

    res.json({ ok: true });
  });

  // Diagnostics & System Integrity
  router.get('/diagnostics', requireAuth, requirePermission('core.audit.view'), (_req: AuthedRequest, res: Response) => {
    const integrity = db.prepare('PRAGMA integrity_check').get() as { integrity_check: string };
    const fkStatus = db.prepare('PRAGMA foreign_keys').get() as { foreign_keys: number };
    const counts = {
      companies: (db.prepare('SELECT COUNT(*) as c FROM klyv_companies').get() as { c: number }).c,
      users: (db.prepare('SELECT COUNT(*) as c FROM klyv_users').get() as { c: number }).c,
      roles: (db.prepare('SELECT COUNT(*) as c FROM klyv_roles').get() as { c: number }).c,
      modules: (db.prepare('SELECT COUNT(*) as c FROM klyv_modules').get() as { c: number }).c,
      auditLogs: (db.prepare('SELECT COUNT(*) as c FROM klyv_audit_logs').get() as { c: number }).c,
    };

    res.json({
      ok: true,
      data: {
        sqliteIntegrity: integrity.integrity_check === 'ok',
        foreignKeysEnforced: fkStatus.foreign_keys === 1,
        nodeVersion: process.version,
        targetWordPress: '>= 6.4 (PHP 8.2+)',
        counts,
        checkedAt: new Date().toISOString(),
      },
    });
  });

  // Full safe JSON backup export (excludes password hashes)
  router.get('/backup/export', requireAuth, requirePermission('core.backup.manage'), (req: AuthedRequest, res: Response) => {
    const companies = db.prepare('SELECT * FROM klyv_companies').all();
    const roles = db.prepare('SELECT * FROM klyv_roles').all();
    const rolePermissions = db.prepare('SELECT * FROM klyv_role_permissions').all();
    const users = db.prepare('SELECT id, company_id, role_id, name, email, department, status, created_at FROM klyv_users').all();
    const modules = db.prepare('SELECT * FROM klyv_modules').all();
    const settings = db.prepare('SELECT * FROM klyv_global_settings').all();

    logAuditEvent({
      actorUserId: req.authUser!.id,
      actorEmail: req.authUser!.email,
      companyId: req.authUser!.companyId,
      action: 'core.backup.exported',
      resourceType: 'backup',
      resourceId: 'full-snapshot',
      ipAddress: getClientIp(req),
    });

    res.json({
      ok: true,
      data: {
        exportedAt: new Date().toISOString(),
        schemaVersion: '1.0.0',
        companies,
        roles,
        rolePermissions,
        users,
        modules,
        settings,
      },
    });
  });

  // Architecture & WordPress PHP File Explorer (with strict path traversal confinement)
  router.get('/architecture/files', requireAuth, (_req: AuthedRequest, res: Response) => {
    const files: Array<{ path: string; size: number; layer: string }> = [];

    function walk(dir: string) {
      if (!fs.existsSync(dir)) return;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.resolve(dir, entry.name);
        if (!full.startsWith(WP_ROOT + path.sep)) continue;
        if (entry.isDirectory()) {
          walk(full);
        } else {
          const rel = path.relative(WP_ROOT, full).replace(/\\/g, '/');
          const stat = fs.statSync(full);
          const layer = rel.startsWith('klyverion-core')
            ? 'Camada 1 — Core'
            : rel.startsWith('klyverion-theme')
            ? 'Camada 3 — Tema'
            : 'Camada 2 — Módulo';
          files.push({ path: rel, size: stat.size, layer });
        }
      }
    }

    walk(WP_ROOT);
    files.sort((a, b) => a.path.localeCompare(b.path));
    res.json({ ok: true, data: { files } });
  });

  router.get('/architecture/file', requireAuth, (req: Request, res: Response) => {
    const relPath = typeof req.query.path === 'string' ? req.query.path : '';
    if (!relPath || relPath.includes('\0')) {
      res.status(400).json({ ok: false, error: { code: 'INVALID_PATH', message: 'Caminho de arquivo inválido.' } });
      return;
    }

    const resolved = path.resolve(WP_ROOT, relPath);
    if (!resolved.startsWith(WP_ROOT + path.sep) || !fs.existsSync(resolved) || fs.statSync(resolved).isDirectory()) {
      res.status(404).json({ ok: false, error: { code: 'FILE_NOT_FOUND', message: 'Arquivo não encontrado no ecossistema.' } });
      return;
    }

    const content = fs.readFileSync(resolved, 'utf8');
    res.json({ ok: true, data: { path: relPath, content } });
  });

  // Download complete WordPress plugins + theme ZIP bundle
  router.get('/architecture/bundle', requireAuth, (req: AuthedRequest, res: Response) => {
    const zipBuffer = buildWordPressBundleZip();

    logAuditEvent({
      actorUserId: req.authUser!.id,
      actorEmail: req.authUser!.email,
      companyId: req.authUser!.companyId,
      action: 'architecture.bundle.downloaded',
      resourceType: 'package',
      resourceId: 'klyverion-wp-suite-phase1.zip',
      ipAddress: getClientIp(req),
    });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="klyverion-wp-suite-phase1.zip"');
    res.send(zipBuffer);
  });

  // Download complete full-stack + WordPress source project ZIP
  router.get('/architecture/complete-bundle', requireAuth, (req: AuthedRequest, res: Response) => {
    const zipBuffer = buildCompleteProjectZip();

    logAuditEvent({
      actorUserId: req.authUser!.id,
      actorEmail: req.authUser!.email,
      companyId: req.authUser!.companyId,
      action: 'architecture.complete_bundle.downloaded',
      resourceType: 'package',
      resourceId: 'klyverion-business-suite-complete.zip',
      ipAddress: getClientIp(req),
    });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="klyverion-business-suite-complete.zip"');
    res.send(zipBuffer);
  });

  return router;
}
