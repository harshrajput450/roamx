import { Request, Response, NextFunction } from 'express';
import { getSupabase } from './supabase';

export interface AuthenticatedRequest extends Request {
  adminUser?: {
    id: string;
    email: string;
    role: string;
  };
}

export const AUTHORIZED_ADMIN_EMAILS = [
  'harsh_cse24@delhitechnicalcampus.ac.in',
  'admin@roamx.com',
];

/**
 * Validates if an email is authorized to possess administrator privileges.
 */
export function isAuthorizedAdminEmail(email?: string): boolean {
  if (!email) return false;
  const lower = email.trim().toLowerCase();
  return (
    AUTHORIZED_ADMIN_EMAILS.some((admin) => admin.toLowerCase() === lower) ||
    lower.endsWith('@delhitechnicalcampus.ac.in')
  );
}

/**
 * Ensures the primary owner administrator exists in Supabase Auth with admin role metadata.
 */
export async function ensureAdminUserExists(): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  try {
    const ownerEmail = 'harsh_cse24@delhitechnicalcampus.ac.in';
    const { data: userList, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) {
      console.warn('⚠️ Could not list Supabase Auth users:', listError.message);
      return;
    }

    const existing = (userList?.users as any[])?.find(
      (u: any) => u.email?.toLowerCase() === ownerEmail.toLowerCase()
    );

    if (!existing) {
      console.log('👑 Provisioning primary Supabase Auth admin user for:', ownerEmail);
      const { error: createError } = await supabase.auth.admin.createUser({
        email: ownerEmail,
        password: process.env.ROAMX_ADMIN_INITIAL_PASSWORD || 'Harsh@RoamX2026',
        email_confirm: true,
        app_metadata: { role: 'admin' },
        user_metadata: { role: 'admin', name: 'RoamX Lead Admin' },
      });
      if (createError) {
        console.warn('⚠️ Notice provisioning admin user:', createError.message);
      } else {
        console.log('✅ Supabase Auth admin user provisioned successfully');
      }
    } else {
      // Ensure app_metadata role is 'admin'
      if (existing.app_metadata?.role !== 'admin') {
        await supabase.auth.admin.updateUserById(existing.id, {
          app_metadata: { ...existing.app_metadata, role: 'admin' },
        });
        console.log('✅ Updated existing admin user role metadata');
      }
    }
  } catch (err: any) {
    console.warn('⚠️ Supabase admin initialization error:', err.message);
  }
}

/**
 * Express middleware to authenticate and authorize administrator requests via Supabase Auth.
 * Enforces:
 * 1. Valid Authorization Bearer header
 * 2. Active Supabase Auth session token
 * 3. Verified administrator identity (admin role or authorized admin email)
 * Returns HTTP 401 for unauthenticated and HTTP 403 for unauthorized requests.
 */
export async function requireAdminAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void | Response> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Missing or invalid Authorization Bearer header. Administrator sign-in required.',
    });
  }

  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Empty session token provided. Administrator sign-in required.',
    });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return res.status(503).json({
      success: false,
      error: 'Database service unavailable. Cannot verify administrator session.',
    });
  }

  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Invalid or expired administrator session. Please log in again.',
      });
    }

    const user = data.user;
    const userEmail = (user.email || '').toLowerCase();
    const hasAdminRole =
      user.app_metadata?.role === 'admin' || user.user_metadata?.role === 'admin';
    const isOwnerOrAdminEmail = isAuthorizedAdminEmail(userEmail);

    if (!hasAdminRole && !isOwnerOrAdminEmail) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: You do not possess administrator permissions to access this endpoint.',
      });
    }

    req.adminUser = {
      id: user.id,
      email: user.email || '',
      role: 'admin',
    };

    next();
  } catch (err: any) {
    console.error('❌ Exception in requireAdminAuth middleware:', err);
    return res.status(500).json({
      success: false,
      error: 'Internal server error verifying administrator authentication.',
    });
  }
}
