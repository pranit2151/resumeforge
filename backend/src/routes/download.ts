import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { OUTPUT_DIR } from '../services/pdfService';

const router = Router();

/**
 * GET /api/download/:filename
 * Streams a generated file (PDF or DOCX) to the client
 */
router.get('/:filename', (req: Request, res: Response) => {
  try {
    const { filename } = req.params;

    // Security: prevent path traversal
    const safeName = path.basename(filename);
    const filePath = path.join(OUTPUT_DIR, safeName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found.' });
    }

    const ext = path.extname(safeName).toLowerCase();
    const contentType =
      ext === '.pdf'
        ? 'application/pdf'
        : ext === '.docx'
        ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        : 'application/octet-stream';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
    res.sendFile(filePath);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
