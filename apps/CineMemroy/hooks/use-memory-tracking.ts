'use client';

import { useState, useCallback } from 'react';

export interface MemoryOperation {
  id: string;
  type: 'episodic' | 'long' | 'procedural';
  status: 'pending' | 'completed' | 'error';
  content: string;
  timestamp: Date;
  error?: string;
}

export interface MemoryStats {
  episodic: number;
  long: number;
  procedural: number;
  total: number;
}

export function useMemoryTracking() {
  const [operations, setOperations] = useState<MemoryOperation[]>([]);
  const [stats, setStats] = useState<MemoryStats>({
    episodic: 0,
    long: 0,
    procedural: 0,
    total: 0,
  });

  const addOperation = useCallback((type: MemoryOperation['type'], content: string) => {
    const id = `mem-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const operation: MemoryOperation = {
      id,
      type,
      status: 'pending',
      content,
      timestamp: new Date(),
    };

    setOperations(prev => [...prev, operation]);
    return id;
  }, []);

  const updateOperation = useCallback((id: string, status: MemoryOperation['status'], error?: string) => {
    setOperations(prev => 
      prev.map(op => 
        op.id === id 
          ? { ...op, status, error }
          : op
      )
    );

    // Update stats when operation completes
    if (status === 'completed') {
      setStats(prev => {
        const operation = operations.find(op => op.id === id);
        if (!operation) return prev;

        return {
          ...prev,
          [operation.type]: prev[operation.type] + 1,
          total: prev.total + 1,
        };
      });
    }
  }, [operations]);

  const clearOperations = useCallback(() => {
    setOperations([]);
    setStats({
      episodic: 0,
      long: 0,
      procedural: 0,
      total: 0,
    });
  }, []);

  const getOperationsByStatus = useCallback((status: MemoryOperation['status']) => {
    return operations.filter(op => op.status === status);
  }, [operations]);

  return {
    operations,
    stats,
    addOperation,
    updateOperation,
    clearOperations,
    getOperationsByStatus,
  };
}
