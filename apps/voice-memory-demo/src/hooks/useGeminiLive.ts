'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';

interface Conversation {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  isFinal?: boolean;
  status?: 'speaking' | 'processing' | 'final';
}

interface UseGeminiLiveReturn {
  status: string;
  error: string | null;
  isSessionActive: boolean;
  startSession: () => Promise<void>;
  stopSession: () => void;
  conversation: Conversation[];
  isMuted: boolean;
  toggleMute: () => void;
  resetConversation: () => void;
}

export function useGeminiLive(
  deploymentId: string,
  userCookie: string,
  onToolCall?: (name: string, args: Record<string, unknown>) => Promise<unknown>
): UseGeminiLiveReturn {
  const [status, setStatus] = useState<string>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const [isSessionActive, setIsSessionActive] = useState<boolean>(false);
  const [conversation, setConversation] = useState<Conversation[]>([]);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioWorkletNodeRef = useRef<AudioWorkletNode | null>(null);
  const audioQueueRef = useRef<Int16Array[]>([]);
  const isPlayingRef = useRef<boolean>(false);

  // Transcription buffers
  const userTranscriptionBufferRef = useRef<string>('');
  const assistantTranscriptionBufferRef = useRef<string>('');

  // Cleanup function
  const cleanup = useCallback(() => {
    console.log('[Gemini] Cleaning up session');

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    if (audioWorkletNodeRef.current) {
      audioWorkletNodeRef.current.disconnect();
      audioWorkletNodeRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (sessionRef.current) {
      try {
        sessionRef.current.close();
      } catch (err) {
        console.error('[Gemini] Error closing session:', err);
      }
      sessionRef.current = null;
    }

    audioQueueRef.current = [];
    isPlayingRef.current = false;
    userTranscriptionBufferRef.current = '';
    assistantTranscriptionBufferRef.current = '';

    setIsSessionActive(false);
    setStatus('disconnected');
    setConversation(prev => prev.filter(msg => msg.isFinal !== false));
  }, []);

  // Play audio buffer
  const playAudioBuffer = useCallback(async (audioData: Int16Array) => {
    if (!audioContextRef.current) return;

    try {
      const float32Data = new Float32Array(audioData.length);
      for (let i = 0; i < audioData.length; i++) {
        float32Data[i] = audioData[i] / 32768.0;
      }

      const audioBuffer = audioContextRef.current.createBuffer(1, float32Data.length, 24000);
      audioBuffer.getChannelData(0).set(float32Data);

      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);

      return new Promise<void>((resolve) => {
        source.onended = () => resolve();
        source.start(0);
      });
    } catch (err) {
      console.error('[Gemini] Error playing audio:', err);
    }
  }, []);

  // Process audio queue
  const processAudioQueue = useCallback(async () => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) {
      return;
    }

    isPlayingRef.current = true;

    while (audioQueueRef.current.length > 0) {
      const audioChunk = audioQueueRef.current.shift();
      if (audioChunk) {
        await playAudioBuffer(audioChunk);
      }
    }

    isPlayingRef.current = false;
  }, [playAudioBuffer]);

  // Start session
  const startSession = useCallback(async () => {
    if (isSessionActive) {
      console.log('[Gemini] Session already active');
      return;
    }

    try {
      setStatus('connecting');
      setError(null);

      // Fetch session config from our API
      const sessionResponse = await fetch('/api/session/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deploymentId, userCookie }),
      });

      if (!sessionResponse.ok) {
        const errData = await sessionResponse.json();
        throw new Error(errData.error || 'Failed to get session config');
      }

      const sessionConfig = await sessionResponse.json();
      console.log('[Gemini] Got session config:', sessionConfig.model);

      // Initialize Google GenAI
      const ai = new GoogleGenAI({ apiKey: sessionConfig.apiKey });

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      mediaStreamRef.current = stream;

      // Set up audio context
      audioContextRef.current = new AudioContext({ sampleRate: 24000 });
      await audioContextRef.current.audioWorklet.addModule('/audio-processor.js');

      const micAudioContext = new AudioContext({ sampleRate: 16000 });
      await micAudioContext.audioWorklet.addModule('/audio-processor.js');

      const source = micAudioContext.createMediaStreamSource(stream);
      audioWorkletNodeRef.current = new AudioWorkletNode(micAudioContext, 'audio-capture-processor');
      source.connect(audioWorkletNodeRef.current);

      setStatus('connecting to gemini');

      // Connect to Gemini Live
      const session = await ai.live.connect({
        model: sessionConfig.model,
        config: sessionConfig.config,
        callbacks: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onmessage: async (message: any) => {
            // Handle audio data
            if (message.data) {
              try {
                const buffer = typeof message.data === 'string'
                  ? Buffer.from(message.data, 'base64')
                  : message.data;
                const int16Array = new Int16Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 2);
                audioQueueRef.current.push(int16Array);
                processAudioQueue();
              } catch (err) {
                console.error('[Gemini] Error processing audio data:', err);
              }
            }

            // Handle user input transcription
            if (message.serverContent?.inputTranscription?.text) {
              const chunk = message.serverContent.inputTranscription.text;
              userTranscriptionBufferRef.current += chunk;

              setConversation(prev => {
                const existing = prev.find(msg => msg.role === 'user' && !msg.isFinal);
                if (existing) {
                  return prev.map(msg =>
                    msg.id === existing.id
                      ? { ...msg, text: userTranscriptionBufferRef.current }
                      : msg
                  );
                }
                return [
                  ...prev,
                  {
                    id: `user-speaking-${Date.now()}`,
                    role: 'user',
                    text: userTranscriptionBufferRef.current,
                    timestamp: new Date().toISOString(),
                    isFinal: false,
                    status: 'speaking',
                  }
                ];
              });
            }

            // Handle assistant output transcription
            if (message.serverContent?.outputTranscription?.text) {
              const chunk = message.serverContent.outputTranscription.text;
              assistantTranscriptionBufferRef.current += chunk;

              setConversation(prev => {
                const existing = prev.find(msg => msg.role === 'assistant' && !msg.isFinal);
                if (existing) {
                  return prev.map(msg =>
                    msg.id === existing.id
                      ? { ...msg, text: assistantTranscriptionBufferRef.current }
                      : msg
                  );
                }
                return [
                  ...prev,
                  {
                    id: `assistant-speaking-${Date.now()}`,
                    role: 'assistant',
                    text: assistantTranscriptionBufferRef.current,
                    timestamp: new Date().toISOString(),
                    isFinal: false,
                    status: 'speaking',
                  }
                ];
              });
            }

            // Handle turn complete
            if (message.serverContent?.turnComplete) {
              // Finalize user message
              const finalUserText = userTranscriptionBufferRef.current.trim();
              if (finalUserText) {
                const newUserMessage: Conversation = {
                  id: crypto.randomUUID(),
                  role: 'user',
                  text: finalUserText,
                  timestamp: new Date().toISOString(),
                  isFinal: true,
                  status: 'final',
                };
                setConversation(prev => {
                  const withoutSpeaking = prev.filter(msg => !(msg.role === 'user' && !msg.isFinal));
                  return [...withoutSpeaking, newUserMessage];
                });
                userTranscriptionBufferRef.current = '';
              }

              // Finalize assistant message
              const finalAssistantText = assistantTranscriptionBufferRef.current.trim();
              if (finalAssistantText) {
                const newAssistantMessage: Conversation = {
                  id: crypto.randomUUID(),
                  role: 'assistant',
                  text: finalAssistantText,
                  timestamp: new Date().toISOString(),
                  isFinal: true,
                  status: 'final',
                };
                setConversation(prev => {
                  const withoutSpeaking = prev.filter(msg => !(msg.role === 'assistant' && !msg.isFinal));
                  return [...withoutSpeaking, newAssistantMessage];
                });
                assistantTranscriptionBufferRef.current = '';
              }
            }

            // Handle tool calls
            if (message.toolCall?.functionCalls && onToolCall) {
              console.log('[Gemini] Tool calls received:', message.toolCall.functionCalls);

              // Finalize any existing assistant speech before tool execution
              // This prevents duplicate responses when the AI speaks before and after tool calls
              const existingText = assistantTranscriptionBufferRef.current.trim();
              if (existingText) {
                setConversation(prev => {
                  const withoutSpeaking = prev.filter(msg => !(msg.role === 'assistant' && !msg.isFinal));
                  return [...withoutSpeaking, {
                    id: crypto.randomUUID(),
                    role: 'assistant',
                    text: existingText,
                    timestamp: new Date().toISOString(),
                    isFinal: true,
                    status: 'final',
                  }];
                });
                assistantTranscriptionBufferRef.current = '';
              }

              const responses = [];
              for (const call of message.toolCall.functionCalls) {
                try {
                  const result = await onToolCall(call.name, call.args || {});
                  responses.push({
                    id: call.id,
                    name: call.name,
                    response: { result: JSON.stringify(result) },
                  });
                  console.log('[Gemini] Tool result:', call.name, result);
                } catch (err) {
                  console.error('[Gemini] Tool error:', err);
                  responses.push({
                    id: call.id,
                    name: call.name,
                    response: { error: String(err) },
                  });
                }
              }

              // Send tool responses back to Gemini
              await session.sendToolResponse({
                functionResponses: responses,
              });
            }
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onerror: (err: any) => {
            console.error('[Gemini] Session error:', err);
            setError(err.message || 'Session error');
            setStatus('error');
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onclose: (event: any) => {
            console.log('[Gemini] Session closed:', event?.reason);
            cleanup();
          },
        },
      });

      sessionRef.current = session;
      setIsSessionActive(true);
      setStatus('connected');

      // Handle audio from microphone
      audioWorkletNodeRef.current.port.onmessage = async (event) => {
        if (!sessionRef.current) return;

        const audioData = event.data;
        if (audioData?.data && audioData.type === 'audio') {
          try {
            // Convert ArrayBuffer to Int16Array
            const int16Array = new Int16Array(audioData.data);

            // Convert to base64
            const uint8Array = new Uint8Array(int16Array.buffer);
            let binary = '';
            for (let i = 0; i < uint8Array.length; i++) {
              binary += String.fromCharCode(uint8Array[i]);
            }
            const base64Audio = btoa(binary);

            // Send to Gemini
            await sessionRef.current.sendRealtimeInput({
              audio: {
                data: base64Audio,
                mimeType: 'audio/pcm;rate=16000',
              },
            });
          } catch (err) {
            console.error('[Gemini] Error sending audio:', err);
          }
        }
      };

      console.log('[Gemini] Session started successfully');
    } catch (err) {
      console.error('[Gemini] Error starting session:', err);
      if (err instanceof Error && (err.name === 'NotAllowedError' || err.message.includes('Permission denied'))) {
        setError('Microphone permission denied. Please allow microphone access.');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to start session');
      }
      setStatus('error');
      cleanup();
    }
  }, [deploymentId, userCookie, isSessionActive, cleanup, processAudioQueue, onToolCall]);

  // Stop session
  const stopSession = useCallback(() => {
    cleanup();
  }, [cleanup]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (mediaStreamRef.current) {
      const audioTracks = mediaStreamRef.current.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(prev => !prev);
    }
  }, []);

  // Reset conversation
  const resetConversation = useCallback(() => {
    setConversation([]);
    userTranscriptionBufferRef.current = '';
    assistantTranscriptionBufferRef.current = '';
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    status,
    error,
    isSessionActive,
    startSession,
    stopSession,
    conversation,
    isMuted,
    toggleMute,
    resetConversation,
  };
}
