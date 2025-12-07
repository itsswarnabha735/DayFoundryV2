export interface ScheduleBlock {
  id: string;
  title: string;
  type: 'deep' | 'meeting' | 'admin' | 'errand' | 'buffer' | 'micro-break' | 'calendar' | 'travel';
  startTime: string; // Format: "HH:MM"
  endTime: string;   // Format: "HH:MM"
  isPinned: boolean;
  location?: string;
  description?: string;
  energy?: 'high' | 'medium' | 'low';
  isReadOnly?: boolean;
  sourceId?: string;
  isAllDay?: boolean;
  isTravel?: boolean;
  travelTime?: number;
  taskId?: string;
  eventId?: string;
  priority?: 'high' | 'medium' | 'low';
}

export interface ConflictDetection {
  conflictType: 'overrun' | 'overlap' | 'deadline_miss' | 'energy_mismatch' | 'buffer_insufficient';
  severity: 'low' | 'medium' | 'high';
  affectedBlocks: ScheduleBlock[];
  description: string;
  estimatedDelay: number; // minutes
}

export interface WorkingHours {
  start: string; // "HH:MM"
  end: string;   // "HH:MM"
}

export interface ConflictDetectionOptions {
  workingHours: WorkingHours;
  minimumBufferBetweenMeetings: number; // minutes
  maxDeepWorkDuration: number; // minutes
  considerEnergyLevels: boolean;
}

export class ConflictDetector {
  private options: ConflictDetectionOptions;

  constructor(options: ConflictDetectionOptions) {
    this.options = options;
  }

  detectConflicts(blocks: ScheduleBlock[]): ConflictDetection[] {
    const conflicts: ConflictDetection[] = [];
    const sortedBlocks = [...blocks].sort((a, b) =>
      this.timeToMinutes(a.startTime) - this.timeToMinutes(b.startTime)
    );

    // Check for overlaps
    conflicts.push(...this.detectOverlaps(sortedBlocks));

    // Check for insufficient buffers
    conflicts.push(...this.detectInsufficientBuffers(sortedBlocks));

    // Check for overruns beyond working hours
    conflicts.push(...this.detectWorkingHoursOverruns(sortedBlocks));

    // Check for energy level mismatches
    if (this.options.considerEnergyLevels) {
      conflicts.push(...this.detectEnergyMismatches(sortedBlocks));
    }

    // Check for oversized deep work blocks
    conflicts.push(...this.detectOversizedDeepWork(sortedBlocks));

    return conflicts;
  }

  private detectOverlaps(blocks: ScheduleBlock[]): ConflictDetection[] {
    const conflicts: ConflictDetection[] = [];

    for (let i = 0; i < blocks.length - 1; i++) {
      const currentBlock = blocks[i];
      const nextBlock = blocks[i + 1];

      const currentEnd = this.timeToMinutes(currentBlock.endTime);
      const nextStart = this.timeToMinutes(nextBlock.startTime);

      if (currentEnd > nextStart) {
        const overlapMinutes = currentEnd - nextStart;

        conflicts.push({
          conflictType: 'overlap',
          severity: overlapMinutes > 30 ? 'high' : overlapMinutes > 15 ? 'medium' : 'low',
          affectedBlocks: [currentBlock, nextBlock],
          description: `${currentBlock.title} overlaps with ${nextBlock.title} by ${overlapMinutes} minutes`,
          estimatedDelay: overlapMinutes
        });
      }
    }

    return conflicts;
  }

  private detectInsufficientBuffers(blocks: ScheduleBlock[]): ConflictDetection[] {
    const conflicts: ConflictDetection[] = [];
    const meetingBlocks = blocks.filter(b => b.type === 'meeting');

    for (let i = 0; i < meetingBlocks.length - 1; i++) {
      const currentMeeting = meetingBlocks[i];
      const nextMeeting = meetingBlocks[i + 1];

      const currentEnd = this.timeToMinutes(currentMeeting.endTime);
      const nextStart = this.timeToMinutes(nextMeeting.startTime);
      const buffer = nextStart - currentEnd;

      if (buffer < this.options.minimumBufferBetweenMeetings) {
        const missingBuffer = this.options.minimumBufferBetweenMeetings - buffer;

        conflicts.push({
          conflictType: 'buffer_insufficient',
          severity: missingBuffer > 15 ? 'high' : missingBuffer > 5 ? 'medium' : 'low',
          affectedBlocks: [currentMeeting, nextMeeting],
          description: `Only ${buffer} minutes between meetings (${this.options.minimumBufferBetweenMeetings} minutes recommended)`,
          estimatedDelay: missingBuffer
        });
      }
    }

    return conflicts;
  }

  private detectWorkingHoursOverruns(blocks: ScheduleBlock[]): ConflictDetection[] {
    const conflicts: ConflictDetection[] = [];
    const workingStartMinutes = this.timeToMinutes(this.options.workingHours.start);
    const workingEndMinutes = this.timeToMinutes(this.options.workingHours.end);

    for (const block of blocks) {
      const blockStart = this.timeToMinutes(block.startTime);
      const blockEnd = this.timeToMinutes(block.endTime);

      // Check if block starts too early
      if (blockStart < workingStartMinutes) {
        const earlyMinutes = workingStartMinutes - blockStart;
        conflicts.push({
          conflictType: 'overrun',
          severity: earlyMinutes > 60 ? 'high' : earlyMinutes > 30 ? 'medium' : 'low',
          affectedBlocks: [block],
          description: `${block.title} starts ${earlyMinutes} minutes before working hours`,
          estimatedDelay: earlyMinutes
        });
      }

      // Check if block ends too late
      if (blockEnd > workingEndMinutes) {
        const lateMinutes = blockEnd - workingEndMinutes;
        conflicts.push({
          conflictType: 'overrun',
          severity: lateMinutes > 60 ? 'high' : lateMinutes > 30 ? 'medium' : 'low',
          affectedBlocks: [block],
          description: `${block.title} extends ${lateMinutes} minutes beyond working hours`,
          estimatedDelay: lateMinutes
        });
      }
    }

    return conflicts;
  }

  private detectEnergyMismatches(blocks: ScheduleBlock[]): ConflictDetection[] {
    const conflicts: ConflictDetection[] = [];

    // Morning hours (9-11 AM) should be for high-energy work
    const morningStart = 9 * 60; // 9:00 AM in minutes
    const morningEnd = 11 * 60;  // 11:00 AM in minutes

    // Afternoon hours (1-3 PM) are typically lower energy
    const afternoonStart = 13 * 60; // 1:00 PM in minutes
    const afternoonEnd = 15 * 60;   // 3:00 PM in minutes

    for (const block of blocks) {
      const blockStart = this.timeToMinutes(block.startTime);
      const blockEnd = this.timeToMinutes(block.endTime);

      // Check for deep work scheduled in low-energy periods
      if (block.type === 'deep' && block.energy === 'high') {
        if (blockStart >= afternoonStart && blockStart < afternoonEnd) {
          conflicts.push({
            conflictType: 'energy_mismatch',
            severity: 'medium',
            affectedBlocks: [block],
            description: `High-energy task "${block.title}" scheduled during typical low-energy period`,
            estimatedDelay: 0
          });
        }
      }

      // Check for admin work scheduled in high-energy periods
      if (block.type === 'admin') {
        if (blockStart >= morningStart && blockStart < morningEnd) {
          conflicts.push({
            conflictType: 'energy_mismatch',
            severity: 'low',
            affectedBlocks: [block],
            description: `Administrative task "${block.title}" scheduled during prime focus hours`,
            estimatedDelay: 0
          });
        }
      }
    }

    return conflicts;
  }

  private detectOversizedDeepWork(blocks: ScheduleBlock[]): ConflictDetection[] {
    const conflicts: ConflictDetection[] = [];

    for (const block of blocks) {
      if (block.type === 'deep') {
        const duration = this.getBlockDuration(block);

        if (duration > this.options.maxDeepWorkDuration) {
          const excessMinutes = duration - this.options.maxDeepWorkDuration;

          conflicts.push({
            conflictType: 'overrun',
            severity: excessMinutes > 60 ? 'high' : 'medium',
            affectedBlocks: [block],
            description: `Deep work block "${block.title}" is ${excessMinutes} minutes longer than recommended maximum (${this.options.maxDeepWorkDuration} minutes)`,
            estimatedDelay: 0
          });
        }
      }
    }

    return conflicts;
  }

  private timeToMinutes(timeStr: string): number {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  }

  private getBlockDuration(block: ScheduleBlock): number {
    const start = this.timeToMinutes(block.startTime);
    const end = this.timeToMinutes(block.endTime);
    return end - start;
  }
}

// Default configuration
export const defaultConflictDetectionOptions: ConflictDetectionOptions = {
  workingHours: { start: '09:00', end: '17:00' },
  minimumBufferBetweenMeetings: 15,
  maxDeepWorkDuration: 120,
  considerEnergyLevels: true
};

// Utility function to create a conflict detector with default options
export function createConflictDetector(options?: Partial<ConflictDetectionOptions>): ConflictDetector {
  return new ConflictDetector({
    ...defaultConflictDetectionOptions,
    ...options
  });
}