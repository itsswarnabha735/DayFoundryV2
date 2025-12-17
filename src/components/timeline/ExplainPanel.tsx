import React from 'react';
import { ArrowRight, Clock, Move, RotateCcw, Plus, X, Pause, Zap } from 'lucide-react';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';

interface ScheduleChange {
  type: 'moved' | 'resized' | 'created' | 'removed';
  blockTitle: string;
  oldTime?: string;
  newTime?: string;
  reason: string;
}

interface ExplainPanelProps {
  changes: ScheduleChange[];
  reasoning?: string;
  proposedBlocks?: any[];
}

export function ExplainPanel({ changes, reasoning, proposedBlocks }: ExplainPanelProps) {

  const formatTime = (time: string) => {
    if (!time) return '';
    const [hour, minute] = time.split(':').map(Number);
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return minute === 0 ? `${displayHour} ${period}` : `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
  };

  // Helper functions
  const groupChangesByType = () => {
    const groups: { type: ScheduleChange['type']; changes: ScheduleChange[] }[] = [];
    const types: ScheduleChange['type'][] = ['created', 'moved', 'resized', 'removed'];

    types.forEach(type => {
      const typeChanges = changes.filter(c => c.type === type);
      if (typeChanges.length > 0) {
        groups.push({ type, changes: typeChanges });
      }
    });

    return groups;
  };

  const getBuffersUsed = () => {
    // This would typically come from the changes or a separate prop
    // For now, we'll return an empty array or extract from "created" changes if they are buffers
    return changes
      .filter(c => c.type === 'created' && c.blockTitle.toLowerCase().includes('buffer'))
      .map(c => ({
        time: c.newTime || '',
        duration: '15m', // estimated
        purpose: c.reason
      }));
  };

  const getChangeIcon = (type: ScheduleChange['type']) => {
    switch (type) {
      case 'created': return <Plus size={16} className="text-green-500" />;
      case 'moved': return <Move size={16} className="text-blue-500" />;
      case 'resized': return <RotateCcw size={16} className="text-orange-500" />;
      case 'removed': return <X size={16} className="text-red-500" />;
      default: return <Clock size={16} />;
    }
  };

  const getChangeTypeLabel = (type: ScheduleChange['type']) => {
    switch (type) {
      case 'created': return 'New Blocks';
      case 'moved': return 'Rescheduled';
      case 'resized': return 'Adjusted Duration';
      case 'removed': return 'Removed';
      default: return 'Changes';
    }
  };

  const getChangeColor = (type: ScheduleChange['type']) => {
    switch (type) {
      case 'created': return 'var(--df-success)';
      case 'moved': return 'var(--df-primary)';
      case 'resized': return 'var(--df-warning)';
      case 'removed': return 'var(--df-destructive)';
      default: return 'var(--df-text-muted)';
    }
  };

  const groupedChanges = groupChangesByType();
  const buffersUsed = getBuffersUsed();

  return (
    <ScrollArea className="h-full">
      <div className="space-y-6 pb-6">
        {/* Summary */}
        <div
          className="p-4 rounded"
          style={{
            backgroundColor: 'var(--df-surface-alt)',
            borderRadius: 'var(--df-radius-md)'
          }}
        >
          <div className="flex items-center space-x-2 mb-2">
            <Zap size={16} style={{ color: 'var(--df-primary)' }} />
            <h3
              style={{
                fontSize: 'var(--df-type-subtitle-size)',
                fontWeight: 'var(--df-type-subtitle-weight)',
                color: 'var(--df-text)'
              }}
            >
              Agent's Plan
            </h3>
          </div>

          {reasoning ? (
            <p style={{ color: 'var(--df-text)', fontSize: 'var(--df-type-body-size)', lineHeight: '1.5' }}>
              {reasoning}
            </p>
          ) : (
            <p style={{ color: 'var(--df-text-muted)', fontSize: 'var(--df-type-body-size)' }}>
              {changes.length} change{changes.length !== 1 ? 's' : ''} made to optimize your schedule for focus and productivity.
            </p>
          )}
        </div>

        {/* Changes by Type */}
        {groupedChanges.map(({ type, changes: typeChanges }) => (
          <div key={type}>
            <div className="flex items-center space-x-2 mb-3">
              {getChangeIcon(type)}
              <h3
                style={{
                  fontSize: 'var(--df-type-body-size)',
                  fontWeight: 'var(--df-type-body-weight)',
                  color: 'var(--df-text)'
                }}
              >
                {getChangeTypeLabel(type)} ({typeChanges.length})
              </h3>
            </div>

            <div className="space-y-3 mb-6">
              {typeChanges.map((change, index) => (
                <div
                  key={index}
                  className="p-3 rounded border-l-2"
                  style={{
                    backgroundColor: 'var(--df-surface)',
                    borderLeftColor: getChangeColor(change.type),
                    borderRadius: 'var(--df-radius-sm)'
                  }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4
                      className="font-medium"
                      style={{
                        color: 'var(--df-text)',
                        fontSize: 'var(--df-type-body-size)'
                      }}
                    >
                      {change.blockTitle}
                    </h4>

                    <Badge
                      variant="outline"
                      style={{
                        borderColor: getChangeColor(change.type),
                        color: getChangeColor(change.type),
                        fontSize: 'var(--df-type-caption-size)'
                      }}
                    >
                      {getChangeTypeLabel(change.type)}
                    </Badge>
                  </div>

                  {/* Time Change Display */}
                  {change.oldTime && change.newTime && (
                    <div className="flex items-center space-x-2 mb-2">
                      <span
                        className="text-sm"
                        style={{ color: 'var(--df-text-muted)' }}
                      >
                        {formatTime(change.oldTime)}
                      </span>
                      <ArrowRight size={14} style={{ color: 'var(--df-text-muted)' }} />
                      <span
                        className="text-sm font-medium"
                        style={{ color: 'var(--df-text)' }}
                      >
                        {formatTime(change.newTime)}
                      </span>
                    </div>
                  )}

                  {/* Reason */}
                  <p
                    className="text-sm"
                    style={{ color: 'var(--df-text-muted)' }}
                  >
                    {change.reason}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Buffers Used */}
        {buffersUsed.length > 0 && (
          <div>
            <div className="flex items-center space-x-2 mb-3">
              <Pause size={16} style={{ color: 'var(--df-text-muted)' }} />
              <h3
                style={{
                  fontSize: 'var(--df-type-body-size)',
                  fontWeight: 'var(--df-type-body-weight)',
                  color: 'var(--df-text)'
                }}
              >
                Buffers Utilized
              </h3>
            </div>

            <div className="space-y-2">
              {buffersUsed.map((buffer, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 rounded"
                  style={{
                    backgroundColor: 'var(--df-surface-alt)',
                    borderRadius: 'var(--df-radius-sm)'
                  }}
                >
                  <div>
                    <span
                      className="font-medium"
                      style={{ color: 'var(--df-text)' }}
                    >
                      {buffer.time}
                    </span>
                    <span
                      className="ml-2 text-sm"
                      style={{ color: 'var(--df-text-muted)' }}
                    >
                      ({buffer.duration})
                    </span>
                  </div>
                  <span
                    className="text-sm"
                    style={{ color: 'var(--df-text-muted)' }}
                  >
                    {buffer.purpose}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tips */}
        <div
          className="p-4 rounded border"
          style={{
            backgroundColor: 'var(--df-surface)',
            borderColor: 'var(--df-border)',
            borderRadius: 'var(--df-radius-md)'
          }}
        >
          <h4
            className="font-medium mb-2"
            style={{
              color: 'var(--df-text)',
              fontSize: 'var(--df-type-body-size)'
            }}
          >
            💡 Optimization Tips
          </h4>
          <ul className="space-y-1 text-sm" style={{ color: 'var(--df-text-muted)' }}>
            <li>• Pinned blocks stay in place during optimization</li>
            <li>• Deep work blocks are grouped for better flow</li>
            <li>• Buffers prevent meeting overruns</li>
          </ul>
        </div>
      </div>
      {/* Detailed Schedule Breakdown */}
      {proposedBlocks && proposedBlocks.length > 0 && (
        <div className="pt-2">
          <h3
            className="mb-3"
            style={{
              fontSize: 'var(--df-type-body-size)',
              fontWeight: 'var(--df-type-body-weight)',
              color: 'var(--df-text)'
            }}
          >
            Detailed Schedule Breakdown
          </h3>

          <div className="space-y-4">
            {proposedBlocks.map((block, index) => (
              <div
                key={index}
                className="p-3 rounded border"
                style={{
                  backgroundColor: 'var(--df-surface)',
                  borderColor: 'var(--df-border)',
                  borderRadius: 'var(--df-radius-md)'
                }}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4
                      className="font-medium"
                      style={{ color: 'var(--df-text)', fontSize: 'var(--df-type-body-size)' }}
                    >
                      {block.title}
                    </h4>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="outline" className="text-xs">
                        {block.type}
                      </Badge>
                      <span style={{ color: 'var(--df-text-muted)', fontSize: '12px' }}>
                        {formatTime(block.startTime)} - {formatTime(block.endTime)}
                      </span>
                    </div>
                  </div>
                </div>

                {block.justification && (
                  <p
                    className="text-sm mb-3 italic"
                    style={{ color: 'var(--df-text-muted)' }}
                  >
                    "{block.justification}"
                  </p>
                )}

                {/* Render Tasks within Block */}
                {block.tasks && block.tasks.length > 0 && (
                  <div className="mt-3 pl-3 border-l-2" style={{ borderColor: 'var(--df-border)' }}>
                    <p className="text-xs uppercase font-bold mb-2" style={{ color: 'var(--df-text-muted)' }}>Tasks Included</p>
                    <div className="space-y-3">
                      {block.tasks.map((task: any, tIndex: number) => (
                        <div key={tIndex} className="text-sm">
                          <div className="flex items-start gap-2">
                            <ArrowRight size={14} className="mt-1 shrink-0" style={{ color: 'var(--df-primary)' }} />
                            <div>
                              <p style={{ color: 'var(--df-text)' }} className="font-medium">
                                Task ID: {task.id.slice(0, 8)}...
                              </p>
                              {task.logic && (
                                <p style={{ color: 'var(--df-text-muted)' }}>
                                  {task.logic}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </ScrollArea>
  );
}