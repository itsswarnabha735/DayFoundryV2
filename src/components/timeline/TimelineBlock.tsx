import React from 'react';
import { Briefcase, Users, Clock, MapPin, Coffee, Calendar, Car, Lock, Pin } from 'lucide-react';
import { ConflictIndicator } from '../schedule/ConflictIndicator';
import { Badge } from '../ui/badge';
import { ScheduleBlock } from '../screens/ScheduleScreen';
import { ConflictDetection } from '../../utils/schedule/conflictDetection';

interface TimelineBlockProps {
  block: ScheduleBlock;
  style: React.CSSProperties;
  onMouseDownResize: (blockId: string, handle: 'top' | 'bottom', event: React.MouseEvent) => void;
  onTogglePin: (blockId: string) => void;
  isResizing?: boolean;
  conflict?: ConflictDetection;
}

export function TimelineBlock({
  block,
  style,
  onMouseDownResize,
  onTogglePin,
  isResizing = false,
  conflict
}: TimelineBlockProps) {

  const getBlockStyles = () => {
    const baseStyles = {
      borderRadius: 'var(--df-radius-md)',
      border: '1px solid',
      cursor: isResizing ? 'ns-resize' : 'default',
      transition: isResizing ? 'none' : 'all var(--df-anim-fast) ease-in-out'
    };

    switch (block.type) {
      case 'deep':
        return {
          ...baseStyles,
          backgroundColor: 'rgba(37, 99, 235, 0.12)',
          borderColor: 'var(--df-primary)',
          borderWidth: block.isPinned ? '2px' : '1px',
          borderLeftWidth: '4px',
          borderLeftColor: 'var(--df-primary)'
        };

      case 'meeting':
        return {
          ...baseStyles,
          backgroundColor: 'var(--df-surface-alt)',
          borderColor: 'var(--df-border)',
          borderWidth: block.isPinned ? '2px' : '1px',
          borderLeftWidth: '4px',
          borderLeftColor: 'var(--df-text-muted)'
        };

      case 'admin':
        return {
          ...baseStyles,
          backgroundColor: 'rgba(91, 100, 114, 0.12)',
          borderColor: 'var(--df-text-muted)',
          borderWidth: block.isPinned ? '2px' : '1px',
          borderLeftWidth: '4px',
          borderLeftColor: 'var(--df-text-muted)'
        };

      case 'errand':
        return {
          ...baseStyles,
          backgroundColor: 'rgba(217, 119, 6, 0.12)',
          borderColor: 'var(--df-warning)',
          borderWidth: block.isPinned ? '2px' : '1px',
          borderLeftWidth: '4px',
          borderLeftColor: 'var(--df-warning)'
        };

      case 'buffer':
        return {
          ...baseStyles,
          backgroundColor: 'rgba(91, 100, 114, 0.08)',
          borderColor: 'var(--df-border)',
          borderWidth: block.isPinned ? '2px' : '1px',
          borderStyle: 'dashed'
        };

      case 'micro-break':
        return {
          ...baseStyles,
          backgroundColor: 'rgba(34, 197, 94, 0.08)',
          borderColor: 'var(--df-success)',
          borderWidth: block.isPinned ? '2px' : '1px',
          borderLeftWidth: '2px',
          borderLeftColor: 'var(--df-success)'
        };

      case 'calendar':
        return {
          ...baseStyles,
          backgroundColor: 'rgba(37, 99, 235, 0.08)',
          borderColor: 'var(--df-primary)',
          borderWidth: '1px',
          borderLeftWidth: '4px',
          borderLeftColor: 'var(--df-primary)',
          opacity: 0.8
        };

      case 'travel':
        return {
          ...baseStyles,
          backgroundColor: 'rgba(217, 119, 6, 0.08)',
          borderColor: 'var(--df-warning)',
          borderWidth: '1px',
          borderLeftWidth: '2px',
          borderLeftColor: 'var(--df-warning)',
          borderStyle: 'dashed'
        };

      default:
        return baseStyles;
    }
  };

  const getTypeIcon = () => {
    switch (block.type) {
      case 'deep':
        return <Briefcase size={16} />;
      case 'meeting':
        return <Users size={16} />;
      case 'admin':
        return <Clock size={16} />;
      case 'errand':
        return <MapPin size={16} />;
      case 'buffer':
        return null;
      case 'micro-break':
        return <Coffee size={16} />;
      case 'calendar':
        return <Calendar size={16} />;
      case 'travel':
        return <Car size={16} />;
      default:
        return null;
    }
  };

  const getEnergyColor = () => {
    switch (block.energy) {
      case 'high':
        return 'var(--df-success)';
      case 'medium':
        return 'var(--df-warning)';
      case 'low':
        return 'var(--df-text-muted)';
      default:
        return 'var(--df-text-muted)';
    }
  };

  const formatTimeRange = () => {
    const formatTime = (time: string) => {
      const [hour, minute] = time.split(':').map(Number);
      const period = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
      return minute === 0 ? `${displayHour} ${period}` : `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
    };

    return `${formatTime(block.startTime)} - ${formatTime(block.endTime)}`;
  };

  const blockHeight = parseInt(style.height as string) || 60;
  const isCompact = blockHeight < 60;

  return (
    <div
      data-block-id={block.id}
      className="group relative"
      style={{
        ...style,
        ...getBlockStyles(),
        minHeight: '40px'
      }}
    >
      {/* Top Resize Handle */}
      {!block.isPinned && !block.isReadOnly && (
        <div
          className="absolute inset-x-0 -top-1 h-2 cursor-ns-resize opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ backgroundColor: 'transparent' }}
          onMouseDown={(e) => onMouseDownResize(block.id, 'top', e)}
        />
      )}

      {/* Content */}
      <div
        className="h-full p-3 flex flex-col justify-between"
        style={{ minHeight: '40px' }}
      >
        <div className="flex-1">
          {/* Header */}
          <div className="flex items-start justify-between mb-1">
            <div className="flex items-center space-x-2 flex-1 min-w-0">
              {getTypeIcon() && (
                <span style={{ color: 'var(--df-text-muted)' }}>
                  {getTypeIcon()}
                </span>
              )}
              <h3
                className={`font-medium truncate ${isCompact ? 'text-sm' : ''}`}
                style={{
                  color: 'var(--df-text)',
                  fontSize: isCompact ? 'var(--df-type-caption-size)' : 'var(--df-type-body-size)',
                  fontWeight: 'var(--df-type-body-weight)',
                  lineHeight: '1.2'
                }}
              >
                {block.title}
              </h3>
            </div>

            <div className="flex items-center space-x-1 ml-2">
              {block.energy && !isCompact && (
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: getEnergyColor() }}
                  title={`${block.energy} energy`}
                />
              )}

              {/* Read-only indicator for calendar/travel blocks */}
              {block.isReadOnly && (
                <div
                  className="p-1"
                  style={{ color: 'var(--df-text-muted)' }}
                  title="Read-only calendar event"
                >
                  <Lock size={14} />
                </div>
              )}

              {/* Pin/Unpin button for user blocks */}
              {!block.isReadOnly && (
                <button
                  onClick={() => onTogglePin(block.id)}
                  className="p-1 rounded hover:bg-black/5 transition-colors"
                  style={{ color: block.isPinned ? 'var(--df-primary)' : 'var(--df-text-muted)' }}
                  title={block.isPinned ? 'Unpin block' : 'Pin block'}
                >
                  {block.isPinned ? <Lock size={14} /> : <Pin size={14} />}
                </button>
              )}
            </div>
          </div>

          {/* Location */}
          {block.location && !isCompact && (
            <div className="flex items-center space-x-1 mb-1">
              <MapPin size={12} style={{ color: 'var(--df-text-muted)' }} />
              <span
                className="text-xs truncate"
                style={{ color: 'var(--df-text-muted)' }}
              >
                {block.location}
              </span>
              {/* Travel time indicator */}
              {block.isTravel && block.travelTime && (
                <span
                  className="text-xs ml-2 px-1 py-0.5 rounded"
                  style={{
                    backgroundColor: 'var(--df-warning)',
                    color: 'var(--df-primary-contrast)',
                    fontSize: '0.75rem'
                  }}
                >
                  {block.travelTime}min
                </span>
              )}
            </div>
          )}

          {/* Description */}
          {block.description && !isCompact && (
            <p
              className="text-xs leading-tight mb-2 line-clamp-2"
              style={{ color: 'var(--df-text-muted)' }}
            >
              {block.description}
            </p>
          )}
        </div>

        {/* Footer - Time and Type Badge */}
        {!isCompact && (
          <div className="flex items-center justify-between mt-auto pt-1">
            <span
              className="text-xs"
              style={{
                color: 'var(--df-text-muted)',
                fontSize: 'var(--df-type-caption-size)'
              }}
            >
              {formatTimeRange()}
            </span>

            {block.type === 'buffer' && (
              <Badge
                variant="outline"
                className="text-xs"
                style={{
                  borderColor: 'var(--df-border)',
                  color: 'var(--df-text-muted)',
                  fontSize: '10px'
                }}
              >
                Buffer
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Bottom Resize Handle */}
      {!block.isPinned && !block.isReadOnly && (
        <div
          className="absolute inset-x-0 -bottom-1 h-2 cursor-ns-resize opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ backgroundColor: 'transparent' }}
          onMouseDown={(e) => onMouseDownResize(block.id, 'bottom', e)}
        />
      )}

      {/* Conflict Indicator */}
      {conflict && (
        <div className="absolute top-1 right-6 z-20">
          <ConflictIndicator
            conflictType={conflict.conflictType}
            severity={conflict.severity}
          />
        </div>
      )}

      {/* Pinned Indicator */}
      {block.isPinned && (
        <div
          className="absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center"
          style={{
            backgroundColor: 'var(--df-primary)',
            color: 'var(--df-primary-contrast)'
          }}
        >
          <Lock size={10} />
        </div>
      )}
    </div>
  );
}