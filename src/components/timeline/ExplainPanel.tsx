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
}

export function ExplainPanel({ changes, reasoning }: ExplainPanelProps) {

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
    </ScrollArea>
  );
}