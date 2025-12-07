import React from 'react';
import { Mic, MicOff, X, Square, AlertTriangle } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { useVoiceRecorder, RecordingState } from '../../hooks/useVoiceRecorder';

interface VoiceRecorderProps {
    /** Callback when recording is complete with transcript */
    onCapture: (transcript: string) => void;
    /** Callback to close the recorder */
    onClose: () => void;
    /** Optional language (default: 'en-US') */
    lang?: string;
    /** Optional max duration in seconds (default: 60) */
    maxDuration?: number;
}

/**
 * Voice recorder component with real-time transcription
 */
export function VoiceRecorder({
    onCapture,
    onClose,
    lang = 'en-US',
    maxDuration = 60
}: VoiceRecorderProps) {
    const {
        state,
        transcript,
        interimTranscript,
        duration,
        error,
        isSupported,
        startRecording,
        stopRecording,
        cancelRecording,
    } = useVoiceRecorder({
        lang,
        maxDuration,
        onComplete: (finalTranscript) => {
            if (finalTranscript.trim()) {
                onCapture(finalTranscript);
                onClose();
            }
        },
    });

    // Format duration as MM:SS
    const formatDuration = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // Handle starting/stopping recording
    const handleRecordToggle = () => {
        if (state === 'recording') {
            stopRecording();
        } else if (state === 'idle' || state === 'error') {
            startRecording();
        }
    };

    // Handle cancel
    const handleCancel = () => {
        cancelRecording();
        onClose();
    };

    // Browser not supported
    if (!isSupported) {
        return (
            <Card
                className="p-4 fixed bottom-20 left-4 right-4 z-50"
                style={{
                    backgroundColor: 'var(--df-surface)',
                    borderColor: 'var(--df-danger)',
                    borderRadius: 'var(--df-radius-lg)',
                    boxShadow: 'var(--df-shadow-lg)',
                }}
            >
                <div className="flex items-start space-x-3">
                    <div
                        className="p-2 rounded-full"
                        style={{ backgroundColor: 'var(--df-danger)', opacity: 0.2 }}
                    >
                        <AlertTriangle size={24} style={{ color: 'var(--df-danger)' }} />
                    </div>
                    <div className="flex-1">
                        <h3
                            style={{
                                fontSize: 'var(--df-type-subtitle-size)',
                                fontWeight: 'var(--df-type-subtitle-weight)',
                                color: 'var(--df-text)',
                                marginBottom: '4px'
                            }}
                        >
                            Speech Recognition Not Supported
                        </h3>
                        <p style={{
                            fontSize: 'var(--df-type-body-size)',
                            color: 'var(--df-text-muted)'
                        }}>
                            Your browser doesn't support speech recognition. Please use Chrome or Safari.
                        </p>
                    </div>
                    <Button
                        variant="ghost"
                        onClick={onClose}
                        style={{ minHeight: '44px', minWidth: '44px' }}
                    >
                        <X size={20} />
                    </Button>
                </div>
            </Card>
        );
    }

    return (
        <Card
            className="p-4 fixed bottom-20 left-4 right-4 z-50"
            style={{
                backgroundColor: 'var(--df-surface)',
                borderColor: state === 'recording' ? 'var(--df-danger)' : 'var(--df-border)',
                borderRadius: 'var(--df-radius-lg)',
                boxShadow: 'var(--df-shadow-lg)',
            }}
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <h3
                    style={{
                        fontSize: 'var(--df-type-subtitle-size)',
                        fontWeight: 'var(--df-type-subtitle-weight)',
                        color: 'var(--df-text)'
                    }}
                >
                    {state === 'recording' ? 'Listening...' :
                        state === 'requesting-permission' ? 'Requesting Permission...' :
                            state === 'error' ? 'Error' : 'Voice Capture'}
                </h3>
                <Button
                    variant="ghost"
                    onClick={handleCancel}
                    style={{
                        minHeight: '36px',
                        minWidth: '36px',
                        color: 'var(--df-text-muted)'
                    }}
                >
                    <X size={18} />
                </Button>
            </div>

            {/* Error Message */}
            {error && (
                <div
                    className="mb-4 p-3 rounded-lg"
                    style={{
                        backgroundColor: 'var(--df-danger)',
                        opacity: 0.1
                    }}
                >
                    <p style={{
                        fontSize: 'var(--df-type-body-size)',
                        color: 'var(--df-danger)'
                    }}>
                        {error}
                    </p>
                </div>
            )}

            {/* Recording Indicator & Timer */}
            <div className="flex items-center justify-center mb-4">
                <div className="flex items-center space-x-4">
                    {/* Pulsing Recording Indicator */}
                    {state === 'recording' && (
                        <div
                            className="w-3 h-3 rounded-full animate-pulse"
                            style={{ backgroundColor: 'var(--df-danger)' }}
                        />
                    )}

                    {/* Timer */}
                    <span
                        style={{
                            fontSize: '32px',
                            fontWeight: '600',
                            color: state === 'recording' ? 'var(--df-text)' : 'var(--df-text-muted)',
                            fontVariantNumeric: 'tabular-nums'
                        }}
                    >
                        {formatDuration(duration)}
                    </span>

                    {/* Max Duration Indicator */}
                    <span
                        style={{
                            fontSize: 'var(--df-type-caption-size)',
                            color: 'var(--df-text-muted)'
                        }}
                    >
                        / {formatDuration(maxDuration)}
                    </span>
                </div>
            </div>

            {/* Transcript Preview */}
            <div
                className="mb-4 p-3 rounded-lg min-h-[80px] max-h-[120px] overflow-auto"
                style={{
                    backgroundColor: 'var(--df-surface-alt)',
                    borderRadius: 'var(--df-radius-md)'
                }}
            >
                {transcript || interimTranscript ? (
                    <p style={{
                        fontSize: 'var(--df-type-body-size)',
                        color: 'var(--df-text)',
                        lineHeight: '1.5'
                    }}>
                        {transcript}
                        {interimTranscript && (
                            <span style={{ color: 'var(--df-text-muted)' }}>
                                {transcript ? ' ' : ''}{interimTranscript}
                            </span>
                        )}
                    </p>
                ) : (
                    <p style={{
                        fontSize: 'var(--df-type-body-size)',
                        color: 'var(--df-text-muted)',
                        fontStyle: 'italic'
                    }}>
                        {state === 'recording'
                            ? 'Start speaking...'
                            : state === 'requesting-permission'
                                ? 'Waiting for microphone access...'
                                : 'Tap the microphone button to start recording'}
                    </p>
                )}
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center space-x-4">
                {/* Cancel Button */}
                <Button
                    variant="outline"
                    onClick={handleCancel}
                    style={{
                        minHeight: '48px',
                        minWidth: '48px',
                        borderColor: 'var(--df-border)',
                        color: 'var(--df-text-muted)',
                        borderRadius: '50%',
                        padding: '12px'
                    }}
                >
                    <X size={24} />
                </Button>

                {/* Record/Stop Button */}
                <Button
                    onClick={handleRecordToggle}
                    disabled={state === 'requesting-permission' || state === 'processing'}
                    style={{
                        minHeight: '72px',
                        minWidth: '72px',
                        backgroundColor: state === 'recording' ? 'var(--df-danger)' : 'var(--df-primary)',
                        color: 'white',
                        borderRadius: '50%',
                        padding: '16px',
                        transition: 'all 0.2s ease',
                        transform: state === 'recording' ? 'scale(1.1)' : 'scale(1)',
                    }}
                >
                    {state === 'recording' ? (
                        <Square size={28} fill="white" />
                    ) : (
                        <Mic size={32} />
                    )}
                </Button>

                {/* Done Button (only visible when recording) */}
                {state === 'recording' && transcript && (
                    <Button
                        variant="outline"
                        onClick={stopRecording}
                        style={{
                            minHeight: '48px',
                            minWidth: '48px',
                            borderColor: 'var(--df-success)',
                            color: 'var(--df-success)',
                            borderRadius: '50%',
                            padding: '12px'
                        }}
                    >
                        <MicOff size={24} />
                    </Button>
                )}

                {/* Placeholder for symmetry when not recording */}
                {(!transcript || state !== 'recording') && (
                    <div style={{ width: '48px', height: '48px' }} />
                )}
            </div>

            {/* Helper Text */}
            <p
                className="text-center mt-4"
                style={{
                    fontSize: 'var(--df-type-caption-size)',
                    color: 'var(--df-text-muted)'
                }}
            >
                {state === 'recording'
                    ? 'Tap the red button to stop recording'
                    : 'Tap the microphone to start speaking'}
            </p>
        </Card>
    );
}

export default VoiceRecorder;
