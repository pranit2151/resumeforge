import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getDb } from '../services/dbService';

export interface AuthenticatedUser {
  id: number;
  name: string;
  email: string;
  mobile: string;
  role: 'user' | 'admin';
}

export interface AuthRequest extends Request {
  user?: AuthenticatedUser;
}

const JWT_SECRET = process.env.JWT_SECRET || 'resumeforge_jwt_super_secret_key_2026_change_in_production';

/**
 * Authenticates JWT Access Token AND verifies live non-blocked DB status on every request.
 */
export function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    return res.status(401).json({ error: 'Access token required. Please log in.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    // Live database check for blocked status
    const dbUser = getDb().prepare('SELECT id, name, email, mobile, role, is_blocked FROM users WHERE id = ?').get(decoded.id) as any;

    if (!dbUser) {
      return res.status(401).json({ error: 'User account no longer exists.' });
    }

    if (dbUser.is_blocked === 1) {
      return res.status(403).json({ error: 'Your account has been blocked by an administrator. Please contact support.' });
    }

    req.user = {
      id: dbUser.id,
      name: dbUser.name,
      email: dbUser.email,
      mobile: dbUser.mobile,
      role: dbUser.role,
    };

    next();
  } catch (err: any) {
    return res.status(401).json({ error: 'Invalid or expired access token.' });
  }
}

/**
 * Enforces per-user service access (e.g. "resume-tailoring").
 * Admins bypass individual service toggles.
 */
export function requireService(serviceName: string) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    // Admins have override access to all services
    if (req.user.role === 'admin') {
      return next();
    }

    const serviceRecord = getDb()
      .prepare('SELECT enabled FROM user_services WHERE user_id = ? AND service_name = ?')
      .get(req.user.id, serviceName) as any;

    if (!serviceRecord || serviceRecord.enabled === 0) {
      return res.status(403).json({
        error: `Access to service '${serviceName}' is disabled for your account. Please contact an administrator.`,
      });
    }

    next();
  };
}

/**
 * Enforces admin role.
 */
export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
  }
  next();
}
