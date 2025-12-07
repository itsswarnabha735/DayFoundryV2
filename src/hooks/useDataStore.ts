import { useState, useEffect, useCallback } from 'react';
import { getDataStore, Task, Event, Outcome, ScheduleBlock, Settings, SyncStatus } from '../utils/data/store';
import { withTimeout, withRetry } from '../utils/timeout';

// Hook for sync status
export function useSyncStatus() {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('up-to-date');

  useEffect(() => {
    const dataStore = getDataStore();
    
    // Set initial status
    setSyncStatus(dataStore.getSyncStatus());
    
    // Subscribe to changes
    const unsubscribe = dataStore.onStatusChange(setSyncStatus);
    return unsubscribe;
  }, []);

  return syncStatus;
}

// Hook for tasks
export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTasks = useCallback(async () => {
    try {
      setLoading(true);
      const dataStore = getDataStore();
      if (!dataStore) {
        throw new Error('DataStore is not available');
      }
      
      // Add timeout and retry logic
      const data = await withRetry(
        () => withTimeout(dataStore.getTasks(), { 
          timeoutMs: 15000, 
          timeoutMessage: 'Loading tasks timed out. Please check your connection.' 
        }),
        { maxRetries: 2, initialDelayMs: 1000 }
      );
      
      setTasks(data || []);
      setError(null);
    } catch (err) {
      console.error('Error loading tasks:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load tasks';
      setError(errorMessage);
      setTasks([]); // Set empty array as fallback
    } finally {
      setLoading(false);
    }
  }, []);

  const createTask = useCallback(async (task: Omit<Task, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    try {
      const dataStore = getDataStore();
      await dataStore.createTask(task);
      await loadTasks(); // Refresh the list
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task');
      throw err;
    }
  }, [loadTasks]);

  const updateTask = useCallback(async (id: string, updates: Partial<Task>) => {
    try {
      const dataStore = getDataStore();
      await dataStore.updateTask(id, updates);
      // Optimistically update the local state
      setTasks(prev => prev.map(task => 
        task.id === id ? { ...task, ...updates } : task
      ));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update task');
      await loadTasks(); // Reload on error
      throw err;
    }
  }, [loadTasks]);

  const deleteTask = useCallback(async (id: string) => {
    try {
      const dataStore = getDataStore();
      await dataStore.deleteTask(id);
      // Optimistically remove from local state
      setTasks(prev => prev.filter(task => task.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete task');
      await loadTasks(); // Reload on error
      throw err;
    }
  }, [loadTasks]);

  useEffect(() => {
    loadTasks();

    // Listen for data updates from realtime
    const handleDataUpdate = (event: CustomEvent) => {
      if (event.detail.table === 'tasks') {
        loadTasks();
      }
    };

    window.addEventListener('data-updated', handleDataUpdate as EventListener);
    return () => {
      window.removeEventListener('data-updated', handleDataUpdate as EventListener);
    };
  }, [loadTasks]);

  return {
    tasks,
    loading,
    error,
    createTask,
    updateTask,
    deleteTask,
    refresh: loadTasks
  };
}

// Hook for events
export function useEvents(startDate?: string, endDate?: string) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    try {
      setLoading(true);
      const dataStore = getDataStore();
      
      // Add timeout and retry logic
      const data = await withRetry(
        () => withTimeout(dataStore.getEvents(startDate, endDate), { 
          timeoutMs: 10000, 
          timeoutMessage: 'Loading events timed out. Please check your connection.' 
        }),
        { maxRetries: 2, initialDelayMs: 1000 }
      );
      
      setEvents(data);
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load events';
      setError(errorMessage);
      setEvents([]); // Set empty array as fallback
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  const createEvent = useCallback(async (event: Omit<Event, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    try {
      const dataStore = getDataStore();
      await dataStore.createEvent(event);
      await loadEvents();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create event');
      throw err;
    }
  }, [loadEvents]);

  useEffect(() => {
    loadEvents();

    const handleDataUpdate = (event: CustomEvent) => {
      if (event.detail.table === 'events') {
        loadEvents();
      }
    };

    window.addEventListener('data-updated', handleDataUpdate as EventListener);
    return () => {
      window.removeEventListener('data-updated', handleDataUpdate as EventListener);
    };
  }, [loadEvents]);

  return {
    events,
    loading,
    error,
    createEvent,
    refresh: loadEvents
  };
}

// Hook for outcomes
export function useOutcomes() {
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOutcomes = useCallback(async () => {
    try {
      setLoading(true);
      const dataStore = getDataStore();
      
      // Add timeout and retry logic
      const data = await withRetry(
        () => withTimeout(dataStore.getOutcomes(), { 
          timeoutMs: 10000, 
          timeoutMessage: 'Loading outcomes timed out. Please check your connection.' 
        }),
        { maxRetries: 2, initialDelayMs: 1000 }
      );
      
      setOutcomes(data);
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load outcomes';
      setError(errorMessage);
      setOutcomes([]); // Set empty array as fallback
    } finally {
      setLoading(false);
    }
  }, []);

  const createOutcome = useCallback(async (outcome: Omit<Outcome, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    try {
      const dataStore = getDataStore();
      await dataStore.createOutcome(outcome);
      await loadOutcomes();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create outcome');
      throw err;
    }
  }, [loadOutcomes]);

  useEffect(() => {
    loadOutcomes();

    const handleDataUpdate = (event: CustomEvent) => {
      if (event.detail.table === 'outcomes') {
        loadOutcomes();
      }
    };

    window.addEventListener('data-updated', handleDataUpdate as EventListener);
    return () => {
      window.removeEventListener('data-updated', handleDataUpdate as EventListener);
    };
  }, [loadOutcomes]);

  return {
    outcomes,
    loading,
    error,
    createOutcome,
    refresh: loadOutcomes
  };
}

// Hook for schedule blocks
export function useScheduleBlocks(date: string) {
  const [blocks, setBlocks] = useState<ScheduleBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBlocks = useCallback(async () => {
    try {
      setLoading(true);
      const dataStore = getDataStore();
      
      // Add timeout and retry logic
      const data = await withRetry(
        () => withTimeout(dataStore.getScheduleBlocks(date), { 
          timeoutMs: 10000, 
          timeoutMessage: 'Loading schedule blocks timed out. Please check your connection.' 
        }),
        { maxRetries: 2, initialDelayMs: 1000 }
      );
      
      setBlocks(data);
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load schedule blocks';
      setError(errorMessage);
      setBlocks([]); // Set empty array as fallback
    } finally {
      setLoading(false);
    }
  }, [date]);

  const saveSchedule = useCallback(async (blocks: Omit<ScheduleBlock, 'id' | 'user_id' | 'created_at' | 'updated_at'>[]) => {
    try {
      const dataStore = getDataStore();
      await dataStore.saveSchedule(date, blocks);
      await loadBlocks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save schedule');
      throw err;
    }
  }, [date, loadBlocks]);

  useEffect(() => {
    loadBlocks();

    const handleDataUpdate = (event: CustomEvent) => {
      if (event.detail.table === 'schedule_blocks') {
        loadBlocks();
      }
    };

    window.addEventListener('data-updated', handleDataUpdate as EventListener);
    return () => {
      window.removeEventListener('data-updated', handleDataUpdate as EventListener);
    };
  }, [loadBlocks]);

  return {
    blocks,
    loading,
    error,
    saveSchedule,
    refresh: loadBlocks
  };
}

// Hook for settings
export function useSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      const dataStore = getDataStore();
      
      // Add timeout and retry logic
      const data = await withRetry(
        () => withTimeout(dataStore.getSettings(), { 
          timeoutMs: 8000, 
          timeoutMessage: 'Loading settings timed out. Please check your connection.' 
        }),
        { maxRetries: 2, initialDelayMs: 1000 }
      );
      
      setSettings(data);
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load settings';
      setError(errorMessage);
      setSettings(null); // Set null as fallback
    } finally {
      setLoading(false);
    }
  }, []);

  const updateSettings = useCallback(async (updates: Partial<Settings>) => {
    try {
      const dataStore = getDataStore();
      await dataStore.updateSettings(updates);
      // Optimistically update the local state
      setSettings(prev => prev ? { ...prev, ...updates } : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update settings');
      await loadSettings(); // Reload on error
      throw err;
    }
  }, [loadSettings]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  return {
    settings,
    loading,
    error,
    updateSettings,
    refresh: loadSettings
  };
}

// Combined hook for dashboard data
export function useDashboardData() {
  const today = new Date().toISOString().split('T')[0];
  const { tasks, loading: tasksLoading } = useTasks();
  const { outcomes, loading: outcomesLoading } = useOutcomes();
  const { blocks, loading: blocksLoading } = useScheduleBlocks(today);
  const { events, loading: eventsLoading } = useEvents(today, today);
  const syncStatus = useSyncStatus();

  const loading = tasksLoading || outcomesLoading || blocksLoading || eventsLoading;

  // Compute derived data
  const todayTasks = tasks.filter(task => {
    // Filter tasks that are scheduled for today or due today
    return task.deadline === today || blocks.some(block => block.task_id === task.id);
  });

  const completedTasks = todayTasks.filter(task => 
    task.steps.length > 0 && task.steps.every(step => step.completed)
  );

  const completionPercentage = todayTasks.length > 0 
    ? (completedTasks.length / todayTasks.length) * 100 
    : 0;

  const nextBlock = blocks
    .filter(block => new Date(block.start_at) > new Date())
    .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())[0];

  return {
    loading,
    syncStatus,
    tasks: todayTasks,
    completedTasks,
    completionPercentage,
    outcomes,
    blocks,
    events,
    nextBlock
  };
}

// Hook for captured items
export function useCapturedItems() {
  const [capturedItems, setCapturedItems] = useState<import('../utils/data/store').CapturedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCapturedItems = useCallback(async () => {
    try {
      setLoading(true);
      const dataStore = getDataStore();
      
      // Add timeout and retry logic
      const data = await withRetry(
        () => withTimeout(dataStore.getCapturedItems(), { 
          timeoutMs: 10000, 
          timeoutMessage: 'Loading captured items timed out. Please check your connection.' 
        }),
        { maxRetries: 2, initialDelayMs: 1000 }
      );
      
      setCapturedItems(data || []);
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load captured items';
      setError(errorMessage);
      setCapturedItems([]); // Set empty array as fallback
    } finally {
      setLoading(false);
    }
  }, []);

  const createCapturedItem = useCallback(async (item: Omit<import('../utils/data/store').CapturedItem, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    try {
      const dataStore = getDataStore();
      const id = await dataStore.createCapturedItem(item);
      await loadCapturedItems();
      return id;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create captured item');
      throw err;
    }
  }, [loadCapturedItems]);

  const deleteCapturedItem = useCallback(async (id: string) => {
    try {
      const dataStore = getDataStore();
      await dataStore.deleteCapturedItem(id);
      // Optimistically remove from local state
      setCapturedItems(prev => prev.filter(item => item.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete captured item');
      await loadCapturedItems(); // Reload on error
      throw err;
    }
  }, [loadCapturedItems]);

  useEffect(() => {
    loadCapturedItems();

    const handleDataUpdate = (event: CustomEvent) => {
      if (event.detail.table === 'captured_items') {
        loadCapturedItems();
      }
    };

    window.addEventListener('data-updated', handleDataUpdate as EventListener);
    return () => {
      window.removeEventListener('data-updated', handleDataUpdate as EventListener);
    };
  }, [loadCapturedItems]);

  return {
    capturedItems,
    loading,
    error,
    createCapturedItem,
    deleteCapturedItem,
    refresh: loadCapturedItems
  };
}

// Main useDataStore hook for compatibility
export function useDataStore() {
  const [isReady, setIsReady] = useState(false);
  
  useEffect(() => {
    // Initialize data store
    try {
      console.log('Initializing data store...');
      const store = getDataStore();
      console.log('Data store initialized successfully:', store);
      setIsReady(true);
    } catch (error) {
      console.error('Failed to initialize data store:', error);
      setIsReady(false);
    }
  }, []);

  const today = new Date().toISOString().split('T')[0];
  const { tasks, loading: tasksLoading, createTask, updateTask, deleteTask } = useTasks();
  const { outcomes, loading: outcomesLoading, createOutcome } = useOutcomes();
  const { blocks, loading: blocksLoading, saveSchedule } = useScheduleBlocks(today);
  const { events, loading: eventsLoading, createEvent } = useEvents(today, today);
  const { settings, updateSettings } = useSettings();
  const { capturedItems, loading: capturedItemsLoading, createCapturedItem, deleteCapturedItem } = useCapturedItems();
  const syncStatus = useSyncStatus();

  const loading = !isReady || tasksLoading || outcomesLoading || blocksLoading || eventsLoading || capturedItemsLoading;

  if (!isReady) {
    return {
      data: {
        tasks: [],
        outcomes: [],
        blocks: [],
        events: [],
        capturedItems: [],
        settings: null
      },
      loading: true,
      syncStatus: 'offline' as const,
      createTask: async () => {},
      updateTask: async () => {},
      deleteTask: async () => {},
      createOutcome: async () => {},
      createEvent: async () => {},
      createCapturedItem: async () => '',
      deleteCapturedItem: async () => {},
      saveSchedule: async () => {},
      updateSettings: async () => {},
      refresh: () => {},
      acceptTaskDraft: async () => '',
      recordPlanActual: async () => ''
    };
  }

  return {
    data: {
      tasks: tasks || [],
      outcomes: outcomes || [],
      blocks: blocks || [],
      events: events || [],
      capturedItems: capturedItems || [],
      settings
    },
    loading,
    syncStatus,
    createTask,
    updateTask,
    deleteTask,
    createOutcome,
    createEvent,
    createCapturedItem,
    deleteCapturedItem,
    saveSchedule,
    updateSettings,
    refresh: () => {
      // Refresh all data
      window.dispatchEvent(new CustomEvent('data-updated', { 
        detail: { table: 'tasks', payload: {} } 
      }));
      window.dispatchEvent(new CustomEvent('data-updated', { 
        detail: { table: 'outcomes', payload: {} } 
      }));
      window.dispatchEvent(new CustomEvent('data-updated', { 
        detail: { table: 'schedule_blocks', payload: {} } 
      }));
      window.dispatchEvent(new CustomEvent('data-updated', { 
        detail: { table: 'events', payload: {} } 
      }));
      window.dispatchEvent(new CustomEvent('data-updated', { 
        detail: { table: 'captured_items', payload: {} } 
      }));
    },
    acceptTaskDraft: async (task: any) => {
      try {
        const dataStore = getDataStore();
        return await dataStore.acceptTaskDraft(task);
      } catch (error) {
        console.error('Error accepting task draft:', error);
        throw error;
      }
    },
    recordPlanActual: async (taskId: string, plannedMin: number, actualMin: number, blockers?: string[], notes?: string) => {
      try {
        const dataStore = getDataStore();
        return await dataStore.recordPlanActual(taskId, plannedMin, actualMin, blockers, notes);
      } catch (error) {
        console.error('Error recording plan vs actual:', error);
        throw error;
      }
    }
  };
}