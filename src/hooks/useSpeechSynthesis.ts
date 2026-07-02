import { useState, useCallback, useRef, useEffect } from 'react';

interface UseSpeechSynthesisOptions {
  rate?: number;
  pitch?: number;
  volume?: number;
  voice?: SpeechSynthesisVoice | null;
}

interface SpeechSynthesisHook {
  isSpeaking: boolean;
  speakText: (text: string, options?: { interrupt?: boolean }) => Promise<void>;
  stopSpeaking: () => void;
  speak: (text: string) => void;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  isSupported: boolean;
  voices: SpeechSynthesisVoice[];
  isReady: boolean;
}

export function useSpeechSynthesis(options: UseSpeechSynthesisOptions = {}): SpeechSynthesisHook {
  const { rate = 1, pitch = 1, volume = 1, voice = null } = options;
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isReady, setIsReady] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const activeRequestIdRef = useRef(0);

  const isSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  const selectPreferredVoice = useCallback((): SpeechSynthesisVoice | null => {
    if (!voices.length && !voice) return null;

    return (
      voice ||
      voices.find(v => /Davis|Guy|Ryan|David|James|Christopher|Aria|Jenny|Sara/i.test(v.name)) ||
      voices.find(v => /Google|Microsoft|Natural|Neural|Samantha|Daniel|Ava|Aria/i.test(v.name)) ||
      voices.find(v => v.lang.startsWith('en-US')) ||
      voices.find(v => v.lang.startsWith('en')) ||
      voices[0] ||
      null
    );
  }, [voice, voices]);

  const waitForVoices = useCallback(async () => {
    if (!isSupported) return;

    if (speechSynthesis.getVoices().length > 0) {
      setIsReady(true);
      return;
    }

    await new Promise<void>((resolve) => {
      const timeout = window.setTimeout(() => resolve(), 1200);
      const handleVoices = () => {
        window.clearTimeout(timeout);
        resolve();
      };

      speechSynthesis.addEventListener('voiceschanged', handleVoices, { once: true });
    });

    setIsReady(true);
  }, [isSupported]);

  const performSpeak = useCallback(async (text: string, requestId: number, forceDefaultVoice = false) => {
    if (requestId !== activeRequestIdRef.current) return;

    return await new Promise<void>((resolve) => {
      speechSynthesis.cancel();
      speechSynthesis.resume();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = rate;
      utterance.pitch = pitch;
      utterance.volume = Math.min(1, Math.max(0, volume));
      utterance.lang = 'en-US';

      if (!forceDefaultVoice) {
        const preferredVoice = selectPreferredVoice();
        if (preferredVoice) {
          utterance.voice = preferredVoice;
        }
      }

      utterance.onstart = () => {
        if (requestId === activeRequestIdRef.current) {
          setIsSpeaking(true);
        }
      };
      utterance.onend = () => {
        if (requestId === activeRequestIdRef.current) {
          setIsSpeaking(false);
        }
        resolve();
      };
      utterance.onerror = () => {
        if (requestId === activeRequestIdRef.current) {
          setIsSpeaking(false);
        }

        // Retry once with default voice if custom voice failed.
        if (!forceDefaultVoice && requestId === activeRequestIdRef.current) {
          setTimeout(() => {
            void performSpeak(text, requestId, true).then(() => resolve());
          }, 150);
          return;
        }

        resolve();
      };

      utteranceRef.current = utterance;
      speechSynthesis.speak(utterance);

      // Fallback: if browser never starts speaking, retry with default voice.
      if (!forceDefaultVoice) {
        window.setTimeout(() => {
          if (requestId === activeRequestIdRef.current && !speechSynthesis.speaking) {
            void performSpeak(text, requestId, true).then(() => resolve());
          }
        }, 1200);
      }
    });
  }, [pitch, rate, selectPreferredVoice, volume]);

  // Load available voices
  useEffect(() => {
    if (!isSupported) return;

    const loadVoices = () => {
      const availableVoices = speechSynthesis.getVoices();
      setVoices(availableVoices);
      if (availableVoices.length > 0) {
        setIsReady(true);
      }
    };

    loadVoices();
    speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      speechSynthesis.onvoiceschanged = null;
    };
  }, [isSupported]);

  const speakText = useCallback(async (text: string, options?: { interrupt?: boolean }) => {
    console.log('🔊 speakText called with:', { 
      text: text.substring(0, 50), 
      isSupported, 
      interrupt: options?.interrupt,
      isSpeaking,
      isReady,
      voicesCount: voices.length
    });
    
    if (!isSupported) {
      console.error('❌ Speech synthesis NOT supported in this browser');
      return;
    }
    if (!text?.trim()) {
      console.warn('⚠️ Empty text provided to speakText');
      return;
    }

    const interrupt = options?.interrupt ?? true;
    if (interrupt) {
      activeRequestIdRef.current += 1;
      console.log('🔄 Interrupting previous speech, new requestId:', activeRequestIdRef.current);
    }

    const requestId = activeRequestIdRef.current;
    console.log('⏳ Waiting for voices...');
    await waitForVoices();
    console.log('✅ Voices ready, starting speech...');
    await performSpeak(text.trim(), requestId, false);
    console.log('✅ Speech completed');
  }, [isSupported, performSpeak, waitForVoices, isSpeaking, isReady, voices.length]);

  const speak = useCallback((text: string) => {
    void speakText(text, { interrupt: true });
  }, [speakText]);

  const stopSpeaking = useCallback(() => {
    if (!isSupported) return;
    activeRequestIdRef.current += 1;
    speechSynthesis.cancel();
    setIsSpeaking(false);
  }, [isSupported]);

  const stop = useCallback(() => {
    stopSpeaking();
  }, [stopSpeaking]);

  const pause = useCallback(() => {
    if (!isSupported) return;
    speechSynthesis.pause();
  }, [isSupported]);

  const resume = useCallback(() => {
    if (!isSupported) return;
    speechSynthesis.resume();
  }, [isSupported]);

  return {
    isSpeaking,
    speakText,
    stopSpeaking,
    speak,
    stop,
    pause,
    resume,
    isSupported,
    voices,
    isReady,
  };
}
