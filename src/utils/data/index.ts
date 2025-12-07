// Data store entry point - simplified, reliable Supabase DataStore
export * from './DataStore';
export type { CapturedItem, Task, Event, Outcome, ScheduleBlock, Settings, History, SyncStatus } from './DataStore';

import { DataStore } from './DataStore';

// Simple, reliable singleton implementation
let dataStoreInstance: DataStore | null = null;

export const getDataStore = (): DataStore => {
  if (!dataStoreInstance) {
    console.log('Creating DataStore singleton instance...');
    dataStoreInstance = DataStore.getInstance();
  }
  return dataStoreInstance;
};

// Export the singleton instance
export const dataStore = getDataStore();