// AI Interview Service - modular interview practice helpers.

export type InterviewType = 'hr' | 'technical';
export type TechnicalTopic = 'react' | 'javascript' | 'node' | 'typescript' | 'system-design' | 'custom';

export interface TechnicalFocus {
  topic: TechnicalTopic;
  customTopic?: string;
  version?: string;
}

export interface InterviewQuestion {
  id: string;
  question: string;
  type: InterviewType;
  difficulty: 'easy' | 'medium' | 'hard';
  hint?: string;
  sampleAnswer?: string;
}

export interface FeedbackResponse {
  grammarCorrection: string | null;
  improvedVersion: string;
  feedback: string;
  suggestions: string[];
  relevanceScore: number;
}

interface BackendAnswerEvaluation {
  isRelevant: boolean;
  technicalScore: number;
  clarityScore: number;
  confidenceScore: number;
  overallScore: number;
  feedback: string;
  improvedAnswerTip: string;
  shouldAskFollowUp: boolean;
  followUpQuestion: string;
}

export interface BackendInterviewFeedback {
  feedback: FeedbackResponse;
  interviewerResponse: string;
}

// Sample HR questions
const hrQuestions: InterviewQuestion[] = [
  {
    id: 'hr-1',
    question: 'Tell me about yourself and your background.',
    type: 'hr',
    difficulty: 'easy',
    hint: 'Focus on your professional journey and key achievements.',
    sampleAnswer: 'I am a software developer with 3 years of experience. I specialize in web development and have worked on various projects involving React and Node.js. I am passionate about creating user-friendly applications.',
  },
  {
    id: 'hr-2',
    question: 'Why are you interested in this position?',
    type: 'hr',
    difficulty: 'easy',
    hint: 'Connect your skills and interests to the role.',
    sampleAnswer: 'I am excited about this position because it aligns with my skills in frontend development and offers opportunities for growth. I admire the company\'s focus on innovation.',
  },
  {
    id: 'hr-3',
    question: 'What are your greatest strengths?',
    type: 'hr',
    difficulty: 'medium',
    hint: 'Give specific examples that demonstrate your strengths.',
    sampleAnswer: 'My greatest strength is problem-solving. I enjoy breaking down complex problems into manageable parts. For example, I once optimized a database query that reduced load time by 50%.',
  },
  {
    id: 'hr-4',
    question: 'Where do you see yourself in 5 years?',
    type: 'hr',
    difficulty: 'medium',
    hint: 'Show ambition while being realistic about growth.',
    sampleAnswer: 'In 5 years, I see myself as a senior developer leading a team. I want to grow technically while also developing leadership skills.',
  },
  {
    id: 'hr-5',
    question: 'Describe a challenging situation you faced and how you handled it.',
    type: 'hr',
    difficulty: 'hard',
    hint: 'Use the STAR method: Situation, Task, Action, Result.',
    sampleAnswer: 'In my previous role, we had a tight deadline for a major feature. I organized the team, prioritized tasks, and we delivered on time by working efficiently and communicating clearly.',
  },
];

// Sample Technical questions
const technicalQuestions: InterviewQuestion[] = [
  {
    id: 'tech-1',
    question: 'Explain the difference between let, const, and var in JavaScript.',
    type: 'technical',
    difficulty: 'easy',
    hint: 'Think about scope and mutability.',
    sampleAnswer: 'var is function-scoped and can be redeclared. let is block-scoped and can be reassigned but not redeclared. const is block-scoped and cannot be reassigned after initialization.',
  },
  {
    id: 'tech-2',
    question: 'What is the virtual DOM and how does React use it?',
    type: 'technical',
    difficulty: 'medium',
    hint: 'Think about performance optimization.',
    sampleAnswer: 'The virtual DOM is a lightweight copy of the actual DOM. React uses it to batch updates and minimize direct DOM manipulation. When state changes, React compares the virtual DOM with the real DOM and only updates what has changed.',
  },
  {
    id: 'tech-3',
    question: 'Explain the concept of closures in JavaScript.',
    type: 'technical',
    difficulty: 'medium',
    hint: 'Think about function scope and variable access.',
    sampleAnswer: 'A closure is a function that has access to variables from its outer scope, even after the outer function has returned. This allows for data privacy and creating factory functions.',
  },
  {
    id: 'tech-4',
    question: 'What are the SOLID principles in software development?',
    type: 'technical',
    difficulty: 'hard',
    hint: 'Each letter represents a principle of object-oriented design.',
    sampleAnswer: 'SOLID stands for: Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, and Dependency Inversion. These principles help create maintainable and scalable code.',
  },
  {
    id: 'tech-5',
    question: 'How would you optimize a slow database query?',
    type: 'technical',
    difficulty: 'hard',
    hint: 'Think about indexing, query structure, and data retrieval.',
    sampleAnswer: 'I would first analyze the query with EXPLAIN. Then consider adding indexes, optimizing JOIN operations, limiting data retrieved, and possibly caching results.',
  },
];

// Track asked questions to avoid repetition
const askedQuestionsMap = new Map<string, Set<string>>();

function getSessionKey(type: InterviewType, topic?: TechnicalTopic, customTopic?: string): string {
  if (topic === 'custom' && customTopic) {
    return `custom-${customTopic}`;
  }
  return topic ? `${type}-${topic}` : type;
}

function markQuestionAsked(sessionKey: string, questionId: string): void {
  if (!askedQuestionsMap.has(sessionKey)) {
    askedQuestionsMap.set(sessionKey, new Set());
  }
  askedQuestionsMap.get(sessionKey)!.add(questionId);
}

function isQuestionAsked(sessionKey: string, questionId: string): boolean {
  return askedQuestionsMap.get(sessionKey)?.has(questionId) || false;
}

export function resetAskedQuestions(sessionKey?: string): void {
  if (sessionKey) {
    askedQuestionsMap.delete(sessionKey);
  } else {
    askedQuestionsMap.clear();
  }
}

// Custom topic question templates
const customTopicTemplates = [
  (topic: string) => `Can you explain ${topic} and one practical way you have used it?`,
  (topic: string) => `What are the key benefits of using ${topic} in a project?`,
  (topic: string) => `Describe a challenge you faced while working with ${topic} and how you solved it.`,
  (topic: string) => `How would you explain ${topic} to someone who has never used it before?`,
  (topic: string) => `What are some common pitfalls or mistakes when working with ${topic}?`,
  (topic: string) => `Can you compare ${topic} with an alternative approach and explain when you would use each?`,
  (topic: string) => `Walk me through how you would implement ${topic} in a real-world scenario.`,
  (topic: string) => `What best practices do you follow when working with ${topic}?`,
  (topic: string) => `How has ${topic} evolved or changed in recent years, and what impact has that had?`,
  (topic: string) => `Tell me about a time when ${topic} helped you solve a specific problem.`,
];

const topicPools: Record<Exclude<TechnicalTopic, 'custom'>, InterviewQuestion[]> = {
  react: [
    {
      id: 'react-1',
      question: 'How does React decide when to re-render a component?',
      type: 'technical',
      difficulty: 'easy',
      hint: 'Talk about state, props, and reconciliation.',
      sampleAnswer: 'React re-renders when state or props change. It compares the virtual DOM and updates only the parts that changed.',
    },
    {
      id: 'react-2',
      question: 'When would you use useMemo or React.memo in React?',
      type: 'technical',
      difficulty: 'medium',
      hint: 'Explain when memoization helps and when it is not needed.',
      sampleAnswer: 'I would use them to avoid expensive recalculations or unnecessary child renders when props are stable.',
    },
    {
      id: 'react-3',
      question: 'How would you improve performance in a React application with many re-renders?',
      type: 'technical',
      difficulty: 'hard',
      hint: 'Mention profiling, memoization, and component splitting.',
      sampleAnswer: 'I would profile the app, reduce unnecessary prop changes, split large components, memoize where useful, and use lazy loading for heavy parts.',
    },
  ],
  javascript: [
    {
      id: 'js-1',
      question: 'What is the difference between synchronous and asynchronous code in JavaScript?',
      type: 'technical',
      difficulty: 'easy',
      hint: 'Mention the event loop and promises.',
      sampleAnswer: 'Synchronous code runs line by line and blocks execution. Asynchronous code lets other work continue and finishes later through callbacks, promises, or async/await.',
    },
    {
      id: 'js-2',
      question: 'How do closures work in JavaScript?',
      type: 'technical',
      difficulty: 'medium',
      hint: 'Explain how a function remembers outer variables.',
      sampleAnswer: 'A closure is a function that keeps access to variables from its outer scope even after that outer function has returned.',
    },
  ],
  node: [
    {
      id: 'node-1',
      question: 'How does Node.js handle concurrent requests without blocking?',
      type: 'technical',
      difficulty: 'medium',
      hint: 'Discuss the event loop and non-blocking I/O.',
      sampleAnswer: 'Node.js uses a single-threaded event loop with non-blocking I/O, so it can handle many requests efficiently while delegating long-running tasks.',
    },
    {
      id: 'node-2',
      question: 'When would you use Express middleware in a Node.js app?',
      type: 'technical',
      difficulty: 'easy',
      hint: 'Think about auth, logging, validation, and errors.',
      sampleAnswer: 'Middleware is useful for logging, authentication, validation, parsing, and error handling before the request reaches the route handler.',
    },
  ],
  typescript: [
    {
      id: 'ts-1',
      question: 'Why do teams choose TypeScript over JavaScript for bigger applications?',
      type: 'technical',
      difficulty: 'easy',
      hint: 'Mention types, refactoring, and safety.',
      sampleAnswer: 'TypeScript helps catch errors earlier, improves tooling, and makes refactoring safer in larger codebases.',
    },
    {
      id: 'ts-2',
      question: 'How do interfaces, types, and generics work in TypeScript?',
      type: 'technical',
      difficulty: 'medium',
      hint: 'Explain their common use cases.',
      sampleAnswer: 'Interfaces and types describe shapes, while generics let us write reusable and type-safe code across different data types.',
    },
  ],
  'system-design': [
    {
      id: 'sd-1',
      question: 'How would you design a scalable interview practice platform at a high level?',
      type: 'technical',
      difficulty: 'medium',
      hint: 'Mention frontend, backend, storage, and scaling concerns.',
      sampleAnswer: 'I would separate the UI, API, and storage layers, use queues for AI tasks, cache repeated requests, and add monitoring for failures and performance.',
    },
    {
      id: 'sd-2',
      question: 'What would you consider when designing a real-time voice interview system?',
      type: 'technical',
      difficulty: 'hard',
      hint: 'Think about latency, speech recognition, retries, and state.',
      sampleAnswer: 'I would focus on low latency, reliable speech recognition, transcript handling, state management, and graceful recovery when a network or API fails.',
    },
  ],
};

// Get questions based on type
export function getQuestions(type: InterviewType): InterviewQuestion[] {
  return type === 'hr' ? hrQuestions : technicalQuestions;
}

export function getTopicQuestion(topic: TechnicalTopic, version?: string, customTopic?: string): InterviewQuestion {
  const sessionKey = getSessionKey('technical', topic, customTopic);
  
  if (topic === 'custom') {
    const label = (customTopic || 'your chosen topic').trim();
    
    // Find an unused template
    let templateIndex = 0;
    let attempts = 0;
    const maxAttempts = customTopicTemplates.length;
    
    do {
      templateIndex = Math.floor(Math.random() * customTopicTemplates.length);
      attempts++;
    } while (isQuestionAsked(sessionKey, `custom-${templateIndex}`) && attempts < maxAttempts);
    
    // If all templates used, reset and start over
    if (attempts >= maxAttempts) {
      resetAskedQuestions(sessionKey);
      templateIndex = Math.floor(Math.random() * customTopicTemplates.length);
    }
    
    const questionId = `custom-${templateIndex}`;
    markQuestionAsked(sessionKey, questionId);
    
    const questionText = customTopicTemplates[templateIndex](label);
    
    return {
      id: questionId,
      question: questionText,
      type: 'technical',
      difficulty: 'medium',
      hint: `Think about your experience with ${label} and provide specific examples.`,
      sampleAnswer: `I have used ${label} in a project to solve a specific problem, and I chose it because it matched the needs of the task.`,
    };
  }

  const pool = topicPools[topic] || technicalQuestions;
  
  // Find an unused question from the pool
  let availableQuestions = pool.filter(q => !isQuestionAsked(sessionKey, q.id));
  
  // If all questions used, reset and use all questions again
  if (availableQuestions.length === 0) {
    resetAskedQuestions(sessionKey);
    availableQuestions = pool;
  }
  
  const pick = availableQuestions[Math.floor(Math.random() * availableQuestions.length)] || pool[0];
  markQuestionAsked(sessionKey, pick.id);

  if (!version) return pick;

  return {
    ...pick,
    question: `${pick.question} If you are referring to ${version}, mention that version specifically in your answer.`,
    hint: pick.hint ? `${pick.hint} Mention ${version} if relevant.` : `Mention ${version} if relevant.`,
  };
}

// Get a random question (avoiding recently asked ones)
export function getRandomQuestion(type: InterviewType): InterviewQuestion {
  const sessionKey = getSessionKey(type);
  const questions = getQuestions(type);
  
  // Find unused questions
  let availableQuestions = questions.filter(q => !isQuestionAsked(sessionKey, q.id));
  
  // If all questions used, reset and use all questions again
  if (availableQuestions.length === 0) {
    resetAskedQuestions(sessionKey);
    availableQuestions = questions;
  }
  
  const pick = availableQuestions[Math.floor(Math.random() * availableQuestions.length)];
  markQuestionAsked(sessionKey, pick.id);
  
  return pick;
}

// Simple grammar checking (placeholder - replace with real API)
function checkGrammar(text: string): string | null {
  // Basic grammar patterns to detect
  const commonErrors: [RegExp, string][] = [
    [/\bi\b/g, 'I'], // lowercase 'i'
    [/\bdont\b/gi, "don't"],
    [/\bcant\b/gi, "can't"],
    [/\bwont\b/gi, "won't"],
    [/\bim\b/gi, "I'm"],
    [/\bive\b/gi, "I've"],
    [/\btheres\b/gi, "there's"],
    [/\bits\b(?!\s+(?:own|self))/gi, "it's"], // "its" -> "it's" unless possessive
  ];

  let corrected = text;
  let hasCorrections = false;

  for (const [pattern, replacement] of commonErrors) {
    if (pattern.test(corrected)) {
      hasCorrections = true;
      corrected = corrected.replace(pattern, replacement);
    }
  }

  return hasCorrections ? corrected : null;
}

// Generate improved version of the answer
function improveAnswer(text: string): string {
  // Add structure and polish (placeholder)
  let improved = text.trim();
  
  // Ensure proper capitalization
  improved = improved.charAt(0).toUpperCase() + improved.slice(1);
  
  // Ensure proper ending punctuation
  if (!/[.!?]$/.test(improved)) {
    improved += '.';
  }
  
  return improved;
}

// Generate feedback for an answer (placeholder - replace with real AI API)
export function generateFeedback(answer: string, question: InterviewQuestion): FeedbackResponse {
  const grammarCorrection = checkGrammar(answer);
  const improvedVersion = improveAnswer(answer);
  const answerWordCount = answer.split(/\s+/).filter(Boolean).length;
  const questionWords = question.question.toLowerCase().split(/\W+/).filter((word) => word.length > 3);
  const answerText = answer.toLowerCase();
  const matchingWords = questionWords.filter((word) => answerText.includes(word));
  const relevanceScore = Math.max(1, Math.min(10, matchingWords.length * 2 + Math.floor(answerWordCount / 8)));
  
  // Generate basic feedback based on answer length and content
  let feedback = '';
  const suggestions: string[] = [];
  
  const wordCount = answerWordCount;
  
  if (wordCount < 10) {
    feedback = 'Your answer is very brief. Add the situation, your action, and the result so it sounds stronger.';
    suggestions.push('Mention one concrete example from your work or project experience.');
    suggestions.push('Explain what you did, not just what happened.');
  } else if (wordCount < 30) {
    feedback = 'Good start, but it still feels a bit general. Try to make it more specific and outcome-focused.';
    suggestions.push('Add details about your exact role and the tools you used.');
    suggestions.push('End with the impact, result, or lesson learned.');
  } else {
    feedback = 'Solid answer length. Make it sharper by keeping only the most relevant details and emphasizing impact.';
    suggestions.push('Lead with the main point first.');
    suggestions.push('Trim any extra detail that does not support your answer.');
  }

  if (relevanceScore < 4) {
    feedback = 'Your answer does not seem closely related to the question. Try to connect it directly to the topic you selected.';
    suggestions.unshift('Use the same topic words from the question in your answer.');
    suggestions.unshift('Give one clear example tied to the topic.');
  }
  
  return {
    grammarCorrection,
    improvedVersion,
    feedback,
    suggestions,
    relevanceScore,
  };
}

// Generate AI interviewer response
export function generateInterviewerResponse(
  userAnswer: string,
  currentQuestion: InterviewQuestion,
  feedback: FeedbackResponse
): string {
  if (userAnswer.toLowerCase().includes("don't know") || 
      userAnswer.toLowerCase().includes("not sure") ||
      userAnswer.trim().length < 5) {
    return `No problem. Try to answer with one specific example from your experience. ${currentQuestion.hint || 'Think about a project, task, or challenge you handled.'} If you want, you can answer again in a shorter STAR format.`;
  }
  
  if (feedback.relevanceScore < 4) {
    return `Thanks. ${feedback.feedback} Please answer more directly about ${currentQuestion.question}. Focus on the main point first, then add one example.`;
  }

  if (feedback.relevanceScore < 7) {
    return `Thanks. ${feedback.feedback} ${feedback.suggestions.length > 0 ? 'A useful improvement: ' + feedback.suggestions[0] : ''} Can you add one more important detail?`;
  }

  return `Thanks. ${feedback.feedback} ${feedback.suggestions.length > 0 ? 'One improvement: ' + feedback.suggestions[0] : ''} Let’s move to the next question.`;
}

export async function evaluateAnswerWithBackend(params: {
  answer: string;
  currentQuestion: InterviewQuestion;
  interviewType: InterviewType;
  history: Array<{ speaker: string; text: string }>;
}): Promise<BackendInterviewFeedback> {
  const { answer, currentQuestion, interviewType, history } = params;

  const grammarCorrection = checkGrammar(answer);
  const improvedVersion = improveAnswer(answer);

  const fallbackFeedback = generateFeedback(answer, currentQuestion);
  const fallbackResponse = generateInterviewerResponse(answer, currentQuestion, fallbackFeedback);

  try {
    const response = await fetch('/api/interview/evaluate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        resumeProfile: {
          rawText: `General ${interviewType} interview context`,
          skills: [],
          projects: [],
          experience: [],
          education: [],
          summary: '',
        },
        interviewType,
        currentQuestion: currentQuestion.question,
        answer,
        history,
      }),
    });

    if (!response.ok) {
      return {
        feedback: fallbackFeedback,
        interviewerResponse: fallbackResponse,
      };
    }

    const evaluation = await response.json() as BackendAnswerEvaluation;
    const relevanceScore = Math.max(1, Math.min(10, Math.round(Number(evaluation.overallScore) || 5)));
    const suggestion = evaluation.improvedAnswerTip?.trim();

    const feedback: FeedbackResponse = {
      grammarCorrection,
      improvedVersion,
      feedback: evaluation.feedback || fallbackFeedback.feedback,
      suggestions: suggestion ? [suggestion] : fallbackFeedback.suggestions,
      relevanceScore,
    };

    let interviewerResponse = `Thanks. ${feedback.feedback}`;
    if (!evaluation.isRelevant) {
      interviewerResponse += ` Please answer this question directly: ${currentQuestion.question}`;
    } else if (evaluation.shouldAskFollowUp && evaluation.followUpQuestion) {
      interviewerResponse += ` ${evaluation.followUpQuestion}`;
    } else if (feedback.suggestions.length > 0) {
      interviewerResponse += ` One improvement: ${feedback.suggestions[0]} Let's move to the next question.`;
    } else {
      interviewerResponse += ' Good answer. Let’s move to the next question.';
    }

    return {
      feedback,
      interviewerResponse,
    };
  } catch {
    return {
      feedback: fallbackFeedback,
      interviewerResponse: fallbackResponse,
    };
  }
}
