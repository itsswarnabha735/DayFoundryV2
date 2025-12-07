import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Plus, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { supabase } from '../../utils/supabase/client';
import { getPlaceSuggestions, debounce, PlacePrediction } from '../../utils/placesAutocomplete';

interface AddErrandFormProps {
    onErrandAdded?: () => void;
}

export function AddErrandForm({ onErrandAdded }: AddErrandFormProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [title, setTitle] = useState('');
    const [location, setLocation] = useState('');
    const [placeId, setPlaceId] = useState('');
    const [category, setCategory] = useState<'shopping' | 'pickup' | 'dropoff' | 'appointment'>('shopping');
    const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // New autocomplete states
    const [suggestions, setSuggestions] = useState<PlacePrediction[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);

    const inputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);


    // Fetch place suggestions with debouncing
    const fetchSuggestions = async (input: string) => {
        if (!input.trim()) {
            setSuggestions([]);
            setShowSuggestions(false);
            return;
        }

        setIsLoadingSuggestions(true);
        try {
            const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
            if (!apiKey) {
                console.error('Google Maps API key not found');
                return;
            }

            const results = await getPlaceSuggestions(input, apiKey);
            setSuggestions(results);
            setShowSuggestions(results.length > 0);
        } catch (error) {
            console.error('Error fetching suggestions:', error);
            setSuggestions([]);
            setShowSuggestions(false);
        } finally {
            setIsLoadingSuggestions(false);
        }
    };

    // Debounced version to avoid excessive API calls
    const debouncedFetchSuggestions = useRef(
        debounce(fetchSuggestions, 300)
    ).current;

    // Handle location input change
    const handleLocationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setLocation(value);
        setPlaceId(''); // Clear place ID when typing
        setSelectedIndex(-1);
        debouncedFetchSuggestions(value);
    };

    // Handle suggestion selection
    const selectSuggestion = (suggestion: PlacePrediction) => {
        setLocation(suggestion.mainText);
        setPlaceId(suggestion.placeId);
        setShowSuggestions(false);
        setSuggestions([]);
        setSelectedIndex(-1);
        console.log('Selected place:', suggestion);
    };

    // Handle keyboard navigation
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!showSuggestions || suggestions.length === 0) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedIndex(prev =>
                    prev < suggestions.length - 1 ? prev + 1 : prev
                );
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
                break;
            case 'Enter':
                e.preventDefault();
                if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
                    selectSuggestion(suggestions[selectedIndex]);
                }
                break;
            case 'Escape':
                setShowSuggestions(false);
                setSelectedIndex(-1);
                break;
        }
    };

    // Click outside to close dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node) &&
                !inputRef.current?.contains(event.target as Node)
            ) {
                setShowSuggestions(false);
                setSelectedIndex(-1);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!title.trim() || !location.trim()) {
            alert('Please fill in both title and location');
            return;
        }

        setIsSubmitting(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                alert('You must be logged in to add errands');
                return;
            }

            // Build context with place details
            let context = `location: ${location.trim()}`;
            if (placeId) {
                context += `\nplace_id: ${placeId}`;
            }

            const { error } = await supabase
                .from('tasks')
                .insert({
                    title: title.trim(),
                    context,
                    tags: ['errand', category],
                    category,
                    priority,
                    user_id: user.id,
                    // Required fields with defaults for errands
                    energy: 'shallow', // Errands are typically shallow work
                    est_min: 15, // Default 15-30 min for errands
                    est_most: 22,
                    est_max: 30,
                    steps: [], // No steps for simple errands
                    acceptance: 'Task will be completed when the errand is done.', // Default acceptance criteria
                    source: 'errand_form',
                    location: location.trim() // Store location as separate field too
                });

            if (error) throw error;

            // Reset form
            setTitle('');
            setLocation('');
            setPlaceId('');
            setCategory('shopping');
            setPriority('medium');
            setIsOpen(false);

            // Notify parent component
            if (onErrandAdded) {
                onErrandAdded();
            }

            alert('Errand added successfully! The Smart Bundling Agent will include it in suggestions.');
        } catch (error) {
            console.error('Error adding errand:', error);
            alert('Failed to add errand. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) {
        return (
            <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(true)}
                style={{
                    color: 'var(--df-primary)',
                    minHeight: '36px',
                    gap: '4px'
                }}
            >
                <Plus size={16} />
                <span style={{ fontSize: 'var(--df-type-body-size)' }}>Add Errand</span>
            </Button>
        );
    }

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                zIndex: 1000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px'
            }}
            onClick={() => setIsOpen(false)}
        >
            <Card
                onClick={(e: React.MouseEvent) => e.stopPropagation()}
                style={{
                    width: '100%',
                    maxWidth: '500px',
                    backgroundColor: 'var(--df-surface)',
                    padding: '24px',
                    borderRadius: 'var(--df-radius-lg)',
                    maxHeight: '90vh',
                    overflowY: 'auto'
                }}
            >
                <form onSubmit={handleSubmit}>
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <h2
                            style={{
                                fontSize: 'var(--df-type-title-size)',
                                fontWeight: 'var(--df-type-title-weight)',
                                color: 'var(--df-text)'
                            }}
                        >
                            Add New Errand
                        </h2>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsOpen(false)}
                            style={{ color: 'var(--df-text-muted)' }}
                        >
                            <X size={20} />
                        </Button>
                    </div>

                    {/* Title Input */}
                    <div className="mb-4">
                        <label
                            htmlFor="errand-title"
                            style={{
                                display: 'block',
                                marginBottom: '8px',
                                fontSize: 'var(--df-type-body-size)',
                                fontWeight: '500',
                                color: 'var(--df-text)'
                            }}
                        >
                            What do you need to do?
                        </label>
                        <input
                            id="errand-title"
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="e.g., Buy groceries, Pick up dry cleaning"
                            className="w-full px-3 py-2 rounded"
                            style={{
                                backgroundColor: 'var(--df-surface-alt)',
                                borderColor: 'var(--df-border)',
                                color: 'var(--df-text)',
                                fontSize: 'var(--df-type-body-size)',
                                border: '1px solid'
                            }}
                            required
                            autoFocus
                        />
                    </div>

                    {/* Location Input with Autocomplete */}
                    <div className="mb-4" style={{ position: 'relative' }}>
                        <label
                            htmlFor="errand-location"
                            style={{
                                display: 'block',
                                marginBottom: '8px',
                                fontSize: 'var(--df-type-body-size)',
                                fontWeight: '500',
                                color: 'var(--df-text)'
                            }}
                        >
                            <MapPin size={12} className="inline mr-1" />
                            Where?
                        </label>
                        <div style={{ width: '100%', position: 'relative' }}>
                            <input
                                ref={inputRef}
                                type="text"
                                value={location}
                                onChange={handleLocationChange}
                                onKeyDown={handleKeyDown}
                                placeholder="e.g., Whole Foods Market, CVS Pharmacy"
                                className="w-full px-3 py-2 rounded"
                                style={{
                                    backgroundColor: 'var(--df-surface-alt)',
                                    borderColor: 'var(--df-border)',
                                    color: 'var(--df-text)',
                                    fontSize: 'var(--df-type-body-size)',
                                    border: '1px solid'
                                }}
                                required
                            />

                            {/* Autocomplete Dropdown */}
                            {showSuggestions && (
                                <div
                                    ref={dropdownRef}
                                    style={{
                                        position: 'absolute',
                                        top: '100%',
                                        left: 0,
                                        right: 0,
                                        marginTop: '4px',
                                        backgroundColor: 'var(--df-surface)',
                                        border: '1px solid var(--df-border)',
                                        borderRadius: 'var(--df-radius-md)',
                                        maxHeight: '300px',
                                        overflowY: 'auto',
                                        zIndex: 1001,
                                        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                                    }}
                                >
                                    {isLoadingSuggestions ? (
                                        <div
                                            style={{
                                                padding: '12px',
                                                color: 'var(--df-text-muted)',
                                                fontSize: 'var(--df-type-body-size)'
                                            }}
                                        >
                                            Loading suggestions...
                                        </div>
                                    ) : suggestions.length > 0 ? (
                                        suggestions.map((suggestion, index) => (
                                            <div
                                                key={suggestion.placeId}
                                                onClick={() => selectSuggestion(suggestion)}
                                                style={{
                                                    padding: '12px',
                                                    cursor: 'pointer',
                                                    backgroundColor: selectedIndex === index ? 'var(--df-surface-alt)' : 'transparent',
                                                    borderBottom: index < suggestions.length - 1 ? '1px solid var(--df-border)' : 'none'
                                                }}
                                                onMouseEnter={() => setSelectedIndex(index)}
                                            >
                                                <div
                                                    style={{
                                                        fontSize: 'var(--df-type-body-size)',
                                                        fontWeight: '500',
                                                        color: 'var(--df-text)',
                                                        marginBottom: '2px'
                                                    }}
                                                >
                                                    {suggestion.mainText}
                                                </div>
                                                <div
                                                    style={{
                                                        fontSize: 'calc(var(--df-type-body-size) * 0.875)',
                                                        color: 'var(--df-text-muted)'
                                                    }}
                                                >
                                                    {suggestion.secondaryText}
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div
                                            style={{
                                                padding: '12px',
                                                color: 'var(--df-text-muted)',
                                                fontSize: 'var(--df-type-body-size)'
                                            }}
                                        >
                                            No results found
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Category Select */}
                    <div className="mb-4">
                        <label
                            htmlFor="errand-category"
                            style={{
                                display: 'block',
                                marginBottom: '8px',
                                fontSize: 'var(--df-type-body-size)',
                                fontWeight: '500',
                                color: 'var(--df-text)'
                            }}
                        >
                            Category
                        </label>
                        <select
                            id="errand-category"
                            value={category}
                            onChange={(e) => setCategory(e.target.value as any)}
                            className="w-full px-3 py-2 rounded"
                            style={{
                                backgroundColor: 'var(--df-surface-alt)',
                                borderColor: 'var(--df-border)',
                                color: 'var(--df-text)',
                                fontSize: 'var(--df-type-body-size)',
                                border: '1px solid'
                            }}
                        >
                            <option value="shopping">🛒 Shopping</option>
                            <option value="pickup">📦 Pickup</option>
                            <option value="dropoff">📤 Dropoff</option>
                            <option value="appointment">📅 Appointment</option>
                        </select>
                    </div>

                    {/* Priority Select */}
                    <div className="mb-6">
                        <label
                            htmlFor="errand-priority"
                            style={{
                                display: 'block',
                                marginBottom: '8px',
                                fontSize: 'var(--df-type-body-size)',
                                fontWeight: '500',
                                color: 'var(--df-text)'
                            }}
                        >
                            Priority
                        </label>
                        <select
                            id="errand-priority"
                            value={priority}
                            onChange={(e) => setPriority(e.target.value as any)}
                            className="w-full px-3 py-2 rounded"
                            style={{
                                backgroundColor: 'var(--df-surface-alt)',
                                borderColor: 'var(--df-border)',
                                color: 'var(--df-text)',
                                fontSize: 'var(--df-type-body-size)',
                                border: '1px solid'
                            }}
                        >
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                        </select>
                    </div>

                    {/* Submit Button */}
                    <Button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full"
                        style={{
                            backgroundColor: 'var(--df-primary)',
                            color: 'var(--df-primary-contrast)',
                            minHeight: '44px',
                            fontSize: 'var(--df-type-body-size)',
                            fontWeight: '600'
                        }}
                    >
                        {isSubmitting ? 'Adding...' : 'Add Errand'}
                    </Button>
                </form>
            </Card>
        </div>
    );
}
