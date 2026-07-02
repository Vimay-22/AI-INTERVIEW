import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useSpeechSynthesis } from '@/hooks/useSpeechSynthesis';
import { 
  getRandomQuestion, 
  getTopicQuestion,
  evaluateAnswerWithBackend,
  resetAskedQuestions,
  InterviewQuestion,
  InterviewType,
  TechnicalTopic,
  TechnicalFocus,
} from '@/services/aiInterviewService';
import InterviewTranscriptPanel from '@/components/InterviewTranscriptPanel';
import type { TranscriptItem } from '@/components/InterviewTranscriptPanel';
import VoiceWave from '@/components/VoiceWave';
import { Mic, MicOff, Play, Square, RotateCcw, Lightbulb, MessageSquare, Volume2, Bot } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AIInterview() {
  const [interviewType, setInterviewType] = useState<InterviewType>('technical');
  const [technicalTopic, setTechnicalTopic] = useState<TechnicalTopic>('react');
  const [customTechnicalTopic, setCustomTechnicalTopic] = useState('');
  const [technicalVersion, setTechnicalVersion] = useState('React 18');
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState<InterviewQuestion | null>(null);
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [showHint, setShowHint] = useState(false);
  const [showSampleAnswer, setShowSampleAnswer] = useState(false);
  const [lastFeedback, setLastFeedback] = useState<{ improved: string; suggestions: string[] } | null>(null);

  const buildTechnicalQuestion = () => {
    const focus: TechnicalFocus = {
      topic: technicalTopic,
      customTopic: customTechnicalTopic,
      version: technicalVersion,
    };

    return getTopicQuestion(focus.topic, focus.version, focus.customTopic);
  };

  const speechRecognition = useSpeechRecognition({
    onResult: handleUserAnswer,
    continuous: true,
    interimResults: true,
  });

  const speechSynthesis = useSpeechSynthesis({ rate: 0.9 });

  async function handleUserAnswer(answer: string) {
    if (!currentQuestion) return;

    // Add user's answer to transcript
    const userItem: TranscriptItem = {
      id: `user-${Date.now()}`,
      speaker: 'user',
      text: answer,
      timestamp: new Date(),
    };
    
    const history = transcript.slice(-8).map((item) => ({
      speaker: item.speaker,
      text: item.text,
    }));

    // Generate feedback using backend evaluator (falls back locally if needed)
    const { feedback, interviewerResponse: aiResponse } = await evaluateAnswerWithBackend({
      answer,
      currentQuestion,
      interviewType,
      history,
    });
    
    if (feedback.grammarCorrection) {
      userItem.grammarCorrection = feedback.grammarCorrection;
    }

    setTranscript(prev => [...prev, userItem]);
    setLastFeedback({
      improved: feedback.improvedVersion,
      suggestions: feedback.suggestions,
    });

    // Add AI response to transcript
    setTimeout(() => {
      const aiItem: TranscriptItem = {
        id: `ai-${Date.now()}`,
        speaker: 'ai',
        text: aiResponse,
        timestamp: new Date(),
      };
      setTranscript(prev => [...prev, aiItem]);
      
      // Speak the response
      speechSynthesis.speak(aiResponse);
    }, 500);
  }

  function startSession() {
    // Reset asked questions for this session
    resetAskedQuestions();
    
    setIsSessionActive(true);
    setTranscript([]);
    setShowHint(false);
    setShowSampleAnswer(false);
    setLastFeedback(null);
    
    // Get first question
    const question = interviewType === 'technical' ? buildTechnicalQuestion() : getRandomQuestion(interviewType);
    setCurrentQuestion(question);
    
    // Add greeting and question to transcript
    const selectedFocus = technicalTopic === 'custom'
      ? (customTechnicalTopic || 'custom topic')
      : technicalTopic;
    const focusText = interviewType === 'technical'
      ? ` We will focus on ${selectedFocus}${technicalVersion ? ` (${technicalVersion})` : ''}.`
      : '';
    const greeting = `Hello! I'll be your ${interviewType === 'hr' ? 'HR' : 'Technical'} interviewer today.${focusText} Let's begin with your first question.`;
    
    const greetingItem: TranscriptItem = {
      id: 'ai-greeting',
      speaker: 'ai',
      text: greeting,
      timestamp: new Date(),
    };
    
    setTranscript([greetingItem]);
    speechSynthesis.speak(greeting);
    
    // Ask the question after greeting
    setTimeout(() => {
      const questionItem: TranscriptItem = {
        id: `ai-q-${question.id}`,
        speaker: 'ai',
        text: question.question,
        timestamp: new Date(),
      };
      setTranscript(prev => [...prev, questionItem]);
      speechSynthesis.speak(question.question);
    }, 3000);
  }

  function endSession() {
    setIsSessionActive(false);
    speechRecognition.stopListening();
    speechSynthesis.stop();
  }

  function nextQuestion() {
    setShowHint(false);
    setShowSampleAnswer(false);
    setLastFeedback(null);
    
    const question = interviewType === 'technical' ? buildTechnicalQuestion() : getRandomQuestion(interviewType);
    setCurrentQuestion(question);
    
    const questionItem: TranscriptItem = {
      id: `ai-q-${question.id}`,
      speaker: 'ai',
      text: question.question,
      timestamp: new Date(),
    };
    setTranscript(prev => [...prev, questionItem]);
    speechSynthesis.speak(question.question);
  }

  function requestHint() {
    if (!currentQuestion?.hint) return;
    setShowHint(true);
    
    const hintText = `Here's a hint: ${currentQuestion.hint}`;
    const hintItem: TranscriptItem = {
      id: `ai-hint-${Date.now()}`,
      speaker: 'ai',
      text: hintText,
      timestamp: new Date(),
    };
    setTranscript(prev => [...prev, hintItem]);
    speechSynthesis.speak(hintText);
  }

  function requestSampleAnswer() {
    if (!currentQuestion?.sampleAnswer) return;
    setShowSampleAnswer(true);
    
    const sampleText = `Here's a sample answer: ${currentQuestion.sampleAnswer}`;
    const sampleItem: TranscriptItem = {
      id: `ai-sample-${Date.now()}`,
      speaker: 'ai',
      text: sampleText,
      timestamp: new Date(),
    };
    setTranscript(prev => [...prev, sampleItem]);
    speechSynthesis.speak(sampleText);
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      speechSynthesis.stop();
      speechRecognition.stopListening();
    };
  }, []);

  if (!speechRecognition.isSupported) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-destructive mb-4">
              Speech recognition is not supported in your browser.
            </p>
            <p className="text-muted-foreground text-sm">
              Please use Chrome, Edge, or Safari for voice features.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col lg:flex-row gap-6">
      {/* Main Interview Area */}
      <div className="flex-1 flex flex-col gap-6">
        {/* Interview Type Selection */}
        {!isSessionActive && (
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle>Select Interview Type</CardTitle>
              <CardDescription>
                Choose the type of interview you want to practice
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={interviewType} onValueChange={(v) => setInterviewType(v as InterviewType)}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="hr">HR Interview</TabsTrigger>
                  <TabsTrigger value="technical">Technical Interview</TabsTrigger>
                </TabsList>
                <TabsContent value="hr" className="mt-4">
                  <p className="text-muted-foreground text-sm">
                    Practice common HR questions like "Tell me about yourself", 
                    behavioral questions, and questions about your career goals.
                  </p>
                </TabsContent>
                <TabsContent value="technical" className="mt-4">
                  <div className="space-y-4">
                    <p className="text-muted-foreground text-sm">
                      Practice technical questions by topic. Pick a focus area, choose a version if you want, and the interview will ask follow-up questions based on your answer.
                    </p>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Technical Topic</Label>
                        <select
                          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                          value={technicalTopic}
                          onChange={(e) => setTechnicalTopic(e.target.value as TechnicalTopic)}
                        >
                          <option value="react">React</option>
                          <option value="javascript">JavaScript</option>
                          <option value="node">Node.js</option>
                          <option value="typescript">TypeScript</option>
                          <option value="system-design">System Design</option>
                          <option value="custom">Custom Topic</option>
                        </select>
                      </div>

                      <div className="space-y-2">
                        <Label>Version / Focus</Label>
                        <Input
                          value={technicalVersion}
                          onChange={(e) => setTechnicalVersion(e.target.value)}
                          placeholder="React 18, Node 20, ES2022..."
                        />
                      </div>
                    </div>

                    {technicalTopic === 'custom' && (
                      <div className="space-y-2">
                        <Label>Custom Topic</Label>
                        <Input
                          value={customTechnicalTopic}
                          onChange={(e) => setCustomTechnicalTopic(e.target.value)}
                          placeholder="Example: Redux, Next.js, API security"
                        />
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
              
              <Button 
                className="w-full mt-6 btn-gradient" 
                size="lg"
                onClick={startSession}
              >
                <Play className="mr-2 h-5 w-5" />
                Start Interview Session
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Active Session */}
        {isSessionActive && (
          <>
            {/* Current Question Display */}
            <Card className="card-elevated">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Current Question</CardTitle>
                  <span className={cn(
                    "px-2 py-1 text-xs rounded-full",
                    currentQuestion?.difficulty === 'easy' && "bg-success/10 text-success",
                    currentQuestion?.difficulty === 'medium' && "bg-warning/10 text-warning",
                    currentQuestion?.difficulty === 'hard' && "bg-destructive/10 text-destructive",
                  )}>
                    {currentQuestion?.difficulty}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-medium">{currentQuestion?.question}</p>
                
                {/* Help Buttons */}
                <div className="flex gap-2 mt-4">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={requestHint}
                    disabled={showHint}
                  >
                    <Lightbulb className="mr-2 h-4 w-4" />
                    Get Hint
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={requestSampleAnswer}
                    disabled={showSampleAnswer}
                  >
                    <MessageSquare className="mr-2 h-4 w-4" />
                    Sample Answer
                  </Button>
                </div>
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
                    <div className="flex-1 text-left">
                      <p className="text-sm font-semibold">AI Interviewer</p>
                      <p className="text-xs text-muted-foreground">
                        {speechSynthesis.isSpeaking ? 'Speaking naturally...' : 'Ready to ask the next question.'}
                      </p>
                    </div>
                  </div>

                  {/* Voice Wave Visualization */}
                  <div className="h-16 flex items-center justify-center">
                    <VoiceWave isActive={speechRecognition.isListening || speechSynthesis.isSpeaking} />
                  </div>
                  
                  {/* Status Text */}
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

                  {/* Live Transcript */}
                  {speechRecognition.transcript && (
                    <div className="w-full p-3 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground">You're saying:</p>
                      <p className="text-foreground">{speechRecognition.transcript}</p>
                    </div>
                  )}

                  {/* Control Buttons */}
                  <div className="flex gap-4">
                    <Button
                      size="lg"
                      variant={speechRecognition.isListening ? "destructive" : "default"}
                      className={cn(
                        "w-16 h-16 rounded-full",
                        !speechRecognition.isListening && "btn-gradient"
                      )}
                      onClick={speechRecognition.isListening ? speechRecognition.stopListening : speechRecognition.startListening}
                      disabled={speechSynthesis.isSpeaking}
                    >
                      {speechRecognition.isListening ? (
                        <MicOff className="h-6 w-6" />
                      ) : (
                        <Mic className="h-6 w-6" />
                      )}
                    </Button>
                  </div>

                  {/* Session Controls */}
                  <div className="flex gap-2 w-full">
                    <Button 
                      variant="outline" 
                      className="flex-1"
                      onClick={nextQuestion}
                      disabled={speechRecognition.isListening || speechSynthesis.isSpeaking}
                    >
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Next Question
                    </Button>
                    <Button 
                      variant="destructive" 
                      className="flex-1"
                      onClick={endSession}
                    >
                      <Square className="mr-2 h-4 w-4" />
                      End Session
                    </Button>
                  </div>
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
                    <p className="text-sm font-medium text-muted-foreground mb-1">Improved Version:</p>
                    <p className="text-sm bg-accent/10 p-3 rounded-lg">{lastFeedback.improved}</p>
                  </div>
                  {lastFeedback.suggestions.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">Suggestions:</p>
                      <ul className="list-disc list-inside text-sm space-y-1">
                        {lastFeedback.suggestions.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>

      {/* Transcript Sidebar */}
      <div className="lg:w-80 xl:w-96">
        <InterviewTranscriptPanel items={transcript} className="h-[calc(100vh-12rem)]" />
      </div>
    </div>
  );
}
