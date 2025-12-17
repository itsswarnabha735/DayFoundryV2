import React from 'react';
import { Briefcase, Users, Clock, MapPin, Coffee, Calendar, Car, Lock, Pin, FileText, CheckSquare } from 'lucide-react';
import { ConflictIndicator } from '../schedule/ConflictIndicator';
import { Badge } from '../ui/badge';
import { ScheduleBlock } from '../screens/ScheduleScreen';
import { ConflictDetection } from '../../utils/schedule/conflictDetection';
import { TimeTrackingButton } from '../schedule/TimeTrackingButton';

interface TimelineBlockProps {
  block: ScheduleBlock;
  style: React.CSSProperties;
  onMouseDownResize: (blockId: string, handle: 'top' | 'bottom', event: React.MouseEvent) => void;
  onTogglePin: (blockId: string) => void;
  onClick: () => void;
  isResizing?: boolean;
  conflict?: ConflictDetection;
}

export function TimelineBlock({
  block,
  style,
  onMouseDownResize,
  onTogglePin,
  onClick,
  isResizing = false,
  conflict
}: TimelineBlockProps) {

  const getBlockStyles = (): React.CSSProperties => {
    const baseStyles: React.CSSProperties = {
      borderRadius: 'var(--df-radius-md)',
      // border: '1px solid', // REMOVED
      cursor: isResizing ? 'ns-resize' : 'default',
      transition: isResizing ? 'none' : 'all var(--df-anim-fast) ease-in-out',
      boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)', // Card Shadow
      borderLeftWidth: '4px',
      borderLeftStyle: 'solid',
      backgroundColor: 'white', // Default fallback
      overflow: 'hidden' // Ensure rounded corners clip content
    };

    // Color Palette - Enhanced for better visibility
    const colors = {
      deep: { base: '#2563eb', bg: '#dbeafe' }, // Blue-100 for better visibility (was Blue-50)
      meeting: { base: '#9333ea', bg: 'rgba(147, 51, 234, 0.15)' }, // Increased visibility
      admin: { base: '#64748b', bg: 'rgba(100, 116, 139, 0.15)' },
      errand: { base: '#f97316', bg: 'rgba(249, 115, 22, 0.15)' },
      buffer: { base: '#9ca3af', bg: 'rgba(156, 163, 175, 0.10)' },
      micro: { base: '#16a34a', bg: 'rgba(22, 163, 74, 0.15)' },
      calendar: { base: '#ec4899', bg: 'rgba(236, 72, 153, 0.15)' },
      travel: { base: '#0d9488', bg: 'rgba(13, 148, 136, 0.10)' },
      prep: { base: '#eab308', bg: 'rgba(234, 179, 8, 0.18)' },
      debrief: { base: '#4f46e5', bg: 'rgba(79, 70, 229, 0.18)' }
    };

    switch (block.type) {
      case 'deep':
        return {
          ...baseStyles,
          backgroundColor: colors.deep.bg,
          borderLeftColor: colors.deep.base,
          borderLeftWidth: '4px',
          borderLeftStyle: 'solid' as const,
          ...(block.isPinned && { border: `2px solid ${colors.deep.base}` })
        };
      case 'meeting':
        return {
          ...baseStyles,
          backgroundColor: colors.meeting.bg,
          borderLeftColor: colors.meeting.base,
          borderLeftWidth: '4px',
          borderLeftStyle: 'solid' as const,
          ...(block.isPinned && { border: `2px solid ${colors.meeting.base}` })
        };
      case 'admin':
        return {
          ...baseStyles,
          backgroundColor: colors.admin.bg,
          borderLeftColor: colors.admin.base,
          borderLeftWidth: '4px',
          borderLeftStyle: 'solid' as const,
          ...(block.isPinned && { border: `2px solid ${colors.admin.base}` })
        };
      case 'errand':
        return {
          ...baseStyles,
          backgroundColor: colors.errand.bg,
          borderLeftColor: colors.errand.base,
          borderLeftWidth: '4px',
          borderLeftStyle: 'solid' as const,
          ...(block.isPinned && { border: `2px solid ${colors.errand.base}` })
        };
      case 'buffer':
        return {
          ...baseStyles,
          backgroundColor: colors.buffer.bg,
          borderLeftColor: colors.buffer.base,
          borderLeftStyle: 'dashed',
          boxShadow: 'none',
          border: '1px dashed #e2e8f0' // Light border for buffers
        };
      case 'micro-break':
        return {
          ...baseStyles,
          backgroundColor: colors.micro.bg,
          borderLeftColor: colors.micro.base,
          borderLeftWidth: '3px'
        };
      case 'calendar':
        return {
          ...baseStyles,
          backgroundColor: colors.calendar.bg,
          borderLeftColor: colors.calendar.base,
        };
      case 'travel':
        return {
          ...baseStyles,
          backgroundColor: colors.travel.bg,
          borderLeftColor: colors.travel.base,
          borderLeftStyle: 'dashed',
          boxShadow: 'none',
          border: '1px dashed #cbd5e1'
        };
      case 'prep':
        return {
          ...baseStyles,
          backgroundColor: colors.prep.bg,
          borderLeftColor: colors.prep.base,
        };
      case 'debrief':
        return {
          ...baseStyles,
          backgroundColor: colors.debrief.bg,
          borderLeftColor: colors.debrief.base,
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
      case 'prep':
        // Mapping FileText requires importing if not present, checking imports...
        // Assuming simple icon addition for now, will fix imports in next step if broken
        return <FileText size={16} />;
      case 'debrief':
        return <CheckSquare size={16} />;
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
      onClick={(e) => {
        // Prevent click when pinning or resizing
        if ((e.target as HTMLElement).closest('button') || isResizing) return;
        onClick();
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

            <div className="flex items-center gap-2">
              {/* Time Tracking for workable blocks */}
              {(block.type === 'deep' || block.type === 'admin') && block.taskId && (
                <TimeTrackingButton
                  taskId={block.taskId}
                  taskTitle={block.title}
                  size="sm"
                  showDuration={true}
                />
              )}

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