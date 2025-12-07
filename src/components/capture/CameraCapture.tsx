import React, { useRef, useEffect, useState } from 'react';
import { Camera, X, RotateCcw, Check, ImageIcon, AlertTriangle, SwitchCamera } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { useCamera } from '../../hooks/useCamera';

interface CameraCaptureProps {
    /** Callback when image is captured and confirmed */
    onCapture: (imageDataUrl: string) => void;
    /** Callback to close the camera */
    onClose: () => void;
}

/**
 * Camera capture component with viewfinder and photo capture
 */
export function CameraCapture({ onCapture, onClose }: CameraCaptureProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');

    const {
        state,
        capturedImage,
        error,
        isSupported,
        stream,
        startCamera,
        stopCamera,
        capturePhoto,
        reset,
        confirmPhoto,
    } = useCamera({ facingMode });

    // Start camera on mount
    useEffect(() => {
        startCamera();
        return () => stopCamera();
    }, [facingMode]);

    // Connect video element to stream
    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
        }
    }, [stream]);

    // Handle capture confirmation
    const handleConfirm = () => {
        const image = confirmPhoto();
        if (image) {
            onCapture(image);
            onClose();
        }
    };

    // Handle retake
    const handleRetake = () => {
        reset();
        setTimeout(() => startCamera(), 100);
    };

    // Toggle camera facing mode
    const toggleCamera = () => {
        stopCamera();
        setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
    };

    // Handle cancel
    const handleCancel = () => {
        stopCamera();
        onClose();
    };

    // Camera not supported
    if (!isSupported) {
        return (
            <Card
                className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6"
                style={{ backgroundColor: 'var(--df-surface)' }}
            >
                <div
                    className="p-4 rounded-full mb-4"
                    style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}
                >
                    <AlertTriangle size={48} style={{ color: 'var(--df-danger)' }} />
                </div>
                <h3
                    className="mb-2 text-center"
                    style={{
                        fontSize: 'var(--df-type-subtitle-size)',
                        fontWeight: 'var(--df-type-subtitle-weight)',
                        color: 'var(--df-text)'
                    }}
                >
                    Camera Not Supported
                </h3>
                <p
                    className="text-center mb-6"
                    style={{
                        fontSize: 'var(--df-type-body-size)',
                        color: 'var(--df-text-muted)'
                    }}
                >
                    Your browser doesn't support camera access. Please use a modern browser like Chrome or Safari.
                </p>
                <Button onClick={onClose}>
                    Close
                </Button>
            </Card>
        );
    }

    // Preview mode - show captured image
    if (state === 'preview' && capturedImage) {
        return (
            <div
                className="fixed inset-0 z-50 flex flex-col"
                style={{ backgroundColor: '#000' }}
            >
                {/* Image Preview */}
                <div className="flex-1 relative flex items-center justify-center">
                    <img
                        src={capturedImage}
                        alt="Captured"
                        className="max-w-full max-h-full object-contain"
                    />
                </div>

                {/* Preview Controls */}
                <div
                    className="flex items-center justify-center space-x-8 py-8"
                    style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}
                >
                    {/* Retake Button */}
                    <Button
                        variant="outline"
                        onClick={handleRetake}
                        className="rounded-full"
                        style={{
                            minHeight: '60px',
                            minWidth: '60px',
                            backgroundColor: 'transparent',
                            borderColor: 'white',
                            color: 'white',
                        }}
                    >
                        <RotateCcw size={28} />
                    </Button>

                    {/* Confirm Button */}
                    <Button
                        onClick={handleConfirm}
                        className="rounded-full"
                        style={{
                            minHeight: '72px',
                            minWidth: '72px',
                            backgroundColor: 'var(--df-success)',
                            color: 'white',
                        }}
                    >
                        <Check size={32} />
                    </Button>

                    {/* Cancel Button */}
                    <Button
                        variant="outline"
                        onClick={handleCancel}
                        className="rounded-full"
                        style={{
                            minHeight: '60px',
                            minWidth: '60px',
                            backgroundColor: 'transparent',
                            borderColor: 'white',
                            color: 'white',
                        }}
                    >
                        <X size={28} />
                    </Button>
                </div>
            </div>
        );
    }

    // Error state
    if (state === 'error') {
        return (
            <Card
                className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6"
                style={{ backgroundColor: 'var(--df-surface)' }}
            >
                <div
                    className="p-4 rounded-full mb-4"
                    style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}
                >
                    <AlertTriangle size={48} style={{ color: 'var(--df-danger)' }} />
                </div>
                <h3
                    className="mb-2 text-center"
                    style={{
                        fontSize: 'var(--df-type-subtitle-size)',
                        fontWeight: 'var(--df-type-subtitle-weight)',
                        color: 'var(--df-text)'
                    }}
                >
                    Camera Error
                </h3>
                <p
                    className="text-center mb-6"
                    style={{
                        fontSize: 'var(--df-type-body-size)',
                        color: 'var(--df-text-muted)'
                    }}
                >
                    {error}
                </p>
                <div className="flex space-x-3">
                    <Button variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button onClick={() => startCamera()}>
                        Try Again
                    </Button>
                </div>
            </Card>
        );
    }

    // Camera viewfinder
    return (
        <div
            className="fixed inset-0 z-50 flex flex-col"
            style={{ backgroundColor: '#000' }}
        >
            {/* Header */}
            <div
                className="flex items-center justify-between px-4 py-3"
                style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
            >
                <Button
                    variant="ghost"
                    onClick={handleCancel}
                    style={{ color: 'white', minHeight: '44px', minWidth: '44px' }}
                >
                    <X size={24} />
                </Button>

                <span
                    style={{
                        color: 'white',
                        fontSize: 'var(--df-type-subtitle-size)',
                        fontWeight: 'var(--df-type-subtitle-weight)'
                    }}
                >
                    {state === 'requesting-permission' ? 'Requesting Permission...' : 'Take Photo'}
                </span>

                <Button
                    variant="ghost"
                    onClick={toggleCamera}
                    style={{ color: 'white', minHeight: '44px', minWidth: '44px' }}
                >
                    <SwitchCamera size={24} />
                </Button>
            </div>

            {/* Viewfinder */}
            <div className="flex-1 relative flex items-center justify-center overflow-hidden">
                {state === 'requesting-permission' ? (
                    <div className="flex flex-col items-center">
                        <Camera size={48} style={{ color: 'white', opacity: 0.5 }} />
                        <p style={{ color: 'white', opacity: 0.7, marginTop: '16px' }}>
                            Waiting for camera access...
                        </p>
                    </div>
                ) : (
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                        style={{
                            transform: facingMode === 'user' ? 'scaleX(-1)' : 'none'
                        }}
                    />
                )}

                {/* Viewfinder Grid Overlay */}
                <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                        backgroundImage: `
              linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
            `,
                        backgroundSize: '33.33% 33.33%',
                    }}
                />
            </div>

            {/* Controls */}
            <div
                className="flex items-center justify-center py-8"
                style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}
            >
                {/* Gallery Button (placeholder) */}
                <Button
                    variant="ghost"
                    disabled
                    className="rounded-full"
                    style={{
                        minHeight: '48px',
                        minWidth: '48px',
                        color: 'rgba(255,255,255,0.5)',
                    }}
                >
                    <ImageIcon size={24} />
                </Button>

                {/* Capture Button */}
                <Button
                    onClick={capturePhoto}
                    disabled={state !== 'ready'}
                    className="mx-8 rounded-full"
                    style={{
                        minHeight: '80px',
                        minWidth: '80px',
                        backgroundColor: 'white',
                        border: '4px solid rgba(255,255,255,0.3)',
                    }}
                >
                    <div
                        className="w-16 h-16 rounded-full"
                        style={{ backgroundColor: 'white' }}
                    />
                </Button>

                {/* Cancel Button */}
                <Button
                    variant="ghost"
                    onClick={handleCancel}
                    className="rounded-full"
                    style={{
                        minHeight: '48px',
                        minWidth: '48px',
                        color: 'white',
                    }}
                >
                    <X size={24} />
                </Button>
            </div>
        </div>
    );
}

export default CameraCapture;
