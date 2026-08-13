import { Router, Response } from 'express';
import { getDb } from '../services/dbService';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/authMiddleware';

const router = Router();

// Apply auth + admin requirement to all endpoints in this router
router.use(authenticateToken);
router.use(requireAdmin);

/**
 * GET /api/admin/users
 * Searchable/filterable list of all registered users
 */
router.get('/users', (req: AuthRequest, res: Response) => {
  try {
    const search = req.query.search ? `%${String(req.query.search).trim()}%` : null;
    const status = req.query.status ? String(req.query.status).trim() : 'all'; // 'all' | 'active' | 'blocked'
    const role = req.query.role ? String(req.query.role).trim() : 'all';

    let query = `
      SELECT id, name, email, mobile, role, mobile_verified, is_blocked,
             failed_login_attempts, lockout_until, must_change_password,
             last_login_at, created_at
      FROM users
      WHERE 1=1
    `;
    const params: any[] = [];

    if (search) {
      query += ` AND (name LIKE ? OR email LIKE ? OR mobile LIKE ?)`;
      params.push(search, search, search);
    }

    if (status === 'blocked') {
      query += ` AND is_blocked = 1`;
    } else if (status === 'active') {
      query += ` AND is_blocked = 0`;
    }

    if (role !== 'all') {
      query += ` AND role = ?`;
      params.push(role);
    }

    query += ` ORDER BY created_at DESC`;

    const db = getDb();
    const users = db.prepare(query).all(...params) as any[];

    // Attach user service permissions
    const usersWithServices = users.map((u) => {
      const services = db.prepare('SELECT service_name, enabled FROM user_services WHERE user_id = ?').all(u.id) as any[];
      return {
        ...u,
        mobile_verified: u.mobile_verified === 1,
        is_blocked: u.is_blocked === 1,
        must_change_password: u.must_change_password === 1,
        services,
      };
    });

    res.json({ users: usersWithServices });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/admin/users/:id/block
 * Block / Unblock user toggle. Revokes refresh tokens on block.
 */
router.post('/users/:id/block', (req: AuthRequest, res: Response) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const { block } = req.body; // boolean true/false

    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID.' });
    }

    if (userId === req.user!.id) {
      return res.status(400).json({ error: 'You cannot block your own admin account.' });
    }

    const db = getDb();
    const user = db.prepare('SELECT id, name FROM users WHERE id = ?').get(userId) as any;
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const isBlocked = block ? 1 : 0;
    db.prepare('UPDATE users SET is_blocked = ? WHERE id = ?').run(isBlocked, userId);

    if (isBlocked === 1) {
      // Instantly revoke all active refresh tokens for this user
      db.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE user_id = ?').run(userId);
    }

    res.json({
      message: `User ${user.name} has been ${isBlocked === 1 ? 'blocked' : 'unblocked'} successfully.`,
      is_blocked: isBlocked === 1,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/admin/users/:id
 * Hard delete user and cascade delete application history
 */
router.delete('/users/:id', (req: AuthRequest, res: Response) => {
  try {
    const userId = parseInt(req.params.id, 10);
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID.' });
    }

    if (userId === req.user!.id) {
      return res.status(400).json({ error: 'You cannot delete your own admin account.' });
    }

    const db = getDb();
    const user = db.prepare('SELECT id, name FROM users WHERE id = ?').get(userId) as any;
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Delete user (foreign keys with ON DELETE CASCADE remove applications & user_services)
    db.prepare('DELETE FROM applications WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM user_services WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM refresh_tokens WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM password_resets WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);

    res.json({ message: `User ${user.name} and all associated application history have been deleted.` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/admin/users/:id/services
 * Retrieve per-user service access settings
 */
router.get('/users/:id/services', (req: AuthRequest, res: Response) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const db = getDb();
    const services = db.prepare('SELECT service_name, enabled FROM user_services WHERE user_id = ?').all(userId) as any[];
    res.json({ services });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/admin/users/:id/services
 * Toggle per-user service access (e.g. resume-tailoring)
 */
router.post('/users/:id/services', (req: AuthRequest, res: Response) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const { service_name, enabled } = req.body;

    if (!service_name) {
      return res.status(400).json({ error: 'Service name is required.' });
    }

    const db = getDb();
    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const isEnabled = enabled ? 1 : 0;
    db.prepare(`
      INSERT INTO user_services (user_id, service_name, enabled, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id, service_name) DO UPDATE SET enabled = ?, updated_at = CURRENT_TIMESTAMP
    `).run(userId, service_name, isEnabled, isEnabled);

    res.json({ message: `Access to service '${service_name}' updated successfully.` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
