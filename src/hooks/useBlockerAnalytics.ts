import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../utils/supabase/client';

export interface BlockerAnalytics {
    name: string;
    count: number;
    trend: 'up' | 'down' | 'stable';
}

interface UseBlockerAnalyticsResult {
    blockers: BlockerAnalytics[];
    loading: boolean;
    error: string | null;
    refresh: () => void;
}

/**
 * Hook to fetch and analyze blocker data from reflections table
 * Aggregates blocker_tags over the past 7 days and calculates trends
 */
export function useBlockerAnalytics(): UseBlockerAnalyticsResult {
    const [blockers, setBlockers] = useState<BlockerAnalytics[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchBlockerAnalytics = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            // Get current week date range
            const now = new Date();
            const thisWeekStart = new Date(now);
            thisWeekStart.setDate(now.getDate() - 7);

            // Get last week date range for trend calculation
            const lastWeekStart = new Date(thisWeekStart);
            lastWeekStart.setDate(thisWeekStart.getDate() - 7);

            // Fetch this week's reflections
            const { data: thisWeekData, error: thisWeekError } = await supabase
                .from('reflections')
                .select('blocker_tags')
                .gte('date', thisWeekStart.toISOString().split('T')[0]);

            if (thisWeekError) {
                console.error('Error fetching this week reflections:', thisWeekError);
                setError(thisWeekError.message);
                return;
            }

            // Fetch last week's reflections for trend comparison
            const { data: lastWeekData, error: lastWeekError } = await supabase
                .from('reflections')
                .select('blocker_tags')
                .gte('date', lastWeekStart.toISOString().split('T')[0])
                .lt('date', thisWeekStart.toISOString().split('T')[0]);

            if (lastWeekError) {
                console.error('Error fetching last week reflections:', lastWeekError);
                // Continue without trend data
            }

            // Aggregate blocker tags for this week
            const thisWeekCounts: Record<string, number> = {};
            (thisWeekData || []).forEach(reflection => {
                const tags = reflection.blocker_tags || [];
                tags.forEach((tag: string) => {
                    thisWeekCounts[tag] = (thisWeekCounts[tag] || 0) + 1;
                });
            });

            // Aggregate blocker tags for last week
            const lastWeekCounts: Record<string, number> = {};
            (lastWeekData || []).forEach(reflection => {
                const tags = reflection.blocker_tags || [];
                tags.forEach((tag: string) => {
                    lastWeekCounts[tag] = (lastWeekCounts[tag] || 0) + 1;
                });
            });

            // Calculate trends and sort by count
            const blockerList: BlockerAnalytics[] = Object.entries(thisWeekCounts)
                .map(([name, count]) => {
                    const lastCount = lastWeekCounts[name] || 0;
                    let trend: 'up' | 'down' | 'stable' = 'stable';
                    if (count > lastCount) trend = 'up';
                    else if (count < lastCount) trend = 'down';

                    return { name, count, trend };
                })
                .sort((a, b) => b.count - a.count)
                .slice(0, 3); // Top 3 blockers

            setBlockers(blockerList);
        } catch (err) {
            console.error('Error in useBlockerAnalytics:', err);
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchBlockerAnalytics();
    }, [fetchBlockerAnalytics]);

    return {
        blockers,
        loading,
        error,
        refresh: fetchBlockerAnalytics
    };
}
