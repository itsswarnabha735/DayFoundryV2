import React from 'react';
import { Clock, AlertTriangle } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '../ui/sheet';
import { Button } from '../ui/button';
import { Alert, AlertDescription } from '../ui/alert';

interface ResizeConfirmationSheetProps {
  blockId: string;
  blockTitle: string;
  newStartTime: string;
  newEndTime: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ResizeConfirmationSheet({
  blockTitle,
  newStartTime,
  newEndTime,
  onConfirm,
  onCancel
}: ResizeConfirmationSheetProps) {

  const formatTime = (time: string) => {
    const [hour, minute] = time.split(':').map(Number);
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return minute === 0 ? `${displayHour} ${period}` : `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
  };

  const calculateDuration = () => {
    const startMinutes = parseInt(newStartTime.split(':')[0]) * 60 + parseInt(newStartTime.split(':')[1]);
    const endMinutes = parseInt(newEndTime.split(':')[0]) * 60 + parseInt(newEndTime.split(':')[1]);
    const durationMinutes = endMinutes - startMinutes;

    const hours = Math.floor(durationMinutes / 60);
    const minutes = durationMinutes % 60;

    if (hours > 0 && minutes > 0) {
      return `${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h`;
    } else {
      return `${minutes}m`;
    }
  };

  const hasConflicts = () => {
    // This would typically check against other blocks, meetings, etc.
    // For now, just check if it's during lunch hours as an example
    const startHour = parseInt(newStartTime.split(':')[0]);
    const endHour = parseInt(newEndTime.split(':')[0]);
    const startMinute = parseInt(newStartTime.split(':')[1]);
    const endMinute = parseInt(newEndTime.split(':')[1]);

    // Check if overlaps with typical lunch time (12:00-13:00)
    const lunchStart = 12 * 60; // 12:00 in minutes
    const lunchEnd = 13 * 60;   // 13:00 in minutes
    const blockStart = startHour * 60 + startMinute;
    const blockEnd = endHour * 60 + endMinute;

    return (blockStart < lunchEnd && blockEnd > lunchStart);
  };

  const isValidDuration = () => {
    const startMinutes = parseInt(newStartTime.split(':')[0]) * 60 + parseInt(newStartTime.split(':')[1]);
    const endMinutes = parseInt(newEndTime.split(':')[0]) * 60 + parseInt(newEndTime.split(':')[1]);
    return endMinutes > startMinutes && (endMinutes - startMinutes) >= 15;
  };

  return (
    <Sheet open={true} onOpenChange={() => onCancel()}>
      <SheetContent side="bottom" className="pb-6">
        <SheetHeader className="text-left">
          <SheetTitle
            className="flex items-center space-x-2"
            style={{
              color: 'var(--df-text)',
              fontSize: 'var(--df-type-title-size)',
              fontWeight: 'var(--df-type-title-weight)'
            }}
          >
            <Clock size={20} />
            <span>Confirm Resize</span>
          </SheetTitle>
          <SheetDescription style={{ color: 'var(--df-text-muted)' }}>
            Confirm the new time range for this schedule block
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 px-4">
          {/* Block Info */}
          <div
            className="p-4 rounded"
            style={{
              backgroundColor: 'var(--df-surface-alt)',
              borderRadius: 'var(--df-radius-md)'
            }}
          >
            <h3
              className="font-medium mb-2"
              style={{
                color: 'var(--df-text)',
                fontSize: 'var(--df-type-body-size)',
                fontWeight: 'var(--df-type-body-weight)'
              }}
            >
              {blockTitle}
            </h3>

            <div className="flex items-center justify-between">
              <div>
                <span
                  className="text-sm"
                  style={{ color: 'var(--df-text-muted)' }}
                >
                  New time:
                </span>
                <div
                  className="font-medium"
                  style={{
                    color: 'var(--df-text)',
                    fontSize: 'var(--df-type-body-size)'
                  }}
                >
                  {formatTime(newStartTime)} - {formatTime(newEndTime)}
                </div>
              </div>

              <div
                className="px-3 py-1 rounded"
                style={{
                  backgroundColor: 'var(--df-primary)',
                  color: 'var(--df-primary-contrast)',
                  fontSize: 'var(--df-type-caption-size)',
                  borderRadius: 'var(--df-radius-sm)'
                }}
              >
                {calculateDuration()}
              </div>
            </div>
          </div>

          {/* Warnings */}
          {!isValidDuration() && (
            <Alert style={{ borderColor: 'var(--df-danger)', backgroundColor: 'rgba(220, 38, 38, 0.1)' }}>
              <AlertTriangle size={16} style={{ color: 'var(--df-danger)' }} />
              <AlertDescription style={{ color: 'var(--df-danger)' }}>
                Invalid duration. Blocks must be at least 15 minutes long.
              </AlertDescription>
            </Alert>
          )}

          {hasConflicts() && isValidDuration() && (
            <Alert style={{ borderColor: 'var(--df-warning)', backgroundColor: 'rgba(217, 119, 6, 0.1)' }}>
              <AlertTriangle size={16} style={{ color: 'var(--df-warning)' }} />
              <AlertDescription style={{ color: 'var(--df-warning)' }}>
                This timing may conflict with lunch break or other scheduled items.
              </AlertDescription>
            </Alert>
          )}

          {/* Actions */}
          <div className="flex space-x-3 pt-2">
            <Button
              variant="outline"
              onClick={onCancel}
              className="flex-1"
              style={{
                borderColor: 'var(--df-border)',
                color: 'var(--df-text)',
                minHeight: '48px'
              }}
            >
              Cancel
            </Button>

            <Button
              onClick={onConfirm}
              disabled={!isValidDuration()}
              className="flex-1"
              style={{
                backgroundColor: isValidDuration() ? 'var(--df-primary)' : 'var(--df-text-muted)',
                color: 'var(--df-primary-contrast)',
                minHeight: '48px'
              }}
            >
              {hasConflicts() ? 'Resize Anyway' : 'Confirm Resize'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}