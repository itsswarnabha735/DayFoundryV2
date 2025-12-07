import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../utils/supabase/client';
import { authManager } from '../utils/auth';

/**
 * User preferences stored in the database
 * These control scheduling behavior and agent guardrails
 */
export interface UserPreferences {
    // Privacy
    privacyMode: 'local' | 'cloud';

    // Work hours
    workingHoursStart: string;
    workingHoursEnd: string;

    // Break preferences
    breakDuration: number;      // minutes (5-30)
    breakFrequency: number;     // minutes (30-180)
    interruptionBudget: number; // count (0-10)

    // Protected time
    noMeetingWindows: Array<{ start: string; end: string; label: string }>;

    // Scheduling
    conflictResolutionStyle: 'aggressive' | 'balanced' | 'conservative';

    // System
    notificationsEnabled: boolean;
    timezone: string;
}

/**
 * Default preferences - used when no database record exists
 */
export const DEFAULT_PREFERENCES: UserPreferences = {
    privacyMode: 'cloud',
    workingHoursStart: '09:00',
    workingHoursEnd: '17:00',
    breakDuration: 15,
    breakFrequency: 90,
    interruptionBudget: 3,
    noMeetingWindows: [],
    conflictResolutionStyle: 'balanced',
    notificationsEnabled: false,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
};

/**
 * Quick preset configurations
 */
export const PREFERENCE_PRESETS = {
    highFocus: {
        breakDuration: 5,
        breakFrequency: 120,
        interruptionBudget: 1
    },
    balanced: {
        breakDuration: 15,
        breakFrequency: 90,
        interruptionBudget: 3
    },
    collaborative: {
        breakDuration: 20,
        breakFrequency: 60,
        interruptionBudget: 5
    },
    flexible: {
        breakDuration: 30,
        breakFrequency: 180,
        interruptionBudget: 7
    }
} as const;

/**
 * Convert database row to UserPreferences interface
 */
function mapFromDatabase(row: any): UserPreferences {
    return {
        privacyMode: row.privacy_mode || DEFAULT_PREFERENCES.privacyMode,
        workingHoursStart: row.working_hours_start || DEFAULT_PREFERENCES.workingHoursStart,
        workingHoursEnd: row.working_hours_end || DEFAULT_PREFERENCES.workingHoursEnd,
        breakDuration: row.break_duration ?? DEFAULT_PREFERENCES.breakDuration,
        breakFrequency: row.break_frequency ?? DEFAULT_PREFERENCES.breakFrequency,
        interruptionBudget: row.interruption_budget ?? DEFAULT_PREFERENCES.interruptionBudget,
        noMeetingWindows: row.no_meeting_windows || DEFAULT_PREFERENCES.noMeetingWindows,
        conflictResolutionStyle: row.conflict_resolution_style || DEFAULT_PREFERENCES.conflictResolutionStyle,
        notificationsEnabled: row.notifications_enabled ?? DEFAULT_PREFERENCES.notificationsEnabled,
        timezone: row.timezone || DEFAULT_PREFERENCES.timezone
    };
}

/**
 * Convert UserPreferences to database row format
 */
function mapToDatabase(prefs: Partial<UserPreferences>): Record<string, any> {
    const result: Record<string, any> = {};

    if (prefs.privacyMode !== undefined) result.privacy_mode = prefs.privacyMode;
    if (prefs.workingHoursStart !== undefined) result.working_hours_start = prefs.workingHoursStart;
    if (prefs.workingHoursEnd !== undefined) result.working_hours_end = prefs.workingHoursEnd;
    if (prefs.breakDuration !== undefined) result.break_duration = prefs.breakDuration;
    if (prefs.breakFrequency !== undefined) result.break_frequency = prefs.breakFrequency;
    if (prefs.interruptionBudget !== undefined) result.interruption_budget = prefs.interruptionBudget;
    if (prefs.noMeetingWindows !== undefined) result.no_meeting_windows = prefs.noMeetingWindows;
    if (prefs.conflictResolutionStyle !== undefined) result.conflict_resolution_style = prefs.conflictResolutionStyle;
    if (prefs.notificationsEnabled !== undefined) result.notifications_enabled = prefs.notificationsEnabled;
    if (prefs.timezone !== undefined) result.timezone = prefs.timezone;

    result.updated_at = new Date().toISOString();

    return result;
}

/**
 * Try to load preferences from localStorage (onboarding data)
 * This is used for migration when a user has completed onboarding but has no DB record
 */
function loadFromLocalStorage(): Partial<UserPreferences> | null {
    try {
        const storedData = localStorage.getItem('df-onboarding-data');
        if (!storedData) return null;

        const data = JSON.parse(storedData);

        return {
            privacyMode: data.privacyMode,
            workingHoursStart: data.workStart,
            workingHoursEnd: data.workEnd,
            breakDuration: data.breakDuration,
            breakFrequency: data.breakFrequency,
            interruptionBudget: data.interruptionBudget,
            noMeetingWindows: data.noMeetingWindows || [],
            notificationsEnabled: data.notificationsEnabled
        };
    } catch (error) {
        console.error('Failed to load preferences from localStorage:', error);
        return null;
    }
}

/**
 * Hook for managing user preferences
 * 
 * Features:
 * - Fetches from Supabase user_preferences table
 * - Falls back to localStorage for migration
 * - Provides optimistic updates with rollback on error
 * - Auto-syncs localStorage → DB on first load
 */
export function useUserPreferences() {
    const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [userId, setUserId] = useState<string | null>(null);

    // Get current user
    useEffect(() => {
        const getUser = async () => {
            const user = await authManager.getCurrentUser();
            setUserId(user?.id || null);
        };
        getUser();
    }, []);

    // Load preferences from database
    const loadPreferences = useCallback(async () => {
        if (!userId) {
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError(null);

            // Fetch from database
            const { data, error: fetchError } = await supabase
                .from('user_preferences')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (fetchError && fetchError.code !== 'PGRST116') {
                // PGRST116 = row not found, which is expected for new users
                throw fetchError;
            }

            if (data) {
                // User has preferences in DB
                setPreferences(mapFromDatabase(data));
            } else {
                // No DB record - check localStorage for migration
                const localData = loadFromLocalStorage();

                if (localData) {
                    // Migrate localStorage data to database
                    const migratedPrefs = { ...DEFAULT_PREFERENCES, ...localData };
                    setPreferences(migratedPrefs);

                    // Sync to database in background
                    const dbData = mapToDatabase(migratedPrefs);
                    await supabase
                        .from('user_preferences')
                        .upsert({ user_id: userId, ...dbData }, { onConflict: 'user_id' });

                    console.log('Migrated onboarding preferences to database');
                } else {
                    // No data anywhere - use defaults and create DB record
                    setPreferences(DEFAULT_PREFERENCES);

                    await supabase
                        .from('user_preferences')
                        .upsert({
                            user_id: userId,
                            ...mapToDatabase(DEFAULT_PREFERENCES)
                        }, { onConflict: 'user_id' });
                }
            }
        } catch (err) {
            console.error('Error loading user preferences:', err);
            setError(err instanceof Error ? err.message : 'Failed to load preferences');
            // Fall back to defaults on error
            setPreferences(DEFAULT_PREFERENCES);
        } finally {
            setLoading(false);
        }
    }, [userId]);

    // Load on mount and when userId changes
    useEffect(() => {
        if (userId) {
            loadPreferences();
        }
    }, [userId, loadPreferences]);

    // Update preferences (partial update)
    const updatePreferences = useCallback(async (updates: Partial<UserPreferences>) => {
        if (!userId) {
            throw new Error('User not authenticated');
        }

        // Store previous for rollback
        const previousPrefs = { ...preferences };

        try {
            // Optimistic update
            setPreferences(prev => ({ ...prev, ...updates }));
            setError(null);

            // Convert to database format
            const dbUpdates = mapToDatabase(updates);

            // Upsert to database
            const { error: updateError } = await supabase
                .from('user_preferences')
                .upsert({ user_id: userId, ...dbUpdates }, { onConflict: 'user_id' });

            if (updateError) {
                throw updateError;
            }

            // Also update localStorage for offline fallback
            const storedData = localStorage.getItem('df-onboarding-data');
            if (storedData) {
                const data = JSON.parse(storedData);
                const updatedData = { ...data };

                if (updates.privacyMode !== undefined) updatedData.privacyMode = updates.privacyMode;
                if (updates.workingHoursStart !== undefined) updatedData.workStart = updates.workingHoursStart;
                if (updates.workingHoursEnd !== undefined) updatedData.workEnd = updates.workingHoursEnd;
                if (updates.breakDuration !== undefined) updatedData.breakDuration = updates.breakDuration;
                if (updates.breakFrequency !== undefined) updatedData.breakFrequency = updates.breakFrequency;
                if (updates.interruptionBudget !== undefined) updatedData.interruptionBudget = updates.interruptionBudget;
                if (updates.noMeetingWindows !== undefined) updatedData.noMeetingWindows = updates.noMeetingWindows;
                if (updates.notificationsEnabled !== undefined) updatedData.notificationsEnabled = updates.notificationsEnabled;

                localStorage.setItem('df-onboarding-data', JSON.stringify(updatedData));
            }
        } catch (err) {
            console.error('Error updating user preferences:', err);
            // Rollback on error
            setPreferences(previousPrefs);
            setError(err instanceof Error ? err.message : 'Failed to update preferences');
            throw err;
        }
    }, [userId, preferences]);

    // Apply a preset
    const applyPreset = useCallback(async (preset: keyof typeof PREFERENCE_PRESETS) => {
        const presetValues = PREFERENCE_PRESETS[preset];
        await updatePreferences(presetValues);
    }, [updatePreferences]);

    // Reset to defaults
    const resetToDefaults = useCallback(async () => {
        await updatePreferences(DEFAULT_PREFERENCES);
    }, [updatePreferences]);

    return {
        preferences,
        loading,
        error,
        updatePreferences,
        applyPreset,
        resetToDefaults,
        refresh: loadPreferences
    };
}
