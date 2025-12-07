import { useState, useCallback, useRef, useEffect } from 'react';

// Type definitions for Web Speech API
interface SpeechRecognitionResult {
    readonly length: number;
    item(index: number): SpeechRecognitionAlternative;
    [index: number]: SpeechRecognitionAlternative;
    readonly isFinal: boolean;
}

interface SpeechRecognitionAlternative {
    readonly transcript: string;
    readonly confidence: number;
}

interface SpeechRecognitionResultList {
    readonly length: number;
    item(index: number): SpeechRecognitionResult;
    [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent extends Event {
    readonly resultIndex: number;
    readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
    readonly error: string;
    readonly message: string;
}

interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    maxAlternatives: number;
    onresult: ((event: SpeechRecognitionEvent) => void) | null;
    onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
    onend: (() => void) | null;
    onstart: (() => void) | null;
    start(): void;
    stop(): void;
    abort(): void;
}

interface SpeechRecognitionConstructor {
    new(): SpeechRecognition;
}

// Get SpeechRecognition constructor (with webkit prefix for Safari)
const getSpeechRecognition = (): SpeechRecognitionConstructor | null => {
    if (typeof window === 'undefined') return null;

    const win = window as any;
    return win.SpeechRecognition || win.webkitSpeechRecognition || null;
};

export type RecordingState = 'idle' | 'requesting-permission' | 'recording' | 'processing' | 'error';

export interface VoiceRecorderState {
    /** Current recording state */
    state: RecordingState;
    /** Current transcript (interim results included) */
    transcript: string;
    /** Final transcript after recording stops */
    finalTranscript: string;
    /** Interim transcript being processed */
    interimTranscript: string;
    /** Recording duration in seconds */
    duration: number;
    /** Error message if any */
    error: string | null;
    /** Whether Web Speech API is supported */
    isSupported: boolean;
    /** Whether microphone permission is granted */
    hasPermission: boolean | null;
}

export interface VoiceRecorderActions {
    /** Start recording */
    startRecording: () => Promise<void>;
    /** Stop recording and get transcript */
    stopRecording: () => void;
    /** Cancel recording without saving */
    cancelRecording: () => void;
    /** Reset state to idle */
    reset: () => void;
}

export type UseVoiceRecorderReturn = VoiceRecorderState & VoiceRecorderActions;

const INITIAL_STATE: VoiceRecorderState = {
    state: 'idle',
    transcript: '',
    finalTranscript: '',
    interimTranscript: '',
    duration: 0,
    error: null,
    isSupported: false,
    hasPermission: null,
};

/**
 * Hook for voice recording using Web Speech API
 * Provides real-time transcription of speech to text
 */
export function useVoiceRecorder(options?: {
    /** Language for speech recognition (default: 'en-US') */
    lang?: string;
    /** Enable continuous recognition (default: true) */
    continuous?: boolean;
    /** Maximum recording duration in seconds (default: 60) */
    maxDuration?: number;
    /** Callback when recording completes with final transcript */
    onComplete?: (transcript: string) => void;
}): UseVoiceRecorderReturn {
    const {
        lang = 'en-US',
        continuous = true,
        maxDuration = 60,
        onComplete,
    } = options || {};

    const [state, setState] = useState<VoiceRecorderState>(() => ({
        ...INITIAL_STATE,
        isSupported: getSpeechRecognition() !== null,
    }));

    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const startTimeRef = useRef<number>(0);
    const maxDurationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const finalTranscriptRef = useRef<string>('');

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (recognitionRef.current) {
                try {
                    recognitionRef.current.abort();
                } catch (e) {
                    // Ignore errors during cleanup
                }
            }
            if (timerRef.current) clearInterval(timerRef.current);
            if (maxDurationTimeoutRef.current) clearTimeout(maxDurationTimeoutRef.current);
        };
    }, []);

    // Request microphone permission
    const requestPermission = useCallback(async (): Promise<boolean> => {
        try {
            // Check if we can use mediaDevices API for permission
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                // Stop all tracks immediately - we just needed to trigger permission
                stream.getTracks().forEach(track => track.stop());
                setState(prev => ({ ...prev, hasPermission: true }));
                return true;
            }
            // Fallback: assume permission will be requested by SpeechRecognition
            return true;
        } catch (error) {
            console.error('Microphone permission denied:', error);
            setState(prev => ({
                ...prev,
                hasPermission: false,
                state: 'error',
                error: 'Microphone permission denied. Please allow microphone access and try again.',
            }));
            return false;
        }
    }, []);

    // Start recording
    const startRecording = useCallback(async () => {
        const SpeechRecognitionClass = getSpeechRecognition();

        if (!SpeechRecognitionClass) {
            setState(prev => ({
                ...prev,
                state: 'error',
                error: 'Speech recognition is not supported in this browser. Please use Chrome or Safari.',
            }));
            return;
        }

        setState(prev => ({ ...prev, state: 'requesting-permission', error: null }));

        // Request microphone permission first
        const hasPermission = await requestPermission();
        if (!hasPermission) {
            return;
        }

        try {
            // Create new recognition instance
            const recognition = new SpeechRecognitionClass();
            recognition.continuous = continuous;
            recognition.interimResults = true;
            recognition.lang = lang;
            recognition.maxAlternatives = 1;

            // Reset transcript refs
            finalTranscriptRef.current = '';

            // Handle results
            recognition.onresult = (event: SpeechRecognitionEvent) => {
                let interimTranscript = '';
                let finalTranscript = finalTranscriptRef.current;

                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const result = event.results[i];
                    if (result.isFinal) {
                        finalTranscript += result[0].transcript + ' ';
                        finalTranscriptRef.current = finalTranscript;
                    } else {
                        interimTranscript += result[0].transcript;
                    }
                }

                setState(prev => ({
                    ...prev,
                    finalTranscript: finalTranscript.trim(),
                    interimTranscript,
                    transcript: (finalTranscript + interimTranscript).trim(),
                }));
            };

            // Handle errors
            recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
                console.error('Speech recognition error:', event.error, event.message);

                let errorMessage = 'An error occurred during speech recognition.';

                switch (event.error) {
                    case 'no-speech':
                        errorMessage = 'No speech was detected. Please try again.';
                        break;
                    case 'audio-capture':
                        errorMessage = 'No microphone was found. Please check your microphone.';
                        break;
                    case 'not-allowed':
                        errorMessage = 'Microphone permission was denied. Please allow access.';
                        setState(prev => ({ ...prev, hasPermission: false }));
                        break;
                    case 'network':
                        errorMessage = 'Network error occurred. Please check your connection.';
                        break;
                    case 'aborted':
                        // Recording was aborted - not an error
                        return;
                    default:
                        errorMessage = `Speech recognition error: ${event.error}`;
                }

                setState(prev => ({
                    ...prev,
                    state: 'error',
                    error: errorMessage,
                }));

                // Cleanup
                if (timerRef.current) clearInterval(timerRef.current);
                if (maxDurationTimeoutRef.current) clearTimeout(maxDurationTimeoutRef.current);
            };

            // Handle end
            recognition.onend = () => {
                // If still in recording state, it was an unexpected end
                setState(prev => {
                    if (prev.state === 'recording') {
                        // Speech recognition ended but we're still recording - restart it
                        // This handles the case where recognition auto-stops after silence
                        try {
                            recognition.start();
                            return prev;
                        } catch (e) {
                            // Can't restart, proceed to processing
                            return {
                                ...prev,
                                state: 'processing',
                            };
                        }
                    }
                    return prev;
                });
            };

            // Handle start
            recognition.onstart = () => {
                console.log('Speech recognition started');
                startTimeRef.current = Date.now();

                // Start duration timer
                timerRef.current = setInterval(() => {
                    setState(prev => ({
                        ...prev,
                        duration: Math.floor((Date.now() - startTimeRef.current) / 1000),
                    }));
                }, 1000);

                // Set max duration timeout
                maxDurationTimeoutRef.current = setTimeout(() => {
                    console.log('Max duration reached, stopping recording');
                    stopRecording();
                }, maxDuration * 1000);

                setState(prev => ({
                    ...prev,
                    state: 'recording',
                    duration: 0,
                    transcript: '',
                    finalTranscript: '',
                    interimTranscript: '',
                    error: null,
                }));
            };

            // Store reference and start
            recognitionRef.current = recognition;
            recognition.start();

        } catch (error) {
            console.error('Failed to start speech recognition:', error);
            setState(prev => ({
                ...prev,
                state: 'error',
                error: 'Failed to start speech recognition. Please try again.',
            }));
        }
    }, [lang, continuous, maxDuration, requestPermission]);

    // Stop recording
    const stopRecording = useCallback(() => {
        // Clear timers
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
        if (maxDurationTimeoutRef.current) {
            clearTimeout(maxDurationTimeoutRef.current);
            maxDurationTimeoutRef.current = null;
        }

        // Stop recognition
        if (recognitionRef.current) {
            try {
                recognitionRef.current.stop();
            } catch (e) {
                // Ignore errors when stopping
            }
            recognitionRef.current = null;
        }

        setState(prev => {
            const finalTranscript = (prev.finalTranscript + ' ' + prev.interimTranscript).trim();

            // Call onComplete callback
            if (onComplete && finalTranscript) {
                setTimeout(() => onComplete(finalTranscript), 0);
            }

            return {
                ...prev,
                state: 'idle',
                finalTranscript,
                transcript: finalTranscript,
                interimTranscript: '',
            };
        });
    }, [onComplete]);

    // Cancel recording
    const cancelRecording = useCallback(() => {
        // Clear timers
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
        if (maxDurationTimeoutRef.current) {
            clearTimeout(maxDurationTimeoutRef.current);
            maxDurationTimeoutRef.current = null;
        }

        // Abort recognition
        if (recognitionRef.current) {
            try {
                recognitionRef.current.abort();
            } catch (e) {
                // Ignore errors when aborting
            }
            recognitionRef.current = null;
        }

        // Reset state
        finalTranscriptRef.current = '';
        setState(prev => ({
            ...prev,
            ...INITIAL_STATE,
            isSupported: prev.isSupported,
            hasPermission: prev.hasPermission,
        }));
    }, []);

    // Reset state
    const reset = useCallback(() => {
        cancelRecording();
    }, [cancelRecording]);

    return {
        ...state,
        startRecording,
        stopRecording,
        cancelRecording,
        reset,
    };
}

export default useVoiceRecorder;
