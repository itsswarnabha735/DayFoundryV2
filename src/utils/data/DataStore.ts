import { supabase } from '../supabase/client';
import { generateId } from '../uuid';
import { authManager } from '../auth';
import { withTimeout, fetchWithTimeout, withRetry, CircuitBreaker, TimedCache } from '../timeout';
import { projectId, publicAnonKey } from '../supabase/info';

// Import debug utility for development
if (process.env.NODE_ENV === 'development') {
  import('../debug').then(module => {
    // Debug utilities loaded for development
  }).catch(() => {
    // Debug utilities not available
  });
}

// Types
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
  priority?: 'high' | 'medium' | 'low';
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

export interface CalendarEvent {
  id: string;
  calendar_connection_id: string;
  user_id: string;
  external_id: string;
  title: string;
  description?: string;
  start_at: string;
  end_at: string;
  location?: string;
  all_day: boolean;
  event_data: Record<string, any>;
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
  /** Base64 data URL of captured image (for camera source) */
  image_data?: string;
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

export interface QueuedOperation {
  id: string;
  op: 'upsert' | 'delete';
  table: string;
  payload: any;
  client_request_id: string;
  created_at: string;
  retries: number;
}

// Data Store Class
export class DataStore {
  private static instance: DataStore;
  private pendingOps: QueuedOperation[] = [];
  private isOnline = true;
  private syncStatus: SyncStatus = 'up-to-date';
  private lastServerAckTs = Date.now();
  private realtimeSubscriptions: any[] = [];
  private statusListeners: ((status: SyncStatus) => void)[] = [];
  private syncInterval?: NodeJS.Timeout;

  // Prevent accidental serialization of DataStore instance
  toJSON() {
    return {
      syncStatus: this.syncStatus,
      isOnline: this.isOnline,
      pendingOpsCount: this.pendingOps.length,
      lastServerAckTs: this.lastServerAckTs
    };
  }

  private constructor() {
    console.log('Initializing DataStore...');

    // Initialize arrays first to prevent undefined errors
    this.pendingOps = [];
    this.realtimeSubscriptions = [];
    this.statusListeners = [];

    // Initialize sync status and online state
    this.syncStatus = 'offline';
    this.isOnline = typeof navigator !== 'undefined' ? navigator.onLine : false;
    this.lastServerAckTs = Date.now();

    // Clear any potentially corrupted data on startup
    try {
      // Test if localStorage data is valid JSON
      if (typeof window !== 'undefined') {
        const testData = localStorage.getItem('df-pending-ops');
        if (testData) {
          const parsed = JSON.parse(testData);
          // Verify it's an array
          if (!Array.isArray(parsed)) {
            throw new Error('Invalid pending ops format');
          }
        }
      }
    } catch (error) {
      console.warn('Clearing corrupted localStorage data:', error instanceof Error ? error.message : 'Unknown error');
      if (typeof window !== 'undefined') {
        localStorage.removeItem('df-pending-ops');
        localStorage.removeItem('df-error-log');
      }
    }

    // Initialize in a safe way - don't fail hard
    setTimeout(() => {
      this.initialize().catch(error => {
        console.warn('DataStore initialization failed:', error?.message || 'Unknown error');
        this.syncStatus = 'offline';
      });
    }, 100);
  }

  private async initialize() {
    try {
      // Check if we're in a browser environment
      if (typeof window === 'undefined') {
        console.warn('DataStore initialized in non-browser environment');
        this.syncStatus = 'offline';
        return;
      }

      // Check if Supabase client is available
      if (!supabase) {
        console.warn('Supabase client not available, running in offline mode');
        this.syncStatus = 'offline';
        return;
      }

      // Check connection before proceeding
      const isConnected = await this.checkConnection();
      if (!isConnected) {
        console.warn('Initial connection check failed, running in offline mode');
        this.syncStatus = 'offline';
        // Still try to initialize other components in case connection comes back
      }

      // Check if user is available - if not, delay initialization
      const user = await authManager.getCurrentUser();
      if (!user) {
        // User not available yet, set to offline and skip realtime setup
        this.syncStatus = 'offline';
        console.log('DataStore initialized in offline mode - no user available');
        return;
      }

      console.log('Setting up DataStore components...');

      // Setup network listeners with error handling
      try {
        this.setupNetworkListeners();
      } catch (error) {
        console.warn('Failed to setup network listeners:', error);
      }

      // Load pending operations from localStorage with error handling
      try {
        this.loadPendingOps();
      } catch (error) {
        console.warn('Failed to load pending operations:', error);
        this.pendingOps = []; // Reset to empty on error
      }

      // Start sync loop with error handling
      try {
        this.startSyncLoop();
      } catch (error) {
        console.warn('Failed to start sync loop:', error);
      }

      // Setup realtime subscriptions after a short delay with error handling
      setTimeout(() => {
        try {
          this.setupRealtimeSubscriptions();
        } catch (error) {
          console.warn('Failed to setup realtime subscriptions:', error);
        }
      }, 1000);

      console.log('DataStore initialization completed successfully');
    } catch (error) {
      console.error('Error during DataStore initialization:', error instanceof Error ? error.message : 'Unknown error');
      // Set to offline mode on any error
      this.syncStatus = 'offline';

      // Ensure instance is still usable
      this.pendingOps = [];
      this.realtimeSubscriptions = [];
      this.statusListeners = [];
    }
  }

  static getInstance(): DataStore {
    if (!DataStore.instance) {
      console.log('Creating new DataStore instance...');
      try {
        DataStore.instance = new DataStore();
      } catch (error) {
        console.error('Failed to create DataStore instance:', error instanceof Error ? error.message : 'Unknown error');
        // Create a minimal fallback instance that won't cause circular reference errors
        const fallbackInstance = Object.create(DataStore.prototype);
        fallbackInstance.pendingOps = [];
        fallbackInstance.realtimeSubscriptions = [];
        fallbackInstance.statusListeners = [];
        fallbackInstance.syncStatus = 'offline';
        fallbackInstance.isOnline = false;
        fallbackInstance.lastServerAckTs = Date.now();

        // Add essential methods
        fallbackInstance.getCapturedItems = async () => [];
        fallbackInstance.createCapturedItem = async () => 'fallback-id';
        fallbackInstance.updateCapturedItem = async () => 'fallback-id';
        fallbackInstance.deleteCapturedItem = async () => 'fallback-id';
        fallbackInstance.getTasks = async () => [];
        fallbackInstance.createTask = async () => 'fallback-id';
        fallbackInstance.updateTask = async () => 'fallback-id';
        fallbackInstance.deleteTask = async () => 'fallback-id';
        fallbackInstance.getEvents = async () => [];
        fallbackInstance.createEvent = async () => 'fallback-id';
        fallbackInstance.updateEvent = async () => 'fallback-id';
        fallbackInstance.deleteEvent = async () => 'fallback-id';
        fallbackInstance.getCalendarEvents = async () => [];
        fallbackInstance.getOutcomes = async () => [];
        fallbackInstance.createOutcome = async () => 'fallback-id';
        fallbackInstance.updateOutcome = async () => 'fallback-id';
        fallbackInstance.deleteOutcome = async () => 'fallback-id';
        fallbackInstance.getScheduleBlocks = async () => [];
        fallbackInstance.createScheduleBlock = async () => 'fallback-id';
        fallbackInstance.updateScheduleBlock = async () => 'fallback-id';
        fallbackInstance.deleteScheduleBlock = async () => 'fallback-id';
        fallbackInstance.getSettings = async () => null;
        fallbackInstance.createSettings = async () => 'fallback-id';
        fallbackInstance.updateSettings = async () => 'fallback-id';
        fallbackInstance.getHistory = async () => [];
        fallbackInstance.createHistory = async () => 'fallback-id';
        fallbackInstance.getTodayScheduleBlocks = async () => [];
        fallbackInstance.getUpcomingEvents = async () => [];
        fallbackInstance.getRecentHistory = async () => [];
        fallbackInstance.batchCreateTasks = async () => [];
        fallbackInstance.batchCreateEvents = async () => [];
        fallbackInstance.acceptTaskDraft = async () => 'fallback-id';
        fallbackInstance.clearAllData = async () => { };
        fallbackInstance.getSyncStatus = () => 'offline';
        fallbackInstance.isHealthy = () => false;
        fallbackInstance.isInitialized = () => true;
        fallbackInstance.onStatusChange = () => () => { };

        // Add toJSON method to prevent serialization issues
        fallbackInstance.toJSON = () => ({
          syncStatus: 'offline',
          isOnline: false,
          pendingOpsCount: 0,
          lastServerAckTs: Date.now()
        });

        DataStore.instance = fallbackInstance;
      }
    } else {
      console.log('Returning existing DataStore instance');
    }
    return DataStore.instance;
  }

  // Health check method
  isHealthy(): boolean {
    try {
      // Simple health check - verify basic functionality
      return this.syncStatus !== undefined &&
        Array.isArray(this.pendingOps) &&
        Array.isArray(this.realtimeSubscriptions) &&
        Array.isArray(this.statusListeners) &&
        typeof this.getCapturedItems === 'function' &&
        typeof this.createCapturedItem === 'function' &&
        typeof this.getTasks === 'function' &&
        typeof this.getEvents === 'function' &&
        typeof this.getCalendarEvents === 'function' &&
        typeof this.getOutcomes === 'function' &&
        typeof this.getScheduleBlocks === 'function' &&
        typeof this.getSettings === 'function' &&
        typeof this.getHistory === 'function' &&
        !!supabase;
    } catch (error) {
      console.error('DataStore health check failed:', error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }

  // Check if DataStore is properly initialized
  isInitialized(): boolean {
    try {
      return this.pendingOps !== undefined &&
        this.realtimeSubscriptions !== undefined &&
        this.statusListeners !== undefined &&
        this.syncStatus !== undefined;
    } catch (error) {
      console.error('DataStore initialization check failed:', error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }

  // Status Management
  getSyncStatus(): SyncStatus {
    try {
      return this.syncStatus || 'offline';
    } catch (error) {
      console.error('Error getting sync status:', error instanceof Error ? error.message : 'Unknown error');
      return 'offline';
    }
  }

  onStatusChange(callback: (status: SyncStatus) => void) {
    this.statusListeners.push(callback);
    return () => {
      this.statusListeners = this.statusListeners.filter(cb => cb !== callback);
    };
  }

  private updateSyncStatus() {
    const now = Date.now();
    const timeSinceLastAck = now - this.lastServerAckTs;

    let newStatus: SyncStatus;

    if (!this.isOnline) {
      newStatus = 'offline';
    } else if (this.pendingOps.length > 0 || timeSinceLastAck > 60000) {
      newStatus = 'syncing';
    } else {
      newStatus = 'up-to-date';
    }

    if (newStatus !== this.syncStatus) {
      this.syncStatus = newStatus;
      this.statusListeners.forEach(cb => cb(newStatus));
    }
  }

  // Connection Check
  private async checkConnection(): Promise<boolean> {
    try {
      if (typeof window === 'undefined' || !navigator.onLine) {
        return false;
      }

      console.log('Checking connection to Supabase...');

      // Use the Supabase client to check connection instead of raw fetch to root URL
      // This avoids CORS issues and correctly uses the API key
      const { error } = await supabase
        .from('settings')
        .select('user_id')
        .limit(1)
        .maybeSingle();

      if (error) {
        // If it's a network error, it will likely throw or return a specific error
        // If it's just an empty table or auth error, we are still "connected"
        console.log('Connection check response:', error.message);
        // We consider it connected unless it's a fetch failure
        if (error.message && error.message.includes('Failed to fetch')) {
          return false;
        }
      }

      console.log('Connection check successful');
      return true;
    } catch (error) {
      console.error('Error checking connection:', error);
      return false;
    }
  }

  // Network & Connectivity
  private setupNetworkListeners() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.isOnline = true;
        this.updateSyncStatus();
        this.flushPendingOps();
      });

      window.addEventListener('offline', () => {
        this.isOnline = false;
        this.updateSyncStatus();
      });

      this.isOnline = navigator.onLine;
    }
  }

  // Realtime Subscriptions
  private async setupRealtimeSubscriptions() {
    try {
      if (!supabase) {
        console.warn('Supabase not available for realtime subscriptions');
        return;
      }

      const user = await authManager.getCurrentUser();
      if (!user) {
        // Silently skip realtime subscriptions if no user - this is expected during initialization
        return;
      }

      console.log('Setting up realtime subscriptions for user:', user.id);

      // Clear any existing subscriptions
      this.realtimeSubscriptions.forEach(sub => {
        try {
          if (sub && typeof sub.unsubscribe === 'function') {
            sub.unsubscribe();
          }
        } catch (error) {
          console.warn('Error cleaning up old subscription:', error);
        }
      });
      this.realtimeSubscriptions = [];

      // Subscribe to captured_items with error handling
      try {
        const capturedItemsSubscription = supabase
          .channel('captured_items_' + user.id.slice(-8))
          .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'captured_items',
            filter: `user_id=eq.${user.id}`
          }, (payload) => {
            try {
              this.handleRealtimeUpdate('captured_items', payload);
            } catch (error) {
              console.warn('Error handling captured_items update:', error);
            }
          })
          .subscribe();

        this.realtimeSubscriptions.push(capturedItemsSubscription);
      } catch (error) {
        console.warn('Failed to setup captured_items subscription:', error);
      }

      // Subscribe to tasks with error handling
      try {
        const tasksSubscription = supabase
          .channel('tasks_' + user.id.slice(-8))
          .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'tasks',
            filter: `user_id=eq.${user.id}`
          }, (payload) => {
            try {
              this.handleRealtimeUpdate('tasks', payload);
            } catch (error) {
              console.warn('Error handling tasks update:', error instanceof Error ? error.message : 'Unknown error');
            }
          })
          .subscribe();

        this.realtimeSubscriptions.push(tasksSubscription);
      } catch (error) {
        console.warn('Failed to setup tasks subscription:', error instanceof Error ? error.message : 'Unknown error');
      }

      // Subscribe to schedule_blocks with error handling
      try {
        const scheduleBlocksSubscription = supabase
          .channel('schedule_blocks_' + user.id.slice(-8))
          .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'schedule_blocks',
            filter: `user_id=eq.${user.id}`
          }, (payload) => {
            try {
              this.handleRealtimeUpdate('schedule_blocks', payload);
            } catch (error) {
              console.warn('Error handling schedule_blocks update:', error instanceof Error ? error.message : 'Unknown error');
            }
          })
          .subscribe();

        this.realtimeSubscriptions.push(scheduleBlocksSubscription);
      } catch (error) {
        console.warn('Failed to setup schedule_blocks subscription:', error instanceof Error ? error.message : 'Unknown error');
      }

      console.log(`Setup ${this.realtimeSubscriptions.length} realtime subscriptions`);
    } catch (error) {
      console.error('Failed to setup realtime subscriptions:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  private handleRealtimeUpdate(table: string, payload: any) {
    try {
      this.lastServerAckTs = Date.now();
      this.updateSyncStatus();

      // Create a safe payload without circular references
      const safePayload = {
        eventType: payload.eventType || 'unknown',
        table: table,
        timestamp: Date.now()
      };

      // Emit update events for UI to refresh
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('data-updated', {
          detail: safePayload
        }));
      }
    } catch (error) {
      console.warn('Error handling realtime update:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  // Queue Management
  private loadPendingOps() {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('df-pending-ops');
      if (saved) {
        try {
          const parsedOps = JSON.parse(saved);
          // Ensure ops are clean objects without circular references
          this.pendingOps = parsedOps.map((op: any) => ({
            id: op.id || '',
            op: op.op || 'upsert',
            table: op.table || '',
            payload: op.payload || {},
            client_request_id: op.client_request_id || '',
            created_at: op.created_at || new Date().toISOString(),
            retries: op.retries || 0
          }));
        } catch (error) {
          console.error('Failed to load pending ops:', error instanceof Error ? error.message : 'Unknown error');
          this.pendingOps = [];
          // Clear corrupted data
          localStorage.removeItem('df-pending-ops');
        }
      }
    }
  }

  private savePendingOps() {
    if (typeof window !== 'undefined') {
      try {
        // Create safe copies without circular references
        const safeOps = this.pendingOps.map(op => {
          // Deep clone to avoid circular references
          const safePayload = this.createSafePayload(op.payload);

          return {
            id: String(op.id || ''),
            op: String(op.op || 'upsert'),
            table: String(op.table || ''),
            payload: safePayload,
            client_request_id: String(op.client_request_id || ''),
            created_at: String(op.created_at || new Date().toISOString()),
            retries: Number(op.retries || 0)
          };
        });

        // Test serialization before saving
        const serialized = JSON.stringify(safeOps);
        localStorage.setItem('df-pending-ops', serialized);
      } catch (error) {
        console.error('Failed to save pending ops:', error instanceof Error ? error.message : 'Unknown error');
        // If serialization fails, try to save a minimal version
        try {
          const minimalOps = this.pendingOps.map(op => ({
            id: String(op.id || ''),
            op: String(op.op || 'upsert'),
            table: String(op.table || ''),
            payload: {}, // Empty payload as fallback
            client_request_id: String(op.client_request_id || ''),
            created_at: String(op.created_at || new Date().toISOString()),
            retries: Number(op.retries || 0)
          }));
          localStorage.setItem('df-pending-ops', JSON.stringify(minimalOps));
          console.warn('Saved minimal pending ops without payloads due to serialization error');
        } catch (fallbackError) {
          console.error('Even minimal serialization failed, clearing pending ops');
          localStorage.removeItem('df-pending-ops');
          this.pendingOps = [];
        }
      }
    }
  }

  private createSafePayload(payload: any, seen = new WeakSet()): any {
    if (payload === null || payload === undefined) {
      return payload;
    }

    if (typeof payload !== 'object') {
      return payload;
    }

    // Prevent circular references by tracking seen objects
    if (seen.has(payload)) {
      return '[Circular Reference]';
    }

    // Test if the object can be safely stringified first
    try {
      JSON.stringify(payload);
    } catch (circularError) {
      console.warn('Detected circular reference in payload, creating safe copy');
      return this.createSafeObjectCopy(payload, seen);
    }

    return this.createSafeObjectCopy(payload, seen);
  }

  private createSafeObjectCopy(payload: any, seen: WeakSet<object>): any {
    if (payload === null || payload === undefined || typeof payload !== 'object') {
      return payload;
    }

    // Mark this object as seen to prevent infinite recursion
    seen.add(payload);

    try {
      // Handle arrays
      if (Array.isArray(payload)) {
        return payload.map(item => this.createSafePayload(item, seen));
      }

      // Create a safe copy without circular references or complex objects
      const safeCopy: any = {};

      for (const key in payload) {
        if (payload.hasOwnProperty(key)) {
          const value = payload[key];

          // Skip functions, symbols, and potentially problematic objects
          if (typeof value === 'function' ||
            typeof value === 'symbol' ||
            value === payload || // Avoid self-references
            (value && typeof value === 'object' && value.constructor &&
              (value.constructor.name === 'RealtimeClient' ||
                value.constructor.name === 'RealtimeChannel' ||
                value.constructor.name === 'SupabaseClient' ||
                value.constructor.name === 'WebSocket' ||
                value.constructor.name === 'EventTarget' ||
                key === 'socket' ||
                key === 'channels' ||
                key === '_listeners' ||
                key === '_events' ||
                key === 'subscriptions'))) {
            continue;
          }

          // Handle nested objects recursively
          if (value && typeof value === 'object') {
            if (seen.has(value)) {
              safeCopy[key] = '[Circular Reference]';
            } else {
              try {
                safeCopy[key] = this.createSafePayload(value, seen);
              } catch (nestedError) {
                console.warn(`Skipping key ${key} due to serialization error:`, nestedError instanceof Error ? nestedError.message : 'Unknown error');
                safeCopy[key] = null;
              }
            }
          } else {
            safeCopy[key] = value;
          }
        }
      }

      return safeCopy;
    } catch (error) {
      console.warn('Could not create safe payload, using empty object:', error instanceof Error ? error.message : 'Unknown error');
      return {};
    }
  }

  // Helper method to get auth headers with comprehensive token validation
  private async getAuthHeaders(): Promise<Record<string, string>> {
    try {
      // Step 1: Try to get current session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (session?.access_token && !sessionError) {
        // Validate token format - JWT should have 3 parts separated by dots
        const tokenParts = session.access_token.split('.');
        if (tokenParts.length === 3) {
          try {
            // Decode the payload to check if it has required claims
            const payload = JSON.parse(atob(tokenParts[1]));
            if (payload.sub && payload.exp && payload.exp > Date.now() / 1000) {
              return {
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json'
              };
            }
          } catch (decodeError) {
            console.warn('Token decode failed:', decodeError);
          }
        }
      }

      console.log('Current session invalid, attempting refresh...');

      // Step 2: Try to refresh the session
      const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();

      if (refreshedSession?.access_token && !refreshError) {
        const tokenParts = refreshedSession.access_token.split('.');
        if (tokenParts.length === 3) {
          try {
            const payload = JSON.parse(atob(tokenParts[1]));
            if (payload.sub && payload.exp && payload.exp > Date.now() / 1000) {
              return {
                'Authorization': `Bearer ${refreshedSession.access_token}`,
                'Content-Type': 'application/json'
              };
            }
          } catch (decodeError) {
            console.warn('Refreshed token decode failed:', decodeError);
          }
        }
      }

      console.warn('Session refresh failed, checking current user...');

      // Step 3: Try to get user and session directly
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (user && !userError) {
        // User exists, try one more session refresh
        const { data: { session: finalSession }, error: finalError } = await supabase.auth.refreshSession();
        if (finalSession?.access_token && !finalError) {
          return {
            'Authorization': `Bearer ${finalSession.access_token}`,
            'Content-Type': 'application/json'
          };
        }
      }

      // Step 4: If user exists but no valid session, they need to re-authenticate
      if (user && !userError) {
        console.error('User exists but no valid session - auth state corrupted');
        // Trigger re-authentication by signing out
        await authManager.signOut();
        throw new Error('Authentication required - please sign in again');
      }

    } catch (error) {
      console.error('Failed to get auth headers:', error);
    }

    // Final fallback: no authentication available
    throw new Error('No valid authentication available');
  }

  // Accept Task Draft - Converts task data to a Task
  async acceptTaskDraft(taskData: any): Promise<string> {
    const user = await authManager.getCurrentUser();
    if (!user) throw new Error('User not authenticated');

    try {
      // Create the task from the provided data
      const taskId = generateId();

      const newTask: Task = {
        id: taskId,
        user_id: user.id,
        title: taskData.title,
        steps: taskData.steps || [],
        acceptance: taskData.acceptance,
        est_min: taskData.est_min || 30,
        est_most: taskData.est_most || 45,
        est_max: taskData.est_max || 60,
        energy: taskData.energy || 'shallow',
        deadline: taskData.deadline,
        tags: taskData.tags || [],
        context: taskData.context || '',
        location: taskData.location || '',
        source: taskData.source || 'task_draft',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Create the task using direct Supabase operation
      const operation = async () => {
        const { data: createdTaskData, error: taskError } = await supabase
          .from('tasks')
          .insert(newTask)
          .select()
          .single();

        if (taskError) {
          console.error('Failed to create task from draft:', taskError);
          throw taskError;
        }

        return createdTaskData;
      };

      const createdTask = await withTimeout(operation(), {
        timeoutMs: 30000,
        timeoutMessage: 'Accept task draft operation timed out'
      });

      this.lastServerAckTs = Date.now();
      this.updateSyncStatus();

      return createdTask.id;
    } catch (error) {
      console.error('Failed to accept task draft:', error);
      throw error;
    }
  }

  // Server API call helper with robust error handling
  private async callServerAPI(endpoint: string, options: RequestInit = {}): Promise<any> {
    const maxRetries = 2;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const headers = await this.getAuthHeaders();
        const url = `https://${projectId}.supabase.co/functions/v1/make-server-72dfd380${endpoint}`;

        const response = await fetchWithTimeout(url, {
          ...options,
          headers: {
            ...headers,
            ...options.headers
          }
        }, { timeoutMs: 15000 });

        if (!response.ok) {
          const errorData = await response.text();

          // If it's an auth error and we haven't exhausted retries, try refreshing
          if (response.status === 401 && attempt < maxRetries) {
            console.log(`Auth error on attempt ${attempt}, will retry with fresh session...`);
            lastError = new Error(`Server API error ${response.status}: ${errorData}`);
            continue; // Try again with fresh auth headers
          }

          console.error(`Server API error ${response.status} for ${endpoint}:`, errorData);
          throw new Error(`Server API error ${response.status}: ${errorData}`);
        }

        return await response.json();

      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        console.error(`Server API call attempt ${attempt} failed for ${endpoint}:`, err.message);
        lastError = err;

        // If it's an auth error, continue to retry
        if (err.message.includes('No valid authentication') && attempt < maxRetries) {
          console.log(`Auth issue on attempt ${attempt}, will retry...`);
          continue;
        }

        // For other errors, don't retry
        if (attempt === maxRetries || (!err.message.includes('401') && !err.message.includes('auth'))) {
          throw err;
        }
      }
    }

    throw lastError || new Error(`Failed after ${maxRetries} attempts`);
  }

  // CRUD Operations - Captured Items (Direct Supabase with RLS)
  async getCapturedItems(): Promise<CapturedItem[]> {
    try {
      // Use direct Supabase query with user context
      const user = await authManager.getCurrentUser();
      if (!user) {
        console.warn('No authenticated user for getCapturedItems');
        return [];
      }

      const operation = async () => {
        const { data, error } = await supabase
          .from('captured_items')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Direct Supabase query failed:', error);
          throw error;
        }
        return data || [];
      };

      const data = await withTimeout(operation(), {
        timeoutMs: 30000,
        timeoutMessage: 'Failed to load captured items: request timed out'
      });

      this.lastServerAckTs = Date.now();
      this.updateSyncStatus();
      return data;
    } catch (error) {
      console.error('Error fetching captured items:', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  async createCapturedItem(item: Omit<CapturedItem, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<string> {
    const id = generateId();
    const user = await authManager.getCurrentUser();
    if (!user) throw new Error('User not authenticated');

    const newItem = {
      ...item,
      id,
      user_id: user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    try {
      // Use direct Supabase operation with proper user context
      const operation = async () => {
        const { data, error } = await supabase
          .from('captured_items')
          .insert(newItem)
          .select()
          .single();

        if (error) {
          console.error('Direct Supabase insert failed:', error);
          throw error;
        }
        return data;
      };

      const data = await withTimeout(operation(), {
        timeoutMs: 30000,
        timeoutMessage: 'Create operation timed out'
      });

      this.lastServerAckTs = Date.now();
      this.updateSyncStatus();
      return data.id;
    } catch (error) {
      console.error('Failed to create captured item, queuing locally:', error);

      // Fallback to local queuing for offline capability
      return this.queueOperation('upsert', 'captured_items', newItem);
    }
  }

  async updateCapturedItem(id: string, updates: Partial<CapturedItem>): Promise<string> {
    const user = await authManager.getCurrentUser();
    if (!user) throw new Error('User not authenticated');

    const updatedItem = {
      ...updates,
      id,
      updated_at: new Date().toISOString()
    };

    try {
      // Use direct Supabase operation with user context
      const operation = async () => {
        const { data, error } = await supabase
          .from('captured_items')
          .update(updatedItem)
          .eq('id', id)
          .eq('user_id', user.id) // Ensure user can only update their own items
          .select()
          .single();

        if (error) {
          console.error('Direct Supabase update failed:', error);
          throw error;
        }
        return data;
      };

      const data = await withTimeout(operation(), {
        timeoutMs: 30000,
        timeoutMessage: 'Update operation timed out'
      });

      this.lastServerAckTs = Date.now();
      this.updateSyncStatus();
      return data.id;
    } catch (error) {
      console.error('Failed to update captured item, queuing locally:', error);

      // Fallback to local queuing for offline capability
      return this.queueOperation('upsert', 'captured_items', updatedItem);
    }
  }

  async deleteCapturedItem(id: string): Promise<string> {
    const user = await authManager.getCurrentUser();
    if (!user) throw new Error('User not authenticated');

    try {
      // Use direct Supabase operation with user context
      const operation = async () => {
        const { error } = await supabase
          .from('captured_items')
          .delete()
          .eq('id', id)
          .eq('user_id', user.id); // Ensure user can only delete their own items

        if (error) {
          console.error('Direct Supabase delete failed:', error);
          throw error;
        }
        return { id };
      };

      await withTimeout(operation(), {
        timeoutMs: 30000,
        timeoutMessage: 'Delete operation timed out'
      });

      this.lastServerAckTs = Date.now();
      this.updateSyncStatus();
      return id;
    } catch (error) {
      console.error('Failed to delete captured item, queuing locally:', error);

      // Fallback to local queuing for offline capability
      return this.queueOperation('delete', 'captured_items', { id });
    }
  }

  private queueOperation(op: 'upsert' | 'delete', table: string, payload: any): string {
    const id = generateId();

    // Create a safe payload to prevent circular references from entering the queue
    const safePayload = this.createSafePayload(payload);

    const queuedOp: QueuedOperation = {
      id,
      op,
      table,
      payload: safePayload,
      client_request_id: generateId(),
      created_at: new Date().toISOString(),
      retries: 0
    };

    this.pendingOps.push(queuedOp);
    this.savePendingOps();
    this.updateSyncStatus();

    // Attempt immediate sync if online
    if (this.isOnline) {
      this.flushPendingOps();
    }

    return id;
  }

  // Sync Operations
  private startSyncLoop() {
    this.syncInterval = setInterval(() => {
      this.updateSyncStatus();
      if (this.isOnline && this.pendingOps.length > 0) {
        this.flushPendingOps();
      }
    }, 10000); // Check every 10 seconds
  }

  private async flushPendingOps() {
    if (!this.isOnline || this.pendingOps.length === 0) return;

    const ops = [...this.pendingOps];

    for (const op of ops) {
      try {
        await this.executeOperation(op);

        // Remove successful operation
        this.pendingOps = this.pendingOps.filter(o => o.id !== op.id);
        this.savePendingOps();
        this.lastServerAckTs = Date.now();

      } catch (error) {
        console.error('Failed to sync operation:', error);

        // Increment retry count
        const opIndex = this.pendingOps.findIndex(o => o.id === op.id);
        if (opIndex >= 0) {
          this.pendingOps[opIndex].retries++;

          // Remove after too many retries
          if (this.pendingOps[opIndex].retries > 5) {
            this.pendingOps.splice(opIndex, 1);
            console.error('Dropping operation after too many retries:', op);
          }
        }

        this.savePendingOps();
        break; // Stop processing on error
      }
    }

    this.updateSyncStatus();
  }

  private async executeOperation(op: QueuedOperation) {
    if (!supabase) {
      throw new Error('Supabase not available');
    }

    const { table, payload } = op;
    const user = await authManager.getCurrentUser();

    if (!user) {
      throw new Error('User not authenticated for operation');
    }

    try {
      // Use direct Supabase operations for all tables with proper user context
      if (op.op === 'upsert') {
        const operation = async () => {
          // Ensure user_id is set for user-owned tables
          let finalPayload: any;

          if (Array.isArray(payload)) {
            finalPayload = payload.map(item =>
              ['captured_items', 'tasks', 'events', 'outcomes', 'schedule_blocks', 'history'].includes(table)
                ? { ...item, user_id: user.id }
                : item
            );
          } else {
            finalPayload = ['captured_items', 'tasks', 'events', 'outcomes', 'schedule_blocks', 'history'].includes(table)
              ? { ...payload, user_id: user.id }
              : payload;
          }

          const { error } = await supabase
            .from(table)
            .upsert(finalPayload, { onConflict: 'id' });

          if (error) {
            console.error(`Upsert operation failed for table ${table}:`, error);
            throw error;
          }
        };

        await withTimeout(operation(), {
          timeoutMs: 15000,
          timeoutMessage: `Upsert operation timed out for table ${table}`
        });

      } else if (op.op === 'delete') {
        const operation = async () => {
          let query = supabase.from(table).delete().eq('id', payload.id);

          // Add user_id filter for user-owned tables to prevent cross-user deletions
          if (['captured_items', 'tasks', 'events', 'outcomes', 'schedule_blocks', 'history'].includes(table)) {
            query = query.eq('user_id', user.id);
          }

          const { error } = await query;

          if (error) {
            console.error(`Delete operation failed for table ${table}:`, error);
            throw error;
          }
        };

        await withTimeout(operation(), {
          timeoutMs: 15000,
          timeoutMessage: `Delete operation timed out for table ${table}`
        });
      }
    } catch (error) {
      console.error(`Operation ${op.op} failed for ${table}:`, error);
      throw error;
    }
  }

  // CRUD Operations - Tasks (keeping existing direct Supabase implementation for now)
  async getTasks(): Promise<Task[]> {
    try {
      const operation = async () => {
        const { data, error } = await supabase
          .from('tasks')
          .select('*')
          .is('deleted_at', null)
          .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
      };

      const data = await withTimeout(operation(), {
        timeoutMs: 30000,
        timeoutMessage: 'Failed to load tasks: request timed out'
      });

      this.lastServerAckTs = Date.now();
      this.updateSyncStatus();
      return data || [];
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
      return [];
    }
  }

  async createTask(task: Omit<Task, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<string> {
    const user = await authManager.getCurrentUser();
    if (!user) throw new Error('User not authenticated');

    const newTask = {
      ...task,
      id: generateId(),
      user_id: user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    return this.queueOperation('upsert', 'tasks', newTask);
  }

  async updateTask(id: string, updates: Partial<Task>): Promise<string> {
    const updatedTask = {
      ...updates,
      id,
      updated_at: new Date().toISOString()
    };

    return this.queueOperation('upsert', 'tasks', updatedTask);
  }

  async deleteTask(id: string): Promise<string> {
    return this.queueOperation('delete', 'tasks', { id });
  }

  // CRUD Operations - Outcomes
  async createOutcome(outcome: Omit<Outcome, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<string> {
    const user = await authManager.getCurrentUser();
    if (!user) throw new Error('User not authenticated');

    const newOutcome = {
      ...outcome,
      id: generateId(),
      user_id: user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    return this.queueOperation('upsert', 'outcomes', newOutcome);
  }

  // CRUD Operations - Events
  async getEvents(): Promise<Event[]> {
    try {
      const operation = async () => {
        const { data, error } = await supabase
          .from('events')
          .select('*')
          .is('deleted_at', null)
          .order('start_at', { ascending: true });

        if (error) throw error;
        return data || [];
      };

      const data = await withTimeout(operation(), {
        timeoutMs: 30000,
        timeoutMessage: 'Failed to load events: request timed out'
      });

      this.lastServerAckTs = Date.now();
      this.updateSyncStatus();
      return data || [];
    } catch (error) {
      console.error('Failed to fetch events:', error);
      return [];
    }
  }

  async createEvent(event: Omit<Event, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<string> {
    const user = await authManager.getCurrentUser();
    if (!user) throw new Error('User not authenticated');

    const newEvent = {
      ...event,
      id: generateId(),
      user_id: user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    return this.queueOperation('upsert', 'events', newEvent);
  }

  async updateEvent(id: string, updates: Partial<Event>): Promise<string> {
    const updatedEvent = {
      ...updates,
      id,
      updated_at: new Date().toISOString()
    };

    return this.queueOperation('upsert', 'events', updatedEvent);
  }

  async deleteEvent(id: string): Promise<string> {
    return this.queueOperation('delete', 'events', { id });
  }

  // CRUD Operations - Calendar Events (Synced)
  async getCalendarEvents(): Promise<CalendarEvent[]> {
    try {
      const operation = async () => {
        const { data, error } = await supabase
          .from('calendar_events')
          .select('*')
          .order('start_at', { ascending: true });

        if (error) throw error;
        return data || [];
      };

      const data = await withTimeout(operation(), {
        timeoutMs: 30000,
        timeoutMessage: 'Failed to load calendar events: request timed out'
      });

      this.lastServerAckTs = Date.now();
      this.updateSyncStatus();
      return data || [];
    } catch (error) {
      console.error('Failed to fetch calendar events:', error);
      return [];
    }
  }

  // CRUD Operations - Outcomes
  async getOutcomes(): Promise<Outcome[]> {
    try {
      const operation = async () => {
        const { data, error } = await supabase
          .from('outcomes')
          .select('*')
          .is('deleted_at', null)
          .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
      };

      const data = await withTimeout(operation(), {
        timeoutMs: 30000,
        timeoutMessage: 'Failed to load outcomes: request timed out'
      });

      this.lastServerAckTs = Date.now();
      this.updateSyncStatus();
      return data || [];
    } catch (error) {
      console.error('Failed to fetch outcomes:', error);
      return [];
    }
  }

  async updateOutcome(id: string, updates: Partial<Outcome>): Promise<string> {
    const updatedOutcome = {
      ...updates,
      id,
      updated_at: new Date().toISOString()
    };

    return this.queueOperation('upsert', 'outcomes', updatedOutcome);
  }

  async deleteOutcome(id: string): Promise<string> {
    return this.queueOperation('delete', 'outcomes', { id });
  }

  // CRUD Operations - Schedule Blocks
  async getScheduleBlocks(): Promise<ScheduleBlock[]> {
    try {
      const operation = async () => {
        const { data, error } = await supabase
          .from('schedule_blocks')
          .select('*')
          .order('start_time', { ascending: true });

        if (error) {
          console.error('Supabase select error for schedule_blocks:', error);
          throw error;
        }
        return data || [];
      };

      const data = await withTimeout(operation(), {
        timeoutMs: 30000,
        timeoutMessage: 'Failed to load schedule blocks: request timed out'
      });

      this.lastServerAckTs = Date.now();
      this.updateSyncStatus();
      return data || [];
    } catch (error) {
      console.error('Failed to fetch schedule blocks:', error);
      if (error && typeof error === 'object' && 'message' in error) {
        console.error('Error message:', (error as any).message);
      }
      if (error && typeof error === 'object' && 'details' in error) {
        console.error('Error details:', (error as any).details);
      }
      if (error && typeof error === 'object' && 'hint' in error) {
        console.error('Error hint:', (error as any).hint);
      }
      return [];
    }
  }

  async createScheduleBlock(block: Omit<ScheduleBlock, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<string> {
    const user = await authManager.getCurrentUser();
    if (!user) throw new Error('User not authenticated');

    const newBlock = {
      ...block,
      id: generateId(),
      user_id: user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    return this.queueOperation('upsert', 'schedule_blocks', newBlock);
  }

  async saveScheduleBlocks(blocks: ScheduleBlock[]): Promise<void> {
    const user = await authManager.getCurrentUser();
    if (!user) throw new Error('User not authenticated');

    const blocksToSave = blocks.map(block => ({
      ...block,
      user_id: user.id,
      updated_at: new Date().toISOString()
    }));

    // We use queueOperation but we don't need the returned ID for bulk ops
    await this.queueOperation('upsert', 'schedule_blocks', blocksToSave);
  }

  async updateScheduleBlock(id: string, updates: Partial<ScheduleBlock>): Promise<string> {
    const updatedBlock = {
      ...updates,
      id,
      updated_at: new Date().toISOString()
    };

    return this.queueOperation('upsert', 'schedule_blocks', updatedBlock);
  }

  async deleteScheduleBlock(id: string): Promise<string> {
    return this.queueOperation('delete', 'schedule_blocks', { id });
  }

  // CRUD Operations - Settings
  async getSettings(): Promise<Settings | null> {
    try {
      const user = await authManager.getCurrentUser();
      if (!user) throw new Error('User not authenticated');

      const operation = async () => {
        const { data, error } = await supabase
          .from('settings')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) {
          if (error.code === 'PGRST116') {
            // No settings found, return null
            return null;
          }
          throw error;
        }
        return data;
      };

      const data = await withTimeout(operation(), {
        timeoutMs: 30000,
        timeoutMessage: 'Failed to load settings: request timed out'
      });

      this.lastServerAckTs = Date.now();
      this.updateSyncStatus();
      return data;
    } catch (error) {
      console.error('Failed to fetch settings:', error);
      return null;
    }
  }

  async createSettings(settings: Omit<Settings, 'user_id' | 'created_at' | 'updated_at'>): Promise<string> {
    const user = await authManager.getCurrentUser();
    if (!user) throw new Error('User not authenticated');

    const newSettings = {
      ...settings,
      user_id: user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    return this.queueOperation('upsert', 'settings', newSettings);
  }

  async updateSettings(updates: Partial<Settings>): Promise<string> {
    const user = await authManager.getCurrentUser();
    if (!user) throw new Error('User not authenticated');

    const updatedSettings = {
      ...updates,
      user_id: user.id,
      updated_at: new Date().toISOString()
    };

    return this.queueOperation('upsert', 'settings', updatedSettings);
  }

  // CRUD Operations - History
  async getHistory(): Promise<History[]> {
    try {
      const operation = async () => {
        const { data, error } = await supabase
          .from('history')
          .select('*')
          .order('occurred_on', { ascending: false });

        if (error) throw error;
        return data || [];
      };

      const data = await withTimeout(operation(), {
        timeoutMs: 10000,
        timeoutMessage: 'Failed to load history: request timed out'
      });

      this.lastServerAckTs = Date.now();
      this.updateSyncStatus();
      return data || [];
    } catch (error) {
      console.error('Failed to fetch history:', error);
      return [];
    }
  }

  async createHistory(history: Omit<History, 'id' | 'user_id' | 'created_at'>): Promise<string> {
    const user = await authManager.getCurrentUser();
    if (!user) throw new Error('User not authenticated');

    const newHistory = {
      ...history,
      id: generateId(),
      user_id: user.id,
      created_at: new Date().toISOString()
    };

    return this.queueOperation('upsert', 'history', newHistory);
  }

  // Helper methods for common operations
  async getTodayScheduleBlocks(): Promise<ScheduleBlock[]> {
    const today = new Date().toISOString().split('T')[0];
    const blocks = await this.getScheduleBlocks();
    return blocks.filter(block => block.date === today);
  }

  async getUpcomingEvents(days: number = 7): Promise<Event[]> {
    const now = new Date();
    const future = new Date();
    future.setDate(now.getDate() + days);

    const events = await this.getEvents();
    return events.filter(event => {
      const startDate = new Date(event.start_at);
      return startDate >= now && startDate <= future;
    });
  }

  async getRecentHistory(days: number = 30): Promise<History[]> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const history = await this.getHistory();
    return history.filter(h => new Date(h.occurred_on) >= cutoff);
  }

  // Batch operations for efficiency
  async batchCreateTasks(tasks: Omit<Task, 'id' | 'user_id' | 'created_at' | 'updated_at'>[]): Promise<string[]> {
    const user = await authManager.getCurrentUser();
    if (!user) throw new Error('User not authenticated');

    const ids: string[] = [];
    for (const task of tasks) {
      const id = await this.createTask(task);
      ids.push(id);
    }
    return ids;
  }

  async batchCreateEvents(events: Omit<Event, 'id' | 'user_id' | 'created_at' | 'updated_at'>[]): Promise<string[]> {
    const user = await authManager.getCurrentUser();
    if (!user) throw new Error('User not authenticated');

    const ids: string[] = [];
    for (const event of events) {
      const id = await this.createEvent(event);
      ids.push(id);
    }
    return ids;
  }

  // Utility methods
  async clearAllData(): Promise<void> {
    console.warn('Clearing all user data...');
    this.pendingOps = [];
    this.savePendingOps();

    if (typeof window !== 'undefined') {
      localStorage.removeItem('df-pending-ops');
      localStorage.removeItem('df-error-log');
    }
  }

  // Additional utility methods as needed...
}