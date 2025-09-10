'use client';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Task, TaskTrigger, TaskContent, TaskItem } from '@/components/task';
import { Tool, ToolHeader, ToolContent, ToolOutput } from '@/components/tool';
import { useMemoryTracking, type MemoryOperation } from '@/hooks/use-memory-tracking';
import { BrainIcon, DatabaseIcon, ListIcon, MemoryStickIcon } from 'lucide-react';
import { useEffect } from 'react';

interface MemoryTrackerProps {
  onMemoryOperationAdd?: (type: MemoryOperation['type'], content: string) => string;
  onMemoryOperationUpdate?: (id: string, status: MemoryOperation['status'], error?: string) => void;
}

export function MemoryTracker({ onMemoryOperationAdd, onMemoryOperationUpdate }: MemoryTrackerProps) {
  const { operations, stats, addOperation, updateOperation, getOperationsByStatus } = useMemoryTracking();

  // Expose functions to parent component
  useEffect(() => {
    if (onMemoryOperationAdd) {
      // Replace the parent's add function with our local one
      onMemoryOperationAdd = addOperation;
    }
    if (onMemoryOperationUpdate) {
      // Replace the parent's update function with our local one
      onMemoryOperationUpdate = updateOperation;
    }
  }, [addOperation, updateOperation, onMemoryOperationAdd, onMemoryOperationUpdate]);

  const pendingOperations = getOperationsByStatus('pending');
  const completedOperations = getOperationsByStatus('completed');
  const errorOperations = getOperationsByStatus('error');

  const getMemoryTypeIcon = (type: MemoryOperation['type']) => {
    switch (type) {
      case 'episodic':
        return <MemoryStickIcon className="size-4" />;
      case 'long':
        return <DatabaseIcon className="size-4" />;
      case 'procedural':
        return <ListIcon className="size-4" />;
      default:
        return <BrainIcon className="size-4" />;
    }
  };

  const getMemoryTypeColor = (type: MemoryOperation['type']) => {
    switch (type) {
      case 'episodic':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'long':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'procedural':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatMemoryContent = (content: string, maxLength: number = 100) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };

  // Always show the component, even if no operations yet
  if (operations.length === 0) {
    return (
      <div className="space-y-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <BrainIcon className="size-5 text-primary" />
            <h3 className="font-semibold text-sm">Memory Operations</h3>
          </div>
          <div className="text-sm text-muted-foreground">
            No memory operations yet. Start a conversation to see how the AI processes and stores information.
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Memory Stats Summary */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <BrainIcon className="size-5 text-primary" />
          <h3 className="font-semibold text-sm">Memory Operations</h3>
        </div>
        <div className="grid grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-blue-600">{stats.episodic}</div>
            <div className="text-xs text-muted-foreground">Episodic</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-600">{stats.long}</div>
            <div className="text-xs text-muted-foreground">Facts</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-purple-600">{stats.procedural}</div>
            <div className="text-xs text-muted-foreground">Procedures</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-primary">{stats.total}</div>
            <div className="text-xs text-muted-foreground">Total</div>
          </div>
        </div>
      </Card>

      {/* Active Memory Operations */}
      {pendingOperations.length > 0 && (
        <Task defaultOpen={true}>
          <TaskTrigger title={`Processing ${pendingOperations.length} memory operation${pendingOperations.length > 1 ? 's' : ''}...`} />
          <TaskContent>
            {pendingOperations.map((operation) => (
              <Tool key={operation.id} defaultOpen={false}>
                <ToolHeader 
                  type={`tool-${operation.type}-memory` as `tool-${string}`}
                  state="input-available"
                />
                <ToolContent>
                  <ToolOutput 
                    output={
                      <div className="p-2">
                        <div className="flex items-center gap-2 mb-2">
                          {getMemoryTypeIcon(operation.type)}
                          <Badge className={`text-xs ${getMemoryTypeColor(operation.type)}`}>
                            {operation.type}
                          </Badge>
                        </div>
                        <div className="text-sm">
                          {formatMemoryContent(operation.content)}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Started: {operation.timestamp.toLocaleTimeString()}
                        </div>
                      </div>
                    }
                    errorText={undefined}
                  />
                </ToolContent>
              </Tool>
            ))}
          </TaskContent>
        </Task>
      )}

      {/* Completed Memory Operations */}
      {completedOperations.length > 0 && (
        <Task defaultOpen={false}>
          <TaskTrigger title={`${completedOperations.length} memory operation${completedOperations.length > 1 ? 's' : ''} completed`} />
          <TaskContent>
            {completedOperations.slice(-5).map((operation) => (
              <TaskItem key={operation.id}>
                <div className="flex items-center gap-2">
                  {getMemoryTypeIcon(operation.type)}
                  <Badge className={`text-xs ${getMemoryTypeColor(operation.type)}`}>
                    {operation.type}
                  </Badge>
                  <span className="text-xs">
                    {formatMemoryContent(operation.content, 60)}
                  </span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {operation.timestamp.toLocaleTimeString()}
                  </span>
                </div>
              </TaskItem>
            ))}
            {completedOperations.length > 5 && (
              <TaskItem>
                <div className="text-xs text-muted-foreground italic">
                  ... and {completedOperations.length - 5} more
                </div>
              </TaskItem>
            )}
          </TaskContent>
        </Task>
      )}

      {/* Error Operations */}
      {errorOperations.length > 0 && (
        <Task defaultOpen={true}>
          <TaskTrigger title={`${errorOperations.length} memory operation${errorOperations.length > 1 ? 's' : ''} failed`} />
          <TaskContent>
            {errorOperations.map((operation) => (
              <Tool key={operation.id} defaultOpen={false}>
                <ToolHeader 
                  type={`tool-${operation.type}-memory` as `tool-${string}`}
                  state="output-error"
                />
                <ToolContent>
                  <ToolOutput 
                    output={
                      <div className="p-2">
                        <div className="flex items-center gap-2 mb-2">
                          {getMemoryTypeIcon(operation.type)}
                          <Badge className={`text-xs ${getMemoryTypeColor(operation.type)}`}>
                            {operation.type}
                          </Badge>
                        </div>
                        <div className="text-sm">
                          {formatMemoryContent(operation.content)}
                        </div>
                      </div>
                    }
                    errorText={operation.error || 'Unknown error occurred'}
                  />
                </ToolContent>
              </Tool>
            ))}
          </TaskContent>
        </Task>
      )}
    </div>
  );
}

// Export a ref-based version for imperative control
export interface MemoryTrackerRef {
  addOperation: (type: MemoryOperation['type'], content: string) => string;
  updateOperation: (id: string, status: MemoryOperation['status'], error?: string) => void;
  clearOperations: () => void;
}

export const MemoryTrackerWithRef = ({ onRef, ...props }: MemoryTrackerProps & { onRef?: (ref: MemoryTrackerRef) => void }) => {
  const { addOperation, updateOperation, clearOperations } = useMemoryTracking();

  useEffect(() => {
    if (onRef) {
      onRef({
        addOperation,
        updateOperation,
        clearOperations,
      });
    }
  }, [onRef, addOperation, updateOperation, clearOperations]);

  return <MemoryTracker {...props} />;
};
