import { Router, Request, Response } from 'express';
import { getApplications, getApplicationById } from '../services/dbService';

const router = Router();

/**
 * GET /api/history
 * Returns all past generated applications
 */
router.get('/', (_req: Request, res: Response) => {
  try {
    const apps = getApplications(100);
    res.json({ applications: apps });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/history/:id
 * Returns a single application record
 */
router.get('/:id', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    const app = getApplicationById(id);
    if (!app) return res.status(404).json({ error: 'Application not found' });
    res.json(app);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
