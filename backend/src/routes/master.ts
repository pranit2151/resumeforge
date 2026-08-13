import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

const router = Router();
const MASTER_PATH = path.join(__dirname, '../data/master-resume.json');

/**
 * GET /api/master
 * Returns the master-resume.json content
 */
router.get('/', (_req: Request, res: Response) => {
  try {
    const content = fs.readFileSync(MASTER_PATH, 'utf-8');
    res.json(JSON.parse(content));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/master
 * Saves updated master-resume.json content
 * Body: the full JSON object
 */
router.put('/', (req: Request, res: Response) => {
  try {
    const body = req.body;

    // Basic validation: ensure required top-level keys exist
    const required = ['contact', 'skills', 'experience', 'education'];
    for (const key of required) {
      if (!body[key]) {
        return res.status(400).json({ error: `Missing required field: ${key}` });
      }
    }

    // Write backup first
    const backupPath = MASTER_PATH + '.bak';
    if (fs.existsSync(MASTER_PATH)) {
      fs.copyFileSync(MASTER_PATH, backupPath);
    }

    fs.writeFileSync(MASTER_PATH, JSON.stringify(body, null, 2), 'utf-8');
    res.json({ success: true, message: 'master-resume.json saved successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
