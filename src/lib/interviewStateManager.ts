import type { AnswerEvaluation } from '@/services/resumeInterviewApi';

export type InterviewNextAction = 'retry-answer' | 'ask-followup' | 'next-question';

export interface InterviewDecision {
  nextAction: InterviewNextAction;
  spokenResponse: string;
}

export function decideInterviewNextStep(
  evaluation: AnswerEvaluation,
  userAnswer: string,
): InterviewDecision {
  const answerWordCount = userAnswer.trim().split(/\s+/).filter(Boolean).length;
  const looksLikeQuestion = /\?$/.test(userAnswer.trim()) || /^(what|why|how|where|when|who|can you|could you)/i.test(userAnswer.trim());

  if (!evaluation.isRelevant || looksLikeQuestion) {
    const retryPrompt = evaluation.followUpQuestion || `Please answer this directly: ${userAnswer.trim().endsWith('?') ? 'respond to the interview question first.' : 'what did you do, how did you do it, and what was the result?'}`;
    const tip = evaluation.improvedAnswerTip ? ` Tip: ${evaluation.improvedAnswerTip}` : '';
    return {
      nextAction: 'retry-answer',
      spokenResponse: `${evaluation.feedback} ${retryPrompt}${tip}`,
    };
  }

  if (evaluation.shouldAskFollowUp || answerWordCount < 18 || evaluation.overallScore < 6) {
    const followUp = evaluation.followUpQuestion || 'Can you add more technical detail and measurable impact?';
    const tip = evaluation.improvedAnswerTip ? ` Tip: ${evaluation.improvedAnswerTip}` : '';
    return {
      nextAction: 'ask-followup',
      spokenResponse: `${evaluation.feedback} I’d like a little more detail. ${followUp}${tip}`,
    };
  }

  if (evaluation.overallScore >= 8) {
    return {
      nextAction: 'next-question',
      spokenResponse: `${evaluation.feedback} Strong answer. Let’s move to the next question.`,
    };
  }

  return {
    nextAction: 'next-question',
    spokenResponse: `${evaluation.feedback} Good answer. Let’s move to the next question.`,
  };
}
