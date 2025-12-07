import React, { useState } from 'react';
import { Clock, Plus, X, ChevronLeft } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { OnboardingData } from './OnboardingFlow';

interface WorkHoursStepProps {
  onNext: (data: Partial<OnboardingData>) => void;
  onBack?: () => void;
  data: Partial<OnboardingData>;
  isDark: boolean;
}

export function WorkHoursStep({ onNext, onBack, data }: WorkHoursStepProps) {
  const [workStart, setWorkStart] = useState(data.workStart || '9:00');
  const [workEnd, setWorkEnd] = useState(data.workEnd || '17:00');
  const [noMeetingWindows, setNoMeetingWindows] = useState<{ start: string; end: string; label: string }[]>(
    data.noMeetingWindows || []
  );

  const timeOptions = [
    '6:00', '6:30', '7:00', '7:30', '8:00', '8:30', '9:00', '9:30', '10:00', '10:30',
    '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
    '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00'
  ];

  const addNoMeetingWindow = () => {
    setNoMeetingWindows([
      ...noMeetingWindows,
      { start: '9:00', end: '11:00', label: 'Deep work' }
    ]);
  };

  const removeNoMeetingWindow = (index: number) => {
    setNoMeetingWindows(noMeetingWindows.filter((_, i) => i !== index));
  };

  const updateNoMeetingWindow = (index: number, field: 'start' | 'end' | 'label', value: string) => {
    const updated = [...noMeetingWindows];
    updated[index][field] = value;
    setNoMeetingWindows(updated);
  };

  const handleContinue = () => {
    onNext({
      workStart,
      workEnd,
      noMeetingWindows
    });
  };

  return (
    <div 
      className="flex flex-col h-full"
      style={{
        backgroundColor: 'var(--df-surface)',
        padding: 'var(--df-space-16)',
        paddingTop: 'max(var(--df-space-24), env(safe-area-inset-top, 0))',
        paddingBottom: 'max(var(--df-space-24), env(safe-area-inset-bottom, 0))'
      }}
    >
      {/* Header Navigation */}
      <div 
        className="flex items-center justify-between"
        style={{
          marginBottom: 'var(--df-space-32)',
          minHeight: '44px'
        }}
      >
        {onBack ? (
          <Button
            onClick={onBack}
            variant="ghost"
            size="sm"
            style={{ 
              color: 'var(--df-text-muted)',
              minHeight: '44px',
              minWidth: '44px',
              padding: 'var(--df-space-8)'
            }}
          >
            <ChevronLeft size={20} />
          </Button>
        ) : (
          <div style={{ width: '44px' }} />
        )}
        
        {/* Progress or step indicator could go here */}
        <div style={{ width: '44px' }} />
      </div>

      {/* Header Content */}
      <div 
        className="text-center"
        style={{ marginBottom: 'var(--df-space-40)' }}
      >
        <div 
          style={{
            width: '48px',
            height: '48px',
            borderRadius: 'var(--df-radius-pill)',
            backgroundColor: 'var(--df-primary)',
            color: 'var(--df-primary-contrast)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto var(--df-space-16)'
          }}
        >
          <Clock size={24} />
        </div>
        
        <h1 
          style={{
            fontSize: 'var(--df-type-title-size)',
            fontWeight: 'var(--df-type-title-weight)',
            color: 'var(--df-text)',
            marginBottom: 'var(--df-space-8)',
            lineHeight: 1.3
          }}
        >
          Set your work hours
        </h1>
        
        <p 
          style={{
            fontSize: 'var(--df-type-body-size)',
            fontWeight: 'var(--df-type-body-weight)',
            color: 'var(--df-text-muted)',
            lineHeight: 1.5,
            margin: '0 auto',
            maxWidth: '280px'
          }}
        >
          Help us schedule your day effectively
        </p>
      </div>

      {/* Scrollable Content */}
      <div 
        className="flex-1 overflow-y-auto"
        style={{
          maxWidth: '400px',
          margin: '0 auto',
          width: '100%',
          paddingBottom: 'var(--df-space-16)'
        }}
      >
        {/* Work Hours Card */}
        <Card 
          style={{
            padding: 'var(--df-space-24)',
            backgroundColor: 'var(--df-surface)',
            borderColor: 'var(--df-border)',
            borderRadius: 'var(--df-radius-md)',
            boxShadow: 'var(--df-shadow-sm)',
            marginBottom: 'var(--df-space-24)'
          }}
        >
          <h3 
            style={{
              fontSize: 'var(--df-type-subtitle-size)',
              fontWeight: 'var(--df-type-subtitle-weight)',
              color: 'var(--df-text)',
              marginBottom: 'var(--df-space-16)',
              lineHeight: 1.4
            }}
          >
            Daily work hours
          </h3>
          
          <div className="flex" style={{ gap: 'var(--df-space-16)' }}>
            <div className="flex-1">
              <label 
                style={{
                  display: 'block',
                  fontSize: 'var(--df-type-body-size)',
                  fontWeight: 'var(--df-type-body-weight)',
                  color: 'var(--df-text)',
                  marginBottom: 'var(--df-space-8)',
                  lineHeight: 1.4
                }}
              >
                Start
              </label>
              <Select value={workStart} onValueChange={setWorkStart}>
                <SelectTrigger 
                  style={{
                    minHeight: '48px',
                    borderColor: 'var(--df-border)',
                    backgroundColor: 'var(--df-surface)',
                    color: 'var(--df-text)',
                    borderRadius: 'var(--df-radius-sm)',
                    fontSize: 'var(--df-type-body-size)',
                    fontWeight: 'var(--df-type-body-weight)'
                  }}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {timeOptions.map(time => (
                    <SelectItem key={time} value={time}>{time}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex-1">
              <label 
                style={{
                  display: 'block',
                  fontSize: 'var(--df-type-body-size)',
                  fontWeight: 'var(--df-type-body-weight)',
                  color: 'var(--df-text)',
                  marginBottom: 'var(--df-space-8)',
                  lineHeight: 1.4
                }}
              >
                End
              </label>
              <Select value={workEnd} onValueChange={setWorkEnd}>
                <SelectTrigger 
                  style={{
                    minHeight: '48px',
                    borderColor: 'var(--df-border)',
                    backgroundColor: 'var(--df-surface)',
                    color: 'var(--df-text)',
                    borderRadius: 'var(--df-radius-sm)',
                    fontSize: 'var(--df-type-body-size)',
                    fontWeight: 'var(--df-type-body-weight)'
                  }}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {timeOptions.map(time => (
                    <SelectItem key={time} value={time}>{time}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        {/* Protected Focus Time Section */}
        <div style={{ marginBottom: 'var(--df-space-24)' }}>
          <div 
            className="flex items-center justify-between"
            style={{ marginBottom: 'var(--df-space-16)' }}
          >
            <h3 
              style={{
                fontSize: 'var(--df-type-subtitle-size)',
                fontWeight: 'var(--df-type-subtitle-weight)',
                color: 'var(--df-text)',
                lineHeight: 1.4,
                margin: 0
              }}
            >
              Protected focus time
            </h3>
            
            <Button
              onClick={addNoMeetingWindow}
              variant="ghost"
              size="sm"
              style={{
                color: 'var(--df-primary)',
                minHeight: '44px',
                fontSize: 'var(--df-type-body-size)',
                fontWeight: 'var(--df-type-body-weight)',
                padding: 'var(--df-space-8) var(--df-space-12)',
                gap: 'var(--df-space-8)'
              }}
            >
              <Plus size={16} />
              Add window
            </Button>
          </div>
          
          <p 
            style={{
              fontSize: 'var(--df-type-body-size)',
              fontWeight: 'var(--df-type-body-weight)',
              color: 'var(--df-text-muted)',
              lineHeight: 1.5,
              marginBottom: 'var(--df-space-16)',
              margin: 0
            }}
          >
            Block out time for deep work when you don't want meetings scheduled
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--df-space-12)' }}>
            {noMeetingWindows.map((window, index) => (
              <NoMeetingWindowCard
                key={index}
                window={window}
                timeOptions={timeOptions}
                onUpdate={(field, value) => updateNoMeetingWindow(index, field, value)}
                onRemove={() => removeNoMeetingWindow(index)}
              />
            ))}
            
            {noMeetingWindows.length === 0 && (
              <div 
                className="text-center"
                style={{ 
                  padding: 'var(--df-space-32) var(--df-space-16)',
                  color: 'var(--df-text-muted)'
                }}
              >
                <p style={{ 
                  fontSize: 'var(--df-type-body-size)',
                  fontWeight: 'var(--df-type-body-weight)',
                  lineHeight: 1.5,
                  margin: 0
                }}>
                  No protected time windows yet. Add one to block meeting scheduling.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Fixed Bottom Action */}
      <div 
        style={{
          paddingTop: 'var(--df-space-24)',
          maxWidth: '400px',
          margin: '0 auto',
          width: '100%'
        }}
      >
        <Button
          onClick={handleContinue}
          style={{
            width: '100%',
            backgroundColor: 'var(--df-primary)',
            color: 'var(--df-primary-contrast)',
            borderRadius: 'var(--df-radius-sm)',
            minHeight: '48px',
            fontSize: 'var(--df-type-body-size)',
            fontWeight: 'var(--df-type-body-weight)',
            border: 'none'
          }}
        >
          Continue
        </Button>
      </div>
    </div>
  );
}

interface NoMeetingWindowCardProps {
  window: { start: string; end: string; label: string };
  timeOptions: string[];
  onUpdate: (field: 'start' | 'end' | 'label', value: string) => void;
  onRemove: () => void;
}

function NoMeetingWindowCard({ window, timeOptions, onUpdate, onRemove }: NoMeetingWindowCardProps) {
  return (
    <Card 
      className="p-4"
      style={{
        backgroundColor: 'var(--df-surface)',
        borderColor: 'var(--df-border)',
        borderRadius: 'var(--df-radius-md)',
        boxShadow: 'var(--df-shadow-sm)'
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <input
          type="text"
          value={window.label}
          onChange={(e) => onUpdate('label', e.target.value)}
          className="font-medium bg-transparent border-none outline-none flex-1"
          style={{
            fontSize: 'var(--df-type-body-size)',
            color: 'var(--df-text)'
          }}
          placeholder="Label this time block"
        />
        
        <Button
          onClick={onRemove}
          variant="ghost"
          size="sm"
          style={{
            color: 'var(--df-text-muted)',
            minHeight: '32px',
            minWidth: '32px'
          }}
        >
          <X size={16} />
        </Button>
      </div>
      
      <div className="flex items-center space-x-3">
        <Select value={window.start} onValueChange={(value) => onUpdate('start', value)}>
          <SelectTrigger 
            className="flex-1"
            style={{
              minHeight: '40px',
              borderColor: 'var(--df-border)',
              backgroundColor: 'var(--df-surface)',
              fontSize: 'var(--df-type-caption-size)'
            }}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {timeOptions.map(time => (
              <SelectItem key={time} value={time}>{time}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <span 
          style={{
            fontSize: 'var(--df-type-caption-size)',
            color: 'var(--df-text-muted)'
          }}
        >
          to
        </span>
        
        <Select value={window.end} onValueChange={(value) => onUpdate('end', value)}>
          <SelectTrigger 
            className="flex-1"
            style={{
              minHeight: '40px',
              borderColor: 'var(--df-border)',
              backgroundColor: 'var(--df-surface)',
              fontSize: 'var(--df-type-caption-size)'
            }}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {timeOptions.map(time => (
              <SelectItem key={time} value={time}>{time}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </Card>
  );
}