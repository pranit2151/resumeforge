import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';

import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import authRouter from './routes/auth';
import adminRouter from './routes/admin';
import generateRouter from './routes/generate';
import historyRouter from './routes/history';
import masterRouter from './routes/master';
import downloadRouter from './routes/download';
import { getDb } from './services/dbService';
import { authenticateToken, requireService } from './middleware/authMiddleware';

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false })); // Use helmet for secure HTTP headers
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate Limiters for Security
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 requests per IP per window
  message: { error: 'Too many requests from this IP. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── Unprotected Auth & Public Routes ─────────────────────────────────────────
app.use('/api/auth/login', authRateLimiter);
app.use('/api/auth/register-request-otp', authRateLimiter);
app.use('/api/auth/forgot-password', authRateLimiter);
app.use('/api/auth', authRouter);

// ─── Protected Admin Routes ───────────────────────────────────────────────────
app.use('/api/admin', adminRouter);

// ─── Protected Application Routes (Gated by JWT & Service Access) ────────────
app.use('/api/generate', authenticateToken, requireService('resume-tailoring'), generateRouter);
app.use('/api/history', authenticateToken, historyRouter);
app.use('/api/master', authenticateToken, masterRouter);
app.use('/api/download', authenticateToken, downloadRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    groqConfigured: !!process.env.GROQ_API_KEY,
    model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
  });
});

// ─── Serve Static Frontend in Production ──────────────────────────────────────
const frontendDist = path.join(__dirname, '../../frontend/dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// ─── Init DB & Start ─────────────────────────────────────────────────────────
getDb(); // Initialize SQLite schema

app.listen(PORT, () => {
  console.log(`\n🔨 ResumeForge Backend running on http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/api/health`);
  if (!process.env.GROQ_API_KEY) {
    console.warn('\n⚠️  GROQ_API_KEY is not set!');
    console.warn('   Get your free key at https://console.groq.com');
    console.warn('   Then copy backend/.env.example to backend/.env and add it.\n');
  } else {
    console.log(`   Groq model: ${process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'}`);
  }
});

export default app;
