'use client';

import { useCallback, useState } from 'react';
import { useGeminiLive } from '@/hooks/useGeminiLive';
import { useUserCookie } from '@/hooks/useUserCookie';
import { MemoryPanel, QueryLog } from './MemoryPanel';

const DEPLOYMENT_ID = 'voice-memory-demo';

export function VoiceAgent() {
  const { userCookie, isLoading: cookieLoading, resetCookie } = useUserCookie(DEPLOYMENT_ID);
  const [queryLogs, setQueryLogs] = useState<QueryLog[]>([]);

  const handleToolCall = useCallback(async (name: string, args: Record<string, unknown>) => {
    console.log('Tool call:', name, args);

    if (name === 'agentMemory') {
      const response = await fetch('/api/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...args,
          deploymentId: DEPLOYMENT_ID,
          userCookie,
        }),
      });
      const data = await response.json();
      console.log('Memory operation result:', data);

      // Log the operation
      const operation = args.operation as string;
      const newLog: QueryLog = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        operation,
        key: args.key as string | undefined,
        value: args.value as string | undefined,
        query: args.query as string | undefined,
        results: data.result?.memories || (data.result?.value ? [{ key: args.key as string, value: data.result.value }] : undefined),
        isGlobal: data.result?.isGlobal,
        reasoning: data.result?.reasoning,
        pipeline: data.result?.pipeline,
        searchType: data.result?.searchType,
      };

      setQueryLogs(prev => [...prev, newLog]);

      return data.result;
    }

    return { error: 'Unknown tool' };
  }, [userCookie]);

  const {
    status,
    error,
    isSessionActive,
    startSession,
    stopSession,
    conversation,
    isMuted,
    toggleMute,
    resetConversation,
  } = useGeminiLive(DEPLOYMENT_ID, userCookie, handleToolCall);

  const handleResetConversation = useCallback(() => {
    resetConversation();
    setQueryLogs([]);
  }, [resetConversation]);

  if (cookieLoading || !userCookie) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="container mx-auto px-4 py-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Voice Memory Demo</h1>
          <p className="text-gray-400">
            A voice agent with persistent memory using Gemini Live + MongoDB
          </p>
          <div className="mt-2 text-sm text-gray-500">
            User ID: <code className="bg-gray-800 px-2 py-1 rounded">{userCookie.slice(0, 8)}...</code>
            <button
              onClick={resetCookie}
              className="ml-2 text-blue-400 hover:text-blue-300"
              title="Reset user identity"
            >
              (new identity)
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Voice Control Panel */}
          <div className="bg-gray-900 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Voice Agent</h2>

            {/* Status */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-3 h-3 rounded-full ${
                  isSessionActive
                    ? 'bg-green-500 animate-pulse'
                    : status === 'connecting' || status === 'connecting to gemini'
                    ? 'bg-yellow-500 animate-pulse'
                    : 'bg-gray-500'
                }`} />
                <span className="text-gray-300 capitalize">{status}</span>
              </div>
              {error && (
                <div className="text-red-400 text-sm mt-2">
                  Error: {error}
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="flex flex-wrap gap-3">
              {!isSessionActive ? (
                <button
                  onClick={startSession}
                  disabled={status === 'connecting' || status === 'connecting to gemini'}
                  className="px-6 py-3 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 rounded-lg font-medium transition-colors"
                >
                  {status === 'connecting' || status === 'connecting to gemini' ? 'Connecting...' : '🎤 Start Voice Session'}
                </button>
              ) : (
                <>
                  <button
                    onClick={toggleMute}
                    className={`px-6 py-3 ${isMuted ? 'bg-yellow-600 hover:bg-yellow-500' : 'bg-blue-600 hover:bg-blue-500'} rounded-lg font-medium transition-colors`}
                  >
                    {isMuted ? '🔇 Unmute' : '🎤 Mute'}
                  </button>
                  <button
                    onClick={stopSession}
                    className="px-6 py-3 bg-red-600 hover:bg-red-500 rounded-lg font-medium transition-colors"
                  >
                    ⏹ Stop Session
                  </button>
                </>
              )}
            </div>

            {/* Instructions */}
            <div className="mt-6 p-4 bg-gray-800 rounded-lg">
              <h3 className="font-medium mb-2">Try saying:</h3>
              <ul className="text-sm text-gray-400 space-y-1">
                <li>• &quot;My name is [your name]&quot;</li>
                <li>• &quot;I live in [city]&quot;</li>
                <li>• &quot;I prefer email over phone calls&quot;</li>
                <li>• &quot;What do you remember about me?&quot;</li>
                <li>• &quot;What&apos;s my name?&quot;</li>
              </ul>
            </div>

            {/* Conversation */}
            {conversation.length > 0 && (
              <div className="mt-6">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-medium">Conversation:</h3>
                  <button
                    onClick={handleResetConversation}
                    className="text-sm text-gray-500 hover:text-gray-400"
                  >
                    Clear
                  </button>
                </div>
                <div className="bg-gray-800 rounded-lg p-4 max-h-80 overflow-y-auto space-y-3">
                  {conversation.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] px-4 py-2 rounded-lg ${
                          msg.role === 'user'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-700 text-gray-200'
                        } ${!msg.isFinal ? 'opacity-70' : ''}`}
                      >
                        <p className="text-sm">{msg.text}</p>
                        {!msg.isFinal && (
                          <span className="text-xs opacity-50">
                            {msg.status === 'speaking' ? '...' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Memory Panel */}
          <div className="h-[600px]">
            <MemoryPanel
              deploymentId={DEPLOYMENT_ID}
              userCookie={userCookie}
              queryLogs={queryLogs}
            />
          </div>
        </div>

        {/* Info */}
        <div className="mt-8 p-6 bg-gray-900 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">How it works</h2>
          <div className="grid md:grid-cols-3 gap-6 text-sm text-gray-400">
            <div>
              <h3 className="text-white font-medium mb-2">🎙️ Voice Input</h3>
              <p>Your microphone audio is captured and sent to Gemini Live via WebSocket for real-time speech-to-speech interaction.</p>
            </div>
            <div>
              <h3 className="text-white font-medium mb-2">🧠 Memory Tool</h3>
              <p>The AI agent can store and retrieve memories using MongoDB. It decides what&apos;s worth remembering based on your conversation.</p>
            </div>
            <div>
              <h3 className="text-white font-medium mb-2">🔒 User Isolation</h3>
              <p>Each browser gets a unique ID. Private memories are scoped to your session, while global facts are shared across users.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
