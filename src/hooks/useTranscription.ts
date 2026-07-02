/**
 * LiveKit Transcription Hook with Data Channel
 * Uses Web Speech API for local transcription and LiveKit data channel to share transcripts
 * 
 * How it works:
 * 1. Each participant transcribes their own speech using Web Speech API
 * 2. Transcripts are sent to all participants via LiveKit data channel
 * 3. All participants see everyone's transcripts in real-time
 * 
 * Browser Support:
 * - Chrome/Edge: Full support ✅
 * - Safari: Partial support (iOS 14.5+) ⚠️
 * - Firefox: Not supported ❌
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { Room, RemoteParticipant, DataPacket_Kind } from 'livekit-client';

export interface Transcript {
  sessionId: string;
  speaker: string;
  speakerId: string;
  text: string;
  timestamp: string;
  isFinal: boolean;
}

export interface ParticipantInfo {
  id: string;
  name: string;
  isLocal: boolean;
}

interface UseTranscriptionProps {
  room: Room | undefined;
  enabled: boolean;
}

interface UseTranscriptionReturn {
  transcripts: Transcript[];
  participants: ParticipantInfo[];
  isTranscribing: boolean;
  error: string | null;
  startTranscription: () => void;
  stopTranscription: () => void;
  clearTranscripts: () => void;
}

interface TranscriptMessage {
  type: 'transcript';
  speaker: string;
  speakerId: string;
  text: string;
  timestamp: string;
}

export function useTranscription({
  room,
  enabled
}: UseTranscriptionProps): UseTranscriptionReturn {
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [participants, setParticipants] = useState<ParticipantInfo[]>([]);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const recognitionRef = useRef<any>(null);
  const sessionIdRef = useRef<string>(Date.now().toString());
  const shouldBeRunningRef = useRef<boolean>(false);
  const lastTranscriptRef = useRef<string>('');
  const lastActivityRef = useRef<number>(Date.now());
  const healthCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const interimTranscriptRef = useRef<string>('');
  const finalizeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Send transcript to all participants via data channel
  const broadcastTranscript = useCallback((text: string) => {
    if (!room || !text.trim()) return;

    const speaker = room.localParticipant?.name || room.localParticipant?.identity || 'Unknown';
    const speakerId = room.localParticipant?.identity || 'local';

    const message: TranscriptMessage = {
      type: 'transcript',
      speaker,
      speakerId,
      text: text.trim(),
      timestamp: new Date().toISOString(),
    };

    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(JSON.stringify(message));
      room.localParticipant?.publishData(data, { reliable: true });
      console.log('📤 Broadcast transcript:', text.substring(0, 50));
    } catch (error) {
      console.error('❌ Failed to broadcast transcript:', error);
    }
  }, [room]);

  // Handle incoming transcripts from other participants
  useEffect(() => {
    if (!room) return;

    const handleDataReceived = (
      payload: Uint8Array,
      participant?: RemoteParticipant
    ) => {
      try {
        const decoder = new TextDecoder();
        const text = decoder.decode(payload);
        const message: TranscriptMessage = JSON.parse(text);

        if (message.type === 'transcript') {
          const newTranscript: Transcript = {
            sessionId: sessionIdRef.current,
            speaker: message.speaker,
            speakerId: message.speakerId,
            text: message.text,
            timestamp: message.timestamp,
            isFinal: true,
          };

          console.log('📥 Received transcript from', message.speaker, ':', message.text.substring(0, 50));
          setTranscripts((prev) => [...prev, newTranscript]);
        }
      } catch (error) {
        console.error('❌ Failed to parse data message:', error);
      }
    };

    room.on('dataReceived', handleDataReceived);

    return () => {
      room.off('dataReceived', handleDataReceived);
    };
  }, [room]);

  // Update participants list when room changes
  useEffect(() => {
    if (!room) {
      setParticipants([]);
      return;
    }

    const updateParticipants = () => {
      const participantList: ParticipantInfo[] = [];

      // Add local participant
      if (room.localParticipant) {
        participantList.push({
          id: room.localParticipant.identity,
          name: room.localParticipant.name || room.localParticipant.identity,
          isLocal: true
        });
      }

      // Add remote participants
      room.remoteParticipants.forEach((participant: RemoteParticipant) => {
        participantList.push({
          id: participant.identity,
          name: participant.name || participant.identity,
          isLocal: false
        });
      });

      setParticipants(participantList);
    };

    // Initial update
    updateParticipants();

    // Listen for participant changes
    room.on('participantConnected', updateParticipants);
    room.on('participantDisconnected', updateParticipants);

    return () => {
      room.off('participantConnected', updateParticipants);
      room.off('participantDisconnected', updateParticipants);
    };
  }, [room]);

  // Initialize Speech Recognition
  const initializeSpeechRecognition = useCallback(() => {
    // Check if browser supports speech recognition
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setError('Speech recognition not supported in this browser. Please use Chrome or Edge.');
      return null;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      console.log('🎤 Speech recognition started');
      setIsTranscribing(true);
      setError(null);
      lastActivityRef.current = Date.now();
    };

    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';

      // Collect all results
      for (let i = 0; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';
        } else {
          interimTranscript += transcript;
        }
      }

      // Update interim transcript for display (optional - could show live typing)
      if (interimTranscript) {
        interimTranscriptRef.current = interimTranscript.trim();
      }

      // Handle final transcript with debouncing
      if (finalTranscript.trim()) {
        const newText = finalTranscript.trim();
        
        // Clear any pending finalization
        if (finalizeTimeoutRef.current) {
          clearTimeout(finalizeTimeoutRef.current);
        }

        // Accumulate text
        if (interimTranscriptRef.current) {
          interimTranscriptRef.current += ' ' + newText;
        } else {
          interimTranscriptRef.current = newText;
        }

        // Wait 2 seconds of silence before finalizing
        finalizeTimeoutRef.current = setTimeout(() => {
          const completeText = interimTranscriptRef.current.trim();
          
          if (!completeText || completeText === lastTranscriptRef.current) {
            return;
          }

          lastTranscriptRef.current = completeText;
          lastActivityRef.current = Date.now();

          // Get speaker info
          let speaker = 'You';
          let speakerId = 'local';
          if (room?.localParticipant) {
            speaker = room.localParticipant.name || room.localParticipant.identity || 'You';
            speakerId = room.localParticipant.identity;
          }

          // Add to local transcripts
          const newTranscript: Transcript = {
            sessionId: sessionIdRef.current,
            speaker: speaker,
            speakerId: speakerId,
            text: completeText,
            timestamp: new Date().toISOString(),
            isFinal: true
          };

          console.log('📝 Final transcript (local):', completeText);
          setTranscripts((prev) => [...prev, newTranscript]);

          // Broadcast to other participants
          broadcastTranscript(completeText);

          // Clear interim
          interimTranscriptRef.current = '';
        }, 2000); // Wait 2 seconds after last speech
      }
    };

    recognition.onerror = (event: any) => {
      console.error('❌ Speech recognition error:', event.error);
      
      if (event.error === 'no-speech') {
        console.log('No speech detected, continuing...');
        // Don't show error for no-speech, just continue
        return;
      } else if (event.error === 'aborted') {
        console.log('Speech recognition aborted, will restart...');
        return;
      } else if (event.error === 'not-allowed') {
        setError('Microphone access denied. Please allow microphone permissions.');
        setIsTranscribing(false);
        shouldBeRunningRef.current = false;
      } else if (event.error === 'network') {
        console.log('Network error, will retry...');
      } else {
        console.log(`Speech recognition error: ${event.error}, will retry...`);
      }
    };

    recognition.onend = () => {
      console.log('🛑 Speech recognition ended');
      
      // Auto-restart if it should be running
      if (shouldBeRunningRef.current) {
        console.log('🔄 Restarting speech recognition...');
        setTimeout(() => {
          try {
            recognition.start();
          } catch (error) {
            console.error('Failed to restart recognition:', error);
          }
        }, 100);
      } else {
        setIsTranscribing(false);
      }
    };

    return recognition;
  }, [room, broadcastTranscript]);

  // Start transcription
  const startTranscription = useCallback(() => {
    if (recognitionRef.current || !enabled) {
      console.log('⚠️ Transcription already running or not enabled');
      return;
    }

    console.log('🚀 Starting transcription with Web Speech API...');

    const recognition = initializeSpeechRecognition();
    if (!recognition) {
      return;
    }

    recognitionRef.current = recognition;
    shouldBeRunningRef.current = true;
    lastActivityRef.current = Date.now();

    try {
      recognition.start();
      console.log('✅ Speech recognition started successfully');
    } catch (error: any) {
      console.error('❌ Failed to start speech recognition:', error);
      if (error.message && error.message.includes('already started')) {
        console.log('Speech recognition is already running');
        setIsTranscribing(true);
      } else {
        setError(`Failed to start speech recognition: ${error.message}`);
        shouldBeRunningRef.current = false;
      }
    }

    // Health check: restart if no activity for 30 seconds
    if (healthCheckIntervalRef.current) {
      clearInterval(healthCheckIntervalRef.current);
    }
    
    healthCheckIntervalRef.current = setInterval(() => {
      const timeSinceActivity = Date.now() - lastActivityRef.current;
      
      if (shouldBeRunningRef.current && timeSinceActivity > 30000) {
        console.log('⚠️ No activity for 30s, restarting speech recognition...');
        if (recognitionRef.current) {
          try {
            recognitionRef.current.stop();
            setTimeout(() => {
              if (shouldBeRunningRef.current && recognitionRef.current) {
                recognitionRef.current.start();
                lastActivityRef.current = Date.now();
              }
            }, 500);
          } catch (error) {
            console.error('Failed to restart recognition:', error);
          }
        }
      }
    }, 10000); // Check every 10 seconds
  }, [enabled, initializeSpeechRecognition]);

  // Stop transcription
  const stopTranscription = useCallback(() => {
    console.log('🛑 Stopping transcription...');
    shouldBeRunningRef.current = false;

    if (healthCheckIntervalRef.current) {
      clearInterval(healthCheckIntervalRef.current);
      healthCheckIntervalRef.current = null;
    }

    if (finalizeTimeoutRef.current) {
      clearTimeout(finalizeTimeoutRef.current);
      finalizeTimeoutRef.current = null;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
        recognitionRef.current = null;
        setIsTranscribing(false);
        console.log('✅ Speech recognition stopped');
      } catch (error) {
        console.error('❌ Error stopping speech recognition:', error);
      }
    }
  }, []);

  // Clear transcripts
  const clearTranscripts = useCallback(() => {
    console.log('🗑️ Clearing transcripts...');
    setTranscripts([]);
    lastTranscriptRef.current = '';
    interimTranscriptRef.current = '';
    if (finalizeTimeoutRef.current) {
      clearTimeout(finalizeTimeoutRef.current);
      finalizeTimeoutRef.current = null;
    }
  }, []);

  // Auto-start when enabled and room is ready
  useEffect(() => {
    if (enabled && room) {
      // Wait a bit for room to be fully connected
      const timer = setTimeout(() => {
        console.log('🎯 Room ready, starting transcription...');
        startTranscription();
      }, 1000);

      return () => {
        clearTimeout(timer);
        stopTranscription();
      };
    }

    return () => {
      stopTranscription();
    };
  }, [enabled, room, startTranscription, stopTranscription]);

  return {
    transcripts,
    participants,
    isTranscribing,
    error,
    startTranscription,
    stopTranscription,
    clearTranscripts
  };
}
