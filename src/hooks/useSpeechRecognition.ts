import { useState, useEffect, useRef } from 'react';

interface UseSpeechRecognitionProps {
  onResult: (text: string) => void;
  continuous?: boolean;
  interimResults?: boolean;
  lang?: string;
}

export function useSpeechRecognition({
  onResult,
  continuous = true,
  interimResults = true,
  lang = 'en-US',
}: UseSpeechRecognitionProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef(false);
  const finalTranscriptRef = useRef('');

  const isSupported = typeof window !== 'undefined' &&
    Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  useEffect(() => {
    // Check if browser supports speech recognition
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn('Speech recognition not supported in this browser');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = continuous;
    recognition.interimResults = interimResults;
    recognition.lang = lang;

    recognition.onresult = (event: any) => {
      let finalTranscript = finalTranscriptRef.current;
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';
          finalTranscriptRef.current = finalTranscript;
        } else {
          interimTranscript += transcript;
        }
      }

      const currentTranscript = finalTranscript || interimTranscript;
      setTranscript(currentTranscript);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      // Don't stop on no-speech errors, just continue listening
      if (event.error === 'no-speech' && isListeningRef.current) {
        // Silently continue - this is just a pause in speech
        console.log('No speech detected, continuing to listen...');
      } else if (event.error === 'aborted') {
        // User manually stopped, don't restart
        console.log('Speech recognition aborted by user');
      } else if (isListeningRef.current) {
        // For other errors, try to restart
        setTimeout(() => {
          if (isListeningRef.current && recognitionRef.current) {
            try {
              recognition.start();
            } catch (e) {
              console.log('Could not restart recognition:', e);
            }
          }
        }, 100);
      }
    };

    recognition.onend = () => {
      console.log('Speech recognition ended');
      if (isListeningRef.current) {
        // Automatically restart recognition to continue listening
        setTimeout(() => {
          if (isListeningRef.current && recognitionRef.current) {
            try {
              recognition.start();
              console.log('Speech recognition restarted after pause');
            } catch (e) {
              console.log('Could not restart recognition:', e);
            }
          }
        }, 100);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        isListeningRef.current = false;
        recognitionRef.current.stop();
      }
    };
  }, [continuous, interimResults, lang, onResult]);

  const startListening = () => {
    if (!recognitionRef.current) {
      console.warn('⚠️ Speech recognition not available');
      return;
    }
    
    if (isListening) {
      console.log('⚠️ Speech recognition already running');
      return;
    }
    
    try {
      finalTranscriptRef.current = '';
      setTranscript('');
      recognitionRef.current.start();
      isListeningRef.current = true;
      setIsListening(true);
      console.log('🎤 Speech recognition started');
    } catch (error: any) {
      // Handle "already started" error gracefully
      if (error.message && error.message.includes('already started')) {
        console.log('🎤 Speech recognition already active');
        isListeningRef.current = true;
        setIsListening(true);
      } else {
        console.error('Error starting speech recognition:', error);
      }
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && (isListening || isListeningRef.current)) {
      isListeningRef.current = false;
      recognitionRef.current.stop();
      setIsListening(false);
      const finalText = finalTranscriptRef.current.trim() || transcript.trim();
      finalTranscriptRef.current = '';
      if (finalText) {
        onResult(finalText);
      }
      console.log('🎤 Speech recognition stopped');
    }
  };

  return {
    isListening,
    transcript,
    isSupported,
    startListening,
    stopListening,
  };
}