import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { db } from './db.ts';

// Keep ephemeral fallback strictly in-memory when env secret is unset
const EPHEMERAL_SESSION_SECRET = crypto.randomBytes(32).toString('hex');

function getSessionSecret(): string {
  const configured = process.env.KLYVERION_SESSION_SECRET;
  if (configured && configured.trim().length >= 16) {
    return configured.trim();
  }
  return EPHEMERAL_SESSION_SECRET;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, expectedHex] = parts;
  if (!salt || !expectedHex) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, 'hex');
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

export function verifyEnvAdminPasscode(input: string): boolean {
  const envPass = process.env.KLYVERION_ADMIN_PASSCODE?.trim();
  if (!envPass) return false;
  const a = Buffer.from(input, 'utf8');
  const b = Buffer.from(envPass, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function isEnvPasscodeConfigured(): boolean {
  return Boolean(process.env.KLYVERION_ADMIN_PASSCODE && process.env.KLYVERION_ADMIN_PASSCODE.trim().length > 0);
}

interface TokenPayload {
  uid: number;
  cid: number;
  exp: number;
}

export function signSessionToken(userId: number, companyId: number): string {
  const payload: TokenPayload = {
    uid: userId,
    cid: companyId,
    exp: Date.now() + 1000 * 60 * 60 * 12, // 12 hours
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifySessionToken(token: string): TokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  if (!encoded || !sig) return null;

  const expectedSig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(encoded)
    .digest('base64url');

  const a = Buffer.from(sig, 'utf8');
  const b = Buffer.from(expectedSig, 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as TokenPayload;
    if (!payload || typeof payload.uid !== 'number' || typeof payload.exp !== 'number') {
      return null;
    }
    if (Date.now() > payload.exp) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export interface AuthenticatedUser {
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

export interface AuthedRequest extends Request {
  authUser?: AuthenticatedUser;
}

export function loadUserWithPermissions(userId: number): AuthenticatedUser | null {
  const user = db.prepare(`
    SELECT u.id, u.company_id, u.role_id, u.name, u.email, u.department, u.status, u.avatar_url,
           r.slug as role_slug, r.name as role_name
    FROM klyv_users u
    JOIN klyv_roles r ON r.id = u.role_id
    WHERE u.id = ?
  `).get(userId) as
    | {
        id: number;
        company_id: number;
        role_id: number;
        name: string;
        email: string;
        department: string;
        status: string;
        avatar_url: string;
        role_slug: string;
        role_name: string;
      }
    | undefined;

  if (!user || user.status !== 'active') {
    return null;
  }

  const perms = db.prepare(`
    SELECT permission_key FROM klyv_role_permissions WHERE role_id = ?
  `).all(user.role_id) as Array<{ permission_key: string }>;

  return {
    id: user.id,
    companyId: user.company_id,
    roleId: user.role_id,
    roleSlug: user.role_slug,
    roleName: user.role_name,
    name: user.name,
    email: user.email,
    department: user.department,
    avatarUrl: user.avatar_url || '/src/assets/images/avatar_executive_admin_1795373702972.jpg',
    permissions: perms.map((p) => p.permission_key),
  };
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({
      ok: false,
      error: { code: 'UNAUTHORIZED', message: 'Autenticação obrigatória via Bearer token.' },
    });
    return;
  }

  const token = header.slice('Bearer '.length).trim();
  const payload = verifySessionToken(token);
  if (!payload) {
    res.status(401).json({
      ok: false,
      error: { code: 'INVALID_TOKEN', message: 'Sessão expirada ou token inválido.' },
    });
    return;
  }

  const user = loadUserWithPermissions(payload.uid);
  if (!user) {
    res.status(401).json({
      ok: false,
      error: { code: 'USER_INACTIVE', message: 'Usuário não encontrado ou suspenso.' },
    });
    return;
  }

  req.authUser = user;
  next();
}

export function requirePermission(permissionKey: string) {
  return (req: AuthedRequest, res: Response, next: NextFunction): void => {
    const user = req.authUser;
    if (!user) {
      res.status(401).json({
        ok: false,
        error: { code: 'UNAUTHORIZED', message: 'Sessão não autenticada.' },
      });
      return;
    }

    if (user.roleSlug === 'superadmin' || user.permissions.includes(permissionKey)) {
      next();
      return;
    }

    res.status(403).json({
      ok: false,
      error: {
        code: 'FORBIDDEN',
        message: `Permissão insuficiente (${permissionKey}). Verificação aplicada no servidor.`,
      },
    });
  };
}
