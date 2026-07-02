import { callGroqModel, parseJsonResponse, DEFAULT_FOLLOWUP_MODEL } from './groqClient.js';

function clampScore(value, fallback = 5) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(0, Math.min(10, Math.round(num)));
}

function fallbackEvaluation({ question, answer }) {
  const trimmed = String(answer || '').trim();
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
  const looksLikeQuestion = /\?$/.test(trimmed) || /^(what|why|how|where|when|who)\b/i.test(trimmed);

  const isRelevant = !looksLikeQuestion && wordCount >= 5;
  const technicalScore = isRelevant ? (wordCount > 20 ? 6 : 4) : 2;
  const clarityScore = isRelevant ? 6 : 3;
  const confidenceScore = isRelevant ? 6 : 3;
  const overallScore = Math.round((technicalScore + clarityScore + confidenceScore) / 3);
  const shouldAskFollowUp = !isRelevant || wordCount < 18 || overallScore < 6;

  return {
    isRelevant,
    technicalScore,
    clarityScore,
    confidenceScore,
    overallScore,
    feedback: isRelevant
      ? 'Good start. Add a little more detail about your specific role and the result you achieved.'
      : 'Let’s refocus that answer on what you built, your role, and the technical decisions you made.',
    improvedAnswerTip: 'Try STAR: situation, task, action, result. Mention your tools, challenges, and impact.',
    shouldAskFollowUp,
    followUpQuestion: shouldAskFollowUp
      ? `Please answer this directly: ${question}`
      : '',
  };
}

function normalizeEvaluation(parsed, question) {
  const isRelevant = Boolean(parsed?.isRelevant);
  const technicalScore = clampScore(parsed?.technicalScore);
  const clarityScore = clampScore(parsed?.clarityScore);
  const confidenceScore = clampScore(parsed?.confidenceScore);
  const overallScore = clampScore(parsed?.overallScore, Math.round((technicalScore + clarityScore + confidenceScore) / 3));
  const feedback = String(parsed?.feedback || '').trim() || 'Your answer needs more specific details about your role and technical decisions.';
  const improvedAnswerTip = String(parsed?.improvedAnswerTip || '').trim() || 'Explain what YOU did, the technologies you used, and the measurable impact.';
  const shouldAskFollowUp = Boolean(parsed?.shouldAskFollowUp);
  const followUpQuestion = String(parsed?.followUpQuestion || '').trim();
  
  // New fields for detailed feedback
  const mistakes = Array.isArray(parsed?.mistakes) ? parsed.mistakes.filter(m => String(m).trim()) : [];
  const missingPoints = Array.isArray(parsed?.missingPoints) ? parsed.missingPoints.filter(m => String(m).trim()) : [];

  return {
    isRelevant,
    technicalScore,
    clarityScore,
    confidenceScore,
    overallScore,
    feedback,
    improvedAnswerTip,
    shouldAskFollowUp,
    followUpQuestion: shouldAskFollowUp ? (followUpQuestion || `Can you answer this directly: ${question}`) : '',
    mistakes,
    missingPoints,
  };
}

export async function evaluateInterviewAnswer({
  resume,
  interviewType,
  question,
  answer,
  history,
}) {
  const trimmedAnswer = String(answer || '').trim();

  if (!process.env.GROQ_API_KEY) {
    return fallbackEvaluation({ question, answer: trimmedAnswer });
  }

  const prompt = `You are a strict, honest interview evaluator. Your job is to provide critical, realistic feedback.

Evaluate the candidate's answer based ONLY on what they actually said. Do NOT be generous or assume missing information.

Return ONLY JSON in this exact schema:
{
  "isRelevant": boolean,
  "technicalScore": number,
  "clarityScore": number,
  "confidenceScore": number,
  "overallScore": number,
  "feedback": string,
  "improvedAnswerTip": string,
  "shouldAskFollowUp": boolean,
  "followUpQuestion": string,
  "mistakes": string[],
  "missingPoints": string[]
}

CRITICAL EVALUATION RULES:
1. Scores 0-10 must reflect ACTUAL quality, not inflated:
   - 0-3: Poor/incorrect/irrelevant
   - 4-5: Weak/incomplete
   - 6-7: Adequate but missing key points
   - 8-9: Good with minor gaps
   - 10: Excellent and complete

2. Technical Score (0-10):
   - Is the answer technically accurate?
   - Does it demonstrate real understanding?
   - Are there factual errors or misconceptions?
   - Score LOW if vague, generic, or incorrect

3. Clarity Score (0-10):
   - Is the answer well-structured and clear?
   - Can you understand what they did?
   - Score LOW if rambling, unclear, or confusing

4. Confidence Score (0-10):
   - Does the answer show ownership and confidence?
   - Do they use "I did X" vs "we did X" or "it was done"?
   - Score LOW if passive voice or uncertain

5. Overall Score: Average of the three scores (not inflated)

6. Feedback: Be HONEST and CRITICAL
   - Point out specific weaknesses
   - Don't sugarcoat or be overly positive
   - If answer is weak, say so directly

7. Mistakes: List specific errors or incorrect statements

8. Missing Points: List important concepts/details they should have mentioned

9. Improved Answer Tip: Specific, actionable advice

10. Follow-up: Ask if answer is incomplete, vague, or scored below 6

EXAMPLES OF HONEST FEEDBACK:
- "Your answer is too vague and doesn't explain what YOU specifically did."
- "You mentioned the technology but didn't explain how you used it or why."
- "This answer lacks technical depth. You need to explain the implementation details."
- "You said 'we did' but didn't clarify your personal role or contribution."
- "The answer is incomplete - you didn't mention the outcome or impact."

Interview type: ${interviewType}
Question: ${question}
Answer: ${trimmedAnswer}
Resume context: ${JSON.stringify(resume).slice(0, 14000)}
Recent history: ${JSON.stringify(history || []).slice(0, 8000)}`;

  try {
    const raw = await callGroqModel({
      prompt,
      model: DEFAULT_FOLLOWUP_MODEL,
      temperature: 0.2,
    });

    const parsed = parseJsonResponse(raw);
    return normalizeEvaluation(parsed, question);
  } catch (error) {
    console.warn('Groq evaluation failed, using fallback evaluator:', error.message);
    return fallbackEvaluation({ question, answer: trimmedAnswer });
  }
}
