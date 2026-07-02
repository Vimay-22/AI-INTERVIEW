// Resume parsing service with stronger PDF text extraction and interview-question generation.
// Falls back to local heuristics when no Gemini API key is provided.

export interface ParsedResume {
  name: string | null;
  email: string | null;
  phone: string | null;
  skills: string[];
  experience: string[];
  education: string[];
  projects: string[];
  rawText: string;
}

export interface ResumeQuestion {
  id: string;
  question: string;
  category: 'skills' | 'experience' | 'education' | 'project' | 'general';
  source: string; // What part of resume triggered this question
}

export async function parseResume(file: File): Promise<ParsedResume> {
  const text = await extractTextFromFile(file);
  const localParsed = extractResumeInfo(text);
  const enhanced = await enhanceResumeWithGemini(localParsed);
  return enhanced ?? localParsed;
}

async function extractTextFromFile(file: File): Promise<string> {
  const fileName = file.name.toLowerCase();
  const isPdf = file.type === 'application/pdf' || fileName.endsWith('.pdf');

  try {
    if (isPdf) {
      return await extractPdfText(file);
    }

    const rawText = await file.text();
    return normalizeText(rawText);
  } catch (error) {
    console.error('Failed to extract resume text:', error);
    const fallbackText = await file.text();
    return normalizeText(fallbackText);
  }
}

async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/legacy/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString();

  const buffer = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useWorkerFetch: false,
  });

  const pdf = await loadingTask.promise;
  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const pageText = reconstructPdfLines(textContent.items as Array<any>);

    if (pageText.trim()) {
      pages.push(pageText);
    }
  }

  return normalizeText(pages.join('\n'));
}

function reconstructPdfLines(items: Array<any>): string {
  type TextToken = { text: string; x: number; y: number };

  const tokens: TextToken[] = items
    .map((item) => ({
      text: typeof item === 'string' ? item : (item?.str || ''),
      x: item?.transform?.[4] ?? 0,
      y: item?.transform?.[5] ?? 0,
    }))
    .filter((token) => token.text && token.text.trim().length > 0);

  if (!tokens.length) return '';

  // Group by approximate Y position to rebuild lines.
  const rows = new Map<number, TextToken[]>();
  const yBucket = (y: number) => Math.round(y / 3) * 3;

  for (const token of tokens) {
    const key = yBucket(token.y);
    const row = rows.get(key) || [];
    row.push(token);
    rows.set(key, row);
  }

  const sortedRows = Array.from(rows.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([, row]) => row.sort((a, b) => a.x - b.x));

  const lines = sortedRows.map((row) => row.map(token => token.text.trim()).join(' ').replace(/\s{2,}/g, ' ').trim());
  return lines.filter(Boolean).join('\n');
}

function normalizeText(text: string): string {
  return text
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractResumeInfo(text: string): ParsedResume {
  const normalizedText = normalizeText(text);
  const lines = normalizedText.split('\n').map(line => line.trim()).filter(Boolean);

  const emailPattern = /[\w.-]+@[\w.-]+\.\w+/g;
  const phonePattern = /[\d\s-]{10,}/g;
  const namePattern = /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})$/;
  
  const emails = normalizedText.match(emailPattern);
  const phones = normalizedText.match(phonePattern);

  const candidateName = lines.find(line => {
    const cleaned = line.replace(/[^A-Za-z\s.-]/g, '').trim();
    return cleaned.length >= 5 && cleaned.length <= 40 && namePattern.test(cleaned);
  }) || null;
  
  const skillKeywords = [
    'JavaScript', 'TypeScript', 'Python', 'Java', 'C#', 'C++', 'Go', 'Rust',
    'React', 'Next.js', 'Vue', 'Angular', 'Svelte', 'Node.js', 'Express', 'NestJS',
    'HTML', 'CSS', 'Tailwind', 'Bootstrap', 'Redux', 'Zustand', 'GraphQL', 'REST',
    'SQL', 'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Firebase', 'Supabase',
    'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'Git', 'GitHub Actions',
    'Testing', 'Jest', 'Vitest', 'Cypress', 'Playwright', 'CI/CD', 'Linux',
    'Machine Learning', 'Data Analysis', 'NLP', 'LLM', 'Prompt Engineering',
    'Agile', 'Scrum', 'Communication', 'Leadership', 'Problem Solving', 'Teamwork',
    'Figma', 'UI/UX', 'Product Design', 'Project Management'
  ];
  
  const foundSkills = collectSkills(normalizedText, skillKeywords);
  const sections = extractResumeSections(lines);
  
  return {
    name: candidateName,
    email: emails?.[0] || null,
    phone: phones?.[0] || null,
    skills: foundSkills.length > 0 ? foundSkills : ['General Programming', 'Communication'],
    experience: sections.experience.length > 0 ? sections.experience : extractSection(lines, ['experience', 'work history', 'employment', 'professional experience']),
    education: sections.education.length > 0 ? sections.education : extractSection(lines, ['education', 'academic', 'degree', 'school', 'university']),
    projects: sections.projects.length > 0 ? sections.projects : extractSection(lines, ['project', 'portfolio', 'case study', 'case studies']),
    rawText: normalizedText,
  };
}

async function enhanceResumeWithGemini(base: ParsedResume): Promise<ParsedResume | null> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
  if (!apiKey) return null;

  const prompt = `You are a resume parser. Clean and improve extracted resume fields.
Return ONLY JSON in this exact shape:
{
  "name": string | null,
  "email": string | null,
  "phone": string | null,
  "skills": string[],
  "experience": string[],
  "education": string[],
  "projects": string[]
}

Rules:
- Keep entries concise and non-duplicated.
- Prioritize technical and role-relevant skills.
- Keep 3-12 skills.
- Keep each list item under 220 chars.

Current extracted data:
${JSON.stringify(base, null, 2)}

Raw resume text:
${base.rawText.slice(0, 12000)}`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;

    const parsed = JSON.parse(text) as Partial<ParsedResume>;

    const sanitize = (arr: unknown): string[] =>
      Array.isArray(arr)
        ? Array.from(new Set(arr.map(String).map(v => v.trim()).filter(v => v.length >= 2 && v.length <= 220)))
        : [];

    return {
      name: typeof parsed.name === 'string' ? parsed.name : base.name,
      email: typeof parsed.email === 'string' ? parsed.email : base.email,
      phone: typeof parsed.phone === 'string' ? parsed.phone : base.phone,
      skills: sanitize(parsed.skills).slice(0, 12).length > 0 ? sanitize(parsed.skills).slice(0, 12) : base.skills,
      experience: sanitize(parsed.experience).length > 0 ? sanitize(parsed.experience) : base.experience,
      education: sanitize(parsed.education).length > 0 ? sanitize(parsed.education) : base.education,
      projects: sanitize(parsed.projects).length > 0 ? sanitize(parsed.projects) : base.projects,
      rawText: base.rawText,
    };
  } catch (error) {
    console.warn('Gemini resume parsing enhancement failed, using local extraction:', error);
    return null;
  }
}

function collectSkills(text: string, skillKeywords: string[]): string[] {
  const lowerText = text.toLowerCase();
  const found = skillKeywords.filter(skill => lowerText.includes(skill.toLowerCase()));

  const extras = Array.from(new Set(
    text
      .split(/[^A-Za-z0-9+.#-]+/)
      .map(token => token.trim())
      .filter(token => /^[A-Za-z][A-Za-z0-9+.#-]{1,}$/.test(token))
      .filter(token => /react|node|java|python|sql|aws|docker|git|azure|cloud|api|redux|next|vue|angular|kubernetes|graphql|tailwind|figma|jira|agile|scrum/i.test(token))
  ));

  return Array.from(new Set([...found, ...extras])).slice(0, 12);
}

function extractResumeSections(lines: string[]) {
  return {
    experience: extractSection(lines, ['experience', 'work experience', 'professional experience', 'employment history', 'work history']),
    education: extractSection(lines, ['education', 'academic background', 'academics', 'degree', 'university', 'college']),
    projects: extractSection(lines, ['projects', 'project experience', 'portfolio', 'selected projects']),
  };
}

function extractSection(lines: string[], keywords: string[]): string[] {
  const relevantLines: string[] = [];
  let inSection = false;
  let seenHeading = false;

  for (const line of lines) {
    const lowerLine = line.toLowerCase();

    if (keywords.some(kw => lowerLine === kw || lowerLine.startsWith(`${kw}:`) || lowerLine.includes(` ${kw} `) || lowerLine.includes(kw))) {
      inSection = true;
      seenHeading = true;
      continue;
    }

    if (!seenHeading) {
      continue;
    }

    if (/^(skills?|experience|education|projects?|certifications?|summary|objective|awards?|contact)\b/i.test(lowerLine)) {
      if (relevantLines.length > 0) break;
      inSection = false;
      continue;
    }

    if (inSection) {
      const cleaned = line.replace(/^[-*•\d.)\s]+/, '').trim();
      if (cleaned.length >= 12 && cleaned.length <= 220) {
        relevantLines.push(cleaned);
      }

      if (relevantLines.length >= 5) {
        break;
      }
    }
  }
  
  return relevantLines;
}

function createQuestionId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function buildLocalQuestions(resume: ParsedResume, type: 'hr' | 'technical'): ResumeQuestion[] {
  const questions: ResumeQuestion[] = [];

  const topSkills = resume.skills.slice(0, 4);
  const topProjects = resume.projects.slice(0, 3);
  const topExperience = resume.experience.slice(0, 2);

  // Skill-based questions
  topSkills.forEach((skill, index) => {
    questions.push({
      id: createQuestionId(`skill-${index}`),
      question: index === 0
        ? `I noticed ${skill} in your resume. Can you walk me through a real example where you used it and what result it helped you achieve?`
        : `You also listed ${skill}. How did you apply it in practice, and what part of the work did you personally own?`,
      category: 'skills',
      source: `Skill: ${skill}`,
    });
  });

  if (topSkills.length === 0) {
    questions.push({
      id: createQuestionId('skills-general'),
      question: 'What are the strongest technical or professional skills you would highlight from your resume, and where have you used them most effectively?',
      category: 'skills',
      source: 'Skills section',
    });
  }
  
  // Experience-based questions
  if (topExperience.length > 0) {
    questions.push({
      id: createQuestionId('exp'),
      question: `In your recent role, what was the most important thing you were responsible for, and what measurable impact did your work have?`,
      category: 'experience',
      source: 'Experience section',
    });
  }
  
  // Education questions
  if (resume.education.length > 0) {
    questions.push({
      id: createQuestionId('edu'),
      question: 'How has your educational background or training prepared you for the kinds of challenges this role would bring?',
      category: 'education',
      source: 'Education section',
    });
  }
  
  // Project questions
  topProjects.forEach((project, index) => {
    questions.push({
      id: createQuestionId(`proj-${index}`),
      question: index === 0
        ? `Tell me more about "${project}". What problem were you solving, what did you personally contribute, and what was the final outcome?`
        : `For project "${project}", what was the hardest challenge and how did you handle it?`,
      category: 'project',
      source: `Projects section: ${project}`,
    });
  });

  if (topProjects.length === 0) {
    questions.push({
      id: createQuestionId('proj-general'),
      question: 'Tell me about a project or piece of work you are most proud of, and explain the result in concrete terms.',
      category: 'project',
      source: 'Projects section',
    });
  }
  
  // Type-specific questions
  if (type === 'technical') {
    questions.push({
      id: createQuestionId('tech'),
      question: 'Based on your resume, which technical decision or trade-off would you defend most strongly, and how would you explain it in an interview?',
      category: 'general',
      source: 'Technical interview',
    });
  } else {
    questions.push({
      id: createQuestionId('hr'),
      question: 'Based on your experience, how do you handle conflicting priorities, deadlines, or disagreement on a team?',
      category: 'general',
      source: 'HR interview',
    });
  }
  
  // Add general questions
  questions.push({
    id: createQuestionId('general'),
    question: 'What motivated you to apply for this position, and how does this role connect to your long-term goals?',
    category: 'general',
    source: 'General assessment',
  });
  
  return questions;
}

async function generateQuestionsWithGemini(resume: ParsedResume, type: 'hr' | 'technical'): Promise<ResumeQuestion[] | null> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
  if (!apiKey) return null;

  const prompt = `You are an expert interview coach. Create 7 highly specific ${type} interview questions based on the resume below.

Rules:
- Focus on the actual skills, projects, and work experience.
- Ask follow-up style questions that sound like a real interviewer.
- Include the category and source for each question.
- Return ONLY valid JSON in this exact shape: [{"question":"...","category":"skills|experience|education|project|general","source":"..."}]

Resume summary:
Name: ${resume.name || 'Unknown'}
Skills: ${resume.skills.join(', ')}
Experience: ${resume.experience.join(' | ')}
Education: ${resume.education.join(' | ')}
Projects: ${resume.projects.join(' | ')}
Raw resume text: ${resume.rawText.slice(0, 9000)}`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.6,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;

    const parsed = JSON.parse(text) as Array<{
      question: string;
      category: ResumeQuestion['category'];
      source: string;
    }>;

    return parsed
      .filter(item => item?.question)
      .slice(0, 7)
      .map((item, index) => ({
        id: createQuestionId(`gemini-${index}`),
        question: item.question,
        category: item.category || 'general',
        source: item.source || 'Gemini resume analysis',
      }));
  } catch (error) {
    console.warn('Gemini question generation failed, using local fallback:', error);
    return null;
  }
}

// Generate questions based on parsed resume
export async function generateResumeQuestions(resume: ParsedResume, type: 'hr' | 'technical'): Promise<ResumeQuestion[]> {
  const geminiQuestions = await generateQuestionsWithGemini(resume, type);
  return geminiQuestions && geminiQuestions.length > 0 ? geminiQuestions : buildLocalQuestions(resume, type);
}

// Demo resume for testing without file upload
export function getDemoResume(): ParsedResume {
  return {
    name: 'John Doe',
    email: 'john.doe@email.com',
    phone: '+1 234 567 8900',
    skills: ['JavaScript', 'TypeScript', 'React', 'Node.js', 'Python', 'SQL', 'AWS'],
    experience: [
      'Software Developer at Tech Company (2021-Present)',
      'Junior Developer at Startup Inc (2019-2021)',
    ],
    education: [
      'B.S. Computer Science, University (2019)',
    ],
    projects: [
      'E-commerce Platform - Full-stack application with payments and analytics',
      'Task Management App - React & Node.js with team collaboration',
    ],
    rawText: 'Demo resume for testing purposes.',
  };
}
