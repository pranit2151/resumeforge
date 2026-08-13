import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(__dirname, '../../resumeforge.db');

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    initSchema();
  }
  return db;
}

function initSchema() {
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS users (
      id                    INTEGER PRIMARY KEY AUTOINCREMENT,
      name                  TEXT NOT NULL,
      email                 TEXT UNIQUE NOT NULL,
      mobile                TEXT UNIQUE NOT NULL,
      password_hash         TEXT NOT NULL,
      role                  TEXT NOT NULL DEFAULT 'user',
      mobile_verified       INTEGER NOT NULL DEFAULT 0,
      is_blocked            INTEGER NOT NULL DEFAULT 0,
      failed_login_attempts INTEGER NOT NULL DEFAULT 0,
      lockout_until         DATETIME,
      must_change_password  INTEGER NOT NULL DEFAULT 0,
      last_login_at         DATETIME,
      created_at            DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS otp_requests (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      mobile      TEXT NOT NULL,
      otp_code    TEXT NOT NULL,
      expires_at  DATETIME NOT NULL,
      attempts    INTEGER NOT NULL DEFAULT 0,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash  TEXT NOT NULL UNIQUE,
      expires_at  DATETIME NOT NULL,
      revoked     INTEGER NOT NULL DEFAULT 0,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS password_resets (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash  TEXT NOT NULL UNIQUE,
      expires_at  DATETIME NOT NULL,
      used        INTEGER NOT NULL DEFAULT 0,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_services (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      service_name TEXT NOT NULL,
      enabled      INTEGER NOT NULL DEFAULT 1,
      created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, service_name)
    );

    CREATE TABLE IF NOT EXISTS applications (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id      INTEGER REFERENCES users(id) ON DELETE CASCADE,
      job_title    TEXT NOT NULL,
      company      TEXT NOT NULL,
      jd_text      TEXT NOT NULL,
      resume_mode  TEXT NOT NULL DEFAULT 'fullstack-focused',
      ats_score    REAL NOT NULL DEFAULT 0,
      pdf_path     TEXT,
      docx_path    TEXT,
      bullets_used TEXT NOT NULL DEFAULT '[]',
      bullets_cut  TEXT NOT NULL DEFAULT '[]',
      keywords_matched TEXT NOT NULL DEFAULT '[]',
      keywords_missing TEXT NOT NULL DEFAULT '[]',
      target_pages INTEGER NOT NULL DEFAULT 1,
      actual_pages INTEGER NOT NULL DEFAULT 1,
      cover_email  TEXT,
      created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Migrations for existing database columns
  try {
    getDb().exec(`ALTER TABLE applications ADD COLUMN cover_email TEXT;`);
  } catch {
    // Column already exists
  }

  try {
    getDb().exec(`ALTER TABLE applications ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;`);
  } catch {
    // Column already exists
  }

  seedDefaultAdmin();
}

function seedDefaultAdmin() {
  const adminEmail = 'pranitkashinathpatil@gmail.com';
  const existing = getDb().prepare('SELECT id FROM users WHERE email = ? OR role = ?').get(adminEmail, 'admin');
  
  if (!existing) {
    // Import bcrypt dynamically or sync
    const bcrypt = require('bcryptjs');
    const hashedPassword = bcrypt.hashSync('Sergio@123', 12);
    
    const stmt = getDb().prepare(`
      INSERT INTO users (name, email, mobile, password_hash, role, mobile_verified, must_change_password)
      VALUES (?, ?, ?, ?, ?, 1, 0)
    `);
    const res = stmt.run('Pranit Patil', adminEmail, '8788413561', hashedPassword, 'admin');
    const adminId = res.lastInsertRowid as number;

    getDb().prepare(`
      INSERT OR IGNORE INTO user_services (user_id, service_name, enabled)
      VALUES (?, 'resume-tailoring', 1)
    `).run(adminId);

    console.log('\n👑 [Admin Seeded] Default Admin Created:');
    console.log('   Email: pranitkashinathpatil@gmail.com');
    console.log('   Mobile: 8788413561');
    console.log('   Password: Sergio@123\n');
  }
}

export interface ApplicationRecord {
  id?: number;
  user_id?: number;
  job_title: string;
  company: string;
  jd_text: string;
  resume_mode: string;
  ats_score: number;
  pdf_path?: string;
  docx_path?: string;
  bullets_used: BulletRecord[];
  bullets_cut: BulletRecord[];
  keywords_matched: string[];
  keywords_missing: string[];
  target_pages: number;
  actual_pages: number;
  cover_email?: string;
  created_at?: string;
}

export interface UserRecord {
  id: number;
  name: string;
  email: string;
  mobile: string;
  password_hash: string;
  role: 'user' | 'admin';
  mobile_verified: number;
  is_blocked: number;
  failed_login_attempts: number;
  lockout_until?: string | null;
  must_change_password: number;
  last_login_at?: string | null;
  created_at?: string;
}

export interface BulletRecord {
  id: string;
  text: string;
  relevanceScore: number;
  source: string; // "experience:exp-1" | "project:proj-1"
  reason?: string;
}

export function logApplication(record: ApplicationRecord): number {
  const stmt = getDb().prepare(`
    INSERT INTO applications (
      user_id, job_title, company, jd_text, resume_mode, ats_score,
      pdf_path, docx_path, bullets_used, bullets_cut,
      keywords_matched, keywords_missing, target_pages, actual_pages, cover_email
    ) VALUES (
      @user_id, @job_title, @company, @jd_text, @resume_mode, @ats_score,
      @pdf_path, @docx_path, @bullets_used, @bullets_cut,
      @keywords_matched, @keywords_missing, @target_pages, @actual_pages, @cover_email
    )
  `);
  const result = stmt.run({
    user_id: record.user_id || null,
    ...record,
    bullets_used: JSON.stringify(record.bullets_used),
    bullets_cut: JSON.stringify(record.bullets_cut),
    keywords_matched: JSON.stringify(record.keywords_matched),
    keywords_missing: JSON.stringify(record.keywords_missing),
    cover_email: record.cover_email || '',
  });
  return result.lastInsertRowid as number;
}

export function getApplications(userId?: number, limit = 50): ApplicationRecord[] {
  if (userId) {
    const rows = getDb()
      .prepare('SELECT * FROM applications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?')
      .all(userId, limit) as any[];
    return rows.map(deserializeRow);
  }
  const rows = getDb()
    .prepare('SELECT * FROM applications ORDER BY created_at DESC LIMIT ?')
    .all(limit) as any[];
  return rows.map(deserializeRow);
}

export function getApplicationById(id: number): ApplicationRecord | undefined {
  const row = getDb()
    .prepare('SELECT * FROM applications WHERE id = ?')
    .get(id) as any;
  return row ? deserializeRow(row) : undefined;
}

function deserializeRow(row: any): ApplicationRecord {
  return {
    ...row,
    bullets_used: JSON.parse(row.bullets_used || '[]'),
    bullets_cut: JSON.parse(row.bullets_cut || '[]'),
    keywords_matched: JSON.parse(row.keywords_matched || '[]'),
    keywords_missing: JSON.parse(row.keywords_missing || '[]'),
    cover_email: row.cover_email || '',
  };
}
