import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../utils/supabase/client';

export interface CategoryMultiplier {
    id: string;
    category: string;
    multiplier: number;
    confidence: 'low' | 'medium' | 'high';
    confidence_band_low: number | null;
    confidence_band_high: number | null;
    sample_size: number;
    last_7_day_trend: number | null;
    is_default: boolean;
}

interface UseEstimateMultipliersResult {
    multipliers: CategoryMultiplier[];
    loading: boolean;
    error: string | null;
    refresh: () => void;
    toggleDefault: (category: string, isDefault: boolean) => Promise<void>;
    upsertMultiplier: (
        category: string,
        multiplier: number,
        confidence?: 'low' | 'medium' | 'high',
        sampleSize?: number,
        isDefault?: boolean
    ) => Promise<void>;
}

/**
 * Hook for managing estimate multipliers in the Learning Section
 * Fetches, updates, and persists multiplier preferences to the database
 */
export function useEstimateMultipliers(): UseEstimateMultipliersResult {
    const [multipliers, setMultipliers] = useState<CategoryMultiplier[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchMultipliers = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const { data, error: fetchError } = await supabase
                .from('estimate_multipliers')
                .select('*')
                .order('category');

            if (fetchError) throw fetchError;

            setMultipliers(data || []);
        } catch (err) {
            console.error('Failed to fetch multipliers:', err);
            setError(err instanceof Error ? err.message : 'Failed to load multipliers');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchMultipliers();
    }, [fetchMultipliers]);

    const toggleDefault = useCallback(async (category: string, isDefault: boolean) => {
        try {
            // Optimistically update UI
            setMultipliers(prev =>
                prev.map(m =>
                    m.category === category ? { ...m, is_default: isDefault } : m
                )
            );

            // Call the RPC function
            const { error: rpcError } = await supabase.rpc('upsert_estimate_multiplier', {
                p_category: category,
                p_multiplier: multipliers.find(m => m.category === category)?.multiplier || 1.0,
                p_confidence: multipliers.find(m => m.category === category)?.confidence || 'low',
                p_sample_size: multipliers.find(m => m.category === category)?.sample_size || 0,
                p_is_default: isDefault
            });

            if (rpcError) throw rpcError;
        } catch (err) {
            console.error('Failed to toggle default:', err);
            // Revert on error
            await fetchMultipliers();
        }
    }, [multipliers, fetchMultipliers]);

    const upsertMultiplier = useCallback(async (
        category: string,
        multiplier: number,
        confidence: 'low' | 'medium' | 'high' = 'low',
        sampleSize: number = 0,
        isDefault: boolean = false
    ) => {
        try {
            const { error: rpcError } = await supabase.rpc('upsert_estimate_multiplier', {
                p_category: category,
                p_multiplier: multiplier,
                p_confidence: confidence,
                p_sample_size: sampleSize,
                p_is_default: isDefault
            });

            if (rpcError) throw rpcError;

            // Refresh the list
            await fetchMultipliers();
        } catch (err) {
            console.error('Failed to upsert multiplier:', err);
            throw err;
        }
    }, [fetchMultipliers]);

    return {
        multipliers,
        loading,
        error,
        refresh: fetchMultipliers,
        toggleDefault,
        upsertMultiplier
    };
}
