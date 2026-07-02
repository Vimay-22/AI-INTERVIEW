import {
  callGroqModel,
  parseJsonResponse,
  DEFAULT_QUESTION_MODEL,
  DEFAULT_FOLLOWUP_MODEL,
} from './groqClient.js';

function normalizeQuestions(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item, index) => ({
      id: item?.id ? String(item.id) : `q-${Date.now()}-${index}`,
      question: String(item?.question || '').trim(),
      category: ['project', 'skills', 'experience', 'education', 'general'].includes(item?.category)
        ? item.category
        : 'general',
      source: String(item?.source || 'Resume analysis').trim(),
      priority: typeof item?.priority === 'number' ? item.priority : index + 1,
    }))
    .filter((item) => item.question.length > 5)
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 10);
}

function fallbackQuestions(resume, interviewType) {
  const questions = [];
  const projects = resume.projects || [];
  const skills = resume.skills || [];

  projects.slice(0, 3).forEach((project, idx) => {
    questions.push({
      id: `project-${idx}`,
      question: `Walk me through ${project.name || 'this project'}. What exactly did you build, what decisions did you make, and why?`,
      category: 'project',
      source: `Project: ${project.name || 'Resume project'}`,
      priority: idx + 1,
    });

    if (project.technologies?.length) {
      questions.push({
        id: `project-tech-${idx}`,
        question: `In ${project.name || 'that project'}, why did you choose ${project.technologies[0]} and what trade-offs did you consider?`,
        category: 'project',
        source: `Project technologies: ${project.technologies.join(', ')}`,
        priority: idx + 4,
      });
    }
  });

  skills.slice(0, 3).forEach((skill, idx) => {
    questions.push({
      id: `skill-${idx}`,
      question: `You listed ${skill}. Describe a real production-level problem you solved using ${skill}.`,
      category: 'skills',
      source: `Skill: ${skill}`,
      priority: idx + 10,
    });
  });

  questions.push({
    id: 'experience-1',
    question: interviewType === 'technical'
      ? 'Tell me about a difficult engineering challenge and how you debugged or redesigned the system.'
      : 'Tell me about a high-pressure situation and how you managed stakeholders and priorities.',
    category: 'experience',
    source: 'Experience',
    priority: 15,
  });

  questions.push({
    id: 'behavior-1',
    question: 'Tell me about a difficult bug or production issue you solved. How did you diagnose and fix it?',
    category: 'general',
    source: 'Behavioral / Problem solving',
    priority: 16,
  });

  if (interviewType === 'hr') {
    questions.push({
      id: 'behavior-2',
      question: 'Describe a situation where priorities conflicted. How did you communicate and deliver effectively?',
      category: 'general',
      source: 'HR / collaboration',
      priority: 17,
    });
  }

  while (questions.length < 5) {
    const next = questions.length + 1;
    questions.push({
      id: `general-${next}`,
      question: `Based on your resume, explain one meaningful technical decision you made and the impact it had.`,
      category: 'general',
      source: 'Resume summary',
      priority: 20 + next,
    });
  }

  return questions.slice(0, 10);
}

async function generateInitialQuestions({ resume, interviewType }) {
  if (!process.env.GROQ_API_KEY) {
    return normalizeQuestions(fallbackQuestions(resume, interviewType));
  }

  const prompt = `You are an expert interviewer.
Generate 5 to 10 realistic interview questions from this resume profile.
Priorities (strict order):
1) Projects
2) project technologies and implementation decisions
3) project challenges and trade-offs
4) experience depth
5) skill-depth questions
6) one or two HR/behavioral questions
Avoid generic "tell me about yourself" style questions.
Return ONLY JSON array of:
[{"id":"q1","question":"...","category":"project|skills|experience|education|general","source":"...","priority":1}]

Interview Type: ${interviewType}
Resume Profile:
${JSON.stringify(resume).slice(0, 18000)}`;

  try {
    const raw = await callGroqModel({ prompt, model: DEFAULT_QUESTION_MODEL, temperature: 0.5 });
    const parsed = parseJsonResponse(raw);
    const normalized = normalizeQuestions(parsed);
    if (normalized.length >= 5) return normalized.slice(0, 10);
  } catch (error) {
    console.warn('Groq initial question generation failed:', error.message);
  }

  return normalizeQuestions(fallbackQuestions(resume, interviewType)).slice(0, 10);
}

async function generateFollowUpAndEvaluation({ resume, question, answer, history, interviewType }) {
  if (!process.env.GROQ_API_KEY) {
    return {
      feedback: 'Good start. Add more measurable outcomes and your personal contribution for stronger impact.',
      improvedAnswer: answer,
      suggestions: [
        'Use STAR format: Situation, Task, Action, Result.',
        'Mention one metric (latency, revenue, users, delivery time).',
      ],
      followUpQuestion: 'What was the hardest technical decision in that situation, and what alternative did you reject?',
      shouldMoveToNextQuestion: true,
      score: 6,
    };
  }

  const prompt = `You are a strict but helpful interviewer.
Evaluate candidate answer and produce realistic follow-up.
Return ONLY JSON object:
{
  "feedback": string,
  "improvedAnswer": string,
  "suggestions": string[],
  "followUpQuestion": string,
  "shouldMoveToNextQuestion": boolean,
  "score": number
}
Rules:
- score is 1-10
- followUpQuestion must depend on the candidate answer
- feedback should sound like real interview coaching
- shouldMoveToNextQuestion = false if answer is vague or too short

Interview type: ${interviewType}
Resume profile: ${JSON.stringify(resume).slice(0, 12000)}
Current question: ${question}
Candidate answer: ${answer}
Recent conversation history: ${JSON.stringify(history).slice(0, 8000)}`;

  try {
    const raw = await callGroqModel({ prompt, model: DEFAULT_FOLLOWUP_MODEL, temperature: 0.4, isJsonMode: true });
    const parsed = parseJsonResponse(raw);

    return {
      feedback: String(parsed?.feedback || 'Good effort. Improve structure and specificity.'),
      improvedAnswer: String(parsed?.improvedAnswer || answer),
      suggestions: Array.isArray(parsed?.suggestions) ? parsed.suggestions.map(String).slice(0, 5) : [],
      followUpQuestion: String(parsed?.followUpQuestion || 'Can you explain one concrete example with measurable impact?'),
      shouldMoveToNextQuestion: Boolean(parsed?.shouldMoveToNextQuestion),
      score: Number.isFinite(parsed?.score) ? Math.max(1, Math.min(10, Number(parsed.score))) : 6,
    };
  } catch (error) {
    console.warn('Groq follow-up generation failed:', error.message);
    return {
      feedback: 'Your answer has potential. Make it more specific and include impact.',
      improvedAnswer: answer,
      suggestions: [
        'State your exact contribution.',
        'Add metrics and trade-offs considered.',
      ],
      followUpQuestion: 'Can you provide one concrete example with your role, action, and measurable result?',
      shouldMoveToNextQuestion: false,
      score: 5,
    };
  }
}

export {
  generateInitialQuestions,
  generateFollowUpAndEvaluation,
};
