import Groq from 'groq-sdk';
import type { MasterResume } from '../types';

// Ordered fallback chain — models are tried in priority order.
// On 429 (rate limit), 400 (decommissioned/invalid format), or JSON parse failure, next model is tried automatically.
const rawModel = process.env.GROQ_MODEL ? process.env.GROQ_MODEL.replace(/^Ilama/i, 'llama') : 'llama-3.3-70b-versatile';
const MODEL_FALLBACK_CHAIN = [
  rawModel,
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'qwen/qwen3.6-27b',
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
];
const FALLBACK_MODELS = [...new Set(MODEL_FALLBACK_CHAIN)];

console.log(`[Groq] Model priority: ${FALLBACK_MODELS.join(' → ')}`);

let client: Groq | null = null;

function getClient(): Groq {
  if (!client) {
    if (!process.env.GROQ_API_KEY) {
      throw new Error(
        'GROQ_API_KEY is not set. Please copy .env.example to .env and add your key from https://console.groq.com'
      );
    }
    client = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return client;
}

/** Try an async operation against each model in FALLBACK_MODELS until one succeeds */
async function tryWithFallback<T>(
  execute: (model: string) => Promise<T>
): Promise<T> {
  let lastError: any;
  for (const model of FALLBACK_MODELS) {
    try {
      console.log(`[Groq] Trying model: ${model}`);
      // eslint-disable-next-line no-await-in-loop
      const result = await execute(model);
      console.log(`[Groq] Success with model: ${model}`);
      return result;
    } catch (err: any) {
      const status = err?.status || err?.statusCode;
      const msg = err?.error?.error?.message || err?.message || '';
      console.warn(`[Groq] Model ${model} failed: ${msg.slice(0, 120)} — trying next model in chain...`);
      lastError = err;
    }
  }
  throw new Error(`All Groq models exhausted. Last error: ${lastError?.message || lastError}`);
}

export interface TailoredBullet {
  id: string;
  originalText: string;
  tailoredText: string;
  relevanceScore: number; // 0–10, LLM-assigned
  source: string; // "experience:exp-1" | "project:proj-1"
  tags: string[];
  included: boolean;
}

export interface GroqTailorResult {
  jobTitle: string;
  company: string;
  keywords: string[];
  matchFlags: {
    have: string[];
    missing: string[];
  };
  summary: string;
  selectedBullets: TailoredBullet[];
  cutBullets: TailoredBullet[];
  tailoredSkills: {
    languages: string[];
    frameworks: string[];
    databases: string[];
    cloud: string[];
    tools: string[];
  };
}

const SYSTEM_PROMPT = `You are an expert ATS resume tailoring assistant. Your job is to analyze a job description and a master resume JSON, then produce a tailored resume selection.

STRICT RULES:
1. NEVER fabricate, invent, or hallucinate any experience, skill, or achievement not present in the master resume JSON.
2. You may REWRITE bullet text to mirror JD terminology ONLY when the meaning remains 100% truthful.
3. Select and rank bullets from master resume by relevance to THIS specific JD.
4. Return ONLY valid JSON — no markdown, no prose, no explanation outside the JSON.
5. Every bullet must have a relevanceScore from 0 (irrelevant) to 10 (perfect match).
6. Include ALL bullets in your response — both selected (included:true) and cut (included:false).
7. CRITICAL: Do NOT output brackets like [...] or ellipses like ... inside arrays or text strings. Write full actual strings for every item.

SCORING GUIDANCE:
- 8–10: Directly addresses a required skill or responsibility from the JD
- 5–7: Tangentially related or demonstrates transferable skills
- 2–4: Weakly related but worth keeping space permitting
- 0–1: Not relevant to this role

OUTPUT FORMAT — respond with valid JSON matching this schema:
{
  "jobTitle": "Full Stack Developer",
  "company": "Tech Corp",
  "keywords": ["Node.js", "React.js", "Docker", "REST APIs"],
  "matchFlags": {
    "have": ["Node.js", "Express.js", "React.js", "Docker"],
    "missing": ["PostgreSQL"]
  },
  "summary": "Full Stack Developer with 3+ years experience building scalable backend APIs and frontend applications.",
  "bullets": [
    {
      "id": "exp-1-b1",
      "originalText": "Original bullet text from master resume",
      "tailoredText": "Tailored bullet text aligned with JD requirements",
      "relevanceScore": 9,
      "source": "experience:exp-1",
      "tags": ["backend", "api"],
      "included": true
    }
  ],
  "tailoredSkills": {
    "languages": ["JavaScript", "TypeScript", "SQL"],
    "frameworks": ["Node.js", "Express.js", "React.js"],
    "databases": ["SQL Server"],
    "cloud": ["Docker"],
    "tools": ["Git", "Postman"]
  }
}

CRITICAL: Respond with ONLY valid JSON. No markdown code blocks (no \`\`\`json), no introductory text. Start with { and end with }.`;

export async function analyzeAndTailor(
  jd: string,
  masterResume: MasterResume,
  mode: string
): Promise<GroqTailorResult> {
  const modeConfig = masterResume.modes[mode] || masterResume.modes['fullstack-focused'];
  const priorityTags = modeConfig?.priorityTags || [];

  // Build a compact resume payload (top bullets per experience/project to fit safely within 6k TPM)
  const resumePayload = {
    summary: masterResume.summary,
    skills: masterResume.skills,
    experience: masterResume.experience.map((exp) => ({
      id: exp.id,
      company: exp.company,
      role: exp.role,
      bullets: exp.bullets.slice(0, 4).map((b) => ({ id: b.id, text: b.text, tags: b.tags })),
    })),
    projects: masterResume.projects.slice(0, 3).map((p) => ({
      id: p.id,
      name: p.name,
      tech: p.tech,
      bullets: p.bullets.slice(0, 3).map((b) => ({ id: b.id, text: b.text, tags: b.tags })),
    })),
  };

  // Truncate JD to ~1200 chars to stay safely below 6000 TPM limits
  const jdTruncated = jd.length > 1200 ? jd.slice(0, 1200) + '\n[...truncated for brevity]' : jd;

  const userPrompt = `MODE: ${mode}
PRIORITY TAGS: ${priorityTags.join(', ')}

JOB DESCRIPTION:
${jdTruncated}

MASTER RESUME:
${JSON.stringify(resumePayload)}

Instructions:
- Prioritize bullets with tags matching the priority tags for this mode.
- Extract ALL ATS keywords/required skills from the JD.
- Select and score ALL bullets from master resume (experience + projects).
- Include ALL bullets in output with included:true for top picks, included:false for others.
- Initially set included:true for bullets with relevanceScore >= 5.
- Rewrite selected bullets to mirror JD terminology where truthful.
- Return ONLY valid JSON object matching the requested schema.`;

  try {
    return await tryWithFallback(async (model) => {
      const response = await getClient().chat.completions.create({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2,
        max_tokens: 4096,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Groq returned an empty response');
      }

      // Clean any reasoning tags (<think>...</think>) or markdown code blocks if the model included them
      const cleanedContent = content
        .replace(/<think>[\s\S]*?<\/think>/gi, '')
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

      let parsed: any;
      try {
        parsed = JSON.parse(cleanedContent);
      } catch (e) {
        // Attempt regex extraction of JSON object
        const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('Groq response was not valid JSON');
        parsed = JSON.parse(jsonMatch[0]);
      }

      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Parsed Groq response is not an object');
      }

      // Normalize bullets into selected/cut arrays
      const allBullets: TailoredBullet[] = (parsed.bullets || []).map((b: any) => ({
        id: b.id || 'b-unk',
        originalText: b.originalText || b.tailoredText || '',
        tailoredText: b.tailoredText || b.originalText || '',
        relevanceScore: Number(b.relevanceScore) || 0,
        source: b.source || 'unknown',
        tags: b.tags || [],
        included: b.included !== false && (Number(b.relevanceScore) || 0) >= 5,
      }));

      const selectedBullets = allBullets
        .filter((b) => b.included)
        .sort((a, b) => b.relevanceScore - a.relevanceScore);

      const cutBullets = allBullets
        .filter((b) => !b.included)
        .sort((a, b) => b.relevanceScore - a.relevanceScore);

      return {
        jobTitle: parsed.jobTitle || 'Software Engineer',
        company: parsed.company || 'Unknown',
        keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
        matchFlags: {
          have: Array.isArray(parsed.matchFlags?.have) ? parsed.matchFlags.have : [],
          missing: Array.isArray(parsed.matchFlags?.missing) ? parsed.matchFlags.missing : [],
        },
        summary: parsed.summary || masterResume.summary,
        selectedBullets,
        cutBullets,
        tailoredSkills: parsed.tailoredSkills || {
          languages: masterResume.skills.languages,
          frameworks: masterResume.skills.frameworks,
          databases: masterResume.skills.databases,
          cloud: masterResume.skills.cloud,
          tools: masterResume.skills.tools,
        },
      };
    });
  } catch (err: any) {
    console.warn(`[Groq Fallback] LLM rate-limited or unavailable (${err.message}). Utilizing rule-based tailoring engine.`);
    return fallbackRuleBasedTailor(jd, masterResume, mode);
  }
}

/** Algorithmic fallback tailor used when all Groq LLM models are rate-limited or exhausted */
function fallbackRuleBasedTailor(
  jd: string,
  masterResume: MasterResume,
  mode: string
): GroqTailorResult {
  const modeConfig = masterResume.modes[mode] || masterResume.modes['fullstack-focused'];
  const priorityTags = (modeConfig?.priorityTags || []).map((t: string) => t.toLowerCase());

  const jdLower = jd.toLowerCase();

  // Extract candidate keywords from JD using common tech list + master resume skills
  const allMasterSkills = [
    ...(masterResume.skills.languages || []),
    ...(masterResume.skills.frameworks || []),
    ...(masterResume.skills.databases || []),
    ...(masterResume.skills.cloud || []),
    ...(masterResume.skills.tools || []),
  ];

  const commonKeywords = [
    'Node.js', 'NodeJS', 'Express.js', 'ExpressJS', 'React.js', 'ReactJS', 'Angular', 'JavaScript', 'TypeScript',
    'SQL Server', 'SQL', 'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Docker', 'Kubernetes', 'REST APIs', 'REST',
    'GraphQL', 'Microservices', 'WebSocket', 'AWS', 'Azure', 'GCP', 'Jenkins', 'CI/CD', 'Git', 'Java', 'Go',
    'Python', 'Agile', 'Unit Testing', 'Jest', 'Mocha', 'Jira', 'Figma'
  ];

  const candidateKeywords = [...new Set([...allMasterSkills, ...commonKeywords])];
  const matchedKeywords: string[] = [];
  const missingKeywords: string[] = [];

  for (const kw of candidateKeywords) {
    if (jdLower.includes(kw.toLowerCase())) {
      const inMaster = allMasterSkills.some((s) => s.toLowerCase() === kw.toLowerCase());
      if (inMaster) {
        if (!matchedKeywords.includes(kw)) matchedKeywords.push(kw);
      } else {
        if (!missingKeywords.includes(kw)) missingKeywords.push(kw);
      }
    }
  }

  // Extract job title from JD first line or common pattern
  const firstLine = jd.split('\n').map((l) => l.trim()).find((l) => l.length > 5 && l.length < 80) || 'Full Stack Developer';
  const jobTitle = firstLine.replace(/^(hiring|we are seeking|looking for|job title:)\s*/i, '');

  // Score all bullets from experience and projects
  const allBullets: TailoredBullet[] = [];

  masterResume.experience.forEach((exp) => {
    exp.bullets.forEach((b) => {
      let score = 6;
      const bTags = (b.tags || []).map((t: string) => t.toLowerCase());
      if (bTags.some((t: string) => priorityTags.includes(t))) score += 2;
      matchedKeywords.forEach((kw) => {
        if (b.text.toLowerCase().includes(kw.toLowerCase())) score += 1;
      });
      score = Math.min(10, Math.max(1, score));
      allBullets.push({
        id: b.id,
        originalText: b.text,
        tailoredText: b.text,
        relevanceScore: score,
        source: `experience:${exp.id}`,
        tags: b.tags || [],
        included: score >= 6,
      });
    });
  });

  masterResume.projects.forEach((proj) => {
    proj.bullets.forEach((b) => {
      let score = 5;
      const bTags = (b.tags || []).map((t: string) => t.toLowerCase());
      if (bTags.some((t: string) => priorityTags.includes(t))) score += 2;
      matchedKeywords.forEach((kw) => {
        if (b.text.toLowerCase().includes(kw.toLowerCase())) score += 1;
      });
      score = Math.min(10, Math.max(1, score));
      allBullets.push({
        id: b.id,
        originalText: b.text,
        tailoredText: b.text,
        relevanceScore: score,
        source: `project:${proj.id}`,
        tags: b.tags || [],
        included: score >= 5,
      });
    });
  });

  const selectedBullets = allBullets
    .filter((b) => b.included)
    .sort((a, b) => b.relevanceScore - a.relevanceScore);

  const cutBullets = allBullets
    .filter((b) => !b.included)
    .sort((a, b) => b.relevanceScore - a.relevanceScore);

  return {
    jobTitle,
    company: 'Target Enterprise',
    keywords: [...matchedKeywords, ...missingKeywords],
    matchFlags: {
      have: matchedKeywords,
      missing: missingKeywords,
    },
    summary: masterResume.summary,
    selectedBullets,
    cutBullets,
    tailoredSkills: {
      languages: masterResume.skills.languages,
      frameworks: masterResume.skills.frameworks,
      databases: masterResume.skills.databases,
      cloud: masterResume.skills.cloud,
      tools: masterResume.skills.tools,
    },
  };
}

/** Generate a professional, tailored application cover email based on the candidate's master resume & JD */
export async function generateCoverEmail(
  jd: string,
  masterResume: MasterResume,
  company: string,
  jobTitle: string
): Promise<string> {
  const name = masterResume.contact.name || 'Candidate';
  const email = masterResume.contact.email || '';
  const phone = masterResume.contact.phone || '';
  const topSkills = [
    ...(masterResume.skills.languages || []).slice(0, 3),
    ...(masterResume.skills.frameworks || []).slice(0, 3),
    ...(masterResume.skills.databases || []).slice(0, 2),
  ].join(', ');

  const systemPrompt = `You are a professional career coach writing a targeted application email / cover message.
Write a concise, compelling 3-paragraph job application email from candidate ${name} applying for the ${jobTitle} position at ${company}.
Include a clear Subject line at the top. Use ONLY true facts from the candidate's background. Keep it engaging, professional, and directly tailored to the job description.`;

  const userPrompt = `CANDIDATE NAME: ${name}
CANDIDATE SUMMARY: ${masterResume.summary}
KEY SKILLS: ${topSkills}
EXPERIENCE SUMMARY: ${masterResume.experience.map(e => `${e.role} at ${e.company}`).join('; ')}

COMPANY: ${company}
JOB TITLE: ${jobTitle}
JOB DESCRIPTION (truncated):
${jd.slice(0, 1000)}

Write a professional email with:
1. Subject line
2. Professional salutation
3. Paragraph 1: Express strong interest in the ${jobTitle} role at ${company} and highlight core experience.
4. Paragraph 2: Connect candidate's hands-on achievements in Node.js, Express, React, and databases directly to the JD responsibilities.
5. Paragraph 3: Call to action for an interview + professional sign-off with contact details (${name}, ${phone}, ${email}).`;

  try {
    return await tryWithFallback(async (model) => {
      const response = await getClient().chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 1000,
      });

      const text = response.choices[0]?.message?.content?.trim();
      if (!text) throw new Error('Empty cover email response');
      return text;
    });
  } catch (err) {
    console.warn(`[Cover Email Fallback] Using template engine due to LLM error (${(err as any)?.message}).`);
    return `Subject: Application for ${jobTitle} Position - ${name}

Dear Hiring Team at ${company},

I am writing to express my strong interest in the ${jobTitle} role at ${company}. With over 3 years of full-stack engineering experience building robust REST APIs in Node.js/Express.js and responsive web interfaces in React.js and Angular, I am confident in my ability to deliver immediate value to your team.

Throughout my career, I have owned features end-to-end — from database query optimization in SQL Server to building real-time transaction workflows, authentication (JWT/RBAC), and containerized microservices with Docker. My experience aligns closely with your requirement for a developer who excels at converting product requirements into scalable software designs and high-quality code in agile sprints.

I welcome the opportunity to discuss how my technical background and problem-solving skills align with ${company}'s goals. Thank you for your time and consideration.

Best regards,

${name}
Full Stack Developer
Email: ${email}
Phone: ${phone}`;
  }
}



