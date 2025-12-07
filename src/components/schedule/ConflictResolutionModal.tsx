import React, { useState, useEffect } from 'react';
import { X, Clock, Focus, Calendar, ArrowRight, Copy, Check, Zap, Target } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { useEdgeFunctions } from '../../hooks/useEdgeFunctions';
import { supabase } from '../../utils/supabase/client';

interface ScheduleBlock {
  id: string;
  title: string;
  type: 'deep' | 'meeting' | 'admin' | 'errand' | 'buffer' | 'micro-break' | 'calendar' | 'travel';
  startTime: string;
  endTime: string;
  isPinned: boolean;
  location?: string;
  description?: string;
  energy?: 'high' | 'medium' | 'low';
  isReadOnly?: boolean;
  sourceId?: string;
  taskId?: string;
  eventId?: string;
  priority?: 'high' | 'medium' | 'low';
}

interface ConflictDetection {
  conflictType: 'overrun' | 'overlap' | 'deadline_miss' | 'energy_mismatch';
  severity: 'low' | 'medium' | 'high';
  affectedBlocks: ScheduleBlock[];
  description: string;
  estimatedDelay: number; // minutes
}

interface StrategyOperation {
  type: 'move' | 'resize' | 'delete' | 'split';
  targetBlockId: string;
  params?: {
    newStart?: string;
    newEnd?: string;
    shiftMinutes?: number;
    durationMinutes?: number;
  };
}

interface ReplanStrategy {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ size?: number }>;
  changes: ScheduleChange[];
  newBlocks: ScheduleBlock[];
  tradeoffs: string[];
  action?: string;
  operations?: StrategyOperation[];
}

interface ScheduleChange {
  type: 'moved' | 'resized' | 'split' | 'removed' | 'compressed';
  blockId: string;
  blockTitle: string;
  oldStartTime?: string;
  oldEndTime?: string;
  newStartTime?: string;
  newEndTime?: string;
  reason: string;
}

interface ConflictResolutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  conflicts: ConflictDetection[];
  currentBlocks: ScheduleBlock[];
  onApplyStrategy: (strategy: ReplanStrategy) => void;
  alertId?: string;
}

export function ConflictResolutionModal({
  isOpen,
  onClose,
  conflicts,
  currentBlocks,
  onApplyStrategy,
  alertId
}: ConflictResolutionModalProps) {
  const [selectedStrategy, setSelectedStrategy] = useState<string | null>(null);
  const [strategies, setStrategies] = useState<ReplanStrategy[]>([]);
  const [isLoadingStrategies, setIsLoadingStrategies] = useState(false);
  const [isGeneratingMessage, setIsGeneratingMessage] = useState(false);
  const [rescheduleMessage, setRescheduleMessage] = useState<string>('');
  const [messageCopied, setMessageCopied] = useState(false);
  const [savePreferences, setSavePreferences] = useState(false);
  const { callEdgeFunction } = useEdgeFunctions();

  useEffect(() => {
    if (isOpen) {
      fetchUserPreferences();
      if (alertId) {
        fetchAgentStrategies(alertId);
      } else if (conflicts.length > 0) {
        generateStrategies();
      }
    }
  }, [isOpen, conflicts, alertId]);

  const fetchUserPreferences = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from('user_preferences').select('*').eq('user_id', user.id).single();
      if (data && data.conflict_resolution_style) {
        // Pre-select strategy based on preference if available
        // This is a simple heuristic mapping
        if (data.conflict_resolution_style === 'conservative') setSelectedStrategy('protect_focus');
        else if (data.conflict_resolution_style === 'aggressive') setSelectedStrategy('hit_deadlines');
      }
    }
  };

  const fetchAgentStrategies = async (id: string) => {
    setIsLoadingStrategies(true);
    try {
      const response = await callEdgeFunction('negotiate-schedule', {
        alert_id: id,
        user_id: (await import('../../utils/supabase/client').then((m) => m.supabase.auth.getUser())).data.user?.id,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      });

      if (response.success && response.data.strategies) {
        const agentStrategies: ReplanStrategy[] = response.data.strategies.map((s: any) => {
          const { changes, newBlocks } = applyOperations(currentBlocks, s.operations || []);
          return {
            id: s.id,
            title: s.title,
            description: s.description,
            icon: s.action === 'delete' ? X : (s.action === 'move' ? ArrowRight : Zap),
            changes: changes,
            newBlocks: newBlocks,
            tradeoffs: [s.impact],
            action: s.action,
            operations: s.operations
          };
        });
        setStrategies(agentStrategies);
      } else {
        generateStrategies(); // Fallback
      }
    } catch (error) {
      console.error('Failed to fetch agent strategies:', error);
      generateStrategies();
    } finally {
      setIsLoadingStrategies(false);
    }
  };

  const applyOperations = (blocks: ScheduleBlock[], operations: StrategyOperation[]): { changes: ScheduleChange[], newBlocks: ScheduleBlock[] } => {
    let newBlocks = [...blocks];
    const changes: ScheduleChange[] = [];

    for (const op of operations) {
      const blockIndex = newBlocks.findIndex(b => b.title === op.targetBlockId || b.id === op.targetBlockId);
      if (blockIndex === -1) continue;

      const block = newBlocks[blockIndex];

      if (op.type === 'move' && op.params?.shiftMinutes) {
        const newStart = addMinutes(block.startTime, op.params.shiftMinutes);
        const newEnd = addMinutes(block.endTime, op.params.shiftMinutes);

        changes.push({
          type: 'moved',
          blockId: block.id,
          blockTitle: block.title,
          oldStartTime: block.startTime,
          oldEndTime: block.endTime,
          newStartTime: newStart,
          newEndTime: newEnd,
          reason: 'Moved by agent strategy'
        });

        newBlocks[blockIndex] = { ...block, startTime: newStart, endTime: newEnd };
      } else if (op.type === 'resize' && op.params?.durationMinutes) {
        const newEnd = addMinutes(block.startTime, op.params.durationMinutes);

        changes.push({
          type: 'resized',
          blockId: block.id,
          blockTitle: block.title,
          oldStartTime: block.startTime,
          oldEndTime: block.endTime,
          newStartTime: block.startTime,
          newEndTime: newEnd,
          reason: 'Resized by agent strategy'
        });

        newBlocks[blockIndex] = { ...block, endTime: newEnd };
      } else if (op.type === 'delete') {
        changes.push({
          type: 'removed',
          blockId: block.id,
          blockTitle: block.title,
          oldStartTime: block.startTime,
          oldEndTime: block.endTime,
          reason: 'Removed by agent strategy'
        });

        newBlocks.splice(blockIndex, 1);
      }
      // TODO: Implement split logic if needed
    }

    return { changes, newBlocks };
  };

  const generateStrategies = () => {
    const protectFocusStrategy = generateProtectFocusStrategy();
    const hitDeadlinesStrategy = generateHitDeadlinesStrategy();

    setStrategies([protectFocusStrategy, hitDeadlinesStrategy]);
  };

  const generateProtectFocusStrategy = (): ReplanStrategy => {
    const operations: StrategyOperation[] = [];

    // 1. Identify conflicts involving Deep Work
    const deepWorkConflicts = conflicts.filter(c =>
      c.affectedBlocks?.some(b => b?.type === 'deep')
    );

    const processedBlockIds = new Set<string>();

    deepWorkConflicts.forEach(conflict => {
      // Find the non-deep work block to move
      const blockToMove = conflict.affectedBlocks?.find(b => b?.type !== 'deep');

      if (blockToMove && !processedBlockIds.has(blockToMove.id)) {
        processedBlockIds.add(blockToMove.id);

        // Find next available slot
        const duration = getBlockDuration(blockToMove);
        const freeSlotStart = findNextFreeSlot(currentBlocks, duration, blockToMove.endTime);

        if (freeSlotStart) {
          const currentStartMinutes = timeToMinutes(blockToMove.startTime);
          const newStartMinutes = timeToMinutes(freeSlotStart);
          const shiftMinutes = newStartMinutes - currentStartMinutes;

          operations.push({
            type: 'move',
            targetBlockId: blockToMove.id,
            params: { shiftMinutes }
          });
        }
      }
    });

    // If no specific deep work conflicts, fallback to moving all admin tasks to end of day
    if (operations.length === 0) {
      const adminBlocks = currentBlocks.filter(b => b.type === 'admin');
      adminBlocks.forEach((block, index) => {
        const targetStartMinutes = 16 * 60 + (index * 30); // 4:00 PM
        const currentStartMinutes = timeToMinutes(block.startTime);
        const shiftMinutes = targetStartMinutes - currentStartMinutes;
        operations.push({
          type: 'move',
          targetBlockId: block.id,
          params: { shiftMinutes }
        });
      });
    }

    const { changes, newBlocks } = applyOperations(currentBlocks, operations);

    return {
      id: 'protect_focus',
      title: 'Protect Focus',
      description: 'Preserve deep work blocks by moving conflicting tasks to free slots',
      icon: Focus,
      changes,
      newBlocks,
      tradeoffs: [
        'Conflicting tasks moved to next available slot',
        'Deep work energy preserved',
        'Schedule extended'
      ],
      operations
    };
  };

  const generateHitDeadlinesStrategy = (): ReplanStrategy => {
    const operations: StrategyOperation[] = [];
    const processedBlockIds = new Set<string>();

    conflicts.forEach(conflict => {
      // For overlaps, try to compress the less important block
      if (conflict.conflictType === 'overlap') {
        const sortedBlocks = [...(conflict.affectedBlocks || [])].sort((a, b) => {
          // Sort by priority: High > Medium > Low
          // If priority is missing, fallback to type: Deep > Meeting > Admin > Errand
          const priorityScore = { high: 3, medium: 2, low: 1 };
          const typeScore = { deep: 3, meeting: 2, admin: 1, errand: 0, buffer: 0, 'micro-break': 0, calendar: 2, travel: 1 };

          const scoreA = (a?.priority ? priorityScore[a.priority] : 0) * 10 + (typeScore[a?.type] || 0);
          const scoreB = (b?.priority ? priorityScore[b.priority] : 0) * 10 + (typeScore[b?.type] || 0);

          return scoreB - scoreA;
        });

        const blockToResize = sortedBlocks[sortedBlocks.length - 1]; // Lowest priority

        if (blockToResize && !processedBlockIds.has(blockToResize.id)) {
          processedBlockIds.add(blockToResize.id);
          const duration = getBlockDuration(blockToResize);
          // Compress by 25% or down to 15 mins
          const newDuration = Math.max(15, Math.floor(duration * 0.75));

          operations.push({
            type: 'resize',
            targetBlockId: blockToResize.id,
            params: { durationMinutes: newDuration }
          });
        }
      }
      // For overruns, compress the last block
      else if (conflict.conflictType === 'overrun') {
        const lastBlock = conflict.affectedBlocks[conflict.affectedBlocks.length - 1];
        if (lastBlock && !processedBlockIds.has(lastBlock.id)) {
          processedBlockIds.add(lastBlock.id);
          const duration = getBlockDuration(lastBlock);
          const newDuration = Math.max(15, Math.floor(duration * 0.8)); // Reduce by 20%
          operations.push({
            type: 'resize',
            targetBlockId: lastBlock.id,
            params: { durationMinutes: newDuration }
          });
        }
      }
    });

    // Fallback if no operations generated but conflicts exist
    if (operations.length === 0 && conflicts.length > 0) {
      const adminBlocks = currentBlocks.filter(b => b.type === 'admin');
      adminBlocks.forEach(block => {
        const duration = getBlockDuration(block);
        const compressedDuration = Math.max(15, Math.floor(duration * 0.75));
        operations.push({
          type: 'resize',
          targetBlockId: block.id,
          params: { durationMinutes: compressedDuration }
        });
      });
    }

    const { changes, newBlocks } = applyOperations(currentBlocks, operations);

    return {
      id: 'hit_deadlines',
      title: 'Hit Deadlines',
      description: 'Compress lower priority tasks to resolve conflicts and meet deadlines',
      icon: Target,
      changes,
      newBlocks,
      tradeoffs: [
        'Tasks compressed to fit',
        'Less buffer time',
        'Deadlines prioritized'
      ],
      operations
    };
  };

  const findNextFreeSlot = (blocks: ScheduleBlock[], durationMinutes: number, afterTime: string): string | null => {
    // Simple greedy search for a slot
    let searchStartMinutes = timeToMinutes(afterTime);
    const endOfDayMinutes = 22 * 60; // 10 PM limit

    // Sort blocks by start time
    const sortedBlocks = [...blocks].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

    while (searchStartMinutes + durationMinutes <= endOfDayMinutes) {
      const searchEndMinutes = searchStartMinutes + durationMinutes;

      // Check for overlap with any block
      const hasOverlap = sortedBlocks.some(block => {
        const blockStart = timeToMinutes(block.startTime);
        const blockEnd = timeToMinutes(block.endTime);
        return Math.max(searchStartMinutes, blockStart) < Math.min(searchEndMinutes, blockEnd);
      });

      if (!hasOverlap) {
        // Found a slot!
        const hours = Math.floor(searchStartMinutes / 60);
        const mins = searchStartMinutes % 60;
        return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
      }

      // Move search start to the end of the next overlapping block or increment by 15 mins
      // Optimization: find the block that overlaps and jump to its end
      const overlappingBlock = sortedBlocks.find(block => {
        const blockStart = timeToMinutes(block.startTime);
        const blockEnd = timeToMinutes(block.endTime);
        return Math.max(searchStartMinutes, blockStart) < Math.min(searchEndMinutes, blockEnd);
      });

      if (overlappingBlock) {
        searchStartMinutes = timeToMinutes(overlappingBlock.endTime);
      } else {
        searchStartMinutes += 15;
      }
    }

    return null;
  };

  const getBlockDuration = (block: ScheduleBlock): number => {
    const start = timeToMinutes(block.startTime);
    const end = timeToMinutes(block.endTime);
    return end - start;
  };

  const timeToMinutes = (timeStr: string): number => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const addMinutes = (timeStr: string, minutes: number): string => {
    const totalMinutes = timeToMinutes(timeStr) + minutes;
    const hours = Math.floor(totalMinutes / 60) % 24;
    const mins = totalMinutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };

  const formatTime = (timeStr: string): string => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  const generateRescheduleMessage = async () => {
    if (!selectedStrategy) return;

    setIsGeneratingMessage(true);

    try {
      const strategy = strategies.find((s: ReplanStrategy) => s.id === selectedStrategy);
      const majorConflicts = conflicts.filter(c => c.severity === 'high');

      const response = await callEdgeFunction('generate-reschedule-message', {
        conflicts: majorConflicts,
        strategy: strategy,
        changes: strategy?.changes || []
      });

      if (response.success && response.data.message) {
        setRescheduleMessage(response.data.message);
      } else {
        // Fallback to template message
        const fallbackMessage = generateFallbackMessage();
        setRescheduleMessage(fallbackMessage);
      }
    } catch (error) {
      console.error('Failed to generate reschedule message:', error);
      const fallbackMessage = generateFallbackMessage();
      setRescheduleMessage(fallbackMessage);
    } finally {
      setIsGeneratingMessage(false);
    }
  };

  const generateFallbackMessage = (): string => {
    const strategy = strategies.find(s => s.id === selectedStrategy);
    const movedMeetings = strategy?.changes.filter(c => c.type === 'moved').length || 0;

    return `Hi! I need to make a quick schedule adjustment due to some conflicts that came up. ${movedMeetings > 0
      ? `I'll need to move ${movedMeetings} item${movedMeetings > 1 ? 's' : ''} to accommodate the changes.`
      : `I'll work around the current commitments.`
      } I'll send updated times shortly. Thanks for your flexibility!`;
  };

  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(rescheduleMessage);
      setMessageCopied(true);
      setTimeout(() => setMessageCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy message:', error);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'var(--df-danger)';
      case 'medium': return 'var(--df-warning)';
      case 'low': return 'var(--df-success)';
      default: return 'var(--df-text-muted)';
    }
  };

  const getChangeIcon = (changeType: string) => {
    switch (changeType) {
      case 'moved': return <ArrowRight size={14} />;
      case 'resized': return <Clock size={14} />;
      case 'split': return <Zap size={14} />;
      case 'compressed': return <Target size={14} />;
      default: return <Clock size={14} />;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="relative w-full max-w-4xl h-full max-h-screen flex flex-col"
        style={{
          backgroundColor: 'var(--df-surface)',
          margin: 'var(--df-space-16)',
          borderRadius: 'var(--df-radius-md)',
          boxShadow: 'var(--df-shadow-lg)'
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between p-6 border-b"
          style={{ borderBottomColor: 'var(--df-border)' }}
        >
          <div>
            <h2
              className="m-0 mb-1"
              style={{
                fontSize: 'var(--df-type-title-size)',
                fontWeight: 'var(--df-type-title-weight)',
                color: 'var(--df-text)'
              }}
            >
              Schedule Conflict Detected
            </h2>
            <p
              className="m-0"
              style={{
                fontSize: 'var(--df-type-body-size)',
                fontWeight: 'var(--df-type-body-weight)',
                color: 'var(--df-text-muted)'
              }}
            >
              Choose a resolution strategy
            </p>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-9 w-9 p-0"
            style={{ color: 'var(--df-text-muted)' }}
          >
            <X size={20} />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {/* Conflicts Summary */}
          <div className="mb-6">
            <h3
              className="m-0 mb-3"
              style={{
                fontSize: 'var(--df-type-subtitle-size)',
                fontWeight: 'var(--df-type-subtitle-weight)',
                color: 'var(--df-text)'
              }}
            >
              Detected Issues
            </h3>

            <div className="space-y-2">
              {conflicts.map((conflict, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 p-3 rounded"
                  style={{
                    backgroundColor: 'var(--df-surface-alt)',
                    border: `1px solid ${getSeverityColor(conflict.severity)}`
                  }}
                >
                  <Badge
                    style={{
                      backgroundColor: getSeverityColor(conflict.severity),
                      color: 'var(--df-primary-contrast)',
                      fontSize: 'var(--df-type-caption-size)'
                    }}
                  >
                    {conflict.severity.toUpperCase()}
                  </Badge>

                  <div className="flex-1">
                    <p
                      className="m-0"
                      style={{
                        fontSize: 'var(--df-type-body-size)',
                        fontWeight: 'var(--df-type-body-weight)',
                        color: 'var(--df-text)'
                      }}
                    >
                      {conflict.description}
                    </p>
                    {conflict.estimatedDelay > 0 && (
                      <p
                        className="m-0 mt-1"
                        style={{
                          fontSize: 'var(--df-type-caption-size)',
                          fontWeight: 'var(--df-type-caption-weight)',
                          color: 'var(--df-text-muted)'
                        }}
                      >
                        Estimated delay: {conflict.estimatedDelay} minutes
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Strategy Selection */}
          <div className="mb-6">
            <h3
              className="m-0 mb-4"
              style={{
                fontSize: 'var(--df-type-subtitle-size)',
                fontWeight: 'var(--df-type-subtitle-weight)',
                color: 'var(--df-text)'
              }}
            >
              Resolution Strategies
            </h3>

            {isLoadingStrategies ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin mb-4" />
                <p className="text-gray-500">Negotiating with Agent...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {strategies.map((strategy) => (
                  <Card
                    key={strategy.id}
                    className={`p-4 cursor-pointer transition-all duration-200 ${selectedStrategy === strategy.id
                      ? 'ring-2'
                      : 'hover:shadow-md'
                      }`}
                    style={{
                      backgroundColor: 'var(--df-surface)',
                      borderColor: selectedStrategy === strategy.id
                        ? 'var(--df-primary)'
                        : 'var(--df-border)',
                      ringColor: selectedStrategy === strategy.id
                        ? 'var(--df-primary)'
                        : 'transparent'
                    }}
                    onClick={() => setSelectedStrategy(strategy.id)}
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <div
                        className="p-2 rounded"
                        style={{ backgroundColor: 'var(--df-surface-alt)' }}
                      >
                        <strategy.icon size={20} style={{ color: 'var(--df-primary)' }} />
                      </div>

                      <div className="flex-1">
                        <h4
                          className="m-0 mb-1"
                          style={{
                            fontSize: 'var(--df-type-body-size)',
                            fontWeight: 'var(--df-type-body-weight)',
                            color: 'var(--df-text)'
                          }}
                        >
                          {strategy.title}
                        </h4>
                        <p
                          className="m-0"
                          style={{
                            fontSize: 'var(--df-type-caption-size)',
                            fontWeight: 'var(--df-type-caption-weight)',
                            color: 'var(--df-text-muted)',
                            lineHeight: '1.4'
                          }}
                        >
                          {strategy.description}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p
                        className="m-0"
                        style={{
                          fontSize: 'var(--df-type-caption-size)',
                          fontWeight: 'var(--df-type-caption-weight)',
                          color: 'var(--df-text)'
                        }}
                      >
                        Trade-offs:
                      </p>
                      <ul className="m-0 space-y-1">
                        {strategy.tradeoffs.map((tradeoff, index) => (
                          <li
                            key={index}
                            className="flex items-center gap-2"
                            style={{
                              fontSize: 'var(--df-type-caption-size)',
                              fontWeight: 'var(--df-type-caption-weight)',
                              color: 'var(--df-text-muted)',
                              listStyle: 'none'
                            }}
                          >
                            <div
                              className="w-1 h-1 rounded-full"
                              style={{ backgroundColor: 'var(--df-text-muted)' }}
                            />
                            {tradeoff}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Diff Preview */}
          {selectedStrategy && (
            <div className="mb-6">
              <h3
                className="m-0 mb-3"
                style={{
                  fontSize: 'var(--df-type-subtitle-size)',
                  fontWeight: 'var(--df-type-subtitle-weight)',
                  color: 'var(--df-text)'
                }}
              >
                Preview Changes
              </h3>

              <Card
                key={selectedStrategy}
                className="p-4 animate-fade-in"
                style={{
                  backgroundColor: 'var(--df-surface-alt)',
                  borderColor: 'var(--df-border)'
                }}
              >
                <div className="space-y-3">
                  {strategies.find(s => s.id === selectedStrategy)?.changes.length === 0 ? (
                    <p className="text-sm text-white/60 italic">No specific changes required for this strategy.</p>
                  ) : (
                    strategies.find(s => s.id === selectedStrategy)?.changes.slice(0, 5).map((change, index) => (
                      <div key={index} className="flex items-center gap-3">
                        <div
                          className="flex-shrink-0 p-1 rounded"
                          style={{ backgroundColor: 'var(--df-surface)' }}
                        >
                          {getChangeIcon(change.type)}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p
                            className="m-0 truncate"
                            style={{
                              fontSize: 'var(--df-type-caption-size)',
                              fontWeight: 'var(--df-type-caption-weight)',
                              color: 'var(--df-text)'
                            }}
                          >
                            <span style={{ fontWeight: '600' }}>{change.blockTitle}</span>
                          </p>

                          <div className="flex items-center gap-2 mt-1">
                            {change.oldStartTime && (
                              <>
                                <span
                                  style={{
                                    fontSize: 'var(--df-type-caption-size)',
                                    fontWeight: 'var(--df-type-caption-weight)',
                                    color: 'var(--df-text-muted)',
                                    textDecoration: 'line-through'
                                  }}
                                >
                                  {formatTime(change.oldStartTime)} - {formatTime(change.oldEndTime || '')}
                                </span>
                                <ArrowRight size={12} style={{ color: 'var(--df-text-muted)' }} />
                              </>
                            )}
                            {change.newStartTime && (
                              <span
                                style={{
                                  fontSize: 'var(--df-type-caption-size)',
                                  fontWeight: 'var(--df-type-caption-weight)',
                                  color: 'var(--df-primary)'
                                }}
                              >
                                {formatTime(change.newStartTime)} - {formatTime(change.newEndTime || '')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}

                  {(strategies.find(s => s.id === selectedStrategy)?.changes.length || 0) > 5 && (
                    <p
                      className="m-0 text-center"
                      style={{
                        fontSize: 'var(--df-type-caption-size)',
                        fontWeight: 'var(--df-type-caption-weight)',
                        color: 'var(--df-text-muted)'
                      }}
                    >
                      +{(strategies.find(s => s.id === selectedStrategy)?.changes.length || 0) - 5} more changes
                    </p>
                  )}
                </div>
              </Card>
            </div>
          )}

          {/* Reschedule Message */}
          {selectedStrategy && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-3">
                <h3
                  className="m-0"
                  style={{
                    fontSize: 'var(--df-type-subtitle-size)',
                    fontWeight: 'var(--df-type-subtitle-weight)',
                    color: 'var(--df-text)'
                  }}
                >
                  Reschedule Message
                </h3>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={generateRescheduleMessage}
                  disabled={isGeneratingMessage}
                  style={{
                    borderColor: 'var(--df-border)',
                    color: 'var(--df-text)',
                    fontSize: 'var(--df-type-caption-size)'
                  }}
                >
                  {isGeneratingMessage ? (
                    <>
                      <div className="w-3 h-3 border border-gray-300 border-t-gray-600 rounded-full animate-spin mr-2" />
                      Generating...
                    </>
                  ) : (
                    'Draft Message'
                  )}
                </Button>
              </div>

              {rescheduleMessage && (
                <Card
                  className="p-4"
                  style={{
                    backgroundColor: 'var(--df-surface-alt)',
                    borderColor: 'var(--df-border)'
                  }}
                >
                  <p
                    className="m-0 mb-3"
                    style={{
                      fontSize: 'var(--df-type-body-size)',
                      fontWeight: 'var(--df-type-body-weight)',
                      color: 'var(--df-text)',
                      lineHeight: '1.5'
                    }}
                  >
                    {rescheduleMessage}
                  </p>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyMessage}
                    className="w-full"
                    style={{
                      borderColor: 'var(--df-border)',
                      color: messageCopied ? 'var(--df-success)' : 'var(--df-text)',
                      fontSize: 'var(--df-type-caption-size)'
                    }}
                  >
                    {messageCopied ? (
                      <>
                        <Check size={14} className="mr-2" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy size={14} className="mr-2" />
                        Copy Message
                      </>
                    )}
                  </Button>
                </Card>
              )}
            </div>
          )}
        </div>

        {/* Preferences Option */}
        <div className="px-6 pb-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={savePreferences}
              onChange={(e) => setSavePreferences(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span style={{ fontSize: 'var(--df-type-caption-size)', color: 'var(--df-text)' }}>
              Save this choice as my preferred conflict resolution style
            </span>
          </label>
        </div>

        {/* Footer */}
        <div
          className="flex gap-3 p-6 border-t"
          style={{ borderTopColor: 'var(--df-border)' }}
        >
          <Button
            variant="outline"
            className="flex-1"
            onClick={onClose}
            style={{
              borderColor: 'var(--df-border)',
              color: 'var(--df-text)',
              fontSize: 'var(--df-type-body-size)',
              minHeight: '44px'
            }}
          >
            Cancel
          </Button>

          <Button
            className="flex-1"
            onClick={async () => {
              if (selectedStrategy) {
                const strategy = strategies.find((s) => s.id === selectedStrategy);
                if (strategy) {
                  // Save preferences if checked
                  if (savePreferences) {
                    const { data: { user } } = await supabase.auth.getUser();
                    if (user) {
                      let style = 'balanced';
                      if (selectedStrategy === 'protect_focus') style = 'conservative';
                      else if (selectedStrategy === 'hit_deadlines') style = 'aggressive';

                      const { error } = await supabase.from('user_preferences').upsert({
                        user_id: user.id,
                        conflict_resolution_style: style,
                        updated_at: new Date().toISOString()
                      });
                      if (error) console.error('Failed to save preferences:', error);
                    }
                  }

                  // Apply the strategy
                  onApplyStrategy(strategy);

                  // If this was triggered by an alert, mark it as resolved
                  if (alertId) {
                    try {
                      const { error } = await supabase
                        .from('schedule_alerts')
                        .update({ status: 'resolved' })
                        .eq('id', alertId);

                      if (error) {
                        console.error('Failed to update alert status:', error);
                      }
                    } catch (err) {
                      console.error('Error updating alert status:', err);
                    }
                  }

                  onClose();
                }
              }
            }}
            disabled={!selectedStrategy}
            style={{
              backgroundColor: selectedStrategy ? 'var(--df-primary)' : 'var(--df-text-muted)',
              color: 'var(--df-primary-contrast)',
              fontSize: 'var(--df-type-body-size)',
              minHeight: '44px'
            }}
          >
            Apply Strategy
          </Button>
        </div>
      </div>
    </div>
  );
}