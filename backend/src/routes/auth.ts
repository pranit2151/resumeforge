import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import crypto from 'crypto';
import { getDb } from '../services/dbService';
import { getOtpProvider } from '../services/otpService';
import { sendPasswordResetEmail } from '../services/emailService';
import { authenticateToken, AuthRequest } from '../middleware/authMiddleware';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'resumeforge_jwt_super_secret_key_2026_change_in_production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'resumeforge_jwt_refresh_secret_key_2026_change_in_production';

// Validation Schemas
const registerRequestSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  mobile: z.string().regex(/^[0-9]{10}$/, 'Mobile number must be exactly 10 digits'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const registerVerifySchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  mobile: z.string().regex(/^[0-9]{10}$/),
  password: z.string().min(6),
  otp_code: z.string().length(6, 'OTP must be 6 digits'),
});

const loginSchema = z.object({
  mobile: z.string().min(1, 'Mobile number or email is required'),
  password: z.string().min(1, 'Password is required'),
});

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function generateTokens(user: { id: number; email: string; mobile: string; role: string; name?: string }) {
  const accessToken = jwt.sign(
    { id: user.id, email: user.email, mobile: user.mobile, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: '15m' }
  );

  const refreshToken = jwt.sign(
    { id: user.id },
    JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );

  // Store hashed refresh token in DB
  const tokenHash = hashToken(refreshToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  getDb().prepare(`
    INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
    VALUES (?, ?, ?)
  `).run(user.id, tokenHash, expiresAt);

  return { accessToken, refreshToken };
}

/**
 * POST /api/auth/register-request-otp
 * Validates details, checks duplicates, sends 6-digit OTP via OtpProvider
 */
router.post('/register-request-otp', async (req: Request, res: Response) => {
  try {
    const data = registerRequestSchema.parse(req.body);
    const db = getDb();

    // Check duplicate email or mobile
    const existing = db.prepare('SELECT email, mobile FROM users WHERE email = ? OR mobile = ?').get(data.email, data.mobile) as any;
    if (existing) {
      if (existing.email === data.email) {
        return res.status(400).json({ error: 'An account with this email address already exists.' });
      }
      if (existing.mobile === data.mobile) {
        return res.status(400).json({ error: 'An account with this mobile number already exists.' });
      }
    }

    // Rate limiting: check last OTP request within 60 seconds
    const lastRequest = db.prepare(`
      SELECT created_at FROM otp_requests 
      WHERE mobile = ? AND created_at > datetime('now', '-60 seconds')
      ORDER BY created_at DESC LIMIT 1
    `).get(data.mobile) as any;

    if (lastRequest) {
      return res.status(429).json({ error: 'Please wait 60 seconds before requesting a new OTP.' });
    }

    // Generate random 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    db.prepare(`
      INSERT INTO otp_requests (mobile, otp_code, expires_at)
      VALUES (?, ?, ?)
    `).run(data.mobile, otpCode, expiresAt);

    // Deliver OTP via pluggable OtpProvider
    const provider = getOtpProvider();
    await provider.sendOtp(data.mobile, otpCode);

    res.json({ message: 'OTP successfully sent to your mobile number.', mobile: data.mobile });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/auth/register-verify-otp
 * Verifies OTP code and registers the user account
 */
router.post('/register-verify-otp', async (req: Request, res: Response) => {
  try {
    const data = registerVerifySchema.parse(req.body);
    const db = getDb();

    // Find active OTP request
    const otpRecord = db.prepare(`
      SELECT id, otp_code, expires_at, attempts FROM otp_requests
      WHERE mobile = ? ORDER BY created_at DESC LIMIT 1
    `).get(data.mobile) as any;

    if (!otpRecord) {
      return res.status(400).json({ error: 'No OTP request found. Please request a new OTP.' });
    }

    if (new Date(otpRecord.expires_at) < new Date()) {
      return res.status(400).json({ error: 'OTP has expired. Please request a new OTP.' });
    }

    if (otpRecord.attempts >= 5) {
      return res.status(400).json({ error: 'Maximum OTP verification attempts exceeded. Please request a new OTP.' });
    }

    if (otpRecord.otp_code !== data.otp_code) {
      db.prepare('UPDATE otp_requests SET attempts = attempts + 1 WHERE id = ?').run(otpRecord.id);
      return res.status(400).json({ error: 'Invalid OTP code. Please check and try again.' });
    }

    // Check duplicates again before creation
    const existing = db.prepare('SELECT id FROM users WHERE email = ? OR mobile = ?').get(data.email, data.mobile);
    if (existing) {
      return res.status(400).json({ error: 'Account already registered.' });
    }

    // Hash password with bcrypt cost 12
    const passwordHash = bcrypt.hashSync(data.password, 12);

    const stmt = db.prepare(`
      INSERT INTO users (name, email, mobile, password_hash, role, mobile_verified)
      VALUES (?, ?, ?, ?, 'user', 1)
    `);
    const result = stmt.run(data.name, data.email, data.mobile, passwordHash);
    const userId = result.lastInsertRowid as number;

    // Assign default service access (resume-tailoring)
    db.prepare(`
      INSERT OR IGNORE INTO user_services (user_id, service_name, enabled)
      VALUES (?, 'resume-tailoring', 1)
    `).run(userId);

    const user = { id: userId, name: data.name, email: data.email, mobile: data.mobile, role: 'user' };
    const tokens = generateTokens(user);

    res.json({
      message: 'Registration successful!',
      user,
      ...tokens,
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/auth/login
 * Mobile / Email + Password login with account lockout and block check
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const data = loginSchema.parse(req.body);
    const db = getDb();

    // Allow login by mobile OR email (helpful for admin)
    const user = db.prepare(`
      SELECT * FROM users WHERE mobile = ? OR email = ?
    `).get(data.mobile, data.mobile) as any;

    if (!user) {
      return res.status(401).json({ error: 'Invalid mobile number or password.' });
    }

    // Check if account is blocked by admin
    if (user.is_blocked === 1) {
      return res.status(403).json({ error: 'Your account has been blocked by an administrator. Please contact support.' });
    }

    // Check account lockout (5 failed attempts -> 15 min lock)
    if (user.lockout_until && new Date(user.lockout_until) > new Date()) {
      const remainingMinutes = Math.ceil((new Date(user.lockout_until).getTime() - Date.now()) / 60000);
      return res.status(429).json({
        error: `Account locked due to 5 consecutive failed login attempts. Please try again in ${remainingMinutes} minute(s).`,
      });
    }

    // Verify password
    const isMatch = bcrypt.compareSync(data.password, user.password_hash);
    if (!isMatch) {
      const failed = user.failed_login_attempts + 1;
      let lockoutTime = null;
      if (failed >= 5) {
        lockoutTime = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      }

      db.prepare(`
        UPDATE users SET failed_login_attempts = ?, lockout_until = ? WHERE id = ?
      `).run(failed, lockoutTime, user.id);

      if (failed >= 5) {
        return res.status(429).json({
          error: 'Account locked due to 5 consecutive failed login attempts. Please try again in 15 minutes.',
        });
      }

      return res.status(401).json({ error: 'Invalid mobile number or password.' });
    }

    // Reset failed login attempts on successful login
    db.prepare(`
      UPDATE users SET failed_login_attempts = 0, lockout_until = NULL, last_login_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(user.id);

    const tokens = generateTokens({
      id: user.id,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      role: user.role,
    });

    res.json({
      message: 'Login successful!',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        role: user.role,
        mustChangePassword: user.must_change_password === 1,
      },
      ...tokens,
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/auth/refresh-token
 * Rotates refresh token and returns new access & refresh tokens
 */
router.post('/refresh-token', (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required.' });
    }

    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as any;
    const tokenHash = hashToken(refreshToken);
    const db = getDb();

    // Verify token exists and is not revoked/expired in DB
    const tokenRecord = db.prepare(`
      SELECT * FROM refresh_tokens WHERE token_hash = ? AND revoked = 0 AND expires_at > CURRENT_TIMESTAMP
    `).get(tokenHash) as any;

    if (!tokenRecord) {
      return res.status(401).json({ error: 'Invalid or revoked refresh token.' });
    }

    // Verify user is not blocked
    const user = db.prepare('SELECT id, name, email, mobile, role, is_blocked FROM users WHERE id = ?').get(decoded.id) as any;
    if (!user || user.is_blocked === 1) {
      return res.status(403).json({ error: 'User account blocked or invalid.' });
    }

    // Revoke old token
    db.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE id = ?').run(tokenRecord.id);

    // Issue new token pair
    const tokens = generateTokens({
      id: user.id,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      role: user.role,
    });

    res.json(tokens);
  } catch (err: any) {
    res.status(401).json({ error: 'Expired or invalid refresh token.' });
  }
});

/**
 * POST /api/auth/logout
 * Revokes active refresh token
 */
router.post('/logout', (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      const tokenHash = hashToken(refreshToken);
      getDb().prepare('UPDATE refresh_tokens SET revoked = 1 WHERE token_hash = ?').run(tokenHash);
    }
    res.json({ message: 'Logged out successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/auth/forgot-password
 * Sends password reset token via Nodemailer (always generic anti-enumeration response)
 */
router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email address is required.' });
    }

    const db = getDb();
    const user = db.prepare('SELECT id FROM users WHERE email = ? AND is_blocked = 0').get(email) as any;

    if (user) {
      const resetToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = hashToken(resetToken);
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

      db.prepare(`
        INSERT INTO password_resets (user_id, token_hash, expires_at)
        VALUES (?, ?, ?)
      `).run(user.id, tokenHash, expiresAt);

      await sendPasswordResetEmail(email, resetToken);
    }

    // Generic anti-enumeration response
    res.json({ message: 'If an active account exists for this email address, a password reset link has been sent.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/auth/reset-password
 * Sets new password using reset token
 */
router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Valid token and new password (min 6 chars) are required.' });
    }

    const db = getDb();
    const tokenHash = hashToken(token);

    const resetRecord = db.prepare(`
      SELECT * FROM password_resets WHERE token_hash = ? AND used = 0 AND expires_at > CURRENT_TIMESTAMP
    `).get(tokenHash) as any;

    if (!resetRecord) {
      return res.status(400).json({ error: 'Invalid or expired password reset token.' });
    }

    const passwordHash = bcrypt.hashSync(newPassword, 12);

    db.prepare(`
      UPDATE users SET password_hash = ?, failed_login_attempts = 0, lockout_until = NULL WHERE id = ?
    `).run(passwordHash, resetRecord.user_id);

    db.prepare('UPDATE password_resets SET used = 1 WHERE id = ?').run(resetRecord.id);

    res.json({ message: 'Password reset successful! You can now log in with your new password.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/auth/change-password
 * Protected route to change password (handles admin must_change_password)
 */
router.post('/change-password', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Current password and new password (min 6 chars) are required.' });
    }

    const db = getDb();
    const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user!.id) as any;

    if (!bcrypt.compareSync(currentPassword, user.password_hash)) {
      return res.status(400).json({ error: 'Current password is incorrect.' });
    }

    const newHash = bcrypt.hashSync(newPassword, 12);
    db.prepare('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?').run(newHash, req.user!.id);

    res.json({ message: 'Password changed successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/auth/me
 * Protected route returning active user details
 */
router.get('/me', authenticateToken, (req: AuthRequest, res: Response) => {
  const dbUser = getDb().prepare('SELECT id, name, email, mobile, role, must_change_password FROM users WHERE id = ?').get(req.user!.id) as any;
  res.json({
    user: {
      id: dbUser.id,
      name: dbUser.name,
      email: dbUser.email,
      mobile: dbUser.mobile,
      role: dbUser.role,
      mustChangePassword: dbUser.must_change_password === 1,
    },
  });
});

export default router;
