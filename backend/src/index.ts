import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';

import generateRouter from './routes/generate';
import historyRouter from './routes/history';
import masterRouter from './routes/master';
import downloadRouter from './routes/download';
import { getDb } from './services/dbService';

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/generate', generateRouter);
app.use('/api/history', historyRouter);
app.use('/api/master', masterRouter);
app.use('/api/download', downloadRouter);

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
