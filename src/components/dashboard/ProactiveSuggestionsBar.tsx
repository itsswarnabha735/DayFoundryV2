import React, { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabase/client';
import { authManager } from '../../utils/auth';
import { X, Sparkles, ArrowRight } from 'lucide-react';
import { Button } from '../ui/button';

interface Suggestion {
    id: string;
    type: string;
    message: string;
    action_type: string;
    action_payload: any;
    status: string;
}

interface ProactiveSuggestionsBarProps {
    onAction: (actionType: string, payload: any) => void;
}

export function ProactiveSuggestionsBar({ onAction }: ProactiveSuggestionsBarProps) {
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchSuggestions();
    }, []);

    const fetchSuggestions = async () => {
        try {
            const user = await authManager.getCurrentUser();
            if (!user) {
                console.log('ProactiveSuggestionsBar: No user found');
                return;
            }

            const { data, error } = await supabase
                .from('proactive_suggestions')
                .select('*')
                .eq('user_id', user.id)
                .eq('status', 'pending')
                .order('created_at', { ascending: false })
                .limit(1);

            if (error) {
                console.error('ProactiveSuggestionsBar: Error fetching suggestions', error);
            } else {
                console.log('ProactiveSuggestionsBar: Fetched suggestions', data);
                if (data) setSuggestions(data);
            }
        } catch (err) {
            console.error('ProactiveSuggestionsBar: stored error', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const subscription = supabase
            .channel('proactive_suggestions_changes')
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'proactive_suggestions' },
                () => {
                    fetchSuggestions();
                }
            )
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    const handleDismiss = async (id: string) => {
        // Optimistic update
        setSuggestions(prev => prev.filter(s => s.id !== id));

        await supabase
            .from('proactive_suggestions')
            .update({ status: 'dismissed' })
            .eq('id', id);
    };

    const handleAccept = async (suggestion: Suggestion) => {
        // Mark accepted
        await supabase
            .from('proactive_suggestions')
            .update({ status: 'accepted' })
            .eq('id', suggestion.id);

        // Remove from view
        setSuggestions(prev => prev.filter(s => s.id !== suggestion.id));

        // Trigger action
        onAction(suggestion.action_type, suggestion.action_payload);
    };

    if (loading || suggestions.length === 0) return null;

    const currentSuggestion = suggestions[0];

    return (
        <div
            className="mb-4 mx-4 p-3 rounded-lg flex items-center justify-between shadow-sm border animate-in slide-in-from-top-2"
            style={{
                backgroundColor: 'var(--df-surface)', // Or a subtle accent color bg
                borderColor: 'var(--df-primary)', // Highlight border
                borderWidth: '1px'
            }}
        >
            <div className="flex items-center gap-3">
                <div className="p-2 rounded-full" style={{ backgroundColor: 'var(--df-primary-light, rgba(59, 130, 246, 0.1))' }}>
                    <Sparkles size={18} style={{ color: 'var(--df-primary)' }} />
                </div>
                <div>
                    <p style={{
                        fontSize: 'var(--df-type-body-size)',
                        fontWeight: '600',
                        color: 'var(--df-text)'
                    }}>
                        {currentSuggestion.message}
                    </p>
                </div>
            </div>

            <div className="flex items-center gap-2">
                <Button
                    size="sm"
                    onClick={() => handleAccept(currentSuggestion)}
                    style={{
                        backgroundColor: 'var(--df-primary)',
                        color: 'var(--df-primary-contrast)',
                        gap: '4px',
                        height: '32px',
                        fontSize: 'var(--df-type-caption-size)'
                    }}
                >
                    Review <ArrowRight size={14} />
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDismiss(currentSuggestion.id)}
                    style={{
                        height: '32px',
                        width: '32px',
                        padding: 0,
                        color: 'var(--df-text-muted)'
                    }}
                >
                    <X size={16} />
                </Button>
            </div>
        </div>
    );
}
