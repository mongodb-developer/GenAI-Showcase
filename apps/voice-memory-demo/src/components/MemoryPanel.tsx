'use client';

import { useState, useEffect, useCallback } from 'react';
import { Memory } from '@/lib/memory-service';

export interface QueryLog {
  id: string;
  timestamp: string;
  operation: string;
  query?: string;
  key?: string;
  value?: string;
  results?: Memory[];
  isGlobal?: boolean;
  reasoning?: string;
  pipeline?: object[];
  searchType?: 'hybrid' | 'text' | 'regex';
}

interface MemoryPanelProps {
  deploymentId: string;
  userCookie: string;
  queryLogs?: QueryLog[];
}

export function MemoryPanel({ deploymentId, userCookie, queryLogs = [] }: MemoryPanelProps) {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'memories' | 'queries'>('memories');

  const fetchMemories = useCallback(async () => {
    if (!deploymentId || !userCookie) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(
        `/api/memory?deploymentId=${encodeURIComponent(deploymentId)}&userCookie=${encodeURIComponent(userCookie)}`
      );
      const data = await response.json();
      
      if (data.memories) {
        setMemories(data.memories);
      } else if (data.error) {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to fetch memories');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [deploymentId, userCookie]);

  useEffect(() => {
    fetchMemories();
    // Poll for updates every 5 seconds
    const interval = setInterval(fetchMemories, 5000);
    return () => clearInterval(interval);
  }, [fetchMemories]);

  const handleDelete = async (key: string, memoryUserCookie: string) => {
    try {
      await fetch('/api/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'delete',
          deploymentId,
          userCookie: memoryUserCookie,
          key,
        }),
      });
      fetchMemories();
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  return (
    <div className="bg-gray-900 rounded-lg p-4 h-full overflow-hidden flex flex-col">
      {/* Tab Header */}
      <div className="flex items-center gap-1 mb-4 border-b border-gray-700 pb-2">
        <button
          onClick={() => setActiveTab('memories')}
          className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${
            activeTab === 'memories'
              ? 'bg-gray-700 text-white'
              : 'text-gray-400 hover:text-gray-300 hover:bg-gray-800'
          }`}
        >
          💾 Memories ({memories.length})
        </button>
        <button
          onClick={() => setActiveTab('queries')}
          className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${
            activeTab === 'queries'
              ? 'bg-gray-700 text-white'
              : 'text-gray-400 hover:text-gray-300 hover:bg-gray-800'
          }`}
        >
          🔍 Queries ({queryLogs.length})
        </button>
        <div className="flex-1" />
        {activeTab === 'memories' && (
          <button
            onClick={fetchMemories}
            disabled={loading}
            className="text-sm px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-gray-300 disabled:opacity-50"
          >
            {loading ? '...' : '↻'}
          </button>
        )}
      </div>
      
      {error && (
        <div className="text-red-400 text-sm mb-2">{error}</div>
      )}
      
      {/* Memories Tab */}
      {activeTab === 'memories' && (
        <div className="flex-1 overflow-y-auto space-y-2">
          {memories.length === 0 ? (
            <p className="text-gray-500 text-sm">No memories stored yet. Talk to the agent and share some information!</p>
          ) : (
            memories.map((memory, index) => (
              <div
                key={`${memory.key}-${index}`}
                className={`p-3 rounded-lg ${
                  memory.isGlobal 
                    ? 'bg-blue-900/30 border border-blue-700' 
                    : 'bg-gray-800 border border-gray-700'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-green-400 truncate">{memory.key}</span>
                      {memory.isGlobal && (
                        <span className="text-xs px-2 py-0.5 bg-blue-600 rounded-full text-white">Global</span>
                      )}
                    </div>
                    <p className="text-gray-300 text-sm mt-1 break-words">{memory.value}</p>
                    <p className="text-gray-500 text-xs mt-1">
                      {new Date(memory.updatedAt).toLocaleString()}
                    </p>
                  </div>
                  {!memory.isGlobal && (
                    <button
                      onClick={() => handleDelete(memory.key, memory.userCookie)}
                      className="ml-2 text-red-400 hover:text-red-300 text-sm"
                      title="Delete memory"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Queries Tab */}
      {activeTab === 'queries' && (
        <div className="flex-1 overflow-y-auto space-y-2">
          {queryLogs.length === 0 ? (
            <p className="text-gray-500 text-sm">No memory operations yet. The AI will log operations here when it stores or retrieves memories.</p>
          ) : (
            [...queryLogs].reverse().map((log) => (
              <div
                key={log.id}
                className={`p-3 rounded-lg border ${
                  log.operation === 'set'
                    ? 'bg-green-900/20 border-green-700'
                    : log.operation === 'query'
                    ? 'bg-purple-900/20 border-purple-700'
                    : log.operation === 'get'
                    ? 'bg-blue-900/20 border-blue-700'
                    : 'bg-red-900/20 border-red-700'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded ${
                    log.operation === 'set'
                      ? 'bg-green-700 text-green-100'
                      : log.operation === 'query'
                      ? 'bg-purple-700 text-purple-100'
                      : log.operation === 'get'
                      ? 'bg-blue-700 text-blue-100'
                      : 'bg-red-700 text-red-100'
                  }`}>
                    {log.operation}
                  </span>
                  <span className="text-gray-500 text-xs">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  {log.isGlobal !== undefined && (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      log.isGlobal ? 'bg-blue-600 text-white' : 'bg-gray-600 text-gray-200'
                    }`}>
                      {log.isGlobal ? 'Global' : 'Private'}
                    </span>
                  )}
                </div>
                
                {log.query && (
                  <div className="mt-2">
                    <span className="text-gray-500 text-xs">Query:</span>
                    <p className="text-purple-300 text-sm font-mono bg-purple-900/30 px-2 py-1 rounded mt-1">
                      &quot;{log.query}&quot;
                    </p>
                  </div>
                )}
                
                {log.key && (
                  <div className="mt-2">
                    <span className="text-gray-500 text-xs">Key:</span>
                    <span className="text-green-400 text-sm font-mono ml-2">{log.key}</span>
                  </div>
                )}
                
                {log.value && (
                  <div className="mt-1">
                    <span className="text-gray-500 text-xs">Value:</span>
                    <p className="text-gray-300 text-sm mt-1 break-words">{log.value}</p>
                  </div>
                )}
                
                {log.reasoning && (
                  <div className="mt-2 text-xs text-gray-500 italic">
                    💭 {log.reasoning}
                  </div>
                )}
                
                {log.results && log.results.length > 0 && (
                  <div className="mt-2">
                    <span className="text-gray-500 text-xs">Results ({log.results.length}):</span>
                    <div className="mt-1 space-y-1">
                      {log.results.slice(0, 3).map((result, idx) => (
                        <div key={idx} className="text-xs bg-gray-800 px-2 py-1 rounded">
                          <span className="text-green-400 font-mono">{result.key}</span>
                          <span className="text-gray-500 mx-1">→</span>
                          <span className="text-gray-300">{result.value.slice(0, 50)}{result.value.length > 50 ? '...' : ''}</span>
                        </div>
                      ))}
                      {log.results.length > 3 && (
                        <p className="text-gray-500 text-xs">...and {log.results.length - 3} more</p>
                      )}
                    </div>
                  </div>
                )}
                
                {log.pipeline && (
                  <details className="mt-2">
                    <summary className="text-xs text-cyan-400 cursor-pointer hover:text-cyan-300 flex items-center gap-1">
                      <span>📋 MQL Pipeline</span>
                      {log.searchType && (
                        <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] ${
                          log.searchType === 'hybrid' 
                            ? 'bg-purple-700 text-purple-100' 
                            : log.searchType === 'text'
                            ? 'bg-blue-700 text-blue-100'
                            : 'bg-gray-600 text-gray-200'
                        }`}>
                          {log.searchType}
                        </span>
                      )}
                    </summary>
                    <pre className="mt-2 p-2 bg-gray-950 rounded text-[10px] text-cyan-300 overflow-x-auto max-h-64 overflow-y-auto font-mono">
                      {JSON.stringify(log.pipeline, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
