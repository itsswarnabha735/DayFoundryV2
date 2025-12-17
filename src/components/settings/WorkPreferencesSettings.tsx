import React, { useState, useEffect } from 'react';
import { ArrowLeft, Clock, Coffee, Shield, Plus, X, RotateCcw, Zap, Calendar } from 'lucide-react';
import { Button } from '../ui/button';
import { supabase } from '../../utils/supabase/client';
import { authManager } from '../../utils/auth';
import { Card } from '../ui/card';
import { Slider } from '../ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useUserPreferences, PREFERENCE_PRESETS, DEFAULT_PREFERENCES } from '../../hooks/useUserPreferences';

interface WorkPreferencesSettingsProps {
    onClose: () => void;
}

export function WorkPreferencesSettings({ onClose }: WorkPreferencesSettingsProps) {
    const { preferences, loading, error, updatePreferences, applyPreset, resetToDefaults } = useUserPreferences();

    // Local state for immediate UI updates
    const [localPrefs, setLocalPrefs] = useState(preferences);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    // Sync local state when preferences load
    useEffect(() => {
        setLocalPrefs(preferences);
    }, [preferences]);

    const timeOptions = [
        '6:00', '6:30', '7:00', '7:30', '8:00', '8:30', '9:00', '9:30', '10:00', '10:30',
        '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
        '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00'
    ];

    const handleSave = async () => {
        try {
            setSaving(true);
            setSaveError(null);
            await updatePreferences(localPrefs);
        } catch (err) {
            setSaveError(err instanceof Error ? err.message : 'Failed to save');
        } finally {
            setSaving(false);
        }
    };

    const handlePresetClick = async (preset: keyof typeof PREFERENCE_PRESETS) => {
        const presetValues = PREFERENCE_PRESETS[preset];
        setLocalPrefs(prev => ({ ...prev, ...presetValues }));

        try {
            setSaving(true);
            await applyPreset(preset);
        } catch (err) {
            setSaveError(err instanceof Error ? err.message : 'Failed to apply preset');
        } finally {
            setSaving(false);
        }
    };

    const handleReset = async () => {
        setLocalPrefs(DEFAULT_PREFERENCES);
        try {
            setSaving(true);
            await resetToDefaults();
        } catch (err) {
            setSaveError(err instanceof Error ? err.message : 'Failed to reset');
        } finally {
            setSaving(false);
        }
    };

    const addNoMeetingWindow = () => {
        setLocalPrefs(prev => ({
            ...prev,
            noMeetingWindows: [
                ...prev.noMeetingWindows,
                { start: '9:00', end: '11:00', label: 'Deep work' }
            ]
        }));
    };

    const removeNoMeetingWindow = (index: number) => {
        setLocalPrefs(prev => ({
            ...prev,
            noMeetingWindows: prev.noMeetingWindows.filter((_, i) => i !== index)
        }));
    };

    const updateNoMeetingWindow = (index: number, field: 'start' | 'end' | 'label', value: string) => {
        setLocalPrefs(prev => ({
            ...prev,
            noMeetingWindows: prev.noMeetingWindows.map((window, i) =>
                i === index ? { ...window, [field]: value } : window
            )
        }));
    };

    // Check if there are unsaved changes
    const hasChanges = JSON.stringify(localPrefs) !== JSON.stringify(preferences);

    if (loading) {
        return (
            <>
                <div
                    className="flex items-center gap-3 p-4 border-b"
                    style={{ borderBottomColor: 'var(--df-border)', minHeight: '64px' }}
                >
                    <Button variant="ghost" onClick={onClose} style={{ minHeight: '44px', minWidth: '44px' }}>
                        <ArrowLeft size={20} />
                    </Button>
                    <h1 style={{ fontSize: 'var(--df-type-title-size)', fontWeight: 'var(--df-type-title-weight)', color: 'var(--df-text)' }}>
                        Work & Scheduling
                    </h1>
                </div>
                <div className="flex-1 flex items-center justify-center p-4">
                    <p style={{ color: 'var(--df-text-muted)' }}>Loading preferences...</p>
                </div>
            </>
        );
    }

    return (
        <>
            {/* Header */}
            <div
                className="flex items-center justify-between gap-3 p-4 border-b"
                style={{ borderBottomColor: 'var(--df-border)', minHeight: '64px' }}
            >
                <div className="flex items-center gap-3">
                    <Button variant="ghost" onClick={onClose} style={{ minHeight: '44px', minWidth: '44px' }}>
                        <ArrowLeft size={20} />
                    </Button>
                    <h1 style={{ fontSize: 'var(--df-type-title-size)', fontWeight: 'var(--df-type-title-weight)', color: 'var(--df-text)' }}>
                        Work & Scheduling
                    </h1>
                </div>

                {hasChanges && (
                    <Button
                        onClick={handleSave}
                        disabled={saving}
                        style={{
                            backgroundColor: 'var(--df-primary)',
                            color: 'var(--df-primary-contrast)',
                            minHeight: '36px',
                            padding: '0 16px',
                            fontSize: 'var(--df-type-body-size)'
                        }}
                    >
                        {saving ? 'Saving...' : 'Save'}
                    </Button>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-4 space-y-6">
                {/* Error Display */}
                {(error || saveError) && (
                    <div
                        className="p-3 rounded"
                        style={{
                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                            color: 'var(--df-error)',
                            fontSize: 'var(--df-type-caption-size)'
                        }}
                    >
                        {error || saveError}
                    </div>
                )}

                {/* AI Model Preference Section */}
                <Card
                    style={{
                        padding: 'var(--df-space-24)',
                        backgroundColor: 'var(--df-surface)',
                        borderColor: 'var(--df-border)',
                        borderRadius: 'var(--df-radius-md)'
                    }}
                >
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 rounded-full" style={{ backgroundColor: 'var(--df-surface-alt)' }}>
                            <Zap size={20} style={{ color: 'var(--df-primary)' }} />
                        </div>
                        <div>
                            <h3 style={{ fontSize: 'var(--df-type-subtitle-size)', fontWeight: 'var(--df-type-subtitle-weight)', color: 'var(--df-text)' }}>
                                Artificial Intelligence
                            </h3>
                            <p style={{ fontSize: 'var(--df-type-caption-size)', color: 'var(--df-text-muted)' }}>
                                Choose the AI model for scheduling
                            </p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h4 style={{ fontSize: 'var(--df-type-body-size)', fontWeight: '600', color: 'var(--df-text)' }}>
                                    Gemini 3.0 Pro (Beta)
                                </h4>
                                <p style={{ fontSize: 'var(--df-type-caption-size)', color: 'var(--df-text-muted)' }}>
                                    Uses advanced reasoning to handle complex conflicts and logical constraints. May take 10-20s longer.
                                </p>
                            </div>
                            <button
                                onClick={() => setLocalPrefs(prev => ({
                                    ...prev,
                                    aiPreferences: { model: prev.aiPreferences?.model === 'pro' ? 'standard' : 'pro' }
                                }))}
                                className={`w-12 h-6 rounded-full p-1 transition-colors ${localPrefs.aiPreferences?.model === 'pro' ? 'bg-green-500' : 'bg-gray-300'}`}
                                style={{
                                    backgroundColor: localPrefs.aiPreferences?.model === 'pro' ? 'var(--df-primary)' : 'var(--df-border)'
                                }}
                            >
                                <div
                                    className={`w-4 h-4 rounded-full bg-white shadow-sm transform transition-transform ${localPrefs.aiPreferences?.model === 'pro' ? 'translate-x-6' : ''}`}
                                    style={{ backgroundColor: 'var(--df-primary-contrast)' }}
                                />
                            </button>
                        </div>
                    </div>
                </Card>

                {/* Work Hours Section */}
                <Card
                    style={{
                        padding: 'var(--df-space-24)',
                        backgroundColor: 'var(--df-surface)',
                        borderColor: 'var(--df-border)',
                        borderRadius: 'var(--df-radius-md)'
                    }}
                >
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 rounded-full" style={{ backgroundColor: 'var(--df-surface-alt)' }}>
                            <Clock size={20} style={{ color: 'var(--df-primary)' }} />
                        </div>
                        <div>
                            <h3 style={{ fontSize: 'var(--df-type-subtitle-size)', fontWeight: 'var(--df-type-subtitle-weight)', color: 'var(--df-text)' }}>
                                Work Hours
                            </h3>
                            <p style={{ fontSize: 'var(--df-type-caption-size)', color: 'var(--df-text-muted)' }}>
                                When you're available to work
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label style={{ display: 'block', fontSize: 'var(--df-type-body-size)', color: 'var(--df-text)', marginBottom: '8px' }}>
                                Start
                            </label>
                            <Select
                                value={localPrefs.workingHoursStart}
                                onValueChange={(value) => setLocalPrefs(prev => ({ ...prev, workingHoursStart: value }))}
                            >
                                <SelectTrigger style={{ minHeight: '48px', borderColor: 'var(--df-border)', backgroundColor: 'var(--df-surface)' }}>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {timeOptions.map(time => (
                                        <SelectItem key={time} value={time}>{time}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex-1">
                            <label style={{ display: 'block', fontSize: 'var(--df-type-body-size)', color: 'var(--df-text)', marginBottom: '8px' }}>
                                End
                            </label>
                            <Select
                                value={localPrefs.workingHoursEnd}
                                onValueChange={(value) => setLocalPrefs(prev => ({ ...prev, workingHoursEnd: value }))}
                            >
                                <SelectTrigger style={{ minHeight: '48px', borderColor: 'var(--df-border)', backgroundColor: 'var(--df-surface)' }}>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {timeOptions.map(time => (
                                        <SelectItem key={time} value={time}>{time}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </Card>

                {/* Protected Focus Time Section */}
                <Card
                    style={{
                        padding: 'var(--df-space-24)',
                        backgroundColor: 'var(--df-surface)',
                        borderColor: 'var(--df-border)',
                        borderRadius: 'var(--df-radius-md)'
                    }}
                >
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-full" style={{ backgroundColor: 'var(--df-surface-alt)' }}>
                                <Shield size={20} style={{ color: 'var(--df-primary)' }} />
                            </div>
                            <div>
                                <h3 style={{ fontSize: 'var(--df-type-subtitle-size)', fontWeight: 'var(--df-type-subtitle-weight)', color: 'var(--df-text)' }}>
                                    Protected Focus Time
                                </h3>
                                <p style={{ fontSize: 'var(--df-type-caption-size)', color: 'var(--df-text-muted)' }}>
                                    Block time for deep work
                                </p>
                            </div>
                        </div>

                        <Button
                            onClick={addNoMeetingWindow}
                            variant="ghost"
                            style={{ color: 'var(--df-primary)', minHeight: '44px', gap: '8px' }}
                        >
                            <Plus size={16} />
                            Add
                        </Button>
                    </div>

                    <div className="space-y-3">
                        {localPrefs.noMeetingWindows.map((window, index) => (
                            <div
                                key={index}
                                className="p-4 rounded"
                                style={{
                                    backgroundColor: 'var(--df-surface-alt)',
                                    borderRadius: 'var(--df-radius-sm)',
                                    border: '1px solid var(--df-border)'
                                }}
                            >
                                {/* Label input on its own row */}
                                <div className="mb-3">
                                    <input
                                        type="text"
                                        value={window.label}
                                        onChange={(e) => updateNoMeetingWindow(index, 'label', e.target.value)}
                                        className="w-full bg-transparent border-none outline-none"
                                        style={{
                                            fontSize: 'var(--df-type-body-size)',
                                            fontWeight: 600,
                                            color: 'var(--df-text)',
                                            padding: 0
                                        }}
                                        placeholder="Label (e.g., Deep work)"
                                    />
                                </div>

                                {/* Time selectors and delete button in a row */}
                                <div className="flex items-center gap-3">
                                    <Select value={window.start} onValueChange={(value) => updateNoMeetingWindow(index, 'start', value)}>
                                        <SelectTrigger style={{
                                            minWidth: '100px',
                                            minHeight: '40px',
                                            fontSize: 'var(--df-type-body-size)',
                                            borderColor: 'var(--df-border)',
                                            backgroundColor: 'var(--df-surface)'
                                        }}>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {timeOptions.map(time => (
                                                <SelectItem key={time} value={time}>{time}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>

                                    <span style={{ color: 'var(--df-text-muted)', fontSize: 'var(--df-type-body-size)' }}>to</span>

                                    <Select value={window.end} onValueChange={(value) => updateNoMeetingWindow(index, 'end', value)}>
                                        <SelectTrigger style={{
                                            minWidth: '100px',
                                            minHeight: '40px',
                                            fontSize: 'var(--df-type-body-size)',
                                            borderColor: 'var(--df-border)',
                                            backgroundColor: 'var(--df-surface)'
                                        }}>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {timeOptions.map(time => (
                                                <SelectItem key={time} value={time}>{time}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>

                                    <Button
                                        onClick={() => removeNoMeetingWindow(index)}
                                        variant="ghost"
                                        size="sm"
                                        style={{
                                            color: 'var(--df-text-muted)',
                                            minHeight: '40px',
                                            minWidth: '40px',
                                            marginLeft: 'auto'
                                        }}
                                    >
                                        <X size={16} />
                                    </Button>
                                </div>
                            </div>
                        ))}

                        {localPrefs.noMeetingWindows.length === 0 && (
                            <p className="text-center py-4" style={{ color: 'var(--df-text-muted)', fontSize: 'var(--df-type-caption-size)' }}>
                                No protected time blocks. Add one to block meeting scheduling.
                            </p>
                        )}
                    </div>
                </Card>

                {/* Break Preferences Section */}
                <Card
                    style={{
                        padding: 'var(--df-space-24)',
                        backgroundColor: 'var(--df-surface)',
                        borderColor: 'var(--df-border)',
                        borderRadius: 'var(--df-radius-md)'
                    }}
                >
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 rounded-full" style={{ backgroundColor: 'var(--df-surface-alt)' }}>
                            <Coffee size={20} style={{ color: 'var(--df-primary)' }} />
                        </div>
                        <div>
                            <h3 style={{ fontSize: 'var(--df-type-subtitle-size)', fontWeight: 'var(--df-type-subtitle-weight)', color: 'var(--df-text)' }}>
                                Break Preferences
                            </h3>
                            <p style={{ fontSize: 'var(--df-type-caption-size)', color: 'var(--df-text-muted)' }}>
                                Configure breaks and interruption limits
                            </p>
                        </div>
                    </div>

                    {/* Break Duration */}
                    <div className="mb-6">
                        <div className="flex justify-between mb-2">
                            <label style={{ fontSize: 'var(--df-type-body-size)', color: 'var(--df-text)' }}>
                                Break duration
                            </label>
                            <span style={{ fontSize: 'var(--df-type-body-size)', color: 'var(--df-text)' }}>
                                {localPrefs.breakDuration} min
                            </span>
                        </div>
                        <Slider
                            value={[localPrefs.breakDuration]}
                            onValueChange={(value) => setLocalPrefs(prev => ({ ...prev, breakDuration: value[0] }))}
                            min={5}
                            max={30}
                            step={5}
                            className="w-full"
                        />
                        <div className="flex justify-between mt-1" style={{ fontSize: 'var(--df-type-caption-size)', color: 'var(--df-text-muted)' }}>
                            <span>5 min</span>
                            <span>30 min</span>
                        </div>
                    </div>

                    {/* Break Frequency */}
                    <div className="mb-6">
                        <div className="flex justify-between mb-2">
                            <label style={{ fontSize: 'var(--df-type-body-size)', color: 'var(--df-text)' }}>
                                Break frequency
                            </label>
                            <span style={{ fontSize: 'var(--df-type-body-size)', color: 'var(--df-text)' }}>
                                Every {localPrefs.breakFrequency} min
                            </span>
                        </div>
                        <Slider
                            value={[localPrefs.breakFrequency]}
                            onValueChange={(value) => setLocalPrefs(prev => ({ ...prev, breakFrequency: value[0] }))}
                            min={30}
                            max={180}
                            step={15}
                            className="w-full"
                        />
                        <div className="flex justify-between mt-1" style={{ fontSize: 'var(--df-type-caption-size)', color: 'var(--df-text-muted)' }}>
                            <span>30 min</span>
                            <span>3 hours</span>
                        </div>
                    </div>

                    {/* Interruption Budget */}
                    <div>
                        <div className="flex justify-between mb-2">
                            <label style={{ fontSize: 'var(--df-type-body-size)', color: 'var(--df-text)' }}>
                                Daily interruption budget
                            </label>
                            <span style={{ fontSize: 'var(--df-type-body-size)', color: 'var(--df-text)' }}>
                                {localPrefs.interruptionBudget} {localPrefs.interruptionBudget === 1 ? 'interruption' : 'interruptions'}
                            </span>
                        </div>
                        <Slider
                            value={[localPrefs.interruptionBudget]}
                            onValueChange={(value) => setLocalPrefs(prev => ({ ...prev, interruptionBudget: value[0] }))}
                            min={0}
                            max={10}
                            step={1}
                            className="w-full"
                        />
                        <div className="flex justify-between mt-1" style={{ fontSize: 'var(--df-type-caption-size)', color: 'var(--df-text-muted)' }}>
                            <span>0</span>
                            <span>10</span>
                        </div>
                    </div>
                </Card>

                {/* Auto-Resolve Settings */}
                <Card
                    style={{
                        padding: 'var(--df-space-24)',
                        backgroundColor: 'var(--df-surface)',
                        borderColor: 'var(--df-border)',
                        borderRadius: 'var(--df-radius-md)'
                    }}
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 style={{ fontSize: 'var(--df-type-subtitle-size)', fontWeight: 'var(--df-type-subtitle-weight)', color: 'var(--df-text)' }}>
                                Auto-Resolve Conflicts
                            </h3>
                            <p style={{ fontSize: 'var(--df-type-caption-size)', color: 'var(--df-text-muted)' }}>
                                Allow agents to automatically fix schedule conflicts
                            </p>
                        </div>
                        <button
                            onClick={() => setLocalPrefs(prev => ({ ...prev, autoResolveConflicts: !prev.autoResolveConflicts }))}
                            className={`w-12 h-6 rounded-full p-1 transition-colors ${localPrefs.autoResolveConflicts ? 'bg-green-500' : 'bg-gray-300'}`}
                            style={{
                                backgroundColor: localPrefs.autoResolveConflicts ? 'var(--df-primary)' : 'var(--df-border)'
                            }}
                        >
                            <div
                                className={`w-4 h-4 rounded-full bg-white shadow-sm transform transition-transform ${localPrefs.autoResolveConflicts ? 'translate-x-6' : ''}`}
                                style={{ backgroundColor: 'var(--df-primary-contrast)' }}
                            />
                        </button>
                    </div>
                </Card>

                {/* Conflict Resolution Style */}
                <Card
                    style={{
                        padding: 'var(--df-space-24)',
                        backgroundColor: 'var(--df-surface)',
                        borderColor: 'var(--df-border)',
                        borderRadius: 'var(--df-radius-md)'
                    }}
                >
                    <h3 style={{ fontSize: 'var(--df-type-subtitle-size)', fontWeight: 'var(--df-type-subtitle-weight)', color: 'var(--df-text)', marginBottom: '16px' }}>
                        Conflict Resolution Style
                    </h3>

                    <div className="space-y-3">
                        {[
                            { value: 'aggressive', label: 'Aggressive', description: 'Prioritize deadlines, reschedule freely' },
                            { value: 'balanced', label: 'Balanced', description: 'Balance deadlines with comfort' },
                            { value: 'conservative', label: 'Conservative', description: 'Minimize schedule changes' }
                        ].map(option => (
                            <button
                                key={option.value}
                                onClick={() => setLocalPrefs(prev => ({
                                    ...prev,
                                    conflictResolutionStyle: option.value as typeof prev.conflictResolutionStyle
                                }))}
                                className="w-full text-left p-3 rounded transition-all"
                                style={{
                                    backgroundColor: localPrefs.conflictResolutionStyle === option.value
                                        ? 'var(--df-primary)'
                                        : 'var(--df-surface-alt)',
                                    color: localPrefs.conflictResolutionStyle === option.value
                                        ? 'var(--df-primary-contrast)'
                                        : 'var(--df-text)',
                                    borderRadius: 'var(--df-radius-sm)'
                                }}
                            >
                                <div style={{ fontWeight: 'var(--df-type-body-weight)' }}>{option.label}</div>
                                <div style={{
                                    fontSize: 'var(--df-type-caption-size)',
                                    opacity: localPrefs.conflictResolutionStyle === option.value ? 0.9 : 0.7
                                }}>
                                    {option.description}
                                </div>
                            </button>
                        ))}
                    </div>
                </Card>

                {/* Quick Presets */}
                <div>
                    <h4 style={{ fontSize: 'var(--df-type-body-size)', fontWeight: 'var(--df-type-body-weight)', color: 'var(--df-text)', marginBottom: '12px' }}>
                        Quick Presets
                    </h4>

                    <div className="grid grid-cols-2 gap-3">
                        {[
                            { key: 'highFocus', label: 'High Focus', desc: '5 min breaks, every 2h' },
                            { key: 'balanced', label: 'Balanced', desc: '15 min breaks, every 90m' },
                            { key: 'collaborative', label: 'Collaborative', desc: '20 min breaks, every 60m' },
                            { key: 'flexible', label: 'Flexible', desc: '30 min breaks, every 3h' }
                        ].map(preset => (
                            <button
                                key={preset.key}
                                onClick={() => handlePresetClick(preset.key as keyof typeof PREFERENCE_PRESETS)}
                                disabled={saving}
                                className="p-3 rounded text-left transition-colors"
                                style={{
                                    backgroundColor: 'var(--df-surface-alt)',
                                    border: '1px solid var(--df-border)',
                                    borderRadius: 'var(--df-radius-sm)',
                                    minHeight: '64px'
                                }}
                            >
                                <div style={{ fontSize: 'var(--df-type-caption-size)', fontWeight: 600, color: 'var(--df-text)' }}>
                                    {preset.label}
                                </div>
                                <div style={{ fontSize: 'var(--df-type-caption-size)', color: 'var(--df-text-muted)' }}>
                                    {preset.desc}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Debug Actions */}
                <Card
                    style={{
                        padding: 'var(--df-space-24)',
                        backgroundColor: 'var(--df-surface)',
                        borderColor: 'var(--df-border)',
                        borderRadius: 'var(--df-radius-md)',
                        marginBottom: 'var(--df-space-24)'
                    }}
                >
                    <h3 style={{ fontSize: 'var(--df-type-subtitle-size)', fontWeight: 'var(--df-type-subtitle-weight)', color: 'var(--df-text)', marginBottom: '12px' }}>
                        Debug Actions
                    </h3>
                    <Button
                        variant="outline"
                        className="w-full mb-3"
                        onClick={async () => {
                            const user = await authManager.getCurrentUser();
                            if (user) {
                                const { error } = await supabase.from('proactive_suggestions').insert({
                                    user_id: user.id,
                                    type: 'morning_briefing',
                                    message: 'Good morning! Ready to plan your day?',
                                    action_type: 'compose_day',
                                    action_payload: {},
                                    status: 'pending'
                                });

                                if (error) {
                                    console.error('Simulate Suggestion Error:', error);
                                    alert('Failed to insert suggestion: ' + error.message);
                                } else {
                                    alert('Suggestion inserted! Check Dashboard.');
                                }
                            }
                        }}
                        style={{
                            borderColor: 'var(--df-primary)',
                            color: 'var(--df-primary)',
                            minHeight: '48px'
                        }}
                    >
                        <Zap size={16} className="mr-2" />
                        Simulate Morning Suggestion
                    </Button>

                    <Button
                        variant="outline"
                        className="w-full mb-3"
                        onClick={async () => {
                            const user = await authManager.getCurrentUser();
                            if (user) {
                                const { error } = await supabase.from('proactive_suggestions').insert({
                                    user_id: user.id,
                                    type: 'unsynced_calendar',
                                    message: 'You have 3 calendar events not in your plan.',
                                    action_type: 'sync_calendar',
                                    action_payload: {},
                                    status: 'pending'
                                });

                                if (error) {
                                    console.error('Simulate Suggestion Error:', error);
                                    alert('Failed to insert suggestion: ' + error.message);
                                } else {
                                    alert('Calendar suggestion inserted! Check Dashboard.');
                                }
                            }
                        }}
                        style={{
                            borderColor: 'var(--df-warning)',
                            color: 'var(--df-warning)',
                            minHeight: '48px'
                        }}
                    >
                        <Calendar size={16} className="mr-2" />
                        Simulate Unsynced Calendar
                    </Button>

                    <Button
                        variant="outline"
                        className="w-full"
                        onClick={async () => {
                            const user = await authManager.getCurrentUser();
                            if (user) {
                                const { error } = await supabase.from('proactive_suggestions').insert({
                                    user_id: user.id,
                                    type: 'conflict_resolution',
                                    message: 'Scheduling conflict detected. Tap to resolve.',
                                    action_type: 'review_conflict',
                                    action_payload: { alert_id: 'dummy' },
                                    status: 'pending'
                                });

                                if (error) {
                                    console.error('Simulate Suggestion Error:', error);
                                    alert('Failed to insert suggestion: ' + error.message);
                                } else {
                                    alert('Conflict suggestion inserted! Check Dashboard.');
                                }
                            }
                        }}
                        style={{
                            borderColor: 'var(--df-danger)',
                            color: 'var(--df-danger)',
                            minHeight: '48px'
                        }}
                    >
                        <Shield size={16} className="mr-2" />
                        Simulate Conflict (Manual)
                    </Button>

                    <Button
                        variant="outline"
                        className="w-full"
                        onClick={async () => {
                            const user = await authManager.getCurrentUser();
                            if (user) {
                                // 1. Create a Schedule Block
                                const now = new Date();
                                const start = new Date(now.setHours(now.getHours() + 1, 0, 0, 0)); // Next hour
                                const end = new Date(now.setHours(now.getHours() + 1, 0, 0, 0));

                                const { data: block, error: blockError } = await supabase.from('schedule_blocks').insert({
                                    user_id: user.id,
                                    title: 'Deep Work Session',
                                    block_type: 'deep_work',
                                    start_time: start.toISOString(),
                                    end_time: end.toISOString(),
                                    is_fixed: true,
                                    status: 'active'
                                }).select().single();

                                if (blockError) {
                                    alert('Failed to create block: ' + blockError.message);
                                    return;
                                }

                                // 2. Create a Conflicting Calendar Event
                                const { data: event, error: eventError } = await supabase.from('calendar_events').insert({
                                    user_id: user.id,
                                    title: 'Urgent Team Meeting',
                                    start_at: start.toISOString(),
                                    end_at: end.toISOString(),
                                    source: 'google',
                                    external_id: 'simulated_' + Date.now()
                                }).select().single();

                                if (eventError) {
                                    alert('Failed to create event: ' + eventError.message);
                                    return;
                                }

                                // 3. Invoke Guardian
                                const { error: guardianError } = await supabase.functions.invoke('guardian-check', {
                                    body: { event_id: event.id, user_id: user.id }
                                });

                                if (guardianError) {
                                    alert('Guardian check failed: ' + guardianError.message);
                                } else {
                                    alert('Real conflict created! Guardian triggered. Watch for suggestion.');
                                }
                            }
                        }}
                        style={{
                            borderColor: 'var(--df-danger)',
                            color: 'var(--df-danger)',
                            minHeight: '48px'
                        }}
                    >
                        <Shield size={16} className="mr-2" />
                        Simulate Real Conflict (End-to-End)
                    </Button>
                </Card>

                {/* Reset Button */}
                <Button
                    onClick={handleReset}
                    disabled={saving}
                    variant="ghost"
                    className="w-full"
                    style={{
                        color: 'var(--df-text-muted)',
                        minHeight: '48px',
                        gap: '8px'
                    }}
                >
                    <RotateCcw size={16} />
                    Reset to Defaults
                </Button>
            </div>
        </>
    );
}
