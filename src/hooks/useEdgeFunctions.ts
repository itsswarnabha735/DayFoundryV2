import { useState, useCallback } from 'react';
import { ResilientEdgeFunctionService } from '../utils/services/EdgeFunctionService';
import { useDataStore } from './useSimpleDataStore';

export function useEdgeFunctions() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { authManager } = useDataStore();

  const createServiceWithAuth = useCallback(async () => {
    const token = authManager.getAccessToken();
    return new ResilientEdgeFunctionService(token || undefined);
  }, [authManager]);

  const extractTask = useCallback(async (rawText: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const service = await createServiceWithAuth();
      const result = await service.extractTask(rawText);
      return result.task;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [createServiceWithAuth]);

  const proposeOutcomes = useCallback(async (tasks: any[], constraints: any) => {
    setIsLoading(true);
    setError(null);

    try {
      const service = await createServiceWithAuth();
      const result = await service.proposeOutcomes(tasks, constraints);
      return result.outcomes;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [createServiceWithAuth]);

  const summarizeReflection = useCallback(async (wins: string, blockers: string, change: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const service = await createServiceWithAuth();
      const result = await service.summarizeReflection(wins, blockers, change);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [createServiceWithAuth]);

  const solveSchedule = useCallback(async (input: {
    date: string;
    tasks: any[];
    events: any[];
    constraints: any;
  }) => {
    setIsLoading(true);
    setError(null);

    try {
      const service = await createServiceWithAuth();
      const result = await service.solveSchedule(input);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [createServiceWithAuth]);

  const importICS = useCallback(async (icsUrl: string, calendarId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const service = await createServiceWithAuth();
      const result = await service.importICS(icsUrl, calendarId);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [createServiceWithAuth]);

  const generateWeeklyStatus = useCallback(async (weeklyData: any) => {
    setIsLoading(true);
    setError(null);

    try {
      const service = await createServiceWithAuth();
      const result = await service.callFunction('generate-weekly-status', { weeklyData });
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [createServiceWithAuth]);

  const callEdgeFunction = useCallback(async (functionName: string, payload: any) => {
    setIsLoading(true);
    setError(null);

    try {
      const service = await createServiceWithAuth();
      const result = await service.callFunction(functionName, payload);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [createServiceWithAuth]);

  return {
    extractTask,
    proposeOutcomes,
    summarizeReflection,
    solveSchedule,
    importICS,
    generateWeeklyStatus,
    callEdgeFunction,
    isLoading,
    error,
    clearError: () => setError(null)
  };
}