import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../utils/supabase/client';

interface TimeLog {
    id: string;
    task_id: string;
    started_at: string;
    ended_at: string | null;
    duration_minutes: number | null;
    notes: string | null;
}

interface ActiveSession {
    taskId: string;
    startedAt: Date;
    logId: string;
}

interface UseTimeTrackingResult {
    activeSession: ActiveSession | null;
    isTracking: boolean;
    startTracking: (taskId: string) => Promise<void>;
    stopTracking: (notes?: string) => Promise<TimeLog | null>;
    getTaskTimeLogs: (taskId: string) => Promise<TimeLog[]>;
    getTotalTimeForTask: (taskId: string) => Promise<number>;
    loading: boolean;
    error: string | null;
}

/**
 * Hook for managing time tracking on tasks
 * Allows starting/stopping time logs and retrieving history
 */
export function useTimeTracking(): UseTimeTrackingResult {
    const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Check for any active (unclosed) time log on mount
    useEffect(() => {
        checkActiveSession();
    }, []);

    const checkActiveSession = async () => {
        try {
            const { data, error: fetchError } = await supabase
                .from('task_time_logs')
                .select('id, task_id, started_at')
                .is('ended_at', null)
                .limit(1)
                .maybeSingle();

            if (data && !fetchError) {
                setActiveSession({
                    taskId: data.task_id,
                    startedAt: new Date(data.started_at),
                    logId: data.id
                });
            }
        } catch (err) {
            // No active session found, which is fine
        }
    };

    const startTracking = useCallback(async (taskId: string) => {
        if (activeSession) {
            // Stop current session before starting new one
            await stopTracking();
        }

        setLoading(true);
        setError(null);

        try {
            const { data: user } = await supabase.auth.getUser();
            if (!user?.user?.id) {
                throw new Error('Not authenticated');
            }

            const { data, error: insertError } = await supabase
                .from('task_time_logs')
                .insert({
                    user_id: user.user.id,
                    task_id: taskId,
                    started_at: new Date().toISOString()
                })
                .select()
                .single();

            if (insertError) throw insertError;

            setActiveSession({
                taskId,
                startedAt: new Date(data.started_at),
                logId: data.id
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to start tracking');
        } finally {
            setLoading(false);
        }
    }, [activeSession]);

    const stopTracking = useCallback(async (notes?: string): Promise<TimeLog | null> => {
        if (!activeSession) return null;

        setLoading(true);
        setError(null);

        try {
            const { data, error: updateError } = await supabase
                .from('task_time_logs')
                .update({
                    ended_at: new Date().toISOString(),
                    notes: notes || null
                })
                .eq('id', activeSession.logId)
                .select()
                .single();

            if (updateError) throw updateError;

            setActiveSession(null);

            // Calculate duration
            const startedAt = new Date(data.started_at);
            const endedAt = new Date(data.ended_at);
            const durationMinutes = Math.round((endedAt.getTime() - startedAt.getTime()) / 60000);

            return {
                ...data,
                duration_minutes: durationMinutes
            };
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to stop tracking');
            return null;
        } finally {
            setLoading(false);
        }
    }, [activeSession]);

    const getTaskTimeLogs = useCallback(async (taskId: string): Promise<TimeLog[]> => {
        try {
            const { data, error: fetchError } = await supabase
                .from('task_time_logs_with_duration')
                .select('*')
                .eq('task_id', taskId)
                .order('started_at', { ascending: false });

            if (fetchError) throw fetchError;
            return data || [];
        } catch (err) {
            console.error('Failed to fetch time logs:', err);
            return [];
        }
    }, []);

    const getTotalTimeForTask = useCallback(async (taskId: string): Promise<number> => {
        try {
            const { data, error: fetchError } = await supabase
                .from('task_time_logs_with_duration')
                .select('duration_minutes')
                .eq('task_id', taskId)
                .not('duration_minutes', 'is', null);

            if (fetchError) throw fetchError;

            return (data || []).reduce((sum, log) => sum + (log.duration_minutes || 0), 0);
        } catch (err) {
            console.error('Failed to calculate total time:', err);
            return 0;
        }
    }, []);

    return {
        activeSession,
        isTracking: !!activeSession,
        startTracking,
        stopTracking,
        getTaskTimeLogs,
        getTotalTimeForTask,
        loading,
        error
    };
}
