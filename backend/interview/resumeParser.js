import { callGroqModel, parseJsonResponse, DEFAULT_PARSING_MODEL } from './groqClient.js';

function inferIdentityFields(cleanText) {
  const lines = cleanText.split('\n').map((line) => line.trim()).filter(Boolean);

  const email = cleanText.match(/[\w.-]+@[\w.-]+\.\w+/)?.[0] || null;
  const phone = cleanText.match(/(?:\+?\d[\d\s()-]{8,}\d)/)?.[0] || null;

  const nameFromLabel = lines
    .map((line) => line.match(/^(name|candidate)\s*[:\-]\s*(.+)$/i))
    .find(Boolean);

  const cleanedNameLines = lines
    .map((line) => line.replace(/[^A-Za-z\s.-]/g, '').trim())
    .filter((line) => line.length >= 5 && line.length <= 40);

  const nameFromHeader = cleanedNameLines.find((line) => /^[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}$/.test(line));
  const name = nameFromLabel?.[2]?.trim() || nameFromHeader || null;

  return { name, email, phone };
}

function createFallbackResumeProfile(cleanText) {
  const lines = cleanText.split('\n').map((line) => line.trim()).filter(Boolean);
  const { name, email, phone } = inferIdentityFields(cleanText);

  const skills = Array.from(new Set(
    lines
      .flatMap((line) => line.split(/[,|]/))
      .map((token) => token.trim())
      .filter((token) => /^[A-Za-z][A-Za-z0-9+.#/\- ]{1,32}$/.test(token))
      .filter((token) => /(react|node|python|java|typescript|javascript|sql|aws|docker|kubernetes|api|next|mongodb|postgres|redis|git|c\+\+|c#|go|rust|ml|ai)/i.test(token))
  )).slice(0, 14);

  const projects = lines
    .filter((line) => /project|built|developed|implemented|designed/i.test(line))
    .slice(0, 5)
    .map((line, index) => ({
      name: `Project ${index + 1}`,
      description: line,
      technologies: [],
      challenges: [],
      impact: null,
    }));

  const experience = lines.filter((line) => /engineer|developer|intern|manager|analyst|experience|worked/i.test(line)).slice(0, 6);
  const education = lines.filter((line) => /university|college|b\.tech|bachelor|master|degree|education/i.test(line)).slice(0, 4);

  return {
    name,
    email,
    phone,
    skills: skills.length ? skills : ['Communication', 'Problem Solving'],
    projects,
    experience,
    education,
    summary: lines.slice(0, 3).join(' '),
    rawText: cleanText,
  };
}

async function parseResumeWithGroq(cleanText) {
  const prompt = `You are a strict resume parser.
Extract structured data from the resume text.
Return ONLY valid JSON with this shape:
{
  "name": string | null,
  "email": string | null,
  "phone": string | null,
  "skills": string[],
  "projects": [{
    "name": string,
    "description": string,
    "technologies": string[],
    "challenges": string[],
    "impact": string | null
  }],
  "experience": string[],
  "education": string[],
  "summary": string
}
Rules:
- Prioritize projects and implementation details.
- technologies must include concrete tools/frameworks.
- Remove duplicates.
- Keep items concise.

Resume Text:
${cleanText.slice(0, 18000)}`;

  const raw = await callGroqModel({
    prompt,
    model: DEFAULT_PARSING_MODEL,
    temperature: 0.2,
  });

  const parsed = parseJsonResponse(raw);
  const inferredIdentity = inferIdentityFields(cleanText);
  return {
    name: parsed?.name ?? inferredIdentity.name ?? null,
    email: parsed?.email ?? inferredIdentity.email ?? null,
    phone: parsed?.phone ?? inferredIdentity.phone ?? null,
    skills: Array.isArray(parsed?.skills) ? Array.from(new Set(parsed.skills.map(String))).slice(0, 20) : [],
    projects: Array.isArray(parsed?.projects)
      ? parsed.projects
          .map((project) => ({
            name: String(project?.name || '').trim(),
            description: String(project?.description || '').trim(),
            technologies: Array.isArray(project?.technologies) ? Array.from(new Set(project.technologies.map(String))) : [],
            challenges: Array.isArray(project?.challenges) ? Array.from(new Set(project.challenges.map(String))) : [],
            impact: project?.impact ? String(project.impact) : null,
          }))
          .filter((project) => project.name || project.description)
          .slice(0, 8)
      : [],
    experience: Array.isArray(parsed?.experience) ? parsed.experience.map(String).slice(0, 8) : [],
    education: Array.isArray(parsed?.education) ? parsed.education.map(String).slice(0, 6) : [],
    summary: String(parsed?.summary || '').trim(),
    rawText: cleanText,
  };
}

async function parseResumeToStructured(cleanText) {
  if (!process.env.GROQ_API_KEY) {
    return createFallbackResumeProfile(cleanText);
  }

  try {
    return await parseResumeWithGroq(cleanText);
  } catch (error) {
    console.warn('Groq resume parsing failed, using fallback parser:', error.message);
    return createFallbackResumeProfile(cleanText);
  }
}

export {
  parseResumeToStructured,
};
