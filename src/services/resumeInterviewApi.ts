export type InterviewType = 'hr' | 'technical';

export interface ResumeProject {
  name: string;
  description: string;
  technologies: string[];
  challenges: string[];
  impact: string | null;
}

export interface ResumeProfile {
  name: string | null;
  email: string | null;
  phone: string | null;
  skills: string[];
  projects: ResumeProject[];
  experience: string[];
  education: string[];
  summary: string;
  rawText: string;
}

export interface ResumeInterviewQuestion {
  id: string;
  question: string;
  category: 'project' | 'skills' | 'experience' | 'education' | 'general';
  source: string;
  priority: number;
}

export interface AnswerEvaluation {
  isRelevant: boolean;
  technicalScore: number;
  clarityScore: number;
  confidenceScore: number;
  overallScore: number;
  feedback: string;
  improvedAnswerTip: string;
  shouldAskFollowUp: boolean;
  followUpQuestion: string;
  mistakes?: string[];
  missingPoints?: string[];
}

export interface QuestionReport {
  questionNumber: number;
  question: string;
  category: string;
  overallScore: number;
  technicalScore: number;
  clarityScore: number;
  confidenceScore: number;
  points: number;
  feedback: string;
  improvedAnswerTip: string;
  mistakes: string[];
  missingPoints: string[];
  performance: string;
}

export interface FinalInterviewSummary {
  overallScore: number;
  totalPoints?: number;
  maxPoints?: number;
  questionReports?: QuestionReport[];
  averageScores?: {
    technical: number;
    clarity: number;
    confidence: number;
  };
  performanceBreakdown?: {
    excellent: number;
    good: number;
    fair: number;
    poor: number;
  };
  strongAreas: string[];
  weakAreas: string[];
  suggestedImprovements: string[];
  topicsToRevise: string[];
  closingRemark: string;
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || 'Request failed');
  }

  return response.json();
}

export async function uploadAndParseResume(file: File): Promise<ResumeProfile> {
  const formData = new FormData();
  formData.append('resume', file);

  const response = await fetch('/api/resume/parse', {
    method: 'POST',
    body: formData,
  });

  const payload = await handleResponse<{ resumeProfile: ResumeProfile }>(response);
  return payload.resumeProfile;
}

export async function createInterviewSession(
  resumeProfile: ResumeProfile,
  interviewType: InterviewType,
): Promise<ResumeInterviewQuestion[]> {
  const response = await fetch('/api/interview/session', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ resumeProfile, interviewType }),
  });

  const payload = await handleResponse<{ questions: ResumeInterviewQuestion[] }>(response);
  return payload.questions;
}

export async function evaluateAnswer(params: {
  resumeProfile: ResumeProfile;
  interviewType: InterviewType;
  currentQuestion: string;
  answer: string;
  history: Array<{ speaker: string; text: string }>;
}): Promise<AnswerEvaluation> {
  const response = await fetch('/api/interview/evaluate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });

  return handleResponse<AnswerEvaluation>(response);
}

export async function generateFinalSummary(params: {
  resumeProfile: ResumeProfile;
  evaluations: AnswerEvaluation[];
  transcript: Array<{ speaker: string; text: string }>;
  questions: ResumeInterviewQuestion[];
}): Promise<FinalInterviewSummary> {
  const response = await fetch('/api/interview/summary', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });

  return handleResponse<FinalInterviewSummary>(response);
}
