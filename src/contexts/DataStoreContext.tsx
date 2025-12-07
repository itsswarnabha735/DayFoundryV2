import React, { createContext, useContext, useEffect, useState } from 'react';
import { getDataStore } from '../utils/data/store';
import type { DataStore } from '../utils/data/DataStore';
import type { User } from '../utils/auth';

interface DataStoreContextValue {
  dataStore: DataStore | null;
  isReady: boolean;
}

const DataStoreContext = createContext<DataStoreContextValue>({
  dataStore: null,
  isReady: false,
});

export function DataStoreProvider({ 
  children, 
  currentUser 
}: { 
  children: React.ReactNode;
  currentUser: User | null;
}) {
  const [dataStore, setDataStore] = useState<DataStore | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Only initialize the DataStore if we have a user
    if (!currentUser) {
      console.log('DataStoreProvider: No user available, skipping initialization');
      return;
    }

    const initializeDataStore = async () => {
      try {
        console.log('DataStoreProvider: Initializing data store for user:', currentUser.id);
        const store = getDataStore();
        
        // Give the store a moment to initialize properly
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Always set the store as ready - even if not perfectly healthy
        // The store should have fallback methods that prevent crashes
        console.log('DataStoreProvider: Data store initialized');
        setDataStore(store);
        setIsReady(true);
        
      } catch (error) {
        // Only log the error message to avoid circular reference issues
        const errorMessage = error?.message || error?.toString?.() || 'Unknown error';
        console.error('DataStoreProvider: Failed to initialize data store:', errorMessage);
        
        // Create a minimal fallback store if the main one fails completely
        const fallbackStore = {
          getCapturedItems: async () => [],
          createCapturedItem: async () => 'fallback-id',
          getTasks: async () => [],
          createTask: async () => 'fallback-id',
          createOutcome: async () => 'fallback-id',
          getSyncStatus: () => 'offline' as const,
          isHealthy: () => false,
          isInitialized: () => true,
          onStatusChange: () => () => {}
        };
        
        setDataStore(fallbackStore as any);
        setIsReady(true); // Set ready to prevent blocking the app
      }
    };

    initializeDataStore();
  }, [currentUser]);

  return (
    <DataStoreContext.Provider value={{ dataStore, isReady }}>
      {children}
    </DataStoreContext.Provider>
  );
}

export function useDataStoreContext() {
  const context = useContext(DataStoreContext);
  if (!context) {
    throw new Error('useDataStoreContext must be used within a DataStoreProvider');
  }
  return context;
}