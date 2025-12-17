import React from 'react';
import { Play, Square, Clock } from 'lucide-react';
import { Button } from '../ui/button';
import { useTimeTracking } from '../../hooks/useTimeTracking';

interface TimeTrackingButtonProps {
    taskId: string;
    taskTitle: string;
    size?: 'sm' | 'default';
    showDuration?: boolean;
    className?: string;
}

/**
 * Button component for starting/stopping time tracking on a task
 * Shows play button when not tracking, stop button when tracking
 */
export function TimeTrackingButton({
    taskId,
    taskTitle,
    size = 'sm',
    showDuration = true,
    className = ''
}: TimeTrackingButtonProps) {
    const {
        activeSession,
        isTracking,
        startTracking,
        stopTracking,
        loading
    } = useTimeTracking();

    const isThisTaskActive = activeSession?.taskId === taskId;
    const [elapsedTime, setElapsedTime] = React.useState(0);

    // Update elapsed time every second when tracking
    React.useEffect(() => {
        let interval: NodeJS.Timeout | null = null;

        if (isThisTaskActive && activeSession) {
            const updateElapsed = () => {
                const now = new Date();
                const elapsed = Math.floor((now.getTime() - activeSession.startedAt.getTime()) / 1000);
                setElapsedTime(elapsed);
            };

            updateElapsed(); // Update immediately
            interval = setInterval(updateElapsed, 1000);
        } else {
            setElapsedTime(0);
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [isThisTaskActive, activeSession]);

    const handleToggle = async () => {
        if (isThisTaskActive) {
            await stopTracking();
        } else {
            await startTracking(taskId);
        }
    };

    const formatTime = (seconds: number): string => {
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        if (hours > 0) {
            return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const buttonSize = size === 'sm' ? 'h-8 w-8' : 'h-10 w-10';
    const iconSize = size === 'sm' ? 14 : 18;

    return (
        <div className={`flex items-center gap-2 ${className}`}>
            <Button
                variant={isThisTaskActive ? 'default' : 'outline'}
                size="sm"
                onClick={handleToggle}
                disabled={loading || (isTracking && !isThisTaskActive)}
                className={`${buttonSize} p-0 rounded-full`}
                style={{
                    backgroundColor: isThisTaskActive ? 'var(--df-danger)' : 'transparent',
                    borderColor: isThisTaskActive ? 'var(--df-danger)' : 'var(--df-border)',
                    color: isThisTaskActive ? 'white' : 'var(--df-text)',
                    minHeight: size === 'sm' ? '32px' : '40px',
                    minWidth: size === 'sm' ? '32px' : '40px'
                }}
                title={isThisTaskActive ? 'Stop tracking' : (isTracking ? 'Stop other task first' : 'Start tracking')}
            >
                {isThisTaskActive ? (
                    <Square size={iconSize} fill="currentColor" />
                ) : (
                    <Play size={iconSize} />
                )}
            </Button>

            {showDuration && isThisTaskActive && (
                <div
                    className="flex items-center gap-1 text-sm font-mono"
                    style={{ color: 'var(--df-primary)' }}
                >
                    <Clock size={12} />
                    <span>{formatTime(elapsedTime)}</span>
                </div>
            )}
        </div>
    );
}
