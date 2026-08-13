import puppeteer, { Browser, Page } from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { generateResumeHTML } from '../templates/resume.html';
import type { ResumeRenderData, MasterResume } from '../types';
import type { TailoredBullet, GroqTailorResult } from './groqService';

const OUTPUT_DIR = process.env.OUTPUT_DIR || path.join(__dirname, '../../output');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

let browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.connected) {
    const launchOptions: any = {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--single-process', '--no-zygote'],
    };
    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
      launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    }
    browser = await puppeteer.launch(launchOptions);
  }
  return browser;
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}

interface PdfResult {
  pdfPath: string;
  pdfFileName: string;
  pageCount: number;
  finalBullets: TailoredBullet[];
  renderData: ResumeRenderData;
  html: string;
}

/**
 * Renders the resume to PDF with a page-limit enforcement loop.
 * Drops bullets by ascending relevance score until it fits the target page count.
 * Never shrinks font or margins — content trimming is the only lever.
 */
export async function renderWithPageControl(
  tailorResult: GroqTailorResult,
  masterResume: MasterResume,
  targetPages: number,
  company: string,
  role: string,
  overrideBullets?: TailoredBullet[]
): Promise<PdfResult> {
  // Start with selected bullets (or overrides from manual panel)
  let activeBullets = overrideBullets
    ? [...overrideBullets].filter((b) => b.included)
    : [...tailorResult.selectedBullets];

  // Sort active bullets descending by score
  activeBullets.sort((a, b) => b.relevanceScore - a.relevanceScore);

  let pageCount = 0;
  let html = '';
  let iterations = 0;
  const MAX_ITERATIONS = 30;

  const browserInstance = await getBrowser();

  while (iterations < MAX_ITERATIONS) {
    const renderData = buildRenderData(tailorResult, masterResume, activeBullets);
    html = generateResumeHTML(renderData);

    const page = await browserInstance.newPage();
    try {
      await page.setContent(html, { waitUntil: 'domcontentloaded' });

      const pdfBuffer = await page.pdf({
        format: 'Letter',
        printBackground: false,
        margin: {
          top: '0.5in',
          right: '0.6in',
          bottom: '0.5in',
          left: '0.6in',
        },
      });

      // Count pages by temporarily rendering and checking
      pageCount = await getPageCount(page, pdfBuffer);

      if (pageCount <= targetPages) {
        // ✅ Fits — save final PDF
        const fileName = generateFileName(company, role, 'pdf');
        const filePath = path.join(OUTPUT_DIR, fileName);
        fs.writeFileSync(filePath, pdfBuffer);

        return {
          pdfPath: filePath,
          pdfFileName: fileName,
          pageCount,
          finalBullets: activeBullets,
          renderData,
          html,
        };
      }

      // ❌ Over limit — drop the lowest-relevance bullet
      if (activeBullets.length === 0) break;

      const lowestIndex = activeBullets.reduce(
        (minIdx, b, idx, arr) =>
          b.relevanceScore < arr[minIdx].relevanceScore ? idx : minIdx,
        0
      );
      activeBullets.splice(lowestIndex, 1);
      iterations++;
    } finally {
      await page.close();
    }
  }

  // Fallback: save whatever we have even if still over limit
  const renderData = buildRenderData(tailorResult, masterResume, activeBullets);
  html = generateResumeHTML(renderData);

  const page = await browserInstance.newPage();
  await page.setContent(html, { waitUntil: 'domcontentloaded' });
  const pdfBuffer = await page.pdf({
    format: 'Letter',
    printBackground: false,
    margin: { top: '0.5in', right: '0.6in', bottom: '0.5in', left: '0.6in' },
  });
  await page.close();

  const fileName = generateFileName(company, role, 'pdf');
  const filePath = path.join(OUTPUT_DIR, fileName);
  fs.writeFileSync(filePath, pdfBuffer);

  return {
    pdfPath: filePath,
    pdfFileName: fileName,
    pageCount,
    finalBullets: activeBullets,
    renderData,
    html,
  };
}

/**
 * Re-render to PDF with explicit bullet list (for manual override re-exports).
 */
export async function reRenderPdf(
  html: string,
  company: string,
  role: string
): Promise<{ pdfPath: string; pdfFileName: string }> {
  const browserInstance = await getBrowser();
  const page = await browserInstance.newPage();
  try {
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    const pdfBuffer = await page.pdf({
      format: 'Letter',
      printBackground: false,
      margin: { top: '0.5in', right: '0.6in', bottom: '0.5in', left: '0.6in' },
    });
    const fileName = generateFileName(company, role, 'pdf');
    const filePath = path.join(OUTPUT_DIR, fileName);
    fs.writeFileSync(filePath, pdfBuffer);
    return { pdfPath: filePath, pdfFileName: fileName };
  } finally {
    await page.close();
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function getPageCount(_page: Page, pdfBuffer: Buffer): Promise<number> {
  try {
    // Count PDF pages by scanning for /Type /Page markers (excludes /Pages)
    const pdfText = pdfBuffer.toString('latin1');
    const pageMatches = pdfText.match(/\/Type\s*\/Page[^s]/g);
    return pageMatches ? pageMatches.length : 1;
  } catch {
    return 1;
  }
}

function buildRenderData(
  tailorResult: GroqTailorResult,
  masterResume: MasterResume,
  activeBullets: TailoredBullet[]
): ResumeRenderData {
  // Group bullets back to their source experience/project entries
  const expBulletsMap: Record<string, string[]> = {};
  const projBulletsMap: Record<string, string[]> = {};

  for (const bullet of activeBullets) {
    const [type, id] = bullet.source.split(':');
    if (type === 'experience') {
      if (!expBulletsMap[id]) expBulletsMap[id] = [];
      expBulletsMap[id].push(bullet.tailoredText);
    } else if (type === 'project') {
      if (!projBulletsMap[id]) projBulletsMap[id] = [];
      projBulletsMap[id].push(bullet.tailoredText);
    }
  }

  // Build experience entries (preserve original order, reverse chrono from master)
  const renderedExperience = masterResume.experience
    .filter((exp) => expBulletsMap[exp.id]?.length > 0)
    .map((exp) => ({
      company: exp.company,
      role: exp.role,
      start: exp.start,
      end: exp.end,
      location: exp.location,
      bullets: expBulletsMap[exp.id],
    }));

  // Build project entries
  const renderedProjects = masterResume.projects
    .filter((proj) => projBulletsMap[proj.id]?.length > 0)
    .map((proj) => ({
      name: proj.name,
      url: proj.url,
      tech: proj.tech,
      bullets: projBulletsMap[proj.id],
    }));

  return {
    contact: masterResume.contact,
    summary: tailorResult.summary,
    skills: tailorResult.tailoredSkills,
    experience: renderedExperience,
    projects: renderedProjects,
    education: masterResume.education,
    certifications: masterResume.certifications,
  };
}

function generateFileName(company: string, role: string, ext: string): string {
  const sanitize = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const date = new Date().toISOString().split('T')[0];
  const timestamp = Date.now();
  return `${sanitize(company)}-${sanitize(role)}-${date}-${timestamp}.${ext}`;
}

export { OUTPUT_DIR, generateFileName };
