// Mock data store for development/testing when Supabase isn't set up
import { generateId } from '../uuid';

export type SyncStatus = 'up-to-date' | 'syncing' | 'offline';

export interface Task {
  id: string;
  user_id: string;
  title: string;
  steps: { text: string; completed: boolean }[];
  acceptance?: string;
  est_min?: number;
  est_most?: number;
  est_max?: number;
  energy: 'deep' | 'shallow';
  deadline?: string;
  tags: string[];
  context?: string;
  location?: string;
  source: string;
  deleted_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Event {
  id: string;
  user_id: string;
  calendar_id?: string;
  title: string;
  description?: string;
  start_at: string;
  end_at: string;
  location?: string;
  tz?: string;
  hard: boolean;
  source: string;
  external_id?: string;
  deleted_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Outcome {
  id: string;
  user_id: string;
  title: string;
  risks: { text: string; mitigation?: string }[];
  deleted_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ScheduleBlock {
  id: string;
  user_id: string;
  date: string;
  block_type: 'deep_work' | 'meeting' | 'admin' | 'buffer' | 'micro_break' | 'errand' | 'travel' | 'prep' | 'debrief';
  task_id?: string;
  event_id?: string;
  start_at: string;
  end_at: string;
  pinned: boolean;
  rationale?: string;
  explain: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface Settings {
  user_id: string;
  work_hours: Record<string, { start: string; end: string }>;
  no_meeting_windows: { start: string; end: string; label: string; days: string[] }[];
  energy_prefs: Record<string, any>;
  break_prefs: { interval_min: number; break_min: number };
  interruption_budget_min: number;
  privacy_mode: boolean;
  created_at: string;
  updated_at: string;
}

export interface CapturedItem {
  id: string;
  user_id: string;
  content: string;
  source: 'text' | 'voice' | 'camera';
  processed: boolean;
  task_draft?: {
    title: string;
    steps: string[];
    acceptance: string;
    est_range: string;
    energy: 'Deep' | 'Shallow';
    deps: string[];
    deadline?: Date;
    tags: string[];
  };
  created_at: string;
  updated_at: string;
}

export interface History {
  id: string;
  user_id: string;
  task_id?: string;
  planned_dur_min?: number;
  actual_dur_min?: number;
  deviation_min?: number;
  blockers: ('overrun' | 'interruption' | 'missing_info' | 'unrealistic_estimate')[];
  occurred_on: string;
  notes?: string;
  created_at: string;
}

// Mock data store that works without Supabase
export class MockDataStore {
  private static instance: MockDataStore;
  private syncStatus: SyncStatus = 'up-to-date';
  private statusListeners: ((status: SyncStatus) => void)[] = [];
  private tasks: Task[] = [];
  private events: Event[] = [];
  private outcomes: Outcome[] = [];
  private scheduleBlocks: ScheduleBlock[] = [];
  private settings: Settings | null = null;
  private capturedItems: CapturedItem[] = [];
  private history: History[] = [];

  private constructor() {
    this.loadMockData();
  }

  static getInstance(): MockDataStore {
    if (!MockDataStore.instance) {
      MockDataStore.instance = new MockDataStore();
    }
    return MockDataStore.instance;
  }

  private loadMockData() {
    // Mock settings
    this.settings = {
      user_id: 'mock-user',
      work_hours: {
        'monday': { start: '09:00', end: '17:00' },
        'tuesday': { start: '09:00', end: '17:00' },
        'wednesday': { start: '09:00', end: '17:00' },
        'thursday': { start: '09:00', end: '17:00' },
        'friday': { start: '09:00', end: '17:00' }
      },
      no_meeting_windows: [
        { start: '09:00', end: '11:00', label: 'Morning focus time', days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] }
      ],
      energy_prefs: {
        'morning': 'high',
        'afternoon': 'medium',
        'evening': 'low'
      },
      break_prefs: { interval_min: 90, break_min: 15 },
      interruption_budget_min: 30,
      privacy_mode: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Create dates for mock tasks
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfterTomorrow = new Date(today);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);

    // Load some sample data for development
    this.tasks = [
      {
        id: generateId(),
        user_id: 'mock-user',
        title: 'Review presentation slides',
        steps: [
          { text: 'Review content for accuracy', completed: false },
          { text: 'Check formatting and design', completed: false },
          { text: 'Practice presentation flow', completed: false }
        ],
        acceptance: 'All slides reviewed and notes taken for improvements',
        est_min: 90,
        est_most: 120,
        est_max: 150,
        energy: 'deep',
        deadline: tomorrow.toISOString(),
        tags: ['work', 'presentation'],
        context: 'Quiet workspace',
        source: 'manual',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: generateId(),
        user_id: 'mock-user',
        title: 'Send follow-up emails',
        steps: [{ text: 'Send follow-up emails', completed: true }],
        energy: 'shallow',
        tags: ['email', 'admin'],
        source: 'manual',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: generateId(),
        user_id: 'mock-user',
        title: 'Complete project proposal',
        steps: [
          { text: 'Research market requirements', completed: false },
          { text: 'Draft technical specifications', completed: false },
          { text: 'Create timeline and budget', completed: false },
          { text: 'Review with stakeholders', completed: false }
        ],
        acceptance: 'Proposal document approved and ready for submission',
        est_min: 180,
        est_most: 240,
        est_max: 300,
        energy: 'deep',
        deadline: dayAfterTomorrow.toISOString(),
        tags: ['project', 'writing', 'strategic'],
        source: 'manual',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: generateId(),
        user_id: 'mock-user',
        title: 'Plan weekly team meeting',
        steps: [
          { text: 'Review last week\'s action items', completed: false },
          { text: 'Prepare agenda topics', completed: false },
          { text: 'Book meeting room', completed: false }
        ],
        est_min: 30,
        est_most: 45,
        est_max: 60,
        energy: 'shallow',
        deadline: today.toISOString(),
        tags: ['meeting', 'planning'],
        source: 'manual',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: generateId(),
        user_id: 'mock-user',
        title: 'Update client documentation',
        steps: [
          { text: 'Review current documentation', completed: false },
          { text: 'Update outdated sections', completed: false },
          { text: 'Add new feature descriptions', completed: false }
        ],
        acceptance: 'Documentation is current and comprehensive',
        est_min: 60,
        est_most: 90,
        est_max: 120,
        energy: 'shallow',
        deadline: tomorrow.toISOString(),
        tags: ['documentation', 'client'],
        source: 'manual',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];

    // Add a sample schedule block for "next up"
    const now = new Date();
    const nextHour = new Date(now.getTime() + 60 * 60 * 1000);
    const twoHoursLater = new Date(nextHour.getTime() + 60 * 60 * 1000);
    
    this.scheduleBlocks = [
      {
        id: generateId(),
        user_id: 'mock-user',
        date: now.toISOString().split('T')[0],
        block_type: 'deep_work',
        task_id: this.tasks[0].id,
        start_at: nextHour.toISOString(),
        end_at: twoHoursLater.toISOString(),
        pinned: false,
        rationale: 'Focus time for presentation review',
        explain: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];
  }

  // Status Management
  getSyncStatus(): SyncStatus {
    return this.syncStatus;
  }

  onStatusChange(callback: (status: SyncStatus) => void) {
    this.statusListeners.push(callback);
    return () => {
      this.statusListeners = this.statusListeners.filter(cb => cb !== callback);
    };
  }

  // CRUD Operations - Tasks
  async getTasks(): Promise<Task[]> {
    return [...this.tasks.filter(task => !task.deleted_at)];
  }

  async createTask(task: Omit<Task, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<string> {
    const newTask = {
      ...task,
      id: generateId(),
      user_id: 'mock-user',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    this.tasks.push(newTask);
    this.emitDataUpdate('tasks');
    return newTask.id;
  }

  async updateTask(id: string, updates: Partial<Task>): Promise<string> {
    const index = this.tasks.findIndex(task => task.id === id);
    if (index >= 0) {
      this.tasks[index] = {
        ...this.tasks[index],
        ...updates,
        updated_at: new Date().toISOString()
      };
      this.emitDataUpdate('tasks');
    }
    return id;
  }

  async deleteTask(id: string): Promise<string> {
    const index = this.tasks.findIndex(task => task.id === id);
    if (index >= 0) {
      this.tasks[index].deleted_at = new Date().toISOString();
      this.emitDataUpdate('tasks');
    }
    return id;
  }

  // CRUD Operations - Events
  async getEvents(startDate?: string, endDate?: string): Promise<Event[]> {
    return [...this.events.filter(event => !event.deleted_at)];
  }

  async createEvent(event: Omit<Event, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<string> {
    const newEvent = {
      ...event,
      id: generateId(),
      user_id: 'mock-user',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    this.events.push(newEvent);
    this.emitDataUpdate('events');
    return newEvent.id;
  }

  // CRUD Operations - Outcomes
  async getOutcomes(): Promise<Outcome[]> {
    return [...this.outcomes.filter(outcome => !outcome.deleted_at)];
  }

  async createOutcome(outcome: Omit<Outcome, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<string> {
    const newOutcome = {
      ...outcome,
      id: generateId(),
      user_id: 'mock-user',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    this.outcomes.push(newOutcome);
    this.emitDataUpdate('outcomes');
    return newOutcome.id;
  }

  // CRUD Operations - Schedule Blocks
  async getScheduleBlocks(date: string): Promise<ScheduleBlock[]> {
    return [...this.scheduleBlocks.filter(block => block.date === date)];
  }

  async saveSchedule(date: string, blocks: Omit<ScheduleBlock, 'id' | 'user_id' | 'created_at' | 'updated_at'>[]): Promise<string> {
    // Remove existing blocks for the date
    this.scheduleBlocks = this.scheduleBlocks.filter(block => block.date !== date);

    // Add new blocks
    const newBlocks = blocks.map(block => ({
      ...block,
      id: generateId(),
      user_id: 'mock-user',
      date,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    this.scheduleBlocks.push(...newBlocks);
    this.emitDataUpdate('schedule_blocks');
    return 'batch-' + generateId();
  }

  // Settings
  async getSettings(): Promise<Settings | null> {
    return this.settings;
  }

  async updateSettings(settings: Partial<Settings>): Promise<string> {
    this.settings = {
      ...this.settings,
      ...settings,
      user_id: 'mock-user',
      updated_at: new Date().toISOString()
    } as Settings;
    
    return 'settings-update';
  }

  // CRUD Operations - Captured Items
  async getCapturedItems(): Promise<CapturedItem[]> {
    return [...this.capturedItems];
  }

  async createCapturedItem(item: Omit<CapturedItem, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<string> {
    const newItem = {
      ...item,
      id: generateId(),
      user_id: 'mock-user',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    this.capturedItems.push(newItem);
    this.emitDataUpdate('captured_items');
    return newItem.id;
  }

  async updateCapturedItem(id: string, updates: Partial<CapturedItem>): Promise<string> {
    const index = this.capturedItems.findIndex(item => item.id === id);
    if (index >= 0) {
      this.capturedItems[index] = {
        ...this.capturedItems[index],
        ...updates,
        updated_at: new Date().toISOString()
      };
      this.emitDataUpdate('captured_items');
    }
    return id;
  }

  async deleteCapturedItem(id: string): Promise<string> {
    this.capturedItems = this.capturedItems.filter(item => item.id !== id);
    this.emitDataUpdate('captured_items');
    return id;
  }

  // Accept task draft (direct write operation)
  async acceptTaskDraft(task: Omit<Task, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<string> {
    const newTask = {
      ...task,
      id: generateId(),
      user_id: 'mock-user',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    this.tasks.push(newTask);
    this.emitDataUpdate('tasks');
    console.log('MockDataStore: Accepted task draft:', newTask.title);
    return newTask.id;
  }

  // Record plan vs actual for tracking
  async recordPlanActual(
    taskId: string, 
    plannedMin: number, 
    actualMin: number, 
    blockers: string[] = [], 
    notes?: string
  ): Promise<string> {
    const historyEntry = {
      id: generateId(),
      user_id: 'mock-user',
      task_id: taskId,
      planned_dur_min: plannedMin,
      actual_dur_min: actualMin,
      deviation_min: actualMin - plannedMin,
      blockers: blockers as ('overrun' | 'interruption' | 'missing_info' | 'unrealistic_estimate')[],
      occurred_on: new Date().toISOString().split('T')[0],
      notes,
      created_at: new Date().toISOString()
    };

    this.history.push(historyEntry);
    console.log('MockDataStore: Recorded plan vs actual:', historyEntry);
    return historyEntry.id;
  }

  // Health check method
  isHealthy(): boolean {
    return true;
  }

  private emitDataUpdate(table: string) {
    // Emit update events for UI to refresh
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('data-updated', { 
        detail: { table, payload: {} } 
      }));
    }
  }

  // Cleanup
  destroy() {
    this.statusListeners = [];
  }
}

// Export singleton instance
export const mockDataStore = MockDataStore.getInstance();

// Default export for easier importing
export default mockDataStore;