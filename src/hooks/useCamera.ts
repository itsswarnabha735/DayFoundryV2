import { useState, useCallback, useRef, useEffect } from 'react';

export type CameraState = 'idle' | 'requesting-permission' | 'ready' | 'capturing' | 'preview' | 'error';

export interface CameraHookState {
    /** Current camera state */
    state: CameraState;
    /** Captured image as data URL */
    capturedImage: string | null;
    /** Error message if any */
    error: string | null;
    /** Whether camera is supported */
    isSupported: boolean;
    /** Whether camera permission is granted */
    hasPermission: boolean | null;
    /** Video stream for viewfinder */
    stream: MediaStream | null;
}

export interface CameraHookActions {
    /** Start camera and request permission */
    startCamera: () => Promise<void>;
    /** Stop camera stream */
    stopCamera: () => void;
    /** Capture photo from current stream */
    capturePhoto: () => void;
    /** Reset to initial state */
    reset: () => void;
    /** Confirm captured photo */
    confirmPhoto: () => string | null;
}

export type UseCameraReturn = CameraHookState & CameraHookActions;

const INITIAL_STATE: CameraHookState = {
    state: 'idle',
    capturedImage: null,
    error: null,
    isSupported: false,
    hasPermission: null,
    stream: null,
};

/**
 * Hook for camera access and photo capture
 */
export function useCamera(options?: {
    /** Preferred facing mode (default: 'environment' for back camera) */
    facingMode?: 'user' | 'environment';
    /** Image quality for JPEG (0-1, default: 0.9) */
    quality?: number;
}): UseCameraReturn {
    const {
        facingMode = 'environment',
        quality = 0.9,
    } = options || {};

    const [state, setState] = useState<CameraHookState>(() => ({
        ...INITIAL_STATE,
        isSupported: typeof navigator !== 'undefined' &&
            !!navigator.mediaDevices &&
            !!navigator.mediaDevices.getUserMedia,
    }));

    const videoRef = useRef<HTMLVideoElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);

    // Set video element ref (to be called by component)
    const setVideoRef = useCallback((video: HTMLVideoElement | null) => {
        videoRef.current = video;
        if (video && streamRef.current) {
            video.srcObject = streamRef.current;
        }
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    // Start camera
    const startCamera = useCallback(async () => {
        if (!state.isSupported) {
            setState(prev => ({
                ...prev,
                state: 'error',
                error: 'Camera is not supported in this browser.',
            }));
            return;
        }

        setState(prev => ({ ...prev, state: 'requesting-permission', error: null }));

        try {
            const constraints: MediaStreamConstraints = {
                video: {
                    facingMode,
                    width: { ideal: 1920 },
                    height: { ideal: 1080 },
                },
                audio: false,
            };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            streamRef.current = stream;

            // Set video source if ref is available
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }

            setState(prev => ({
                ...prev,
                state: 'ready',
                hasPermission: true,
                stream,
                error: null,
            }));

        } catch (error) {
            console.error('Camera access error:', error);

            let errorMessage = 'Failed to access camera.';

            if (error instanceof Error) {
                if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                    errorMessage = 'Camera permission was denied. Please allow camera access.';
                } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
                    errorMessage = 'No camera found on this device.';
                } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
                    errorMessage = 'Camera is already in use by another application.';
                } else if (error.name === 'OverconstrainedError') {
                    errorMessage = 'Camera does not meet the required constraints.';
                }
            }

            setState(prev => ({
                ...prev,
                state: 'error',
                hasPermission: false,
                error: errorMessage,
            }));
        }
    }, [facingMode, state.isSupported]);

    // Stop camera
    const stopCamera = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }

        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }

        setState(prev => ({
            ...prev,
            state: 'idle',
            stream: null,
        }));
    }, []);

    // Capture photo
    const capturePhoto = useCallback(() => {
        if (!videoRef.current || state.state !== 'ready') {
            return;
        }

        const video = videoRef.current;

        // Create canvas if not exists
        if (!canvasRef.current) {
            canvasRef.current = document.createElement('canvas');
        }

        const canvas = canvasRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
            setState(prev => ({
                ...prev,
                state: 'error',
                error: 'Failed to create canvas context.',
            }));
            return;
        }

        // Draw video frame to canvas
        ctx.drawImage(video, 0, 0);

        // Get image as data URL
        const imageDataUrl = canvas.toDataURL('image/jpeg', quality);

        setState(prev => ({
            ...prev,
            state: 'preview',
            capturedImage: imageDataUrl,
        }));
    }, [quality, state.state]);

    // Reset
    const reset = useCallback(() => {
        stopCamera();
        setState(prev => ({
            ...INITIAL_STATE,
            isSupported: prev.isSupported,
            hasPermission: prev.hasPermission,
        }));
    }, [stopCamera]);

    // Confirm photo
    const confirmPhoto = useCallback(() => {
        const image = state.capturedImage;
        stopCamera();
        setState(prev => ({
            ...INITIAL_STATE,
            isSupported: prev.isSupported,
            hasPermission: prev.hasPermission,
        }));
        return image;
    }, [state.capturedImage, stopCamera]);

    return {
        ...state,
        startCamera,
        stopCamera,
        capturePhoto,
        reset,
        confirmPhoto,
        // Expose setVideoRef for component to attach
        setVideoRef,
    } as UseCameraReturn & { setVideoRef: (video: HTMLVideoElement | null) => void };
}

export default useCamera;
