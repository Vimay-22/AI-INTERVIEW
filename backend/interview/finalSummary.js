import { callGroqModel, parseJsonResponse, DEFAULT_FOLLOWUP_MODEL } from './groqClient.js';

function fallbackSummary({ evaluations }) {
  // If no evaluations, return a message indicating no data
  if (!evaluations || evaluations.length === 0) {
    return {
      overallScore: 0,
      strongAreas: ['No answers evaluated yet'],
      weakAreas: ['Need to answer questions to get evaluation'],
      suggestedImprovements: [
        'Start answering the interview questions',
        'Provide detailed responses with specific examples',
        'Use STAR format: Situation, Task, Action, Result',
      ],
      topicsToRevise: ['Complete at least one question to get personalized feedback'],
      closingRemark: 'Please answer the interview questions to receive a comprehensive evaluation of your skills.',
    };
  }

  const avgScore = Math.round(evaluations.reduce((sum, item) => sum + (item.overallScore || 0), 0) / evaluations.length);
  const weakCount = evaluations.filter(item => !item.isRelevant || item.overallScore < 6).length;

  return {
    overallScore: avgScore,
    strongAreas: avgScore >= 7
      ? ['Good answer structure and clarity', 'Relevant examples provided']
      : ['Willingness to participate', 'Attempting to provide answers'],
    weakAreas: weakCount > 0
      ? ['Answer depth and technical specificity', 'Clear measurable outcomes in examples']
      : ['Keep maintaining answer structure and clarity'],
    suggestedImprovements: [
      'Use STAR format for each answer',
      'Mention your exact contribution and technical decisions',
      'Add metrics or outcomes to demonstrate impact',
    ],
    topicsToRevise: ['Project architecture explanation', 'Trade-off reasoning', 'Debugging examples'],
    closingRemark: avgScore >= 7 
      ? 'Good performance! Continue practicing to refine your interview skills.'
      : 'Keep practicing. Focus on relevance, role ownership, and measurable impact to improve.',
  };
}

export async function generateInterviewFinalSummary({ resume, evaluations, transcript, questions }) {
  // If no evaluations, return early with no-data message
  if (!evaluations || evaluations.length === 0) {
    return {
      overallScore: 0,
      totalPoints: 0,
      maxPoints: 0,
      questionReports: [],
      strongAreas: ['No answers evaluated yet'],
      weakAreas: ['Need to answer questions to get evaluation'],
      suggestedImprovements: [
        'Start answering the interview questions',
        'Provide detailed responses with specific examples',
        'Use STAR format: Situation, Task, Action, Result',
      ],
      topicsToRevise: ['Complete at least one question to get personalized feedback'],
      closingRemark: 'Please answer the interview questions to receive a comprehensive evaluation of your skills.',
    };
  }

  console.log('📊 Final Summary Generation:');
  console.log(`   - Number of evaluations: ${evaluations.length}`);
  
  // SIMPLE POINT SYSTEM
  let totalPoints = 0;
  const maxPoints = evaluations.length; // 1 point per question max
  
  // Build detailed question reports
  const questionReports = evaluations.map((evaluation, index) => {
    const score = evaluation.overallScore || 0;
    let points = 0;
    
    // Simple scoring:
    // 8-10 = 1 point (good answer)
    // 5-7 = 0.5 points (okay answer)
    // 0-4 = 0 points (bad answer or "I don't know")
    if (score >= 8) {
      points = 1;
    } else if (score >= 5) {
      points = 0.5;
    } else {
      points = 0;
    }
    
    totalPoints += points;
    console.log(`   - Question ${index + 1}: Score ${score}/10 = ${points} point(s)`);
    
    return {
      questionNumber: index + 1,
      question: questions && questions[index] ? questions[index].question : `Question ${index + 1}`,
      category: questions && questions[index] ? questions[index].category : 'general',
      overallScore: evaluation.overallScore,
      technicalScore: evaluation.technicalScore,
      clarityScore: evaluation.clarityScore,
      confidenceScore: evaluation.confidenceScore,
      points: points,
      feedback: evaluation.feedback,
      improvedAnswerTip: evaluation.improvedAnswerTip,
      mistakes: evaluation.mistakes || [],
      missingPoints: evaluation.missingPoints || [],
      performance: score >= 8 ? 'Excellent' : score >= 6 ? 'Good' : score >= 4 ? 'Fair' : 'Needs Improvement'
    };
  });
  
  console.log(`   - Total Points: ${totalPoints}/${maxPoints}`);
  
  // Calculate percentage for display (out of 10)
  const percentageScore = Math.round((totalPoints / maxPoints) * 10);
  
  console.log(`   - Final Score: ${percentageScore}/10`);

  // Count performance
  const excellentAnswers = evaluations.filter(e => e.overallScore >= 8).length;
  const goodAnswers = evaluations.filter(e => e.overallScore >= 6 && e.overallScore < 8).length;
  const fairAnswers = evaluations.filter(e => e.overallScore >= 4 && e.overallScore < 6).length;
  const poorAnswers = evaluations.filter(e => e.overallScore < 4).length;
  
  // Calculate average scores
  const avgTechnical = Math.round(evaluations.reduce((sum, e) => sum + (e.technicalScore || 0), 0) / evaluations.length);
  const avgClarity = Math.round(evaluations.reduce((sum, e) => sum + (e.clarityScore || 0), 0) / evaluations.length);
  const avgConfidence = Math.round(evaluations.reduce((sum, e) => sum + (e.confidenceScore || 0), 0) / evaluations.length);
  
  return {
    overallScore: percentageScore,
    totalPoints: totalPoints,
    maxPoints: maxPoints,
    questionReports: questionReports,
    averageScores: {
      technical: avgTechnical,
      clarity: avgClarity,
      confidence: avgConfidence
    },
    performanceBreakdown: {
      excellent: excellentAnswers,
      good: goodAnswers,
      fair: fairAnswers,
      poor: poorAnswers
    },
    strongAreas: excellentAnswers > 0 
      ? [
          `${excellentAnswers} excellent answer${excellentAnswers > 1 ? 's' : ''} (8-10/10)`,
          avgTechnical >= 7 ? 'Strong technical knowledge' : null,
          avgClarity >= 7 ? 'Clear communication' : null,
          avgConfidence >= 7 ? 'Confident delivery' : null
        ].filter(Boolean)
      : ['No answers scored 8/10 or higher'],
    weakAreas: [
      poorAnswers > 0 ? `${poorAnswers} answer${poorAnswers > 1 ? 's' : ''} scored below 4/10` : null,
      fairAnswers > 0 ? `${fairAnswers} answer${fairAnswers > 1 ? 's' : ''} scored 4-5/10` : null,
      avgTechnical < 6 ? 'Technical depth needs improvement' : null,
      avgClarity < 6 ? 'Answer clarity needs work' : null,
      avgConfidence < 6 ? 'Show more confidence and ownership' : null
    ].filter(Boolean),
    suggestedImprovements: [
      'Provide specific examples with measurable outcomes',
      'Use STAR format: Situation, Task, Action, Result',
      'Mention exact technologies and YOUR specific role',
      'Add more technical details to your answers',
      'Avoid vague statements - be specific',
      poorAnswers > 0 ? 'Review questions you scored poorly on and practice better answers' : null
    ].filter(Boolean),
    topicsToRevise: questionReports
      .filter(r => r.overallScore < 7)
      .map(r => `${r.category}: ${r.question.substring(0, 60)}...`)
      .slice(0, 5),
    closingRemark: `You scored ${totalPoints.toFixed(1)} out of ${maxPoints} points (${percentageScore}/10). ${
      percentageScore >= 8 
        ? 'Excellent performance! You demonstrated strong interview skills.' 
        : percentageScore >= 6
        ? 'Good effort. Focus on the weak areas to improve your score.'
        : percentageScore >= 4
        ? 'Fair performance. Review the feedback and practice more detailed answers.'
        : 'Needs significant improvement. Study the feedback carefully and practice answering with specific examples.'
    }`
  };
}
