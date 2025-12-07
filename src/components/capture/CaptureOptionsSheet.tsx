import React from 'react';
import { Camera, Image, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '../ui/sheet';

interface CaptureOptionsSheetProps {
    /** Whether the sheet is open */
    isOpen: boolean;
    /** Callback to close the sheet */
    onClose: () => void;
    /** Callback when "Take Photo" is selected */
    onTakePhoto: () => void;
    /** Callback when "Choose from Gallery" is selected */
    onChooseFromGallery: () => void;
}

/**
 * Bottom sheet with camera capture options
 */
export function CaptureOptionsSheet({
    isOpen,
    onClose,
    onTakePhoto,
    onChooseFromGallery
}: CaptureOptionsSheetProps) {
    return (
        <Sheet open={isOpen} onOpenChange={onClose}>
            <SheetContent
                side="bottom"
                className="rounded-t-2xl"
                style={{
                    backgroundColor: 'var(--df-surface)',
                    borderTopColor: 'var(--df-border)',
                    maxHeight: '50vh',
                }}
            >
                <SheetTitle className="sr-only">Capture Options</SheetTitle>
                <SheetDescription className="sr-only">
                    Choose how to capture an image
                </SheetDescription>

                <div className="py-4">
                    {/* Handle */}
                    <div
                        className="w-12 h-1 rounded-full mx-auto mb-6"
                        style={{ backgroundColor: 'var(--df-border)' }}
                    />

                    {/* Title */}
                    <h3
                        className="text-center mb-6"
                        style={{
                            fontSize: 'var(--df-type-subtitle-size)',
                            fontWeight: 'var(--df-type-subtitle-weight)',
                            color: 'var(--df-text)',
                        }}
                    >
                        Add Photo
                    </h3>

                    {/* Options */}
                    <div className="space-y-2 px-4">
                        {/* Take Photo */}
                        <Button
                            variant="outline"
                            onClick={() => {
                                onClose();
                                onTakePhoto();
                            }}
                            className="w-full flex items-center justify-start space-x-4 py-4"
                            style={{
                                minHeight: '56px',
                                backgroundColor: 'var(--df-surface)',
                                borderColor: 'var(--df-border)',
                                color: 'var(--df-text)',
                            }}
                        >
                            <div
                                className="p-2 rounded-full"
                                style={{ backgroundColor: 'var(--df-primary)', color: 'white' }}
                            >
                                <Camera size={20} />
                            </div>
                            <span style={{ fontSize: 'var(--df-type-body-size)' }}>
                                Take Photo
                            </span>
                        </Button>

                        {/* Choose from Gallery */}
                        <Button
                            variant="outline"
                            onClick={() => {
                                onClose();
                                onChooseFromGallery();
                            }}
                            className="w-full flex items-center justify-start space-x-4 py-4"
                            style={{
                                minHeight: '56px',
                                backgroundColor: 'var(--df-surface)',
                                borderColor: 'var(--df-border)',
                                color: 'var(--df-text)',
                            }}
                        >
                            <div
                                className="p-2 rounded-full"
                                style={{ backgroundColor: 'var(--df-surface-alt)' }}
                            >
                                <Image size={20} style={{ color: 'var(--df-text)' }} />
                            </div>
                            <span style={{ fontSize: 'var(--df-type-body-size)' }}>
                                Choose from Gallery
                            </span>
                        </Button>
                    </div>

                    {/* Cancel Button */}
                    <div className="px-4 mt-4">
                        <Button
                            variant="ghost"
                            onClick={onClose}
                            className="w-full"
                            style={{
                                minHeight: '48px',
                                color: 'var(--df-text-muted)',
                            }}
                        >
                            Cancel
                        </Button>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}

export default CaptureOptionsSheet;
