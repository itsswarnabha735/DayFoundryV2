import React, { useState } from 'react';
import { Coffee, ChevronLeft } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Slider } from '../ui/slider';
import { OnboardingData } from './OnboardingFlow';

interface BreakPreferencesStepProps {
  onNext: (data: Partial<OnboardingData>) => void;
  onBack?: () => void;
  data: Partial<OnboardingData>;
  isDark: boolean;
}

export function BreakPreferencesStep({ onNext, onBack, data }: BreakPreferencesStepProps) {
  const [breakDuration, setBreakDuration] = useState(data.breakDuration || 15);
  const [breakFrequency, setBreakFrequency] = useState(data.breakFrequency || 90);
  const [interruptionBudget, setInterruptionBudget] = useState(data.interruptionBudget || 3);

  const handleContinue = () => {
    onNext({
      breakDuration,
      breakFrequency,
      interruptionBudget
    });
  };

  return (
    <div className="flex flex-col h-full px-6 py-8">
      {/* Header */}
      <div className="flex items-center mb-8">
        {onBack && (
          <Button
            onClick={onBack}
            variant="ghost"
            size="sm"
            className="mr-4"
            style={{ 
              color: 'var(--df-text-muted)',
              minHeight: '44px',
              minWidth: '44px'
            }}
          >
            <ChevronLeft size={20} />
          </Button>
        )}
        
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <div 
            className="w-12 h-12 mb-4 rounded-full flex items-center justify-center"
            style={{
              backgroundColor: 'var(--df-primary)',
              color: 'var(--df-primary-contrast)'
            }}
          >
            <Coffee size={24} />
          </div>
          
          <h1 
            className="mb-2"
            style={{
              fontSize: 'var(--df-type-title-size)',
              fontWeight: 'var(--df-type-title-weight)',
              color: 'var(--df-text)'
            }}
          >
            Break preferences
          </h1>
          
          <p 
            style={{
              fontSize: 'var(--df-type-body-size)',
              color: 'var(--df-text-muted)'
            }}
          >
            Configure breaks and interruption limits
          </p>
        </div>
        
        {/* Invisible spacer to balance the back button and truly center content */}
        {onBack && (
          <div 
            className="mr-4"
            style={{ 
              minHeight: '44px',
              minWidth: '44px'
            }}
          />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 max-w-md mx-auto w-full space-y-6">
        {/* Break Duration */}
        <Card 
          className="p-6"
          style={{
            backgroundColor: 'var(--df-surface)',
            borderColor: 'var(--df-border)',
            borderRadius: 'var(--df-radius-md)',
            boxShadow: 'var(--df-shadow-sm)'
          }}
        >
          <div className="mb-4">
            <h3 
              className="mb-2"
              style={{
                fontSize: 'var(--df-type-subtitle-size)',
                fontWeight: 'var(--df-type-subtitle-weight)',
                color: 'var(--df-text)'
              }}
            >
              Break duration
            </h3>
            <p 
              style={{
                fontSize: 'var(--df-type-caption-size)',
                color: 'var(--df-text-muted)'
              }}
            >
              How long should your breaks be?
            </p>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span 
                style={{
                  fontSize: 'var(--df-type-body-size)',
                  color: 'var(--df-text)'
                }}
              >
                {breakDuration} minutes
              </span>
            </div>
            
            <Slider
              value={[breakDuration]}
              onValueChange={(value) => setBreakDuration(value[0])}
              min={5}
              max={30}
              step={5}
              className="w-full [&>span:first-child]:bg-df-primary [&>span:last-child]:bg-df-surface"
              style={{
                '--slider-track': 'var(--df-primary)',
                '--slider-range': 'var(--df-surface)'
              } as React.CSSProperties}
            />
            
            <div className="flex justify-between text-xs" style={{ color: 'var(--df-text-muted)' }}>
              <span>5 min</span>
              <span>30 min</span>
            </div>
          </div>
        </Card>

        {/* Break Frequency */}
        <Card 
          className="p-6"
          style={{
            backgroundColor: 'var(--df-surface)',
            borderColor: 'var(--df-border)',
            borderRadius: 'var(--df-radius-md)',
            boxShadow: 'var(--df-shadow-sm)'
          }}
        >
          <div className="mb-4">
            <h3 
              className="mb-2"
              style={{
                fontSize: 'var(--df-type-subtitle-size)',
                fontWeight: 'var(--df-type-subtitle-weight)',
                color: 'var(--df-text)'
              }}
            >
              Break frequency
            </h3>
            <p 
              style={{
                fontSize: 'var(--df-type-caption-size)',
                color: 'var(--df-text-muted)'
              }}
            >
              How often would you like to take breaks?
            </p>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span 
                style={{
                  fontSize: 'var(--df-type-body-size)',
                  color: 'var(--df-text)'
                }}
              >
                Every {breakFrequency} minutes
              </span>
            </div>
            
            <Slider
              value={[breakFrequency]}
              onValueChange={(value) => setBreakFrequency(value[0])}
              min={30}
              max={180}
              step={15}
              className="w-full [&>span:first-child]:bg-df-border [&>span:last-child]:bg-df-primary"
              style={{
                '--slider-track': 'var(--df-border)',
                '--slider-range': 'var(--df-primary)'
              } as React.CSSProperties}
            />
            
            <div className="flex justify-between text-xs" style={{ color: 'var(--df-text-muted)' }}>
              <span>30 min</span>
              <span>3 hours</span>
            </div>
          </div>
        </Card>

        {/* Interruption Budget */}
        <Card 
          className="p-6"
          style={{
            backgroundColor: 'var(--df-surface)',
            borderColor: 'var(--df-border)',
            borderRadius: 'var(--df-radius-md)',
            boxShadow: 'var(--df-shadow-sm)'
          }}
        >
          <div className="mb-4">
            <h3 
              className="mb-2"
              style={{
                fontSize: 'var(--df-type-subtitle-size)',
                fontWeight: 'var(--df-type-subtitle-weight)',
                color: 'var(--df-text)'
              }}
            >
              Daily interruption budget
            </h3>
            <p 
              style={{
                fontSize: 'var(--df-type-caption-size)',
                color: 'var(--df-text-muted)'
              }}
            >
              How many non-urgent interruptions can you handle per day?
            </p>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span 
                style={{
                  fontSize: 'var(--df-type-body-size)',
                  color: 'var(--df-text)'
                }}
              >
                {interruptionBudget} {interruptionBudget === 1 ? 'interruption' : 'interruptions'}
              </span>
            </div>
            
            <Slider
              value={[interruptionBudget]}
              onValueChange={(value) => setInterruptionBudget(value[0])}
              min={0}
              max={10}
              step={1}
              className="w-full [&>span:first-child]:bg-df-border [&>span:last-child]:bg-df-primary"
              style={{
                '--slider-track': 'var(--df-border)',
                '--slider-range': 'var(--df-primary)'
              } as React.CSSProperties}
            />
            
            <div className="flex justify-between text-xs" style={{ color: 'var(--df-text-muted)' }}>
              <span>0</span>
              <span>10</span>
            </div>
          </div>
          
          <div 
            className="mt-4 p-3 rounded"
            style={{
              backgroundColor: 'var(--df-surface-alt)',
              fontSize: 'var(--df-type-caption-size)',
              color: 'var(--df-text-muted)'
            }}
          >
            💡 Day Foundry will help you track and manage interruptions to protect your focus time.
          </div>
        </Card>

        {/* Quick Presets */}
        <div>
          <h4 
            className="mb-3"
            style={{
              fontSize: 'var(--df-type-body-size)',
              fontWeight: 'var(--df-type-body-weight)',
              color: 'var(--df-text)'
            }}
          >
            Quick presets
          </h4>
          
          <div className="grid grid-cols-2 gap-3">
            <PresetButton
              label="High Focus"
              description="5 min breaks, every 2h"
              onClick={() => {
                setBreakDuration(5);
                setBreakFrequency(120);
                setInterruptionBudget(1);
              }}
            />
            <PresetButton
              label="Balanced"
              description="15 min breaks, every 90m"
              onClick={() => {
                setBreakDuration(15);
                setBreakFrequency(90);
                setInterruptionBudget(3);
              }}
            />
            <PresetButton
              label="Collaborative"
              description="20 min breaks, every 60m"
              onClick={() => {
                setBreakDuration(20);
                setBreakFrequency(60);
                setInterruptionBudget(5);
              }}
            />
            <PresetButton
              label="Flexible"
              description="30 min breaks, every 3h"
              onClick={() => {
                setBreakDuration(30);
                setBreakFrequency(180);
                setInterruptionBudget(7);
              }}
            />
          </div>
        </div>
      </div>

      {/* Continue Button */}
      <div className="pb-6 mt-6">
        <Button
          onClick={handleContinue}
          className="w-full"
          style={{
            backgroundColor: 'var(--df-primary)',
            color: 'var(--df-primary-contrast)',
            borderRadius: 'var(--df-radius-sm)',
            minHeight: '48px',
            fontSize: 'var(--df-type-body-size)',
            fontWeight: 'var(--df-type-body-weight)'
          }}
        >
          Continue
        </Button>
      </div>
    </div>
  );
}

interface PresetButtonProps {
  label: string;
  description: string;
  onClick: () => void;
}

function PresetButton({ label, description, onClick }: PresetButtonProps) {
  return (
    <button
      onClick={onClick}
      className="p-3 rounded text-left transition-colors"
      style={{
        backgroundColor: 'var(--df-surface-alt)',
        borderColor: 'var(--df-border)',
        border: '1px solid',
        borderRadius: 'var(--df-radius-sm)',
        minHeight: '64px'
      }}
    >
      <div 
        className="font-medium mb-1"
        style={{
          fontSize: 'var(--df-type-caption-size)',
          color: 'var(--df-text)'
        }}
      >
        {label}
      </div>
      <div 
        style={{
          fontSize: 'var(--df-type-caption-size)',
          color: 'var(--df-text-muted)'
        }}
      >
        {description}
      </div>
    </button>
  );
}