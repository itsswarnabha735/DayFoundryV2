import React, { useState, useEffect } from 'react';
import { X, Clock, Focus, Calendar, ArrowRight, Copy, Check, Zap, Target, Minimize2 } from 'lucide-react';
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

export interface StrategyOperation {
  type: 'move' | 'resize' | 'delete' | 'split';
  targetBlockId: string;
  targetBlockTitle?: string;
  originalStart?: string;
  originalEnd?: string;
  params?: {
    shiftMinutes?: number;
    durationMinutes?: number;
    splitDuration?: number;
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
  raw?: any; // For storing original agent response
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
  const [alertDetails, setAlertDetails] = useState<{ type: string; message: string } | null>(null);
  const { callEdgeFunction } = useEdgeFunctions();

  // Fetch alert details when triggered from an alert
  useEffect(() => {
    if (isOpen && alertId) {
      const fetchAlertDetails = async () => {
        const { data: alert, error } = await supabase
          .from('schedule_alerts')
          .select('type, message')
          .eq('id', alertId)
          .single();

        if (!error && alert) {
          setAlertDetails(alert);
        }
      };
      fetchAlertDetails();
    } else {
      setAlertDetails(null);
    }
  }, [isOpen, alertId]);

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

  const getActionColor = (type: string) => {
    switch (type) {
      case 'moved': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'resized': return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200';
      case 'removed': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  const getTimeDelta = (change: ScheduleChange) => {
    // Helper to convert HH:MM time string to minutes
    const toMinutes = (timeStr: string): number => {
      if (!timeStr) return NaN;
      const parts = timeStr.split(':');
      if (parts.length !== 2) return NaN;
      const [hours, minutes] = parts.map(Number);
      if (isNaN(hours) || isNaN(minutes)) return NaN;
      return hours * 60 + minutes;
    };

    if (change.type === 'moved' && change.oldStartTime && change.newStartTime) {
      const oldMins = toMinutes(change.oldStartTime);
      const newMins = toMinutes(change.newStartTime);
      if (isNaN(oldMins) || isNaN(newMins)) return '';
      const diff = newMins - oldMins;
      return diff > 0 ? `Delayed by ${diff}m` : `Advanced by ${Math.abs(diff)}m`;
    }
    if (change.type === 'resized' && change.oldEndTime && change.newEndTime && change.oldStartTime && change.newStartTime) {
      const oldDuration = toMinutes(change.oldEndTime) - toMinutes(change.oldStartTime);
      const newDuration = toMinutes(change.newEndTime) - toMinutes(change.newStartTime);
      if (isNaN(oldDuration) || isNaN(newDuration)) return '';
      const diff = newDuration - oldDuration;
      return diff > 0 ? `Extended by ${diff}m` : `Shortened by ${Math.abs(diff)}m`;
    }
    return '';
  };

  const fetchAgentStrategies = async (id: string) => {
    setIsLoadingStrategies(true);
    try {
      const response = await callEdgeFunction('negotiate-schedule', {
        alert_id: id,
        user_id: (await import('../../utils/supabase/client').then((m) => m.supabase.auth.getUser())).data.user?.id,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      });

      if (response.success && response.strategies) {
        const agentStrategies: ReplanStrategy[] = response.strategies.map((s: any) => {
          const { changes, newBlocks } = applyOperations(currentBlocks, s.operations || []);
          return {
            id: s.id,
            title: s.title,
            description: s.description,
            icon: s.action === 'delete' ? X : (s.action === 'move' ? ArrowRight : (s.action === 'shorten' ? Minimize2 : Clock)),
            impact: s.impact?.toLowerCase() as 'high' | 'medium' | 'low',
            changes,
            newBlocks,
            tradeoffs: s.tradeoffs || [s.description || 'AI-generated strategy'],
            operations: s.operations || [],
            // Store raw strategy data for recording later
            raw: s
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

    console.log('applyOperations: Starting', {
      blockCount: blocks.length,
      operationCount: operations.length,
      blockTitles: blocks.map(b => b.title),
      ops: operations
    });

    for (const op of operations) {
      // Enhanced matching: Try ID first, then exact title, then fuzzy title match
      let blockIndex = newBlocks.findIndex(b => b.id === op.targetBlockId);
      if (blockIndex === -1) {
        blockIndex = newBlocks.findIndex(b => b.title === op.targetBlockId);
      }
      if (blockIndex === -1 && op.targetBlockId) {
        // Fuzzy match: check if block title contains targetBlockId or vice versa
        const targetLower = op.targetBlockId.toLowerCase();
        blockIndex = newBlocks.findIndex(b =>
          b.title.toLowerCase().includes(targetLower) ||
          targetLower.includes(b.title.toLowerCase())
        );
      }

      console.log('applyOperations: Matching op', { op, foundIndex: blockIndex, target: op.targetBlockId });

      if (blockIndex === -1) {
        // Use title from operation if available, or truncated ID
        const displayTitle = op.targetBlockTitle || (op.targetBlockId.length > 30 ? `Task (${op.targetBlockId.substring(0, 8)}...)` : op.targetBlockId);

        let oldStart = '';
        let oldEnd = '';
        let newStart = '';
        let newEnd = '';
        let reason = `${op.type}: Block not found in current view`;

        // If the agent provided original times, usage them to simulate the change
        if (op.originalStart) {
          // Construct ISO strings assuming today's date for display purposes
          const today = new Date().toISOString().split('T')[0];
          oldStart = `${today}T${op.originalStart}:00`;

          if (op.originalEnd) {
            oldEnd = `${today}T${op.originalEnd}:00`;
          }

          // Calculate new times if possible
          if (op.type === 'move' && op.params?.shiftMinutes) {
            newStart = addMinutes(oldStart, op.params.shiftMinutes);
            if (oldEnd) newEnd = addMinutes(oldEnd, op.params.shiftMinutes);
            reason = `Move ${Math.abs(op.params.shiftMinutes)}m ${op.params.shiftMinutes > 0 ? 'later' : 'earlier'}`;
          } else if (op.type === 'resize' && op.params?.durationMinutes) {
            newStart = oldStart;
            newEnd = addMinutes(oldStart, op.params.durationMinutes);
            reason = `Resize to ${op.params.durationMinutes}m`;
          }
        } else {
          // Fallback reason if we don't have times
          if (op.type === 'move' && op.params?.shiftMinutes) {
            const shift = op.params.shiftMinutes;
            reason = `Move by ${Math.abs(shift)}m ${shift > 0 ? 'later' : 'earlier'}`;
          }
        }

        changes.push({
          type: 'pending' as any,
          blockId: op.targetBlockId,
          blockTitle: displayTitle,
          oldStartTime: oldStart,
          oldEndTime: oldEnd,
          newStartTime: newStart,
          newEndTime: newEnd,
          reason: reason
        });
        continue;
      }

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
      } else {
        // Handle unknown operation types (e.g., 'reschedule', 'defer') as informational changes
        changes.push({
          type: 'pending' as any,
          blockId: block.id,
          blockTitle: block.title,
          oldStartTime: block.startTime,
          oldEndTime: block.endTime,
          reason: `${op.type}: Will be rescheduled`
        });
      }
    }

    return { changes, newBlocks };
  };

  const generateStrategies = () => {
    const protectFocusStrategy = generateProtectFocusStrategy();
    const hitDeadlinesStrategy = generateHitDeadlinesStrategy();
    const rescheduleLaterStrategy = generateRescheduleLaterStrategy();

    setStrategies([protectFocusStrategy, hitDeadlinesStrategy, rescheduleLaterStrategy]);
  };

  const generateRescheduleLaterStrategy = (): ReplanStrategy => {
    const operations: StrategyOperation[] = [];
    const processedBlockIds = new Set<string>();

    // For each conflict, move the lower-priority block to end of day or mark for tomorrow
    conflicts.forEach(conflict => {
      const sortedBlocks = [...(conflict.affectedBlocks || [])].sort((a, b) => {
        const priorityScore = { high: 3, medium: 2, low: 1 };
        const typeScore = { deep: 3, meeting: 2, admin: 1, errand: 0, buffer: 0, 'micro-break': 0, calendar: 2, travel: 1 };
        const scoreA = (a?.priority ? priorityScore[a.priority] : 0) * 10 + (typeScore[a?.type] || 0);
        const scoreB = (b?.priority ? priorityScore[b.priority] : 0) * 10 + (typeScore[b?.type] || 0);
        return scoreB - scoreA;
      });

      // Move the lowest priority block to late afternoon (4 PM onwards)
      const blockToReschedule = sortedBlocks[sortedBlocks.length - 1];
      if (blockToReschedule && !processedBlockIds.has(blockToReschedule.id)) {
        processedBlockIds.add(blockToReschedule.id);
        const currentStartMinutes = timeToMinutes(blockToReschedule.startTime);
        const targetStartMinutes = 17 * 60; // 5:00 PM
        const shiftMinutes = targetStartMinutes - currentStartMinutes;

        if (shiftMinutes > 0) {
          operations.push({
            type: 'move',
            targetBlockId: blockToReschedule.id,
            params: { shiftMinutes }
          });
        }
      }
    });

    const { changes, newBlocks } = applyOperations(currentBlocks, operations);

    return {
      id: 'reschedule_later',
      title: 'Reschedule Later',
      description: 'Move conflicting tasks to later in the day or defer to tomorrow',
      icon: Calendar,
      changes,
      newBlocks,
      tradeoffs: [
        'Some tasks moved to end of day',
        'May extend working hours',
        'Original priorities maintained'
      ],
      operations
    };
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
              {/* Show alert details when triggered from Guardian */}
              {alertDetails && conflicts.length === 0 && (
                <div
                  className="flex items-center gap-3 p-3 rounded"
                  style={{
                    backgroundColor: 'var(--df-surface-alt)',
                    border: `1px solid var(--df-warning)`
                  }}
                >
                  <Badge
                    style={{
                      backgroundColor: 'var(--df-warning)',
                      color: 'var(--df-primary-contrast)',
                      fontSize: 'var(--df-type-caption-size)'
                    }}
                  >
                    {alertDetails.type.toUpperCase()}
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
                      {alertDetails.message}
                    </p>
                  </div>
                </div>
              )}

              {/* Show local conflicts */}
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
                    <div className="flex flex-col items-center justify-center py-6 text-center space-y-3">
                      <div className="p-3 rounded-full bg-blue-50/10">
                        <Calendar className="w-8 h-8 text-blue-400" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium" style={{ color: 'var(--df-text)' }}>
                          {strategies.find(s => s.id === selectedStrategy)?.title}
                        </p>
                        <p className="text-sm px-4" style={{ color: 'var(--df-text-muted)' }}>
                          {strategies.find(s => s.id === selectedStrategy)?.description || 'This strategy will be applied when you click Apply.'}
                        </p>
                      </div>
                      {strategies.find(s => s.id === selectedStrategy)?.operations &&
                        strategies.find(s => s.id === selectedStrategy)!.operations!.length > 0 && (
                          <Badge variant="outline" className="mt-2 text-xs">
                            {strategies.find(s => s.id === selectedStrategy)!.operations!.length} actions pending
                          </Badge>
                        )}
                    </div>
                  ) : (
                    strategies.find(s => s.id === selectedStrategy)?.changes.slice(0, 5).map((change, index) => (
                      <div
                        key={index}
                        className="p-3 rounded-lg space-y-3 transition-colors"
                        style={{
                          backgroundColor: 'var(--df-surface)',
                          border: '1px solid var(--df-border)'
                        }}
                      >
                        {/* Header: Title & Badge */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2" style={{ color: 'var(--df-text-muted)' }}>
                            {getChangeIcon(change.type)}
                            <span className="font-medium text-sm" style={{ color: 'var(--df-text)' }}>
                              {change.blockTitle}
                            </span>
                          </div>
                          <span className={`text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded ${getActionColor(change.type)}`}>
                            {change.type}
                          </span>
                        </div>

                        {/* Content: Before -> After */}
                        {change.type !== 'removed' && change.oldStartTime && change.newStartTime && (
                          <div className="flex items-center justify-between text-sm px-1">
                            {/* Before */}
                            <div className="flex flex-col">
                              <span className="text-xs uppercase" style={{ color: 'var(--df-text-muted)', opacity: 0.7 }}>Before</span>
                              <span className="line-through" style={{ color: 'var(--df-text-muted)' }}>
                                {formatTime(change.oldStartTime)} - {formatTime(change.oldEndTime || '')}
                              </span>
                            </div>

                            {/* Arrow */}
                            <div className="px-2" style={{ color: 'var(--df-primary)' }}>
                              <ArrowRight size={16} />
                            </div>

                            {/* After */}
                            <div className="flex flex-col text-right">
                              <span className="text-xs uppercase font-medium" style={{ color: 'var(--df-primary)' }}>After</span>
                              <span
                                className="font-medium px-1.5 py-0.5 rounded -mr-1.5"
                                style={{
                                  color: 'var(--df-text)',
                                  backgroundColor: 'rgba(37, 99, 235, 0.15)'
                                }}
                              >
                                {formatTime(change.newStartTime)} - {formatTime(change.newEndTime || '')}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Footer: Delta info */}
                        {(getTimeDelta(change) || change.reason) && (
                          <div
                            className="flex items-center gap-1.5 pt-2 mt-1 text-xs"
                            style={{
                              borderTop: '1px solid var(--df-border)',
                              color: 'var(--df-text-muted)'
                            }}
                          >
                            <div
                              className="w-1 h-1 rounded-full"
                              style={{ backgroundColor: 'var(--df-primary)', opacity: 0.5 }}
                            />
                            <span>{change.reason}</span>
                            {getTimeDelta(change) && (
                              <span className="ml-auto font-mono text-xs" style={{ opacity: 0.7 }}>
                                {getTimeDelta(change)}
                              </span>
                            )}
                          </div>
                        )}
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
                  onApplyStrategy(strategy); // Fix: use prop onApplyStrategy, not onApply

                  // Fire-and-forget: Record the user's choice for agent learning
                  callEdgeFunction('record-agent-decision', {
                    user_id: (await import('../../utils/supabase/client').then((m) => m.supabase.auth.getUser())).data.user?.id,
                    agent_name: 'negotiator',
                    decision_type: 'conflict_resolution_chosen',
                    context: { alert_id: alertId || 'manual', strategy_id: strategy.id }, // Fix: use alertId prop
                    options_presented: strategies.map(s => s.raw || { id: s.id, title: s.title }),
                    option_chosen: strategy.id
                  }).catch(err => console.error('Failed to record decision:', err));

                  onClose();
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