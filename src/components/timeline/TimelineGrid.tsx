import React, { useState, useRef, useMemo, useCallback } from 'react';
import { ScheduleBlock } from '../screens/ScheduleScreen';
import { TimelineBlock } from './TimelineBlock';
import { calculateLayout } from '../../utils/schedule/layout';
import { ConflictDetection } from '../../utils/schedule/conflictDetection';

interface TimelineGridProps {
  blocks: ScheduleBlock[];
  onBlockResize: (blockId: string, newStartTime: string, newEndTime: string) => void;
  onTogglePin: (blockId: string) => void;
  onBlockClick: (block: ScheduleBlock) => void;
  startHour?: number;
  endHour?: number;
  conflicts?: ConflictDetection[];
}

export function TimelineGrid({
  blocks,
  onBlockResize,
  onTogglePin,
  onBlockClick,
  startHour = 6,
  endHour = 22,
  conflicts = []
}: TimelineGridProps) {
  const [dragState, setDragState] = useState<{
    blockId: string;
    isResizing: boolean;
    resizeHandle: 'top' | 'bottom';
    initialY: number;
    initialTime: string;
  } | null>(null);

  const timelineRef = useRef<HTMLDivElement>(null);
  const HOUR_HEIGHT = 80; // 80px per hour
  const TICK_HEIGHT = HOUR_HEIGHT / 4; // 20px per 15-minute tick

  // Calculate layout for overlapping blocks
  const layout = useMemo(() => calculateLayout(blocks), [blocks]);

  // Generate time slots from startHour to endHour in 15-minute increments
  const generateTimeSlots = () => {
    const slots = [];
    for (let hour = startHour; hour <= endHour; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        if (hour === endHour && minute > 0) break; // Don't go past end hour

        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        const displayTime = formatDisplayTime(timeString);
        const isHourStart = minute === 0;

        slots.push({
          time: timeString,
          displayTime,
          isHourStart,
          position: ((hour - startHour) * 4 + minute / 15) * TICK_HEIGHT
        });
      }
    }
    return slots;
  };

  const formatDisplayTime = (time: string) => {
    const [hour, minute] = time.split(':').map(Number);
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return minute === 0 ? `${displayHour} ${period}` : `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
  };

  const timeToPosition = (time: string): number => {
    const [hour, minute] = time.split(':').map(Number);
    return ((hour - startHour) * 4 + minute / 15) * TICK_HEIGHT;
  };

  const positionToTime = (position: number): string => {
    const totalTicks = Math.round(position / TICK_HEIGHT);
    const hour = Math.floor(totalTicks / 4) + startHour;
    const minute = (totalTicks % 4) * 15;
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  };

  const getBlockHeight = (startTime: string, endTime: string): number => {
    const startPos = timeToPosition(startTime);
    const endPos = timeToPosition(endTime);
    return endPos - startPos;
  };

  const handleMouseDown = useCallback((
    blockId: string,
    resizeHandle: 'top' | 'bottom',
    event: React.MouseEvent
  ) => {
    event.preventDefault();
    const block = blocks.find(b => b.id === blockId);
    if (!block) return;

    setDragState({
      blockId,
      isResizing: true,
      resizeHandle,
      initialY: event.clientY,
      initialTime: resizeHandle === 'top' ? block.startTime : block.endTime
    });
  }, [blocks]);

  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!dragState || !timelineRef.current) return;

    const rect = timelineRef.current.getBoundingClientRect();
    const relativeY = event.clientY - rect.top;
    const newTime = positionToTime(Math.max(0, relativeY));

    // Update the visual feedback during drag
    const blockElement = document.querySelector(`[data-block-id="${dragState.blockId}"]`);
    if (blockElement) {
      const block = blocks.find(b => b.id === dragState.blockId);
      if (!block) return;

      if (dragState.resizeHandle === 'top') {
        const newHeight = getBlockHeight(newTime, block.endTime);
        if (newHeight > 0) {
          (blockElement as HTMLElement).style.top = `${timeToPosition(newTime)}px`;
          (blockElement as HTMLElement).style.height = `${newHeight}px`;
        }
      } else {
        const newHeight = getBlockHeight(block.startTime, newTime);
        if (newHeight > 0) {
          (blockElement as HTMLElement).style.height = `${newHeight}px`;
        }
      }
    }
  }, [dragState, blocks]);

  const handleMouseUp = useCallback(() => {
    if (!dragState || !timelineRef.current) return;

    const block = blocks.find(b => b.id === dragState.blockId);
    if (!block) {
      setDragState(null);
      return;
    }

    const blockElement = document.querySelector(`[data-block-id="${dragState.blockId}"]`);
    if (blockElement) {
      const rect = timelineRef.current.getBoundingClientRect();
      const blockRect = blockElement.getBoundingClientRect();
      const relativeTop = blockRect.top - rect.top;
      const relativeBottom = blockRect.bottom - rect.top;

      const newStartTime = positionToTime(Math.max(0, relativeTop));
      const newEndTime = positionToTime(Math.max(0, relativeBottom));

      // Ensure minimum 15-minute duration
      const startMinutes = parseInt(newStartTime.split(':')[0]) * 60 + parseInt(newStartTime.split(':')[1]);
      const endMinutes = parseInt(newEndTime.split(':')[0]) * 60 + parseInt(newEndTime.split(':')[1]);

      if (endMinutes - startMinutes >= 15) {
        onBlockResize(dragState.blockId, newStartTime, newEndTime);
      }
    }

    setDragState(null);
  }, [dragState, blocks, onBlockResize]);

  // Set up global mouse event listeners
  React.useEffect(() => {
    if (dragState) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'ns-resize';
      document.body.style.userSelect = 'none';

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [dragState, handleMouseMove, handleMouseUp]);

  const timeSlots = generateTimeSlots();
  const totalHeight = (endHour - startHour) * HOUR_HEIGHT;

  return (
    <div
      ref={timelineRef}
      className="relative min-h-full"
      style={{
        height: `${totalHeight}px`,
        paddingLeft: '80px', // Space for time labels
        paddingRight: 'var(--df-space-16)'
      }}
    >
      {/* Time Labels and Grid Lines */}
      {timeSlots.map((slot) => (
        <div
          key={slot.time}
          className="absolute left-0 right-0 flex items-center"
          style={{ top: `${slot.position}px` }}
        >
          {/* Time Label */}
          <div
            className="w-20 pr-3 text-right"
            style={{
              fontSize: slot.isHourStart ? 'var(--df-type-caption-size)' : '11px',
              fontWeight: slot.isHourStart ? 'var(--df-type-caption-weight)' : '400',
              color: slot.isHourStart ? 'var(--df-text-muted)' : 'transparent'
            }}
          >
            {slot.isHourStart ? slot.displayTime : ''}
          </div>

          {/* Grid Line */}
          <div
            className="flex-1 border-t"
            style={{
              borderTopColor: slot.isHourStart ? 'rgba(0,0,0,0.06)' : 'transparent',
              borderTopWidth: '1px',
              borderTopStyle: slot.isHourStart ? 'dashed' : 'solid'
            }}
          ></div>
        </div>
      ))}

      {/* Timeline Blocks Container */}
      <div
        className="absolute top-0 bottom-0"
        style={{
          left: '80px',
          right: 'var(--df-space-16)',
          pointerEvents: 'none'
        }}
      >
        {blocks.map((block) => {
          const top = timeToPosition(block.startTime);
          const height = getBlockHeight(block.startTime, block.endTime);
          const layoutPos = layout.get(block.id) || { left: '0%', width: '100%' };

          const blockConflict = conflicts.find(c => c.affectedBlocks?.some(b => b?.id === block.id));

          return (
            <TimelineBlock
              key={block.id}
              block={block}
              conflict={blockConflict}
              style={{
                position: 'absolute',
                left: layoutPos.left,
                width: layoutPos.width,
                top: `${top}px`,
                height: `${height}px`,
                zIndex: dragState?.blockId === block.id ? 10 : 1,
                pointerEvents: 'auto'
              }}
              onMouseDownResize={handleMouseDown}
              onTogglePin={onTogglePin}
              onClick={() => onBlockClick(block)}
              isResizing={dragState?.blockId === block.id}
            />
          );
        })}
      </div>

      {/* Current Time Indicator */}
      <CurrentTimeIndicator
        startHour={startHour}
        timeToPosition={timeToPosition}
      />
    </div>
  );
}

function CurrentTimeIndicator({ startHour, timeToPosition }: {
  startHour: number;
  timeToPosition: (time: string) => number;
}) {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  // Only show if within timeline range
  if (currentHour < startHour || currentHour > 22) {
    return null;
  }

  const currentTime = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;
  const position = timeToPosition(currentTime);

  return (
    <div
      className="absolute left-0 right-0 z-20 pointer-events-none"
      style={{ top: `${position}px` }}
    >
      <div
        className="h-0.5 ml-20"
        style={{ backgroundColor: 'var(--df-primary)' }}
      />
      <div
        className="absolute left-16 -top-2 w-4 h-4 rounded-full border-2"
        style={{
          backgroundColor: 'var(--df-primary)',
          borderColor: 'var(--df-surface)'
        }}
      />
    </div>
  );
}