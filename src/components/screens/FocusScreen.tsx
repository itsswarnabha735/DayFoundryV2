import React, { useState, useEffect, useCallback, useRef, useImperativeHandle, forwardRef } from 'react';
import { Play, Pause, Clock, SkipForward, Coffee, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '../ui/sheet';
import { Alert, AlertDescription } from '../ui/alert';
import { useNotifications } from '../../hooks/useNotifications';
import { useDataStore } from '../../hooks/useDataStore';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

interface FocusBlock {
  id: string;
  title: string;
  acceptanceCriteria: string;
  estimatedMinutes: number;
  type: 'deep' | 'shallow';
  energy: 'high' | 'medium' | 'low';
}

interface MicroBreak {
  id: string;
  scheduledTime: Date;
  isCompleted: boolean;
  duration: number; // in seconds
}

export interface FocusScreenRef {
  startFocusSession: () => void;
}

export const FocusScreen = forwardRef<FocusScreenRef>((props, ref) => {
  const { data, recordPlanActual } = useDataStore();
  const { 
    scheduleFocusReminder, 
    scheduleMicroBreak, 
    scheduleInterruptionRecovery,
    cancelFocusReminders,
    cancelMicroBreaks 
  } = useNotifications();

  // Timer State
  const [isActive, setIsActive] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [sessionId] = useState(() => `focus-${Date.now()}`);

  // Current Block State
  const [currentBlock, setCurrentBlock] = useState<FocusBlock>({
    id: 'current-1',
    title: 'Review presentation slides',
    acceptanceCriteria: 'All slides reviewed for accuracy, formatting consistency, and compelling narrative flow',
    estimatedMinutes: 45,
    type: 'deep',
    energy: 'high'
  });

  const [nextBlock, setNextBlock] = useState<FocusBlock>({
    id: 'next-1',
    title: 'Team Standup Meeting',
    acceptanceCriteria: 'Updates shared, blockers discussed, next steps aligned',
    estimatedMinutes: 30,
    type: 'shallow',
    energy: 'medium'
  });

  // Micro-break State
  const [microBreaks, setMicroBreaks] = useState<MicroBreak[]>([]);
  const [nextMicroBreak, setNextMicroBreak] = useState<Date | null>(null);
  const [isOnMicroBreak, setIsOnMicroBreak] = useState(false);
  const [microBreakTimeRemaining, setMicroBreakTimeRemaining] = useState(0);

  // UI State
  const [showDeferSheet, setShowDeferSheet] = useState(false);
  const [isDeferring, setIsDeferring] = useState(false);
  
  // Interruptions tracking
  const [interruptions, setInterruptions] = useState<Array<{ timestamp: Date; type: string }>>([]);

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    startFocusSession: () => {
      if (!isActive && timeRemaining > 0) {
        handleStart();
      }
    }
  }));

  // Initialize timer when currentBlock changes
  useEffect(() => {
    if (currentBlock && !isActive) {
      const duration = currentBlock.estimatedMinutes * 60;
      setTimeRemaining(duration);
      setTotalDuration(duration);
      generateMicroBreaks(duration);
    }
  }, [currentBlock.id, isActive]);

  // Main timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (isActive && timeRemaining > 0 && !isOnMicroBreak) {
      interval = setInterval(() => {
        setTimeRemaining((time) => {
          const newTime = time - 1;
          checkForMicroBreak(newTime);
          return newTime;
        });
      }, 1000);
    } else if (timeRemaining === 0 && isActive) {
      handleSessionComplete();
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isActive, timeRemaining, isOnMicroBreak]);

  // Micro-break timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (isOnMicroBreak && microBreakTimeRemaining > 0) {
      interval = setInterval(() => {
        setMicroBreakTimeRemaining((time) => {
          if (time <= 1) {
            handleMicroBreakComplete();
            return 0;
          }
          return time - 1;
        });
      }, 1000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isOnMicroBreak, microBreakTimeRemaining]);

  const generateMicroBreaks = (sessionDuration: number) => {
    const breaks: MicroBreak[] = [];
    const breakInterval = 20 * 60; // Every 20 minutes
    const numBreaks = Math.floor(sessionDuration / breakInterval);
    
    for (let i = 1; i <= numBreaks; i++) {
      const scheduledTime = new Date(Date.now() + (i * breakInterval * 1000));
      breaks.push({
        id: `break-${i}`,
        scheduledTime,
        isCompleted: false,
        duration: 30 // 30 seconds
      });
    }
    
    setMicroBreaks(breaks);
    if (breaks.length > 0) {
      setNextMicroBreak(breaks[0].scheduledTime);
    }
  };

  const checkForMicroBreak = (remainingTime: number) => {
    const elapsedTime = totalDuration - remainingTime;
    const nextBreak = microBreaks.find(b => !b.isCompleted);
    
    if (nextBreak) {
      const breakElapsedTime = totalDuration - (nextBreak.scheduledTime.getTime() - Date.now() + totalDuration * 1000) / 1000;
      
      if (Math.abs(elapsedTime - breakElapsedTime) < 2) { // Within 2 seconds
        triggerMicroBreak(nextBreak);
      }
    }
  };

  const triggerMicroBreak = (microBreak: MicroBreak) => {
    setIsOnMicroBreak(true);
    setMicroBreakTimeRemaining(microBreak.duration);
    setIsActive(false);
    
    // Schedule notification for micro-break
    scheduleMicroBreak(sessionId, parseInt(microBreak.id.split('-')[1]), new Date());
    
    // Haptic feedback
    if ('vibrate' in navigator) {
      navigator.vibrate([200, 100, 200]);
    }
  };

  const handleMicroBreakComplete = () => {
    setIsOnMicroBreak(false);
    setMicroBreakTimeRemaining(0);
    
    // Mark break as completed
    setMicroBreaks(prev => prev.map(b => 
      b.id === microBreaks.find(mb => !mb.isCompleted)?.id 
        ? { ...b, isCompleted: true }
        : b
    ));
    
    // Update next micro-break
    const nextBreak = microBreaks.find(b => !b.isCompleted);
    setNextMicroBreak(nextBreak ? nextBreak.scheduledTime : null);
    
    // Resume timer automatically
    setIsActive(true);
    
    // Haptic feedback
    if ('vibrate' in navigator) {
      navigator.vibrate(100);
    }
  };

  const handleStart = () => {
    setIsActive(true);
    
    // Haptic feedback
    if ('vibrate' in navigator) {
      navigator.vibrate(50);
    }
    
    // Schedule completion reminder
    const completionTime = new Date(Date.now() + timeRemaining * 1000);
    scheduleFocusReminder(sessionId, currentBlock.title, completionTime);
  };
  
  const handlePause = () => {
    setIsActive(false);
    
    // Track interruption
    setInterruptions(prev => [...prev, { 
      timestamp: new Date(), 
      type: 'manual_pause' 
    }]);
    
    // Schedule recovery reminder for 5 minutes
    const recoveryTime = new Date(Date.now() + 5 * 60 * 1000);
    scheduleInterruptionRecovery(sessionId, currentBlock.title, recoveryTime);
  };

  const handleSessionComplete = async () => {
    setIsActive(false);
    
    // Calculate actual minutes spent
    const actualMinutes = Math.round((totalDuration - timeRemaining) / 60);
    const plannedMinutes = currentBlock.estimatedMinutes;
    
    // Haptic feedback for completion
    if ('vibrate' in navigator) {
      navigator.vibrate([100, 50, 100, 50, 100]);
    }
    
    // Record plan vs actual for learning
    try {
      const blockers = [];
      
      // Determine blockers based on actual vs planned time
      if (actualMinutes > plannedMinutes * 1.5) {
        blockers.push('overrun');
      }
      if (interruptions.length > 0) {
        blockers.push('interruption');
      }
      
      await recordPlanActual(
        currentBlock.id, 
        plannedMinutes, 
        actualMinutes, 
        blockers,
        `Focus session completed. ${interruptions.length} interruptions.`
      );
      
      console.log('Plan vs actual recorded:', {
        task: currentBlock.title,
        planned: plannedMinutes,
        actual: actualMinutes,
        blockers
      });
    } catch (error) {
      console.error('Failed to record plan vs actual:', error);
    }
    
    // Clean up notifications
    cancelFocusReminders(sessionId);
    cancelMicroBreaks(sessionId);
    
    // Move to next block
    if (nextBlock) {
      setCurrentBlock(nextBlock);
      setNextBlock(null); // Would be loaded from schedule
    }
  };

  const handleExtend = (minutes: number) => {
    const additionalTime = minutes * 60;
    setTimeRemaining(prev => prev + additionalTime);
    setTotalDuration(prev => prev + additionalTime);
    
    // Regenerate micro-breaks for extended session
    generateMicroBreaks(timeRemaining + additionalTime);
  };

  const handleDefer = async () => {
    setIsDeferring(true);
    
    try {
      // Call backend to replan remainder with protect_focus strategy
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-72dfd380/schedule/replan-remainder`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`
        },
        body: JSON.stringify({
          currentBlockId: currentBlock.id,
          strategy: 'protect_focus',
          reason: 'User requested deferral during focus session'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to replan schedule');
      }

      const result = await response.json();
      console.log('Schedule replanned:', result);
      
      // Stop current session
      setIsActive(false);
      cancelFocusReminders(sessionId);
      cancelMicroBreaks(sessionId);
      
      setShowDeferSheet(false);
      
    } catch (error) {
      console.error('Error deferring task:', error);
    } finally {
      setIsDeferring(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getProgressPercentage = () => {
    if (totalDuration === 0) return 0;
    return ((totalDuration - timeRemaining) / totalDuration) * 100;
  };

  const getNextMicroBreakCountdown = () => {
    if (!nextMicroBreak) return null;
    const now = new Date();
    const timeToBreak = Math.max(0, Math.floor((nextMicroBreak.getTime() - now.getTime()) / 1000));
    const sessionElapsed = totalDuration - timeRemaining;
    const actualTimeToBreak = Math.max(0, (20 * 60) - (sessionElapsed % (20 * 60)));
    return actualTimeToBreak;
  };

  const completedMicroBreaks = microBreaks.filter(b => b.isCompleted).length;
  const totalMicroBreaks = microBreaks.length;

  return (
    <div 
      className="flex flex-col h-full"
      style={{ 
        backgroundColor: isActive ? 'var(--df-surface)' : 'var(--df-surface)',
        transition: 'background-color var(--df-anim-slow) ease-in-out'
      }}
    >
      {/* Full-screen focus interface */}
      <div 
        className="flex-1 flex flex-col px-6 overflow-y-auto"
        style={{ 
          paddingTop: 'calc(env(safe-area-inset-top, 0) + 24px)',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0) + 24px)',
          minHeight: '100%'
        }}
      >
        <div className="flex-1 flex flex-col justify-center min-h-0">
        {/* Current Block Title */}
        <div className="text-center mb-8">
          <h1 
            className="mb-4"
            style={{
              fontSize: 'var(--df-type-title-size)',
              fontWeight: 'var(--df-type-title-weight)',
              color: 'var(--df-text)',
              lineHeight: '1.3'
            }}
          >
            {currentBlock.title}
          </h1>
          
          <Badge 
            variant="outline"
            style={{
              borderColor: currentBlock.type === 'deep' ? 'var(--df-primary)' : 'var(--df-text-muted)',
              color: currentBlock.type === 'deep' ? 'var(--df-primary)' : 'var(--df-text-muted)',
              fontSize: 'var(--df-type-caption-size)'
            }}
          >
            {currentBlock.type === 'deep' ? 'Deep Work' : 'Shallow Work'}
          </Badge>
        </div>

        {/* Large Timer */}
        <div className="text-center mb-8">
          <div 
            className="mb-4 relative"
            style={{
              fontSize: '5rem',
              fontWeight: '200',
              color: isOnMicroBreak ? 'var(--df-warning)' : (isActive ? 'var(--df-primary)' : 'var(--df-text)'),
              lineHeight: '1',
              transition: 'color var(--df-anim-med) ease-in-out'
            }}
          >
            {isOnMicroBreak ? formatTime(microBreakTimeRemaining) : formatTime(timeRemaining)}
            
            {isOnMicroBreak && (
              <div 
                className="absolute -bottom-8 left-1/2 transform -translate-x-1/2"
                style={{
                  fontSize: 'var(--df-type-body-size)',
                  color: 'var(--df-warning)',
                  fontWeight: 'var(--df-type-body-weight)'
                }}
              >
                Micro-break
              </div>
            )}
          </div>
          
          {/* Progress Bar */}
          <div 
            className="w-full h-1 rounded-full mb-4 mx-auto"
            style={{ 
              backgroundColor: 'var(--df-border)',
              maxWidth: '200px'
            }}
          >
            <div 
              className="h-full rounded-full transition-all duration-1000 ease-out"
              style={{ 
                width: `${getProgressPercentage()}%`,
                backgroundColor: isActive ? 'var(--df-primary)' : 'var(--df-text-muted)'
              }}
            />
          </div>
        </div>

        {/* Acceptance Criteria */}
        <Card 
          className="mb-8 p-6"
          style={{
            backgroundColor: 'var(--df-surface-alt)',
            borderColor: 'var(--df-border)',
            borderRadius: 'var(--df-radius-md)'
          }}
        >
          <div className="flex items-start space-x-3">
            <CheckCircle 
              size={20} 
              style={{ 
                color: 'var(--df-success)',
                marginTop: '2px',
                flexShrink: 0
              }} 
            />
            <div>
              <h3 
                className="mb-2"
                style={{
                  fontSize: 'var(--df-type-body-size)',
                  fontWeight: 'var(--df-type-body-weight)',
                  color: 'var(--df-text)'
                }}
              >
                Success Criteria
              </h3>
              <p 
                style={{
                  fontSize: 'var(--df-type-body-size)',
                  color: 'var(--df-text-muted)',
                  lineHeight: '1.5'
                }}
              >
                {currentBlock.acceptanceCriteria}
              </p>
            </div>
          </div>
        </Card>

        {/* Main Controls */}
        <div className="flex items-center justify-center space-x-6 mb-8">
          {!isActive && !isOnMicroBreak ? (
            <Button
              onClick={handleStart}
              className="h-20 w-20 rounded-full"
              style={{
                backgroundColor: 'var(--df-primary)',
                color: 'var(--df-primary-contrast)',
                minHeight: '80px',
                minWidth: '80px',
                fontSize: 'var(--df-type-body-size)'
              }}
            >
              <Play size={32} />
            </Button>
          ) : (
            <Button
              onClick={handlePause}
              disabled={isOnMicroBreak}
              className="h-20 w-20 rounded-full"
              style={{
                backgroundColor: isOnMicroBreak ? 'var(--df-text-muted)' : 'var(--df-warning)',
                color: 'var(--df-primary-contrast)',
                minHeight: '80px',
                minWidth: '80px'
              }}
            >
              <Pause size={32} />
            </Button>
          )}
          
          <Button
            onClick={() => setShowDeferSheet(true)}
            variant="outline"
            disabled={isOnMicroBreak}
            className="h-12 px-6"
            style={{
              borderColor: 'var(--df-border)',
              color: 'var(--df-text)',
              minHeight: '48px'
            }}
          >
            <SkipForward size={16} className="mr-2" />
            Defer
          </Button>
        </div>

        {/* Extend Buttons */}
        <div className="flex justify-center space-x-4 mb-8">
          <ExtendButton minutes={5} onClick={() => handleExtend(5)} />
          <ExtendButton minutes={10} onClick={() => handleExtend(10)} />
          <ExtendButton minutes={15} onClick={() => handleExtend(15)} />
        </div>

        {/* Micro-break Ticker */}
        <Card 
          className="mb-8 p-4"
          style={{
            backgroundColor: 'var(--df-surface-alt)',
            borderColor: 'var(--df-border)',
            borderRadius: 'var(--df-radius-md)'
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Coffee 
                size={16} 
                style={{ color: 'var(--df-text-muted)' }} 
              />
              <span 
                style={{
                  fontSize: 'var(--df-type-caption-size)',
                  color: 'var(--df-text-muted)'
                }}
              >
                Micro-breaks: {completedMicroBreaks}/{totalMicroBreaks}
              </span>
            </div>
            {getNextMicroBreakCountdown() !== null && getNextMicroBreakCountdown()! > 0 && (
              <span 
                style={{
                  fontSize: 'var(--df-type-caption-size)',
                  color: 'var(--df-text-muted)'
                }}
              >
                Next in {formatTime(getNextMicroBreakCountdown()!)}
              </span>
            )}
          </div>
        </Card>

        {/* Next Up */}
        {nextBlock && (
          <Card 
            className="p-4"
            style={{
              backgroundColor: 'var(--df-surface-alt)',
              borderColor: 'var(--df-border)',
              borderRadius: 'var(--df-radius-md)'
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 
                  style={{
                    fontSize: 'var(--df-type-caption-size)',
                    fontWeight: 'var(--df-type-caption-weight)',
                    color: 'var(--df-text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    marginBottom: 'var(--df-space-4)'
                  }}
                >
                  Next Up
                </h3>
                <p 
                  style={{
                    fontSize: 'var(--df-type-body-size)',
                    color: 'var(--df-text)',
                    fontWeight: 'var(--df-type-body-weight)'
                  }}
                >
                  {nextBlock.title}
                </p>
              </div>
              <div className="text-right">
                <span 
                  style={{
                    fontSize: 'var(--df-type-caption-size)',
                    color: 'var(--df-text-muted)'
                  }}
                >
                  {nextBlock.estimatedMinutes} min
                </span>
              </div>
            </div>
          </Card>
        )}
        </div>
      </div>

      {/* Defer Confirmation Sheet */}
      <Sheet open={showDeferSheet} onOpenChange={setShowDeferSheet}>
        <SheetContent side="bottom" className="h-auto max-h-[60vh]">
          <SheetHeader>
            <SheetTitle style={{ color: 'var(--df-text)' }}>
              Defer Current Block
            </SheetTitle>
            <SheetDescription style={{ color: 'var(--df-text-muted)' }}>
              This will reschedule the current task to protect your focus time
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4 py-4">
            <Alert style={{ borderColor: 'var(--df-warning)', backgroundColor: 'rgba(217, 119, 6, 0.1)' }}>
              <AlertCircle size={16} style={{ color: 'var(--df-warning)' }} />
              <AlertDescription style={{ color: 'var(--df-warning)' }}>
                Deferring will stop your current focus session and replan your remaining schedule.
              </AlertDescription>
            </Alert>

            <div 
              className="p-4 rounded"
              style={{ 
                backgroundColor: 'var(--df-surface)',
                borderRadius: 'var(--df-radius-sm)'
              }}
            >
              <h4 
                className="font-medium mb-2"
                style={{ color: 'var(--df-text)' }}
              >
                Current Block: {currentBlock.title}
              </h4>
              <p 
                style={{ 
                  color: 'var(--df-text-muted)',
                  fontSize: 'var(--df-type-body-size)'
                }}
              >
                Time remaining: {formatTime(timeRemaining)}
              </p>
            </div>

            <div className="flex space-x-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setShowDeferSheet(false)}
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
                onClick={handleDefer}
                disabled={isDeferring}
                className="flex-1"
                style={{
                  backgroundColor: 'var(--df-warning)',
                  color: 'var(--df-primary-contrast)',
                  minHeight: '48px'
                }}
              >
                {isDeferring ? 'Replanning...' : 'Defer Block'}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
});

interface ExtendButtonProps {
  minutes: number;
  onClick: () => void;
}

function ExtendButton({ minutes, onClick }: ExtendButtonProps) {
  return (
    <Button
      onClick={onClick}
      variant="outline"
      size="sm"
      style={{
        borderColor: 'var(--df-border)',
        color: 'var(--df-text-muted)',
        fontSize: 'var(--df-type-caption-size)',
        minHeight: '36px',
        padding: '0 12px'
      }}
    >
      +{minutes} min
    </Button>
  );
}