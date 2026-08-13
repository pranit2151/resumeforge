import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  convertInchesToTwip,
  PageOrientation,
  LevelFormat,
} from 'docx';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import type { ResumeRenderData } from '../types';
import { OUTPUT_DIR, generateFileName } from './pdfService';

export async function generateDocx(
  renderData: ResumeRenderData,
  company: string,
  role: string
): Promise<{ docxPath: string; docxFileName: string }> {
  const fileName = generateFileName(company, role, 'docx');
  const filePath = path.join(OUTPUT_DIR, fileName);

  const doc = buildDocxDocument(renderData);
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(filePath, buffer);

  return { docxPath: filePath, docxFileName: fileName };
}

function buildDocxDocument(data: ResumeRenderData): Document {
  const { contact, summary, skills, experience, projects, education, certifications } = data;

  const sections: Paragraph[] = [];

  // ─── CONTACT ───
  sections.push(
    new Paragraph({
      children: [new TextRun({ text: contact.name, bold: true, size: 28, font: 'Arial' })],
      alignment: AlignmentType.LEFT,
      spacing: { after: 80 },
    })
  );

  const contactParts = [
    contact.email,
    contact.phone,
    contact.location,
    contact.linkedin,
    contact.github,
  ].filter(Boolean).join(' | ');

  sections.push(
    new Paragraph({
      children: [new TextRun({ text: contactParts, size: 19, font: 'Arial', color: '444444' })],
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '2c2c2c' } },
      spacing: { after: 120 },
    })
  );

  // ─── SUMMARY ───
  if (summary) {
    sections.push(...sectionHeader('Summary'));
    sections.push(
      new Paragraph({
        children: [new TextRun({ text: summary, size: 21, font: 'Arial' })],
        spacing: { after: 120 },
      })
    );
  }

  // ─── SKILLS ───
  const skillLines = [
    skills.languages.length ? `Languages: ${skills.languages.join(', ')}` : null,
    skills.frameworks.length ? `Frameworks & Libraries: ${skills.frameworks.join(', ')}` : null,
    skills.databases.length ? `Databases: ${skills.databases.join(', ')}` : null,
    skills.cloud.length ? `Cloud & DevOps: ${skills.cloud.join(', ')}` : null,
    skills.tools.length ? `Tools: ${skills.tools.join(', ')}` : null,
  ].filter(Boolean) as string[];

  if (skillLines.length) {
    sections.push(...sectionHeader('Skills'));
    for (const line of skillLines) {
      const colonIdx = line.indexOf(':');
      sections.push(
        new Paragraph({
          children: [
            new TextRun({ text: line.substring(0, colonIdx + 1), bold: true, size: 20, font: 'Arial' }),
            new TextRun({ text: line.substring(colonIdx + 1), size: 20, font: 'Arial' }),
          ],
          spacing: { after: 40 },
        })
      );
    }
    sections.push(spacer());
  }

  // ─── EXPERIENCE ───
  if (experience.length) {
    sections.push(...sectionHeader('Experience'));
    for (const exp of experience) {
      sections.push(
        new Paragraph({
          children: [
            new TextRun({ text: exp.company, bold: true, size: 21, font: 'Arial' }),
            new TextRun({ text: `  ${exp.role}`, italics: true, size: 20, font: 'Arial' }),
          ],
          spacing: { after: 20 },
        })
      );
      const meta = [exp.location, `${exp.start} – ${exp.end}`].filter(Boolean).join(' | ');
      sections.push(
        new Paragraph({
          children: [new TextRun({ text: meta, size: 19, font: 'Arial', color: '555555' })],
          spacing: { after: 40 },
        })
      );
      for (const bullet of exp.bullets) {
        sections.push(
          new Paragraph({
            children: [new TextRun({ text: bullet, size: 20, font: 'Arial' })],
            bullet: { level: 0 },
            spacing: { after: 30 },
          })
        );
      }
      sections.push(spacer());
    }
  }

  // ─── PROJECTS ───
  if (projects.length) {
    sections.push(...sectionHeader('Projects'));
    for (const proj of projects) {
      sections.push(
        new Paragraph({
          children: [
            new TextRun({ text: proj.name, bold: true, size: 21, font: 'Arial' }),
            new TextRun({ text: `  ${proj.tech.join(', ')}`, italics: true, size: 20, font: 'Arial' }),
          ],
          spacing: { after: 20 },
        })
      );
      if (proj.url) {
        sections.push(
          new Paragraph({
            children: [new TextRun({ text: proj.url, size: 19, font: 'Arial', color: '555555' })],
            spacing: { after: 30 },
          })
        );
      }
      for (const bullet of proj.bullets) {
        sections.push(
          new Paragraph({
            children: [new TextRun({ text: bullet, size: 20, font: 'Arial' })],
            bullet: { level: 0 },
            spacing: { after: 30 },
          })
        );
      }
      sections.push(spacer());
    }
  }

  // ─── EDUCATION ───
  if (education.length) {
    sections.push(...sectionHeader('Education'));
    for (const edu of education) {
      sections.push(
        new Paragraph({
          children: [
            new TextRun({ text: edu.school, bold: true, size: 21, font: 'Arial' }),
            new TextRun({ text: `  ${edu.degree}`, italics: true, size: 20, font: 'Arial' }),
          ],
          spacing: { after: 20 },
        })
      );
      const meta = [edu.gpa ? `GPA: ${edu.gpa}` : null, edu.year].filter(Boolean).join(' | ');
      sections.push(
        new Paragraph({
          children: [new TextRun({ text: meta, size: 19, font: 'Arial', color: '555555' })],
          spacing: { after: 30 },
        })
      );
    }
    sections.push(spacer());
  }

  // ─── CERTIFICATIONS ───
  if (certifications.length) {
    sections.push(...sectionHeader('Certifications'));
    for (const cert of certifications) {
      sections.push(
        new Paragraph({
          children: [
            new TextRun({ text: cert.name, bold: true, size: 20, font: 'Arial' }),
            new TextRun({ text: ` — ${cert.issuer}, ${cert.year}`, size: 20, font: 'Arial' }),
          ],
          spacing: { after: 40 },
        })
      );
    }
  }

  return new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(0.5),
              right: convertInchesToTwip(0.6),
              bottom: convertInchesToTwip(0.5),
              left: convertInchesToTwip(0.6),
            },
          },
        },
        children: sections,
      },
    ],
  });
}

function sectionHeader(title: string): Paragraph[] {
  return [
    new Paragraph({
      children: [
        new TextRun({
          text: title.toUpperCase(),
          bold: true,
          size: 21,
          font: 'Arial',
          allCaps: true,
        }),
      ],
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 4, color: '888888' },
      },
      spacing: { before: 120, after: 80 },
    }),
  ];
}

function spacer(): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text: '', size: 10 })],
    spacing: { after: 40 },
  });
}

/**
 * Optional: try LibreOffice conversion for better Word compatibility.
 * Gracefully skips if LibreOffice is not installed.
 */
export function tryLibreOfficeConvert(htmlPath: string, outputDir: string): string | null {
  const loPath = process.env.LIBREOFFICE_PATH;
  if (!loPath || !fs.existsSync(loPath)) return null;

  try {
    execSync(
      `"${loPath}" --headless --convert-to docx --outdir "${outputDir}" "${htmlPath}"`,
      { timeout: 30000 }
    );
    const baseName = path.basename(htmlPath, '.html');
    const converted = path.join(outputDir, `${baseName}.docx`);
    return fs.existsSync(converted) ? converted : null;
  } catch {
    return null;
  }
}
