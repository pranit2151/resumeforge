// Shared TypeScript types for the backend

export interface MasterResume {
  contact: Contact;
  summary: string;
  modes: Record<string, ResumeMode>;
  skills: Skills;
  experience: Experience[];
  projects: Project[];
  education: Education[];
  certifications: Certification[];
}

export interface Contact {
  name: string;
  email: string;
  phone: string;
  location: string;
  linkedin?: string;
  github?: string;
  website?: string;
}

export interface ResumeMode {
  priorityTags: string[];
  description: string;
}

export interface Skills {
  languages: string[];
  frameworks: string[];
  databases: string[];
  cloud: string[];
  tools: string[];
  testing?: string[];
}

export interface Bullet {
  id: string;
  text: string;
  tags: string[];
}

export interface Experience {
  id: string;
  company: string;
  role: string;
  start: string;
  end: string;
  location?: string;
  bullets: Bullet[];
}

export interface Project {
  id: string;
  name: string;
  url?: string;
  tech: string[];
  bullets: Bullet[];
  tags: string[];
}

export interface Education {
  id: string;
  degree: string;
  school: string;
  year: string;
  gpa?: string;
  highlights?: string[];
}

export interface Certification {
  id: string;
  name: string;
  issuer: string;
  year: string;
}

// Resume rendering data passed to template
export interface ResumeRenderData {
  contact: Contact;
  summary: string;
  skills: {
    languages: string[];
    frameworks: string[];
    databases: string[];
    cloud: string[];
    tools: string[];
  };
  experience: RenderedExperience[];
  projects: RenderedProject[];
  education: Education[];
  certifications: Certification[];
}

export interface RenderedExperience {
  company: string;
  role: string;
  start: string;
  end: string;
  location?: string;
  bullets: string[]; // tailored text
}

export interface RenderedProject {
  name: string;
  url?: string;
  tech: string[];
  bullets: string[];
}
