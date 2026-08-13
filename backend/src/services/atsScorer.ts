/**
 * ATS Score calculator — simple keyword overlap between JD keywords and final resume text.
 * Score = (matched keywords) / (total JD keywords) * 100
 */

export interface AtsResult {
  score: number;
  matched: string[];
  missing: string[];
}

export function calculateAtsScore(
  jdKeywords: string[],
  resumeText: string
): AtsResult {
  if (!jdKeywords.length) {
    return { score: 0, matched: [], missing: [] };
  }

  const normalizedResume = resumeText.toLowerCase();
  const matched: string[] = [];
  const missing: string[] = [];

  for (const keyword of jdKeywords) {
    const kw = keyword.toLowerCase().trim();
    if (!kw) continue;
    // Check for whole-word or phrase match
    if (normalizedResume.includes(kw)) {
      matched.push(keyword);
    } else {
      missing.push(keyword);
    }
  }

  const score = Math.round((matched.length / jdKeywords.length) * 100);
  return { score, matched, missing };
}

/**
 * Extract plain text from an HTML string for ATS scoring against the rendered resume.
 */
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
