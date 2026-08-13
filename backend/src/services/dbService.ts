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
    CREATE TABLE IF NOT EXISTS applications (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      job_title   TEXT NOT NULL,
      company     TEXT NOT NULL,
      jd_text     TEXT NOT NULL,
      resume_mode TEXT NOT NULL DEFAULT 'fullstack-focused',
      ats_score   REAL NOT NULL DEFAULT 0,
      pdf_path    TEXT,
      docx_path   TEXT,
      bullets_used TEXT NOT NULL DEFAULT '[]',
      bullets_cut  TEXT NOT NULL DEFAULT '[]',
      keywords_matched TEXT NOT NULL DEFAULT '[]',
      keywords_missing TEXT NOT NULL DEFAULT '[]',
      target_pages INTEGER NOT NULL DEFAULT 1,
      actual_pages INTEGER NOT NULL DEFAULT 1,
      cover_email  TEXT,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Migrate existing table if cover_email column does not exist
  try {
    getDb().exec(`ALTER TABLE applications ADD COLUMN cover_email TEXT;`);
  } catch {
    // Column already exists
  }
}

export interface ApplicationRecord {
  id?: number;
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
      job_title, company, jd_text, resume_mode, ats_score,
      pdf_path, docx_path, bullets_used, bullets_cut,
      keywords_matched, keywords_missing, target_pages, actual_pages, cover_email
    ) VALUES (
      @job_title, @company, @jd_text, @resume_mode, @ats_score,
      @pdf_path, @docx_path, @bullets_used, @bullets_cut,
      @keywords_matched, @keywords_missing, @target_pages, @actual_pages, @cover_email
    )
  `);
  const result = stmt.run({
    ...record,
    bullets_used: JSON.stringify(record.bullets_used),
    bullets_cut: JSON.stringify(record.bullets_cut),
    keywords_matched: JSON.stringify(record.keywords_matched),
    keywords_missing: JSON.stringify(record.keywords_missing),
    cover_email: record.cover_email || '',
  });
  return result.lastInsertRowid as number;
}

export function getApplications(limit = 50): ApplicationRecord[] {
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
