// Simple data store instance manager
import { DataStore } from './DataStore';

let storeInstance: DataStore | null = null;

export function getDataStore(): DataStore {
  if (!storeInstance) {
    try {
      storeInstance = DataStore.getInstance();
    } catch (error) {
      // Only log the error message to avoid circular reference issues
      const errorMessage = error?.message || error?.toString?.() || 'Unknown error';
      console.error('Failed to get DataStore instance:', errorMessage);
      throw new Error('DataStore initialization failed: ' + errorMessage);
    }
  }
  return storeInstance;
}

// Export types and interfaces
export type { Task, Event, CalendarEvent, Outcome, ScheduleBlock, Settings, SyncStatus, CapturedItem, History } from './DataStore';