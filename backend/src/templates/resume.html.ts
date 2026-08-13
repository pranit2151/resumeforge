import type { ResumeRenderData } from '../types';

// ATS-SAFE RULES (strictly enforced):
// - Single column layout, no tables, no graphics, no text boxes
// - Arial font only, minimum 10.5pt, 0.5in margins
// - Standard section headers
// - Contact info in body, not header/footer
// - Plain text URLs, no embedded hyperlinks
// - Reverse chronological order

export function generateResumeHTML(data: ResumeRenderData): string {
  const { contact, summary, skills, experience, projects, education, certifications } = data;

  const allSkills = [
    skills.languages.length ? `<strong>Languages:</strong> ${skills.languages.join(', ')}` : '',
    skills.frameworks.length ? `<strong>Frameworks &amp; Libraries:</strong> ${skills.frameworks.join(', ')}` : '',
    skills.databases.length ? `<strong>Databases:</strong> ${skills.databases.join(', ')}` : '',
    skills.cloud.length ? `<strong>Cloud &amp; DevOps:</strong> ${skills.cloud.join(', ')}` : '',
    skills.tools.length ? `<strong>Tools:</strong> ${skills.tools.join(', ')}` : '',
  ].filter(Boolean);

  const experienceHTML = experience.map((exp) => `
    <div class="entry">
      <div class="entry-header">
        <div class="entry-title">
          <span class="company">${escapeHtml(exp.company)}</span>
          <span class="role">${escapeHtml(exp.role)}</span>
        </div>
        <div class="entry-meta">
          ${exp.location ? `<span>${escapeHtml(exp.location)}</span> | ` : ''}<span>${escapeHtml(exp.start)} – ${escapeHtml(exp.end)}</span>
        </div>
      </div>
      <ul class="bullets">
        ${exp.bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join('\n        ')}
      </ul>
    </div>
  `).join('');

  const projectsHTML = projects.map((proj) => `
    <div class="entry">
      <div class="entry-header">
        <div class="entry-title">
          <span class="company">${escapeHtml(proj.name)}</span>
          ${proj.tech.length ? `<span class="role">${proj.tech.map(escapeHtml).join(', ')}</span>` : ''}
        </div>
        ${proj.url ? `<div class="entry-meta">${escapeHtml(proj.url)}</div>` : ''}
      </div>
      <ul class="bullets">
        ${proj.bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join('\n        ')}
      </ul>
    </div>
  `).join('');

  const educationHTML = education.map((edu) => `
    <div class="entry">
      <div class="entry-header">
        <div class="entry-title">
          <span class="company">${escapeHtml(edu.school)}</span>
          <span class="role">${escapeHtml(edu.degree)}</span>
        </div>
        <div class="entry-meta">
          ${edu.gpa ? `GPA: ${escapeHtml(edu.gpa)} | ` : ''}${escapeHtml(edu.year)}
        </div>
      </div>
      ${edu.highlights && edu.highlights.length ? `<p class="highlights">${edu.highlights.map(escapeHtml).join(' | ')}</p>` : ''}
    </div>
  `).join('');

  const certsHTML = certifications.length ? `
    <div class="section">
      <h2 class="section-header">Certifications</h2>
      <div class="section-body">
        ${certifications.map((c) => `
        <div class="cert-item">
          <span class="company">${escapeHtml(c.name)}</span> — ${escapeHtml(c.issuer)}, ${escapeHtml(c.year)}
        </div>`).join('')}
      </div>
    </div>` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(contact.name)} — Resume</title>
  <style>
    /* ─── ATS-SAFE RESET ─── */
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    /* ─── PAGE SETUP ─── */
    @page {
      size: letter;
      margin: 0.5in 0.6in 0.5in 0.6in;
    }

    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 10.5pt;
      line-height: 1.35;
      color: #1a1a1a;
      background: white;
      /* Single column — no flex/grid that could confuse parsers */
    }

    /* ─── CONTACT HEADER (body, not header/footer) ─── */
    .contact-block {
      border-bottom: 1.5pt solid #2c2c2c;
      padding-bottom: 6pt;
      margin-bottom: 8pt;
    }
    .contact-name {
      font-size: 16pt;
      font-weight: bold;
      letter-spacing: 0.5pt;
      margin-bottom: 3pt;
    }
    .contact-details {
      font-size: 9.5pt;
      color: #333;
    }
    .contact-details span + span::before {
      content: ' | ';
      color: #888;
    }

    /* ─── SECTIONS ─── */
    .section {
      margin-bottom: 9pt;
    }
    .section-header {
      font-size: 10.5pt;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 0.8pt;
      border-bottom: 0.75pt solid #888;
      padding-bottom: 1pt;
      margin-bottom: 5pt;
      color: #1a1a1a;
    }
    .section-body {
      margin: 0;
    }

    /* ─── SUMMARY ─── */
    .summary-text {
      font-size: 10.5pt;
      line-height: 1.4;
    }

    /* ─── SKILLS ─── */
    .skills-grid {
      font-size: 10pt;
      line-height: 1.5;
    }
    .skills-grid p {
      margin-bottom: 1pt;
    }

    /* ─── EXPERIENCE / PROJECTS ─── */
    .entry {
      margin-bottom: 7pt;
      page-break-inside: avoid;
    }
    .entry-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 2pt;
    }
    .entry-title {
      font-weight: bold;
    }
    .entry-title .company {
      font-size: 10.5pt;
    }
    .entry-title .role {
      font-size: 10pt;
      font-weight: normal;
      font-style: italic;
      margin-left: 4pt;
    }
    .entry-meta {
      font-size: 9.5pt;
      color: #444;
      white-space: nowrap;
      text-align: right;
    }
    .bullets {
      margin-left: 14pt;
      margin-top: 1pt;
    }
    .bullets li {
      font-size: 10pt;
      line-height: 1.35;
      margin-bottom: 1.5pt;
      /* list-style: disc — ATS parsers handle this fine */
    }

    /* ─── EDUCATION ─── */
    .highlights {
      font-size: 9.5pt;
      color: #555;
      margin-top: 1pt;
      margin-left: 0;
    }

    /* ─── CERTS ─── */
    .cert-item {
      font-size: 10pt;
      margin-bottom: 2pt;
    }
  </style>
</head>
<body>

  <!-- Contact Info — in body, not header/footer -->
  <div class="contact-block">
    <div class="contact-name">${escapeHtml(contact.name)}</div>
    <div class="contact-details">
      <span>${escapeHtml(contact.email)}</span>
      <span>${escapeHtml(contact.phone)}</span>
      <span>${escapeHtml(contact.location)}</span>
      ${contact.linkedin ? `<span>${escapeHtml(contact.linkedin)}</span>` : ''}
      ${contact.github ? `<span>${escapeHtml(contact.github)}</span>` : ''}
      ${contact.website ? `<span>${escapeHtml(contact.website)}</span>` : ''}
    </div>
  </div>

  <!-- Summary -->
  ${summary ? `
  <div class="section">
    <h2 class="section-header">Summary</h2>
    <div class="section-body">
      <p class="summary-text">${escapeHtml(summary)}</p>
    </div>
  </div>` : ''}

  <!-- Skills -->
  ${allSkills.length ? `
  <div class="section">
    <h2 class="section-header">Skills</h2>
    <div class="section-body skills-grid">
      ${allSkills.map((s) => `<p>${s}</p>`).join('\n      ')}
    </div>
  </div>` : ''}

  <!-- Experience -->
  ${experience.length ? `
  <div class="section">
    <h2 class="section-header">Experience</h2>
    <div class="section-body">
      ${experienceHTML}
    </div>
  </div>` : ''}

  <!-- Projects -->
  ${projects.length ? `
  <div class="section">
    <h2 class="section-header">Projects</h2>
    <div class="section-body">
      ${projectsHTML}
    </div>
  </div>` : ''}

  <!-- Education -->
  ${education.length ? `
  <div class="section">
    <h2 class="section-header">Education</h2>
    <div class="section-body">
      ${educationHTML}
    </div>
  </div>` : ''}

  <!-- Certifications -->
  ${certsHTML}

</body>
</html>`;
}

function escapeHtml(str: string | undefined): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
