import React from 'react';
import { Bell, Clock, Coffee, ArrowRight } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { useNotifications } from '../../hooks/useNotifications';

export function NotificationDemo() {
  const { 
    scheduleFocusReminder, 
    scheduleMicroBreak, 
    scheduleInterruptionRecovery,
    scheduleDailyPlanningReminder,
    permissionState,
    requestPermission 
  } = useNotifications();

  const handleTestFocusReminder = () => {
    const startTime = new Date(Date.now() + 10 * 1000); // 10 seconds from now
    scheduleFocusReminder('demo-focus', 'Demo Deep Work Session', startTime, 0); // Immediate reminder
  };

  const handleTestMicroBreak = () => {
    const breakTime = new Date(Date.now() + 5 * 1000); // 5 seconds from now
    scheduleMicroBreak('demo-focus', 1, breakTime);
  };

  const handleTestRecovery = () => {
    const recoveryTime = new Date(Date.now() + 8 * 1000); // 8 seconds from now
    scheduleInterruptionRecovery('demo-focus', 'Demo Task', recoveryTime);
  };

  const handleTestDailyPlanning = () => {
    const planningTime = new Date(Date.now() + 12 * 1000); // 12 seconds from now
    scheduleDailyPlanningReminder(planningTime);
  };

  if (permissionState.permission !== 'granted') {
    return (
      <Card 
        className="p-6 text-center"
        style={{ 
          backgroundColor: 'var(--df-surface)',
          borderColor: 'var(--df-border)',
          borderRadius: 'var(--df-radius-md)'
        }}
      >
        <Bell size={32} className="mx-auto mb-4" style={{ color: 'var(--df-text-muted)' }} />
        <h3 
          className="mb-2"
          style={{ 
            fontSize: 'var(--df-type-subtitle-size)',
            fontWeight: 'var(--df-type-subtitle-weight)',
            color: 'var(--df-text)'
          }}
        >
          Enable Notifications
        </h3>
        <p 
          className="mb-6"
          style={{ 
            fontSize: 'var(--df-type-body-size)',
            color: 'var(--df-text-muted)'
          }}
        >
          Allow notifications to receive focus reminders, micro-break pings, and recovery nudges.
        </p>
        <Button 
          onClick={requestPermission}
          style={{ 
            backgroundColor: 'var(--df-primary)',
            color: 'var(--df-primary-contrast)',
            minHeight: '44px'
          }}
        >
          Enable Notifications
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card 
        className="p-4"
        style={{ 
          backgroundColor: 'var(--df-surface)',
          borderColor: 'var(--df-border)',
          borderRadius: 'var(--df-radius-md)'
        }}
      >
        <h3 
          className="mb-4"
          style={{ 
            fontSize: 'var(--df-type-subtitle-size)',
            fontWeight: 'var(--df-type-subtitle-weight)',
            color: 'var(--df-text)'
          }}
        >
          Test Notifications
        </h3>
        
        <div className="grid grid-cols-1 gap-3">
          <NotificationTestButton
            icon={Bell}
            title="Focus Reminder"
            description="Notification in 10 seconds"
            onClick={handleTestFocusReminder}
          />
          
          <NotificationTestButton
            icon={Coffee}
            title="Micro-break"
            description="Break reminder in 5 seconds"
            onClick={handleTestMicroBreak}
          />
          
          <NotificationTestButton
            icon={ArrowRight}
            title="Recovery Nudge"
            description="Resume work reminder in 8 seconds"
            onClick={handleTestRecovery}
          />
          
          <NotificationTestButton
            icon={Clock}
            title="Daily Planning"
            description="Plan your day reminder in 12 seconds"
            onClick={handleTestDailyPlanning}
          />
        </div>
      </Card>
    </div>
  );
}

interface NotificationTestButtonProps {
  icon: React.ComponentType<{ size?: number }>;
  title: string;
  description: string;
  onClick: () => void;
}

function NotificationTestButton({ icon: Icon, title, description, onClick }: NotificationTestButtonProps) {
  return (
    <Button
      variant="outline"
      onClick={onClick}
      className="h-auto p-3 justify-start"
      style={{ 
        minHeight: '64px',
        borderColor: 'var(--df-border)'
      }}
    >
      <div className="flex items-center gap-3 w-full">
        <div 
          className="p-2 rounded"
          style={{ backgroundColor: 'var(--df-surface-alt)' }}
        >
          <Icon size={16} style={{ color: 'var(--df-primary)' }} />
        </div>
        <div className="flex-1 text-left">
          <div 
            style={{ 
              fontSize: 'var(--df-type-body-size)',
              fontWeight: 'var(--df-type-body-weight)',
              color: 'var(--df-text)'
            }}
          >
            {title}
          </div>
          <div 
            style={{ 
              fontSize: 'var(--df-type-caption-size)',
              color: 'var(--df-text-muted)',
              marginTop: '2px'
            }}
          >
            {description}
          </div>
        </div>
      </div>
    </Button>
  );
}