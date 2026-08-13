import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { analyzeAndTailor, generateCoverEmail, type TailoredBullet } from '../services/groqService';
import { renderWithPageControl } from '../services/pdfService';
import { generateDocx } from '../services/docxService';
import { calculateAtsScore, htmlToPlainText } from '../services/atsScorer';
import { logApplication } from '../services/dbService';
import type { MasterResume } from '../types';

const router = Router();
const MASTER_PATH = path.join(__dirname, '../data/master-resume.json');

function loadMasterResume(): MasterResume {
  return JSON.parse(fs.readFileSync(MASTER_PATH, 'utf-8'));
}

/**
 * POST /api/generate
 * Body: { jd: string, mode: string, targetPages: number }
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { jd, mode = 'fullstack-focused', targetPages = 1, tempSkills = [] } = req.body;

    if (!jd || typeof jd !== 'string' || jd.trim().length < 50) {
      return res.status(400).json({ error: 'Please provide a job description of at least 50 characters.' });
    }

    const masterResume = loadMasterResume();

    // Merge temporary skills into master resume (session-only, not saved to disk)
    if (Array.isArray(tempSkills) && tempSkills.length > 0) {
      const existing = [
        ...(masterResume.skills.languages || []),
        ...(masterResume.skills.frameworks || []),
        ...(masterResume.skills.tools || []),
        ...(masterResume.skills.databases || []),
      ].map((s) => s.toLowerCase());
      const newSkills = (tempSkills as string[]).filter((s) => !existing.includes(s.toLowerCase()));
      if (newSkills.length > 0) {
        masterResume.skills.languages = [...(masterResume.skills.languages || []), ...newSkills];
        console.log(`[Generate] Merged ${newSkills.length} temp skill(s): ${newSkills.join(', ')}`);
      }
    }

    // Step 1: LLM analysis and tailoring
    console.log('[Generate] Starting LLM tailoring...');
    const tailorResult = await analyzeAndTailor(jd, masterResume, mode);

    // Step 1.5: Generate tailored cover email / message
    console.log('[Generate] Generating cover email...');
    const coverEmail = await generateCoverEmail(
      jd,
      masterResume,
      tailorResult.company,
      tailorResult.jobTitle
    );

    // Step 2: PDF rendering with page-limit loop
    console.log(`[Generate] Rendering PDF (target: ${targetPages} page(s))...`);
    const pdfResult = await renderWithPageControl(
      tailorResult,
      masterResume,
      Number(targetPages),
      tailorResult.company,
      tailorResult.jobTitle
    );

    // Step 3: DOCX generation
    console.log('[Generate] Generating DOCX...');
    const docxResult = await generateDocx(pdfResult.renderData, tailorResult.company, tailorResult.jobTitle);

    // Step 4: ATS scoring against final rendered resume
    const resumeText = htmlToPlainText(pdfResult.html);
    const atsResult = calculateAtsScore(tailorResult.keywords, resumeText);

    // Step 5: Determine which bullets were cut during page-limit loop
    const finalBulletIds = new Set(pdfResult.finalBullets.map((b) => b.id));
    const allSelected = tailorResult.selectedBullets;
    const pageLoopCut = allSelected.filter((b) => !finalBulletIds.has(b.id));
    const allCut = [...tailorResult.cutBullets, ...pageLoopCut.map((b) => ({
      ...b,
      reason: 'Dropped by page-limit loop (lowest relevance)',
    }))];

    // Step 6: Log to SQLite
    const appId = logApplication({
      job_title: tailorResult.jobTitle,
      company: tailorResult.company,
      jd_text: jd,
      resume_mode: mode,
      ats_score: atsResult.score,
      pdf_path: pdfResult.pdfPath,
      docx_path: docxResult.docxPath,
      bullets_used: pdfResult.finalBullets.map((b) => ({
        id: b.id,
        text: b.tailoredText,
        relevanceScore: b.relevanceScore,
        source: b.source,
      })),
      bullets_cut: allCut.map((b) => ({
        id: b.id,
        text: b.tailoredText,
        relevanceScore: b.relevanceScore,
        source: b.source,
        reason: (b as any).reason || 'Below relevance threshold',
      })),
      keywords_matched: atsResult.matched,
      keywords_missing: atsResult.missing,
      target_pages: Number(targetPages),
      actual_pages: pdfResult.pageCount,
      cover_email: coverEmail,
    });

    res.json({
      success: true,
      applicationId: appId,
      jobTitle: tailorResult.jobTitle,
      company: tailorResult.company,
      atsScore: atsResult.score,
      keywordsMatched: atsResult.matched,
      keywordsMissing: atsResult.missing,
      matchFlags: tailorResult.matchFlags,
      includedBullets: pdfResult.finalBullets,
      cutBullets: allCut,
      pdfFileName: pdfResult.pdfFileName,
      docxFileName: docxResult.docxFileName,
      pageCount: pdfResult.pageCount,
      targetPages: Number(targetPages),
      coverEmail,
    });
  } catch (err: any) {
    console.error('[Generate] Error:', err);
    res.status(500).json({ error: err.message || 'An unexpected error occurred.' });
  }
});

/**
 * POST /api/generate/finalize
 * Re-render with manually overridden bullet list
 * Body: { applicationId, overrideBullets: TailoredBullet[], targetPages }
 */
router.post('/finalize', async (req: Request, res: Response) => {
  try {
    const { jd, mode = 'fullstack-focused', targetPages = 1, overrideBullets, tempSkills = [] } = req.body;

    if (!overrideBullets || !Array.isArray(overrideBullets)) {
      return res.status(400).json({ error: 'overrideBullets array is required' });
    }

    const masterResume = loadMasterResume();

    // Merge temporary skills (same logic as /generate)
    if (Array.isArray(tempSkills) && tempSkills.length > 0) {
      const existing = [
        ...(masterResume.skills.languages || []),
        ...(masterResume.skills.frameworks || []),
        ...(masterResume.skills.tools || []),
        ...(masterResume.skills.databases || []),
      ].map((s) => s.toLowerCase());
      const newSkills = (tempSkills as string[]).filter((s) => !existing.includes(s.toLowerCase()));
      if (newSkills.length > 0) {
        masterResume.skills.languages = [...(masterResume.skills.languages || []), ...newSkills];
      }
    }

    // Re-run LLM with same JD to get tailorResult context
    const tailorResult = await analyzeAndTailor(jd, masterResume, mode);

    const coverEmail = await generateCoverEmail(
      jd,
      masterResume,
      tailorResult.company,
      tailorResult.jobTitle
    );

    // Render with user-specified bullet override
    const activeBullets = overrideBullets.filter((b: TailoredBullet) => b.included);
    const pdfResult = await renderWithPageControl(
      tailorResult,
      masterResume,
      Number(targetPages),
      tailorResult.company,
      tailorResult.jobTitle,
      activeBullets
    );

    const docxResult = await generateDocx(pdfResult.renderData, tailorResult.company, tailorResult.jobTitle);

    const resumeText = htmlToPlainText(pdfResult.html);
    const atsResult = calculateAtsScore(tailorResult.keywords, resumeText);

    const appId = logApplication({
      job_title: tailorResult.jobTitle,
      company: tailorResult.company,
      jd_text: jd,
      resume_mode: mode,
      ats_score: atsResult.score,
      pdf_path: pdfResult.pdfPath,
      docx_path: docxResult.docxPath,
      bullets_used: pdfResult.finalBullets.map((b) => ({
        id: b.id, text: b.tailoredText, relevanceScore: b.relevanceScore, source: b.source,
      })),
      bullets_cut: overrideBullets.filter((b: TailoredBullet) => !b.included).map((b: TailoredBullet) => ({
        id: b.id, text: b.tailoredText, relevanceScore: b.relevanceScore, source: b.source,
        reason: 'Excluded via manual override',
      })),
      keywords_matched: atsResult.matched,
      keywords_missing: atsResult.missing,
      target_pages: Number(targetPages),
      actual_pages: pdfResult.pageCount,
      cover_email: coverEmail,
    });

    res.json({
      success: true,
      applicationId: appId,
      atsScore: atsResult.score,
      keywordsMatched: atsResult.matched,
      keywordsMissing: atsResult.missing,
      includedBullets: pdfResult.finalBullets,
      pdfFileName: pdfResult.pdfFileName,
      docxFileName: docxResult.docxFileName,
      pageCount: pdfResult.pageCount,
      coverEmail,
    });
  } catch (err: any) {
    console.error('[Finalize] Error:', err);
    res.status(500).json({ error: err.message || 'An unexpected error occurred.' });
  }
});

export default router;
