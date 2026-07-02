import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useSpeechSynthesis } from '@/hooks/useSpeechSynthesis';
import {
  uploadAndParseResume,
  createInterviewSession,
  evaluateAnswer,
  generateFinalSummary,
  AnswerEvaluation,
  FinalInterviewSummary,
  InterviewType,
  ResumeProfile,
  ResumeInterviewQuestion,
} from '@/services/resumeInterviewApi';
import { decideInterviewNextStep } from '@/lib/interviewStateManager';
import InterviewTranscriptPanel from '@/components/InterviewTranscriptPanel';
import type { TranscriptItem } from '@/components/InterviewTranscriptPanel';
import VoiceWave from '@/components/VoiceWave';
import { Upload, FileText, Play, Mic, MicOff, Square, RotateCcw, Volume2, CheckCircle, Bot, Sparkles, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { generateInterviewReportPDF } from '@/utils/pdfGenerator';

export default function ResumeInterview() {
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [parsedResume, setParsedResume] = useState<ResumeProfile | null>(() => {
    // Load from localStorage on mount
    const saved = localStorage.getItem('resumeInterview_parsedResume');
    return saved ? JSON.parse(saved) : null;
  });
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [interviewType, setInterviewType] = useState<InterviewType>(() => {
    const saved = localStorage.getItem('resumeInterview_interviewType');
    return (saved as InterviewType) || 'technical';
  });
  const [isSessionActive, setIsSessionActive] = useState(() => {
    const saved = localStorage.getItem('resumeInterview_isSessionActive');
    return saved === 'true';
  });
  const [questions, setQuestions] = useState<ResumeInterviewQuestion[]>(() => {
    const saved = localStorage.getItem('resumeInterview_questions');
    return saved ? JSON.parse(saved) : [];
  });
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(() => {
    const saved = localStorage.getItem('resumeInterview_currentQuestionIndex');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [activeFollowUpQuestion, setActiveFollowUpQuestion] = useState<string | null>(() => {
    const saved = localStorage.getItem('resumeInterview_activeFollowUpQuestion');
    return saved ? JSON.parse(saved) : null;
  });
  const [transcript, setTranscript] = useState<TranscriptItem[]>(() => {
    const saved = localStorage.getItem('resumeInterview_transcript');
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved);
      // Convert timestamp strings back to Date objects
      return parsed.map((item: any) => ({
        ...item,
        timestamp: new Date(item.timestamp)
      }));
    } catch {
      return [];
    }
  });
  const [answerInput, setAnswerInput] = useState('');
  const [evaluations, setEvaluations] = useState<AnswerEvaluation[]>(() => {
    const saved = localStorage.getItem('resumeInterview_evaluations');
    return saved ? JSON.parse(saved) : [];
  });
  const [userAnswers, setUserAnswers] = useState<string[]>(() => {
    const saved = localStorage.getItem('resumeInterview_userAnswers');
    return saved ? JSON.parse(saved) : [];
  });
  const [finalSummary, setFinalSummary] = useState<FinalInterviewSummary | null>(() => {
    const saved = localStorage.getItem('resumeInterview_finalSummary');
    return saved ? JSON.parse(saved) : null;
  });
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);
  const [isInterviewCompleted, setIsInterviewCompleted] = useState(() => {
    const saved = localStorage.getItem('resumeInterview_isInterviewCompleted');
    return saved === 'true';
  });
  const [lastFeedback, setLastFeedback] = useState<(AnswerEvaluation & { improvedText: string }) | null>(() => {
    const saved = localStorage.getItem('resumeInterview_lastFeedback');
    return saved ? JSON.parse(saved) : null;
  });
  const [speakFeedback] = useState(true);

  const [voiceNoticeShown, setVoiceNoticeShown] = useState(false);

  const speechRecognition = useSpeechRecognition({
    onResult: handleUserAnswer,
    continuous: false,
    interimResults: true,
  });

  const speechSynthesis = useSpeechSynthesis({ rate: 0.9 });

  const stopSpeaking = useCallback(() => {
    speechSynthesis.stop();
  }, [speechSynthesis]);

  const startListening = useCallback(() => {
    if (!speechRecognition.isSupported) return;
    speechRecognition.startListening();
  }, [speechRecognition]);

  const stopListening = useCallback(() => {
    if (!speechRecognition.isSupported) return;
    speechRecognition.stopListening();
  }, [speechRecognition]);

  // Persist parsedResume to localStorage whenever it changes
  useEffect(() => {
    if (parsedResume) {
      localStorage.setItem('resumeInterview_parsedResume', JSON.stringify(parsedResume));
      localStorage.setItem('resumeInterview_fileName', resumeFile?.name || 'resume.pdf');
    }
  }, [parsedResume, resumeFile]);

  // Persist interviewType to localStorage
  useEffect(() => {
    localStorage.setItem('resumeInterview_interviewType', interviewType);
  }, [interviewType]);

  // Persist session state
  useEffect(() => {
    localStorage.setItem('resumeInterview_isSessionActive', String(isSessionActive));
  }, [isSessionActive]);

  useEffect(() => {
    if (questions.length > 0) {
      localStorage.setItem('resumeInterview_questions', JSON.stringify(questions));
    }
  }, [questions]);

  useEffect(() => {
    localStorage.setItem('resumeInterview_currentQuestionIndex', String(currentQuestionIndex));
  }, [currentQuestionIndex]);

  useEffect(() => {
    localStorage.setItem('resumeInterview_activeFollowUpQuestion', JSON.stringify(activeFollowUpQuestion));
  }, [activeFollowUpQuestion]);

  useEffect(() => {
    if (transcript.length > 0) {
      localStorage.setItem('resumeInterview_transcript', JSON.stringify(transcript));
    }
  }, [transcript]);

  useEffect(() => {
    if (evaluations.length > 0) {
      localStorage.setItem('resumeInterview_evaluations', JSON.stringify(evaluations));
    }
  }, [evaluations]);

  useEffect(() => {
    if (userAnswers.length > 0) {
      localStorage.setItem('resumeInterview_userAnswers', JSON.stringify(userAnswers));
    }
  }, [userAnswers]);

  useEffect(() => {
    if (finalSummary) {
      localStorage.setItem('resumeInterview_finalSummary', JSON.stringify(finalSummary));
    }
  }, [finalSummary]);

  useEffect(() => {
    localStorage.setItem('resumeInterview_isInterviewCompleted', String(isInterviewCompleted));
  }, [isInterviewCompleted]);

  useEffect(() => {
    if (lastFeedback) {
      localStorage.setItem('resumeInterview_lastFeedback', JSON.stringify(lastFeedback));
    }
  }, [lastFeedback]);

  useEffect(() => {
    return () => {
      stopListening();
      stopSpeaking();
    };
  }, [stopListening, stopSpeaking]);

  useEffect(() => {
    if (voiceNoticeShown) return;
    if (!isSessionActive) return;

    if (!speechSynthesis.isSupported || !speechRecognition.isSupported) {
      const fallbackItem: TranscriptItem = {
        id: `ai-voice-fallback-${Date.now()}`,
        speaker: 'ai',
        text: 'Voice is limited on this browser/device. Interview will continue in text mode using Groq-generated resume questions. You can type each answer and submit.',
        timestamp: new Date(),
      };
      setTranscript((prev) => (prev.some((item) => item.id.startsWith('ai-voice-fallback-')) ? prev : [...prev, fallbackItem]));
      setVoiceNoticeShown(true);
    }
  }, [isSessionActive, speechRecognition.isSupported, speechSynthesis.isSupported, voiceNoticeShown]);

  const clearResumeData = useCallback(() => {
    setParsedResume(null);
    setResumeFile(null);
    setUploadError(null);
    setIsSessionActive(false);
    setTranscript([]);
    setQuestions([]);
    setEvaluations([]);
    setUserAnswers([]);
    setFinalSummary(null);
    setCurrentQuestionIndex(0);
    setActiveFollowUpQuestion(null);
    setIsInterviewCompleted(false);
    setLastFeedback(null);
    localStorage.removeItem('resumeInterview_parsedResume');
    localStorage.removeItem('resumeInterview_fileName');
    localStorage.removeItem('resumeInterview_isSessionActive');
    localStorage.removeItem('resumeInterview_questions');
    localStorage.removeItem('resumeInterview_currentQuestionIndex');
    localStorage.removeItem('resumeInterview_activeFollowUpQuestion');
    localStorage.removeItem('resumeInterview_transcript');
    localStorage.removeItem('resumeInterview_evaluations');
    localStorage.removeItem('resumeInterview_userAnswers');
    localStorage.removeItem('resumeInterview_finalSummary');
    localStorage.removeItem('resumeInterview_isInterviewCompleted');
    localStorage.removeItem('resumeInterview_lastFeedback');
  }, []);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setResumeFile(file);
    setIsUploading(true);
    setUploadError(null);
    setParsedResume(null);

    try {
      const parsed = await uploadAndParseResume(file);
      setParsedResume(parsed);
    } catch (error) {
      console.error('Error parsing resume:', error);
      const message = error instanceof Error ? error.message : 'Failed to parse resume';
      setUploadError(message);
    } finally {
      setIsUploading(false);
    }
  }, []);

  async function handleUserAnswer(answer: string) {
    const currentQuestion = questions[currentQuestionIndex];
    if (!currentQuestion || !parsedResume || isEvaluating || isInterviewCompleted) return;

    const trimmedAnswer = answer.trim();
    if (!trimmedAnswer) return;

    // Accept any answer with at least 2 words (including "I don't know")
    const answerWordCount = trimmedAnswer.split(/\s+/).filter(Boolean).length;
    if (answerWordCount < 2) {
      const retryText = 'Please provide at least a brief answer. Even "I don\'t know" is acceptable.';
      setTranscript(prev => [...prev, {
        id: `ai-short-${Date.now()}`,
        speaker: 'ai',
        text: retryText,
        timestamp: new Date(),
      }]);
      speechSynthesis.speak(retryText);
      return;
    }

    stopListening();
    setIsEvaluating(true);
    setAnswerInput('');
    setLastFeedback(null); // Clear previous feedback when submitting new answer

    const userItem: TranscriptItem = {
      id: `user-${Date.now()}`,
      speaker: 'user',
      text: trimmedAnswer,
      timestamp: new Date(),
    };

    const conversationHistory = [...transcript.slice(-10), userItem].map(item => ({
      speaker: item.speaker,
      text: item.text,
    }));

    setTranscript(prev => [...prev, userItem]);

    try {
      const evaluation = await evaluateAnswer({
        resumeProfile: parsedResume,
        interviewType,
        currentQuestion: activeFollowUpQuestion || currentQuestion.question,
        answer: trimmedAnswer,
        history: conversationHistory,
      });

      setEvaluations(prev => [...prev, evaluation]);
      setUserAnswers(prev => {
        const updated = [...prev, trimmedAnswer];
        console.log('💾 Saving answer:', {
          questionIndex: currentQuestionIndex,
          answerLength: trimmedAnswer.length,
          totalAnswers: updated.length,
          answer: trimmedAnswer.substring(0, 50) + '...'
        });
        return updated;
      }); // Save user's answer

      setLastFeedback({
        ...evaluation,
        improvedText: evaluation.improvedAnswerTip,
      });

      const decision = decideInterviewNextStep(evaluation, trimmedAnswer);

      const aiItem: TranscriptItem = {
        id: `ai-${Date.now()}`,
        speaker: 'ai',
        text: decision.spokenResponse,
        timestamp: new Date(),
      };
      setTranscript(prev => [...prev, aiItem]);

      if (speakFeedback) {
        speechSynthesis.speak(decision.spokenResponse);
      }

      // Always move to next question after showing feedback
      setActiveFollowUpQuestion(null);
      console.log(`✅ Answer evaluated. Moving to next question in 3 seconds...`);
      console.log(`   Current question index: ${currentQuestionIndex}`);
      console.log(`   Total questions: ${questions.length}`);
      setTimeout(() => {
        advanceToNextQuestion();
      }, 3000); // 3 seconds to read feedback
    } catch (error) {
      console.error('Answer evaluation failed:', error);
      const fallbackText = 'I could not evaluate that answer clearly. Please answer the question again with your exact role, technical decisions, and measurable impact.';
      setTranscript(prev => [...prev, {
        id: `ai-fallback-${Date.now()}`,
        speaker: 'ai',
        text: fallbackText,
        timestamp: new Date(),
      }]);

      speechSynthesis.speak(fallbackText);
    } finally {
      setIsEvaluating(false);
    }
  }

  async function completeInterview() {
    if (!parsedResume) return;
    
    // Validate that we have at least one evaluation
    if (evaluations.length === 0) {
      const errorMsg = 'Please answer at least one question before generating the final report.';
      setTranscript(prev => [...prev, {
        id: `ai-no-eval-${Date.now()}`,
        speaker: 'ai',
        text: errorMsg,
        timestamp: new Date(),
      }]);
      speechSynthesis.speak(errorMsg);
      return;
    }

    console.log('🎯 Generating final report with evaluations:', evaluations);
    console.log('📊 Evaluation scores:', evaluations.map(e => e.overallScore));

    setIsInterviewCompleted(true);
    setIsSummaryLoading(true);

    try {
      const summary = await generateFinalSummary({
        resumeProfile: parsedResume,
        evaluations,
        transcript: transcript.map(t => ({ speaker: t.speaker, text: t.text })),
        questions,
      });

      setFinalSummary(summary);
      console.log('✅ Final summary generated:', summary);
    } catch (error) {
      console.error('❌ Failed to generate summary:', error);
      const errorMsg = 'Failed to generate final report. Please try again.';
      setTranscript(prev => [...prev, {
        id: `ai-error-${Date.now()}`,
        speaker: 'ai',
        text: errorMsg,
        timestamp: new Date(),
      }]);
    } finally {
      setIsSummaryLoading(false);
    }
  }

    async function startSession() {
      if (!parsedResume) return;

      setIsSessionActive(true);
      setTranscript([]);
      setLastFeedback(null);
      setEvaluations([]);
      setUserAnswers([]);
      setFinalSummary(null);
      setIsInterviewCompleted(false);
      setCurrentQuestionIndex(0);
      setActiveFollowUpQuestion(null);
      setVoiceNoticeShown(false);
    
      let generatedQuestions: ResumeInterviewQuestion[] = [];
      try {
        generatedQuestions = await createInterviewSession(parsedResume, interviewType);
      } catch (error) {
        console.error('Failed to create interview session:', error);
        const message = error instanceof Error ? error.message : 'Failed to generate questions';
        setUploadError(message);
        setIsSessionActive(false);
        return;
      }

      setQuestions(generatedQuestions);

      if (generatedQuestions.length === 0) {
        const noQuestionText = 'I could not generate interview questions from this resume. Please upload a clearer resume and try again.';
        setTranscript([{ id: 'ai-no-questions', speaker: 'ai', text: noQuestionText, timestamp: new Date() }]);
        speechSynthesis.speak(noQuestionText);
        return;
      }
    
      const topSkills = parsedResume.skills.slice(0, 3).join(', ');
      const topProject = parsedResume.projects[0]?.name || 'your project work';
      const greeting = `Welcome. I reviewed your resume and I'm particularly interested in ${topProject}. I also see strengths in ${topSkills || 'your technical background'}. I will run this as a realistic ${interviewType === 'hr' ? 'HR' : 'technical'} interview.`;
    
      const greetingItem: TranscriptItem = {
        id: 'ai-greeting',
        speaker: 'ai',
        text: greeting,
        timestamp: new Date(),
      };
    
      setTranscript([greetingItem]);
      
      if (window.speechSynthesis) {
        console.log('🔊 Speaking greeting');
        speechSynthesis.speak(greeting);

        // Speak first question after a short delay
        setTimeout(() => {
          const firstQuestion = generatedQuestions[0];
          if (firstQuestion) {
            const questionItem: TranscriptItem = {
              id: `ai-q-0`,
              speaker: 'ai',
              text: firstQuestion.question,
              timestamp: new Date(),
            };
            setTranscript(prev => [...prev, questionItem]);
            console.log('🔊 Speaking first question');
            speechSynthesis.speak(firstQuestion.question);
          }
        }, 3000); // Wait 3 seconds after greeting
      } else {
        const voiceFallback = 'Voice is not available in this browser, so I will continue the interview in text mode. Please type your answer and submit it after reading each question.';
        setTranscript(prev => [...prev, {
          id: `ai-voice-off-${Date.now()}`,
          speaker: 'ai',
          text: voiceFallback,
          timestamp: new Date(),
        }]);
      }
    }

    function endSession() {
      setIsSessionActive(false);
      stopListening();
      stopSpeaking();
      
      // Clear session data from localStorage but keep resume
      localStorage.removeItem('resumeInterview_isSessionActive');
      localStorage.removeItem('resumeInterview_questions');
      localStorage.removeItem('resumeInterview_currentQuestionIndex');
      localStorage.removeItem('resumeInterview_activeFollowUpQuestion');
      localStorage.removeItem('resumeInterview_transcript');
      localStorage.removeItem('resumeInterview_evaluations');
      localStorage.removeItem('resumeInterview_userAnswers');
      localStorage.removeItem('resumeInterview_isInterviewCompleted');
      localStorage.removeItem('resumeInterview_lastFeedback');
    }

    async function advanceToNextQuestion() {
      // Don't clear feedback - let it stay visible
      const nextIndex = currentQuestionIndex + 1;

      if (nextIndex >= questions.length) {
        const endMessage = "We've completed all resume-based questions. Thank you for participating in the interview.";
        const endItem: TranscriptItem = {
          id: 'ai-end',
          speaker: 'ai',
          text: endMessage,
          timestamp: new Date(),
        };
        setTranscript(prev => [...prev, endItem]);
        console.log('🔊 Speaking end message');
        speechSynthesis.speak(endMessage);
        // Don't call completeInterview - just end the session
        setTimeout(() => {
          setIsSessionActive(false);
        }, 2000);
        return;
      }

      setCurrentQuestionIndex(nextIndex);
      const question = questions[nextIndex];

      const questionItem: TranscriptItem = {
        id: `ai-q-${nextIndex}`,
        speaker: 'ai',
        text: question.question,
        timestamp: new Date(),
      };
      setTranscript(prev => [...prev, questionItem]);
      
      console.log(`🎤 Speaking question ${nextIndex + 1}`);
      speechSynthesis.speak(question.question);
    }

    function nextQuestion() {
      setActiveFollowUpQuestion(null);
      void advanceToNextQuestion();
    }

    async function replayCurrentQuestion() {
      if (!currentQuestion) return;
      speechSynthesis.speak(activeFollowUpQuestion || currentQuestion.question);
    }

    function downloadReport() {
      if (!finalSummary || !parsedResume) {
        console.error('❌ Cannot download: missing finalSummary or parsedResume');
        return;
      }

      console.log('📥 Preparing PDF download...');
      console.log('   Questions:', questions.length);
      console.log('   User Answers:', userAnswers.length);
      console.log('   Evaluations:', evaluations.length);
      console.log('   Question Reports:', finalSummary.questionReports?.length);
      
      // Debug: Show all data
      console.log('📊 Full Data Check:');
      questions.forEach((q, i) => {
        console.log(`   Q${i + 1}:`, {
          question: q.question.substring(0, 50),
          hasAnswer: !!userAnswers[i],
          answerLength: userAnswers[i]?.length || 0,
          hasEvaluation: !!evaluations[i],
          hasReport: !!finalSummary.questionReports?.[i]
        });
      });

      const questionsAndAnswers = questions.map((q, index) => {
        const answer = userAnswers[index] || 'No answer provided';
        console.log(`   Mapping Q${index + 1}: answer length = ${answer.length}`);
        return {
          question: q.question,
          answer: answer,
          category: q.category,
        };
      });

      console.log('   Mapped Q&A:', questionsAndAnswers.length);
      questionsAndAnswers.forEach((qa, i) => {
        console.log(`   Q${i + 1} mapped:`, {
          questionLength: qa.question.length,
          answerLength: qa.answer.length,
          category: qa.category
        });
      });

      generateInterviewReportPDF({
        candidateName: parsedResume.name || 'Candidate',
        date: new Date().toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        }),
        interviewType: interviewType === 'hr' ? 'HR Interview' : 'Technical Interview',
        summary: finalSummary,
        questionsAndAnswers,
      });

      console.log('✅ PDF generation initiated');
    }
  const currentQuestion = questions[currentQuestionIndex];
  const questionProgressPercent = questions.length > 0
    ? Math.min(100, Math.round(((currentQuestionIndex + 1) / questions.length) * 100))
    : 0;

  return (
    <div className="h-full flex flex-col lg:flex-row gap-6">
      {/* Main Area */}
      <div className="flex-1 flex flex-col gap-6">
        
        {/* Resume Upload Section */}
        {!isSessionActive && (
          <>
            <Card className="card-elevated">
              <CardHeader>
                <CardTitle>Upload Your Resume</CardTitle>
                <CardDescription>
                  Upload your resume and we'll generate personalized interview questions
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                  <input
                    type="file"
                    accept=".pdf,.docx,.txt"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="resume-upload"
                  />
                  <label
                    htmlFor="resume-upload"
                    className="cursor-pointer flex flex-col items-center gap-4"
                  >
                    <Upload className="h-12 w-12 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Click to upload resume</p>
                      <p className="text-sm text-muted-foreground">
                        PDF, DOCX or TXT (Max 8MB)
                      </p>
                    </div>
                  </label>
                </div>

                {resumeFile && (
                  <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                    <FileText className="h-5 w-5 text-primary" />
                    <span className="flex-1 truncate">{resumeFile.name}</span>
                    {isUploading && <span className="text-sm text-muted-foreground">Processing...</span>}
                    {parsedResume && <CheckCircle className="h-5 w-5 text-success" />}
                  </div>
                )}

                {uploadError && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                    {uploadError}
                  </div>
                )}

              </CardContent>
            </Card>

            {/* Parsed Resume Display */}
            {parsedResume && (
              <Card className="card-elevated">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-success" />
                    <Sparkles className="h-4 w-4 text-accent" />
                    Resume Analyzed
                  </CardTitle>
                  <CardDescription className="flex items-center gap-2 text-xs">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M7 9a2 2 0 012-2h6a2 2 0 012 2v6a2 2 0 01-2 2H9a2 2 0 01-2-2V9z" />
                        <path d="M5 3a2 2 0 00-2 2v6a2 2 0 002 2V5h8a2 2 0 00-2-2H5z" />
                      </svg>
                      Saved - persists across pages
                    </span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {(parsedResume.name || parsedResume.email || parsedResume.phone) && (
                    <div className="grid gap-2 sm:grid-cols-3 text-sm">
                      <div className="rounded-lg bg-muted p-3">
                        <p className="text-muted-foreground text-xs uppercase">Name</p>
                        <p className="font-medium">{parsedResume.name || 'Not detected'}</p>
                      </div>
                      <div className="rounded-lg bg-muted p-3">
                        <p className="text-muted-foreground text-xs uppercase">Email</p>
                        <p className="font-medium break-all">{parsedResume.email || 'Not detected'}</p>
                      </div>
                      <div className="rounded-lg bg-muted p-3">
                        <p className="text-muted-foreground text-xs uppercase">Phone</p>
                        <p className="font-medium">{parsedResume.phone || 'Not detected'}</p>
                      </div>
                    </div>
                  )}

                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Skills Detected:</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {parsedResume.skills.map((skill, i) => (
                        <span key={i} className="px-2 py-1 bg-primary/10 text-primary text-sm rounded-full">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>

                  {parsedResume.projects.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Projects:</p>
                      <ul className="mt-2 text-sm space-y-1">
                        {parsedResume.projects.map((project, i) => (
                          <li key={i}>
                            • <span className="font-medium">{project.name || `Project ${i + 1}`}</span> — {project.description}
                            {project.technologies?.length > 0 && (
                              <span className="text-muted-foreground"> (Tech: {project.technologies.join(', ')})</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {parsedResume.education.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Education:</p>
                      <ul className="mt-2 text-sm space-y-1">
                        {parsedResume.education.map((edu, i) => (
                          <li key={i}>• {edu}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {parsedResume.experience.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Experience:</p>
                      <ul className="mt-2 text-sm space-y-1">
                        {parsedResume.experience.map((exp, i) => (
                          <li key={i}>• {exp}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <Tabs value={interviewType} onValueChange={(v) => setInterviewType(v as InterviewType)}>
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="hr">HR Interview</TabsTrigger>
                      <TabsTrigger value="technical">Technical Interview</TabsTrigger>
                    </TabsList>
                  </Tabs>
                  
                  <div className="flex gap-3">
                    <Button className="flex-1 btn-gradient" size="lg" onClick={startSession}>
                      <Play className="mr-2 h-5 w-5" />
                      Start Resume-Based Interview
                    </Button>
                    <Button 
                      variant="outline" 
                      size="lg" 
                      onClick={clearResumeData}
                      className="border-destructive/30 text-destructive hover:bg-destructive/10"
                    >
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Clear
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Active Session */}
        {isSessionActive && currentQuestion && (
          <>
            {/* Current Question */}
            <Card className="card-elevated">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">
                    Question {currentQuestionIndex + 1} of {questions.length}
                  </CardTitle>
                  <span className="px-2 py-1 text-xs rounded-full bg-accent/10 text-accent">
                    {currentQuestion.category}
                  </span>
                </div>
                <CardDescription>
                  Based on: {currentQuestion.source}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-3">
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-primary transition-all" style={{ width: `${questionProgressPercent}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Progress: {questionProgressPercent}%</p>
                </div>
                <p className="text-lg font-medium">{activeFollowUpQuestion || currentQuestion.question}</p>
              </CardContent>
            </Card>

            {/* Voice Controls */}
            <Card className="card-elevated">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center gap-6">
                  <div className={cn(
                    "flex items-center gap-4 rounded-2xl border px-4 py-3 w-full max-w-lg",
                    speechSynthesis.isSpeaking ? "bg-accent/10 border-accent/30" : "bg-muted/40 border-border"
                  )}>
                    <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-lg">
                      <Bot className="h-7 w-7" />
                      {speechSynthesis.isSpeaking && (
                        <span className="absolute inset-0 rounded-full border-2 border-accent/70 animate-ping" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold">AI Interviewer</p>
                      <p className="text-xs text-muted-foreground">
                        {speechSynthesis.isSpeaking ? 'Speaking naturally and asking the next question...' : 'Ready to ask the next question based on your resume.'}
                      </p>
                    </div>
                  </div>

                  <div className="h-16 flex items-center justify-center">
                    <VoiceWave isActive={speechRecognition.isListening || speechSynthesis.isSpeaking} />
                  </div>
                  
                  <p className="text-muted-foreground text-sm">
                    {speechSynthesis.isSpeaking && (
                      <span className="flex items-center gap-2">
                        <Volume2 className="h-4 w-4 text-accent animate-pulse" />
                        AI is speaking...
                      </span>
                    )}
                    {speechRecognition.isListening && (
                      <span className="flex items-center gap-2 text-primary">
                        <Mic className="h-4 w-4 animate-pulse" />
                        Listening... Speak now
                      </span>
                    )}
                    {!speechSynthesis.isSpeaking && !speechRecognition.isListening && (
                      'Click the microphone to answer'
                    )}
                  </p>

                  {(!speechSynthesis.isSupported || !speechRecognition.isSupported) && (
                    <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-md">
                      Voice is partially unavailable. Questions are still generated from your resume using Groq. Please type your answer and click Submit Answer.
                    </p>
                  )}

                  {speechRecognition.transcript && (
                    <div className="w-full p-3 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground">You're saying:</p>
                      <p className="text-foreground">{speechRecognition.transcript}</p>
                    </div>
                  )}

                  <div className="w-full space-y-2">
                    <p className="text-sm text-muted-foreground">Or type your answer</p>
                    <textarea
                      value={answerInput}
                      onChange={(e) => setAnswerInput(e.target.value)}
                      placeholder="Type your interview answer here..."
                      className="w-full min-h-24 rounded-md border bg-background px-3 py-2 text-sm"
                      disabled={isEvaluating || speechSynthesis.isSpeaking}
                    />
                    <Button
                      className="w-full"
                      onClick={() => handleUserAnswer(answerInput)}
                      disabled={!answerInput.trim() || isEvaluating || speechSynthesis.isSpeaking}
                    >
                      Submit Answer
                    </Button>
                  </div>

                  <div className="flex gap-4">
                    <Button
                      size="lg"
                      variant="outline"
                      className="w-16 h-16 rounded-full"
                      onClick={replayCurrentQuestion}
                      disabled={speechRecognition.isListening || isEvaluating || !speechSynthesis.isSupported}
                    >
                      <Volume2 className="h-6 w-6" />
                    </Button>
                    <Button
                      size="lg"
                      variant={speechRecognition.isListening ? "destructive" : "default"}
                      className={cn(
                        "w-16 h-16 rounded-full",
                        !speechRecognition.isListening && "btn-gradient"
                      )}
                      onClick={speechRecognition.isListening ? stopListening : startListening}
                      disabled={speechSynthesis.isSpeaking || isEvaluating || !speechRecognition.isSupported}
                    >
                      {speechRecognition.isListening ? (
                        <MicOff className="h-6 w-6" />
                      ) : (
                        <Mic className="h-6 w-6" />
                      )}
                    </Button>
                  </div>

                  <div className="flex gap-2 w-full">
                    <Button 
                      variant="outline" 
                      className="flex-1"
                      onClick={nextQuestion}
                      disabled={speechRecognition.isListening || speechSynthesis.isSpeaking || isEvaluating || isInterviewCompleted}
                    >
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Next Question
                    </Button>
                    <Button 
                      variant="secondary" 
                      className="flex-1"
                      onClick={() => completeInterview()}
                      disabled={speechRecognition.isListening || speechSynthesis.isSpeaking || isEvaluating || evaluations.length === 0}
                    >
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Finish & Get Report
                    </Button>
                    <Button 
                      variant="destructive" 
                      className="flex-1"
                      onClick={endSession}
                      disabled={isSummaryLoading}
                    >
                      <Square className="mr-2 h-4 w-4" />
                      End Session
                    </Button>
                  </div>

                  {isSummaryLoading && (
                    <p className="text-xs text-muted-foreground">Generating final interview summary...</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Feedback Card */}
            {lastFeedback && (
              <Card className="card-elevated border-l-4 border-l-accent">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">AI Feedback</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Coach Feedback:</p>
                    <p className="text-sm bg-muted p-3 rounded-lg">{lastFeedback.feedback}</p>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className={`rounded-md p-2 ${lastFeedback.overallScore >= 8 ? 'bg-green-500/20 text-green-700' : lastFeedback.overallScore >= 6 ? 'bg-yellow-500/20 text-yellow-700' : 'bg-red-500/20 text-red-700'}`}>
                      Overall: <span className="font-semibold">{lastFeedback.overallScore}/10</span>
                    </div>
                    <div className={`rounded-md p-2 ${lastFeedback.technicalScore >= 8 ? 'bg-green-500/20 text-green-700' : lastFeedback.technicalScore >= 6 ? 'bg-yellow-500/20 text-yellow-700' : 'bg-red-500/20 text-red-700'}`}>
                      Technical: <span className="font-semibold">{lastFeedback.technicalScore}/10</span>
                    </div>
                    <div className={`rounded-md p-2 ${lastFeedback.clarityScore >= 8 ? 'bg-green-500/20 text-green-700' : lastFeedback.clarityScore >= 6 ? 'bg-yellow-500/20 text-yellow-700' : 'bg-red-500/20 text-red-700'}`}>
                      Clarity: <span className="font-semibold">{lastFeedback.clarityScore}/10</span>
                    </div>
                    <div className={`rounded-md p-2 ${lastFeedback.confidenceScore >= 8 ? 'bg-green-500/20 text-green-700' : lastFeedback.confidenceScore >= 6 ? 'bg-yellow-500/20 text-yellow-700' : 'bg-red-500/20 text-red-700'}`}>
                      Confidence: <span className="font-semibold">{lastFeedback.confidenceScore}/10</span>
                    </div>
                  </div>
                  
                  {lastFeedback.mistakes && lastFeedback.mistakes.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-red-600 mb-1">❌ Mistakes Found:</p>
                      <ul className="text-sm bg-red-50 p-3 rounded-lg space-y-1">
                        {lastFeedback.mistakes.map((mistake, i) => (
                          <li key={i} className="text-red-700">• {mistake}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {lastFeedback.missingPoints && lastFeedback.missingPoints.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-orange-600 mb-1">⚠️ Missing Key Points:</p>
                      <ul className="text-sm bg-orange-50 p-3 rounded-lg space-y-1">
                        {lastFeedback.missingPoints.map((point, i) => (
                          <li key={i} className="text-orange-700">• {point}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">💡 Improvement Tip:</p>
                    <p className="text-sm bg-accent/10 p-3 rounded-lg">{lastFeedback.improvedText}</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Final Report */}
        {isInterviewCompleted && finalSummary && (
          <Card className="card-elevated border-2 border-primary">
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                📊 Final Interview Report
              </CardTitle>
              <CardDescription>
                Comprehensive evaluation of your interview performance
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Overall Score */}
              <div className="text-center p-6 bg-gradient-to-br from-primary/10 to-accent/10 rounded-lg">
                <p className="text-sm text-muted-foreground mb-2">Overall Score</p>
                <p className="text-5xl font-bold text-primary">{finalSummary.overallScore}/10</p>
                <p className="text-sm text-muted-foreground mt-2">
                  {finalSummary.totalPoints?.toFixed(1)} out of {finalSummary.maxPoints} points
                </p>
              </div>

              {/* Performance Breakdown */}
              {finalSummary.performanceBreakdown && (
                <div>
                  <h3 className="font-semibold mb-3">Performance Breakdown</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-green-50 p-3 rounded-lg text-center">
                      <p className="text-2xl font-bold text-green-700">{finalSummary.performanceBreakdown.excellent}</p>
                      <p className="text-xs text-green-600">Excellent (8-10)</p>
                    </div>
                    <div className="bg-blue-50 p-3 rounded-lg text-center">
                      <p className="text-2xl font-bold text-blue-700">{finalSummary.performanceBreakdown.good}</p>
                      <p className="text-xs text-blue-600">Good (6-7)</p>
                    </div>
                    <div className="bg-yellow-50 p-3 rounded-lg text-center">
                      <p className="text-2xl font-bold text-yellow-700">{finalSummary.performanceBreakdown.fair}</p>
                      <p className="text-xs text-yellow-600">Fair (4-5)</p>
                    </div>
                    <div className="bg-red-50 p-3 rounded-lg text-center">
                      <p className="text-2xl font-bold text-red-700">{finalSummary.performanceBreakdown.poor}</p>
                      <p className="text-xs text-red-600">Poor (0-3)</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Average Scores */}
              {finalSummary.averageScores && (
                <div>
                  <h3 className="font-semibold mb-3">Average Scores by Category</h3>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-muted p-3 rounded-lg text-center">
                      <p className="text-2xl font-bold">{finalSummary.averageScores.technical}/10</p>
                      <p className="text-xs text-muted-foreground">Technical</p>
                    </div>
                    <div className="bg-muted p-3 rounded-lg text-center">
                      <p className="text-2xl font-bold">{finalSummary.averageScores.clarity}/10</p>
                      <p className="text-xs text-muted-foreground">Clarity</p>
                    </div>
                    <div className="bg-muted p-3 rounded-lg text-center">
                      <p className="text-2xl font-bold">{finalSummary.averageScores.confidence}/10</p>
                      <p className="text-xs text-muted-foreground">Confidence</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Question-by-Question Report */}
              {finalSummary.questionReports && finalSummary.questionReports.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3">Question-by-Question Analysis</h3>
                  <div className="space-y-4">
                    {finalSummary.questionReports.map((report) => (
                      <Card key={report.questionNumber} className="border-l-4" style={{
                        borderLeftColor: report.overallScore >= 8 ? '#22c55e' : report.overallScore >= 6 ? '#eab308' : report.overallScore >= 4 ? '#f97316' : '#ef4444'
                      }}>
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <CardTitle className="text-sm">Question {report.questionNumber}</CardTitle>
                              <CardDescription className="text-xs mt-1">{report.question}</CardDescription>
                            </div>
                            <div className="text-right ml-4">
                              <p className="text-lg font-bold">{report.overallScore}/10</p>
                              <p className="text-xs text-muted-foreground">{report.points} point{report.points === 1 ? '' : 's'}</p>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <div className="flex gap-2 text-xs">
                            <span className="px-2 py-1 bg-muted rounded">Tech: {report.technicalScore}/10</span>
                            <span className="px-2 py-1 bg-muted rounded">Clarity: {report.clarityScore}/10</span>
                            <span className="px-2 py-1 bg-muted rounded">Confidence: {report.confidenceScore}/10</span>
                            <span className={`px-2 py-1 rounded font-semibold ${
                              report.performance === 'Excellent' ? 'bg-green-100 text-green-700' :
                              report.performance === 'Good' ? 'bg-blue-100 text-blue-700' :
                              report.performance === 'Fair' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-red-100 text-red-700'
                            }`}>{report.performance}</span>
                          </div>
                          <div className="text-sm">
                            <p className="font-medium text-muted-foreground">Feedback:</p>
                            <p className="text-sm">{report.feedback}</p>
                          </div>
                          {report.mistakes.length > 0 && (
                            <div className="text-sm">
                              <p className="font-medium text-red-600">Mistakes:</p>
                              <ul className="text-xs space-y-1 ml-4">
                                {report.mistakes.map((m, i) => <li key={i} className="text-red-700">• {m}</li>)}
                              </ul>
                            </div>
                          )}
                          {report.missingPoints.length > 0 && (
                            <div className="text-sm">
                              <p className="font-medium text-orange-600">Missing Points:</p>
                              <ul className="text-xs space-y-1 ml-4">
                                {report.missingPoints.map((m, i) => <li key={i} className="text-orange-700">• {m}</li>)}
                              </ul>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Strong Areas */}
              {finalSummary.strongAreas.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2 text-green-700">✅ Strong Areas</h3>
                  <ul className="space-y-1">
                    {finalSummary.strongAreas.map((area, i) => (
                      <li key={i} className="text-sm text-green-600">• {area}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Weak Areas */}
              {finalSummary.weakAreas.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2 text-red-700">❌ Areas for Improvement</h3>
                  <ul className="space-y-1">
                    {finalSummary.weakAreas.map((area, i) => (
                      <li key={i} className="text-sm text-red-600">• {area}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Suggested Improvements */}
              {finalSummary.suggestedImprovements.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2 text-blue-700">💡 Suggested Improvements</h3>
                  <ul className="space-y-1">
                    {finalSummary.suggestedImprovements.map((improvement, i) => (
                      <li key={i} className="text-sm text-blue-600">• {improvement}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Closing Remark */}
              <div className="p-4 bg-primary/10 rounded-lg">
                <p className="text-sm font-medium">{finalSummary.closingRemark}</p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button 
                  className="flex-1 btn-gradient"
                  onClick={downloadReport}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download PDF Report
                </Button>
                <Button 
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setIsInterviewCompleted(false);
                    setFinalSummary(null);
                  }}
                >
                  Review Transcript
                </Button>
                <Button 
                  variant="outline"
                  className="flex-1"
                  onClick={endSession}
                >
                  End Session
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Transcript Sidebar */}
      <div className="lg:w-80 xl:w-96">
        <InterviewTranscriptPanel items={transcript} className="h-[calc(100vh-12rem)]" />
      </div>
    </div>
  );
}
